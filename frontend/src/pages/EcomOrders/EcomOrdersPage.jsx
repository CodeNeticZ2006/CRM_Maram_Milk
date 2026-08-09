import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MdShoppingCart, MdRefresh, MdVerified, MdLocalShipping, MdLock, MdCheckCircle, MdStorefront } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function EcomOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        await api.get('/customers', { params: { limit: 1 } });
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
          <p className="page-subtitle">On-demand sub-product store orders for active monthly subscribers</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setLoading(true)}>
          <MdRefresh /> Refresh
        </button>
      </div>

      {/* Business Logic Rule Card */}
      <div className="card" style={{ marginBottom: 20, background: 'rgba(139,92,246,0.03)', borderColor: 'rgba(139,92,246,0.2)' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              <MdStorefront />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                Sub-Products & Third-Party DP Sourcing
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <MdVerified style={{ fontSize: 13 }} /> Active Subscription Required
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                Sub-products (Curd, Ghee, Butter, Paneer, etc.) are sourced from <strong>third-party delivery partner suppliers</strong> and delivered on-demand.
                <span style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: 6 }}>
                  Strict Rule: Customers can only place e-commerce sub-product orders if they hold an active milk subscription for the current month.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Sub-Products</th>
                  <th>DP Supplier Sourced</th>
                  <th>Subscription Verification</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>Loading ecom orders...</td></tr>
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                      <MdShoppingCart style={{ fontSize: 44, opacity: 0.3, display: 'block', margin: '0 auto 12px', color: 'var(--primary)' }} />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>No on-demand sub-product orders yet</div>
                      <div style={{ fontSize: 12.5, marginTop: 4 }}>
                        Sub-product purchases placed by active monthly subscribers will appear here.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
