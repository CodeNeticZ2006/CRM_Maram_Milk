import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function FeedbackPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports/feedback', { params: { status: statusFilter, limit: 30 } });
        setItems(res.data.data);
      } catch { toast.error('Failed to load feedback.'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [statusFilter]);

  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer Feedback</h1>
          <p className="page-subtitle">Monitor and respond to customer feedback</p>
        </div>
        <select id="feedback-status-filter" className="form-input" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Customer</th><th>Category</th><th>Rating</th><th>Message</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr> :
                items.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No feedback found.</td></tr> :
                items.map((f, i) => (
                  <motion.tr key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.customer_name || 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.phone}</div>
                    </td>
                    <td><span className="badge badge-blue">{f.category || '—'}</span></td>
                    <td><span style={{ color: '#f59e0b', fontSize: 14 }}>{f.rating ? stars(f.rating) : '—'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 250 }}>{f.message?.slice(0, 100) || '—'}</td>
                    <td><span className={`badge ${f.status === 'Open' ? 'badge-warning' : 'badge-success'}`}>{f.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(f.created_at).toLocaleDateString('en-IN')}</td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
