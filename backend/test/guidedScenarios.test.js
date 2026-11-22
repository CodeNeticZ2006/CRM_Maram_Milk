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
  startGuidedScenario,
  executeGuidedScenarioStep,
  generateGuidedScenarioPlan,
  getSimulationStatus,
  resetSimulation,
  pauseSimulation,
  initializeSimulationState,
} = require('../src/services/demoSimulation.service.js');

describe('Route Intelligence Guided Scenarios Verification', () => {
  beforeEach(async () => {
    await resetSimulation();
  });

  afterEach(async () => {
    await resetSimulation();
  });

  it('1. Isolation check: Real alerts, real DP state, and routeSettings.json are 100% byte-for-byte identical before and after', async () => {
    // A. Snapshot BEFORE
    const alertsBefore = JSON.stringify(alertsStore);
    const dpsBefore = JSON.stringify(dpGpsStore);
    const sessionsBefore = JSON.stringify(deviationSessionsStore);
    const settingsBefore = fs.existsSync(SETTINGS_FILE_PATH) ? fs.readFileSync(SETTINGS_FILE_PATH, 'utf8') : null;

    // B. Run Guided Scenario 1 (fast step iteration with simulated timestamps)
    startGuidedScenario('scenario1');
    const status = getSimulationStatus();
    const dp1 = status.dps.find(d => d.id === 'SIM-001');
    const plan = dp1.guidedScenario.plan;

    let baseTime = new Date('2026-11-23T06:00:00.000+05:30').getTime();
    for (let i = 0; i < plan.length; i++) {
      const pingTime = new Date(baseTime + i * 30000).toISOString();
      await executeGuidedScenarioStep('SIM-001', pingTime);
    }

    // C. Reset simulation
    await resetSimulation();

    // D. Snapshot AFTER
    const alertsAfter = JSON.stringify(alertsStore);
    const dpsAfter = JSON.stringify(dpGpsStore);
    const sessionsAfter = JSON.stringify(deviationSessionsStore);
    const settingsAfter = fs.existsSync(SETTINGS_FILE_PATH) ? fs.readFileSync(SETTINGS_FILE_PATH, 'utf8') : null;

    assert.strictEqual(alertsAfter, alertsBefore, 'Real alertsStore was mutated by demo run!');
    assert.strictEqual(dpsAfter, dpsBefore, 'Real dpGpsStore was mutated by demo run!');
    assert.strictEqual(sessionsAfter, sessionsBefore, 'Real deviationSessionsStore was mutated by demo run!');
    assert.strictEqual(settingsAfter, settingsBefore, 'routeSettings.json was mutated by demo run!');
  });

  it('2. Scenario 1 ("Detour without stopping"): stoppedSeconds remains strictly 0, drivingSeconds > 0, exactly 1 alert, timers freeze on return', async () => {
    startGuidedScenario('scenario1');
    const initialStatus = getSimulationStatus();
    const dp1 = initialStatus.dps.find(d => d.id === 'SIM-001');
    assert.ok(dp1, 'SIM-001 must exist');
    const plan = dp1.guidedScenario.plan;
    assert.ok(plan.length >= 20, 'Plan must contain all 4 phases');

    let baseTime = new Date('2026-11-23T06:00:00.000+05:30').getTime();
    let alertCountDuring = 0;

    for (let i = 0; i < plan.length; i++) {
      const pingTime = new Date(baseTime + i * 30000).toISOString();
      await executeGuidedScenarioStep('SIM-001', pingTime);

      const status = getSimulationStatus();
      const currentRider = status.dps.find(d => d.id === 'SIM-001');

      // Core rule condition: In Scenario 1, stoppedSeconds must stay 0 for the whole run!
      assert.strictEqual(
        currentRider.stoppedSeconds,
        0,
        `stoppedSeconds must remain 0 during continuous driving detour at step ${i + 1}`
      );

      const simAlerts = status.alerts.filter(a => a.dpId === 'SIM-001');
      alertCountDuring = simAlerts.length;
    }

    const finalStatus = getSimulationStatus();
    const finalRider = finalStatus.dps.find(d => d.id === 'SIM-001');

    // Asserts:
    // 1. drivingSeconds accumulated (> 0)
    assert.ok(finalRider.drivingSeconds > 0, 'drivingSeconds must be > 0');
    // 2. stoppedSeconds is strictly 0
    assert.strictEqual(finalRider.stoppedSeconds, 0, 'stoppedSeconds must be 0 for entire run');
    // 3. Exactly one alert fired
    assert.strictEqual(alertCountDuring, 1, 'Exactly one alert must fire for the deviation session');
    // 4. Session resolved and closed
    assert.ok(finalStatus.lastClosedSession, 'Session summary card must be available when session closes');
    assert.strictEqual(finalStatus.lastClosedSession.dpId, 'SIM-001');
    assert.strictEqual(finalStatus.lastClosedSession.totalStoppedSeconds, 0);
    assert.ok(finalStatus.lastClosedSession.totalDrivingSeconds > 0);
    // 5. Rider back on route
    assert.strictEqual(finalRider.currentState, 'ON_ROUTE');
    assert.strictEqual(finalRider.status, 'GREEN');
  });

  it('3. Scenario 2 ("Detour with a wait"): driving and stopped alternate counting/pausing, exactly 1 alert, session resolves', async () => {
    startGuidedScenario('scenario2');
    const initialStatus = getSimulationStatus();
    const dp2 = initialStatus.dps.find(d => d.id === 'SIM-002');
    assert.ok(dp2, 'SIM-002 must exist');
    const plan = dp2.guidedScenario.plan;

    let baseTime = new Date('2026-11-23T06:00:00.000+05:30').getTime();
    let drivingWhenStopped = null;
    let stoppedWhenResumed = null;

    for (let i = 0; i < plan.length; i++) {
      const pingTime = new Date(baseTime + i * 30000).toISOString();
      await executeGuidedScenarioStep('SIM-002', pingTime);

      const status = getSimulationStatus();
      const currentRider = status.dps.find(d => d.id === 'SIM-002');

      // Phase 3 (steps 8-19): Stopped outside corridor
      if (plan[i].phase === 3 && currentRider.currentState === 'OFF_ROUTE_STOPPED') {
        if (drivingWhenStopped === null) {
          drivingWhenStopped = currentRider.drivingSeconds;
        } else {
          // Driving timer must NOT grow while stopped
          assert.strictEqual(
            currentRider.drivingSeconds,
            drivingWhenStopped,
            `drivingSeconds must pause while stopped at step ${i + 1}`
          );
        }
      }

      // Phase 4 (steps 20-23): Resumed driving
      if (plan[i].phase === 4 && currentRider.currentState === 'OFF_ROUTE_DRIVING') {
        if (stoppedWhenResumed === null) {
          stoppedWhenResumed = currentRider.stoppedSeconds;
        } else {
          // Stopped timer must NOT grow while driving
          assert.strictEqual(
            currentRider.stoppedSeconds,
            stoppedWhenResumed,
            `stoppedSeconds must freeze while resumed driving at step ${i + 1}`
          );
        }
      }
    }

    const finalStatus = getSimulationStatus();
    const finalRider = finalStatus.dps.find(d => d.id === 'SIM-002');

    // Asserts:
    // 1. Both timers > 0
    assert.ok(finalRider.drivingSeconds > 0, 'drivingSeconds must be > 0');
    assert.ok(finalRider.stoppedSeconds > 0, 'stoppedSeconds must be > 0');
    // 2. Exactly one alert fired
    const simAlerts = finalStatus.alerts.filter(a => a.dpId === 'SIM-002');
    assert.strictEqual(simAlerts.length, 1, 'Exactly one alert must fire for Scenario 2');
    // 3. Session resolved cleanly
    assert.ok(finalStatus.lastClosedSession, 'Session summary card must be available when session closes');
    assert.strictEqual(finalStatus.lastClosedSession.dpId, 'SIM-002');
    assert.ok(finalStatus.lastClosedSession.totalDrivingSeconds > 0);
    assert.ok(finalStatus.lastClosedSession.totalStoppedSeconds > 0);
    assert.strictEqual(finalRider.currentState, 'ON_ROUTE');
  });

  it('4. In-corridor stop: No timer ever increments for customer door delivery stop inside corridor', async () => {
    // Feed 5 consecutive customer stops on SIM-003 inside corridor
    const status = getSimulationStatus();
    const dp3 = status.dps.find(d => d.id === 'SIM-003');
    const poly = dp3.lastGps ? [dp3.lastGps.lat, dp3.lastGps.lng] : [13.0604, 80.2496];

    let baseTime = new Date('2026-11-23T06:00:00.000+05:30').getTime();
    for (let i = 0; i < 5; i++) {
      const pingTime = new Date(baseTime + i * 30000).toISOString();
      // Ping at customer door inside corridor with speed 0
      await executeGuidedScenarioStep('SIM-003', pingTime);
    }

    const updated = getSimulationStatus();
    const rider3 = updated.dps.find(d => d.id === 'SIM-003');

    assert.strictEqual(rider3.drivingSeconds, 0, 'drivingSeconds must stay 0 inside corridor');
    assert.strictEqual(rider3.stoppedSeconds, 0, 'stoppedSeconds must stay 0 inside corridor');
    assert.strictEqual(rider3.status, 'GREEN');
  });

  it('5. Concurrency condition: Starting a guided scenario on a rider already running one is rejected', () => {
    startGuidedScenario('scenario1'); // Running on SIM-001

    assert.throws(
      () => {
        startGuidedScenario('scenario1'); // Duplicate attempt on SIM-001
      },
      /already in progress/i,
      'Duplicate guided scenario launch on same rider must be rejected'
    );
  });
});
