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
  Calendar,
  Clock,
  Play,
  RotateCcw,
  CalendarDays,
  AlertTriangle,
  History,
  CheckSquare,
  Square,
  CreditCard,
  CalendarOff,
  HelpCircle,
  ChevronDown,
  Pause,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TABS = [
  { key: 'subscription_pauses', label: 'Subscription Pauses', icon: <PauseCircle size={16} /> },
  { key: 'hold', label: 'Customer Holds', icon: <Clock size={16} /> },
  { key: 'vacation', label: 'Vacation Requests', icon: <Palmtree size={16} /> },
  { key: 'change', label: 'Change Requests', icon: <FileEdit size={16} /> },
  { key: 'history', label: 'Pause History & Logs', icon: <History size={16} /> },
];

const PAUSE_TYPES = [
  {
    id: 'Temporary Hold',
    title: 'Temporary Hold',
    desc: 'Pause delivery for a defined date range',
    icon: <Clock size={16} />,
    color: '#f59e0b'
  },
  {
    id: 'Single Date',
    title: 'Single Day Skip',
    desc: 'Skip delivery for one specific date only',
    icon: <CalendarOff size={16} />,
    color: '#3b82f6'
  },
  {
    id: 'Vacation',
    title: 'Vacation Hold',
    desc: 'Extended travel/vacation with tentative return',
    icon: <Palmtree size={16} />,
    color: '#10b981'
  },
  {
    id: 'Indefinite Hold',
    title: 'Indefinite Pause',
    desc: 'Stop until customer or admin manually resumes',
    icon: <PauseCircle size={16} />,
    color: '#8b5cf6'
  },
  {
    id: 'Billing Hold',
    title: 'Billing / Payment Hold',
    desc: 'Halt deliveries due to pending payment balance',
    icon: <CreditCard size={16} />,
    color: '#ef4444'
  },
];

const REASONS_BY_TYPE = {
  'Temporary Hold': [
    'Traveling / Out of town',
    'Surplus milk stored at home',
    'Customer requested short hold',
    'Attending family function',
  ],
  'Single Date': [
    'Milk not needed today',
    'Excess milk remaining',
    'Day trip / Away for the day',
    'Guest cancellation',
  ],
  'Vacation': [
    'Annual family holiday vacation',
    'Visiting native hometown',
    'Summer school holidays',
    'Festival celebration trip',
  ],
  'Indefinite Hold': [
    'Customer requested indefinite pause',
    'Medical treatment & recovery',
    'Home renovation underway',
    'Temporary city relocation',
  ],
  'Billing Hold': [
    'Outstanding monthly milk bill',
    'Payment reminder unattended',
    'UPI/Netbanking failure retry',
    'Cheque clearance awaited',
  ],
};

function StatusBadge({ status }) {
  const map = {
    Active: { cls: 'badge-warning', label: 'Active Pause', pulse: true },
    Upcoming: { cls: 'badge-info', label: 'Upcoming', pulse: false },
    Approved: { cls: 'badge-success', label: 'Approved', pulse: false },
    Pending: { cls: 'badge-warning', label: 'Pending Review', pulse: false },
    Resumed: { cls: 'badge-success', label: 'Resumed', pulse: false },
    Completed: { cls: 'badge-success', label: 'Resumed', pulse: false },
    Cancelled: { cls: 'badge-danger', label: 'Cancelled', pulse: false },
    Rejected: { cls: 'badge-danger', label: 'Rejected', pulse: false },
  };

  const item = map[status] || { cls: 'badge-gray', label: status, pulse: false };

  return (
    <span
      className={`badge ${item.cls}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontWeight: 600,
        fontSize: 11.5,
        padding: '3px 9px',
        textTransform: 'capitalize'
      }}
    >
      {item.pulse && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#f59e0b',
            display: 'inline-block',
            boxShadow: '0 0 0 2px rgba(245,158,11,0.35)',
            animation: 'pulse 1.8s infinite'
          }}
        />
      )}
      {item.label}
    </span>
  );
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  if (dateStr.startsWith('2099')) return 'Indefinite (Until Resumed)';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const getDaysDifference = (from, to) => {
  if (!from || !to) return 1;
  if (to.startsWith('2099')) return 'Indefinite';
  const d1 = new Date(from);
  const d2 = new Date(to);
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? `${diff} days` : '1 day';
};

// ── New Pause / Hold Modal ───────────────────────────────────────
function NewPauseModal({ onClose, onSaved, initialCustomer = null }) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [pauseType, setPauseType] = useState('Temporary Hold');
  const [form, setForm] = useState({
    customer_id: '',
    subscription_id: 'all',
    pause_start_date: tomorrow,
    pause_end_date: tomorrow,
    reason: '',
    tentative_return: false,
    auto_resume_on_payment: false,
    billing_notes: ''
  });

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSubs, setCustomerSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-select initial customer if provided (e.g. from Pause Again action)
  useEffect(() => {
    if (initialCustomer) {
      const cid = initialCustomer.customer_id || initialCustomer.id;
      if (cid) {
        handleSelectCustomer({
          id: cid,
          name: initialCustomer.customer_name || initialCustomer.name,
          customer_code: initialCustomer.customer_code,
          phone: initialCustomer.customer_phone || initialCustomer.phone
        });
      }
    }
  }, [initialCustomer]);

  // When pauseType changes, adapt form dates and defaults dynamically
  useEffect(() => {
    if (pauseType === 'Single Date') {
      setForm(f => ({ ...f, pause_end_date: f.pause_start_date || tomorrow }));
    } else if (pauseType === 'Indefinite Hold') {
      setForm(f => ({ ...f, pause_end_date: '2099-12-31' }));
    } else if (pauseType === 'Vacation') {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setForm(f => ({ ...f, pause_end_date: f.pause_end_date === tomorrow ? nextWeek : f.pause_end_date }));
    } else if (form.pause_end_date === '2099-12-31') {
      setForm(f => ({ ...f, pause_end_date: tomorrow }));
    }
  }, [pauseType]);

  // Live customer search
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

  // Customer selection
  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setForm(f => ({ ...f, customer_id: cust.id, subscription_id: 'all' }));
    setCustomers([]);
    setLoadingSubs(true);
    try {
      const res = await api.get(`/pause/customer-subscriptions/${cust.id}`);
      setCustomerSubs(res.data.data || []);
    } catch {
      toast.error('Failed to load customer subscriptions.');
    } finally {
      setLoadingSubs(false);
    }
  };

  // Quick duration shortcuts
  const applyDurationDays = (days) => {
    const start = new Date(form.pause_start_date || tomorrow);
    const end = new Date(start.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
    setForm(f => ({ ...f, pause_end_date: end.toISOString().slice(0, 10) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.error('Please select a customer.');
    if (!form.pause_start_date) return toast.error('Pause start date is required.');

    let effectiveEndDate = form.pause_end_date;
    if (pauseType === 'Single Date') {
      effectiveEndDate = form.pause_start_date;
    } else if (pauseType === 'Indefinite Hold') {
      effectiveEndDate = '2099-12-31';
    }

    if (!effectiveEndDate) return toast.error('Pause end date is required.');
    if (effectiveEndDate < form.pause_start_date) {
      return toast.error('Pause end date cannot be earlier than start date.');
    }

    let finalReason = form.reason;
    if (pauseType === 'Billing Hold' && form.billing_notes) {
      finalReason = `${form.reason ? form.reason + ' - ' : ''}Outstanding: ${form.billing_notes}`;
    }

    setLoading(true);
    try {
      await api.post('/pause/create', {
        ...form,
        pause_type: pauseType,
        pause_end_date: effectiveEndDate,
        reason: finalReason
      });
      toast.success('Pause successfully scheduled and activated!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule pause.');
    } finally {
      setLoading(false);
    }
  };

  const reasonsList = REASONS_BY_TYPE[pauseType] || REASONS_BY_TYPE['Temporary Hold'];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 640, width: '95%', background: '#ffffff', borderRadius: 16, overflow: 'hidden' }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
              <PauseCircle size={20} style={{ color: '#f59e0b' }} /> Super Admin: Schedule Delivery Pause
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Suspend scheduled milk deliveries for a customer or specific subscription
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', maxHeight: '82vh', overflowY: 'auto' }}>
          {/* Customer Selection */}
          <div className="form-group" style={{ position: 'relative', marginBottom: 18 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>1. Select Customer *</label>
            {selectedCustomer ? (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={15} style={{ color: 'var(--primary)' }} /> {selectedCustomer.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selectedCustomer.customer_code} · {selectedCustomer.phone} · {selectedCustomer.address || 'No address specified'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, height: 28, padding: '0 10px', background: '#ffffff' }}
                  onClick={() => { setSelectedCustomer(null); setCustomerSubs([]); setForm(f => ({ ...f, customer_id: '' })); }}
                >
                  Change Customer
                </button>
              </div>
            ) : (
              <div>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 34, height: 40 }}
                    placeholder="Search by customer name, phone, or code..."
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
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    maxHeight: 180,
                    overflowY: 'auto',
                    marginTop: 4
                  }}>
                    {customers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
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

          {/* Subscriptions Selection */}
          {selectedCustomer && (
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>2. Target Subscription</label>
              {loadingSubs ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading active subscriptions...</div>
              ) : (
                <select
                  className="form-input"
                  value={form.subscription_id}
                  onChange={e => setForm(f => ({ ...f, subscription_id: e.target.value }))}
                >
                  <option value="all">All Active Subscriptions ({customerSubs.length} total)</option>
                  {customerSubs.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.frequency_type} Plan — {s.items_summary}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Pause Type Selection Cards */}
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
              3. Select Pause Type (Options will adapt below)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 8 }}>
              {PAUSE_TYPES.map(pt => {
                const isSelected = pauseType === pt.id;
                return (
                  <div
                    key={pt.id}
                    onClick={() => setPauseType(pt.id)}
                    style={{
                      border: isSelected ? `2px solid ${pt.color}` : '1px solid #e2e8f0',
                      background: isSelected ? `${pt.color}10` : '#ffffff',
                      borderRadius: 10,
                      padding: '10px 8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ color: pt.color, display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                      {pt.icon}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: isSelected ? pt.color : '#334155' }}>
                      {pt.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ──────────────── DYNAMIC OPTIONS BASED ON PAUSE TYPE ──────────────── */}

          {/* TYPE A: Single Day Skip */}
          {pauseType === 'Single Date' && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarOff size={15} /> Single Day Skip Configuration
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#1e3a8a', display: 'block', marginBottom: 4 }}>
                    Skip Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.pause_start_date}
                    onChange={e => setForm(f => ({ ...f, pause_start_date: e.target.value, pause_end_date: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, background: '#ffffff' }}
                    onClick={() => setForm(f => ({ ...f, pause_start_date: tomorrow, pause_end_date: tomorrow }))}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, background: '#ffffff' }}
                    onClick={() => setForm(f => ({ ...f, pause_start_date: dayAfter, pause_end_date: dayAfter }))}
                  >
                    Day After
                  </button>
                </div>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#3b82f6' }}>
                ℹ️ Delivery will be suspended for this single day only and will resume automatically on the next scheduled delivery day.
              </p>
            </div>
          )}

          {/* TYPE B: Temporary Hold (Date Range) */}
          {pauseType === 'Temporary Hold' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#b45309', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} /> Temporary Hold Range
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#78350f', display: 'block', marginBottom: 4 }}>
                    Pause From *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.pause_start_date}
                    onChange={e => setForm(f => ({ ...f, pause_start_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#78350f', display: 'block', marginBottom: 4 }}>
                    Pause Until *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.pause_end_date}
                    min={form.pause_start_date}
                    onChange={e => setForm(f => ({ ...f, pause_end_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Quick Range Shortcuts */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>Quick Duration:</span>
                {[
                  { label: '1 Day', days: 1 },
                  { label: '3 Days', days: 3 },
                  { label: '1 Week', days: 7 },
                  { label: '2 Weeks', days: 14 },
                  { label: '1 Month', days: 30 },
                ].map(sc => (
                  <button
                    type="button"
                    key={sc.label}
                    onClick={() => applyDurationDays(sc.days)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#b45309',
                      cursor: 'pointer'
                    }}
                  >
                    +{sc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TYPE C: Vacation Hold */}
          {pauseType === 'Vacation' && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Palmtree size={15} /> Vacation Schedule
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#166534', display: 'block', marginBottom: 4 }}>
                    Vacation Departure Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.pause_start_date}
                    onChange={e => setForm(f => ({ ...f, pause_start_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#166534', display: 'block', marginBottom: 4 }}>
                    Expected Return Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.pause_end_date}
                    min={form.pause_start_date}
                    onChange={e => setForm(f => ({ ...f, pause_end_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Vacation Checkbox Option */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#166534', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.tentative_return}
                  onChange={e => setForm(f => ({ ...f, tentative_return: e.target.checked }))}
                />
                <span>Tentative return date (Customer will confirm resumption before delivery resumes)</span>
              </label>
            </div>
          )}

          {/* TYPE D: Indefinite Hold */}
          {pauseType === 'Indefinite Hold' && (
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#7e22ce', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <PauseCircle size={15} /> Open-Ended / Indefinite Pause
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#6b21a8', display: 'block', marginBottom: 4 }}>
                  Pause Effective From Date *
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ maxWidth: 220 }}
                  value={form.pause_start_date}
                  onChange={e => setForm(f => ({ ...f, pause_start_date: e.target.value }))}
                  required
                />
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #d8b4fe', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: '#6b21a8' }}>
                🔒 <strong>No end date required.</strong> Deliveries will remain suspended indefinitely. The Super Admin can resume deliveries at any moment by clicking <strong>"Resume Now"</strong> in the Pause Management table.
              </div>
            </div>
          )}

          {/* TYPE E: Billing / Payment Hold */}
          {pauseType === 'Billing Hold' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#b91c1c', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={15} /> Payment & Billing Suspension
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: 4 }}>
                    Hold Start Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.pause_start_date}
                    onChange={e => setForm(f => ({ ...f, pause_start_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: 4 }}>
                    Outstanding Balance / Invoice Ref
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ₹1,450 pending"
                    value={form.billing_notes}
                    onChange={e => setForm(f => ({ ...f, billing_notes: e.target.value }))}
                  />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#991b1b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.auto_resume_on_payment}
                  onChange={e => setForm(f => ({ ...f, auto_resume_on_payment: e.target.checked }))}
                />
                <span>Auto-resume deliveries when customer settles dues</span>
              </label>
            </div>
          )}

          {/* Reason & Quick Chips */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>4. Reason / Notes</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter reason for pausing..."
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {reasonsList.map(r => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setForm(f => ({ ...f, reason: r }))}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 99,
                    padding: '3px 10px',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              {loading ? <span className="loading-spinner" /> : <><CheckCircle2 size={16} /> Activate Pause Schedule</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Super Admin Resume Delivery Confirmation Modal ────────────────
function ResumeDeliveryModal({ pause, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [resumeDate, setResumeDate] = useState(today);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/pause/${pause.id}/resume`, { resume_date: resumeDate });
      toast.success(res.data?.message || 'Delivery resumed! Subscription restored to Active.');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to resume delivery.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 480, width: '92%', background: '#ffffff', borderRadius: 16 }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: '#16a34a' }}>
            <Play size={18} fill="#16a34a" /> Resume Milk Deliveries
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#15803d' }}>{pause.customer_name}</div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>{pause.items_summary}</div>
            <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 4 }}>
              Current Pause: {formatDate(pause.pause_start_date)} → {formatDate(pause.pause_end_date)}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Resume Delivery Starting Date</label>
            <input
              type="date"
              className="form-input"
              value={resumeDate}
              onChange={e => setResumeDate(e.target.value)}
              required
            />
            <small style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              Setting today ({formatDate(today)}) will reactivate delivery on today's schedule immediately.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleConfirm}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, background: '#16a34a' }}
            >
              {loading ? <span className="loading-spinner" /> : <><Play size={14} fill="#ffffff" /> Confirm Resume Delivery</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Extend / Edit Pause Modal ─────────────────────────────────────
function EditPauseModal({ pause, onClose, onSaved }) {
  const [form, setForm] = useState({
    pause_start_date: pause.pause_start_date ? pause.pause_start_date.split('T')[0] : '',
    pause_end_date: pause.pause_end_date ? pause.pause_end_date.split('T')[0] : '',
    reason: pause.reason || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pause_start_date || !form.pause_end_date) {
      return toast.error('Start and end dates are required.');
    }
    if (form.pause_end_date < form.pause_start_date) {
      return toast.error('End date cannot be earlier than start date.');
    }

    setLoading(true);
    try {
      await api.put(`/pause/${pause.id}`, form);
      toast.success('Pause schedule updated successfully!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update pause.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 480, width: '92%', background: '#ffffff', borderRadius: 16 }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} /> Extend / Modify Pause Schedule
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 16, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{pause.customer_name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{pause.items_summary}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.pause_start_date}
                onChange={e => setForm(f => ({ ...f, pause_start_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>End Date</label>
              <input
                type="date"
                className="form-input"
                value={form.pause_end_date}
                min={form.pause_start_date}
                onChange={e => setForm(f => ({ ...f, pause_end_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Reason / Note</label>
            <input
              type="text"
              className="form-input"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Confirmation Modal (Dedicated in-app confirm dialog, replaces browser alerts) ──
function ConfirmModal({ isOpen, title, message, confirmText = 'Confirm', confirmStyle = 'danger', onConfirm, onCancel, loading = false }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 440, width: '92%', background: '#ffffff', borderRadius: 16 }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16.5, fontWeight: 700, color: confirmStyle === 'danger' ? '#ef4444' : '#16a34a' }}>
            {confirmStyle === 'danger' ? <AlertTriangle size={18} /> : <Play size={18} />} {title}
          </h2>
          <button className="icon-btn" onClick={onCancel}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5, margin: 0 }}>
            {message}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-${confirmStyle}`}
              onClick={onConfirm}
              disabled={loading}
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {loading ? <span className="loading-spinner" /> : confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Pause Details & Audit Modal ──
function PauseDetailsModal({ pause, onClose, onRePause }) {
  if (!pause) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 520, width: '92%', background: '#ffffff', borderRadius: 16 }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} /> Pause Audit & History Details
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{pause.customer_name}</div>
              <StatusBadge status={pause.computed_status || pause.status || pause.raw_status} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Code: {pause.customer_code || '—'} · Phone: {pause.customer_phone || pause.phone || '—'}
            </div>
            {pause.items_summary && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                Items: {pause.items_summary}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 12.5 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Pause Window</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>
                {formatDate(pause.pause_start_date || pause.hold_from || pause.start_date)} → {formatDate(pause.pause_end_date || pause.hold_to || pause.end_date)}
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Resume Effective Date</div>
              <div style={{ fontWeight: 600, marginTop: 4, color: pause.resume_date ? '#16a34a' : 'inherit' }}>
                {pause.resume_date ? formatDate(pause.resume_date) : 'Pending / Not Resumed'}
              </div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12.5 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Reason / Notes</div>
            <div style={{ marginTop: 4, color: '#334155' }}>{pause.reason || 'No specific notes recorded'}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <span>Logged by: <strong>{pause.created_by || pause.approved_by || 'Super Admin'}</strong></span>
            {pause.created_at && <span>{formatDate(pause.created_at)}</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onRePause(pause);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Pause size={13} /> Schedule New Pause
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main RequestTable Component ──────────────────────────────────
function RequestTable({ tab, onRefresh }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingPause, setEditingPause] = useState(null);
  const [resumingPause, setResumingPause] = useState(null);

  // In-app dedicated action states (replaces browser confirm alerts)
  const [cancelConfirmPause, setCancelConfirmPause] = useState(null);
  const [deleteConfirmPause, setDeleteConfirmPause] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState(null); // { type: 'resume' | 'cancel' }
  const [detailsModalPause, setDetailsModalPause] = useState(null);
  const [rePauseCustomer, setRePauseCustomer] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const limit = 15;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/pause', {
        params: { tab, page, limit, search, status_filter: statusFilter }
      });
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
      setSelectedIds([]);
    } catch {
      toast.error('Failed to load pause records.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, statusFilter]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Bulk Actions
  const handleConfirmBulkAction = async () => {
    if (!bulkConfirm || selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      if (bulkConfirm.type === 'resume') {
        const res = await api.post('/pause/bulk-resume', { ids: selectedIds });
        toast.success(res.data?.message || `Deliveries resumed for ${selectedIds.length} subscriptions!`);
      } else {
        const res = await api.post('/pause/bulk-cancel', { ids: selectedIds });
        toast.success(res.data?.message || `Cancelled ${selectedIds.length} pauses!`);
      }
      setBulkConfirm(null);
      fetch();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Cancel pause
  const handleConfirmCancelPause = async () => {
    if (!cancelConfirmPause) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/pause/${cancelConfirmPause.id}/cancel`);
      toast.success(res.data?.message || `Pause for ${cancelConfirmPause.customer_name || 'customer'} cancelled. Regular delivery schedule restored.`);
      setCancelConfirmPause(null);
      fetch();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel pause.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete pause record permanently
  const handleConfirmDeleteRecord = async () => {
    if (!deleteConfirmPause) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/pause/${deleteConfirmPause.id}/record`);
      toast.success(res.data?.message || 'Pause record removed from logs.');
      setDeleteConfirmPause(null);
      fetch();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action for hold/vacation/change approval
  const act = async (item, action) => {
    try {
      const res = await api.patch(`/pause/${tab}/${item.id}`, { action });
      const actionName = action === 'approve' ? 'approved' : 'rejected';
      toast.success(res.data?.message || `${item.customer_name || 'Request'} ${actionName} successfully.`);
      fetch();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update request.');
    }
  };

  return (
    <div>
      {/* Filter, Search & Bulk Actions Bar */}
      {(tab === 'subscription_pauses' || tab === 'all_pauses' || tab === 'history') && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          gap: 12,
          flexWrap: 'wrap',
          background: '#fdfdfe'
        }}>
          {/* Status Pills for Subscriptions or Contextual Title for History */}
          {(tab === 'subscription_pauses' || tab === 'all_pauses') ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { key: 'all', label: 'All Pauses' },
                { key: 'active', label: 'Currently Active' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => { setStatusFilter(s.key); setPage(1); }}
                  style={{
                    background: statusFilter === s.key ? 'var(--primary)' : '#ffffff',
                    color: statusFilter === s.key ? '#ffffff' : 'var(--text-secondary)',
                    border: statusFilter === s.key ? '1px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: 20,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <History size={16} style={{ color: 'var(--primary)' }} /> Audit trail of all pause schedules, resumptions, cancellations, and modifications
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Bulk Actions if items selected */}
            {(tab === 'subscription_pauses' || tab === 'all_pauses') && selectedIds.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '3px 8px' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1e40af' }}>{selectedIds.length} selected:</span>
                <button
                  className="btn btn-success btn-sm"
                  style={{ height: 26, fontSize: 11, padding: '0 8px', background: '#16a34a' }}
                  onClick={() => setBulkConfirm({ type: 'resume', count: selectedIds.length })}
                >
                  <Play size={11} fill="#ffffff" /> Resume Selected
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ height: 26, fontSize: 11, padding: '0 8px' }}
                  onClick={() => setBulkConfirm({ type: 'cancel', count: selectedIds.length })}
                >
                  <X size={11} /> Cancel Selected
                </button>
              </div>
            )}

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ height: 34, paddingLeft: 32, fontSize: 12.5 }}
                placeholder={tab === 'history' ? 'Search customer, action, reason...' : 'Search customer, phone, code...'}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tables based on active tab */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            {tab === 'subscription_pauses' && (
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Customer</th>
                <th>Subscription / Items</th>
                <th>Pause Type</th>
                <th>Pause Duration</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Admin Operations</th>
              </tr>
            )}

            {tab === 'hold' && (
              <tr>
                <th>Customer</th>
                <th>Hold From</th>
                <th>Hold To</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            )}

            {tab === 'vacation' && (
              <tr>
                <th>Customer</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            )}

            {tab === 'change' && (
              <tr>
                <th>Customer</th>
                <th>Request Type</th>
                <th>Old Value</th>
                <th>New Value</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            )}

            {tab === 'history' && (
              <tr>
                <th>Customer</th>
                <th>Event / Action</th>
                <th>Pause Type</th>
                <th>Duration Window</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Logged By / Date</th>
              </tr>
            )}
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                  Loading pause records...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  No pause records found for this view.
                </td>
              </tr>
            ) : (
              items.map((item, i) => {
                const diffDays = getDaysDifference(
                  item.pause_start_date || item.hold_from || item.start_date,
                  item.pause_end_date || item.hold_to || item.end_date
                );

                const isSelected = selectedIds.includes(item.id);

                return (
                  <motion.tr
                    key={item.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    style={{ background: isSelected ? 'rgba(99,102,241,0.04)' : undefined }}
                  >
                    {/* CHECKBOX FOR BULK ACTIONS */}
                    {tab === 'subscription_pauses' && (
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                        />
                      </td>
                    )}

                    {/* CUSTOMER COLUMN */}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>
                        {item.customer_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {item.customer_code} · {item.phone || item.customer_phone}
                      </div>
                    </td>

                    {/* SUBSCRIPTION PAUSES VIEW */}
                    {tab === 'subscription_pauses' && (
                      <>
                        <td>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {item.items_summary}
                          </div>
                          {item.frequency_type && (
                            <span style={{ fontSize: 10.5, color: 'var(--primary)', fontWeight: 600, background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: 4 }}>
                              {item.frequency_type}
                            </span>
                          )}
                        </td>

                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                            {item.pause_type}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {formatDate(item.pause_start_date)} → {formatDate(item.pause_end_date)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {diffDays}
                            {item.computed_status === 'Active' && ' · In Progress'}
                          </div>
                        </td>

                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180 }}>
                          {item.reason || '—'}
                        </td>

                        <td>
                          <StatusBadge status={item.computed_status || item.raw_status} />
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {/* Super Admin Resume delivery button (Active) */}
                            {item.computed_status === 'Active' && (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => setResumingPause(item)}
                                  title="Resume Delivery Immediately or on Date"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 10px',
                                    height: 28,
                                    fontWeight: 700,
                                    background: '#16a34a'
                                  }}
                                >
                                  <Play size={12} fill="#ffffff" /> Resume Now
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setEditingPause(item)}
                                  title="Extend or edit pause dates"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 8px',
                                    height: 28
                                  }}
                                >
                                  <Calendar size={13} /> Edit
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setCancelConfirmPause(item)}
                                  title="Cancel this pause"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 8px',
                                    height: 28
                                  }}
                                >
                                  <XCircle size={13} /> Cancel
                                </button>
                              </>
                            )}

                            {/* Upcoming pause operations */}
                            {item.computed_status === 'Upcoming' && (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => setResumingPause(item)}
                                  title="Resume / Start Early"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 9px',
                                    height: 28,
                                    background: '#16a34a'
                                  }}
                                >
                                  <Play size={12} fill="#ffffff" /> Resume Early
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setEditingPause(item)}
                                  title="Modify scheduled dates"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 8px',
                                    height: 28
                                  }}
                                >
                                  <Calendar size={13} /> Edit
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setCancelConfirmPause(item)}
                                  title="Cancel scheduled pause"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 8px',
                                    height: 28
                                  }}
                                >
                                  <XCircle size={13} /> Cancel
                                </button>
                              </>
                            )}

                            {/* Resumed or Completed pause operations */}
                            {(item.computed_status === 'Resumed' || item.computed_status === 'Completed') && (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setDetailsModalPause(item)}
                                  title="View pause audit details"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 8px',
                                    height: 28
                                  }}
                                >
                                  <Clock size={12} /> Audit Log
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => setRePauseCustomer(item)}
                                  title="Schedule another pause for this customer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 9px',
                                    height: 28
                                  }}
                                >
                                  <Pause size={12} /> Pause Again
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setDeleteConfirmPause(item)}
                                  title="Delete record from history"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    height: 28,
                                    padding: '4px 6px',
                                    color: '#ef4444'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}

                            {/* Cancelled pause operations */}
                            {item.computed_status === 'Cancelled' && (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setDetailsModalPause(item)}
                                  title="View cancellation audit details"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 8px',
                                    height: 28
                                  }}
                                >
                                  <Clock size={12} /> Details
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => setRePauseCustomer(item)}
                                  title="Schedule a pause for this customer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11.5,
                                    padding: '4px 9px',
                                    height: 28
                                  }}
                                >
                                  <Pause size={12} /> Re-Pause
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setDeleteConfirmPause(item)}
                                  title="Delete cancelled record"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    height: 28,
                                    padding: '4px 6px',
                                    color: '#ef4444'
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* HOLD REQUESTS VIEW */}
                    {tab === 'hold' && (
                      <>
                        <td>{formatDate(item.hold_from)}</td>
                        <td>{formatDate(item.hold_to)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.reason || '—'}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {item.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-success btn-sm" onClick={() => act(item, 'approve')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={13} /> Approve
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => act(item, 'reject')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setDetailsModalPause(item)}
                                title="View Details"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '3px 8px', height: 26 }}
                              >
                                <Clock size={12} /> Details
                              </button>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                by {item.approved_by || 'Super Admin'}
                              </span>
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* VACATION REQUESTS VIEW */}
                    {tab === 'vacation' && (
                      <>
                        <td>{formatDate(item.start_date)}</td>
                        <td>{formatDate(item.end_date)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.reason || '—'}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {item.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-success btn-sm" onClick={() => act(item, 'approve')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={13} /> Approve
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => act(item, 'reject')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setDetailsModalPause(item)}
                                title="View Details"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '3px 8px', height: 26 }}
                              >
                                <Clock size={12} /> Details
                              </button>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                by {item.approved_by || 'Super Admin'}
                              </span>
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* CHANGE REQUESTS VIEW */}
                    {tab === 'change' && (
                      <>
                        <td><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>{item.request_type}</span></td>
                        <td style={{ fontSize: 12 }}>{item.old_value || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.new_value || '—'}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {item.status === 'Pending' && (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-success btn-sm" onClick={() => act(item, 'approve')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle2 size={13} /> Approve
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => act(item, 'reject')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* HISTORY VIEW */}
                    {tab === 'history' && (
                      <>
                        <td>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: item.action?.includes('RESUME')
                                ? '#15803d'
                                : item.action?.includes('CANCEL') || item.action?.includes('DELETE') || item.action?.includes('REJECT')
                                ? '#b91c1c'
                                : item.action?.includes('MODIFY')
                                ? '#b45309'
                                : '#4338ca',
                              background: item.action?.includes('RESUME')
                                ? '#f0fdf4'
                                : item.action?.includes('CANCEL') || item.action?.includes('DELETE') || item.action?.includes('REJECT')
                                ? '#fef2f2'
                                : item.action?.includes('MODIFY')
                                ? '#fffbeb'
                                : '#eef2ff',
                              border: `1px solid ${
                                item.action?.includes('RESUME')
                                  ? '#bbf7d0'
                                  : item.action?.includes('CANCEL') || item.action?.includes('DELETE') || item.action?.includes('REJECT')
                                  ? '#fecaca'
                                  : item.action?.includes('MODIFY')
                                  ? '#fde68a'
                                  : '#c7d2fe'
                              }`,
                              padding: '2px 8px',
                              borderRadius: 4,
                              display: 'inline-block',
                              letterSpacing: '0.01em'
                            }}
                          >
                            {(item.action || 'PAUSE_LOGGED').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td><span style={{ fontSize: 12, fontWeight: 600 }}>{item.pause_type}</span></td>
                        <td>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {formatDate(item.pause_start_date)} → {formatDate(item.pause_end_date)}
                          </div>
                          {item.resume_date && (
                            <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                              Resumed on {formatDate(item.resume_date)}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.reason || '—'}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          <div>{item.created_by || 'Super Admin'}</div>
                          <div style={{ fontSize: 10.5, marginTop: 2 }}>{formatDate(item.created_at)}</div>
                        </td>
                      </>
                    )}
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {Math.ceil(total / limit) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
            Page {page} of {Math.ceil(total / limit)} ({total} total records)
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page === Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* Super Admin Resume Delivery Modal */}
      {resumingPause && (
        <ResumeDeliveryModal
          pause={resumingPause}
          onClose={() => setResumingPause(null)}
          onSaved={() => {
            fetch();
            onRefresh();
          }}
        />
      )}

      {/* Modal to edit pause dates */}
      {editingPause && (
        <EditPauseModal
          pause={editingPause}
          onClose={() => setEditingPause(null)}
          onSaved={() => {
            fetch();
            onRefresh();
          }}
        />
      )}

      {/* Dedicated In-App Confirmation Modal: Cancel Single Pause */}
      {cancelConfirmPause && (
        <ConfirmModal
          isOpen={true}
          title="Cancel Subscription Pause"
          message={`Are you sure you want to cancel the pause for ${cancelConfirmPause.customer_name}? Daily milk delivery dispatches will resume immediately on regular schedule.`}
          confirmText="Yes, Cancel Pause"
          confirmStyle="danger"
          onConfirm={handleConfirmCancelPause}
          onCancel={() => setCancelConfirmPause(null)}
          loading={actionLoading}
        />
      )}

      {/* Dedicated In-App Confirmation Modal: Delete Pause Record */}
      {deleteConfirmPause && (
        <ConfirmModal
          isOpen={true}
          title="Delete Pause Record"
          message={`Are you sure you want to permanently delete this pause record for ${deleteConfirmPause.customer_name}? This action cannot be undone.`}
          confirmText="Yes, Delete Permanently"
          confirmStyle="danger"
          onConfirm={handleConfirmDeleteRecord}
          onCancel={() => setDeleteConfirmPause(null)}
          loading={actionLoading}
        />
      )}

      {/* Dedicated In-App Confirmation Modal: Bulk Action */}
      {bulkConfirm && (
        <ConfirmModal
          isOpen={true}
          title={bulkConfirm.type === 'resume' ? 'Resume Selected Subscriptions' : 'Cancel Selected Pauses'}
          message={bulkConfirm.type === 'resume'
            ? `Resume morning and evening deliveries immediately for all ${bulkConfirm.count} selected subscriptions?`
            : `Cancel all ${bulkConfirm.count} selected pauses? Regular delivery schedule will be restored.`}
          confirmText={bulkConfirm.type === 'resume' ? 'Yes, Resume Deliveries' : 'Yes, Cancel Pauses'}
          confirmStyle={bulkConfirm.type === 'resume' ? 'success' : 'danger'}
          onConfirm={handleConfirmBulkAction}
          onCancel={() => setBulkConfirm(null)}
          loading={actionLoading}
        />
      )}

      {/* Modal to view complete Pause Audit & Details */}
      {detailsModalPause && (
        <PauseDetailsModal
          pause={detailsModalPause}
          onClose={() => setDetailsModalPause(null)}
          onRePause={(cust) => setRePauseCustomer(cust)}
        />
      )}

      {/* Modal to schedule a new pause for this customer */}
      {rePauseCustomer && (
        <NewPauseModal
          initialCustomer={rePauseCustomer}
          onClose={() => setRePauseCustomer(null)}
          onSaved={() => {
            fetch();
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ── Main PausePage ───────────────────────────────────────────────
export default function PausePage() {
  const [tab, setTab] = useState('subscription_pauses');
  const [summary, setSummary] = useState({
    activePauses: 0,
    upcomingPauses: 0,
    hold: 0,
    vacation: 0,
    change: 0,
    pendingTotal: 0,
    resumedThisMonth: 0
  });
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchSummary = async () => {
    try {
      const r = await api.get('/pause/summary');
      setSummary(r.data.data || {
        activePauses: 0,
        upcomingPauses: 0,
        hold: 0,
        vacation: 0,
        change: 0,
        pendingTotal: 0,
        resumedThisMonth: 0
      });
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PauseCircle size={26} style={{ color: '#f59e0b' }} /> Pause Management
          </h1>
          <p className="page-subtitle">
            Centralized hub for all delivery suspensions, subscription holds, vacation schedules, and instant resumptions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchSummary}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            id="new-pause-btn"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={16} /> Schedule Pause / Hold
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Card 1: Currently Active Pauses */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #f59e0b', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Pauses Today
            </span>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#f59e0b',
              boxShadow: '0 0 0 3px rgba(245,158,11,0.25)'
            }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#b45309' }}>
            {summary.activePauses}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Subscriptions paused from delivery today
          </div>
        </div>

        {/* Card 2: Upcoming Pauses */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #3b82f6', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Upcoming Pauses
            </span>
            <Calendar size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1d4ed8' }}>
            {summary.upcomingPauses}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Scheduled for future dates
          </div>
        </div>

        {/* Card 3: Pending Approval Requests */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #ef4444', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pending Customer Requests
            </span>
            <Clock size={18} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#b91c1c' }}>
            {summary.pendingTotal || 0}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.hold || 0} holds · {summary.vacation || 0} vacations
          </div>
        </div>

        {/* Card 4: Resumed / Completed This Month */}
        <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid #10b981', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Resumed This Month
            </span>
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#047857' }}>
            {summary.resumedThisMonth}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Deliveries restored back to Active
          </div>
        </div>
      </div>

      {/* Main Tabbed Interface */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', background: '#ffffff' }}>
          {TABS.map(t => {
            let count = 0;
            if (t.key === 'subscription_pauses') count = summary.activePauses;
            else if (t.key === 'hold') count = summary.hold;
            else if (t.key === 'vacation') count = summary.vacation;
            else if (t.key === 'change') count = summary.change;

            const isSelected = tab === t.key;

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
                  color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s ease'
                }}
              >
                {t.icon}
                {t.label}
                {count > 0 && (
                  <span style={{
                    background: t.key === 'subscription_pauses' ? '#f59e0b' : 'var(--danger)',
                    color: '#fff',
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 7px'
                  }}>
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

      {/* Schedule Pause Modal */}
      {showAddModal && (
        <NewPauseModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            fetchSummary();
            setTab('subscription_pauses');
          }}
        />
      )}
    </div>
  );
}
