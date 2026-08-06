import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdAdd, MdClose, MdSearch, MdRefresh, MdAccountBalanceWallet } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

// ── Recharge Modal ────────────────────────────────────────────────
function RechargeModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', method: 'Cash', reference: '', description: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount) return toast.error('Amount is required.');
    setLoading(true);
    try {
      await api.post('/wallet/recharge', { ...form, customer_id: customer.customer_id });
      toast.success(`₹${form.amount} recharged via ${form.method}!`);
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">💳 Recharge Wallet</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{customer.customer_name} · {customer.customer_code}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: 14, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Current Balance</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: parseFloat(customer.balance) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                ₹{parseFloat(customer.balance || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input id="recharge-amount" type="number" min="1" step="1" className="form-input" placeholder="500" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select id="recharge-method" className="form-input" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                  {['Cash', 'GPay', 'PhonePe', 'Paytm', 'Razorpay', 'Adjustment'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference No.</label>
                <input id="recharge-ref" className="form-input" placeholder="UTR / Transaction ID" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input id="recharge-note" className="form-input" placeholder="Optional note" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="recharge-submit-btn" type="submit" className="btn btn-success" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : '✅ Recharge Wallet'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main Wallet Page ──────────────────────────────────────────────
export default function WalletPage() {
  const [wallets, setWallets] = useState([]);
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [rechargeTarget, setRechargeTarget] = useState(null);
  const limit = 20;

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/wallet', { params: { page, limit, search, filter } });
      setWallets(res.data.data);
      setTotal(res.data.total);
      setSummary(res.data.summary || {});
    } catch { toast.error('Failed to load wallets.'); }
    finally { setLoading(false); }
  }, [page, search, filter]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallet Management</h1>
          <p className="page-subtitle">Manage customer wallet balances and recharges</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Wallet Balance', value: `₹${parseFloat(summary.total_balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
          { label: 'Positive Balances', value: summary.positive_count || 0, color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
          { label: 'Zero Balances', value: summary.zero_count || 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
          { label: 'Negative Balances', value: summary.negative_count || 0, color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
        ].map(card => (
          <div key={card.label} className="card" style={{ background: card.bg, borderColor: card.color + '30' }}>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="input-with-icon" style={{ flex: 1, minWidth: 200 }}>
            <MdSearch className="input-icon" />
            <input id="wallet-search" className="form-input" style={{ paddingLeft: 38, width: '100%' }}
              placeholder="Search customer..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select id="wallet-filter" className="form-input" style={{ width: 180 }} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value="">All Balances</option>
            <option value="positive">Positive (₹+)</option>
            <option value="zero">Zero Balance</option>
            <option value="negative">Negative (₹-)</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchWallets}><MdRefresh /></button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th><th>Phone</th><th>Balance</th><th>Total Recharged</th><th>Total Debited</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              ) : wallets.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No wallets found.</td></tr>
              ) : wallets.map((w, i) => (
                <motion.tr key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{w.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.customer_code}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{w.phone}</td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: 15, color: parseFloat(w.balance) < 0 ? 'var(--danger)' : parseFloat(w.balance) === 0 ? 'var(--text-muted)' : 'var(--success)' }}>
                      ₹{parseFloat(w.balance || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td style={{ color: 'var(--primary)', fontWeight: 600 }}>₹{parseFloat(w.total_recharged || 0).toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--warning)', fontWeight: 600 }}>₹{parseFloat(w.total_debited || 0).toLocaleString('en-IN')}</td>
                  <td>
                    <button id={`wallet-recharge-${w.customer_id}`} className="btn btn-primary btn-sm" onClick={() => setRechargeTarget(w)}>
                      <MdAccountBalanceWallet /> Recharge
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {rechargeTarget && <RechargeModal customer={rechargeTarget} onClose={() => setRechargeTarget(null)} onSaved={fetchWallets} />}
      </AnimatePresence>
    </div>
  );
}
