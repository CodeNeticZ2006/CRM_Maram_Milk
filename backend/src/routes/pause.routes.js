const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getPauseRequests, createHoldRequest, updateRequestStatus, getPauseSummary } = require('../controllers/pause.controller');

router.use(authenticate);
router.get('/',              getPauseRequests);
router.get('/summary',       getPauseSummary);
router.post('/hold',         createHoldRequest);
router.patch('/:type/:id',   updateRequestStatus);

module.exports = router;
