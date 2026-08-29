import { useState, useEffect, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdWineBar, MdRefresh, MdWarning, MdCheckCircle,
  MdReportProblem, MdPerson, MdSearch, MdClose, MdLocalShipping,
  MdFactCheck, MdAssignmentTurnedIn, MdFilterList,
  MdCalendarToday, MdExpandMore, MdExpandLess, MdHistory, MdDirectionsBike,
  MdDateRange, MdInfoOutline
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useOperationalDay from '../../hooks/useOperationalDay';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)}-${MONTHS[parseInt(m)-1]}-${y}`;
}

function getWeekEnd(startStr) {
  const d = new Date(`${startStr}T12:00:00+05:30`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmptyBottlesPage() {
  // ── Operational day (source of truth) ────────────────────────────────────
  const { operationalDate, displayDate: opDisplayDate, loading: opDayLoading } = useOperationalDay();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterMode, setFilterMode]     = useState('daily');   // 'daily'|'weekly'|'monthly'|'custom'
  const [selectedDate, setSelectedDate] = useState('');        // daily mode
  const [weekStart, setWeekStart]       = useState('');        // weekly mode
  const [selectedMonth, setSelectedMonth] = useState('');      // monthly mode (YYYY-MM)
  const [startDate, setStartDate]       = useState('');        // custom mode
  const [endDate, setEndDate]           = useState('');        // custom mode

  // ── Data state ────────────────────────────────────────────────────────────
  const [logs, setLogs]         = useState([]);
  const [allDps, setAllDps]     = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats]       = useState({ totalIssued: 0, totalReturned: 0, returnRate: 0, pendingIncidents: 0 });
  const [isActiveDay, setIsActiveDay] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);
  const [search, setSearch]     = useState('');
  const [selectedDpId, setSelectedDpId] = useState('');
  const [expandedDpId, setExpandedDpId] = useState(null);

  // ── Review modal state ────────────────────────────────────────────────────
  const [reviewModal, setReviewModal]       = useState(null);
  const [resolving, setResolving]           = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // ── Seed dates from operational day on load ───────────────────────────────
  useEffect(() => {
    if (!opDayLoading && operationalDate) {
      setSelectedDate(prev => prev || operationalDate);
      setSelectedMonth(prev => prev || operationalDate.slice(0, 7));
      // weekStart = 6 days before operational day
      const d = new Date(`${operationalDate}T12:00:00+05:30`);
      d.setDate(d.getDate() - 6);
      const ws = d.toISOString().slice(0, 10);
      setWeekStart(prev => prev || ws);
      setStartDate(prev => prev || `${operationalDate.slice(0, 7)}-01`);
      setEndDate(prev => prev || operationalDate);
    }
  }, [operationalDate, opDayLoading]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    // Guard: wait until dates are seeded from operational day
    if (!operationalDate) return;
    if (filterMode === 'daily'   && !selectedDate)  return;
    if (filterMode === 'weekly'  && !weekStart)      return;
    if (filterMode === 'monthly' && !selectedMonth)  return;
    if (filterMode === 'custom'  && (!startDate || !endDate)) return;

    setLoading(true);
    setError(false);
    try {
      const params = {
        mode:       filterMode,
        dpId:       selectedDpId || undefined,
        date:       filterMode === 'daily'   ? selectedDate   : undefined,
        weekStart:  filterMode === 'weekly'  ? weekStart       : undefined,
        month:      filterMode === 'monthly' ? selectedMonth   : undefined,
        startDate:  filterMode === 'custom'  ? startDate       : undefined,
        endDate:    filterMode === 'custom'  ? endDate         : undefined,
      };
      const res = await api.get('/empty-bottles', { params });
      setLogs(res.data.data       || []);
      setAllDps(res.data.allDps   || []);
      setStats(res.data.stats     || { totalIssued: 0, totalReturned: 0, returnRate: 0, pendingIncidents: 0 });
      setIncidents(res.data.incidents || []);
      setIsActiveDay(Boolean(res.data.isActiveDay));
    } catch {
      setError(true);
      toast.error('Failed to load empty bottle audit logs.');
    } finally {
      setLoading(false);
    }
  }, [filterMode, selectedDate, weekStart, selectedMonth, startDate, endDate, selectedDpId, operationalDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Resolve incident ──────────────────────────────────────────────────────
  const handleResolveIncident = async (statusChoice) => {
    if (!reviewModal) return;
    setResolving(true);
    try {
      await api.put(`/empty-bottles/incidents/${reviewModal.id}/review`, { status: statusChoice, resolutionNotes });
      toast.success(`Incident updated: ${statusChoice}`);
      setReviewModal(null); setResolutionNotes('');
      fetchData();
    } catch {
      toast.error('Failed to update incident.');
    } finally { setResolving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredLogs = logs.filter(l =>
    (l?.dpName || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (l?.routeName || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (l?.vehicleNumber || '').toLowerCase().includes((search || '').toLowerCase())
  );

  // Label for the "Showing data for" indicator
  const periodLabel = (() => {
    if (filterMode === 'daily')   return selectedDate ? fmtDisplay(selectedDate) : '—';
    if (filterMode === 'weekly')  return weekStart ? `${fmtDisplay(weekStart)} → ${fmtDisplay(getWeekEnd(weekStart))}` : '—';
    if (filterMode === 'monthly') return selectedMonth ? (() => { const [y,m]=selectedMonth.split('-'); return `${MONTHS[parseInt(m)-1]} ${y}`; })() : '—';
    if (filterMode === 'custom')  return startDate && endDate ? `${fmtDisplay(startDate)} → ${fmtDisplay(endDate)}` : '—';
    return '—';
  })();

  return (
    <div>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Empty Bottle Collection Management</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Super Admin audit for daily 1L &amp; 0.5L glass bottle returns — DB2 Manager App data
            </p>
            {opDisplayDate && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(59,130,246,0.12))',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: 20, padding: '2px 12px', fontSize: 12, fontWeight: 700,
                color: 'var(--primary)', letterSpacing: 0.2
              }}>
                <MdCalendarToday style={{ fontSize: 12 }} />
                Op Day: {opDisplayDate} &nbsp;
                <span style={{ background: '#10b981', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>ACTIVE</span>
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
          <MdRefresh /> {loading ? 'Loading...' : 'Refresh DB2 Audit'}
        </button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Bottles Dispatched', value: stats.totalIssued,      suffix: 'Bottles',  icon: <MdLocalShipping />, color: 'rgba(59,130,246,0.1)',  iconColor: 'var(--primary)' },
          { label: 'Empty Bottles Collected',  value: stats.totalReturned,    suffix: 'Bottles',  icon: <MdCheckCircle />,   color: 'rgba(16,185,129,0.1)', iconColor: '#10b981'        },
          { label: 'Overall Collection Rate',  value: `${stats.returnRate}%`, suffix: null,       icon: <MdFactCheck />,     color: 'rgba(139,92,246,0.1)', iconColor: 'var(--primary)' },
          { label: 'Manager Incident Flags',   value: stats.pendingIncidents, suffix: 'Pending',  icon: <MdWarning />,       color: 'rgba(239,68,68,0.1)',  iconColor: '#ef4444',
            borderColor: stats.pendingIncidents > 0 ? 'rgba(239,68,68,0.4)' : 'var(--border)' },
        ].map(({ label, value, suffix, icon, color, iconColor, borderColor }) => (
          <div key={label} className="card card-body" style={{ borderColor: borderColor || 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: color, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: iconColor }}>
                  {value} {suffix && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{suffix}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {periodLabel}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Unified Filter Bar ────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>

            {/* Left: mode + date controls */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Mode selector */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <MdFilterList style={{ fontSize: 13, verticalAlign: 'middle' }} /> Period
                </div>
                <select
                  className="form-input"
                  style={{ width: 150, fontWeight: 600 }}
                  value={filterMode}
                  onChange={e => setFilterMode(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Daily: single date */}
              {filterMode === 'daily' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <MdCalendarToday style={{ fontSize: 13, verticalAlign: 'middle' }} /> Date
                  </div>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 170, fontWeight: 600 }}
                    value={selectedDate}
                    max={operationalDate || undefined}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>
              )}

              {/* Weekly: week start */}
              {filterMode === 'weekly' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <MdDateRange style={{ fontSize: 13, verticalAlign: 'middle' }} /> Week Start
                  </div>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 170, fontWeight: 600 }}
                    value={weekStart}
                    max={operationalDate || undefined}
                    onChange={e => setWeekStart(e.target.value)}
                  />
                </div>
              )}

              {/* Monthly: YYYY-MM */}
              {filterMode === 'monthly' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <MdCalendarToday style={{ fontSize: 13, verticalAlign: 'middle' }} /> Month
                  </div>
                  <input
                    type="month"
                    className="form-input"
                    style={{ width: 170, fontWeight: 600 }}
                    value={selectedMonth}
                    max={operationalDate ? operationalDate.slice(0, 7) : undefined}
                    onChange={e => setSelectedMonth(e.target.value)}
                  />
                </div>
              )}

              {/* Custom: start + end */}
              {filterMode === 'custom' && (
                <>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>From</div>
                    <input type="date" className="form-input" style={{ width: 155 }} value={startDate}
                      max={endDate || operationalDate || undefined} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>To</div>
                    <input type="date" className="form-input" style={{ width: 155 }} value={endDate}
                      min={startDate || undefined} max={operationalDate || undefined} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </>
              )}

              {/* DP filter */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Delivery Person</div>
                <select className="form-input" style={{ width: 200 }} value={selectedDpId} onChange={e => setSelectedDpId(e.target.value)}>
                  <option value="">— All DPs —</option>
                  {allDps.map(dp => <option key={dp.id} value={dp.id}>{dp.name} ({dp.dpCode})</option>)}
                </select>
              </div>
            </div>

            {/* Right: search */}
            <div style={{ position: 'relative' }}>
              <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
              <input type="text" className="form-input" style={{ paddingLeft: 34, width: 200 }}
                placeholder="Search DP or route..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* ── Data period indicator ─────────────────────────────────────────── */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              <MdInfoOutline style={{ verticalAlign: 'middle', marginRight: 3 }} />Showing data for:
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.08))',
              border: '1px solid rgba(139,92,246,0.28)',
              borderRadius: 16, padding: '3px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--primary)'
            }}>
              <MdCalendarToday style={{ fontSize: 13 }} />
              {periodLabel}
            </span>
            {isActiveDay && (
              <span style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 16, padding: '3px 12px', fontSize: 11.5, fontWeight: 700, color: '#10b981' }}>
                ✓ ACTIVE OPERATIONAL DAY
              </span>
            )}
            {filterMode === 'daily' && selectedDate && !isActiveDay && selectedDate < (operationalDate || '') && (
              <span style={{ background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 16, padding: '3px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                Historical
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Flagged Incidents Alert ───────────────────────────────────────────── */}
      {incidents.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <MdReportProblem style={{ color: '#ef4444', fontSize: 22 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>
              Manager Bottle Breakage &amp; Unreturned Bottle Flags ({incidents.length})
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {incidents.map(inc => (
              <div key={inc.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{inc.dp_name}</div>
                  <span className={`badge ${inc.status === 'Pending Review' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 10 }}>{inc.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Route: <strong>{inc.route_name}</strong> | Type: <strong>{inc.bottle_type}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginTop: 4 }}>
                  Broken: {inc.broken_count} | Unreturned: {inc.missing_count}
                </div>
                {inc.manager_notes && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>"{inc.manager_notes}"</div>
                )}
                {inc.status === 'Pending Review' && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setReviewModal(inc)}>
                    <MdAssignmentTurnedIn /> Review Incident
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DP Audit Table ────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdDirectionsBike style={{ color: 'var(--primary)' }} /> Delivery Person Empty Bottle Audit Table
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isActiveDay && opDisplayDate && (
              <span style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 16, padding: '3px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--primary)' }}>
                Op Day: {opDisplayDate}
              </span>
            )}
            <span className="badge badge-blue">{filteredLogs.length} Delivery Persons</span>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>DELIVERY PERSON</th>
                  <th style={{ minWidth: 110 }}>VEHICLE NO</th>
                  <th style={{ minWidth: 130 }}>ASSIGNED ROUTE</th>
                  <th>DISPATCHED (1L / ½L)</th>
                  <th>COLLECTED (1L / ½L)</th>
                  <th style={{ color: '#ef4444', minWidth: 130 }}>MISSING / BROKEN</th>
                  <th>RETURN RATE %</th>
                  <th style={{ minWidth: 130 }}>INCIDENT FLAGS</th>
                  <th style={{ minWidth: 130 }}>DATE AUDIT</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>
                      <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Loading live delivery person bottle audit records...</div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>
                      <div style={{ color: '#ef4444', fontSize: 32, marginBottom: 8 }}><MdWarning /></div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: '#ef4444' }}>Failed to load delivery person audit data</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>An error occurred while communicating with the Master Module database.</div>
                      <button className="btn btn-primary btn-sm" onClick={fetchData}>
                        <MdRefresh /> Retry Connection
                      </button>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: 'var(--text-main)' }}>
                        No active delivery persons available for this operational day.
                      </div>
                      <div style={{ fontSize: 13, maxWidth: 450, margin: '0 auto' }}>
                        Ensure delivery persons exist and are marked as active in the Master Module for {periodLabel}.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(dp => {
                    const isExpanded = expandedDpId === dp.id;
                    const totalMissing = dp.missing1L + dp.missingHalfL;
                    return (
                      <Fragment key={dp.id}>
                        <tr
                          key={dp.id}
                          style={{ cursor: 'pointer', background: selectedDpId === dp.id ? 'rgba(59,130,246,0.05)' : 'transparent' }}
                          onClick={() => { setSelectedDpId(dp.id); setExpandedDpId(isExpanded ? null : dp.id); }}
                        >
                          <td style={{ fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                <MdPerson />
                              </div>
                              <div>
                                <div>{dp.dpName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dp.dpCode}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{dp.vehicleNumber}</td>
                          <td>
                            <span className={`badge ${dp.routeName?.includes('Standby') ? 'badge-warning' : 'badge-blue'}`} style={{ fontWeight: 600 }}>
                              {dp.routeName || 'Unassigned'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{dp.issued1L}</span> 1L / <span style={{ fontWeight: 600 }}>{dp.issuedHalfL}</span> ½L
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: '#10b981' }}>{dp.returned1L}</span> 1L / <span style={{ fontWeight: 700, color: '#10b981' }}>{dp.returnedHalfL}</span> ½L
                          </td>
                          <td>
                            <span style={{ fontWeight: 800, color: totalMissing > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                              {dp.missing1L} 1L / {dp.missingHalfL} ½L
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${dp.returnRate >= 95 ? 'badge-success' : dp.returnRate >= 85 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 800 }}>
                              {dp.returnRate}%
                            </span>
                          </td>
                          <td>
                            {dp.hasFlag ? (
                              <span className="badge badge-danger" style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <MdWarning /> {dp.flagCount || 1} Incidents
                              </span>
                            ) : (
                              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <MdCheckCircle /> Clean Return
                              </span>
                            )}
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: '4px 10px' }}
                              onClick={(e) => { e.stopPropagation(); setExpandedDpId(isExpanded ? null : dp.id); }}>
                              <MdHistory /> {isExpanded ? 'Hide' : 'Date Audit'} {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Date-Wise Sub-Table */}
                        {isExpanded && dp.dateLogs && (
                          <tr key={`sub-${dp.id}`}>
                            <td colSpan={9} style={{ background: 'rgba(15,23,42,0.025)', padding: '16px 24px' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MdCalendarToday /> Date-Wise Bottle Return Audit: <strong>{dp.dpName}</strong>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({dp.dateLogs.length} day{dp.dateLogs.length !== 1 ? 's' : ''} audited)</span>
                              </div>
                              <div className="table-wrapper">
                                <table className="table" style={{ background: '#fff', borderRadius: 8 }}>
                                  <thead>
                                    <tr>
                                      <th>DATE</th>
                                      <th>ROUTE</th>
                                      <th>1L DISPATCHED</th>
                                      <th>1L RETURNED</th>
                                      <th>½L DISPATCHED</th>
                                      <th>½L RETURNED</th>
                                      <th>MISSING / BROKEN</th>
                                      <th>COLLECTION %</th>
                                      <th>AUDIT NOTES</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dp.dateLogs.map((dLog, idx) => {
                                      const dayMissing = dLog.missing1L + dLog.missingHalfL;
                                      const isOpDay = dLog.date === operationalDate;
                                      return (
                                        <tr key={idx} style={{ background: dLog.hasFlag ? 'rgba(239,68,68,0.04)' : isOpDay ? 'rgba(139,92,246,0.04)' : 'transparent' }}>
                                          <td style={{ fontWeight: 700, fontSize: 12.5 }}>
                                            {fmtDisplay(dLog.date)}
                                            {isOpDay && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(139,92,246,0.15)', color: 'var(--primary)', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>Op Day</span>}
                                          </td>
                                          <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{dLog.routeName}</span></td>
                                          <td>{dLog.issued1L}</td>
                                          <td style={{ color: '#10b981', fontWeight: 700 }}>{dLog.returned1L}</td>
                                          <td>{dLog.issuedHalfL}</td>
                                          <td style={{ color: '#10b981', fontWeight: 700 }}>{dLog.returnedHalfL}</td>
                                          <td style={{ color: dayMissing > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 800 }}>
                                            {dLog.isFuture || dLog.isBeforeDb2 ? '—' : dayMissing > 0 ? `${dLog.missing1L} (1L) / ${dLog.missingHalfL} (½L)` : '0'}
                                          </td>
                                          <td>
                                            {dLog.isFuture || dLog.isBeforeDb2 ? (
                                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{dLog.isFuture ? 'Upcoming' : 'Pre-DB2'}</span>
                                            ) : !dLog.hasRecords ? (
                                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No record</span>
                                            ) : (
                                              <span className={`badge ${dLog.returnRate >= 95 ? 'badge-success' : dLog.returnRate >= 85 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                                                {dLog.returnRate}%
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ fontSize: 12, color: dLog.hasFlag ? '#ef4444' : 'var(--text-muted)', fontStyle: 'italic' }}>
                                            {dLog.isFuture ? '—' : dLog.notes || (!dLog.hasRecords ? 'No record yet' : 'Normal return')}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Incident Review Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {reviewModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setReviewModal(null)}>
            <motion.div className="modal" style={{ maxWidth: 520 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdReportProblem style={{ color: '#ef4444' }} /> Super Admin Incident Review
                </h2>
                <button className="icon-btn" onClick={() => setReviewModal(null)}><MdClose /></button>
              </div>
              <div className="modal-body">
                <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{reviewModal.dp_name} ({reviewModal.route_name})</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Bottle Type: <strong>{reviewModal.bottle_type}</strong> | Broken: <strong style={{ color: '#ef4444' }}>{reviewModal.broken_count}</strong> | Unreturned: <strong style={{ color: '#ef4444' }}>{reviewModal.missing_count}</strong>
                  </div>
                  {reviewModal.manager_notes && (
                    <div style={{ fontSize: 12, marginTop: 8, fontStyle: 'italic', color: 'var(--text-muted)' }}>Manager Note: "{reviewModal.manager_notes}"</div>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Super Admin Resolution Notes</label>
                  <textarea className="form-input" rows={3} placeholder="Enter audit notes or resolution details..."
                    value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setReviewModal(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm" disabled={resolving} onClick={() => handleResolveIncident('Resolved - Charged DP')}>Charge DP</button>
                <button className="btn btn-success btn-sm" disabled={resolving} onClick={() => handleResolveIncident('Resolved - Reimbursed')}>Reimburse &amp; Resolve</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Close tag for outer div */}
    </div>
  );
}
