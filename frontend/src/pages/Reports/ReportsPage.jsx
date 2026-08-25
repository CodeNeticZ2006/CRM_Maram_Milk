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
import useOperationalDay from '../../hooks/useOperationalDay';

export default function ReportsPage() {
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
        params: { mode: 'today', date, generatedBy: 'Super Admin' },
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
    }
  }, [date, activeTab]);

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
          <p className="page-subtitle">Daily, monthly, customer performance & archived inventory reports</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'analytics' && (
            <div className="input-with-icon">
              <MdCalendarToday className="input-icon" />
              <input id="reports-date" type="date" className="form-input" style={{ paddingLeft: 36 }} value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={activeTab === 'analytics' ? fetchAll : fetchArchivedReports}>
            <MdRefresh className={loading || archivedLoading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '10px 16px', display: 'flex', gap: 10 }}>
          <button
            className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('analytics')}
          >
            <MdAnalytics /> Analytics & Metrics
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
                          {report.generated_by || 'Super Admin'}
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
    </div>
  );
}
