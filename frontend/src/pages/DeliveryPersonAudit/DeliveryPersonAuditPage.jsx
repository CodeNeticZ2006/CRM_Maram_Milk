import { useState, useEffect, useCallback, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdRefresh, MdPerson, MdDirectionsBike,
  MdCalendarToday, MdFilterList, MdCheckCircle, MdCancel,
  MdEventNote, MdChevronLeft, MdChevronRight, MdClose,
  MdSearch, MdAssignment, MdDateRange, MdInfoOutline
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

// Error Boundary Wrapper to prevent white screens if any rendering error occurs
class DPErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('DP Audit Component Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--card-bg, #fff)', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', margin: 20 }}>
          <h2 style={{ color: '#ef4444', marginBottom: 12 }}>⚠️ Something went wrong in Delivery Person Audit</h2>
          <p style={{ color: 'var(--text-muted, #64748b)', marginBottom: 20, fontSize: 14 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DeliveryPersonAuditContent() {
  // Main Tab State: 'attendance-route' | 'daily-audit' | 'monthly-audit' | 'dp-overview'
  const [activeTab, setActiveTab] = useState('attendance-route');

  // DP Profiles State (Live DB2 Data)
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [dpLoading, setDpLoading] = useState(true);

  // Tab 1 (DP Overview) Filter State
  const [overviewSearch, setOverviewSearch] = useState('');
  const [overviewStatusFilter, setOverviewStatusFilter] = useState('all');
  const [overviewRouteFilter, setOverviewRouteFilter] = useState('all');
  const [selectedDpDetail, setSelectedDpDetail] = useState(null); // Clicked DP profile for modal preview

  // DP Attendance Audit State (Used in Tab 2 & Tab 4)
  const [dpAttendance, setDpAttendance] = useState([]);
  const [allDps, setAllDps] = useState([]);
  const [timeFilter, setTimeFilter] = useState('this_month');
  const [selectedDpId, setSelectedDpId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attendanceLoad, setAttLoad] = useState(false);
  const [selectedDayDetail, setDayDetail] = useState(null);

  // Tab 2 (Attendance & Route) Filter State
  const [attSearch, setAttSearch] = useState('');
  const [attRouteFilter, setAttRouteFilter] = useState('all');
  const [attStatusFilter, setAttStatusFilter] = useState('all'); // 'all' | 'present' | 'absent' | 'standby'

  // Tab 3 (Daily Audit) State
  const [dailyDate, setDailyDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Calendar starts in current IST month for Tab 4 (Monthly Audit)
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
      const dps = res?.data?.data;
      setDeliveryPersons(Array.isArray(dps) ? dps : []);
    } catch (e) {
      console.warn('DP profile fetch error:', e);
      setDeliveryPersons([]);
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
      const res = await api.get('/inventory/dp-attendance', { params }).catch(() => ({ data: { data: [], allDps: [] } }));
      if (res?.data?.success) {
        setDpAttendance(Array.isArray(res.data.data) ? res.data.data : []);
        if (Array.isArray(res.data.allDps)) setAllDps(res.data.allDps);
      } else {
        setDpAttendance([]);
      }
    } catch (e) {
      console.warn('DP attendance fetch error:', e);
      setDpAttendance([]);
    } finally {
      setAttLoad(false);
    }
  }, [timeFilter, selectedDpId, startDate, endDate, currentCalendarDate]);

  // Fetch Daily Audit Data for Tab 3
  const fetchDailyAudit = useCallback(async () => {
    setDailyLoading(true);
    try {
      const res = await api.get('/inventory/manager-inventory', { params: { date: dailyDate } }).catch(() => ({ data: null }));
      if (res?.data?.success) {
        setDailyData(res.data);
      } else {
        setDailyData(null);
      }
    } catch {
      setDailyData(null);
    } finally {
      setDailyLoading(false);
    }
  }, [dailyDate]);

  useEffect(() => {
    fetchDeliveryPersons();
    fetchDpAttendance();
  }, [fetchDpAttendance]);

  useEffect(() => {
    if (activeTab === 'daily-audit') {
      fetchDailyAudit();
    }
  }, [activeTab, fetchDailyAudit]);

  const handleRefreshAll = () => {
    fetchDeliveryPersons();
    fetchDpAttendance();
    if (activeTab === 'daily-audit') fetchDailyAudit();
  };

  // Calendar Helpers for Tab 4
  const getMonthGridDays = () => {
    if (!currentCalendarDate || !(currentCalendarDate instanceof Date) || isNaN(currentCalendarDate.getTime())) {
      return [];
    }
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

  const safeDpAttendance = Array.isArray(dpAttendance) ? dpAttendance : [];
  const safeDeliveryPersons = Array.isArray(deliveryPersons) ? deliveryPersons : [];
  const safeAllDps = Array.isArray(allDps) ? allDps : [];

  const targetDpRecord = selectedDpId
    ? safeDpAttendance.find(d => d && d.dpId === selectedDpId)
    : safeDpAttendance[0];

  // Unique routes list for filter dropdowns
  const availableRoutes = Array.from(
    new Set([
      ...safeDeliveryPersons.map(dp => dp?.assignedRoute || dp?.zone).filter(Boolean),
      ...safeDpAttendance.map(dp => dp?.assignedRoute).filter(Boolean)
    ])
  );

  // Tab 1 Filtered DPs
  const filteredOverviewDps = safeDeliveryPersons.filter(dp => {
    if (!dp) return false;
    const s = (overviewSearch || '').toLowerCase();
    const matchesSearch = !s || (
      (dp.name || '').toLowerCase().includes(s) ||
      (dp.dpCode || '').toLowerCase().includes(s) ||
      (dp.mobileNumber || '').toLowerCase().includes(s) ||
      (dp.vehicleNumber || '').toLowerCase().includes(s)
    );
    const matchesStatus = overviewStatusFilter === 'all' ||
      (overviewStatusFilter === 'active' ? dp.isActive !== false : dp.isActive === false);
    const matchesRoute = overviewRouteFilter === 'all' ||
      (dp.assignedRoute || dp.zone || '').toLowerCase().includes(overviewRouteFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesRoute;
  });

  // Tab 2 Filtered Attendance Rows
  const filteredAttendance = safeDpAttendance.filter(dp => {
    if (!dp) return false;
    const s = (attSearch || '').toLowerCase();
    const matchesSearch = !s || (
      (dp.dpName || '').toLowerCase().includes(s) ||
      (dp.dpCode || '').toLowerCase().includes(s) ||
      (dp.vehicleNumber || '').toLowerCase().includes(s)
    );
    const matchesRoute = attRouteFilter === 'all' ||
      (dp.assignedRoute || '').toLowerCase().includes(attRouteFilter.toLowerCase());

    let matchesStatus = true;
    if (attStatusFilter === 'present') matchesStatus = (dp.presentDays || 0) > 0;
    else if (attStatusFilter === 'absent') matchesStatus = (dp.absentDays || 0) > 0;
    else if (attStatusFilter === 'standby') matchesStatus = (dp.standbyDays || 0) > 0;

    return matchesSearch && matchesRoute && matchesStatus;
  });

  // Tab 4 Monthly Summary KPI Calculations
  const monthlyTotalDps = safeDpAttendance.length;
  const monthlyTotalPresent = safeDpAttendance.reduce((acc, d) => acc + (d?.presentDays || 0), 0);
  const monthlyTotalAbsent = safeDpAttendance.reduce((acc, d) => acc + (d?.absentDays || 0), 0);
  const monthlyTotalStandby = safeDpAttendance.reduce((acc, d) => acc + (d?.standbyDays || 0), 0);
  const monthlyAvgAttendance = monthlyTotalDps > 0
    ? Math.round(safeDpAttendance.reduce((acc, d) => acc + (d?.attendancePercentage || 0), 0) / monthlyTotalDps)
    : 0;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Delivery Person Audit</h1>
          <p className="page-subtitle">Delivery Partner (DP) profiles, attendance, daily dispatches, and monthly calendar audit synced live from DB2</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRefreshAll}
          disabled={attendanceLoad || dpLoading || dailyLoading}
        >
          <MdRefresh className={(attendanceLoad || dpLoading || dailyLoading) ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* DB2 Manager App Sync Banner */}
      <div className="card" style={{ marginBottom: 20, background: 'rgba(59,130,246,0.03)', borderColor: 'rgba(59,130,246,0.2)' }}>
        <div className="card-body" style={{ padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 20 }}>
              <MdDirectionsBike />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Manager App & Delivery Person (DP) Integration (DB2)</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Delivery Person (DP) profiles, vehicle registrations, petrol balances, and attendance are synced in real time from the Manager App DB (DB2 - <code>maram_milk_db</code>).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP HORIZONTAL TAB NAVIGATION BAR ───────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '10px 16px', display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <button
            className={`btn btn-sm ${activeTab === 'attendance-route' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('attendance-route')}
            id="dp-tab-attendance-route"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <MdCalendarToday style={{ fontSize: 16 }} /> Attendance & Route
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'daily-audit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('daily-audit')}
            id="dp-tab-daily-audit"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <MdAssignment style={{ fontSize: 17 }} /> Daily Audit
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'monthly-audit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('monthly-audit')}
            id="dp-tab-monthly-audit"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <MdDateRange style={{ fontSize: 17 }} /> Monthly Audit
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'dp-overview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dp-overview')}
            id="dp-tab-overview"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <MdPerson style={{ fontSize: 17 }} /> DP Overview ({safeDeliveryPersons.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1 — DP OVERVIEW                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'dp-overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {/* Filters & Search Controls */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', width: 280 }}>
                  <MdSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search DP Name, Code, Mobile..."
                    value={overviewSearch}
                    onChange={e => setOverviewSearch(e.target.value)}
                    style={{ paddingLeft: 36, width: '100%', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MdFilterList style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                    <select
                      className="form-input"
                      style={{ width: 110, fontSize: 12.5, padding: '4px 8px' }}
                      value={overviewStatusFilter}
                      onChange={e => setOverviewStatusFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Route:</span>
                    <select
                      className="form-input"
                      style={{ width: 160, fontSize: 12.5, padding: '4px 8px' }}
                      value={overviewRouteFilter}
                      onChange={e => setOverviewRouteFilter(e.target.value)}
                    >
                      <option value="all">All Routes</option>
                      {availableRoutes.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Persons Table */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">🛵 Delivery Persons ({filteredOverviewDps.length} DPs) — Live DB2 Data</h3>
              <span className="badge badge-purple">{filteredOverviewDps.length} DPs Listed</span>
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
                      <th>CURRENT STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dpLoading ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36 }}>Loading DP profiles from DB2...</td></tr>
                    ) : filteredOverviewDps.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>No matching DPs found in DB2.</td></tr>
                    ) : (
                      filteredOverviewDps.map(dp => (
                        <tr
                          key={dp.id || dp.dpCode}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedDpDetail(dp)}
                        >
                          <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{dp.dpCode || 'DP-001'}</span></td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dp.name}</td>
                          <td style={{ fontSize: 12.5 }}>{dp.mobileNumber || '—'}</td>
                          <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{dp.vehicleNumber || '—'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{dp.petrolBalance || 0}</td>
                          <td>
                            <span className={`badge ${dp.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                              {dp.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '3px 10px', fontSize: 12 }}>
                              <MdInfoOutline /> View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 — ATTENDANCE & ROUTE                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'attendance-route' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {/* Quick Summary Cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: 140, background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                  {safeDpAttendance.filter(d => (d?.presentDays || 0) > 0).length}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Present DPs</div>
              </div>
            </div>

            <div className="card" style={{ flex: 1, minWidth: 140, background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>
                  {safeDpAttendance.filter(d => (d?.absentDays || 0) > 0).length}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Absent DPs</div>
              </div>
            </div>

            <div className="card" style={{ flex: 1, minWidth: 140, background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>
                  {safeDpAttendance.filter(d => (d?.standbyDays || 0) > 0).length}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Standby / Extra Route DPs</div>
              </div>
            </div>

            <div className="card" style={{ flex: 1, minWidth: 140 }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>
                  {monthlyAvgAttendance}%
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Attendance %</div>
              </div>
            </div>
          </div>

          {/* Time & Filter Controls */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                      <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} aria-label="Start date" />
                      <span style={{ color: 'var(--text-muted)' }}>to</span>
                      <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} aria-label="End date" />
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search DP or vehicle..."
                    value={attSearch}
                    onChange={e => setAttSearch(e.target.value)}
                    style={{ width: 180, fontSize: 12.5 }}
                  />

                  <select
                    className="form-input"
                    style={{ width: 140, fontSize: 12.5 }}
                    value={attRouteFilter}
                    onChange={e => setAttRouteFilter(e.target.value)}
                  >
                    <option value="all">All Routes</option>
                    {availableRoutes.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <select
                    className="form-input"
                    style={{ width: 130, fontSize: 12.5 }}
                    value={attStatusFilter}
                    onChange={e => setAttStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="standby">Standby</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Person Attendance & Absence Audit Table */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdDirectionsBike style={{ color: 'var(--primary)' }} /> Delivery Person Attendance & Route Audit Table
              </div>
              <span className="badge badge-blue">{filteredAttendance.length} DPs Listed</span>
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
                    <th>ATTENDANCE %</th>
                    <th style={{ minWidth: 160 }}>PREVIEW</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoad ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}>Loading DB2 attendance records...</td></tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No attendance audit records found matching filters.</td></tr>
                  ) : filteredAttendance.map(dp => (
                    <tr
                      key={dp.dpId || dp.dpCode}
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
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{dp.vehicleNumber || '—'}</td>
                      <td><span className="badge badge-gray">{dp.assignedRoute || 'Unassigned'}</span></td>
                      <td style={{ fontWeight: 600 }}>{dp.totalDays || 0} Days</td>
                      <td>
                        <span className="badge badge-success" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdCheckCircle /> {dp.presentDays || 0} Present
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-danger" style={{ fontWeight: 800, fontSize: 12.5, padding: '4px 12px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdCancel /> {dp.absentDays || 0} Days Absent
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-warning" style={{ fontWeight: 800, fontSize: 12.5, padding: '4px 12px', background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdEventNote /> {dp.standbyDays || 0} Standby
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${(dp.attendancePercentage || 0) >= 90 ? 'badge-success' : (dp.attendancePercentage || 0) >= 75 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 800 }}>
                          {dp.attendancePercentage || 0}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 160 }}>
                          {(dp.calendarGrid || []).slice(0, 14).map((cd, idx) => {
                            const st = String(cd?.status || '').toUpperCase();
                            const isPres = st === 'PRESENT';
                            const isAbs = st === 'ABSENT';
                            const isStby = st === 'STANDBY' || st === 'ON_CALL';
                            return (
                              <div
                                key={idx}
                                title={`${cd?.date || ''}: ${cd?.status || ''}`}
                                style={{
                                  width: 9,
                                  height: 9,
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
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3 — DAILY AUDIT                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'daily-audit' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {/* Date Selector Header */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MdAssignment style={{ color: 'var(--primary)', fontSize: 22 }} />
                <div>
                  <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Operational Daily Audit</span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Audit DP activity, milk dispatches, check-in/out, and returns for a specific date</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Target Date:</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 160, fontSize: 13, padding: '4px 10px' }}
                  value={dailyDate}
                  onChange={e => setDailyDate(e.target.value)}
                />
                <button className="btn btn-secondary btn-sm" onClick={fetchDailyAudit} disabled={dailyLoading}>
                  <MdRefresh className={dailyLoading ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Operational Activity Table for Selected Date */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">📋 DP Operational Audit Log ({dailyDate})</h3>
              <span className="badge badge-blue">{safeDeliveryPersons.length} DPs Tracked</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>DP CODE & NAME</th>
                      <th>ASSIGNED ROUTE</th>
                      <th>ROUTE STATUS</th>
                      <th>MILK TAKEN</th>
                      <th>MILK DELIVERED</th>
                      <th>UNDELIVERED</th>
                      <th style={{ color: '#10b981' }}>PAID</th>
                      <th style={{ color: '#d97706' }}>EXTRA PAID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyLoading ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>Loading operational audit data for {dailyDate}...</td></tr>
                    ) : safeDeliveryPersons.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No DP operational records found for this date.</td></tr>
                    ) : (
                      safeDeliveryPersons.map(dp => {
                        const dpInv = dailyData?.items?.find(i => i.dpCode === dp.dpCode || i.dpId === dp.id);
                        const paidAmount = dpInv?.paid !== undefined ? dpInv.paid : (dp.paid !== undefined ? dp.paid : 0);
                        const extraPaidAmount = dpInv?.extraPaid !== undefined ? dpInv.extraPaid : (dp.extraPaid !== undefined ? dp.extraPaid : (dp.petrolBalance || dp.defaultPetrolAllowance || 0));

                        return (
                          <tr key={dp.id || dp.dpCode}>
                            <td style={{ fontWeight: 700 }}>
                              <div>{dp.name}</div>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--primary)' }}>{dp.dpCode || 'DP-001'}</span>
                            </td>
                            <td><span className="badge badge-gray">{dp.assignedRoute || dp.zone || 'Not available'}</span></td>
                            <td>
                              <span className={`badge ${dp.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                                {dp.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{dpInv?.quantityTaken !== undefined ? `${dpInv.quantityTaken} L` : 'Not available'}</td>
                            <td style={{ fontWeight: 600, color: 'var(--success)' }}>{dpInv?.quantityDelivered !== undefined ? `${dpInv.quantityDelivered} L` : 'Not available'}</td>
                            <td>{dpInv?.undeliveredQuantity !== undefined ? `${dpInv.undeliveredQuantity} L` : 'Not available'}</td>
                            <td style={{ fontWeight: 700, color: '#10b981' }}>₹{paidAmount}</td>
                            <td style={{ fontWeight: 700, color: '#d97706' }}>₹{extraPaidAmount}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4 — MONTHLY AUDIT                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'monthly-audit' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {/* Monthly Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary)' }}>{monthlyTotalDps}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total DPs Audit</div>
              </div>
            </div>

            <div className="card" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>{monthlyTotalPresent}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Present Days</div>
              </div>
            </div>

            <div className="card" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#ef4444' }}>{monthlyTotalAbsent}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Leave / Absent</div>
              </div>
            </div>

            <div className="card" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706' }}>{monthlyTotalStandby}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Standby Days</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '14px 16px' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#8b5cf6' }}>{monthlyAvgAttendance}%</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Attendance</div>
              </div>
            </div>
          </div>

          {/* Monthly Audit Calendar Grid */}
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

              {/* DP Selector Dropdown for Calendar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>DP Calendar:</span>
                <select
                  className="form-input"
                  style={{ width: 200, fontSize: 12.5, padding: '4px 8px' }}
                  value={selectedDpId}
                  onChange={e => setSelectedDpId(e.target.value)}
                >
                  <option value="">— Select Delivery Person —</option>
                  {safeAllDps.map(dp => (
                    <option key={dp.id} value={dp.id}>{dp.name} ({dp.dpCode})</option>
                  ))}
                </select>
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

                      const dayRecord = targetDpRecord?.calendarGrid?.find(c => c && c.date === fullDateStr) || {
                        date: fullDateStr,
                        status: isFutureDate ? 'Upcoming' : isBeforeDb2Date ? 'No DB2 Record' : 'ABSENT',
                        isFuture: isFutureDate,
                        isBeforeDb2: isBeforeDb2Date,
                        route: targetDpRecord?.assignedRoute || null,
                      };

                      const isInactiveCell = dayRecord.status === 'Upcoming' || dayRecord.status === 'No DB2 Record' || dayRecord.isFuture || dayRecord.isBeforeDb2;
                      const stUpper = String(dayRecord.status || '').toUpperCase();
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
        </motion.div>
      )}

      {/* ── DP OVERVIEW QUICK PREVIEW MODAL ── */}
      <AnimatePresence>
        {selectedDpDetail && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedDpDetail(null)}>
            <motion.div className="modal" style={{ maxWidth: 460 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdPerson style={{ color: 'var(--primary)' }} /> DP Profile Detail
                </h2>
                <button className="icon-btn" onClick={() => setSelectedDpDetail(null)}><MdClose /></button>
              </div>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>
                    {selectedDpDetail.name ? selectedDpDetail.name[0].toUpperCase() : 'D'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)' }}>{selectedDpDetail.name}</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--primary)' }}>{selectedDpDetail.dpCode || 'DP-001'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Mobile Number</span>
                    <div style={{ fontWeight: 600 }}>{selectedDpDetail.mobileNumber || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Vehicle Number</span>
                    <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedDpDetail.vehicleNumber || '—'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Assigned Route / Zone</span>
                    <div style={{ fontWeight: 600 }}>{selectedDpDetail.assignedRoute || selectedDpDetail.zone || 'Unassigned'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Petrol Balance</span>
                    <div style={{ fontWeight: 800, color: 'var(--success)' }}>₹{selectedDpDetail.petrolBalance || 0}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Account Status</span>
                    <div>
                      <span className={`badge ${selectedDpDetail.isActive !== false ? 'badge-success' : 'badge-danger'}`}>
                        {selectedDpDetail.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Data Source</span>
                    <div><span className="badge badge-gray" style={{ fontFamily: 'monospace' }}>DB2 (Live)</span></div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedDpDetail(null)}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ATTENDANCE DETAIL POPUP MODAL ── */}
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

export default function DeliveryPersonAuditPage() {
  return (
    <DPErrorBoundary>
      <DeliveryPersonAuditContent />
    </DPErrorBoundary>
  );
}
