import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MdRefresh, MdCalendarToday } from 'react-icons/md';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function ReportsPage() {
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [customerAnalysis, setCustomerAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [d, m, ca] = await Promise.all([
        api.get('/reports/daily-summary', { params: { date } }),
        api.get('/reports/monthly'),
        api.get('/reports/customer-analysis'),
      ]);
      setDaily(d.data); setMonthly(m.data); setCustomerAnalysis(ca.data.data);
    } catch { toast.error('Failed to load reports.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [date]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <span className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
    </div>
  );

  const d = daily?.data;
  const m = monthly?.data;
  const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Daily, monthly, and customer performance insights</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="input-with-icon">
            <MdCalendarToday className="input-icon" />
            <input id="reports-date" type="date" className="form-input" style={{ paddingLeft: 36 }} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchAll}><MdRefresh /></button>
        </div>
      </div>

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
    </div>
  );
}
