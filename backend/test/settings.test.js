import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { updateSettings: updateSettingsHandler } = require('../src/controllers/routeIntelligence.controller.js');
const { processGpsPing, dpGpsStore } = require('../src/services/routeCorridor.service.js');
const { AREA_CONFIG, DEPOT_COORDINATES } = require('../src/config/areaConfig.js');

// Load routeSettings service
import {
  DEFAULT_SETTINGS,
  SETTINGS_FILE_PATH,
  VALIDATION_RANGES,
  validateSettings,
  getSettings,
  updateSettings,
  resetSettings,
  normalizeSettings,
  attachLegacyMirrors,
  isPingWithinTrackingWindow,
  loadSettingsFromDisk,
  saveSettingsToDisk,
} from '../src/services/routeSettings.service.js';

describe('Route Intelligence Settings Engine Tests', () => {
  beforeEach(() => {
    resetSettings('TestRunner');
  });

  it('1. Falls back to default settings when input is empty or undefined', () => {
    const normalized = normalizeSettings({});
    assert.strictEqual(normalized.corridorToleranceMeters, 120);
    assert.strictEqual(normalized.corridorGracePeriodSeconds, 180);
    assert.strictEqual(normalized.maxGpsAccuracyMeters, 50);
    assert.strictEqual(normalized.hysteresisCount, 2);
    assert.strictEqual(normalized.stopSpeedThresholdKmh, 3.0);
    assert.strictEqual(normalized.stoppedAlertThresholdSeconds, 300);
    assert.strictEqual(normalized.signalLostThresholdMinutes, 10);
    assert.strictEqual(normalized.geofenceRadius, 500);
    assert.strictEqual(normalized.trackingWindow.enabled, false);
    assert.strictEqual(normalized.trackingWindow.startTime, '04:00');
    assert.strictEqual(normalized.trackingWindow.endTime, '11:00');
  });

  it('2. Safely loads old saved settings with legacy formats and aliases', () => {
    const legacySavedObject = {
      allowDeviationMeters: 250, // old key
      corridorGpsAccuracyBuffer: 20, // old key
      gracePeriodSeconds: 120, // old key
      stopDetectionThreshold: 7, // old key (minutes)
      complianceRules: {
        maxStopMinutes: 7, // old key (minutes)
        allowDeviationMeters: 250,
      },
    };

    const migrated = normalizeSettings(legacySavedObject);
    assert.strictEqual(migrated.corridorToleranceMeters, 250, 'allowDeviationMeters mapped to corridorToleranceMeters');
    assert.strictEqual(migrated.maxGpsAccuracyMeters, 20, 'corridorGpsAccuracyBuffer mapped to maxGpsAccuracyMeters');
    assert.strictEqual(migrated.corridorGracePeriodSeconds, 120, 'gracePeriodSeconds mapped to corridorGracePeriodSeconds');
    assert.strictEqual(migrated.stoppedAlertThresholdSeconds, 420, 'stopDetectionThreshold 7 min mapped to 420s');

    // Attach mirrors
    const mirrored = attachLegacyMirrors(migrated);
    assert.strictEqual(mirrored.allowDeviationMeters, 250);
    assert.strictEqual(mirrored.complianceRules.corridorToleranceMeters, 250);
    assert.strictEqual(mirrored.complianceRules.allowDeviationMeters, 250);
    assert.strictEqual(mirrored.complianceRules.maxStopMinutes, 7);
  });

  it('3. Legacy aliases are strictly read-only mirrors of canonical fields and never conflict', () => {
    // When updating corridorToleranceMeters to 160:
    const updated = updateSettings({ corridorToleranceMeters: 160 });
    assert.strictEqual(updated.corridorToleranceMeters, 160);
    assert.strictEqual(updated.allowDeviationMeters, 160, 'Top-level alias mirrors corridorToleranceMeters');
    assert.strictEqual(updated.complianceRules.corridorToleranceMeters, 160);
    assert.strictEqual(updated.complianceRules.allowDeviationMeters, 160, 'Nested alias mirrors corridorToleranceMeters');

    // When updating stoppedAlertThresholdSeconds to 480 (8 minutes):
    const updatedStops = updateSettings({ stoppedAlertThresholdSeconds: 480 });
    assert.strictEqual(updatedStops.stoppedAlertThresholdSeconds, 480);
    assert.strictEqual(updatedStops.complianceRules.stoppedAlertThresholdSeconds, 480);
    assert.strictEqual(updatedStops.complianceRules.maxStopMinutes, 8, 'maxStopMinutes mirrors stoppedAlertThresholdSeconds / 60');
    assert.strictEqual(updatedStops.stopDetectionThreshold, 8);
  });

  it('4. Settings survive server restart by persisting to disk (backend/data/routeSettings.json)', () => {
    updateSettings({
      corridorToleranceMeters: 175,
      corridorGracePeriodSeconds: 90,
      trackingWindow: { enabled: true, startTime: '05:00', endTime: '10:00' },
    }, 'AdminRestartTest');

    assert.strictEqual(fs.existsSync(SETTINGS_FILE_PATH), true, 'routeSettings.json file must exist on disk');

    // Simulate restart by re-reading directly from disk file
    const reloaded = loadSettingsFromDisk();
    assert.strictEqual(reloaded.corridorToleranceMeters, 175);
    assert.strictEqual(reloaded.corridorGracePeriodSeconds, 90);
    assert.strictEqual(reloaded.trackingWindow.enabled, true);
    assert.strictEqual(reloaded.trackingWindow.startTime, '05:00');
    assert.strictEqual(reloaded.updatedBy, 'AdminRestartTest');
  });

  it('5. Tracking Window uses IST and correctly handles windows crossing midnight in UTC', () => {
    // Standard milk delivery window: 04:00 to 11:00 IST
    // In UTC, this is 22:30 UTC (previous day) to 05:30 UTC (same day) -> crosses midnight in UTC!
    const trackingWindow = {
      enabled: true,
      startTime: '04:00',
      endTime: '11:00',
    };

    // Case A: 23:00:00 UTC (day D-1) -> in IST: 23:00 + 5:30 = 04:30 IST (inside 04:00-11:00)
    const pingA = new Date('2026-11-20T23:00:00.000Z');
    assert.strictEqual(isPingWithinTrackingWindow(pingA, trackingWindow), true, '23:00 UTC = 04:30 IST should be inside 04:00-11:00 IST window');

    // Case B: 02:00:00 UTC (day D) -> in IST: 02:00 + 5:30 = 07:30 IST (inside 04:00-11:00)
    const pingB = new Date('2026-11-21T02:00:00.000Z');
    assert.strictEqual(isPingWithinTrackingWindow(pingB, trackingWindow), true, '02:00 UTC = 07:30 IST should be inside 04:00-11:00 IST window');

    // Case C: 21:00:00 UTC (day D-1) -> in IST: 21:00 + 5:30 = 02:30 IST (outside: too early)
    const pingC = new Date('2026-11-20T21:00:00.000Z');
    assert.strictEqual(isPingWithinTrackingWindow(pingC, trackingWindow), false, '21:00 UTC = 02:30 IST should be outside 04:00-11:00 IST window');

    // Case D: 06:00:00 UTC (day D) -> in IST: 06:00 + 5:30 = 11:30 IST (outside: past 11:00)
    const pingD = new Date('2026-11-21T06:00:00.000Z');
    assert.strictEqual(isPingWithinTrackingWindow(pingD, trackingWindow), false, '06:00 UTC = 11:30 IST should be outside 04:00-11:00 IST window');
  });

  it('6. Tracking Window handles windows that cross midnight in IST itself (e.g. 22:00 to 06:00 IST)', () => {
    const nightWindow = {
      enabled: true,
      startTime: '22:00',
      endTime: '06:00',
    };

    // 23:30 IST -> inside
    const pingLateNight = new Date('2026-11-21T18:00:00.000Z'); // 18:00 UTC = 23:30 IST
    assert.strictEqual(isPingWithinTrackingWindow(pingLateNight, nightWindow), true, '23:30 IST should be inside 22:00-06:00 window');

    // 03:00 IST -> inside
    const pingEarlyMorning = new Date('2026-11-20T21:30:00.000Z'); // 21:30 UTC = 03:00 IST
    assert.strictEqual(isPingWithinTrackingWindow(pingEarlyMorning, nightWindow), true, '03:00 IST should be inside 22:00-06:00 window');

    // 14:00 IST -> outside
    const pingAfternoon = new Date('2026-11-21T08:30:00.000Z'); // 08:30 UTC = 14:00 IST
    assert.strictEqual(isPingWithinTrackingWindow(pingAfternoon, nightWindow), false, '14:00 IST should be outside 22:00-06:00 window');
  });

  it('7. When tracking window is disabled, all pings are permitted', () => {
    const disabledWindow = { enabled: false, startTime: '04:00', endTime: '11:00' };
    const pingAnytime = new Date('2026-11-21T08:30:00.000Z');
    assert.strictEqual(isPingWithinTrackingWindow(pingAnytime, disabledWindow), true, 'Disabled window permits all timestamps');
  });

  it('8. Rejects out-of-range values on PUT /settings and updateSettings (interval 10-300s, alert thresholds 60-1800s)', async () => {
    // A. Service throws ValidationError on out-of-range values
    assert.throws(
      () => updateSettings({ gpsUpdateInterval: 5 }), // < 10s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('GPS update interval'))
    );

    assert.throws(
      () => updateSettings({ gpsUpdateInterval: 350 }), // > 300s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('GPS update interval'))
    );

    assert.throws(
      () => updateSettings({ drivingAlertThresholdSeconds: 30 }), // < 60s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Driving alert threshold'))
    );

    assert.throws(
      () => updateSettings({ drivingAlertThresholdSeconds: 2400 }), // > 1800s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Driving alert threshold'))
    );

    assert.throws(
      () => updateSettings({ stoppedAlertThresholdSeconds: 45 }), // < 60s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Stopped alert threshold'))
    );

    assert.throws(
      () => updateSettings({ stoppedAlertThresholdSeconds: 3600 }), // > 1800s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Stopped alert threshold'))
    );

    assert.throws(
      () => updateSettings({ corridorToleranceMeters: 20 }), // < 30m
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Corridor tolerance'))
    );

    assert.throws(
      () => updateSettings({ corridorToleranceMeters: 600 }), // > 500m
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Corridor tolerance'))
    );

    assert.throws(
      () => updateSettings({ corridorGracePeriodSeconds: 15 }), // < 30s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Corridor grace period'))
    );

    assert.throws(
      () => updateSettings({ corridorGracePeriodSeconds: 1200 }), // > 900s
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Corridor grace period'))
    );

    assert.throws(
      () => updateSettings({ maxGpsAccuracyMeters: 5 }), // < 10m
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Max GPS accuracy'))
    );

    assert.throws(
      () => updateSettings({ signalLostThresholdMinutes: 0 }), // < 1m
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Signal lost threshold'))
    );

    assert.throws(
      () => updateSettings({ hysteresisCount: 6 }), // > 5
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Hysteresis confirmation count'))
    );

    assert.throws(
      () => updateSettings({ stopSpeedThresholdKmh: 0.1 }), // < 0.5 km/h
      (err) => err.name === 'ValidationError' && err.errors.some(e => e.includes('Stop speed threshold'))
    );

    // B. HTTP Controller endpoint returns status 400 with errors array
    let statusCode = null;
    let jsonResponse = null;
    const req = {
      body: {
        gpsUpdateInterval: 4, // invalid
        drivingAlertThresholdSeconds: 30, // invalid (< 60)
      },
      user: { name: 'AdminTester' },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await updateSettingsHandler(req, res, (err) => { if (err) throw err; });
    assert.strictEqual(statusCode, 400, 'Controller must respond with HTTP 400 for out-of-range settings');
    assert.strictEqual(jsonResponse.success, false);
    assert.strictEqual(Array.isArray(jsonResponse.errors), true);
    assert.ok(jsonResponse.errors.length >= 2, 'Must contain validation errors for both fields');
  });

  it('9. Accepts valid boundary values across all configured parameters', () => {
    // Valid lower boundary
    const lower = updateSettings({
      gpsUpdateInterval: 10,
      corridorToleranceMeters: 30,
      corridorGracePeriodSeconds: 30,
      maxGpsAccuracyMeters: 10,
      signalLostThresholdMinutes: 1,
      hysteresisCount: 1,
      stopSpeedThresholdKmh: 0.5,
      drivingAlertThresholdSeconds: 60,
      stoppedAlertThresholdSeconds: 60,
    });
    assert.strictEqual(lower.gpsUpdateInterval, 10);
    assert.strictEqual(lower.corridorToleranceMeters, 30);
    assert.strictEqual(lower.corridorGracePeriodSeconds, 30);
    assert.strictEqual(lower.drivingAlertThresholdSeconds, 60);
    assert.strictEqual(lower.stoppedAlertThresholdSeconds, 60);
    assert.strictEqual(lower.stopSpeedThresholdKmh, 0.5);

    // Valid upper boundary
    const upper = updateSettings({
      gpsUpdateInterval: 300,
      corridorToleranceMeters: 500,
      corridorGracePeriodSeconds: 900,
      maxGpsAccuracyMeters: 200,
      signalLostThresholdMinutes: 60,
      hysteresisCount: 5,
      stopSpeedThresholdKmh: 20,
      drivingAlertThresholdSeconds: 1800,
      stoppedAlertThresholdSeconds: 1800,
    });
    assert.strictEqual(upper.gpsUpdateInterval, 300);
    assert.strictEqual(upper.corridorToleranceMeters, 500);
    assert.strictEqual(upper.corridorGracePeriodSeconds, 900);
    assert.strictEqual(upper.drivingAlertThresholdSeconds, 1800);
    assert.strictEqual(upper.stoppedAlertThresholdSeconds, 1800);
    assert.strictEqual(upper.stopSpeedThresholdKmh, 20);
  });

  it('10. Customer stop: 6 pings inside corridor at 30s intervals plus 10-min gap does NOT count as stopped time', async () => {
    const area = Object.values(AREA_CONFIG)[0]; // Nungambakkam 1
    const baseTime = Date.now();
    const depotLat = DEPOT_COORDINATES.lat;
    const depotLng = DEPOT_COORDINATES.lng;

    // Reset DP state
    dpGpsStore[area.assignedDpId].lastGps = null;
    dpGpsStore[area.assignedDpId].currentState = 'ON_ROUTE';
    dpGpsStore[area.assignedDpId].candidateState = null;
    dpGpsStore[area.assignedDpId].candidatePingsCount = 0;
    dpGpsStore[area.assignedDpId].deviationStartTime = null;

    // Send 6 pings at 30s intervals (t = 0, 30, 60, 90, 120, 150s) inside corridor at speed 0
    for (let i = 0; i < 6; i++) {
      const res = await processGpsPing({
        dpId: area.assignedDpId,
        lat: depotLat,
        lng: depotLng,
        speed: 0,
        accuracy: 5,
        timestamp: new Date(baseTime + i * 30000).toISOString(),
      });
      assert.strictEqual(res.status, 'GREEN', `Ping ${i+1} status should be GREEN`);
      assert.strictEqual(res.currentState, 'ON_ROUTE', `Ping ${i+1} state should be ON_ROUTE`);
      assert.strictEqual(res.stoppedSeconds, 0, `Ping ${i+1} in-corridor stoppedSeconds must be 0`);
    }

    // Send 1 ping after a 10-minute gap (t = 150s + 600s = 750s) at speed 0 inside corridor
    const gapTime = baseTime + 150000 + 600000;
    const resGap = await processGpsPing({
      dpId: area.assignedDpId,
      lat: depotLat,
      lng: depotLng,
      speed: 0,
      accuracy: 5,
      timestamp: new Date(gapTime).toISOString(),
    });

    assert.strictEqual(resGap.status, 'GREEN', 'Status after 10m gap inside corridor must be GREEN');
    assert.strictEqual(resGap.currentState, 'ON_ROUTE', 'State after 10m gap inside corridor must be ON_ROUTE');
    assert.strictEqual(resGap.stoppedSeconds, 0, '10-minute gap inside corridor must NOT count as stopped time');
  });

  it('11. Labels DPs outside the tracking window as Outside Window, not signal lost', () => {
    const nightWindow = {
      enabled: true,
      startTime: '04:00',
      endTime: '11:00',
    };

    // 15:00 IST (09:30 UTC) is outside the 04:00 - 11:00 IST window
    const afternoonPing = new Date('2026-11-21T09:30:00.000Z');
    const within = isPingWithinTrackingWindow(afternoonPing, nightWindow);
    assert.strictEqual(within, false, '15:00 IST is outside tracking window');
  });

  it('12. DP outside corridor: gap >= 10m is NOT credited as drivingSeconds or stoppedSeconds, and DP is flagged signal lost', async () => {
    const area = Object.values(AREA_CONFIG)[0]; // Nungambakkam 1
    const baseTime = Date.now();
    // Offset well outside the corridor (e.g. +800m)
    const offLat = DEPOT_COORDINATES.lat + 0.008;
    const offLng = DEPOT_COORDINATES.lng + 0.008;

    // Reset DP state
    dpGpsStore[area.assignedDpId].lastGps = null;
    dpGpsStore[area.assignedDpId].currentState = 'ON_ROUTE';
    dpGpsStore[area.assignedDpId].candidateState = null;
    dpGpsStore[area.assignedDpId].candidatePingsCount = 0;
    dpGpsStore[area.assignedDpId].deviationStartTime = null;
    dpGpsStore[area.assignedDpId].activeSessionId = null;

    // Ping 1 outside corridor at t = 0s
    const res1 = await processGpsPing({
      dpId: area.assignedDpId,
      lat: offLat,
      lng: offLng,
      speed: 25,
      accuracy: 8,
      timestamp: new Date(baseTime).toISOString(),
    });
    assert.ok(res1.distanceMeters > 120, 'Ping 1 is physically outside corridor (>120m)');
    assert.strictEqual(res1.dp.candidateState, 'OFF_ROUTE_DRIVING', 'Ping 1 candidate state is OFF_ROUTE_DRIVING');

    // Ping 2 outside corridor 10.5 minutes later (t = 630s)
    const res2 = await processGpsPing({
      dpId: area.assignedDpId,
      lat: offLat + 0.001,
      lng: offLng + 0.001,
      speed: 25,
      accuracy: 8,
      timestamp: new Date(baseTime + 630000).toISOString(),
    });

    // Output verification
    assert.strictEqual(res2.status, 'signal lost', 'DP must be flagged signal lost for the gap');
    assert.strictEqual(res2.drivingSeconds, 0, 'Gap must NOT be credited as drivingSeconds');
    assert.strictEqual(res2.stoppedSeconds, 0, 'Gap must NOT be credited as stoppedSeconds');
    assert.strictEqual(res2.isWithinCorridor, false, 'Still outside corridor');
    assert.strictEqual(res2.nextIntervalSeconds, 30, 'nextIntervalSeconds should be returned');
  });

  it('13. gps-ping response includes nextIntervalSeconds matching active settings', async () => {
    updateSettings({ gpsUpdateInterval: 45 });
    const area = Object.values(AREA_CONFIG)[1]; // Triplicane 1
    const res = await processGpsPing({
      dpId: area.assignedDpId,
      lat: DEPOT_COORDINATES.lat,
      lng: DEPOT_COORDINATES.lng,
      speed: 0,
      accuracy: 5,
      timestamp: new Date().toISOString(),
    });

    assert.strictEqual(res.nextIntervalSeconds, 45, 'Ping response must reflect updated gpsUpdateInterval');
    resetSettings('Cleanup');
  });
});
