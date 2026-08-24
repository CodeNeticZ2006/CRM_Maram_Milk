import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdRefresh, MdAdd, MdEdit, MdDelete, MdSearch,
  MdClose, MdDirectionsBike, MdCheckCircle, MdErrorOutline
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function LogisticsPage() {
  const [routes, setRoutes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null); // route object
  const [showDeleteModal, setShowDeleteModal] = useState(null); // route object
  const [submitting, setSubmitting] = useState(false);

  // Forms state
  const [routeForm, setRouteForm] = useState({
    route_name: '',
    branch_id: '',
    status: 'Active',
  });

  const fetchRouteData = useCallback(async () => {
    setLoading(true);
    try {
      const [routeRes, branchRes] = await Promise.all([
        api.get('/masters/routes'),
        api.get('/masters/branches').catch(() => ({ data: { data: [] } })),
      ]);

      if (routeRes.data?.success) {
        setRoutes(routeRes.data.data || []);
      }
      if (branchRes.data?.success) {
        setBranches(branchRes.data.data || []);
      }
    } catch {
      toast.error('Failed to load routes data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRouteData();
  }, [fetchRouteData]);

  // Open Add Modal
  const openAddModal = () => {
    setRouteForm({ route_name: '', branch_id: branches[0]?.id || '', status: 'Active' });
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (route) => {
    setShowEditModal(route);
    setRouteForm({
      route_name: route.route_name || '',
      branch_id: route.branch_id || '',
      status: route.status || 'Active',
    });
  };

  // Handle Create Route
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!routeForm.route_name.trim()) return toast.error('Route Name is required.');
    setSubmitting(true);
    try {
      const res = await api.post('/masters/routes', routeForm);
      if (res.data?.success) {
        toast.success(`Route "${routeForm.route_name}" created successfully!`);
        setShowAddModal(false);
        fetchRouteData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create route.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Route
  const handleUpdateRoute = async (e) => {
    e.preventDefault();
    if (!routeForm.route_name.trim()) return toast.error('Route Name is required.');
    setSubmitting(true);
    try {
      const res = await api.put(`/masters/routes/${showEditModal.id}`, routeForm);
      if (res.data?.success) {
        toast.success(`Route updated successfully!`);
        setShowEditModal(null);
        fetchRouteData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update route.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Route
  const handleDeleteRoute = async () => {
    setSubmitting(true);
    try {
      const res = await api.delete(`/masters/routes/${showDeleteModal.id}`);
      if (res.data?.success) {
        toast.success(`Route "${showDeleteModal.route_name}" deleted.`);
        setShowDeleteModal(null);
        fetchRouteData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete route.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRoutes = routes.filter(r =>
    (r?.route_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r?.branch_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Route Management</h1>
          <p className="page-subtitle">Configure, edit, and manage all distribution routes</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchRouteData}
            disabled={loading}
          >
            <MdRefresh className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <MdAdd style={{ fontSize: 18 }} /> Add New Route
          </button>
        </div>
      </div>

      {/* KPI & Search Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Configured Routes</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>{routes.length}</div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Routes</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>
                {routes.filter(r => (r.status || 'Active') === 'Active').length}
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', width: 280 }}>
            <MdSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search route name or branch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%', fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      {/* Routes Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">🛣️ Configured Routes ({filteredRoutes.length})</h3>
          <span className="badge badge-blue">{filteredRoutes.length} Routes Listed</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>S.NO</th>
                  <th>ROUTE NAME</th>
                  <th>BRANCH / ZONE</th>
                  <th>CUSTOMERS</th>
                  <th>STATUS</th>
                  <th>SOURCE</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36 }}>Loading routes data...</td></tr>
                ) : filteredRoutes.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>No routes found.</td></tr>
                ) : (
                  filteredRoutes.map((r, idx) => (
                    <tr key={r.id || idx}>
                      <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{r.route_name}</td>
                      <td style={{ fontSize: 13 }}>{r.branch_name || '—'}</td>
                      <td>
                        <span style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                          {r.customer_count || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${(r.status || 'Active') === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                          {r.status || 'Active'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ fontSize: 10, fontFamily: 'monospace' }}>
                          {r.source || 'DB1'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => openEditModal(r)}
                            title="Edit Route"
                          >
                            <MdEdit style={{ color: 'var(--primary)' }} /> Edit
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
                            onClick={() => setShowDeleteModal(r)}
                            title="Delete Route"
                          >
                            <MdDelete /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Route Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
            <motion.div className="modal" style={{ maxWidth: 440 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdAdd style={{ color: 'var(--primary)' }} /> Add New Route
                </h2>
                <button className="icon-btn" onClick={() => setShowAddModal(false)}><MdClose /></button>
              </div>
              <form onSubmit={handleCreateRoute}>
                <div className="modal-body">
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Route Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. West Mambalam 3"
                      value={routeForm.route_name}
                      onChange={e => setRouteForm({ ...routeForm, route_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Branch / Zone</label>
                    <select
                      className="form-input"
                      value={routeForm.branch_id}
                      onChange={e => setRouteForm({ ...routeForm, branch_id: e.target.value })}
                    >
                      <option value="">— Select Branch —</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.branch_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={routeForm.status}
                      onChange={e => setRouteForm({ ...routeForm, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Create Route'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Route Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditModal(null)}>
            <motion.div className="modal" style={{ maxWidth: 440 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdEdit style={{ color: 'var(--primary)' }} /> Edit Route — {showEditModal.route_name}
                </h2>
                <button className="icon-btn" onClick={() => setShowEditModal(null)}><MdClose /></button>
              </div>
              <form onSubmit={handleUpdateRoute}>
                <div className="modal-body">
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Route Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={routeForm.route_name}
                      onChange={e => setRouteForm({ ...routeForm, route_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Branch / Zone</label>
                    <select
                      className="form-input"
                      value={routeForm.branch_id}
                      onChange={e => setRouteForm({ ...routeForm, branch_id: e.target.value })}
                    >
                      <option value="">— Select Branch —</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.branch_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={routeForm.status}
                      onChange={e => setRouteForm({ ...routeForm, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Update Route'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(null)}>
            <motion.div className="modal" style={{ maxWidth: 420 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdDelete /> Confirm Delete Route
                </h2>
                <button className="icon-btn" onClick={() => setShowDeleteModal(null)}><MdClose /></button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>
                  Are you sure you want to delete route <strong>{showDeleteModal.route_name}</strong>?
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
                  This action cannot be undone. Customers linked to this route will need to be re-assigned.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowDeleteModal(null)} disabled={submitting}>Cancel</button>
                <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={handleDeleteRoute} disabled={submitting}>
                  {submitting ? 'Deleting...' : 'Yes, Delete Route'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
