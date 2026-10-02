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
  getPauseResumeOptions, getPauseResumeReport,
  getSubscriptionChangeOptions, getSubscriptionChangeReport,
  getChangeTodayTomorrowOptions, getChangeTodayTomorrowReport,
  getPaymentCollectionOptions, getPaymentCollectionReport,
  getPaymentApprovalOptions, getPaymentApprovalReport,
  getManageCustomerBillingOptions, getManageCustomerBillingReport,
  getSalesReportOptions, getSalesReport,
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

// Customer Requests Endpoints
router.get('/pause-resume-options',       getPauseResumeOptions);
router.get('/pause-resume-report',        getPauseResumeReport);
router.get('/subscription-change-options', getSubscriptionChangeOptions);
router.get('/subscription-change-report', getSubscriptionChangeReport);
router.get('/change-today-tomorrow-options', getChangeTodayTomorrowOptions);
router.get('/change-today-tomorrow-report', getChangeTodayTomorrowReport);

// Finance & Sales Endpoints
router.get('/payment-collection-options', getPaymentCollectionOptions);
router.get('/payment-collection',        getPaymentCollectionReport);
router.get('/payment-approval-options',   getPaymentApprovalOptions);
router.get('/payment-approval',            getPaymentApprovalReport);
router.get('/customer-billing-options',   getManageCustomerBillingOptions);
router.get('/customer-billing',            getManageCustomerBillingReport);
router.get('/sales-report-options',       getSalesReportOptions);
router.get('/sales-report',                getSalesReport);

module.exports = router;





