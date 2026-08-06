const express = require('express');
const router = express.Router();
const {
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  changePassword,
  getProfile,
  updateProfile,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

// Protected routes (require JWT)
router.post('/change-password', authenticate, changePassword);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
