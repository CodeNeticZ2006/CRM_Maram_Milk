import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MdCheckCircle, MdCancel, MdRefresh } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const STATUS_TABS = [
  { key: 'Pending', label: '🕐 Pending' },
  { key: 'Approved', label: '✅ Approved' },
  { key: 'Rejected', label: '❌ Rejected' },
];

export default function WhatsAppPage() {
  const [tab, setTab] = useState('Pending');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        api.get('/whatsapp', { params: { status: tab, page, limit } }),
        api.get('/whatsapp/stats'),
      ]);
      setItems(res.data.data); setTotal(res.data.total);
      setStats(statsRes.data.data);
    } catch { toast.error('Failed to load.'); }
    finally { setLoading(false); }
  }, [tab, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const act = async (id, action) => {
    try {
      await api.patch(`/whatsapp/${id}`, { action });
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'}.`);
      fetch();
    } catch { toast.error('Failed.'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Operations</h1>
          <p className="page-subtitle">Manage inbound WhatsApp payment & change requests</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetch}><MdRefresh /> Refresh</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Pending', value: stats.pending || 0, color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
          { label: 'Approved', value: stats.approved || 0, color: '#10b981', bg: 'rgba(16,185,129,0.06)' },
          { label: 'Rejected', value: stats.rejected || 0, color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
        ].map(card => (
          <div key={card.label} className="card" style={{ background: card.bg, borderColor: card.color + '30' }}>
            <div className="card-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {STATUS_TABS.map(t => (
            <button key={t.key} id={`whatsapp-tab-${t.key.toLowerCase()}`} onClick={() => { setTab(t.key); setPage(1); }}
              style={{ background: 'none', border: 'none', padding: '14px 24px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -1 }}>
              {t.label} {t.key === 'Pending' && stats.pending > 0 && <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 99, fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{stats.pending}</span>}
            </button>
          ))}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Customer</th><th>Request Type</th><th>Message</th><th>Submitted</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr> :
                  items.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No requests found.</td></tr> :
                  items.map((item, i) => (
                    <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.customer_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.customer_code} · {item.phone}</div>
                      </td>
                      <td><span className="badge badge-info">{item.request_type}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>{item.raw_message?.slice(0, 80) || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={`badge ${item.status === 'Approved' ? 'badge-success' : item.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>{item.status}</span>
                      </td>
                      <td>
                        {item.status === 'Pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button id={`whatsapp-approve-${item.id}`} className="btn btn-success btn-sm" onClick={() => act(item.id, 'approve')}><MdCheckCircle /> Approve</button>
                            <button id={`whatsapp-reject-${item.id}`} className="btn btn-danger btn-sm" onClick={() => act(item.id, 'reject')}><MdCancel /> Reject</button>
                          </div>
                        )}
                        {item.status !== 'Pending' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.approved_by || '—'}</span>}
                      </td>
                    </motion.tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
