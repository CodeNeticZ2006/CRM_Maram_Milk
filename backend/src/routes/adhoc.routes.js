const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const {
  getAdhocInventory,
  addAdhocStock,
  issueDpAdhocStock,
  getDpAdhocStock,
  recordDpAdhocSale,
  recordCustomerAdhocSale,
  getDpAdhocAudit,
  getAdhocReportData,
  overrideAdhocStock,
} = require('../controllers/adhoc.controller');

router.use(authenticate);

// Central Inventory & Audits
router.get('/central',             getAdhocInventory);
router.get('/dp-stock',            getDpAdhocStock);
router.get('/audit',               getDpAdhocAudit);
router.get('/report-data',         getAdhocReportData);

// Stock Addition & Issuance (Super Admin / Write permission)
router.post('/add-stock',          requirePermission('INVENTORY', true), addAdhocStock);
router.post('/issue-dp-stock',     requirePermission('INVENTORY', true), issueDpAdhocStock);
router.post('/record-dp-sale',     requirePermission('INVENTORY', true), recordDpAdhocSale);
router.post('/record-customer-sale', requirePermission('INVENTORY', true), recordCustomerAdhocSale);
router.put('/override',            requirePermission('INVENTORY', true), overrideAdhocStock);

module.exports = router;
