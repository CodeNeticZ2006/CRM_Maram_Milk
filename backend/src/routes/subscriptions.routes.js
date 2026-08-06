const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getSubscriptions, createSubscription, updateSubscription, updateSubscriptionStatus } = require('../controllers/subscriptions.controller');

router.use(authenticate);
router.get('/',          getSubscriptions);
router.post('/',         createSubscription);
router.put('/:id',       updateSubscription);
router.patch('/:id/status', updateSubscriptionStatus);

module.exports = router;
