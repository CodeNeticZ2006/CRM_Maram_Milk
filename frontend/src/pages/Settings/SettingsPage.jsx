import { useState } from 'react';
import { motion } from 'framer-motion';
import { MdLock, MdPerson, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

export default function SettingsPage() {
  const { admin } = useAuthStore();
  const [profile, setProfile] = useState({ name: admin?.name || '', phone: admin?.phone || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await api.put('/auth/profile', profile);
      toast.success('Profile updated successfully!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update profile.'); }
    finally { setProfileLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword)
      return toast.error('New passwords do not match.');
    if (passwords.newPassword.length < 8)
      return toast.error('Password must be at least 8 characters.');
    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success('Password changed successfully!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to change password.'); }
    finally { setPasswordLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your profile and account security</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Profile Settings */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card-header">
            <h3 className="card-title"><MdPerson style={{ verticalAlign: 'middle', marginRight: 6 }} />Profile Information</h3>
          </div>
          <div className="card-body">
            {/* Avatar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div className="admin-avatar" style={{ width: 72, height: 72, fontSize: 24 }}>
                {admin?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA'}
              </div>
            </div>
            <form onSubmit={handleProfileSave}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Full Name</label>
                <input id="settings-name" className="form-input" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Phone</label>
                <input id="settings-phone" className="form-input" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Email</label>
                <input className="form-input" value={admin?.email || ''} disabled style={{ opacity: 0.6 }} />
              </div>
              <button id="settings-profile-save" type="submit" className="btn btn-primary w-full" disabled={profileLoading}>
                {profileLoading ? <span className="loading-spinner" /> : <><MdSave /> Save Profile</>}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Change Password */}
        <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="card-header">
            <h3 className="card-title"><MdLock style={{ verticalAlign: 'middle', marginRight: 6 }} />Change Password</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handlePasswordChange}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Current Password</label>
                <input id="settings-current-pw" type="password" className="form-input" value={passwords.currentPassword}
                  onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} placeholder="Enter current password" />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">New Password</label>
                <input id="settings-new-pw" type="password" className="form-input" value={passwords.newPassword}
                  onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} placeholder="Min. 8 characters" />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Confirm New Password</label>
                <input id="settings-confirm-pw" type="password" className="form-input" value={passwords.confirmPassword}
                  onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })} placeholder="Repeat new password" />
              </div>
              <button id="settings-password-save" type="submit" className="btn btn-danger w-full" disabled={passwordLoading}>
                {passwordLoading ? <span className="loading-spinner" /> : <><MdLock /> Change Password</>}
              </button>
            </form>
          </div>
        </motion.div>
      </div>

      {/* System Info */}
      <motion.div className="card" style={{ marginTop: 20 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="card-header"><h3 className="card-title">ℹ️ System Information</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'System', value: 'Maram Milk CRM' },
              { label: 'Version', value: 'v1.0.0' },
              { label: 'DB Region', value: 'Singapore (CRM) + Oregon (App)' },
              { label: 'Environment', value: 'Production' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
