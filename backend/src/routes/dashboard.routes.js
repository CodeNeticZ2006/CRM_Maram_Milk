const express = require('express');
const router = express.Router();
const { getDashboardStats, getActivityLogs, getMonthlyTrends } = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/stats', getDashboardStats);
router.get('/activity-logs', getActivityLogs);
router.get('/monthly-trends', getMonthlyTrends);

module.exports = router;
