import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdEmail, MdPhone, MdLock, MdVisibility, MdVisibilityOff,
  MdArrowBack, MdLocalDrink, MdSend, MdCheckCircle
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

const STEPS = { IDENTIFY: 'identify', OTP: 'otp', RESET: 'reset', DONE: 'done' };

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep]             = useState(STEPS.IDENTIFY);
  const [method, setMethod]         = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp]               = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return toast.error('Please enter your email or phone');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier: identifier.trim(), method });
      toast.success(`OTP sent to your ${method === 'email' ? 'email' : 'phone'}!`);
      setStep(STEPS.OTP);
      startResendTimer();
    } catch {
      toast.error('Failed to send OTP. Please try again.');
    } finally { setLoading(false); }
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((t) => { if (t <= 1) { clearInterval(interval); return 0; } return t - 1; });
    }, 1000);
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpStr = otp.join('');
    if (otpStr.length !== 6) return toast.error('Please enter the 6-digit OTP');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { identifier, method, otp: otpStr });
      setResetToken(res.data.resetToken);
      toast.success('OTP verified! Set your new password.');
      setStep(STEPS.RESET);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword });
      toast.success('Password reset successfully!');
      setStep(STEPS.DONE);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-brand-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fff' }}>
            <img src="/Logo_Maram_Milk.png" alt="Maram Milk Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
          </div>
          <div className="auth-brand-name">Maram Milk</div>
          <div className="auth-brand-sub">Password Recovery</div>
        </div>
        <div className="auth-features">
          <div className="auth-feature">
            <div className="auth-feature-icon" style={{ fontSize: 20, color: 'var(--primary)' }}><MdEmail /></div>
            <div className="auth-feature-text">
              <h4>Email OTP</h4>
              <p>Receive a 6-digit OTP to your registered email address</p>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon" style={{ fontSize: 20, color: 'var(--primary)' }}><MdPhone /></div>
            <div className="auth-feature-text">
              <h4>SMS OTP</h4>
              <p>Get OTP via SMS to your registered mobile number</p>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon" style={{ fontSize: 20, color: 'var(--primary)' }}><MdLock /></div>
            <div className="auth-feature-text">
              <h4>Secure Recovery</h4>
              <p>OTP expires in 10 minutes. Max 3 attempts per request</p>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <motion.div className="auth-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <AnimatePresence mode="wait">

            {/* STEP 1: Identify */}
            {step === STEPS.IDENTIFY && (
              <motion.div key="identify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="auth-card-title">Forgot Password?</h1>
                <p className="auth-card-sub">Choose how to receive your OTP</p>

                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  {['email', 'sms'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMethod(m); setIdentifier(''); }}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 8,
                        border: `2px solid ${method === m ? 'var(--primary)' : 'var(--border)'}`,
                        background: method === m ? 'rgba(59,130,246,0.08)' : 'transparent',
                        color: method === m ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: 13, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {m === 'email' ? <><MdEmail /> Email</> : <><MdPhone /> SMS</>}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleRequestOTP}>
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label">
                      {method === 'email' ? 'Registered Email' : 'Registered Phone Number'}
                    </label>
                    <div className="input-with-icon">
                      {method === 'email' ? <MdEmail className="input-icon" /> : <MdPhone className="input-icon" />}
                      <input
                        id="forgot-identifier"
                        type={method === 'email' ? 'email' : 'tel'}
                        className="form-input w-full"
                        placeholder={method === 'email' ? 'Enter your email' : '+91 XXXXX XXXXX'}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <MdSend /> {loading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <Link to="/login" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <MdArrowBack /> Back to Login
                  </Link>
                </div>
              </motion.div>
            )}

            {/* STEP 2: OTP */}
            {step === STEPS.OTP && (
              <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="auth-card-title">Enter OTP</h1>
                <p className="auth-card-sub">
                  6-digit code sent to <strong>{identifier}</strong>
                </p>

                <form onSubmit={handleVerifyOTP}>
                  <div className="otp-inputs" style={{ margin: '28px 0' }}>
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-input"
                        value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      />
                    ))}
                  </div>
                  <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <MdCheckCircle /> {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  {resendTimer > 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Resend in {resendTimer}s</p>
                  ) : (
                    <button
                      onClick={handleRequestOTP}
                      style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Reset */}
            {step === STEPS.RESET && (
              <motion.div key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h1 className="auth-card-title">Set New Password</h1>
                <p className="auth-card-sub">Choose a strong password (min 8 characters)</p>

                <form onSubmit={handleResetPassword}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">New Password</label>
                    <div className="input-with-icon">
                      <MdLock className="input-icon" />
                      <input
                        id="new-password"
                        type={showPass ? 'text' : 'password'}
                        className="form-input w-full"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button type="button" className="input-eye" onClick={() => setShowPass(!showPass)}>
                        {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label className="form-label">Confirm Password</label>
                    <div className="input-with-icon">
                      <MdLock className="input-icon" />
                      <input
                        id="confirm-password"
                        type={showPass ? 'text' : 'password'}
                        className="form-input w-full"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <MdLock /> {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 4: Done */}
            {step === STEPS.DONE && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '20px 0' }}>
                <MdCheckCircle style={{ fontSize: 56, color: '#10b981', marginBottom: 16 }} />
                <h1 className="auth-card-title">Password Reset!</h1>
                <p className="auth-card-sub" style={{ marginBottom: 28 }}>
                  Your password has been reset successfully.
                </p>
                <button onClick={() => navigate('/login')} className="btn btn-primary w-full btn-lg">
                  Go to Login
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
