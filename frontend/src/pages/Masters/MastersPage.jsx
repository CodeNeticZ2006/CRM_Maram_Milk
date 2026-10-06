import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdAdd, MdEdit, MdClose, MdCategory, MdRoute,
  MdSensors, MdStorage, MdSync, MdLocalGasStation, MdDelete, MdArchive, MdWarning
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TABS = [
  { key: 'products', label: 'Products', icon: MdCategory },
  { key: 'routes', label: 'Routes', icon: MdRoute },
];

// ── Generic Modal ─────────────────────────────────────────────────
function MasterModal({ title, fields, values, onClose, onSubmit, loading, submitText = 'Save' }) {
  const [form, setForm] = useState(values || {});
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" style={{ maxWidth: 680, width: '95%', padding: '24px 28px' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header" style={{ marginBottom: 20 }}>
          <h2 className="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <div className="modal-body" style={{ padding: '4px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
              {fields.map(f => (
                <div key={f.key} className="form-group" style={f.full ? { gridColumn: '1 / -1' } : {}}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: 6 }}>{f.label}{f.required && ' *'}</label>
                  {f.type === 'select' ? (
                    <select id={`master-${f.key}`} className="form-input" style={{ height: 44 }} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input id={`master-${f.key}`} className="form-input" style={{ height: 44 }} type={f.type || 'text'} placeholder={f.placeholder} required={f.required}
                      value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer" style={{ marginTop: 24, paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }} disabled={loading}>
              {loading ? <span className="loading-spinner" /> : submitText}
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { item, archiveMode }
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteClick = async (item) => {
    // We'll let the backend determine archive vs hard delete — just confirm
    setDeleteConfirm({ item });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm?.item) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/masters/products/${deleteConfirm.item.id}`);
      if (res.data.archived) {
        toast.success(`"${deleteConfirm.item.name}" archived (it has existing records).`);
      } else {
        toast.success(`"${deleteConfirm.item.name}" permanently deleted.`);
      }
      setDeleteConfirm(null);
      fetch();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to delete.'); }
    finally { setDeleting(false); }
  };

  const fields = [
    { key: 'name', label: 'Product Name', required: true, placeholder: 'e.g. Curd Pot - 500ml' },
    { key: 'category', label: 'Category', type: 'select', options: [{ value: 'Milk', label: 'Milk' }, { value: 'AdHoc', label: 'AdHoc' }] },
    { key: 'packing_type', label: 'Packing Type', type: 'select', options: [{ value: 'Bottle', label: 'Bottle' }, { value: 'Packet', label: 'Packet' }, { value: 'Can', label: 'Can' }, { value: 'Other', label: 'Other' }] },
    { key: 'unit', label: 'Unit / Size', required: true, placeholder: 'e.g. 500ml / 1L / 500gm' },
    { key: 'price_per_unit', label: 'Price per Unit (₹)', required: true, type: 'number', placeholder: '50' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
  ];

  const filteredItems = items.filter(i => {
    if (categoryFilter === 'milk') return (i.category || '').toLowerCase() === 'milk';
    if (categoryFilter === 'adhoc') return (i.category || '').toLowerCase() === 'adhoc';
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Category Filter:</label>
          <select
            id="product-master-category-filter"
            className="form-input"
            style={{ width: 160, padding: '6px 12px', fontSize: 13 }}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Products</option>
            <option value="milk">Milk Products</option>
            <option value="adhoc">AdHoc Products</option>
          </select>
        </div>
        <button id="add-product-btn" className="btn btn-primary btn-sm" onClick={() => setModal({ item: null })}>
          <MdAdd /> Add Product
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Packing Type</th><th>Unit / Size</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}>Loading...</td></tr> :
              filteredItems.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No products found for selected category.</td></tr> :
              filteredItems.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td>
                    <span className={`badge ${item.category === 'AdHoc' ? 'badge-warning' : 'badge-blue'}`}>
                      {item.category || 'Milk'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-gray" style={{ fontWeight: 600 }}>
                      {item.packing_type || ((item.unit || '').toLowerCase().includes('packet') || (item.name || '').toLowerCase().includes('packet') ? 'Packet' : 'Bottle')}
                    </span>
                  </td>
                  <td>{item.unit}</td>
                  <td style={{ fontWeight: 700 }}>₹{item.price_per_unit}</td>
                  <td><span className={`badge ${item.status === 'Active' ? 'badge-success' : item.status === 'Archived' ? 'badge-warning' : 'badge-danger'}`}>{item.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button id={`edit-product-${item.id}`} className="btn btn-ghost btn-sm" title="Edit" onClick={() => setModal({ item })}><MdEdit /></button>
                      <button id={`delete-product-${item.id}`} className="btn btn-danger btn-sm" title="Delete" onClick={() => handleDeleteClick(item)}><MdDelete /></button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
                <MdWarning /> Delete Product
              </h2>
              <button className="icon-btn" onClick={() => setDeleteConfirm(null)}><MdClose /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <strong>"{ deleteConfirm.item.name }"</strong>?
              </p>
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <MdArchive style={{ marginTop: 2, flexShrink: 0, color: '#d97706' }} />
                <span>If this product has been used in any subscriptions or delivery records, it will be <strong>archived</strong> instead of permanently deleted — so historical data remains intact.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                id={`delete-product-confirm-${deleteConfirm.item.id}`}
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <span className="loading-spinner" /> : <><MdDelete /> Delete / Archive</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <MasterModal
            title={modal.item ? 'Edit Product' : 'Add Product'}
            submitText={modal.item ? 'Save Product' : 'Add Product'}
            fields={fields}
            values={modal.item}
            onClose={() => setModal(null)}
            onSubmit={save}
            loading={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Routes Tab ────────────────────────────────────────────────────
function RoutesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const routeRes = await api.get('/masters/routes');
      setItems(routeRes.data.data || []);
    } catch (e) {
      toast.error('Failed to load routes from DB2.');
    } finally {
      setLoading(false);
    }
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

  const confirmDelete = async () => {
    if (!deleteConfirm?.item) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/masters/routes/${deleteConfirm.item.id}`);
      if (res.data?.archived) {
        toast.success(res.data.message || `Route "${deleteConfirm.item.route_name}" archived as Inactive.`);
      } else {
        toast.success(res.data?.message || `Route "${deleteConfirm.item.route_name}" deleted.`);
      }
      setDeleteConfirm(null);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete route.');
    } finally {
      setDeleting(false);
    }
  };

  const fields = [
    { key: 'route_name', label: 'Route Name', required: true, placeholder: 'e.g. Chennai North Route' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] },
  ];

  return (
    <div>
      <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MdSensors style={{ color: 'var(--primary)', fontSize: 18 }} />
        <span><strong>Routes fetched live from DB2 (maram_milk_db)</strong> — active delivery zones from the Manager App, including litres dispatched and petrol allowance per route.</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button id="add-route-btn" className="btn btn-primary btn-sm" onClick={() => setModal({ item: null })}><MdAdd /> Add Route</button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Route Name</th><th>Zone</th><th>Customers</th><th>Litres Dispatched</th><th>Petrol Allowance</th><th>Status</th><th>Source</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>Loading routes from DB2...</td></tr> :
              items.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No routes found.</td></tr> :
              items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.route_name}</td>
                  <td><span className="badge badge-gray">{item.branch_name || 'Zone A'}</span></td>
                  <td><span style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{item.customer_count ?? 0}</span></td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.litres ?? 0} L</td>
                  <td>
                    {item.default_petrol_allowance ? (
                      <span style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MdLocalGasStation /> ₹{item.default_petrol_allowance}
                      </span>
                    ) : '—'}
                  </td>
                  <td><span className={`badge ${item.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span></td>
                  <td>
                    <span className={`badge ${item.source === 'DB2' ? 'badge-blue' : item.source === 'DB1' ? 'badge-gray' : 'badge-warning'}`} style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {item.source === 'DB2' ? <><MdSensors /> Live DB2</> : item.source === 'DB1' ? <><MdStorage /> CRM</> : <><MdSync /> Cached</>}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button id={`edit-route-${item.id}`} className="btn btn-ghost btn-sm" title="Edit Route" onClick={() => setModal({ item })}><MdEdit /></button>
                    <button
                      id={`delete-route-${item.id}`}
                      className="btn btn-ghost btn-sm"
                      title="Delete Route"
                      style={{ color: '#ef4444' }}
                      onClick={() => setDeleteConfirm({ item })}
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Route Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
                <MdWarning /> Delete Route
              </h2>
              <button className="icon-btn" onClick={() => setDeleteConfirm(null)}><MdClose /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                Are you sure you want to delete route <strong>"{deleteConfirm.item.route_name}"</strong>?
              </p>
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: 12, fontSize: 13, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <MdArchive style={{ marginTop: 2, flexShrink: 0, color: '#d97706' }} />
                <span>If any customers or subscriptions are actively mapped to this route, it will be <strong>archived as Inactive</strong> so historical delivery records remain accurate.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                id={`delete-route-confirm-${deleteConfirm.item.id}`}
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? <span className="loading-spinner" /> : <><MdDelete /> Delete Route</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <MasterModal
            title={modal.item ? 'Edit Route' : 'Add Route'}
            submitText={modal.item ? 'Save Route' : 'Add Route'}
            fields={fields}
            values={modal.item}
            onClose={() => setModal(null)}
            onSubmit={save}
            loading={saving}
          />
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
          <h1 className="page-title">Masters & Product Management</h1>
          <p className="page-subtitle">Manage product catalog definitions and DB2 delivery routes</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
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
                  display: 'flex', alignItems: 'center', gap: 8
                }}
              >
                <Icon style={{ fontSize: 18 }} /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="card-body">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {tab === 'products' && <ProductsTab />}
              {tab === 'routes'   && <RoutesTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
