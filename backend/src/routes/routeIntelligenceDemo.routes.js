const express = require('express');
const router = express.Router();
const {
  startSimulation,
  pauseSimulation,
  resetSimulation,
  setSpeed,
  setDpScenario,
  startGuidedScenario,
  getSimulationStatus,
  reviewSimulatedAlert,
  getSimulatedReplayStream,
} = require('../services/demoSimulation.service');

// Kill Switch Middleware: if ROUTE_DEMO_ENABLED is 'false', return 404
router.use((req, res, next) => {
  if (process.env.ROUTE_DEMO_ENABLED === 'false') {
    return res.status(404).json({ success: false, message: 'Simulation mode is disabled in this environment.' });
  }
  next();
});

router.post('/start', async (req, res, next) => {
  try {
    const status = await startSimulation();
    res.json({ success: true, message: 'Simulation started.', data: status });
  } catch (err) { next(err); }
});

router.post('/pause', (req, res, next) => {
  try {
    const status = pauseSimulation();
    res.json({ success: true, message: 'Simulation paused.', data: status });
  } catch (err) { next(err); }
});

router.post('/reset', async (req, res, next) => {
  try {
    const status = await resetSimulation();
    res.json({ success: true, message: 'Simulation reset.', data: status });
  } catch (err) { next(err); }
});

router.get('/status', (req, res, next) => {
  try {
    const status = getSimulationStatus();
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
});

router.post('/speed', (req, res, next) => {
  try {
    const status = setSpeed(req.body?.speed);
    res.json({ success: true, message: `Speed set to ${req.body?.speed}x`, data: status });
  } catch (err) { next(err); }
});

router.post('/scenario', (req, res, next) => {
  try {
    const { dpId, scenario } = req.body;
    const status = setDpScenario(dpId, scenario);
    res.json({ success: true, message: `Scenario ${scenario} applied to ${dpId}`, data: status });
  } catch (err) { next(err); }
});

router.post('/scenario/guided', (req, res, next) => {
  try {
    const { scenarioId } = req.body;
    if (!['scenario1', 'scenario2'].includes(scenarioId)) {
      return res.status(400).json({ success: false, message: 'Invalid scenarioId. Expected scenario1 or scenario2' });
    }
    const status = startGuidedScenario(scenarioId);
    res.json({ success: true, message: `Guided scenario ${scenarioId} started`, data: status });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/alerts', (req, res, next) => {
  try {
    const status = getSimulationStatus();
    res.json({ success: true, data: status.alerts });
  } catch (err) { next(err); }
});

router.patch('/alerts/:id/review', (req, res, next) => {
  try {
    const { status, note } = req.body;
    const result = reviewSimulatedAlert(req.params.id, status, note, req.user?.name || 'SuperAdmin');
    res.json({ success: true, message: `Alert ${req.params.id} marked as ${status}`, data: result });
  } catch (err) { next(err); }
});

router.get('/replay-stream', (req, res, next) => {
  try {
    const { dpId, alertId } = req.query;
    const stream = getSimulatedReplayStream(dpId, alertId);
    res.json({ success: true, data: stream });
  } catch (err) { next(err); }
});

module.exports = router;
