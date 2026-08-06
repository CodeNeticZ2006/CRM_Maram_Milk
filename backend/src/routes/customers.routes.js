const express = require('express');
const router = express.Router();
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const {
  getCustomers, getCustomerById, createCustomer, updateCustomer,
  toggleCustomerStatus, getCustomerLedger, addCustomerNote, getCustomerNotes,
  createEnquiry, getEnquiries,
} = require('../controllers/customers.controller');

router.use(authenticate);

// Read endpoints
router.get('/',           getCustomers);
router.get('/enquiries',  getEnquiries);
router.get('/:id',        getCustomerById);
router.get('/:id/ledger', getCustomerLedger);
router.get('/:id/notes',   getCustomerNotes);

// Super Admin ONLY endpoints for Customer Management
router.post('/',            requireSuperAdmin, createCustomer);
router.put('/:id',          requireSuperAdmin, updateCustomer);
router.patch('/:id/status', requireSuperAdmin, toggleCustomerStatus);

// Notes & enquiries
router.post('/enquiry',    createEnquiry);
router.post('/:id/notes',   addCustomerNote);

module.exports = router;
