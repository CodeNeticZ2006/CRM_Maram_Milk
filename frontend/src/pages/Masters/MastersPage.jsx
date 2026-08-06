import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdAdd, MdEdit, MdClose, MdRefresh, MdCategory, MdLocationOn, MdRoute, MdInventory } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TABS = [
  { key: 'products', label: '📦 Products', icon: MdCategory },
  { key: 'branches', label: '🏢 Branches', icon: MdLocationOn },
  { key: 'routes', label: '🛣️ Routes', icon: MdRoute },
  { key: 'inventory', label: '🥛 Manager App Inventory (DB2)', icon: MdInventory },
];

// ── Generic Modal ─────────────────────────────────────────────────
function MasterModal({ title, fields, values, onClose, onSubmit, loading }) {
  const [form, setForm] = useState(values || {});
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {fields.map(f => (
                <div key={f.key} className="form-group" style={f.full ? { gridColumn: '1 / -1' } : {}}>
                  <label className="form-label">{f.label}{f.required && ' *'}</label>
                  {f.type === 'select' ? (
                    <select id={`master-${f.key}`} className="form-input" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input id={`master-${f.key}`} className="form-input" type={f.type || 'text'} placeholder={f.placeholder} required={f.required}
                      value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────
function ProductsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const r = await api.get('/masters/products'); setItems(r.data.data); }
    catch { toast.error('Failed to load products.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const save = async (form) => {
    setSaving(true);
    try {
      if (modal.item) await api.put(`/masters/products/${modal.item.id}`, form);
      else await api.post('/masters/products', form);
      toast.success('Product saved!'); setModal(null); fetch();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const fields = [
    { key: 'name', label: 'Product Name', required: true, placeholder: 'e.g. Full Cream Milk' },
    { key: 'category', label: 'Category', placeholder: 'Milk' },
    { key: 'unit', label: 'Unit', required: true, placeholder: 'Litre / Packet' },
    { key: 'price_per_unit', label: 'Price per Unit (₹)', required: true, type: 'number', placeholder: '25' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button id="add-product-btn" className="btn btn-primary btn-sm" onClick={() => setModal({ item: null })}>
          <MdAdd /> Add Product
        </button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>Loading...</td></tr> :
              items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td style={{ fontWeight: 700 }}>₹{item.price_per_unit}</td>
                  <td><span className={`badge ${item.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span></td>
                  <td><button id={`edit-product-${item.id}`} className="btn btn-ghost btn-sm" onClick={() => setModal({ item })}><MdEdit /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {modal && <MasterModal title={modal.item ? 'Edit Product' : 'Add Product'} fields={fields} values={modal.item} onClose={() => setModal(null)} onSubmit={save} loading={saving} />}
      </AnimatePresence>
    </div>
  );
}

// ── Branches Tab ──────────────────────────────────────────────────
function BranchesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const r = await api.get('/masters/branches'); setItems(r.data.data); }
    catch { toast.error('Failed to load branches.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const save = async (form) => {
    setSaving(true);
    try {
      if (modal.item) await api.put(`/masters/branches/${modal.item.id}`, form);
      else await api.post('/masters/branches', form);
      toast.success('Branch saved!'); setModal(null); fetch();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const fields = [
    { key: 'branch_name', label: 'Branch Name', required: true, placeholder: 'e.g. Salem Main Branch' },
    { key: 'address', label: 'Address', placeholder: 'Full address', full: true },
    { key: 'lat', label: 'Latitude', type: 'number', placeholder: '11.6637' },
    { key: 'lng', label: 'Longitude', type: 'number', placeholder: '78.1460' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button id="add-branch-btn" className="btn btn-primary btn-sm" onClick={() => setModal({ item: null })}><MdAdd /> Add Branch</button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead><tr><th>Name</th><th>Address</th><th>Coordinates</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}>Loading...</td></tr> :
              items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.branch_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.address}</td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {item.lat && item.lng ? `${item.lat}, ${item.lng}` : '—'}
                  </td>
                  <td><span className={`badge ${item.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span></td>
                  <td><button id={`edit-branch-${item.id}`} className="btn btn-ghost btn-sm" onClick={() => setModal({ item })}><MdEdit /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {modal && <MasterModal title={modal.item ? 'Edit Branch' : 'Add Branch'} fields={fields} values={modal.item} onClose={() => setModal(null)} onSubmit={save} loading={saving} />}
      </AnimatePresence>
    </div>
  );
}

// ── Routes Tab ────────────────────────────────────────────────────
function RoutesTab() {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r, b] = await Promise.all([api.get('/masters/routes'), api.get('/masters/branches')]);
      setItems(r.data.data); setBranches(b.data.data);
    } catch { toast.error('Failed to load routes.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const save = async (form) => {
    setSaving(true);
    try {
      if (modal.item) await api.put(`/masters/routes/${modal.item.id}`, form);
      else await api.post('/masters/routes', form);
      toast.success('Route saved!'); setModal(null); fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const fields = [
    { key: 'route_name', label: 'Route Name', required: true, placeholder: 'e.g. Salem North Route' },
    { key: 'branch_id', label: 'Branch', type: 'select', options: [{ value: '', label: '— None —' }, ...branches.map(b => ({ value: b.id, label: b.branch_name }))] },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button id="add-route-btn" className="btn btn-primary btn-sm" onClick={() => setModal({ item: null })}><MdAdd /> Add Route</button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead><tr><th>Route Name</th><th>Branch</th><th>Customers</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}>Loading...</td></tr> :
              items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.route_name}</td>
                  <td>{item.branch_name || '—'}</td>
                  <td><span style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{item.customer_count}</span></td>
                  <td><span className={`badge ${item.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span></td>
                  <td><button id={`edit-route-${item.id}`} className="btn btn-ghost btn-sm" onClick={() => setModal({ item })}><MdEdit /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {modal && <MasterModal title={modal.item ? 'Edit Route' : 'Add Route'} fields={fields} values={modal.item} onClose={() => setModal(null)} onSubmit={save} loading={saving} />}
      </AnimatePresence>
    </div>
  );
}

// ── Manager App Inventory (DB2) Tab ───────────────────────────────
function InventoryTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null);
  const [form, setForm] = useState({ newStockAdded: 0, currentStock: 0 });
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory');
      setItems(res.data.data || []);
    } catch {
      toast.error('Failed to load DB2 inventory stock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInventory(); }, []);

  const openUpdateModal = (item) => {
    setModalItem(item);
    setForm({ newStockAdded: item.newStockAdded || 0, currentStock: item.currentStock || 0 });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/update', {
        inventoryItemId: modalItem.id,
        newStockAdded: form.newStockAdded,
        currentStock: form.currentStock,
      });
      toast.success(`Stock updated in Manager App DB (DB2) for ${modalItem.name}!`);
      setModalItem(null);
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update DB2 stock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          🛡️ <strong>Super Admin Stock Override (DB2 Integration)</strong> — Stock details are fetched directly from the Manager App DB (DB2 - <code>maram_milk_db</code>). Super Admin has exclusive write permissions to update stock levels in DB2.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn btn-secondary btn-sm" onClick={fetchInventory}><MdRefresh /> Refresh Stock</button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Item Name</th><th>Material / Unit</th><th>Carried Over</th><th>New Stock Added</th><th>Current Available Stock</th><th>Expected Stock</th><th>Super Admin Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}>Loading stock from DB2...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No inventory items found in DB2.</td></tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td><span className="badge badge-gray">{item.material || 'Milk'} ({item.unit})</span></td>
                <td>{item.carriedOverStock} {item.unit}</td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>+{item.newStockAdded} {item.unit}</td>
                <td style={{ fontWeight: 800, fontSize: 14, color: 'var(--success)' }}>{item.currentStock} {item.unit}</td>
                <td style={{ color: 'var(--text-muted)' }}>{item.expectedStock} {item.unit}</td>
                <td>
                  <button
                    id={`update-stock-${item.id}`}
                    className="btn btn-primary btn-sm"
                    onClick={() => openUpdateModal(item)}
                  >
                    <MdEdit /> Update Stock (DB2)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock Update Modal */}
      <AnimatePresence>
        {modalItem && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalItem(null)}>
            <motion.div className="modal" style={{ maxWidth: 480 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title">✏️ Update Stock in DB2 — {modalItem.name}</h2>
                <button className="icon-btn" onClick={() => setModalItem(null)}><MdClose /></button>
              </div>
              <form onSubmit={handleUpdate}>
                <div className="modal-body">
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">New Stock Added ({modalItem.unit})</label>
                    <input
                      id="input-new-stock"
                      type="number"
                      step="any"
                      className="form-input"
                      value={form.newStockAdded}
                      onChange={e => setForm({ ...form, newStockAdded: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Current Stock ({modalItem.unit})</label>
                    <input
                      id="input-current-stock"
                      type="number"
                      step="any"
                      className="form-input"
                      value={form.currentStock}
                      onChange={e => setForm({ ...form, currentStock: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalItem(null)}>Cancel</button>
                  <button id="save-db2-stock-btn" type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? <span className="loading-spinner" /> : '💾 Save to DB2'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Masters Page ─────────────────────────────────────────────
export default function MastersPage() {
  const [tab, setTab] = useState('products');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Masters & Inventory Management</h1>
          <p className="page-subtitle">Manage products, branches, routes, and DB2 Manager App inventory stock</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              id={`masters-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', padding: '14px 24px', fontSize: 13.5,
                fontWeight: 600, cursor: 'pointer',
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="card-body">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {tab === 'products'  && <ProductsTab />}
              {tab === 'branches'  && <BranchesTab />}
              {tab === 'routes'    && <RoutesTab />}
              {tab === 'inventory' && <InventoryTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
