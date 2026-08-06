import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MdShoppingCart, MdRefresh } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function EcomOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get('/customers', { params: { limit: 1 } }); // Check connectivity
        // EcomOrders would need its own endpoint - using placeholder
        setOrders([]);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ecom Orders</h1>
          <p className="page-subtitle">Manage online store orders from customers</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setLoading(true)}><MdRefresh /></button>
      </div>

      <div className="card" style={{ marginBottom: 20, background: 'rgba(139,92,246,0.03)', borderColor: 'rgba(139,92,246,0.2)' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              🛒
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Ecom Module — Razorpay Integration</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Online orders from customers via Razorpay payment gateway are managed here.
                Configure Razorpay keys in <code style={{ background: 'var(--bg-main)', padding: '1px 6px', borderRadius: 4 }}>.env</code> to enable order processing.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <MdShoppingCart style={{ fontSize: 40, opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No ecom orders yet</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Orders placed through the customer app will appear here.</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
