import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MdTrendingUp, MdTrendingDown } from 'react-icons/md';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';

const StatCard = ({ label, value, color, change, changeDir }) => (
  <motion.div
    className="stat-card"
    style={{ '--card-accent': color }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2 }}
  >
    {change !== undefined && (
      <div className="stat-card-header" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
        <div className={`stat-change ${changeDir}`}>
          {changeDir === 'up' ? <MdTrendingUp /> : <MdTrendingDown />}
          {change}
        </div>
      </div>
    )}
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </motion.div>
);

const fmt = (n) => typeof n === 'number' ? n.toLocaleString('en-IN') : '—';
const fmtCur = (n) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState({ customer_growth: [], revenue_trends: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, trendsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/monthly-trends'),
        ]);
        setStats(statsRes.data.data);
        setTrends(trendsRes.data.data);
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading dashboard...</p>
    </div>
  );

  const s = stats?.statistics || {};
  const kpi = stats?.kpi || {};
  const wm = stats?.wallet_monthly || {};
  const wt = stats?.wallet_today || {};

  return (
    <div>
      {/* ─── Statistics Section ─────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to Maram Milk Super Admin Control Center</p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
          🔄 Auto-refresh: 60s
        </div>
      </div>

      {/* Statistics Cards */}
      <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATISTICS</p>
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <StatCard label="No. of Customer Registered" value={fmt(s.total_customers)} color="#3b82f6" />
        <StatCard label="Total In-Hand Wallet Amount" value={fmtCur(s.total_in_hand_wallet)} color="#10b981" />
        <StatCard label="Total Negative Wallet Amount" value={fmtCur(s.total_negative_wallet)} color="#ef4444" />
        <StatCard label="No. of Active Customers" value={fmt(s.active_customers)} color="#06b6d4" />
        <StatCard label="No. of Active Subscription" value={fmt(s.active_subscriptions)} color="#8b5cf6" />
        <StatCard label="Total Milk Delivered (This Month)" value={`${fmt(s.total_milk_delivered_month || kpi.milk_inventory?.today_dispatch || 0)} L`} color="#3b82f6" />
        <StatCard label="Total No. of Enquiry This Month" value={fmt(s.total_enquiries_this_month)} color="#f59e0b" />
        <StatCard label="No. of Customer Registered (Month)" value={fmt(s.registered_this_month)} color="#10b981" />
        <StatCard label="Customers Registered Today" value={fmt(s.registered_today)} color="#06b6d4" />
      </div>

      {/* Hold & Change Requests */}
      <div className="request-widgets">
        {[
          { title: `HOLD REQUEST`, subtitle: `This Month`, count: s.hold_requests_pending, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
          { title: `CHANGES REQUEST`, subtitle: `This Month`, count: s.change_requests_pending, color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
        ].map((w) => (
          <motion.div
            key={w.title}
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ background: w.bg, borderColor: w.color + '30' }}
          >
            <div className="card-body" style={{ textAlign: 'center', padding: '24px' }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: w.color, marginBottom: 8 }}>
                {w.title}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>{w.subtitle}</p>
              <div style={{ fontSize: 48, fontWeight: 800, color: w.color, lineHeight: 1 }}>{fmt(w.count)}</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Count</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* KPI Row */}
      <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TODAY'S KPIs</p>
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <StatCard label="Today's Deliveries" value={fmt(kpi.deliveries_today)} color="#3b82f6" />
        <StatCard label="Today's Revenue" value={fmtCur(kpi.revenue_today)} color="#10b981" />
        <StatCard label="Pending Invoices" value={fmt(kpi.pending_invoices)} color="#f59e0b" />
        <StatCard label="Closing Milk Stock" value={`${kpi.milk_inventory?.closing_stock || 0} L`} color="#8b5cf6" />
      </div>

      {/* Wallet Statistics */}
      <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>WALLET STATISTICS (THIS MONTH)</p>
      <div className="wallet-stats-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
              {[
                { label: 'Total Amount', value: fmtCur(wm.total_amount), color: '#3b82f6' },
                { label: 'Total Refunded Amount', value: fmtCur(wm.total_refunded), color: '#ef4444' },
                { label: 'Total Wallet Recharge (Cash)', value: fmtCur(wm.cash_recharge), color: '#10b981' },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card" style={{ background: 'rgba(59,130,246,0.03)', borderColor: 'rgba(59,130,246,0.2)' }}>
          <div className="card-body">
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase' }}>Wallet Recharge (Online)</p>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{fmtCur(wm.online_recharge)}</div>
          </div>
        </div>
      </div>

      {/* Wallet — Today */}
      <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>WALLET STATISTICS — TODAY</p>
      <div className="dashboard-grid" style={{ marginBottom: 28, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { label: 'Wallet Recharge', value: fmtCur(wt.total_recharge), color: '#3b82f6' },
          { label: 'Total Recharge (Cash)', value: fmtCur(wt.cash_recharge), color: '#10b981' },
          { label: 'Total Recharge (Online)', value: fmtCur(wt.online_recharge), color: '#8b5cf6' },
        ].map((item) => (
          <div className="card" key={item.label}>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Customer Growth */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Customer Growth (6 Months)</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trends.customer_growth}>
                <defs>
                  <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="new_customers" stroke="#3b82f6" fill="url(#custGrad)" strokeWidth={2} name="New Customers" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Monthly Revenue</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trends.revenue_trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}




