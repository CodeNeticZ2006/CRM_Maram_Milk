import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function RevenuePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports/revenue-trend', { params: { months } });
        setData(res.data.data);
      } catch { toast.error('Failed to load revenue data.'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [months]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <span className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
    </div>
  );

  const totalRevenue = (data?.revenue_by_month || []).reduce((s, r) => s + parseFloat(r.revenue || 0), 0);
  const totalRecharged = (data?.recharge_by_month || []).reduce((s, r) => s + parseFloat(r.recharged || 0), 0);
  const totalNewCust = (data?.customers_by_month || []).reduce((s, r) => s + parseInt(r.count || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue Report</h1>
          <p className="page-subtitle">Financial performance over time</p>
        </div>
        <select id="revenue-months-filter" className="form-input" style={{ width: 140 }} value={months} onChange={e => setMonths(e.target.value)}>
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      {/* Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: `Revenue (${months}mo)`, value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
          { label: `Wallet Recharged (${months}mo)`, value: `₹${totalRecharged.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
          { label: `New Customers (${months}mo)`, value: totalNewCust, color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
        ].map(card => (
          <div key={card.label} className="card" style={{ background: card.bg, borderColor: card.color + '30' }}>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue vs Recharge */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h3 className="card-title">📈 Revenue vs Wallet Recharge</h3></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data?.revenue_by_month || []}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Customer Growth */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">👥 New Customer Registrations</h3></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.customers_by_month || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="New Customers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
