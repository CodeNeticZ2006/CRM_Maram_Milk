import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdWineBar, MdRefresh, MdWarning, MdCheckCircle, MdCancel,
  MdReportProblem, MdPerson, MdSearch, MdClose, MdLocalShipping,
  MdInventory2, MdFactCheck, MdAssignmentTurnedIn, MdFilterList,
  MdCalendarToday, MdExpandMore, MdExpandLess, MdHistory, MdDirectionsBike
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function EmptyBottlesPage() {
  const [logs, setLogs] = useState([]);
  const [allDps, setAllDps] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ totalIssued: 0, totalReturned: 0, returnRate: 100, pendingIncidents: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Time & DP Filter States (matching Attendance Audit)
  const [timeFilter, setTimeFilter] = useState('this_month');
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-09');
  const [selectedDpId, setSelectedDpId] = useState('');
  const [expandedDpId, setExpandedDpId] = useState(null);

  // Review Modal State
  const [reviewModal, setReviewModal] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        timeFilter,
        month: selectedMonth,
        startDate: timeFilter === 'custom' ? startDate : undefined,
        endDate: timeFilter === 'custom' ? endDate : undefined,
        dpId: selectedDpId || undefined,
      };
      const res = await api.get('/empty-bottles', { params });
      setLogs(res.data.data || []);
      setAllDps(res.data.allDps || []);
      setStats(res.data.stats || { totalIssued: 0, totalReturned: 0, returnRate: 100, pendingIncidents: 0 });
      setIncidents(res.data.incidents || []);
    } catch {
      toast.error('Failed to load DB2 empty bottle logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeFilter, selectedMonth, startDate, endDate, selectedDpId]);

  const handleResolveIncident = async (statusChoice) => {
    if (!reviewModal) return;
    setResolving(true);
    try {
      await api.put(`/empty-bottles/incidents/${reviewModal.id}/review`, {
        status: statusChoice,
        resolutionNotes,
      });
      toast.success(`Incident updated: ${statusChoice}`);
      setReviewModal(null);
      setResolutionNotes('');
      fetchData();
    } catch {
      toast.error('Failed to update incident.');
    } finally {
      setResolving(false);
    }
  };

  const filteredLogs = logs.filter(l =>
    l.dpName.toLowerCase().includes(search.toLowerCase()) ||
    l.routeName.toLowerCase().includes(search.toLowerCase()) ||
    l.vehicleNumber.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDpRecord = logs.find(l => l.id === selectedDpId) || logs[0];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Empty Bottle Collection Management</h1>
          <p className="page-subtitle">Super Admin audit for daily 1L & 0.5L glass bottle returns retrieved DP-wise from DB2</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
          <MdRefresh /> {loading ? 'Loading...' : 'Refresh DB2 Audit'}
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdLocalShipping />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Bottles Dispatched</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalIssued} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bottles</span></div>
            </div>
          </div>
        </div>

        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdCheckCircle />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Empty Bottles Collected</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{stats.totalReturned} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bottles</span></div>
            </div>
          </div>
        </div>

        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(139,92,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdFactCheck />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Overall Collection Rate</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{stats.returnRate}%</div>
            </div>
          </div>
        </div>

        <div className="card card-body" style={{ borderColor: stats.pendingIncidents > 0 ? 'rgba(239,68,68,0.4)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdWarning />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Manager Incident Flags</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{stats.pendingIncidents} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER CONTROLS BAR (MATCHING ATTENDANCE AUDIT FORMAT) ───────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdFilterList style={{ color: 'var(--primary)', fontSize: 20 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Time Filter:</span>
                <select
                  className="form-input"
                  style={{ width: 140 }}
                  value={timeFilter}
                  onChange={e => setTimeFilter(e.target.value)}
                >
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="custom">Custom Date</option>
                </select>
              </div>

              {timeFilter === 'this_month' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdCalendarToday style={{ color: 'var(--text-muted)', fontSize: 18 }} />
                  <input
                    type="month"
                    className="form-input"
                    style={{ width: 160 }}
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                  />
                </div>
              )}

              {timeFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Start Date:</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: 145 }}
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>End Date:</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: 145 }}
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Filter by Delivery Person:</span>
                <select
                  className="form-input"
                  style={{ width: 220 }}
                  value={selectedDpId}
                  onChange={e => setSelectedDpId(e.target.value)}
                >
                  <option value="">— All Delivery Persons —</option>
                  {allDps.map(dp => (
                    <option key={dp.id} value={dp.id}>{dp.name} ({dp.dpCode})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 34, width: 200 }}
                placeholder="Search DP or route..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Flagged Incidents Alert Banner */}
      {incidents.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <MdReportProblem style={{ color: '#ef4444', fontSize: 22 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>
              Manager Bottle Breakage & Unreturned Bottle Flags ({incidents.length})
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {incidents.map(inc => (
              <div key={inc.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{inc.dp_name}</div>
                  <span className={`badge ${inc.status === 'Pending Review' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 10 }}>
                    {inc.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Route: <strong>{inc.route_name}</strong> | Type: <strong>{inc.bottle_type}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginTop: 4 }}>
                  Broken: {inc.broken_count} | Unreturned: {inc.missing_count}
                </div>
                {inc.manager_notes && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    "{inc.manager_notes}"
                  </div>
                )}
                {inc.status === 'Pending Review' && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 10, width: '100%', fontSize: 12 }}
                    onClick={() => setReviewModal(inc)}
                  >
                    <MdAssignmentTurnedIn /> Review Incident
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main DP Collection Table Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdDirectionsBike style={{ color: 'var(--primary)' }} /> Delivery Person Empty Bottle Audit Table
          </div>
          <span className="badge badge-blue">{filteredLogs.length} Delivery Persons</span>
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
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>Loading DB2 bottle collection records...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No bottle return records found.</td></tr>
                ) : (
                  filteredLogs.map(dp => {
                    const isExpanded = expandedDpId === dp.id;
                    const totalMissing = dp.missing1L + dp.missingHalfL;
                    return (
                      <>
                        <tr
                          key={dp.id}
                          style={{ cursor: 'pointer', background: selectedDpId === dp.id ? 'rgba(59,130,246,0.05)' : 'transparent' }}
                          onClick={() => {
                            setSelectedDpId(dp.id);
                            setExpandedDpId(isExpanded ? null : dp.id);
                          }}
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
                          <td><span className="badge badge-gray">{dp.routeName}</span></td>
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
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 12, padding: '4px 10px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDpId(isExpanded ? null : dp.id);
                              }}
                            >
                              <MdHistory /> {isExpanded ? 'Hide Audit' : 'Date Audit'} {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
                            </button>
                          </td>
                        </tr>

                        {/* EXPANDABLE DATE-WISE AUDIT TIMELINE SUB-TABLE */}
                        {isExpanded && dp.dateLogs && (
                          <tr key={`sub-${dp.id}`}>
                            <td colSpan={9} style={{ background: 'rgba(15,23,42,0.02)', padding: '16px 24px' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MdCalendarToday /> Date-Wise Bottle Return Audit Ledger: <strong>{dp.dpName}</strong> ({dp.dateLogs.length} Days Audited)
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
                                      <th>MANAGER AUDIT NOTES</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dp.dateLogs.map((dLog, idx) => {
                                      const dayMissing = dLog.missing1L + dLog.missingHalfL;
                                      return (
                                        <tr key={idx} style={{ background: dLog.hasFlag ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                                          <td style={{ fontWeight: 700, fontSize: 12.5 }}>{dLog.date}</td>
                                          <td><span className="badge badge-gray" style={{ fontSize: 11 }}>{dLog.routeName}</span></td>
                                          <td>{dLog.issued1L}</td>
                                          <td style={{ color: '#10b981', fontWeight: 700 }}>{dLog.returned1L}</td>
                                          <td>{dLog.issuedHalfL}</td>
                                          <td style={{ color: '#10b981', fontWeight: 700 }}>{dLog.returnedHalfL}</td>
                                          <td style={{ color: dayMissing > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 800 }}>
                                            {dayMissing > 0 ? `${dLog.missing1L} (1L) / ${dLog.missingHalfL} (½L)` : '0'}
                                          </td>
                                          <td>
                                            <span className={`badge ${dLog.returnRate >= 95 ? 'badge-success' : dLog.returnRate >= 85 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                                              {dLog.returnRate}%
                                            </span>
                                          </td>
                                          <td style={{ fontSize: 12, color: dLog.hasFlag ? '#ef4444' : 'var(--text-muted)', fontStyle: 'italic' }}>
                                            {dLog.notes || 'Normal empty bottle return'}
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
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Super Admin Incident Review Modal */}
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
                    <div style={{ fontSize: 12, marginTop: 8, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      Manager Note: "{reviewModal.manager_notes}"
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Super Admin Resolution Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Enter audit notes or resolution details..."
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setReviewModal(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm" disabled={resolving} onClick={() => handleResolveIncident('Resolved - Charged DP')}>
                  Charge DP
                </button>
                <button className="btn btn-success btn-sm" disabled={resolving} onClick={() => handleResolveIncident('Resolved - Reimbursed')}>
                  Reimburse & Resolve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
