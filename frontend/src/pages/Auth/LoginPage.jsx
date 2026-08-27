import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MdEmail, MdLock, MdVisibility, MdVisibilityOff,
  MdBarChart, MdRoute, MdInventory, MdLocalShipping,
  MdSecurity, MdErrorOutline
} from 'react-icons/md';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const features = [
  {
    icon: <MdBarChart />,
    title: 'Dashboard & Analytics',
    desc: 'Real-time operational visibility',
  },
  {
    icon: <MdRoute />,
    title: 'Route Intelligence',
    desc: 'Smart route planning and monitoring',
  },
  {
    icon: <MdInventory />,
    title: 'Inventory Management',
    desc: 'Track stock, dispatch and reconciliation',
  },
  {
    icon: <MdLocalShipping />,
    title: 'Delivery Operations',
    desc: 'Monitor DP activity and route compliance',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, token } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = form.email.trim();
    const cleanPass = form.password.trim();

    if (!cleanEmail || !cleanPass) {
      const msg = 'Please fill in all fields';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    const result = await login(cleanEmail, cleanPass);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      const msg = result.message || 'Invalid email or password';
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="auth-page">
      {/* Background Layers */}
      <div className="auth-bg-pattern" />
      <div className="auth-bg-glow-1" />
      <div className="auth-bg-glow-2" />

      {/* LEFT PANEL: Branding & Feature Showcase */}
      <div className="auth-left">
        <div className="auth-left-content">
          <motion.div
            className="auth-brand-badge"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="auth-brand-logo">
              <img src="/Logo_Maram_Milk.png" alt="Maram Milk Logo" />
            </div>
            <div>
              <h2 className="auth-brand-title">Maram Milk</h2>
              <p className="auth-brand-subtitle">Super Admin Control Center</p>
            </div>
          </motion.div>

          <motion.h1
            className="auth-tagline"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            One platform to manage your milk delivery operations.
          </motion.h1>

          <motion.div
            className="auth-features-grid"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.2 },
              },
            }}
          >
            {features.map((f) => (
              <motion.div
                className="auth-feature-card"
                key={f.title}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <div className="auth-feature-icon-box">{f.icon}</div>
                <h3 className="auth-feature-card-title">{f.title}</h3>
                <p className="auth-feature-card-desc">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* RIGHT PANEL: Enterprise Login Card */}
      <div className="auth-right">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="auth-card-header">
            <div className="auth-card-logo">
              <img src="/Logo_Maram_Milk.png" alt="Maram Milk Logo" />
            </div>
            <h1 className="auth-card-title">Welcome Back</h1>
            <p className="auth-card-sub">Sign in to your Super Admin account</p>
          </div>

          {errorMsg && (
            <motion.div
              className="auth-error-banner"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
            >
              <MdErrorOutline className="auth-error-icon" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" htmlFor="login-email">
                EMAIL ADDRESS
              </label>
              <div className="input-with-icon">
                <MdEmail className="input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="form-input w-full"
                  placeholder="admin@marammilk.com"
                  value={form.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>
                  PASSWORD
                </label>
                <Link to="/forgot-password" className="auth-forgot-link" tabIndex={0}>
                  Forgot Password?
                </Link>
              </div>
              <div className="input-with-icon">
                <MdLock className="input-icon" />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input w-full"
                  placeholder="••••••••••••••••"
                  value={form.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="input-eye"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary w-full btn-lg auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  <MdLock style={{ fontSize: 17 }} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="auth-divider" />

          <div className="auth-security-footer">
            <MdSecurity className="auth-security-icon" />
            <span>Secured with JWT authentication · Maram Milk CRM v1.0</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

