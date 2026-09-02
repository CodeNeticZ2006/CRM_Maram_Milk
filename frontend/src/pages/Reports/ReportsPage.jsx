import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MdRefresh, MdCalendarToday, MdDownload, MdFileDownload,
  MdInventory2, MdAnalytics, MdFilterList, MdSearch,
  MdCheckCircle, MdDateRange, MdGridOn, MdStorefront, MdBusiness,
  MdOutlineAssignmentReturn, MdFlashOn
} from 'react-icons/md';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useOperationalDay from '../../hooks/useOperationalDay';

export default function ReportsPage() {
  const { admin } = useAuthStore();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'inventory-reports'
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [customerAnalysis, setCustomerAnalysis] = useState(null);
  const [managerInvData, setManagerInvData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active operational day — backend is source of truth (7:00 PM IST boundary)
  const { operationalDate, loading: opDayLoading } = useOperationalDay();
  // date for daily summary: seeded from operationalDate, can be manually overridden to view history
  const [date, setDate] = useState('');

  // Seed date from operational day once loaded
  useEffect(() => {
    if (!opDayLoading && operationalDate) {
      setDate(prev => prev || operationalDate);
    }
  }, [operationalDate, opDayLoading]);

  // Inventory Reports Archive State
  const [archivedReports, setArchivedReports]   = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [reportFilterType, setReportFilterType] = useState('Inventory Report');
  const [reportFilterFormat, setReportFilterFormat] = useState('');
  const [reportSearch, setReportSearch]       = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate]     = useState('');

  // AdHoc Product Reports State
  const [adhocReportData, setAdhocReportData] = useState(null);
  const [adhocReportMode, setAdhocReportMode] = useState('daily');
  const [adhocReportStartDate, setAdhocReportStartDate] = useState('');
  const [adhocReportEndDate, setAdhocReportEndDate]     = useState('');
  const [adhocLoading, setAdhocLoading]             = useState(false);

  // Stock Correctness Reports State
  const [scReportData, setScReportData]         = useState(null);
  const [scReportMode, setScReportMode]         = useState('daily'); // 'daily' | 'monthly' | 'custom'
  const [scReportStartDate, setScReportStartDate] = useState('');
  const [scReportEndDate, setScReportEndDate]     = useState('');
  const [scReportLoading, setScReportLoading]   = useState(false);

  const fetchAdhocReports = async () => {
    setAdhocLoading(true);
    try {
      const params = {
        mode: adhocReportMode,
        date,
        startDate: adhocReportStartDate,
        endDate: adhocReportEndDate,
      };
      const res = await api.get('/reports/adhoc', { params });
      if (res.data?.success) {
        setAdhocReportData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load AdHoc report:', err);
      toast.error('Failed to load AdHoc report.');
    } finally {
      setAdhocLoading(false);
    }
  };

  const fetchStockCorrectnessReports = async () => {
    setScReportLoading(true);
    try {
      const params = {
        type: scReportMode,
        date: date || operationalDate,
        startDate: scReportStartDate,
        endDate: scReportEndDate,
      };
      const res = await api.get('/reports/stock-correctness', { params });
      if (res.data?.success) {
        setScReportData(res.data);
      }
    } catch {
      toast.error('Failed to load Stock Correctness Report.');
    } finally {
      setScReportLoading(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [d, m, ca, mi] = await Promise.all([
        api.get('/reports/daily-summary', { params: { date } }),
        api.get('/reports/monthly'),
        api.get('/reports/customer-analysis'),
        api.get('/inventory/manager-inventory', { params: { date } }).catch(() => ({ data: null })),
      ]);
      setDaily(d.data);
      setMonthly(m.data);
      setCustomerAnalysis(ca.data?.data || ca.data);
      setManagerInvData(mi.data);
    } catch { toast.error('Failed to load reports.'); }
    finally { setLoading(false); }
  };

  const handleGenerateReportDirect = async () => {
    try {
      toast.loading('Generating Inventory Report...', { id: 'gen-report' });
      const res = await api.get('/inventory/download-report', {
        params: { mode: 'today', date, generatedBy: admin?.name || 'Sarfaraz Ahmed' },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Maram_Milk_Inventory_Report_${date}.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Inventory Report generated and downloaded!', { id: 'gen-report' });
      if (activeTab === 'inventory-reports') fetchArchivedReports();
    } catch (err) {
      console.error('Report generation error:', err);
      toast.error('Failed to generate report.', { id: 'gen-report' });
    }
  };

  const fetchArchivedReports = async () => {
    setArchivedLoading(true);
    try {
      const params = {
        category: reportFilterType,
        format: reportFilterFormat,
        search: reportSearch,
        startDate: reportStartDate,
        endDate: reportEndDate,
      };
      const res = await api.get('/reports/archived', { params });
      setArchivedReports(res.data.data || []);
    } catch (err) {
      console.error('Error loading archived reports:', err);
      toast.error('Failed to fetch archived reports.');
    } finally {
      setArchivedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAll();
    } else if (activeTab === 'inventory-reports') {
      fetchArchivedReports();
    } else if (activeTab === 'adhoc-reports') {
      fetchAdhocReports();
    } else if (activeTab === 'stock-correctness-reports') {
      fetchStockCorrectnessReports();
    }
  }, [date, activeTab, adhocReportMode, adhocReportStartDate, adhocReportEndDate, scReportMode, scReportStartDate, scReportEndDate]);

  const handleDownloadArchived = async (report) => {
    try {
      const res = await api.get(`/reports/download/${report.id}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const fileName = report.report_name || `Maram_Milk_${(report.report_type || 'Report').replace(/\s+/g, '_')}.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${fileName}`);
    } catch (err) {
      console.error('Archived report download error:', err);
      toast.error('Failed to download report file.');
    }
  };

  if (loading && activeTab === 'analytics') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <span className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
    </div>
  );

  const d = daily?.data;
  const m = monthly?.data;
  const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Daily, monthly, customer performance, AdHoc product sales, stock correctness & archived inventory reports</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'analytics' && (
            <div className="input-with-icon">
              <MdCalendarToday className="input-icon" />
              <input id="reports-date" type="date" className="form-input" style={{ paddingLeft: 36 }} value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={activeTab === 'analytics' ? fetchAll : activeTab === 'adhoc-reports' ? fetchAdhocReports : activeTab === 'stock-correctness-reports' ? fetchStockCorrectnessReports : fetchArchivedReports}>
            <MdRefresh className={loading || archivedLoading || adhocLoading || scReportLoading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '10px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('analytics')}
          >
            <MdAnalytics /> Analytics & Metrics
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'stock-correctness-reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('stock-correctness-reports')}
            id="reports-tab-stock-correctness"
            style={{ background: activeTab === 'stock-correctness-reports' ? 'linear-gradient(135deg, #10b981, #059669)' : '', borderColor: activeTab === 'stock-correctness-reports' ? '#10b981' : '' }}
          >
            <MdCheckCircle /> Stock Correctness Reports
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'adhoc-reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('adhoc-reports')}
            id="reports-tab-adhoc"
            style={{ background: activeTab === 'adhoc-reports' ? 'linear-gradient(135deg, #d97706, #b45309)' : '', borderColor: activeTab === 'adhoc-reports' ? '#d97706' : '' }}
          >
            <MdInventory2 /> AdHoc Product Reports
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'inventory-reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('inventory-reports')}
            id="reports-tab-inventory"
          >
            <MdInventory2 /> Inventory Reports Archive
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <>
          {/* Daily Summary */}
          <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>DAILY SUMMARY — {date}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: "Today's Revenue", value: `₹${parseFloat(d?.payments?.total || 0).toLocaleString('en-IN')}`, color: '#10b981' },
              { label: 'Deliveries', value: `${d?.deliveries?.delivered || 0} / ${d?.deliveries?.total || 0}`, color: '#3b82f6' },
              { label: 'Wallet Recharge', value: `₹${parseFloat(d?.wallet_recharge || 0).toLocaleString('en-IN')}`, color: '#8b5cf6' },
              { label: 'New Customers', value: d?.new_customers || 0, color: '#f59e0b' },
            ].map(card => (
              <motion.div key={card.label} className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase' }}>{card.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Shop Sale — Daily Stock Sold Summary Cards */}
          {(() => {
            const ss = managerInvData?.shopSale?.summary || { total1LBottle: 0, totalHalfLBottle: 0, totalHalfLPacket: 0 };
            const ssTot = (ss.total1LBottle || 0) + (ss.totalHalfLBottle || 0) + (ss.totalHalfLPacket || 0);
            return (
              <div style={{ marginBottom: 24 }}>
                <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdStorefront style={{ color: '#7c3aed', fontSize: 18 }} /> Shop Sale — Daily Stock Sold ({date})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  {[
                    { label: "1L BOTTLE SOLD", value: (ss.total1LBottle || 0).toLocaleString(), sub: "Total qty1LBottle", color: "#7c3aed", icon: "1L" },
                    { label: "HALF-L BOTTLE SOLD", value: (ss.totalHalfLBottle || 0).toLocaleString(), sub: "Total qtyHalfLBottle", color: "#0ea5e9", icon: <MdInventory2 /> },
                    { label: "HALF-L PACKET SOLD", value: (ss.totalHalfLPacket || 0).toLocaleString(), sub: "Total qtyHalfLPacket", color: "#10b981", icon: <MdOutlineAssignmentReturn /> },
                    { label: "TOTAL UNITS SOLD", value: ssTot.toLocaleString(), sub: "All product types combined", color: "#f59e0b", icon: <MdFlashOn /> },
                  ].map(card => (
                    <div key={card.label} className="card">
                      <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: card.color }}>{card.value}</div>
                          <div style={{ padding: '4px 8px', borderRadius: 6, background: `${card.color}15`, color: card.color, fontSize: 15, fontWeight: 800 }}>{card.icon}</div>
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 6, color: 'var(--text-primary)' }}>{card.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{card.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Manager Inventory Log — Per Product Summary Cards */}
          {(() => {
            const mil = managerInvData?.managerInventory?.summary || { total1LBottle: 0, totalHalfLBottle: 0, totalHalfLPacket: 0, totalUnits: 0 };
            return (
              <div style={{ marginBottom: 24 }}>
                <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdBusiness style={{ color: '#0ea5e9', fontSize: 18 }} /> Manager Inventory Log — Per Product ({date})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  {[
                    { label: "1L (B) BOTTLE LOGGED", value: (mil.total1LBottle || 0).toLocaleString(), sub: "Total 1L (B) Qty", color: "#7c3aed", icon: "1L" },
                    { label: "500ML (B) BOTTLE LOGGED", value: (mil.totalHalfLBottle || 0).toLocaleString(), sub: "Total 500ml (B) Qty", color: "#0ea5e9", icon: <MdInventory2 /> },
                    { label: "500ML (P) PACKET LOGGED", value: (mil.totalHalfLPacket || 0).toLocaleString(), sub: "Total 500ml (P) Qty", color: "#10b981", icon: <MdOutlineAssignmentReturn /> },
                    { label: "TOTAL UNITS LOGGED", value: (mil.totalUnits || 0).toLocaleString(), sub: "All product types combined", color: "#f59e0b", icon: <MdFlashOn /> },
                  ].map(card => (
                    <div key={card.label} className="card">
                      <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: card.color }}>{card.value}</div>
                          <div style={{ padding: '4px 8px', borderRadius: 6, background: `${card.color}15`, color: card.color, fontSize: 15, fontWeight: 800 }}>{card.icon}</div>
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 6, color: 'var(--text-primary)' }}>{card.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{card.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Monthly Summary */}
          <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>MONTHLY SUMMARY</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Monthly Revenue', value: `₹${parseFloat(m?.revenue?.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#10b981' },
              { label: 'New Customers', value: m?.customers?.new_customers || 0, color: '#3b82f6' },
              { label: 'Total Deliveries', value: m?.deliveries?.total || 0, color: '#8b5cf6' },
              { label: 'Wallet Recharged', value: `₹${parseFloat(m?.wallet_recharged || 0).toLocaleString('en-IN')}`, color: '#f59e0b' },
            ].map(card => (
              <div key={card.label} className="card">
                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase' }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Customer Status + Top Customers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
            {/* Pie Chart */}
            <div className="card">
              <div className="card-header"><h3 className="card-title">👥 Customer Status</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={customerAnalysis?.status_breakdown || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({status, count}) => `${status}: ${count}`}>
                      {(customerAnalysis?.status_breakdown || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Top Customers */}
            <div className="card">
              <div className="card-header"><h3 className="card-title">🏆 Top Customers by Total Recharge</h3></div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrapper">
                  <table className="table">
                    <thead><tr><th>#</th><th>Customer</th><th>Total Recharged</th><th>Balance</th></tr></thead>
                    <tbody>
                      {(customerAnalysis?.top_customers || []).map((c, i) => (
                        <tr key={i}>
                          <td><span style={{ fontWeight: 800, color: 'var(--primary)' }}>#{i + 1}</span></td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.customer_code}</div>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{parseFloat(c.total_recharged || 0).toLocaleString('en-IN')}</td>
                          <td style={{ fontWeight: 700, color: parseFloat(c.balance) < 0 ? 'var(--danger)' : 'var(--success)' }}>₹{parseFloat(c.balance || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Route Distribution */}
          {(customerAnalysis?.route_distribution || []).length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">🛣️ Customer Distribution by Route</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={customerAnalysis?.route_distribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="route_name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="customer_count" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Customers" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'adhoc-reports' ? (
        /* AdHoc Product Reports Tab */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {/* Controls Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Report Mode:</label>
                  <select
                    className="form-input"
                    style={{ width: 140 }}
                    value={adhocReportMode}
                    onChange={e => setAdhocReportMode(e.target.value)}
                  >
                    <option value="daily">Daily Report</option>
                    <option value="monthly">Monthly Report</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {adhocReportMode === 'daily' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Target Date:</label>
                    <input type="date" className="form-input" style={{ width: 150 }} value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                )}

                {adhocReportMode === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" className="form-input" value={adhocReportStartDate} onChange={e => setAdhocReportStartDate(e.target.value)} />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input type="date" className="form-input" value={adhocReportEndDate} onChange={e => setAdhocReportEndDate(e.target.value)} />
                  </div>
                )}
              </div>

              <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none' }} onClick={handleGenerateReportDirect}>
                <MdFileDownload /> Download AdHoc Excel Report
              </button>
            </div>
          </div>

          {/* AdHoc Summary KPI Grid */}
          {adhocReportData?.totals && (
            <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
              <div className="stat-card" style={{ '--card-accent': 'var(--primary)' }}>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{adhocReportData.totals.totalTaken || 0}</div>
                <div className="stat-label">Total DP Stock Issued</div>
              </div>
              <div className="stat-card" style={{ '--card-accent': 'var(--success)' }}>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{adhocReportData.totals.totalSold || 0}</div>
                <div className="stat-label">Total AdHoc Units Sold</div>
              </div>
              <div className="stat-card" style={{ '--card-accent': 'var(--warning)' }}>
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{adhocReportData.totals.totalReturned || 0}</div>
                <div className="stat-label">Total Units Returned</div>
              </div>
              <div className="stat-card" style={{ '--card-accent': '#d97706' }}>
                <div className="stat-value" style={{ color: '#d97706' }}>₹{(adhocReportData.totals.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div className="stat-label">Total AdHoc Revenue</div>
              </div>
            </div>
          )}

          {/* Central AdHoc Inventory Table */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(245,158,11,0.02))' }}>
              <span className="card-title" style={{ color: '#d97706' }}>Central AdHoc Inventory Summary</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Opening</th>
                    <th>Added</th>
                    <th>DP Issued</th>
                    <th>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(adhocReportData?.centralSummary || []).length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No central AdHoc inventory data.</td></tr>
                  ) : (
                    adhocReportData.centralSummary.map(row => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td><code>{row.sku}</code></td>
                        <td>{row.openingStock} {row.unit}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>+{row.addedStock}</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{row.dpIssuedStock}</td>
                        <td style={{ fontWeight: 800 }}>{row.remainingStock} {row.unit}</td>
                        <td><span className="badge badge-warning">{row.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DP AdHoc Sales Audit Breakdown Table */}
          <div className="card">
            <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(245,158,11,0.02))' }}>
              <span className="card-title" style={{ color: '#d97706' }}>Delivery Person (DP) AdHoc Sales Breakdown</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>DP Name</th>
                    <th>Route</th>
                    <th>Product</th>
                    <th>Taken</th>
                    <th>Sold</th>
                    <th>Returned</th>
                    <th>Remaining</th>
                    <th>Sales Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(adhocReportData?.dpSalesAudit || []).length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No DP AdHoc sales records for this period.</td></tr>
                  ) : (
                    adhocReportData.dpSalesAudit.map(row => (
                      <tr key={row.id}>
                        <td>{row.date}</td>
                        <td style={{ fontWeight: 700 }}>{row.dp_name}</td>
                        <td><span className="badge badge-gray">{row.route_name}</span></td>
                        <td style={{ fontWeight: 600 }}>{row.product_name}</td>
                        <td>{row.quantity_taken}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 800 }}>{row.quantity_sold}</td>
                        <td style={{ color: 'var(--warning)' }}>{row.quantity_returned}</td>
                        <td>{row.quantity_remaining}</td>
                        <td style={{ fontWeight: 800, color: '#d97706' }}>₹{parseFloat(row.total_sales_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      ) : (
        /* Inventory Reports Archive Tab */
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdInventory2 style={{ color: 'var(--primary)' }} /> Inventory Reports Archive
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                All generated 3-sheet Inventory Excel reports saved for Super Admin audit & download
              </p>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ width: 160 }}
                value={reportFilterType}
                onChange={e => setReportFilterType(e.target.value)}
              >
                <option value="Inventory Report">Category: Inventory Report</option>
                <option value="">All Categories</option>
              </select>

              <select
                className="form-select"
                style={{ width: 130 }}
                value={reportFilterFormat}
                onChange={e => setReportFilterFormat(e.target.value)}
              >
                <option value="">Format: All</option>
                <option value="Excel">Excel (.xlsx)</option>
              </select>

              <div className="input-with-icon" style={{ width: 160 }}>
                <MdSearch className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search name..."
                  style={{ paddingLeft: 34 }}
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                />
              </div>

              <button className="btn btn-primary btn-sm" onClick={fetchArchivedReports}>
                <MdFilterList /> Filter
              </button>

              <button
                className="btn btn-sm btn-success"
                onClick={handleGenerateReportDirect}
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <MdFileDownload style={{ fontSize: 16 }} /> Generate & Download Report
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {archivedLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <span className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
              </div>
            ) : archivedReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                <MdGridOn style={{ fontSize: 44, color: 'var(--text-muted)', opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>No Archived Inventory Reports Found</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Generate an Inventory report from the Inventory Management page to view and re-download it here.
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Report Name</th>
                      <th>Category</th>
                      <th>Period</th>
                      <th>Format</th>
                      <th>Status</th>
                      <th>Generated By</th>
                      <th>Generated Date</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedReports.map((report) => (
                      <tr key={report.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                            {report.report_name || `Maram_Milk_Inventory_Report_${report.date_from}.xlsx`}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {report.id}</div>
                        </td>
                        <td>
                          <span className="badge badge-primary" style={{ fontSize: 11 }}>
                            {report.report_type}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                          {report.date_from === report.date_to
                            ? report.date_from
                            : `${report.date_from} → ${report.date_to}`}
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: 11, background: '#dcfce7', color: '#15803d' }}>
                            {report.format || 'Excel'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MdCheckCircle /> {report.status || 'Ready'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {report.generated_by || admin?.name || 'Sarfaraz Ahmed'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(report.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleDownloadArchived(report)}
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 600 }}
                          >
                            <MdDownload /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: STOCK CORRECTNESS REPORTS ── */}
      {activeTab === 'stock-correctness-reports' && (
        <div className="card">
          <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.02))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <span className="card-title" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdCheckCircle style={{ fontSize: 22 }} /> STOCK CORRECTNESS REPORT SYSTEM
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Daily, monthly & custom date range stock reconciliation reports for Milk products
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.05)', padding: 3, borderRadius: 8 }}>
                <button
                  className={`btn btn-sm ${scReportMode === 'daily' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scReportMode === 'daily' ? '#10b981' : 'transparent', border: 'none', color: scReportMode === 'daily' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScReportMode('daily')}
                >
                  Daily Report
                </button>
                <button
                  className={`btn btn-sm ${scReportMode === 'monthly' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scReportMode === 'monthly' ? '#10b981' : 'transparent', border: 'none', color: scReportMode === 'monthly' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScReportMode('monthly')}
                >
                  Monthly Report
                </button>
                <button
                  className={`btn btn-sm ${scReportMode === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scReportMode === 'custom' ? '#10b981' : 'transparent', border: 'none', color: scReportMode === 'custom' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScReportMode('custom')}
                >
                  Custom Date Range
                </button>
              </div>

              {scReportMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={scReportStartDate} onChange={e => setScReportStartDate(e.target.value)} />
                  <span style={{ fontSize: 12 }}>to</span>
                  <input type="date" className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={scReportEndDate} onChange={e => setScReportEndDate(e.target.value)} />
                </div>
              )}

              <button className="btn btn-secondary btn-sm" onClick={fetchStockCorrectnessReports} disabled={scReportLoading}>
                <MdRefresh className={scReportLoading ? 'spin' : ''} /> {scReportLoading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>

          <div className="table-wrapper" style={{ padding: '16px 20px' }}>
            {scReportLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>Generating Stock Correctness Report...</div>
            ) : !scReportData || scReportData.totalRecords === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No stock correctness report records found for the selected period.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Operational Day</th>
                    <th>Product Name</th>
                    <th>Expected Stock</th>
                    <th>Manager Logged Stock</th>
                    <th>Difference</th>
                    <th>Status</th>
                    <th>Review Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {scReportData.data.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td style={{ fontWeight: 800 }}>{row.operationalDay}</td>
                      <td style={{ fontWeight: 700 }}>{row.productName}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.expectedStock}</td>
                      <td style={{ fontWeight: 700 }}>{row.managerLoggedStock !== null ? row.managerLoggedStock : <span style={{ color: '#d97706', fontStyle: 'italic' }}>Not Logged</span>}</td>
                      <td style={{ fontWeight: 800, color: row.difference < 0 ? '#ef4444' : row.difference > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {row.difference > 0 ? `+${row.difference}` : row.difference}
                      </td>
                      <td>
                        <span className={`badge ${row.status === 'Correct' ? 'badge-success' : row.status === 'Mismatch' ? 'badge-danger' : 'badge-warning'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${row.reviewStatus === 'Resolved' ? 'badge-success' : row.reviewStatus === 'Reviewed' ? 'badge-warning' : 'badge-danger'}`}>
                          {row.reviewStatus || 'Pending Review'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {row.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
