// ==============================================================================
// ROUTE INTELLIGENCE — ISOLATED DEMO SIMULATION SERVICE
// 100% in-memory simulation engine for live demos.
// ZERO database writes, ZERO mutations to real tables or files.
// ==============================================================================

const {
  processGpsPing,
  pointToPolylineDistanceMeters,
  getRouteCorridors,
} = require('./routeCorridor.service');
const { getSettings } = require('./routeSettings.service');
const { DEPOT_COORDINATES } = require('../config/areaConfig');

// Canonical 5 Simulated Delivery Partners (Mapped 1:1 to Real Areas)
const SIMULATED_DP_CONFIG = [
  {
    id: 'SIM-001',
    dpCode: 'SIM-001',
    name: 'Demo Rider 1',
    initials: 'DR1',
    areaId: '1b4a924f-1a3c-4658-9e23-a2a060917ac2',
    areaName: 'Nungambakkam 1',
    areaColor: '#2563eb',
    mobile: '+91 99999 00001',
    vehicle: 'TN-01-SIM-01',
  },
  {
    id: 'SIM-002',
    dpCode: 'SIM-002',
    name: 'Demo Rider 2',
    initials: 'DR2',
    areaId: '9835f558-456c-423f-985b-f21b981172d6',
    areaName: 'Triplicane 1',
    areaColor: '#059669',
    mobile: '+91 99999 00002',
    vehicle: 'TN-01-SIM-02',
  },
  {
    id: 'SIM-003',
    dpCode: 'SIM-003',
    name: 'Demo Rider 3',
    initials: 'DR3',
    areaId: '59311df6-345e-47d8-97c6-f71c0f64e1eb',
    areaName: 'Teynampet 1',
    areaColor: '#d97706',
    mobile: '+91 99999 00003',
    vehicle: 'TN-01-SIM-03',
  },
  {
    id: 'SIM-004',
    dpCode: 'SIM-004',
    name: 'Demo Rider 4',
    initials: 'DR4',
    areaId: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9',
    areaName: 'Mandaveli 2',
    areaColor: '#7c3aed',
    mobile: '+91 99999 00004',
    vehicle: 'TN-01-SIM-04',
  },
  {
    id: 'SIM-005',
    dpCode: 'SIM-005',
    name: 'Demo Rider 5',
    initials: 'DR5',
    areaId: '9f3ffe40-d485-4995-9dd0-ac74735c6402',
    areaName: 'Royapettah 2',
    areaColor: '#dc2626',
    mobile: '+91 99999 00005',
    vehicle: 'TN-01-SIM-05',
  },
];

// Isolated In-Memory Simulation Stores
let isolatedDpGpsStore = {};
let isolatedAlertsStore = [];
let isolatedDeviationSessionsStore = [];
let isolatedPingsHistory = {}; // dpId -> Array of pings
let lastClosedSession = null; // Summary of most recently closed deviation session

// Simulation State
let isRunning = false;
let speedMultiplier = 5; // default 5x
let simulatedClockMs = new Date('2026-11-23T06:00:00.000+05:30').getTime();
let lastRealTickTime = null;
let tickTimer = null;
let accumulatedSimMs = 0;

// Per-DP runtime state
const dpRuntimeState = {};

// Default synchronous bootstrap so simulated DPs are immediately available on module import
SIMULATED_DP_CONFIG.forEach(cfg => {
  const defaultPolyline = [
    [DEPOT_COORDINATES.lat, DEPOT_COORDINATES.lng],
    [DEPOT_COORDINATES.lat + 0.002, DEPOT_COORDINATES.lng + 0.002],
    [DEPOT_COORDINATES.lat + 0.004, DEPOT_COORDINATES.lng + 0.004],
  ];
  isolatedDpGpsStore[cfg.id] = {
    id: cfg.id,
    name: cfg.name,
    dpCode: cfg.dpCode,
    initials: cfg.initials,
    assignedRouteId: cfg.areaId,
    assignedRouteName: cfg.areaName,
    assignedAreaColor: cfg.areaColor,
    mobile: cfg.mobile,
    vehicle: cfg.vehicle,
    status: 'GREEN',
    currentState: 'ON_ROUTE',
    lastGps: {
      lat: defaultPolyline[0][0],
      lng: defaultPolyline[0][1],
      speed: 24,
      accuracy: 5,
      heading: 45,
      timestamp: new Date(simulatedClockMs).toISOString(),
    },
    lastDistanceMeters: 0,
    candidateState: null,
    candidatePingsCount: 0,
    inCorridorConsecutivePings: 2,
    deviationStartTime: null,
    activeSessionId: null,
    source: 'simulator',
    isSimulated: true,
  };
  isolatedPingsHistory[cfg.id] = [];
  dpRuntimeState[cfg.id] = {
    polyline: defaultPolyline,
    currentStep: 0,
    scenario: 'on-route',
    scenarioStartedAt: null,
    offRoutePoint: null,
    deviationStepCount: 0,
    stoppedStepCount: 0,
    guidedScenario: null,
  };
});

/**
 * Clean up background timer on shutdown
 */
function cleanupTimer() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
process.on('SIGTERM', cleanupTimer);
process.on('SIGINT', cleanupTimer);
process.on('exit', cleanupTimer);

/**
 * Calculates bearing between two lat/lng points in degrees (0 - 360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Format simulated time in IST string
 */
function getSimulatedTimeFormatted() {
  const dateObj = new Date(simulatedClockMs);
  return dateObj.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' IST';
}

/**
 * Initializes simulation DP states
 */
async function initializeSimulationState() {
  const settings = getSettings();
  let corridorData = { routes: [] };
  try {
    corridorData = await getRouteCorridors(settings.corridorToleranceMeters || 120);
  } catch (e) {
    console.warn('⚠️ Demo simulation corridor lookup warning:', e.message);
  }

  isolatedDpGpsStore = {};
  isolatedAlertsStore = [];
  isolatedDeviationSessionsStore = [];
  isolatedPingsHistory = {};
  lastClosedSession = null;

  SIMULATED_DP_CONFIG.forEach(cfg => {
    const corr = corridorData.routes?.find(r => r.id === cfg.areaId || r.name === cfg.areaName);
    const polyline = corr && corr.polyline && corr.polyline.length >= 2
      ? corr.polyline
      : [
          [DEPOT_COORDINATES.lat, DEPOT_COORDINATES.lng],
          [DEPOT_COORDINATES.lat + 0.002, DEPOT_COORDINATES.lng + 0.002],
          [DEPOT_COORDINATES.lat + 0.004, DEPOT_COORDINATES.lng + 0.004],
        ];

    isolatedDpGpsStore[cfg.id] = {
      id: cfg.id,
      name: cfg.name,
      dpCode: cfg.dpCode,
      initials: cfg.initials,
      assignedRouteId: cfg.areaId,
      assignedRouteName: cfg.areaName,
      assignedAreaColor: cfg.areaColor,
      mobile: cfg.mobile,
      vehicle: cfg.vehicle,
      status: 'GREEN',
      currentState: 'ON_ROUTE',
      lastGps: {
        lat: polyline[0][0],
        lng: polyline[0][1],
        speed: 24,
        accuracy: 5,
        heading: calculateBearing(polyline[0][0], polyline[0][1], polyline[1][0], polyline[1][1]),
        timestamp: new Date(simulatedClockMs).toISOString(),
      },
      lastDistanceMeters: 0,
      candidateState: null,
      candidatePingsCount: 0,
      inCorridorConsecutivePings: 2,
      deviationStartTime: null,
      activeSessionId: null,
      source: 'simulator',
      isSimulated: true,
    };

    isolatedPingsHistory[cfg.id] = [];

    dpRuntimeState[cfg.id] = {
      polyline,
      currentStep: 0,
      scenario: 'on-route', // on-route | diversion | off-route-stopped | customer-stop | guided
      scenarioStartedAt: null,
      offRoutePoint: null,
      deviationStepCount: 0,
      stoppedStepCount: 0,
      guidedScenario: null, // { id, plan, stepIdx, isActive, isCompleted, currentStepInfo }
    };
  });
}

/**
 * Generates an automated, multi-step guided scenario trajectory
 * Dynamically computes off-route offset (at least corridor tolerance + 150m) from real corridor polyline
 */
function generateGuidedScenarioPlan(scenarioId, polyline, toleranceMeters = 120) {
  // Required offset: at least corridor tolerance + 150m
  const minOffsetMeters = toleranceMeters + 150; // e.g. 120 + 150 = 270m
  const targetOffsetMeters = minOffsetMeters + 80; // ~350m
  const degPerMeterLat = 1 / 111139;
  const degPerMeterLng = 1 / (111139 * Math.cos(DEPOT_COORDINATES.lat * Math.PI / 180));

  const steps = [];

  if (scenarioId === 'scenario1') {
    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 1: "Detour without stopping" (Demo Rider 1 / SIM-001)
    // ══════════════════════════════════════════════════════════════════════════

    // Step 1: Normal route progression for ~2 min (4 pings @ 30s)
    for (let i = 0; i < 4; i++) {
      const pt = polyline[i % polyline.length];
      const nextPt = polyline[(i + 1) % polyline.length];
      steps.push({
        phase: 1,
        stepIndex: 1,
        totalSteps: 4,
        phaseTitle: 'Step 1 of 4: Normal delivery along assigned corridor (~2 min)',
        phaseDetail: 'Riding normally along corridor. Timers = 0. Status = Compliant (Green).',
        lat: pt[0],
        lng: pt[1],
        speed: 25,
        heading: calculateBearing(pt[0], pt[1], nextPt[0], nextPt[1]),
        isOffRoute: false,
      });
    }

    // Step 2: Leaves corridor and drives off-route for ~6 min (12 pings @ 30s, speed ~25 km/h, NEVER stopping)
    const branchIdx = Math.min(3, polyline.length - 1);
    const basePt = polyline[branchIdx];
    const nextBase = polyline[(branchIdx + 1) % polyline.length];
    const segDLat = nextBase[0] - basePt[0];
    const segDLng = nextBase[1] - basePt[1];
    const segLen = Math.hypot(segDLat, segDLng) || 0.001;
    // Perpendicular unit vector
    const perpDLat = (-segDLng / segLen);
    const perpDLng = (segDLat / segLen);

    for (let i = 0; i < 12; i++) {
      const currentOffsetM = targetOffsetMeters + (i * 12);
      const offLat = basePt[0] + perpDLat * (currentOffsetM * degPerMeterLat);
      const offLng = basePt[1] + perpDLng * (currentOffsetM * degPerMeterLng);

      const isGrace = i < 6; // Under 180s grace period
      const detail = isGrace
        ? 'Driving off-corridor at 25 km/h. Grace countdown active (0-180s). Driving timer counts; stopped timer stays 0.'
        : 'Grace period expired (180s)! Off-route alert triggered once. Driving timer continues accumulating; stopped timer remains 0.';

      steps.push({
        phase: 2,
        stepIndex: 2,
        totalSteps: 4,
        phaseTitle: 'Step 2 of 4: Driving off-corridor without stopping (~6 min, Speed ~25 km/h)',
        phaseDetail: detail,
        lat: offLat,
        lng: offLng,
        speed: 25,
        heading: calculateBearing(basePt[0], basePt[1], offLat, offLng),
        isOffRoute: true,
      });
    }

    // Step 3: Returns to corridor (3 pings @ 30s)
    const returnPt1 = [
      basePt[0] + perpDLat * ((minOffsetMeters - 80) * degPerMeterLat),
      basePt[1] + perpDLng * ((minOffsetMeters - 80) * degPerMeterLng),
    ];
    const returnPt2 = polyline[(branchIdx + 4) % polyline.length];
    const returnPt3 = polyline[(branchIdx + 5) % polyline.length];

    steps.push({
      phase: 3,
      stepIndex: 3,
      totalSteps: 4,
      phaseTitle: 'Step 3 of 4: Rejoining assigned corridor and resolving deviation',
      phaseDetail: 'Rider steers back toward corridor.',
      lat: returnPt1[0],
      lng: returnPt1[1],
      speed: 24,
      heading: calculateBearing(returnPt1[0], returnPt1[1], returnPt2[0], returnPt2[1]),
      isOffRoute: false,
    });
    steps.push({
      phase: 3,
      stepIndex: 3,
      totalSteps: 4,
      phaseTitle: 'Step 3 of 4: Rejoining assigned corridor and resolving deviation',
      phaseDetail: 'First in-corridor confirmation ping received.',
      lat: returnPt2[0],
      lng: returnPt2[1],
      speed: 24,
      heading: calculateBearing(returnPt2[0], returnPt2[1], returnPt3[0], returnPt3[1]),
      isOffRoute: false,
    });
    steps.push({
      phase: 3,
      stepIndex: 3,
      totalSteps: 4,
      phaseTitle: 'Step 3 of 4: Rejoining assigned corridor and resolving deviation',
      phaseDetail: 'Second confirmation ping received. Deviation session CLOSED. Timers frozen.',
      lat: returnPt3[0],
      lng: returnPt3[1],
      speed: 24,
      heading: calculateBearing(returnPt2[0], returnPt2[1], returnPt3[0], returnPt3[1]),
      isOffRoute: false,
    });

    // Step 4: Continues on route normally (3 pings)
    for (let i = 0; i < 3; i++) {
      const curPt = polyline[(branchIdx + 6 + i) % polyline.length];
      const nextPt = polyline[(branchIdx + 7 + i) % polyline.length];
      steps.push({
        phase: 4,
        stepIndex: 4,
        totalSteps: 4,
        phaseTitle: 'Step 4 of 4: Resumed normal delivery corridor progression',
        phaseDetail: 'Rider back on schedule inside corridor.',
        lat: curPt[0],
        lng: curPt[1],
        speed: 24,
        heading: calculateBearing(curPt[0], curPt[1], nextPt[0], nextPt[1]),
        isOffRoute: false,
      });
    }
  } else if (scenarioId === 'scenario2') {
    // ══════════════════════════════════════════════════════════════════════════
    // SCENARIO 2: "Detour with a wait" (Demo Rider 2 / SIM-002)
    // ══════════════════════════════════════════════════════════════════════════

    // Step 1: Normal route progression for ~2 min (4 pings @ 30s)
    for (let i = 0; i < 4; i++) {
      const pt = polyline[i % polyline.length];
      const nextPt = polyline[(i + 1) % polyline.length];
      steps.push({
        phase: 1,
        stepIndex: 1,
        totalSteps: 5,
        phaseTitle: 'Step 1 of 5: Normal delivery along assigned corridor (~2 min)',
        phaseDetail: 'Riding normally on corridor. Timers = 0. Status = Compliant (Green).',
        lat: pt[0],
        lng: pt[1],
        speed: 24,
        heading: calculateBearing(pt[0], pt[1], nextPt[0], nextPt[1]),
        isOffRoute: false,
      });
    }

    // Step 2: Leaves corridor and drives ~2 min (4 pings @ 30s, driving timer counting)
    const branchIdx = Math.min(3, polyline.length - 1);
    const basePt = polyline[branchIdx];
    const nextBase = polyline[(branchIdx + 1) % polyline.length];
    const segDLat = nextBase[0] - basePt[0];
    const segDLng = nextBase[1] - basePt[1];
    const segLen = Math.hypot(segDLat, segDLng) || 0.001;
    const perpDLat = (-segDLng / segLen);
    const perpDLng = (segDLat / segLen);

    for (let i = 0; i < 4; i++) {
      const currentOffsetM = targetOffsetMeters + (i * 15);
      const offLat = basePt[0] + perpDLat * (currentOffsetM * degPerMeterLat);
      const offLng = basePt[1] + perpDLng * (currentOffsetM * degPerMeterLng);
      steps.push({
        phase: 2,
        stepIndex: 2,
        totalSteps: 5,
        phaseTitle: 'Step 2 of 5: Driving off-corridor to detour location (~2 min)',
        phaseDetail: 'Rider leaves corridor at 25 km/h. Driving timer counting; stopped timer = 0.',
        lat: offLat,
        lng: offLng,
        speed: 25,
        heading: calculateBearing(basePt[0], basePt[1], offLat, offLng),
        isOffRoute: true,
      });
    }

    // Step 3: Stops outside corridor for ~6 min (12 pings @ 30s, speed 0, same spot, small GPS noise)
    const stopOffsetM = targetOffsetMeters + 60;
    const stopLat = basePt[0] + perpDLat * (stopOffsetM * degPerMeterLat);
    const stopLng = basePt[1] + perpDLng * (stopOffsetM * degPerMeterLng);

    for (let i = 0; i < 12; i++) {
      const jitterLat = (Math.random() - 0.5) * 0.00002;
      const jitterLng = (Math.random() - 0.5) * 0.00002;
      const isAlertFired = i >= 6;
      steps.push({
        phase: 3,
        stepIndex: 3,
        totalSteps: 5,
        phaseTitle: 'Step 3 of 5: Stopped outside corridor (Waiting / Stop, Speed 0 km/h)',
        phaseDetail: isAlertFired
          ? 'Off-route stopped threshold reached: Alert fired once! Stopped timer counts; driving timer paused.'
          : 'Stopped off-corridor (speed 0 km/h). Stopped timer counting; driving timer paused (not reset).',
        lat: stopLat + jitterLat,
        lng: stopLng + jitterLng,
        speed: 0,
        heading: 90,
        isOffRoute: true,
      });
    }

    // Step 4: Starts driving again, still off corridor, for ~2 min (4 pings @ 30s)
    for (let i = 0; i < 4; i++) {
      const offLat = stopLat + (i + 1) * 0.0004;
      const offLng = stopLng + (i + 1) * 0.0004;
      steps.push({
        phase: 4,
        stepIndex: 4,
        totalSteps: 5,
        phaseTitle: 'Step 4 of 5: Driving off-corridor again; stopped timer paused, driving resumed',
        phaseDetail: 'Rider resumes moving (25 km/h). Stopped timer freezes; driving timer resumes from where it paused.',
        lat: offLat,
        lng: offLng,
        speed: 25,
        heading: 45,
        isOffRoute: true,
      });
    }

    // Step 5: Rejoins the corridor (3 pings @ 30s)
    const returnPt1 = [
      basePt[0] + perpDLat * ((minOffsetMeters - 80) * degPerMeterLat),
      basePt[1] + perpDLng * ((minOffsetMeters - 80) * degPerMeterLng),
    ];
    const returnPt2 = polyline[(branchIdx + 4) % polyline.length];
    const returnPt3 = polyline[(branchIdx + 5) % polyline.length];

    steps.push({
      phase: 5,
      stepIndex: 5,
      totalSteps: 5,
      phaseTitle: 'Step 5 of 5: Rejoining corridor; deviation session closed, timers frozen',
      phaseDetail: 'Rider heading back to corridor.',
      lat: returnPt1[0],
      lng: returnPt1[1],
      speed: 22,
      heading: calculateBearing(returnPt1[0], returnPt1[1], returnPt2[0], returnPt2[1]),
      isOffRoute: false,
    });
    steps.push({
      phase: 5,
      stepIndex: 5,
      totalSteps: 5,
      phaseTitle: 'Step 5 of 5: Rejoining corridor; deviation session closed, timers frozen',
      phaseDetail: 'First in-corridor confirmation ping received.',
      lat: returnPt2[0],
      lng: returnPt2[1],
      speed: 24,
      heading: calculateBearing(returnPt2[0], returnPt2[1], returnPt3[0], returnPt3[1]),
      isOffRoute: false,
    });
    steps.push({
      phase: 5,
      stepIndex: 5,
      totalSteps: 5,
      phaseTitle: 'Step 5 of 5: Rejoining corridor; deviation session closed, timers frozen',
      phaseDetail: 'Second confirmation ping received. Deviation session RESOLVED. Timers frozen.',
      lat: returnPt3[0],
      lng: returnPt3[1],
      speed: 24,
      heading: calculateBearing(returnPt2[0], returnPt2[1], returnPt3[0], returnPt3[1]),
      isOffRoute: false,
    });
  }

  return steps;
}

/**
 * Starts a guided scenario on its assigned demo rider
 */
function startGuidedScenario(scenarioId) {
  const targetDpId = scenarioId === 'scenario1' ? 'SIM-001' : 'SIM-002';
  const cfg = SIMULATED_DP_CONFIG.find(d => d.id === targetDpId);
  if (!cfg) throw new Error(`Target rider ${targetDpId} not found.`);

  const runtime = dpRuntimeState[targetDpId];
  if (!runtime) throw new Error(`Runtime state for ${targetDpId} not initialized.`);

  // Condition 4: Reject if a guided scenario is already actively in progress on that rider
  if (runtime.guidedScenario && runtime.guidedScenario.isActive && !runtime.guidedScenario.isCompleted) {
    throw new Error(`Guided scenario '${runtime.guidedScenario.id}' is already in progress on ${cfg.name} (${cfg.id}). Please wait for it to complete or reset the simulation.`);
  }

  const settings = getSettings();
  const toleranceM = settings.corridorToleranceMeters || 120;
  const plan = generateGuidedScenarioPlan(scenarioId, runtime.polyline, toleranceM);

  runtime.scenario = 'guided';
  runtime.guidedScenario = {
    id: scenarioId,
    targetDpId,
    dpName: cfg.name,
    areaName: cfg.areaName,
    plan,
    stepIdx: 0,
    isActive: true,
    isCompleted: false,
    currentStepInfo: plan[0],
    startedAt: new Date(simulatedClockMs).toISOString(),
  };

  // If simulation is paused, start/resume it automatically so user can watch it play
  if (!isRunning) {
    startSimulation();
  }

  return getSimulationStatus();
}

/**
 * Executes a single step of a guided scenario (used by both clock loop and unit tests)
 */
async function executeGuidedScenarioStep(dpId, forcedTimestamp = null) {
  const runtime = dpRuntimeState[dpId];
  if (!runtime || !runtime.guidedScenario || !runtime.guidedScenario.isActive) {
    return null;
  }

  const g = runtime.guidedScenario;
  const step = g.plan[g.stepIdx];
  if (!step) return null;

  g.currentStepInfo = step;
  const pingTimestamp = forcedTimestamp || new Date(simulatedClockMs).toISOString();
  const settings = getSettings();

  const pingResult = await processGpsPing(
    {
      dpId,
      lat: step.lat,
      lng: step.lng,
      speed: step.speed,
      accuracy: 5,
      timestamp: pingTimestamp,
    },
    settings.complianceRules,
    {
      isolatedStore: {
        dpGpsStore: isolatedDpGpsStore,
        alertsStore: isolatedAlertsStore,
        deviationSessionsStore: isolatedDeviationSessionsStore,
        skipDbWrite: true,
      },
    }
  );

  // Update DP heading & simulator tag
  if (isolatedDpGpsStore[dpId] && isolatedDpGpsStore[dpId].lastGps) {
    isolatedDpGpsStore[dpId].lastGps.heading = Math.round(step.heading || 0);
    isolatedDpGpsStore[dpId].source = 'simulator';
    isolatedDpGpsStore[dpId].isSimulated = true;
  }

  // Record ping history
  if (!isolatedPingsHistory[dpId]) isolatedPingsHistory[dpId] = [];
  if (isolatedPingsHistory[dpId].length < 1000) {
    isolatedPingsHistory[dpId].push({
      lat: step.lat,
      lng: step.lng,
      speed: step.speed,
      heading: Math.round(step.heading || 0),
      timestamp: pingTimestamp,
      status: pingResult.status,
      currentState: pingResult.currentState,
      isWithinCorridor: pingResult.isWithinCorridor,
      distanceMeters: pingResult.distanceMeters,
      source: 'simulator',
      phaseTitle: step.phaseTitle,
    });
  }

  // Check if deviation session just closed (Condition 6: Session Summary appears when session closes)
  const resolvedSession = isolatedDeviationSessionsStore.find(s => s.status === 'RESOLVED' && s.dpId === dpId);
  if (resolvedSession && (!lastClosedSession || lastClosedSession.sessionId !== resolvedSession.id)) {
    lastClosedSession = {
      sessionId: resolvedSession.id,
      dpId,
      dpName: g.dpName,
      areaName: g.areaName,
      totalDrivingSeconds: resolvedSession.drivingSeconds,
      totalStoppedSeconds: resolvedSession.stoppedSeconds,
      maxDistanceFromCorridor: resolvedSession.maxDistanceFromCorridor,
      startedAt: resolvedSession.startedAt,
      endedAt: resolvedSession.endedAt,
      alertTriggered: Boolean(resolvedSession.alertTriggered),
    };
  }

  // Advance guided scenario index
  g.stepIdx++;
  if (g.stepIdx >= g.plan.length) {
    g.isCompleted = true;
    g.isActive = false;
    runtime.scenario = 'on-route';
  }

  return pingResult;
}

/**
 * Executes one simulated 30-second tick across all 5 simulated DPs
 */
async function processSimulationTick(advanceMs = 30000) {
  if (advanceMs) {
    simulatedClockMs += advanceMs;
  }
  const activeSettings = getSettings();
  const tickTimestamp = new Date(simulatedClockMs).toISOString();

  for (const cfg of SIMULATED_DP_CONFIG) {
    const runtime = dpRuntimeState[cfg.id];
    if (!runtime) continue;

    if (runtime.scenario === 'guided' && runtime.guidedScenario?.isActive) {
      await executeGuidedScenarioStep(cfg.id, tickTimestamp);
      continue;
    }

    const polyline = runtime.polyline;
    let nextLat = polyline[0][0];
    let nextLng = polyline[0][1];
    let speed = 24;
    let heading = 0;

    const jitterLat = (Math.random() - 0.5) * 0.00008;
    const jitterLng = (Math.random() - 0.5) * 0.00008;

    if (runtime.scenario === 'on-route') {
      runtime.currentStep = (runtime.currentStep + 1) % polyline.length;
      const curPt = polyline[runtime.currentStep];
      const nextPt = polyline[(runtime.currentStep + 1) % polyline.length];

      nextLat = curPt[0] + jitterLat;
      nextLng = curPt[1] + jitterLng;
      speed = 22 + Math.floor(Math.random() * 8);
      heading = calculateBearing(curPt[0], curPt[1], nextPt[0], nextPt[1]);
    } else if (runtime.scenario === 'diversion') {
      runtime.deviationStepCount++;
      const basePt = polyline[runtime.currentStep];
      const offsetFactor = 0.0025 + Math.min(0.007, runtime.deviationStepCount * 0.001);
      nextLat = basePt[0] + offsetFactor + jitterLat;
      nextLng = basePt[1] + offsetFactor + jitterLng;
      speed = 26 + Math.floor(Math.random() * 6);
      heading = 45;
    } else if (runtime.scenario === 'off-route-stopped') {
      runtime.stoppedStepCount++;
      if (!runtime.offRoutePoint) {
        const basePt = polyline[runtime.currentStep];
        runtime.offRoutePoint = [basePt[0] + 0.006, basePt[1] + 0.006];
      }
      nextLat = runtime.offRoutePoint[0] + (Math.random() - 0.5) * 0.00002;
      nextLng = runtime.offRoutePoint[1] + (Math.random() - 0.5) * 0.00002;
      speed = 0;
      heading = isolatedDpGpsStore[cfg.id]?.lastGps?.heading || 0;
    } else if (runtime.scenario === 'customer-stop') {
      const basePt = polyline[runtime.currentStep];
      nextLat = basePt[0];
      nextLng = basePt[1];
      speed = 0;
      heading = isolatedDpGpsStore[cfg.id]?.lastGps?.heading || 0;
    }

    const result = await processGpsPing(
      {
        dpId: cfg.id,
        lat: nextLat,
        lng: nextLng,
        speed,
        accuracy: 5,
        timestamp: tickTimestamp,
      },
      activeSettings.complianceRules,
      {
        isolatedStore: {
          dpGpsStore: isolatedDpGpsStore,
          alertsStore: isolatedAlertsStore,
          deviationSessionsStore: isolatedDeviationSessionsStore,
          skipDbWrite: true,
        },
      }
    );

    if (isolatedDpGpsStore[cfg.id] && isolatedDpGpsStore[cfg.id].lastGps) {
      isolatedDpGpsStore[cfg.id].lastGps.heading = Math.round(heading);
      isolatedDpGpsStore[cfg.id].source = 'simulator';
      isolatedDpGpsStore[cfg.id].isSimulated = true;
    }

    if (!isolatedPingsHistory[cfg.id]) isolatedPingsHistory[cfg.id] = [];
    if (isolatedPingsHistory[cfg.id].length < 1000) {
      isolatedPingsHistory[cfg.id].push({
        lat: nextLat,
        lng: nextLng,
        speed,
        heading: Math.round(heading),
        timestamp: tickTimestamp,
        status: result.status,
        currentState: result.currentState,
        isWithinCorridor: result.isWithinCorridor,
        distanceMeters: result.distanceMeters,
        source: 'simulator',
      });
    }

    // Capture closed session summary if resolved
    const resolved = isolatedDeviationSessionsStore.find(s => s.status === 'RESOLVED' && s.dpId === cfg.id);
    if (resolved && (!lastClosedSession || lastClosedSession.sessionId !== resolved.id)) {
      lastClosedSession = {
        sessionId: resolved.id,
        dpId: cfg.id,
        dpName: cfg.name,
        areaName: cfg.areaName,
        totalDrivingSeconds: resolved.drivingSeconds,
        totalStoppedSeconds: resolved.stoppedSeconds,
        maxDistanceFromCorridor: resolved.maxDistanceFromCorridor,
        startedAt: resolved.startedAt,
        endedAt: resolved.endedAt,
        alertTriggered: Boolean(resolved.alertTriggered),
      };
    }
  }
}

/**
 * Clock loop running at real-time interval (250ms)
 */
function onClockInterval() {
  if (!isRunning) return;

  const now = Date.now();
  if (!lastRealTickTime) lastRealTickTime = now;
  const deltaRealMs = now - lastRealTickTime;
  lastRealTickTime = now;

  const deltaSimMs = deltaRealMs * speedMultiplier;
  simulatedClockMs += deltaSimMs;
  accumulatedSimMs += deltaSimMs;

  if (accumulatedSimMs >= 30000) {
    accumulatedSimMs = 0;
    processSimulationTick(0).catch(err => {
      console.warn('⚠️ Simulation tick execution error:', err.message);
    });
  }
}

/**
 * Start or resume the simulation
 */
async function startSimulation() {
  if (Object.keys(isolatedDpGpsStore).length === 0) {
    await initializeSimulationState();
  }
  isRunning = true;
  lastRealTickTime = Date.now();
  if (!tickTimer) {
    tickTimer = setInterval(onClockInterval, 250);
    if (tickTimer && typeof tickTimer.unref === 'function') {
      tickTimer.unref(); // Condition 7: unref so test runners don't hang
    }
  }
  return getSimulationStatus();
}

/**
 * Pause the simulation (Condition 7: clears timer)
 */
function pauseSimulation() {
  isRunning = false;
  lastRealTickTime = null;
  cleanupTimer();
  return getSimulationStatus();
}

/**
 * Reset the simulation completely (Condition 7: clears timer and all state)
 */
async function resetSimulation() {
  pauseSimulation();
  cleanupTimer();
  simulatedClockMs = new Date('2026-11-23T06:00:00.000+05:30').getTime();
  accumulatedSimMs = 0;
  lastRealTickTime = null;
  lastClosedSession = null;
  await initializeSimulationState();
  return getSimulationStatus();
}

/**
 * Set speed multiplier (1x, 5x, 10x, 30x)
 */
function setSpeed(speed) {
  const num = parseInt(speed, 10);
  if ([1, 5, 10, 30].includes(num)) {
    speedMultiplier = num;
  }
  return getSimulationStatus();
}

/**
 * Trigger simple scenario for a specific simulated DP
 */
function setDpScenario(dpId, scenario) {
  const allowed = ['on-route', 'diversion', 'off-route-stopped', 'customer-stop', 'return-to-route'];
  if (!allowed.includes(scenario)) {
    throw new Error(`Invalid scenario. Allowed: ${allowed.join(', ')}`);
  }

  const runtime = dpRuntimeState[dpId];
  if (!runtime) {
    throw new Error(`Simulated DP ${dpId} not found.`);
  }

  if (scenario === 'return-to-route') {
    runtime.scenario = 'on-route';
    runtime.offRoutePoint = null;
    runtime.deviationStepCount = 0;
    runtime.stoppedStepCount = 0;
    if (runtime.guidedScenario) {
      runtime.guidedScenario.isActive = false;
    }
  } else {
    runtime.scenario = scenario;
    runtime.scenarioStartedAt = new Date(simulatedClockMs).toISOString();
    if (scenario === 'diversion') runtime.deviationStepCount = 0;
    if (scenario === 'off-route-stopped') runtime.stoppedStepCount = 0;
  }

  return getSimulationStatus();
}

/**
 * Returns current status of simulation engine
 */
function getSimulationStatus() {
  let activeGuidedScenario = null;

  const dpsList = SIMULATED_DP_CONFIG.map(cfg => {
    const state = isolatedDpGpsStore[cfg.id] || {};
    const runtime = dpRuntimeState[cfg.id] || {};
    const session = state.activeSessionId
      ? isolatedDeviationSessionsStore.find(s => s.id === state.activeSessionId)
      : isolatedDeviationSessionsStore.find(s => s.dpId === cfg.id) || null;

    let graceRemaining = 0;
    const settings = getSettings();
    const gracePeriod = settings.corridorGracePeriodSeconds || 180;
    if (state.deviationStartTime && state.status === 'YELLOW') {
      const elapsed = Math.round((simulatedClockMs - state.deviationStartTime) / 1000);
      graceRemaining = Math.max(0, gracePeriod - elapsed);
    }

    if (runtime.guidedScenario?.isActive) {
      activeGuidedScenario = {
        id: runtime.guidedScenario.id,
        targetDpId: cfg.id,
        dpName: cfg.name,
        areaName: cfg.areaName,
        stepIndex: runtime.guidedScenario.currentStepInfo?.stepIndex || 1,
        totalSteps: runtime.guidedScenario.currentStepInfo?.totalSteps || 4,
        phaseTitle: runtime.guidedScenario.currentStepInfo?.phaseTitle || '',
        phaseDetail: runtime.guidedScenario.currentStepInfo?.phaseDetail || '',
      };
    }

    return {
      id: cfg.id,
      dpCode: cfg.dpCode,
      name: cfg.name,
      initials: cfg.initials,
      route: cfg.areaName,
      areaColor: cfg.areaColor,
      status: state.status || 'GREEN',
      currentState: state.currentState || 'ON_ROUTE',
      lat: state.lastGps ? state.lastGps.lat : null,
      lng: state.lastGps ? state.lastGps.lng : null,
      speed: state.lastGps ? state.lastGps.speed : 0,
      heading: state.lastGps ? state.lastGps.heading : 0,
      accuracy: state.lastGps ? state.lastGps.accuracy : 5,
      lastUpdate: 'Simulated Live',
      deliveries: 18,
      total: 25,
      distanceFromRouteMeters: state.lastDistanceMeters || 0,
      isWithinCorridor: (state.lastDistanceMeters || 0) <= (settings.corridorToleranceMeters || 120),
      drivingSeconds: session ? session.drivingSeconds : 0,
      stoppedSeconds: session ? session.stoppedSeconds : 0,
      graceRemainingSeconds: graceRemaining,
      scenario: runtime.scenario || 'on-route',
      guidedScenario: runtime.guidedScenario?.isActive ? runtime.guidedScenario : null,
      source: 'simulator',
      isSimulated: true,
    };
  });

  return {
    isRunning,
    speedMultiplier,
    simulatedClockMs,
    simulatedTimeFormatted: getSimulatedTimeFormatted(),
    dps: dpsList,
    activeGuidedScenario,
    lastClosedSession,
    simulatedAlertsCount: isolatedAlertsStore.filter(a => a.status === 'TO_BE_REVIEWED').length,
    alerts: isolatedAlertsStore,
  };
}

/**
 * Review or dismiss a simulated alert in memory
 */
function reviewSimulatedAlert(alertId, newStatus, note = '', user = 'SuperAdmin') {
  const alert = isolatedAlertsStore.find(a => a.id === alertId);
  if (!alert) {
    throw new Error(`Simulated alert ${alertId} not found.`);
  }
  alert.status = newStatus;
  alert.reviewNote = note;
  alert.reviewedBy = user;
  alert.reviewedAt = new Date().toISOString();
  return { success: true, alert };
}

/**
 * Returns historical stream of simulated pings for Replay tab
 */
function getSimulatedReplayStream(dpId, alertId = null) {
  if (alertId) {
    const alert = isolatedAlertsStore.find(a => a.id === alertId);
    if (alert) {
      const pings = isolatedPingsHistory[alert.dpId] || [];
      return {
        success: true,
        dpId: alert.dpId,
        dpName: alert.dpName,
        areaName: alert.areaName,
        alert,
        deviationTrail: alert.trail || [],
        pings,
      };
    }
  }

  const pings = isolatedPingsHistory[dpId] || [];
  const cfg = SIMULATED_DP_CONFIG.find(d => d.id === dpId) || SIMULATED_DP_CONFIG[0];
  return {
    success: true,
    dpId: cfg.id,
    dpName: cfg.name,
    areaName: cfg.areaName,
    alert: null,
    deviationTrail: [],
    pings,
  };
}

module.exports = {
  SIMULATED_DP_CONFIG,
  startSimulation,
  pauseSimulation,
  resetSimulation,
  setSpeed,
  setDpScenario,
  startGuidedScenario,
  executeGuidedScenarioStep,
  generateGuidedScenarioPlan,
  getSimulationStatus,
  reviewSimulatedAlert,
  getSimulatedReplayStream,
  initializeSimulationState,
  processSimulationTick,
};
