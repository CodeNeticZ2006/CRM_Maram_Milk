import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdCheckCircle, MdCancel, MdRefresh, MdSearch } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TABS = [
  { key: 'hold', label: '⏸️ Hold Requests' },
  { key: 'vacation', label: '🏖️ Vacation Requests' },
  { key: 'change', label: '✏️ Change Requests' },
];

function StatusBadge({ status }) {
  const map = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

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
      setItems(r.data.data); setTotal(r.data.total);
    } catch { toast.error('Failed to load.'); }
    finally { setLoading(false); }
  }, [tab, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const act = async (id, action) => {
    try {
      await api.patch(`/pause/${tab}/${id}`, { action });
      toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'}.`);
      fetch(); onRefresh();
    } catch { toast.error('Failed.'); }
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
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No requests found.</td></tr>
            ) : items.map((item, i) => (
              <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.customer_code} · {item.phone}</div>
                </td>
                {tab === 'hold' && <>
                  <td>{new Date(item.hold_from).toLocaleDateString('en-IN')}</td>
                  <td>{new Date(item.hold_to).toLocaleDateString('en-IN')}</td>
                </>}
                {tab === 'vacation' && <>
                  <td>{new Date(item.start_date).toLocaleDateString('en-IN')}</td>
                  <td>{new Date(item.end_date).toLocaleDateString('en-IN')}</td>
                </>}
                {tab === 'change' && <>
                  <td><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>{item.request_type}</span></td>
                  <td style={{ fontSize: 12 }}>{item.old_value || '—'}</td>
                </>}
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {tab === 'change' ? (item.new_value || '—') : (item.reason || '—')}
                </td>
                <td><StatusBadge status={item.status} /></td>
                <td>
                  {item.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button id={`pause-approve-${item.id}`} className="btn btn-success btn-sm" onClick={() => act(item.id, 'approve')}>
                        <MdCheckCircle /> Approve
                      </button>
                      <button id={`pause-reject-${item.id}`} className="btn btn-danger btn-sm" onClick={() => act(item.id, 'reject')}>
                        <MdCancel /> Reject
                      </button>
                    </div>
                  )}
                  {item.status !== 'Pending' && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>by {item.approved_by || '—'}</span>
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

export default function PausePage() {
  const [tab, setTab] = useState('hold');
  const [summary, setSummary] = useState({ hold: 0, vacation: 0, change: 0 });

  const fetchSummary = async () => {
    try { const r = await api.get('/pause/summary'); setSummary(r.data.data); }
    catch { /* silent */ }
  };

  useEffect(() => { fetchSummary(); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pause Management</h1>
          <p className="page-subtitle">Manage hold, vacation, and change requests</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchSummary}><MdRefresh /> Refresh</button>
      </div>

      {/* Tab Nav with badges */}
      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => {
            const count = summary[t.key] || 0;
            return (
              <button
                key={t.key}
                id={`pause-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                style={{
                  background: 'none', border: 'none', padding: '14px 24px',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
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
    </div>
  );
}
