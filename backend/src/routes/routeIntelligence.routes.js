const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getLiveOperations,
  getRouteCompliance,
  getTerritoryMonitoring,
  getGeofences,
  getRouteReplay,
  getRouteAnalytics,
  getSettings,
  updateSettings,
  getRouteCorridorsHandler,
  postGpsPing,
  getDeviationSessionsHandler,
} = require('../controllers/routeIntelligence.controller');

router.use(authenticate);

router.get('/live-operations',   getLiveOperations);
router.get('/compliance',        getRouteCompliance);
router.get('/territories',       getTerritoryMonitoring);
router.get('/geofences',         getGeofences);
router.get('/replay',            getRouteReplay);
router.get('/analytics',         getRouteAnalytics);
router.get('/settings',          getSettings);
router.put('/settings',          updateSettings);
router.get('/route-corridors',   getRouteCorridorsHandler);
router.post('/gps-ping',         postGpsPing);
router.get('/deviation-sessions', getDeviationSessionsHandler);

module.exports = router;
