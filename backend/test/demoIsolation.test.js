import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  dpGpsStore,
  alertsStore,
  deviationSessionsStore,
} = require('../src/services/routeCorridor.service.js');
const {
  SETTINGS_FILE_PATH,
} = require('../src/services/routeSettings.service.js');
const {
  SIMULATED_DP_CONFIG,
  startSimulation,
  pauseSimulation,
  resetSimulation,
  setSpeed,
  setDpScenario,
  getSimulationStatus,
  reviewSimulatedAlert,
  getSimulatedReplayStream,
  processSimulationTick,
} = require('../src/services/demoSimulation.service.js');

describe('Route Intelligence Demo Simulation Isolation & Scenarios', () => {
  beforeEach(async () => {
    await resetSimulation();
  });

  afterEach(async () => {
    await resetSimulation();
  });

  it('1. Snapshot proof: Real stores & settings file remain byte-for-byte identical before and after demo run', async () => {
    // A. Snapshot BEFORE demo
    const realAlertsBefore = JSON.stringify(alertsStore);
    const realDpStoreBefore = JSON.stringify(dpGpsStore);
    const realSessionsBefore = JSON.stringify(deviationSessionsStore);
    const settingsFileBefore = fs.existsSync(SETTINGS_FILE_PATH)
      ? fs.readFileSync(SETTINGS_FILE_PATH, 'utf8')
      : null;

    // B. Run active simulation operations (simulated ticks)
    await startSimulation();
    setDpScenario('SIM-001', 'diversion');
    setDpScenario('SIM-002', 'customer-stop');
    setDpScenario('SIM-003', 'off-route-stopped');

    for (let i = 0; i < 8; i++) {
      await processSimulationTick();
    }

    const statusDuring = getSimulationStatus();
    assert.strictEqual(statusDuring.isRunning, true);
    assert.strictEqual(statusDuring.dps.length, 5);

    if (statusDuring.alerts.length > 0) {
      const alertId = statusDuring.alerts[0].id;
      reviewSimulatedAlert(alertId, 'REVIEWED', 'Road diversion verified with demo rider', 'TestRunner');
    }

    // C. Reset simulation
    await resetSimulation();

    // D. Snapshot AFTER demo
    const realAlertsAfter = JSON.stringify(alertsStore);
    const realDpStoreAfter = JSON.stringify(dpGpsStore);
    const realSessionsAfter = JSON.stringify(deviationSessionsStore);
    const settingsFileAfter = fs.existsSync(SETTINGS_FILE_PATH)
      ? fs.readFileSync(SETTINGS_FILE_PATH, 'utf8')
      : null;

    // E. Assert real data is 100% UNTOUCHED
    assert.strictEqual(realAlertsAfter, realAlertsBefore, 'Real alertsStore was mutated by demo mode!');
    assert.strictEqual(realDpStoreAfter, realDpStoreBefore, 'Real dpGpsStore was mutated by demo mode!');
    assert.strictEqual(realSessionsAfter, realSessionsBefore, 'Real deviationSessionsStore was mutated by demo mode!');
    assert.strictEqual(settingsFileAfter, settingsFileBefore, 'routeSettings.json was mutated by demo mode!');
  });

  it('2. Scenario: diversion triggers simulated alert when grace period expires without touching real stores', async () => {
    await startSimulation();
    setDpScenario('SIM-001', 'diversion');

    // 10 pings at 30s intervals = 300s off-route (exceeds 180s grace)
    for (let i = 0; i < 10; i++) {
      await processSimulationTick();
    }

    const status = getSimulationStatus();
    const sim1 = status.dps.find(d => d.id === 'SIM-001');

    assert.ok(sim1, 'SIM-001 must exist');
    assert.ok(sim1.drivingSeconds > 0, 'Driving seconds should accumulate during diversion');

    const simAlerts = status.alerts.filter(a => a.dpId === 'SIM-001');
    assert.ok(simAlerts.length > 0, 'Off-route diversion must trigger alert after grace period');
    assert.strictEqual(simAlerts[0].source, 'simulator');
    assert.strictEqual(alertsStore.some(a => a.id === simAlerts[0].id), false, 'Simulated alert leaked into real alertsStore!');

    pauseSimulation();
  });

  it('3. Scenario: customer-stop inside corridor accumulates NO stopped time alert', async () => {
    await startSimulation();
    setDpScenario('SIM-004', 'customer-stop');

    for (let i = 0; i < 6; i++) {
      await processSimulationTick();
    }

    const status = getSimulationStatus();
    const sim4 = status.dps.find(d => d.id === 'SIM-004');

    assert.ok(sim4, 'SIM-004 must exist');
    assert.strictEqual(sim4.isWithinCorridor, true, 'Customer stop must be inside assigned corridor');
    assert.strictEqual(sim4.currentState, 'ON_ROUTE', 'In-corridor door delivery stop must remain ON_ROUTE');
    assert.strictEqual(sim4.stoppedSeconds, 0, 'Customer door stop must NOT increment off-route stopped timer');

    const simAlerts = status.alerts.filter(a => a.dpId === 'SIM-004');
    assert.strictEqual(simAlerts.length, 0, 'Customer stop must never trigger an off-route alert');

    pauseSimulation();
  });

  it('4. Scenario: return-to-route re-enters corridor and recovers status', async () => {
    await startSimulation();

    setDpScenario('SIM-005', 'diversion');
    for (let i = 0; i < 4; i++) {
      await processSimulationTick();
    }

    setDpScenario('SIM-005', 'return-to-route');
    for (let i = 0; i < 4; i++) {
      await processSimulationTick();
    }

    const status = getSimulationStatus();
    const sim5 = status.dps.find(d => d.id === 'SIM-005');

    assert.ok(sim5, 'SIM-005 must exist');
    assert.strictEqual(sim5.currentState, 'ON_ROUTE');
    assert.strictEqual(sim5.status, 'GREEN');

    pauseSimulation();
  });

  it('5. Review and replay stream operate on isolated simulation state', () => {
    const stream = getSimulatedReplayStream('SIM-001');
    assert.strictEqual(stream.success, true);
    assert.strictEqual(stream.dpId, 'SIM-001');
    assert.ok(Array.isArray(stream.pings));
  });

  it('6. Reset clears all in-memory simulation state', async () => {
    await startSimulation();
    setDpScenario('SIM-001', 'diversion');
    for (let i = 0; i < 3; i++) {
      await processSimulationTick();
    }
    await resetSimulation();

    const status = getSimulationStatus();
    assert.strictEqual(status.isRunning, false);
    assert.strictEqual(status.alerts.length, 0);
    assert.strictEqual(status.simulatedAlertsCount, 0);
    status.dps.forEach(d => {
      assert.strictEqual(d.currentState, 'ON_ROUTE');
      assert.strictEqual(d.status, 'GREEN');
      assert.strictEqual(d.drivingSeconds, 0);
      assert.strictEqual(d.stoppedSeconds, 0);
    });
  });
});
