const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getCurrentDay, getHistory, triggerRollover } = require('../controllers/operationalDay.controller');

router.use(authenticate);

router.get('/current',           getCurrentDay);
router.get('/history',           getHistory);
router.post('/trigger-rollover', triggerRollover);

module.exports = router;
