const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDailySummary, getMonthlyReport, getRevenueTrend, getCustomerAnalysis, getFeedback, getSmsLog, getLogisticsOverview } = require('../controllers/reports.controller');

router.use(authenticate);
router.get('/daily-summary',     getDailySummary);
router.get('/monthly',          getMonthlyReport);
router.get('/revenue-trend',    getRevenueTrend);
router.get('/customer-analysis',getCustomerAnalysis);
router.get('/feedback',         getFeedback);
router.get('/sms-log',          getSmsLog);
router.get('/logistics',        getLogisticsOverview);

module.exports = router;
