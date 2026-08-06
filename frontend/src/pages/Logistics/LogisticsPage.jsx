import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MdRefresh, MdLocalShipping, MdPerson, MdDirectionsBike } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function LogisticsPage() {
  const [data, setData] = useState(null);
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogistics = async () => {
    setLoading(true);
    try {
      const [res, dpRes] = await Promise.all([
        api.get('/reports/logistics').catch(() => ({ data: { data: null } })),
        api.get('/access-control/delivery-persons').catch(() => ({ data: { data: [] } })),
      ]);
      setData(res.data.data);
      setDeliveryPersons(dpRes.data.data || []);
    } catch {
      toast.error('Failed to load logistics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogistics(); }, []);

  const deliveryStatuses = data?.today_deliveries || [];
  const totalToday = deliveryStatuses.reduce((s, d) => s + parseInt(d.count), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Logistics & Route Dispatches</h1>
          <p className="page-subtitle">Delivery Partner (DP) assignments, route tracking, and stock dispatch</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchLogistics}><MdRefresh /> Refresh</button>
      </div>

      {/* DB2 Manager App Sync Banner */}
      <div className="card" style={{ marginBottom: 20, background: 'rgba(59,130,246,0.03)', borderColor: 'rgba(59,130,246,0.2)' }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 22 }}>
              <MdDirectionsBike />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Manager App & Delivery Person (DP) Integration (DB2)</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Delivery Person (DP) profiles, vehicle registrations, and attendance are synced in real time from the Manager App DB (DB2 - <code>maram_milk_db</code>).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Delivery Status */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {deliveryStatuses.map(ds => {
          const colors = { Delivered: '#10b981', Pending: '#f59e0b', Failed: '#ef4444', Skipped: '#94a3b8' };
          const bgs = { Delivered: 'rgba(16,185,129,0.06)', Pending: 'rgba(245,158,11,0.06)', Failed: 'rgba(239,68,68,0.06)', Skipped: 'rgba(148,163,184,0.06)' };
          return (
            <div key={ds.status} className="card" style={{ flex: 1, minWidth: 120, background: bgs[ds.status], borderColor: colors[ds.status] + '30' }}>
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: colors[ds.status] }}>{ds.count}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{ds.status}</div>
              </div>
            </div>
          );
        })}
        <div className="card" style={{ flex: 1, minWidth: 120 }}>
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{totalToday}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Deliveries Today</div>
          </div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 120 }}>
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6' }}>{deliveryPersons.length}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active DPs (DB2)</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Delivery Persons (DPs) from DB2 */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">🛵 Delivery Persons (DPs) — Live DB2 Data</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>DP Code</th><th>Name</th><th>Mobile</th><th>Vehicle No</th><th>Petrol Bal.</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr> :
                    deliveryPersons.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No DPs registered in DB2.</td></tr> :
                    deliveryPersons.slice(0, 10).map(dp => (
                      <tr key={dp.id}>
                        <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{dp.dpCode || 'DP-001'}</span></td>
                        <td style={{ fontWeight: 600 }}>{dp.name}</td>
                        <td style={{ fontSize: 12 }}>{dp.mobileNumber || '—'}</td>
                        <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{dp.vehicleNumber || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>₹{dp.petrolBalance || 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Routes */}
        <div className="card">
          <div className="card-header"><h3 className="card-title">🛣️ Configured Routes ({data?.routes?.length || 0})</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Route</th><th>Branch</th><th>Customers</th><th>Status</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr> :
                    (data?.routes || []).map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.route_name}</td>
                        <td style={{ fontSize: 12 }}>{r.branch_name || '—'}</td>
                        <td><span style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{r.customer_count}</span></td>
                        <td><span className={`badge ${r.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{r.status}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
