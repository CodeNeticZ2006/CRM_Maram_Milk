const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getPauseRequests,
  getCustomerSubscriptions,
  createPause,
  resumePause,
  bulkResumePauses,
  bulkCancelPauses,
  cancelPause,
  extendPause,
  createHoldRequest,
  updateRequestStatus,
  getPauseSummary
} = require('../controllers/pause.controller');

router.use(authenticate);

router.get('/',                                   getPauseRequests);
router.get('/summary',                            getPauseSummary);
router.get('/customer-subscriptions/:customerId', getCustomerSubscriptions);
router.post('/hold',                              createHoldRequest);
router.post('/create',                            createPause);
router.post('/',                                  createPause);
router.post('/bulk-resume',                       bulkResumePauses);
router.post('/bulk-cancel',                       bulkCancelPauses);
router.post('/:id/resume',                        resumePause);
router.post('/:id/cancel',                        cancelPause);
router.delete('/:id',                             cancelPause);
router.put('/:id',                                extendPause);
router.patch('/:type/:id',                        updateRequestStatus);

module.exports = router;

