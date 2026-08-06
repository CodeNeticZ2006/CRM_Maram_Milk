const express = require('express');
const router = express.Router();
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const {
  getPayments, verifyPayment, createPayment,
  getInvoices, generateInvoices, sendInvoiceWhatsApp, getPaymentStats
} = require('../controllers/payments.controller');

router.use(authenticate);

// Read endpoints (Super Admin & Managers)
router.get('/stats',                    getPaymentStats);
router.get('/invoices',                 getInvoices);
router.get('/',                         getPayments);

// Super Admin ONLY endpoints for Payments & Invoices
router.post('/',                        requireSuperAdmin, createPayment);
router.patch('/:id/verify',             requireSuperAdmin, verifyPayment);
router.post('/generate-invoices',       requireSuperAdmin, generateInvoices);
router.post('/invoices/:id/send-whatsapp', requireSuperAdmin, sendInvoiceWhatsApp);

module.exports = router;
