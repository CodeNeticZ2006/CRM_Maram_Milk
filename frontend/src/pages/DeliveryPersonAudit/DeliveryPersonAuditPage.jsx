import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdRefresh, MdPerson, MdDirectionsBike,
  MdCalendarToday, MdFilterList, MdCheckCircle, MdCancel,
  MdEventNote, MdChevronLeft, MdChevronRight, MdClose
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function DeliveryPersonAuditPage() {
  // DP Profiles State (Live DB2 Data)
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [dpLoading, setDpLoading] = useState(true);

  // DP Attendance Audit State
  const [dpAttendance, setDpAttendance] = useState([]);
  const [allDps, setAllDps] = useState([]);
  const [timeFilter, setTimeFilter] = useState('this_month');
  const [selectedDpId, setSelectedDpId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attendanceLoad, setAttLoad] = useState(false);
  const [selectedDayDetail, setDayDetail] = useState(null);

  // Calendar starts in current IST month and fetches that month from DB2.
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => {
    const istDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [year, month] = istDate.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });

  // Fetch Delivery Persons Profiles (Live DB2)
  const fetchDeliveryPersons = async () => {
    setDpLoading(true);
    try {
      const res = await api.get('/access-control/delivery-persons').catch(() => ({ data: { data: [] } }));
      setDeliveryPersons(res.data.data || []);
    } catch {
      toast.error('Failed to load Delivery Persons profiles.');
    } finally {
      setDpLoading(false);
    }
  };

  // Fetch DP Attendance Audit Data
  const fetchDpAttendance = useCallback(async () => {
    setAttLoad(true);
    try {
      const params = {
        timeFilter,
        dpId: selectedDpId,
        month: `${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(2, '0')}`,
      };
      if (timeFilter === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const res = await api.get('/inventory/dp-attendance', { params });
      if (res.data?.success) {
        setDpAttendance(res.data.data || []);
        if (res.data.allDps) setAllDps(res.data.allDps);
      }
    } catch {
      toast.error('Failed to load DP attendance audit.');
    } finally {
      setAttLoad(false);
    }
  }, [timeFilter, selectedDpId, startDate, endDate, currentCalendarDate]);

  useEffect(() => {
    fetchDeliveryPersons();
    fetchDpAttendance();
  }, [fetchDpAttendance]);

  const handleRefreshAll = () => {
    fetchDeliveryPersons();
    fetchDpAttendance();
  };

  // Generate 7-column Monthly Sun-Sat Calendar Grid
  const getMonthGridDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = [];
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(null);
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      grid.push(d);
    }
    return grid;
  };

  const handlePrevMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const targetDpRecord = selectedDpId
    ? dpAttendance.find(d => d.dpId === selectedDpId)
    : dpAttendance[0];

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Delivery Person Audit</h1>
          <p className="page-subtitle">Delivery Partner (DP) profiles, attendance, absence tracking, and monthly calendar audit synced live from DB2</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRefreshAll}
          disabled={attendanceLoad || dpLoading}
        >
          <MdRefresh className={(attendanceLoad || dpLoading) ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* DB2 Manager App Sync Banner */}
      <div className="card" style={{ marginBottom: 20, background: 'rgba(59,130,246,0.03)', borderColor: 'rgba(59,130,246,0.2)' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 22 }}>
              <MdDirectionsBike />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Manager App & Delivery Person (DP) Integration (DB2)</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Delivery Person (DP) profiles, vehicle registrations, petrol balances, and attendance are synced in real time from the Manager App DB (DB2 - <code>maram_milk_db</code>).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLE 1: DELIVERY PERSON PROFILES (LIVE DB2 DATA) ───────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">🛵 Delivery Persons ({deliveryPersons.length} DPs) — Live DB2 Data</h3>
          <span className="badge badge-purple">{deliveryPersons.length} DPs Active</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>DP CODE</th>
                  <th>NAME</th>
                  <th>MOBILE</th>
                  <th>VEHICLE NO</th>
                  <th>PETROL BAL.</th>
                </tr>
              </thead>
              <tbody>
                {dpLoading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>Loading DP profiles from DB2...</td></tr>
                ) : deliveryPersons.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No DPs registered in DB2.</td></tr>
                ) : (
                  deliveryPersons.map(dp => (
                    <tr key={dp.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{dp.dpCode || 'DP-001'}</span></td>
                      <td style={{ fontWeight: 600 }}>{dp.name}</td>
                      <td style={{ fontSize: 12 }}>{dp.mobileNumber || '—'}</td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{dp.vehicleNumber || '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{dp.petrolBalance || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Time & DP Filter Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdFilterList style={{ color: 'var(--primary)', fontSize: 20 }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Time Period:</span>
              <select
                className="form-input"
                style={{ width: 140 }}
                value={timeFilter}
                onChange={e => {
                  const val = e.target.value;
                  setTimeFilter(val);
                  if (val === 'custom' && (!startDate || !endDate)) {
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(today);
                    setEndDate(today);
                  }
                }}
              >
                <option value="this_month">This Month</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="custom">Custom Range</option>
              </select>
              {timeFilter === 'custom' && (
                <>
                  <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} aria-label="Attendance start date" />
                  <span style={{ color: 'var(--text-muted)' }}>to</span>
                  <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} aria-label="Attendance end date" />
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <MdPerson style={{ color: 'var(--primary)', fontSize: 20 }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Select DP for Audit Calendar:</span>
              <select
                className="form-input"
                style={{ width: 220 }}
                value={selectedDpId}
                onChange={e => setSelectedDpId(e.target.value)}
              >
                <option value="">— Select Delivery Person —</option>
                {allDps.map(dp => (
                  <option key={dp.id} value={dp.id}>{dp.name} ({dp.dpCode})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLE 2: ATTENDANCE OVERVIEW TABLE WITH DEPARTED ABSENT COLUMN ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdDirectionsBike style={{ color: 'var(--primary)' }} /> Delivery Person Attendance & Absence Audit Table
          </div>
          <span className="badge badge-blue">{dpAttendance.length} Delivery Persons</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>DELIVERY PERSON</th>
                <th style={{ minWidth: 110 }}>VEHICLE NO</th>
                <th style={{ minWidth: 120 }}>ASSIGNED ROUTE</th>
                <th>TOTAL DAYS</th>
                <th style={{ color: '#10b981' }}>PRESENT DAYS</th>
                <th style={{ color: '#ef4444', minWidth: 140 }}>NO. OF DAYS ABSENT</th>
                <th style={{ color: '#d97706', minWidth: 120 }}>STANDBY DAYS</th>
                <th>OVERALL ATTENDANCE %</th>
                <th style={{ minWidth: 180 }}>GREEN / RED / YELLOW PREVIEW</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLoad ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>Loading DB2 attendance records...</td></tr>
              ) : dpAttendance.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No attendance audit records found.</td></tr>
              ) : dpAttendance.map(dp => (
                <tr
                  key={dp.dpId}
                  style={{ cursor: 'pointer', background: selectedDpId === dp.dpId ? 'rgba(59,130,246,0.05)' : 'transparent' }}
                  onClick={() => setSelectedDpId(dp.dpId)}
                >
                  <td style={{ fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MdPerson />
                      </div>
                      <div>
                        <div>{dp.dpName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dp.dpCode}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{dp.vehicleNumber}</td>
                  <td><span className="badge badge-gray">{dp.assignedRoute}</span></td>
                  <td style={{ fontWeight: 600 }}>{dp.totalDays} Days</td>
                  <td>
                    <span className="badge badge-success" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MdCheckCircle /> {dp.presentDays} Present
                    </span>
                  </td>
                  {/* HIGHLIGHTED COLUMN FOR DAYS ABSENT */}
                  <td>
                    <span className="badge badge-danger" style={{ fontWeight: 800, fontSize: 12.5, padding: '4px 12px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MdCancel /> {dp.absentDays} Days Absent
                    </span>
                  </td>
                  {/* HIGHLIGHTED COLUMN FOR STANDBY DAYS */}
                  <td>
                    <span className="badge badge-warning" style={{ fontWeight: 800, fontSize: 12.5, padding: '4px 12px', background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MdEventNote /> {dp.standbyDays || 0} Standby
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${dp.attendancePercentage >= 90 ? 'badge-success' : dp.attendancePercentage >= 75 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 800 }}>
                      {dp.attendancePercentage}%
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 180 }}>
                      {(dp.calendarGrid || []).slice(0, 14).map((cd, idx) => {
                        const st = String(cd.status).toUpperCase();
                        const isPres = st === 'PRESENT';
                        const isAbs = st === 'ABSENT';
                        const isStby = st === 'STANDBY' || st === 'ON_CALL';
                        return (
                          <div
                            key={idx}
                            title={`${cd.date}: ${cd.status}`}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: isPres ? '#10b981' : isAbs ? '#ef4444' : isStby ? '#f59e0b' : '#94a3b8',
                            }}
                          />
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FULL 7-COLUMN MONTHLY GRID CALENDAR ───────────────────────── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdEventNote style={{ color: 'var(--primary)', fontSize: 22 }} />
            <div>
              <span className="card-title">
                Monthly Audit Calendar: <strong>{targetDpRecord ? targetDpRecord.dpName : 'Delivery Person'}</strong>
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Click any day cell to view assigned route details
              </div>
            </div>
          </div>

          {/* Month Navigation (< August 2026 >) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="icon-btn" onClick={handlePrevMonth} title="Previous Month">
              <MdChevronLeft style={{ fontSize: 22 }} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', minWidth: 130, textAlign: 'center' }}>
              {currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button className="icon-btn" onClick={handleNextMonth} title="Next Month">
              <MdChevronRight style={{ fontSize: 22 }} />
            </button>
          </div>

          {/* Status Legend */}
          <div style={{ display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} /> Green = PRESENT</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} /> Red = ABSENT</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} /> Yellow = STANDBY</span>
          </div>
        </div>

        <div className="card-body">
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ minWidth: 540 }}>
              {/* 7-Column Sun to Sat Day Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
              </div>

              {/* Sun-Sat Day Cells Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {getMonthGridDays().map((dayNum, idx) => {
                  if (dayNum === null) {
                    return <div key={`empty-${idx}`} style={{ minHeight: 64, background: 'transparent' }} />;
                  }

                  const year = currentCalendarDate.getFullYear();
                  const monthStr = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
                  const dayStr = String(dayNum).padStart(2, '0');
                  const fullDateStr = `${year}-${monthStr}-${dayStr}`;
                  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                  const isFutureDate = fullDateStr > todayIST;

                  const DB2_START_DATE = '2026-07-15';
                  const isBeforeDb2Date = fullDateStr < DB2_START_DATE;

                  const dayRecord = targetDpRecord?.calendarGrid?.find(c => c.date === fullDateStr) || {
                    date: fullDateStr,
                    status: isFutureDate ? 'Upcoming' : isBeforeDb2Date ? 'No DB2 Record' : 'ABSENT',
                    isFuture: isFutureDate,
                    isBeforeDb2: isBeforeDb2Date,
                    route: targetDpRecord?.assignedRoute || null,
                  };

                  const isInactiveCell = dayRecord.status === 'Upcoming' || dayRecord.status === 'No DB2 Record' || dayRecord.isFuture || dayRecord.isBeforeDb2;
                  const stUpper = String(dayRecord.status).toUpperCase();
                  const isPres = stUpper === 'PRESENT';
                  const isAbs = stUpper === 'ABSENT';

                  const bgColor = isInactiveCell
                    ? 'rgba(255,255,255,0.02)'
                    : isPres
                    ? 'rgba(16,185,129,0.12)'
                    : isAbs
                    ? 'rgba(239,68,68,0.14)'
                    : 'rgba(245,158,11,0.12)';

                  const borderColor = isInactiveCell
                    ? 'var(--border)'
                    : isPres
                    ? 'rgba(16,185,129,0.35)'
                    : isAbs
                    ? 'rgba(239,68,68,0.4)'
                    : 'rgba(245,158,11,0.35)';

                  const textColor = isInactiveCell
                    ? 'var(--text-muted)'
                    : isPres
                    ? '#10b981'
                    : isAbs
                    ? '#ef4444'
                    : '#d97706';

                  return (
                    <motion.div
                      key={`day-${dayNum}`}
                      whileHover={{ scale: isInactiveCell ? 1 : 1.03 }}
                      onClick={() => !isInactiveCell && setDayDetail({ dpName: targetDpRecord?.dpName || 'Delivery Person', ...dayRecord })}
                      style={{
                        minHeight: 68,
                        borderRadius: 10,
                        padding: '8px 10px',
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        cursor: isInactiveCell ? 'default' : 'pointer',
                        opacity: isInactiveCell ? 0.4 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' }}>
                        {dayNum}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: textColor, textAlign: 'right' }}>
                        {isInactiveCell ? '—' : dayRecord.status}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ATTENDANCE DETAIL POPUP MODAL */}
      <AnimatePresence>
        {selectedDayDetail && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDayDetail(null)}>
            <motion.div className="modal" style={{ maxWidth: 420 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 18, fontWeight: 800 }}>Attendance Detail</h2>
                <button className="icon-btn" onClick={() => setDayDetail(null)}><MdClose /></button>
              </div>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {selectedDayDetail.dpName}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Date: <strong>{selectedDayDetail.date}</strong>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Status:{' '}
                  <strong style={{ color: selectedDayDetail.status === 'Present' ? '#10b981' : selectedDayDetail.status === 'Absent' ? '#ef4444' : '#d97706' }}>
                    {selectedDayDetail.status}
                  </strong>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  Route: <strong style={{ color: 'var(--text-primary)' }}>{selectedDayDetail.route || 'Manager Assigned DB2 Route'}</strong>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
