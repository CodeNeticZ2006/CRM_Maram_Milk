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
} = require('../controllers/routeIntelligence.controller');

router.use(authenticate);

router.get('/live-operations', getLiveOperations);
router.get('/compliance',      getRouteCompliance);
router.get('/territories',     getTerritoryMonitoring);
router.get('/geofences',       getGeofences);
router.get('/replay',          getRouteReplay);
router.get('/analytics',       getRouteAnalytics);
router.get('/settings',        getSettings);
router.put('/settings',        updateSettings);

module.exports = router;
