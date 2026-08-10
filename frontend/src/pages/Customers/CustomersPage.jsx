import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdAdd, MdSearch, MdClose, MdEdit, MdDelete,
  MdCheckCircle, MdCancel, MdRefresh, MdOpenInNew, MdMap,
  MdDirectionsBike, MdWarning,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

// ── Status Badge ──────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Active:    'badge badge-success',
    Inactive:  'badge badge-danger',
    Suspended: 'badge badge-warning',
  };
  return <span className={map[status] || 'badge badge-gray'}>{status}</span>;
};

// ── Delete Confirm Modal ──────────────────────────────────────────
function DeleteConfirmModal({ customer, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.delete(`/customers/${customer.id}`);
      toast.success(`Customer ${customer.customer_code} deleted.`);
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" style={{ maxWidth: 440 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdWarning /> Delete Customer
          </h2>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{customer.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{customer.customer_code} · {customer.phone}</div>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0 }}>
            This action is <strong style={{ color: 'var(--danger)' }}>permanent</strong>. The customer, their wallet, and all notes will be removed. Subscriptions and ledger history may still reference this record.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            id="confirm-delete-btn"
            type="button"
            className="btn btn-danger"
            disabled={loading}
            onClick={handleDelete}
          >
            {loading ? <span className="loading-spinner" /> : <><MdDelete /> Delete Permanently</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Add/Edit Customer Modal ───────────────────────────────────────
function CustomerModal({ customer, routes, onClose, onSaved }) {
  const isEdit = !!customer;
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    whatsapp_number: customer?.whatsapp_number || '',
    address: customer?.address || '',
    lat: customer?.lat || '',
    lng: customer?.lng || '',
    maps_url: customer?.maps_url || '',
    assigned_route_id: customer?.assigned_route_id || '',
    enquiry_source: customer?.enquiry_source || 'Direct',
    status: customer?.status || 'Active',
  });
  const [loading, setLoading] = useState(false);
  const [routeDps, setRouteDps] = useState([]);
  const [dpsLoading, setDpsLoading] = useState(false);

  // When route changes, fetch DPs assigned to that route
  useEffect(() => {
    if (!form.assigned_route_id) { setRouteDps([]); return; }
    const selectedRoute = routes.find(r => String(r.id) === String(form.assigned_route_id));
    if (!selectedRoute) { setRouteDps([]); return; }

    setDpsLoading(true);
    api.get('/masters/dps-by-route', { params: { route_name: selectedRoute.route_name } })
      .then(res => setRouteDps(res.data.data || []))
      .catch(() => setRouteDps([]))
      .finally(() => setDpsLoading(false));
  }, [form.assigned_route_id, routes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error('Name and phone are required.');
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/customers/${customer.id}`, form);
        toast.success('Customer updated successfully!');
      } else {
        await api.post('/customers', form);
        toast.success('Customer created successfully!');
      }
      await onSaved(); // ← await so table refreshes before modal closes
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer.');
    } finally {
      setLoading(false);
    }
  };

  const f = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" style={{ maxWidth: 620 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? '✏️ Edit Customer' : '➕ Add New Customer'}</h2>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input id="customer-name" className="form-input" placeholder="Customer name" {...f('name')} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input id="customer-phone" className="form-input" placeholder="+91 9999999999" {...f('phone')} />
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp Number</label>
                <input id="customer-whatsapp" className="form-input" placeholder="Same as phone if empty" {...f('whatsapp_number')} />
              </div>
              <div className="form-group">
                <label className="form-label">Enquiry Source</label>
                <select id="customer-source" className="form-input" {...f('enquiry_source')}>
                  {['Direct', 'WhatsApp', 'Referral', 'Social Media', 'Other'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <textarea id="customer-address" className="form-input" rows={2} placeholder="Full delivery address" {...f('address')} style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input id="customer-lat" className="form-input" type="number" step="any" placeholder="13.0574" {...f('lat')} />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input id="customer-lng" className="form-input" type="number" step="any" placeholder="80.2700" {...f('lng')} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Google Maps URL</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    id="customer-maps-url"
                    className="form-input"
                    placeholder="https://maps.app.goo.gl/..."
                    style={{ flex: 1 }}
                    {...f('maps_url')}
                  />
                  {form.maps_url && (
                    <a
                      href={form.maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      title="Open in Google Maps"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <MdMap /> Open
                    </a>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Assign Route</label>
                <select id="customer-route" className="form-input" {...f('assigned_route_id')}>
                  <option value="">— Unassigned —</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.route_name}</option>)}
                </select>
              </div>
              {isEdit && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select id="customer-status" className="form-input" {...f('status')}>
                    {['Active', 'Inactive', 'Suspended'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* ── Delivery Persons Panel ── */}
              {form.assigned_route_id && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{
                    background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: 10, padding: '12px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                      <MdDirectionsBike style={{ fontSize: 16 }} />
                      Delivery Person{routeDps.length !== 1 ? 's' : ''} on this Route
                    </div>
                    {dpsLoading ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading delivery persons…</div>
                    ) : routeDps.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No delivery persons assigned to this route yet.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                        {routeDps.map(dp => (
                          <div key={dp.id} style={{
                            background: 'var(--bg-card)', borderRadius: 8, padding: '8px 12px',
                            display: 'flex', flexDirection: 'column', gap: 2,
                          }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{dp.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dp.dpCode} · {dp.vehicle || '—'}</div>
                            {dp.phone && dp.phone !== '' && (
                              <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>{dp.phone}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="customer-save-btn" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : (isEdit ? 'Save Changes' : 'Create Customer')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Customer Detail Drawer ────────────────────────────────────────
function CustomerDrawer({ customerId, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [noteText, setNoteText] = useState('');

  const loadCustomer = useCallback(async () => {
    try {
      const res = await api.get(`/customers/${customerId}`);
      setData(res.data.data);
    } catch { toast.error('Failed to load customer.'); }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/customers/${customerId}/notes`, { note: noteText });
      setNoteText('');
      await loadCustomer();
      toast.success('Note added.');
    } catch { toast.error('Failed to add note.'); }
  };

  const toggleStatus = async (status) => {
    try {
      await api.patch(`/customers/${customerId}/status`, { status });
      await loadCustomer();
      onRefresh();
      toast.success(`Customer ${status}.`);
    } catch { toast.error('Failed to update status.'); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          {loading ? <h2 className="modal-title">Loading...</h2> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="admin-avatar" style={{ width: 42, height: 42, fontSize: 16 }}>
                {data?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="modal-title">{data?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data?.customer_code} · {data?.phone}</div>
              </div>
              <StatusBadge status={data?.status} />
            </div>
          )}
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>

        {!loading && data && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, padding: '0 28px', borderBottom: '1px solid var(--border)' }}>
              {['info', 'subscriptions', 'wallet', 'ledger', 'notes'].map(tab => (
                <button
                  key={tab}
                  id={`customer-tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'none', border: 'none', padding: '12px 18px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              {/* INFO TAB */}
              {activeTab === 'info' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'Customer Code', value: data.customer_code },
                    { label: 'Phone', value: data.phone },
                    { label: 'WhatsApp', value: data.whatsapp_number },
                    { label: 'Route', value: data.route_name || '—' },
                    { label: 'Source', value: data.enquiry_source || '—' },
                    { label: 'Joined', value: new Date(data.created_at).toLocaleDateString('en-IN') },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</div>
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Address</div>
                    <div style={{ fontSize: 14 }}>{data.address || '—'}</div>
                  </div>
                  {data.maps_url && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Google Maps Location</div>
                      <a
                        href={data.maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <MdMap /> Open in Google Maps
                      </a>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 8 }}>
                    {data.status !== 'Active' && (
                      <button className="btn btn-success btn-sm" onClick={() => toggleStatus('Active')}>
                        <MdCheckCircle /> Activate
                      </button>
                    )}
                    {data.status === 'Active' && (
                      <button className="btn btn-danger btn-sm" onClick={() => toggleStatus('Inactive')}>
                        <MdCancel /> Deactivate
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* SUBSCRIPTIONS TAB */}
              {activeTab === 'subscriptions' && (
                <div>
                  {data.subscriptions?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No subscriptions found.</p>
                  ) : (
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Product</th><th>Qty</th><th>Frequency</th><th>Price/Unit</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.subscriptions?.map(s => (
                            <tr key={s.id}>
                              <td>{s.product_name}</td>
                              <td>{s.quantity} {s.unit}</td>
                              <td>{s.frequency}</td>
                              <td>₹{s.price_per_unit}</td>
                              <td><StatusBadge status={s.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* WALLET TAB */}
              {activeTab === 'wallet' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                    {[
                      { label: 'Current Balance', value: `₹${parseFloat(data.wallet?.balance || 0).toLocaleString('en-IN')}`, color: data.wallet?.balance < 0 ? 'var(--danger)' : 'var(--success)' },
                      { label: 'Total Recharged', value: `₹${parseFloat(data.wallet?.total_recharged || 0).toLocaleString('en-IN')}`, color: 'var(--primary)' },
                      { label: 'Total Debited', value: `₹${parseFloat(data.wallet?.total_debited || 0).toLocaleString('en-IN')}`, color: 'var(--warning)' },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: 'center', background: 'var(--bg-main)', borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LEDGER TAB */}
              {activeTab === 'ledger' && (
                <div className="table-wrapper">
                  {data.ledger?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No ledger entries.</p>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
                      </thead>
                      <tbody>
                        {data.ledger?.map(l => (
                          <tr key={l.id}>
                            <td>{new Date(l.date).toLocaleDateString('en-IN')}</td>
                            <td>{l.description}</td>
                            <td style={{ color: l.debit > 0 ? 'var(--danger)' : '' }}>{l.debit > 0 ? `₹${l.debit}` : '—'}</td>
                            <td style={{ color: l.credit > 0 ? 'var(--success)' : '' }}>{l.credit > 0 ? `₹${l.credit}` : '—'}</td>
                            <td style={{ fontWeight: 700 }}>₹{l.balance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* NOTES TAB */}
              {activeTab === 'notes' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input
                      id="customer-note-input"
                      className="form-input"
                      style={{ flex: 1 }}
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addNote()}
                    />
                    <button id="customer-note-add" className="btn btn-primary btn-sm" onClick={addNote}>Add</button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Press Enter or click Add to save a note.</p>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const limit = 20;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, search, status: statusFilter, route_id: routeFilter };
      const res = await api.get('/customers', { params });
      setCustomers(res.data.data);
      setTotal(res.data.total);
    } catch { toast.error('Failed to load customers.'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, routeFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    api.get('/masters/routes').then(r => setRoutes(r.data.data)).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer CRM</h1>
          <p className="page-subtitle">{total.toLocaleString()} customers total</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button id="add-customer-btn" className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <MdAdd /> Add Customer
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="input-with-icon" style={{ flex: 1, minWidth: 220 }}>
            <MdSearch className="input-icon" />
            <input
              id="customer-search"
              className="form-input"
              style={{ paddingLeft: 38, width: '100%' }}
              placeholder="Search by name, phone, or code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            id="customer-route-filter"
            className="form-input"
            style={{ width: 180 }}
            value={routeFilter}
            onChange={(e) => { setRouteFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Routes</option>
            {routes.map(r => (
              <option key={r.id} value={r.id}>{r.route_name}</option>
            ))}
          </select>
          <select
            id="customer-status-filter"
            className="form-input"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>
          <button id="customer-refresh-btn" className="btn btn-secondary btn-sm" onClick={fetchCustomers}>
            <MdRefresh /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Route</th>
                <th>Wallet</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <span className="loading-spinner" style={{ display: 'inline-block', borderTopColor: 'var(--primary)', borderColor: 'var(--border)' }} />
                </td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No customers found.
                </td></tr>
              ) : customers.map((c, idx) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{c.customer_code}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                        {c.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                        {c.address && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.address.slice(0, 40)}{c.address.length > 40 ? '…' : ''}</div>}
                      </div>
                    </div>
                  </td>
                  {/* Phone column — always reads from the fetched list row, never stale */}
                  <td style={{ fontSize: 13 }}>{c.phone}</td>
                  <td><span style={{ fontSize: 12, background: 'rgba(59,130,246,0.08)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{c.route_name || '—'}</span></td>
                  <td style={{ fontWeight: 700, color: parseFloat(c.wallet_balance) < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                    ₹{parseFloat(c.wallet_balance || 0).toLocaleString('en-IN')}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        id={`customer-view-${c.id}`}
                        className="btn btn-ghost btn-sm"
                        title="View Details"
                        onClick={() => setDetailId(c.id)}
                      >
                        <MdOpenInNew />
                      </button>
                      <button
                        id={`customer-edit-${c.id}`}
                        className="btn btn-ghost btn-sm"
                        title="Edit"
                        onClick={() => setEditCustomer(c)}
                      >
                        <MdEdit />
                      </button>
                      <button
                        id={`customer-delete-${c.id}`}
                        className="btn btn-ghost btn-sm"
                        title="Delete"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setDeleteTarget(c)}
                      >
                        <MdDelete />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAdd && <CustomerModal routes={routes} onClose={() => setShowAdd(false)} onSaved={fetchCustomers} />}
        {editCustomer && <CustomerModal customer={editCustomer} routes={routes} onClose={() => setEditCustomer(null)} onSaved={fetchCustomers} />}
        {detailId && <CustomerDrawer customerId={detailId} onClose={() => setDetailId(null)} onRefresh={fetchCustomers} />}
        {deleteTarget && (
          <DeleteConfirmModal
            customer={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={fetchCustomers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
