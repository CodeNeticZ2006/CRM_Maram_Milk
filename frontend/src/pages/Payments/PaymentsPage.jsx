import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MdCheckCircle, MdSearch, MdRefresh, MdReceiptLong, MdWhatsapp, MdFlashOn } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TABS = [
  { key: 'payments', label: '💰 Payments' },
  { key: 'invoices', label: '🧾 Invoices & Bills (Weekly & Monthly)' },
];

function StatusBadge({ status }) {
  const map = {
    'Verified': 'badge-success',
    'Pending Verification': 'badge-warning',
    'Failed': 'badge-danger',
    'Partial': 'badge-info',
    'Advance': 'badge-blue',
    'Pending': 'badge-warning',
    'Paid': 'badge-success',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

function PaymentsTab() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        api.get('/payments', { params: { page, limit, status: statusFilter, search } }),
        api.get('/payments/stats'),
      ]);
      setItems(res.data.data); setTotal(res.data.total);
      setStats(statsRes.data.data);
    } catch { toast.error('Failed to load payments.'); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetch(); }, [fetch]);

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
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Pending Verification', value: stats.pending_count || 0, sub: `₹${(stats.pending_amount || 0).toLocaleString('en-IN')}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
          { label: 'Verified Today', value: `₹${(stats.today_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
          { label: 'Total Verified', value: stats.verified_count || 0, sub: `₹${(stats.verified_amount || 0).toLocaleString('en-IN')}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
          { label: 'Pending Invoices', value: stats.pending_invoices || 0, color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="input-with-icon" style={{ flex: 1, minWidth: 200 }}>
          <MdSearch className="input-icon" />
          <input id="payments-search" className="form-input" style={{ paddingLeft: 38, width: '100%' }}
            placeholder="Search customer..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select id="payments-status-filter" className="form-input" style={{ width: 200 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="Pending Verification">Pending Verification</option>
          <option value="Verified">Verified</option>
          <option value="Failed">Failed</option>
          <option value="Partial">Partial</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={fetch}><MdRefresh /></button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Customer</th><th>Amount</th><th>Method</th><th>Invoice</th><th>Date</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr> :
              items.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No payments found.</td></tr> :
              items.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.customer_code}</div>
                  </td>
                  <td style={{ fontWeight: 800, fontSize: 15, color: 'var(--success)' }}>₹{parseFloat(p.amount).toLocaleString('en-IN')}</td>
                  <td><span className="badge badge-blue">{p.method}</span></td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{p.invoice_number || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    {p.status === 'Pending Verification' && (
                      <button id={`verify-payment-${p.id}`} className="btn btn-success btn-sm" onClick={() => verify(p.id)}>
                        <MdCheckCircle /> Verify
                      </button>
                    )}
                    {p.status !== 'Pending Verification' && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.verified_by || '—'}</span>
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
          <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Page {page}</span>
          <button className="btn btn-secondary btn-sm" disabled={page === Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next →</button>
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
      setItems(res.data.data); setTotal(res.data.total);
    } catch { toast.error('Failed to load invoices.'); }
    finally { setLoading(false); }
  }, [page, cycleFilter, search]);

  useEffect(() => { fetch(); }, [fetch]);

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
          <div className="input-with-icon" style={{ flex: 1 }}>
            <MdSearch className="input-icon" />
            <input id="invoices-search" className="form-input" style={{ paddingLeft: 38, width: '100%' }}
              placeholder="Search invoice or customer..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select id="invoices-cycle-filter" className="form-input" style={{ width: 170 }} value={cycleFilter} onChange={e => { setCycleFilter(e.target.value); setPage(1); }}>
            <option value="">All Cycles</option>
            <option value="weekly">📅 Weekly Bills</option>
            <option value="monthly">🗓️ Monthly Bills</option>
          </select>
        </div>

        {/* Generate Bills Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button id="gen-weekly-bills-btn" className="btn btn-secondary btn-sm" disabled={generating} onClick={() => handleGenerateInvoices('weekly')}>
            <MdFlashOn style={{ color: '#f59e0b' }} /> Generate Weekly Bills
          </button>
          <button id="gen-monthly-bills-btn" className="btn btn-primary btn-sm" disabled={generating} onClick={() => handleGenerateInvoices('monthly')}>
            <MdFlashOn /> Generate Monthly Bills
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice No.</th><th>Customer</th><th>Cycle & Period</th><th>Amount</th><th>Wallet Bal.</th><th>Status</th><th>WhatsApp Bill</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Loading invoices...</td></tr> :
              items.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No invoices generated yet. Click 'Generate Weekly/Monthly Bills' above.</td></tr> :
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
                    >
                      {sendingId === inv.id ? <span className="loading-spinner" /> : <><MdWhatsapp /> Send WhatsApp Bill</>}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
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
          <p className="page-subtitle">Verify payments, generate weekly/monthly customer bills, and dispatch WhatsApp statements</p>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => (
            <button key={t.key} id={`payments-tab-${t.key}`} onClick={() => setTab(t.key)}
              style={{ background: 'none', border: 'none', padding: '14px 24px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}>
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
