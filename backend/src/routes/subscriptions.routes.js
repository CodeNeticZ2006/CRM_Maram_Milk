const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  updateSubscriptionStatus,
  getDailyDeliveries,
  createPause,
  getPauses,
  deletePause,
  getDeliveryPreview,
} = require('../controllers/subscriptions.controller');

router.use(authenticate);

// IMPORTANT: /daily MUST be before /:id so Express doesn't treat 'daily' as an ID
router.get('/daily',                       getDailyDeliveries);

router.get('/',                            getSubscriptions);
router.post('/',                           createSubscription);
router.get('/:id',                         getSubscriptionById);
router.put('/:id',                         updateSubscription);
router.patch('/:id/status',               updateSubscriptionStatus);

// Pause management
router.post('/:id/pause',                  createPause);
router.get('/:id/pauses',                  getPauses);
router.delete('/:id/pause/:pauseId',      deletePause);

// Delivery preview
router.get('/:id/delivery-preview',        getDeliveryPreview);

module.exports = router;

