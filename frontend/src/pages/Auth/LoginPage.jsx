import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MdEmail, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { FaDroplet } from 'react-icons/fa6';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, token } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = form.email.trim();
    const cleanPass = form.password.trim();
    if (!cleanEmail || !cleanPass) return toast.error('Please fill in all fields');
    const result = await login(cleanEmail, cleanPass);
    if (result.success) {
      toast.success('Welcome back! 👋');
      navigate('/dashboard');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon">🥛</div>
          <div className="auth-brand-name">Maram Milk</div>
          <div className="auth-brand-sub">Super Admin Control Center</div>
        </div>
        <div className="auth-features">
          {[
            { icon: '📊', title: 'Complete Dashboard', desc: 'Real-time stats, wallet analytics, delivery tracking' },
            { icon: '🛣️', title: 'Route Optimization', desc: 'OSRM-powered smart delivery route planning' },
            { icon: '💳', title: 'Secure Payments', desc: 'WhatsApp Pay, Razorpay, UPI — all in one place' },
            { icon: '📱', title: 'WhatsApp Operations', desc: 'Manage customer requests directly from the CRM' },
          ].map((f) => (
            <div className="auth-feature" key={f.title}>
              <div className="auth-feature-icon">{f.icon}</div>
              <div className="auth-feature-text">
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="auth-card-title">Welcome back 👋</h1>
          <p className="auth-card-sub">Sign in to your Super Admin account</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Email Address</label>
              <div className="input-with-icon">
                <MdEmail className="input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="form-input w-full"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Password</label>
              <div className="input-with-icon">
                <MdLock className="input-icon" />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input w-full"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
                <button type="button" className="input-eye" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: 24 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                Forgot Password?
              </Link>
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={loading}
            >
              {loading ? <span className="loading-spinner" /> : '🔐 Sign In'}
            </button>
          </form>

          <div className="auth-divider" />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            🛡️ Secured with JWT authentication · Maram Milk CRM v1.0
          </p>
        </motion.div>
      </div>
    </div>
  );
}
