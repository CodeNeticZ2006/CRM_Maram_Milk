const express = require('express');
const router = express.Router();
const {
  getStockCorrectnessToday,
  getStockCorrectnessHistory,
  getStockCorrectnessDetailByDate,
  updateReviewStatus,
  getNotifications,
  markNotificationRead,
} = require('../controllers/stockCorrectness.controller');

// Stock Correctness Endpoints
router.get('/today', getStockCorrectnessToday);
router.get('/history', getStockCorrectnessHistory);
router.get('/history/:date', getStockCorrectnessDetailByDate);
router.post('/review', updateReviewStatus);

// Notification Endpoints
router.get('/notifications', getNotifications);
router.post('/notifications/mark-read', markNotificationRead);

module.exports = router;
