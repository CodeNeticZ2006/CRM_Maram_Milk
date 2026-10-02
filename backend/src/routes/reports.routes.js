const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDailySummary, getMonthlyReport, getRevenueTrend, getCustomerAnalysis,
  getFeedback, getSmsLog, getLogisticsOverview,
  getArchivedReports, downloadArchivedReport, getStockCorrectnessReport,
  getReportFilterOptions, getAuditTrailReport, getDailyPlannerReport, getCustomerStatementReport,
  getCustomerInfoReport, getDeliveryPlannerCalendar, getDeliveryBoyPlannerReport,
  getDeliveryBoyDailySummary, getDeliveryAreaOptions, getDeliveryAreaReport,
  getMarkDeliveryOptions, getMarkDeliveryReport,
} = require('../controllers/reports.controller');

router.use(authenticate);
router.get('/daily-summary',               getDailySummary);
router.get('/monthly',                    getMonthlyReport);
router.get('/revenue-trend',              getRevenueTrend);
router.get('/customer-analysis',          getCustomerAnalysis);
router.get('/feedback',                   getFeedback);
router.get('/sms-log',                    getSmsLog);
router.get('/logistics',                  getLogisticsOverview);
router.get('/stock-correctness',           getStockCorrectnessReport);
router.get('/archived',                   getArchivedReports);
router.get('/download/:id',               downloadArchivedReport);

// General Reports Endpoints
router.get('/filter-options',             getReportFilterOptions);
router.get('/audit-trail',                getAuditTrailReport);
router.get('/daily-planner',              getDailyPlannerReport);
router.get('/customer-statement',         getCustomerStatementReport);
router.get('/customer-info',              getCustomerInfoReport);
router.get('/delivery-planner-calendar',  getDeliveryPlannerCalendar);
router.get('/delivery-boy-planner',       getDeliveryBoyPlannerReport);
router.get('/delivery-boy-daily-summary', getDeliveryBoyDailySummary);
router.get('/delivery-area-options',      getDeliveryAreaOptions);
router.get('/delivery-area',              getDeliveryAreaReport);
router.get('/mark-delivery-options',      getMarkDeliveryOptions);
router.get('/mark-delivery',              getMarkDeliveryReport);

module.exports = router;





