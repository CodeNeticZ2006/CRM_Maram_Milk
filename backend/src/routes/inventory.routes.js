const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const {
  getInventory,
  addStock,
  correctStock,
  getStockHistory,
  getLowStockItems,
  getDpAttendanceAudit,
  updateInventory,
} = require('../controllers/inventory.controller');

router.use(authenticate);

router.get('/',               getInventory);
router.get('/history',        getStockHistory);
router.get('/low-stock',      getLowStockItems);
router.get('/dp-attendance',  getDpAttendanceAudit);

// Write / Stock Addition endpoints (Super Admin / Write permission required)
router.post('/add-stock',     requirePermission('INVENTORY', true), addStock);
router.post('/correct-stock', requirePermission('INVENTORY', true), correctStock);
router.post('/update',        requirePermission('INVENTORY', true), updateInventory);

module.exports = router;
