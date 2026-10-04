import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Receipt,
  Search,
  RefreshCw,
  CheckCircle2,
  Wallet,
  Zap,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TABS = [
  { key: 'payments', label: 'Payments & Transactions', icon: <CreditCard size={16} /> },
  { key: 'invoices', label: 'Invoices & Bills (Weekly & Monthly)', icon: <Receipt size={16} /> },
];

function StatusBadge({ status }) {
  const map = {
    'Verified': 'badge-success',
    'Completed': 'badge-success',
    'Pending Verification': 'badge-warning',
    'Failed': 'badge-danger',
    'Partial': 'badge-info',
    'Advance': 'badge-blue',
    'Pending': 'badge-warning',
    'Paid': 'badge-success',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

function TypeBadge({ type }) {
  const normalized = (type || '').toUpperCase();
  if (normalized === 'WALLET_RECHARGE') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
      }}>
        <Wallet size={12} /> Wallet Recharge
      </span>
    );
  }
  if (normalized === 'WALLET_PAYMENT') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
      }}>
        <Receipt size={12} /> Wallet Payment
      </span>
    );
  }
  if (normalized === 'WALLET_REFUND') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
      }}>
        <RefreshCw size={12} /> Refund
      </span>
    );
  }
  if (normalized === 'WALLET_ADJUSTMENT') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1',
        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
      }}>
        <FileText size={12} /> Adjustment
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff',
      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700
    }}>
      <CreditCard size={12} /> Bill Payment
    </span>
  );
}

function PaymentsTab() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        api.get('/payments', {
          params: {
            page,
            limit,
            status: statusFilter,
            type: typeFilter,
            method: methodFilter,
            search
          }
        }),
        api.get('/payments/stats'),
      ]);
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
      setStats(statsRes.data.data || {});
    } catch {
      toast.error('Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, methodFilter, search]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const verify = async (id) => {
    try {
      await api.patch(`/payments/${id}/verify`);
      toast.success('Payment verified!');
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to verify.');
    }
  };

  return (
    <div>
      {/* Stats Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          {
            label: 'Pending Verification',
            value: stats.pending_count || 0,
            sub: `₹${(stats.pending_amount || 0).toLocaleString('en-IN')}`,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.06)'
          },
          {
            label: 'Verified Revenue Today',
            value: `₹${(stats.today_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            color: '#10b981',
            bg: 'rgba(16,185,129,0.06)'
          },
          {
            label: 'Wallet Recharges',
            value: stats.wallet_recharge_count || 0,
            sub: `Total: ₹${(stats.wallet_recharge_total || 0).toLocaleString('en-IN')}`,
            color: '#6366f1',
            bg: 'rgba(99,102,241,0.06)'
          },
          {
            label: 'Pending Invoices',
            value: stats.pending_invoices || 0,
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.06)'
          },
        ].map(card => (
          <div key={card.label} className="card" style={{ background: card.bg, borderColor: card.color + '30' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '16px 20px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: card.color }}>{card.value}</div>
              {card.sub && <div style={{ fontSize: 11, color: card.color, fontWeight: 600 }}>{card.sub}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="payments-search"
            className="form-input"
            style={{ paddingLeft: 34, height: 38 }}
            placeholder="Search customer, phone, code, ref..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          id="payments-type-filter"
          className="form-input"
          style={{ width: 170, height: 38 }}
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Types</option>
          <option value="WALLET_RECHARGE">Wallet Recharge</option>
          <option value="BILL_PAYMENT">Bill Payment</option>
          <option value="WALLET_PAYMENT">Wallet Payment</option>
          <option value="WALLET_REFUND">Wallet Refund</option>
          <option value="WALLET_ADJUSTMENT">Wallet Adjustment</option>
        </select>

        <select
          id="payments-status-filter"
          className="form-input"
          style={{ width: 160, height: 38 }}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="Completed">Completed</option>
          <option value="Verified">Verified</option>
          <option value="Pending Verification">Pending Verification</option>
          <option value="Failed">Failed</option>
        </select>

        <select
          id="payments-method-filter"
          className="form-input"
          style={{ width: 140, height: 38 }}
          value={methodFilter}
          onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Methods</option>
          <option value="Cash">Cash</option>
          <option value="GPay">GPay</option>
          <option value="PhonePe">PhonePe</option>
          <option value="Paytm">Paytm</option>
          <option value="Razorpay">Razorpay</option>
          <option value="Wallet">Wallet</option>
        </select>

        <button className="btn btn-secondary btn-sm" onClick={fetch} style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Payments Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Reference / Invoice</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading payments & transactions...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions found matching criteria.</td></tr>
            ) : (
              items.map((p, i) => {
                const isCredit = p.direction === 'CREDIT' || p.transaction_type === 'WALLET_RECHARGE';
                return (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.customer_name || 'Customer'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.customer_code} · {p.phone}</div>
                    </td>
                    <td>
                      <TypeBadge type={p.transaction_type} />
                    </td>
                    <td>
                      <div style={{
                        fontWeight: 800, fontSize: 14.5,
                        color: isCredit ? '#047857' : 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        {isCredit ? <ArrowDownLeft size={14} style={{ color: '#10b981' }} /> : <ArrowUpRight size={14} style={{ color: '#64748b' }} />}
                        {isCredit ? '+' : ''}₹{parseFloat(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td><span className="badge badge-blue">{p.method || '—'}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {p.transaction_ref ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>{p.transaction_ref}</span>
                      ) : p.invoice_number ? (
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{p.invoice_number}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {p.payment_date ? new Date(p.payment_date + (p.payment_date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      {p.status === 'Pending Verification' ? (
                        <button
                          id={`verify-payment-${p.id}`}
                          className="btn btn-success btn-sm"
                          onClick={() => verify(p.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, fontSize: 11 }}
                        >
                          <CheckCircle2 size={13} /> Verify
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.verified_by || '—'}</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {Math.ceil(total / limit) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page === Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function InvoicesTab() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [cycleFilter, setCycleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments/invoices', { params: { page, limit, cycle: cycleFilter, search } });
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [page, cycleFilter, search]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleGenerateInvoices = async (cycle) => {
    setGenerating(true);
    try {
      const res = await api.post('/payments/generate-invoices', { billing_cycle: cycle });
      toast.success(res.data.message || `Generated ${cycle} bills!`);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate bills.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = async (inv) => {
    setSendingId(inv.id);
    try {
      await api.post(`/payments/invoices/${inv.id}/send-whatsapp`);
      toast.success(`WhatsApp Bill sent to ${inv.customer_name}!`);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send WhatsApp bill.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      {/* Header Info & Generator Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="invoices-search"
              className="form-input"
              style={{ paddingLeft: 34, width: '100%', height: 38 }}
              placeholder="Search invoice or customer..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            id="invoices-cycle-filter"
            className="form-input"
            style={{ width: 170, height: 38 }}
            value={cycleFilter}
            onChange={e => { setCycleFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Cycles</option>
            <option value="weekly">Weekly Bills</option>
            <option value="monthly">Monthly Bills</option>
          </select>
        </div>

        {/* Generate Bills Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            id="gen-weekly-bills-btn"
            className="btn btn-secondary btn-sm"
            disabled={generating}
            onClick={() => handleGenerateInvoices('weekly')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Zap size={15} style={{ color: '#f59e0b' }} /> Generate Weekly Bills
          </button>
          <button
            id="gen-monthly-bills-btn"
            className="btn btn-primary btn-sm"
            disabled={generating}
            onClick={() => handleGenerateInvoices('monthly')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Zap size={15} /> Generate Monthly Bills
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Customer</th>
              <th>Cycle & Period</th>
              <th>Amount</th>
              <th>Wallet Bal.</th>
              <th>Status</th>
              <th>WhatsApp Bill</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading invoices...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No invoices generated yet. Click 'Generate Weekly/Monthly Bills' above.</td></tr>
            ) : (
              items.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{inv.invoice_number}</span>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', fontWeight: 600 }}>{inv.billing_cycle || 'monthly'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.customer_code} · {inv.phone}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {inv.start_date && inv.end_date
                      ? `${new Date(inv.start_date).toLocaleDateString('en-IN')} - ${new Date(inv.end_date).toLocaleDateString('en-IN')}`
                      : `${inv.month}/${inv.year}`}
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>₹{parseFloat(inv.grand_total || 0).toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 700, color: parseFloat(inv.wallet_balance) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                    ₹{parseFloat(inv.wallet_balance || 0).toLocaleString('en-IN')}
                  </td>
                  <td><StatusBadge status={inv.payment_status} /></td>
                  <td>
                    <button
                      id={`send-wa-bill-${inv.id}`}
                      className="btn btn-success btn-sm"
                      disabled={sendingId === inv.id}
                      onClick={() => handleSendWhatsApp(inv)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, fontSize: 11 }}
                    >
                      {sendingId === inv.id ? <span className="loading-spinner" /> : <><MessageSquare size={13} /> Send WhatsApp Bill</>}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {Math.ceil(total / limit) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page === Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  const [tab, setTab] = useState('payments');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments & Customer Invoices</h1>
          <p className="page-subtitle">Verify payments, track wallet recharges, generate customer bills, and dispatch statements</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              id={`payments-tab-${t.key}`}
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
            </button>
          ))}
        </div>

        <div className="card-body">
          {tab === 'payments' && <PaymentsTab />}
          {tab === 'invoices' && <InvoicesTab />}
        </div>
      </div>
    </div>
  );
}
