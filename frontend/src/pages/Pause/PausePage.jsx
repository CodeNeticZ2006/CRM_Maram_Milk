import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PauseCircle,
  Palmtree,
  FileEdit,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  X,
  Search,
  User,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TABS = [
  { key: 'hold', label: 'Hold Requests', icon: <PauseCircle size={16} /> },
  { key: 'vacation', label: 'Vacation Requests', icon: <Palmtree size={16} /> },
  { key: 'change', label: 'Change Requests', icon: <FileEdit size={16} /> },
];

function StatusBadge({ status }) {
  const map = {
    Pending: 'badge-warning',
    Approved: 'badge-success',
    Rejected: 'badge-danger',
    Cancelled: 'badge-gray',
    Completed: 'badge-gray'
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

// ── New Hold Request Modal ───────────────────────────────────────
function NewHoldModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    customer_id: '',
    hold_from: new Date().toISOString().slice(0, 10),
    hold_to: '',
    reason: ''
  });
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search || search.length < 2) {
      setCustomers([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/customers', { params: { search, limit: 10 } });
        setCustomers(res.data.data || []);
      } catch {
        // silent
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.error('Please select a customer.');
    if (!form.hold_from || !form.hold_to) return toast.error('Hold start and end dates are required.');
    if (form.hold_to < form.hold_from) return toast.error('Hold end date cannot be earlier than start date.');

    setLoading(true);
    try {
      await api.post('/pause/hold', form);
      toast.success('Hold request scheduled and activated!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create hold request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 540, width: '92%', background: '#ffffff', borderRadius: 16 }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header" style={{ padding: '20px 24px 0' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
            <PauseCircle size={20} style={{ color: 'var(--primary)' }} /> Schedule Hold Request
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {/* Customer Search */}
          <div className="form-group" style={{ position: 'relative', marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Select Customer *</label>
            {selectedCustomer ? (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={15} /> {selectedCustomer.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
                    {selectedCustomer.customer_code} · {selectedCustomer.phone}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, height: 28, padding: '0 8px', background: '#ffffff' }}
                  onClick={() => { setSelectedCustomer(null); setForm(f => ({ ...f, customer_id: '' })); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 34, height: 40 }}
                    placeholder="Search customer name, phone, or code..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {customers.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                    maxHeight: 180,
                    overflowY: 'auto',
                    marginTop: 4
                  }}>
                    {customers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setForm(f => ({ ...f, customer_id: c.id }));
                          setCustomers([]);
                        }}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                      >
                        <strong>{c.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.customer_code} · {c.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Hold From *</label>
              <input
                type="date"
                className="form-input"
                value={form.hold_from}
                onChange={e => setForm(f => ({ ...f, hold_from: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Hold To *</label>
              <input
                type="date"
                className="form-input"
                value={form.hold_to}
                onChange={e => setForm(f => ({ ...f, hold_to: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Reason / Note</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Out of town, temporary pause..."
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {loading ? <span className="loading-spinner" /> : <><CheckCircle2 size={16} /> Save Hold</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Request Table Component ──────────────────────────────────────
function RequestTable({ tab, onRefresh }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 15;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/pause', { params: { tab, page, limit } });
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch {
      toast.error('Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const act = async (id, action) => {
    try {
      await api.patch(`/pause/${tab}/${id}`, { action });
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'}.`);
      fetch();
      onRefresh();
    } catch {
      toast.error('Action failed.');
    }
  };

  const cols = {
    hold: ['Customer', 'Hold From', 'Hold To', 'Reason', 'Status', 'Actions'],
    vacation: ['Customer', 'Start Date', 'End Date', 'Reason', 'Status', 'Actions'],
    change: ['Customer', 'Type', 'Old Value', 'New Value', 'Status', 'Actions'],
  }[tab];

  return (
    <div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No requests found.</td></tr>
            ) : items.map((item, i) => (
              <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.customer_code} · {item.phone}</div>
                </td>
                {tab === 'hold' && (
                  <>
                    <td>{formatDate(item.hold_from)}</td>
                    <td>{formatDate(item.hold_to)}</td>
                  </>
                )}
                {tab === 'vacation' && (
                  <>
                    <td>{formatDate(item.start_date)}</td>
                    <td>{formatDate(item.end_date)}</td>
                  </>
                )}
                {tab === 'change' && (
                  <>
                    <td><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>{item.request_type}</span></td>
                    <td style={{ fontSize: 12 }}>{item.old_value || '—'}</td>
                  </>
                )}
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tab === 'change' ? (item.new_value || '—') : (item.reason || '—')}
                </td>
                <td><StatusBadge status={item.status} /></td>
                <td>
                  {item.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button id={`pause-approve-${item.id}`} className="btn btn-success btn-sm" onClick={() => act(item.id, 'approve')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button id={`pause-reject-${item.id}`} className="btn btn-danger btn-sm" onClick={() => act(item.id, 'reject')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                  {item.status !== 'Pending' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>by {item.approved_by || '—'}</span>
                      {item.status === 'Approved' && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 8px', fontSize: 11, height: 26, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => act(item.id, 'reject')}
                          title="Cancel / Deactivate Hold"
                        >
                          <XCircle size={12} /> Cancel
                        </button>
                      )}
                    </div>
                  )}
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
  );
}

// ── Main PausePage ───────────────────────────────────────────────
export default function PausePage() {
  const [tab, setTab] = useState('hold');
  const [summary, setSummary] = useState({ hold: 0, vacation: 0, change: 0 });
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchSummary = async () => {
    try {
      const r = await api.get('/pause/summary');
      setSummary(r.data.data || { hold: 0, vacation: 0, change: 0 });
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pause Management</h1>
          <p className="page-subtitle">Manage customer holds, vacations, and delivery suspension requests</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchSummary} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> New Hold Request
          </button>
        </div>
      </div>

      {/* Tab Nav with icons and badges */}
      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const count = summary[t.key] || 0;
            return (
              <button
                key={t.key}
                id={`pause-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '14px 22px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s ease'
                }}
              >
                {t.icon}
                {t.label}
                {count > 0 && (
                  <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <RequestTable key={tab} tab={tab} onRefresh={fetchSummary} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {showAddModal && (
        <NewHoldModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            fetchSummary();
            setTab('hold');
          }}
        />
      )}
    </div>
  );
}
