import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function SmsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports/sms-log', { params: { limit: 50 } });
        setItems(res.data.data);
      } catch { toast.error('Failed to load SMS log.'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const typeColors = { SMS: 'badge-blue', WhatsApp: 'badge-success', Push: 'badge-info' };
  const statusColors = { Pending: 'badge-warning', Sent: 'badge-success', Failed: 'badge-danger' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">SMS / Notifications</h1>
          <p className="page-subtitle">Notification history and delivery status</p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Recipient</th><th>Type</th><th>Message</th><th>Status</th><th>Sent At</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr> :
                items.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No notifications yet.</td></tr> :
                items.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}>
                    <td style={{ fontSize: 13 }}>{s.phone}</td>
                    <td><span className={`badge ${typeColors[s.type] || 'badge-gray'}`}>{s.type}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 300 }}>{s.message?.slice(0, 100) || '—'}</td>
                    <td><span className={`badge ${statusColors[s.status] || 'badge-gray'}`}>{s.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.sent_at ? new Date(s.sent_at).toLocaleString('en-IN') : '—'}</td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
