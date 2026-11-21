const test = require('node:test');
const assert = require('node:assert/strict');

const {
  pointToSegmentDistanceMeters,
  pointToPolylineDistanceMeters,
  optimizeRouteStops,
  processGpsPing,
  dpGpsStore,
  alertsStore,
  deviationSessionsStore,
} = require('../src/services/routeCorridor.service');
const { DEPOT_COORDINATES, AREA_CONFIG } = require('../src/config/areaConfig');

test('1. pointToSegmentDistanceMeters calculates accurate perpendicular distance', () => {
  // Segment along latitude line at ~13.06 N
  const aLat = 13.0600, aLng = 80.2400;
  const bLat = 13.0600, bLng = 80.2500;

  // Point exactly on the segment
  const distOnLine = pointToSegmentDistanceMeters(13.0600, 80.2450, aLat, aLng, bLat, bLng);
  assert.ok(distOnLine < 0.1, `Expected <0.1m, got ${distOnLine}`);

  // Point offset perpendicular by 0.001 deg latitude (~111m)
  const distPerp = pointToSegmentDistanceMeters(13.0610, 80.2450, aLat, aLng, bLat, bLng);
  assert.ok(distPerp >= 105 && distPerp <= 115, `Expected ~111m, got ${distPerp}`);
});

test('2. pointToPolylineDistanceMeters calculates minimum distance to multi-segment path', () => {
  const polyline = [
    [13.0600, 80.2400],
    [13.0600, 80.2500],
    [13.0700, 80.2500],
  ];

  // Point near segment 1
  const d1 = pointToPolylineDistanceMeters(13.0605, 80.2450, polyline);
  assert.ok(d1 >= 50 && d1 <= 60, `Expected ~55m, got ${d1}`);

  // Point directly on segment 2
  const d2 = pointToPolylineDistanceMeters(13.0650, 80.2500, polyline);
  assert.ok(d2 < 0.1, `Expected <0.1m, got ${d2}`);
});

test('3. optimizeRouteStops performs Nearest-Neighbour and 2-Opt ordering from Depot', () => {
  const depot = { lat: 13.0604, lng: 80.2496 };
  const stops = [
    { name: 'Stop Far', lat: 13.0800, lng: 80.2800 },
    { name: 'Stop Near', lat: 13.0610, lng: 80.2500 },
    { name: 'Stop Mid', lat: 13.0700, lng: 80.2600 },
  ];

  const ordered = optimizeRouteStops(depot, stops);
  assert.equal(ordered.length, 3);
  // First stop visited should be 'Stop Near'
  assert.equal(ordered[0].name, 'Stop Near');
});

test('4. State Machine: drops noisy GPS pings with accuracy > 50m', async () => {
  const area = Object.values(AREA_CONFIG)[0];
  const res = await processGpsPing({
    dpId: area.assignedDpId,
    lat: 13.0604,
    lng: 80.2496,
    speed: 15,
    accuracy: 65, // Noisy: > 50m
    timestamp: new Date().toISOString(),
  });

  assert.equal(res.success, false);
  assert.equal(res.dropped, true);
  assert.match(res.reason, /GPS accuracy.*worse than threshold/);
});

test('5. State Machine: In-corridor stops do NOT count as off-route stopped time', async () => {
  const area = Object.values(AREA_CONFIG)[0];
  const dpId = area.assignedDpId;

  // Reset
  alertsStore.length = 0;
  deviationSessionsStore.length = 0;
  dpGpsStore[dpId].status = 'GREEN';
  dpGpsStore[dpId].candidatePingsCount = 0;
  dpGpsStore[dpId].activeSessionId = null;

  // Send 3 pings inside corridor with speed = 0 (stopped at customer door)
  const now = Date.now();
  for (let i = 0; i < 3; i++) {
    const res = await processGpsPing({
      dpId,
      lat: DEPOT_COORDINATES.lat,
      lng: DEPOT_COORDINATES.lng,
      speed: 0,
      accuracy: 5,
      timestamp: new Date(now + i * 30000).toISOString(),
    });
    assert.equal(res.status, 'GREEN');
    assert.equal(res.isWithinCorridor, true);
  }

  // Verify no deviation sessions or alerts exist
  assert.equal(deviationSessionsStore.length, 0);
  assert.equal(alertsStore.length, 0);
});

test('6. State Machine: Hysteresis requires 2 consecutive pings to transition to off-route', async () => {
  const area = Object.values(AREA_CONFIG)[0];
  const dpId = area.assignedDpId;

  // Reset
  alertsStore.length = 0;
  deviationSessionsStore.length = 0;
  dpGpsStore[dpId].currentState = 'ON_ROUTE';
  dpGpsStore[dpId].candidateState = null;
  dpGpsStore[dpId].candidatePingsCount = 0;
  dpGpsStore[dpId].lastGps = null;

  const now = Date.now();

  // Ping 1: Off-route point ~800m away
  const res1 = await processGpsPing({
    dpId,
    lat: 13.0750,
    lng: 80.2750,
    speed: 30,
    accuracy: 8,
    timestamp: new Date(now).toISOString(),
  });
  // Hysteresis ping 1: candidate updated, currentState remains ON_ROUTE
  assert.equal(res1.currentState, 'ON_ROUTE');

  // Ping 2: Second consecutive off-route ping
  const res2 = await processGpsPing({
    dpId,
    lat: 13.0760,
    lng: 80.2760,
    speed: 30,
    accuracy: 8,
    timestamp: new Date(now + 30000).toISOString(),
  });
  // Hysteresis ping 2: confirmed transition to OFF_ROUTE_DRIVING
  assert.equal(res2.currentState, 'OFF_ROUTE_DRIVING');
});
