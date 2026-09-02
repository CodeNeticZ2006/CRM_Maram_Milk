const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { writeToCRM, readFromCRM } = require('../config/database');
const { generateToken } = require('../config/jwt');
const { sendOTPEmail } = require('../services/email.service');
const { sendOTPSMS } = require('../services/sms.service');

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanPassword = password ? password.trim() : '';

    console.log(`🔑 Login attempt for: "${cleanEmail}"`);

    // 🔑 Flexible Hardcoded Super Admin Credentials Check
    const validEmails = ['admin@marammilk.com', 'sarfaraz@marammilk.com', 'sarfaz@marammilk.com', 'sarfaraz', 'sarfaz'];
    const validPasswords = ['Sarfaraz@marammilk', 'Sarfaz@marammilk', 'MaramMilk@2026', 'Sarfaraz@', 'Sarfaz@'];

    const isMatchEmail = validEmails.includes(cleanEmail);
    const isMatchPassword = validPasswords.includes(cleanPassword);

    if (isMatchEmail && isMatchPassword) {
      console.log('✅ Super Admin login successful via master credentials.');
      let adminId = 1;
      let adminName = 'Sarfaraz Ahmed';
      let phone = '+919999999999';

      try {
        const result = await readFromCRM('SELECT * FROM super_admin WHERE email = $1', ['admin@marammilk.com']);
        if (result.rows.length > 0) {
          adminId = result.rows[0].id;
          adminName = result.rows[0].name;
          phone = result.rows[0].phone || phone;
          await writeToCRM('UPDATE super_admin SET last_login = NOW() WHERE id = $1', [adminId]).catch(() => {});
        }
      } catch (dbErr) {
        console.warn('⚠️ DB offline, granting hardcoded Super Admin access.');
      }

      const token = generateToken({
        id: adminId,
        email: 'admin@marammilk.com',
        name: adminName,
        role: 'SuperAdmin',
        permissions: ['*']
      });

      return res.json({
        success: true,
        message: 'Login successful (Super Admin - Full Web Access).',
        token,
        admin: {
          id: adminId,
          name: adminName,
          email: cleanEmail || 'admin@marammilk.com',
          phone: phone,
          role: 'Super Admin',
          access: 'FULL_CONTROL',
          permissions: [
            'DASHBOARD', 'CUSTOMERS', 'MASTERS', 'SUBSCRIPTIONS',
            'PAUSE_MANAGEMENT', 'WALLET', 'PAYMENTS', 'WHATSAPP',
            'REPORTS', 'REVENUE', 'LOGISTICS', 'ECOM_ORDERS',
            'FEEDBACK', 'SMS', 'ACCESS_CONTROL', 'SETTINGS'
          ],
          last_login: new Date().toISOString(),
        },
      });
    }

    // Standard DB Lookup for other users
    const result = await readFromCRM('SELECT * FROM super_admin WHERE email = $1', [cleanEmail]);
    if (result.rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    await writeToCRM('UPDATE super_admin SET last_login = NOW() WHERE id = $1', [admin.id]).catch(() => {});

    const token = generateToken({ id: admin.id, email: admin.email, name: admin.name, role: 'SuperAdmin', permissions: ['*'] });

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: 'Super Admin',
        access: 'FULL_CONTROL',
        profile_image: admin.profile_image,
        last_login: admin.last_login,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { identifier, method } = req.body; // identifier = email or phone, method = 'email' | 'sms'
    if (!identifier || !method)
      return res.status(400).json({ success: false, message: 'Identifier and method required.' });

    let admin;
    if (method === 'email') {
      const r = await readFromCRM('SELECT * FROM super_admin WHERE email = $1', [identifier.toLowerCase()]);
      admin = r.rows[0];
    } else if (method === 'sms') {
      const r = await readFromCRM('SELECT * FROM super_admin WHERE phone = $1', [identifier]);
      admin = r.rows[0];
    }

    // Always return success to prevent enumeration
    if (!admin) {
      return res.json({ success: true, message: 'If an account exists, OTP has been sent.' });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old OTPs
    await writeToCRM(
      'UPDATE otp_tokens SET used = TRUE WHERE admin_id = $1 AND used = FALSE',
      [admin.id]
    );

    // Store new OTP
    await writeToCRM(
      `INSERT INTO otp_tokens (admin_id, otp_hash, method, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [admin.id, otpHash, method, expiresAt]
    );

    // Send OTP
    if (method === 'email') {
      await sendOTPEmail(admin.email, otp, admin.name);
    } else {
      await sendOTPSMS(admin.phone, otp);
    }

    res.json({ success: true, message: 'If an account exists, OTP has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────────────
const verifyOTP = async (req, res, next) => {
  try {
    const { identifier, method, otp } = req.body;
    if (!identifier || !method || !otp)
      return res.status(400).json({ success: false, message: 'All fields required.' });

    let admin;
    if (method === 'email') {
      const r = await readFromCRM('SELECT * FROM super_admin WHERE email = $1', [identifier.toLowerCase()]);
      admin = r.rows[0];
    } else {
      const r = await readFromCRM('SELECT * FROM super_admin WHERE phone = $1', [identifier]);
      admin = r.rows[0];
    }
    if (!admin) return res.status(400).json({ success: false, message: 'Invalid request.' });

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Find valid OTP
    const tokenResult = await readFromCRM(
      `SELECT * FROM otp_tokens
       WHERE admin_id = $1 AND otp_hash = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [admin.id, otpHash]
    );

    if (tokenResult.rows.length === 0) {
      // Increment attempts
      await writeToCRM(
        `UPDATE otp_tokens SET attempts = attempts + 1
         WHERE admin_id = $1 AND used = FALSE ORDER BY created_at DESC`,
        [admin.id]
      );
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const token = tokenResult.rows[0];

    // Check max attempts (3)
    if (token.attempts >= 3) {
      await writeToCRM('UPDATE otp_tokens SET used = TRUE WHERE id = $1', [token.id]);
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
    }

    // Mark OTP as used
    await writeToCRM('UPDATE otp_tokens SET used = TRUE WHERE id = $1', [token.id]);

    // Generate short-lived reset token (15 min)
    const resetToken = generateToken({ id: admin.id, purpose: 'password_reset' });

    res.json({ success: true, message: 'OTP verified.', resetToken });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword)
      return res.status(400).json({ success: false, message: 'Reset token and new password required.' });

    const { verifyToken } = require('../config/jwt');
    let decoded;
    try {
      decoded = verifyToken(resetToken);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (decoded.purpose !== 'password_reset')
      return res.status(401).json({ success: false, message: 'Invalid token purpose.' });

    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await writeToCRM('UPDATE super_admin SET password_hash = $1 WHERE id = $2', [hash, decoded.id]);

    res.json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/change-password (authenticated)
// ─────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    const result = await readFromCRM('SELECT * FROM super_admin WHERE id = $1', [adminId]);
    const admin = result.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await writeToCRM('UPDATE super_admin SET password_hash = $1 WHERE id = $2', [hash, adminId]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/profile (authenticated)
// ─────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const result = await readFromCRM(
      'SELECT id, name, email, phone, profile_image, last_login, created_at FROM super_admin WHERE id = $1',
      [req.admin.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PUT /api/auth/profile (authenticated)
// ─────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    await writeToCRM(
      'UPDATE super_admin SET name = $1, phone = $2 WHERE id = $3',
      [name, phone, req.admin.id]
    );
    res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, forgotPassword, verifyOTP, resetPassword, changePassword, getProfile, updateProfile };
