import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdAdd, MdClose, MdSearch, MdRefresh, MdPause, MdPlayArrow, MdCancel } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

// ── Add Subscription Modal ────────────────────────────────────────
function AddSubscriptionModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ customer_id: '', product_id: '', quantity: '', frequency: 'Daily', start_date: new Date().toISOString().split('T')[0] });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/masters/products').then(r => setProducts(r.data.data)),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    if (search.length >= 2) {
      api.get('/customers', { params: { search, limit: 10 } })
        .then(r => setCustomers(r.data.data))
        .catch(() => {});
    }
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id || !form.product_id || !form.quantity)
      return toast.error('All required fields must be filled.');
    setLoading(true);
    try {
      await api.post('/subscriptions', form);
      toast.success('Subscription created!');
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <h2 className="modal-title">➕ Add Subscription</h2>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Search Customer *</label>
                <input id="sub-customer-search" className="form-input" placeholder="Type name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
                {customers.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, overflow: 'hidden', maxHeight: 160, overflowY: 'auto' }}>
                    {customers.map(c => (
                      <div key={c.id} onClick={() => { setForm({ ...form, customer_id: c.id }); setSearch(c.name + ' - ' + c.phone); setCustomers([]); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)',
                          background: form.customer_id === c.id ? 'rgba(59,130,246,0.08)' : '' }}>
                        <strong>{c.name}</strong> · {c.customer_code} · {c.phone}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select id="sub-product" className="form-input" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} required>
                  <option value="">— Select Product —</option>
                  {products.filter(p => p.status === 'Active').map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit}) — ₹{p.price_per_unit}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input id="sub-quantity" className="form-input" type="number" min="0.1" step="0.1" placeholder="e.g. 0.5" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Frequency</label>
                  <select id="sub-frequency" className="form-input" value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
                    <option>Daily</option><option>Weekly</option><option>Monthly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input id="sub-start-date" className="form-input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" id="sub-save-btn" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : 'Create Subscription'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main Subscriptions Page ───────────────────────────────────────
export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const limit = 20;

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscriptions', { params: { page, limit, status: statusFilter } });
      setSubs(res.data.data); setTotal(res.data.total);
    } catch { toast.error('Failed to load subscriptions.'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/subscriptions/${id}/status`, { status });
      toast.success(`Subscription ${status.toLowerCase()}.`);
      fetchSubs();
    } catch { toast.error('Failed to update.'); }
  };

  const counts = subs.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">{total} total subscriptions</p>
        </div>
        <button id="add-subscription-btn" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <MdAdd /> New Subscription
        </button>
      </div>

      {/* Summary Pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.08)', key: 'Active' },
          { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', key: 'Paused' },
          { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', key: 'Cancelled' },
        ].map(pill => (
          <div key={pill.key} onClick={() => setStatusFilter(statusFilter === pill.key ? '' : pill.key)}
            style={{ background: pill.bg, border: `1px solid ${pill.color}30`, borderRadius: 12, padding: '10px 20px',
              cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
              outline: statusFilter === pill.key ? `2px solid ${pill.color}` : 'none' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: pill.color }}>{counts[pill.key] || 0}</span>
            <span style={{ fontSize: 12, color: pill.color, fontWeight: 600 }}>{pill.label}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <select id="sub-status-filter" className="form-input" style={{ width: 180 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchSubs}><MdRefresh /> Refresh</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th><th>Product</th><th>Qty / Freq</th>
                <th>Price/Unit</th><th>Start Date</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No subscriptions found.</td></tr>
              ) : subs.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.customer_code} · {s.customer_phone}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.product_name}</td>
                  <td>{s.quantity} {s.unit} / <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{s.frequency}</span></td>
                  <td style={{ fontWeight: 700 }}>₹{s.price_per_unit}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(s.start_date).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={`badge ${s.status === 'Active' ? 'badge-success' : s.status === 'Paused' ? 'badge-warning' : 'badge-danger'}`}>{s.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {s.status !== 'Active' && (
                        <button id={`sub-activate-${s.id}`} className="btn btn-success btn-sm" title="Activate" onClick={() => changeStatus(s.id, 'Active')}><MdPlayArrow /></button>
                      )}
                      {s.status === 'Active' && (
                        <button id={`sub-pause-${s.id}`} className="btn btn-ghost btn-sm" title="Pause" onClick={() => changeStatus(s.id, 'Paused')}><MdPause /></button>
                      )}
                      {s.status !== 'Cancelled' && (
                        <button id={`sub-cancel-${s.id}`} className="btn btn-danger btn-sm" title="Cancel" onClick={() => changeStatus(s.id, 'Cancelled')}><MdCancel /></button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {Math.ceil(total / limit) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page} of {Math.ceil(total / limit)}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddSubscriptionModal onClose={() => setShowAdd(false)} onSaved={fetchSubs} />}
      </AnimatePresence>
    </div>
  );
}
