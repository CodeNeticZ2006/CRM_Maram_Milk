import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdClose, MdSecurity, MdVpnKey, MdCheckCircle, MdPersonAdd,
  MdRefresh, MdShield, MdPhoneIphone, MdTwoWheeler,
  MdFlashOn, MdEdit, MdSave, MdVisibility, MdVisibilityOff
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const MODULES_LIST = [
  'DASHBOARD', 'CUSTOMERS', 'MASTERS', 'SUBSCRIPTIONS',
  'PAUSE_MANAGEMENT', 'WALLET', 'PAYMENTS', 'WHATSAPP',
  'REPORTS', 'REVENUE', 'LOGISTICS', 'ECOM_ORDERS',
  'FEEDBACK', 'SMS', 'SETTINGS'
];

// ── Create User Account Modal ──────────────────────────────────────
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    role: 'Manager', access: 'LIMITED',
    permissions: ['DASHBOARD', 'CUSTOMERS', 'LOGISTICS'],
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const togglePermission = (mod) => {
    setForm(prev => {
      const exists = prev.permissions.includes(mod);
      const updated = exists ? prev.permissions.filter(p => p !== mod) : [...prev.permissions, mod];
      return { ...prev, permissions: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Name, email, and password are required.');
    setLoading(true);
    try {
      await api.post('/access-control/users', form);
      toast.success(`Account created for ${form.name} (${form.role})!`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" style={{ maxWidth: 640 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdPersonAdd /> Create User / Manager Account
          </h2>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input id="create-user-name" className="form-input" placeholder="e.g. Ramesh Kumar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input id="create-user-email" type="email" className="form-input" placeholder="manager@marammilk.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Temporary Password *</label>
                <input id="create-user-password" type={showPass ? 'text' : 'password'} className="form-input" placeholder="Min. 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: 34, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
              <div className="form-group">
                <label className="form-label">Assign Role</label>
                <select id="create-user-role" className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, access: e.target.value === 'Super Admin' ? 'FULL_CONTROL' : 'LIMITED' })}>
                  <option value="Manager">Manager (Branch Manager)</option>
                  <option value="Branch Admin">Branch Admin</option>
                  <option value="Delivery Supervisor">Delivery Supervisor</option>
                  <option value="Demo Account">Demo Account</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Web Access Level</label>
                <select id="create-user-access" className="form-input" value={form.access} onChange={e => setForm({ ...form, access: e.target.value })}>
                  <option value="FULL_CONTROL">Full Control (All 15 Modules)</option>
                  <option value="MANAGER_APP">Manager App + Logistics Access</option>
                  <option value="LIMITED">Custom Module Permissions</option>
                  <option value="READ_ONLY">Demo Read-Only Access</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Module Access Permissions</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 180, overflowY: 'auto', padding: 10, background: 'var(--bg-main)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {MODULES_LIST.map(mod => {
                  const checked = form.access === 'FULL_CONTROL' || form.permissions.includes(mod);
                  return (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', opacity: form.access === 'FULL_CONTROL' ? 0.7 : 1 }}>
                      <input type="checkbox" checked={checked} disabled={form.access === 'FULL_CONTROL'} onChange={() => togglePermission(mod)} />
                      {mod.replace(/_/g, ' ')}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="save-user-account-btn" type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {loading ? <span className="loading-spinner" /> : <><MdCheckCircle /> Create Account</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Edit User Modal ──────────────────────────────────────
function EditUserModal({ user, onClose, onUpdated }) {
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    role: user.role || 'Manager',
    access: user.access || 'LIMITED',
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    status: user.status || 'Active',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const togglePermission = (mod) => {
    setForm(prev => {
      const exists = prev.permissions.includes(mod);
      const updated = exists ? prev.permissions.filter(p => p !== mod) : [...prev.permissions, mod];
      return { ...prev, permissions: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Name and email are required.');
    if (form.password && form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        access: form.access,
        permissions: form.permissions,
        status: form.status,
      };
      if (form.password) payload.password = form.password;
      await api.patch(`/access-control/users/${user.id}`, payload);
      toast.success(`${form.name} updated successfully!`);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal" style={{ maxWidth: 660 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdEdit /> Edit User — <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{user.name}</span>
          </h2>
          <button className="icon-btn" onClick={onClose}><MdClose /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, access: e.target.value === 'Super Admin' ? 'FULL_CONTROL' : form.access })}>
                  <option value="Manager">Manager (Branch Manager)</option>
                  <option value="Branch Admin">Branch Admin</option>
                  <option value="Delivery Supervisor">Delivery Supervisor</option>
                  <option value="Demo Account">Demo Account</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Web Access Level</label>
                <select className="form-input" value={form.access} onChange={e => setForm({ ...form, access: e.target.value })}>
                  <option value="FULL_CONTROL">Full Control (All 15 Modules)</option>
                  <option value="MANAGER_APP">Manager App + Logistics Access</option>
                  <option value="LIMITED">Custom Module Permissions</option>
                  <option value="READ_ONLY">Demo Read-Only Access</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <label className="form-label">Reset Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                <input type={showPass ? 'text' : 'password'} className="form-input" placeholder="Min. 8 characters to change password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: 34, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Module Access Permissions</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 200, overflowY: 'auto', padding: 10, background: 'var(--bg-main)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {MODULES_LIST.map(mod => {
                  const checked = form.access === 'FULL_CONTROL' || form.permissions.includes(mod);
                  return (
                    <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', opacity: form.access === 'FULL_CONTROL' ? 0.7 : 1 }}>
                      <input type="checkbox" checked={checked} disabled={form.access === 'FULL_CONTROL'} onChange={() => togglePermission(mod)} />
                      {mod.replace(/_/g, ' ')}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {loading ? <span className="loading-spinner" /> : <><MdSave /> Save Changes</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main Access Control Page ──────────────────────────────────────
export default function AccessControlPage() {
  const [activeTab, setActiveTab] = useState('crm_users');
  const [crmUsers, setCrmUsers] = useState([]);
  const [managerUsers, setManagerUsers] = useState([]);
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, dpRes, adminRes] = await Promise.all([
        api.get('/access-control/users').catch(() => ({ data: { data: { crm_users: [], manager_app_users: [] } } })),
        api.get('/access-control/delivery-persons').catch(() => ({ data: { data: [] } })),
        api.get('/access-control/admin-profile').catch(() => ({ data: { data: null } })),
      ]);
      setCrmUsers(uRes.data.data.crm_users || []);
      setManagerUsers(uRes.data.data.manager_app_users || []);
      setDeliveryPersons(dpRes.data.data || []);
      setAdminProfile(adminRes.data.data || null);
    } catch {
      toast.error('Failed to load access control data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Access Control &amp; Roles</h1>
          <p className="page-subtitle">Manage Super Admins, Branch Managers, Delivery Persons &amp; Role Accessibility</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button id="create-user-account-btn" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <MdPersonAdd /> Create User / Manager Account
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}><MdRefresh /></button>
        </div>
      </div>

      {/* Super Admin Info Card — Dynamic from DB */}
      {adminProfile && (
        <div className="card" style={{ marginBottom: 20, background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.25)' }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: 20, fontWeight: 800 }}>
                  {initials(adminProfile.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                    Super Admin — {adminProfile.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Full Control Access across all CRM modules &amp; Manager App oversight.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg-main)', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <MdVpnKey style={{ color: 'var(--primary)', fontSize: 18 }} />
                <div style={{ fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email: </span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{adminProfile.email}</strong>
                  {adminProfile.last_login && (
                    <>
                      <span style={{ margin: '0 8px', color: 'var(--border)' }}>|</span>
                      <span style={{ color: 'var(--text-muted)' }}>Last Login: </span>
                      <strong style={{ color: 'var(--success)' }}>{new Date(adminProfile.last_login).toLocaleString('en-IN')}</strong>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {[
            { id: 'crm_users', icon: <MdSecurity />, label: 'CRM & Super Admins (DB1)', count: crmUsers.length + (adminProfile ? 1 : 0) },
            { id: 'manager_app', icon: <MdPhoneIphone />, label: 'Manager App Users (DB2)', count: managerUsers.length },
            { id: 'delivery_persons', icon: <MdTwoWheeler />, label: 'Delivery Persons / DPs (DB2)', count: deliveryPersons.length },
          ].map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none', border: 'none', padding: '14px 22px', fontSize: 13.5,
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.icon}{tab.label}
              <span style={{ background: activeTab === tab.id ? 'var(--primary)' : 'var(--border)', color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="card-body" style={{ padding: 0 }}>

          {/* TAB 1: CRM & Super Admin Users */}
          {activeTab === 'crm_users' && (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>User Name</th><th>Role</th><th>Email</th>
                    <th>Access Level</th><th>Status</th><th>Last Login</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Root super admin row — fetched from DB, non-editable here */}
                  {adminProfile && (
                    <tr>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="admin-avatar" style={{ width: 34, height: 34, fontSize: 13, background: 'linear-gradient(135deg, #10b981, #059669)' }}>{initials(adminProfile.name)}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{adminProfile.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Root Super Admin</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-success">Super Admin</span></td>
                      <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{adminProfile.email}</td>
                      <td>
                        <span style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdFlashOn /> FULL_CONTROL (ALL_MODULES)
                        </span>
                      </td>
                      <td><span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MdCheckCircle /> Active</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {adminProfile.last_login ? new Date(adminProfile.last_login).toLocaleDateString('en-IN') : 'Active Session'}
                      </td>
                      <td><span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Root (non-editable)</span></td>
                    </tr>
                  )}

                  {/* DB created users — editable */}
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading...</td></tr>
                  ) : crmUsers.length === 0 ? (
                    adminProfile ? null : (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No additional users found. Create one using the button above.</td></tr>
                    )
                  ) : (
                    crmUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 12, background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>{initials(u.name)}</div>
                            <div style={{ fontWeight: 600 }}>{u.name}</div>
                          </div>
                        </td>
                        <td><span className="badge badge-info">{u.role}</span></td>
                        <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{u.email}</td>
                        <td><span className="badge badge-gray">{u.access}</span></td>
                        <td><span className={`badge ${u.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{u.status}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}</td>
                        <td>
                          <button
                            id={`edit-user-${u.id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                            onClick={() => setEditUser(u)}
                          >
                            <MdEdit /> Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Manager App Users (DB2) */}
          {activeTab === 'manager_app' && (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Manager Name</th><th>Email</th><th>Branch</th><th>Role</th><th>Source DB</th></tr>
                </thead>
                <tbody>
                  {managerUsers.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Managers found in DB2 (maram_milk_db).</td></tr>
                  ) : (
                    managerUsers.map(m => (
                      <tr key={m.id}>
                        <td><div style={{ fontWeight: 600 }}>{m.name}</div></td>
                        <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{m.email}</td>
                        <td><span className="badge badge-blue">{m.branchName || 'Main Branch'}</span></td>
                        <td><span className="badge badge-warning">{m.role}</span></td>
                        <td><span style={{ fontSize: 11, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>{m.source}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Delivery Persons (DB2) */}
          {activeTab === 'delivery_persons' && (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>DP Code</th><th>Name</th><th>Mobile</th><th>Vehicle No</th><th>Zone</th><th>Petrol Balance</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {deliveryPersons.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Delivery Persons found in DB2.</td></tr>
                  ) : (
                    deliveryPersons.map(dp => (
                      <tr key={dp.id}>
                        <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{dp.dpCode || '—'}</span></td>
                        <td style={{ fontWeight: 600 }}>{dp.name}</td>
                        <td style={{ fontSize: 13 }}>{dp.mobileNumber || '—'}</td>
                        <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{dp.vehicleNumber || '—'}</td>
                        <td><span className="badge badge-gray">{dp.zone || '—'}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>&#8377;{dp.petrolBalance || 0}</td>
                        <td><span className={`badge ${dp.isActive !== false ? 'badge-success' : 'badge-danger'}`}>{dp.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} onCreated={fetchData} />}
      </AnimatePresence>
      <AnimatePresence>
        {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onUpdated={fetchData} />}
      </AnimatePresence>
    </div>
  );
}
