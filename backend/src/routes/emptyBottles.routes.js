const express = require('express');
const router = express.Router();
const {
  getEmptyBottleLogs,
  getIncidents,
  raiseIncident,
  reviewIncident,
} = require('../controllers/emptyBottles.controller');

router.get('/',                  getEmptyBottleLogs);
router.get('/incidents',         getIncidents);
router.post('/incidents',        raiseIncident);
router.put('/incidents/:id/review', reviewIncident);

module.exports = router;
