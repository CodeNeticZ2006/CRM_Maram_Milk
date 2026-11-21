// ==============================================================================
// ROUTE CORRIDOR SERVICE — 5-AREA ROUTE CORRIDOR & DEVIATION ENGINE
// Multi-Area Route Corridor Geofencing, 2-Timer Off-Route State Machine & Alerts
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { readFromCRM, writeToCRM } = require('../config/database');
const {
  DEPOT_COORDINATES,
  AREA_CONFIG,
  resolveArea,
  DEFAULT_CORRIDOR_CONFIG,
} = require('../config/areaConfig');

// In-memory cache for road-following polylines so subsequent requests are <1ms
const routeGeometryCache = {};

// In-memory customer list cache per route
const customerListCache = {};

// In-Memory DP GPS State Store (Maps dpId -> state)
const dpGpsStore = {};

// Initialize state store for all 5 configured DPs
Object.keys(AREA_CONFIG).forEach(areaId => {
  const area = AREA_CONFIG[areaId];
  dpGpsStore[area.assignedDpId] = {
    id: area.assignedDpId,
    name: area.assignedDpName,
    dpCode: area.assignedDpCode,
    assignedRouteId: area.id,
    assignedRouteName: area.name,
    assignedAreaColor: area.color,
    lastGps: null,
    status: 'GPS unavailable',
    currentState: 'ON_ROUTE',
    candidateState: null,
    candidatePingsCount: 0,
    inCorridorConsecutivePings: 0,
    deviationStartTime: null,
    lastDistanceMeters: null,
    activeSessionId: null,
  };
});

// Active & Historical Deviation Sessions
// Format: { id, dpId, dpName, areaId, areaName, startedAt, endedAt, drivingSeconds, stoppedSeconds, maxDistanceFromCorridor, lastKnownLocation, trail: [], status: 'OPEN' | 'RESOLVED', alertTriggered: boolean }
const deviationSessionsStore = [];

// Alerts Store
const alertsStore = [];

/**
 * Calculates perpendicular distance in meters from point P to line segment AB
 * using Equirectangular projection tuned to Chennai latitude (approx 13.06 N).
 */
function pointToSegmentDistanceMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const degToRad = Math.PI / 180;
  const latScale = 111139; // meters per degree lat
  const lngScale = 111139 * Math.cos(13.06 * degToRad); // meters per degree lng

  const px = pLng * lngScale;
  const py = pLat * latScale;
  const ax = aLng * lngScale;
  const ay = aLat * latScale;
  const bx = bLng * lngScale;
  const by = bLat * latScale;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Calculates minimum distance from a GPS point to an entire road polyline
 */
function pointToPolylineDistanceMeters(lat, lng, polyline) {
  if (!polyline || polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    const degToRad = Math.PI / 180;
    const latScale = 111139;
    const lngScale = 111139 * Math.cos(13.06 * degToRad);
    return Math.hypot((lng - polyline[0][1]) * lngScale, (lat - polyline[0][0]) * latScale);
  }

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = pointToSegmentDistanceMeters(
      lat, lng,
      polyline[i][0], polyline[i][1],
      polyline[i + 1][0], polyline[i + 1][1]
    );
    if (d < minDistance) {
      minDistance = d;
    }
  }
  return minDistance;
}

/**
 * Straight-line Euclidean distance in meters between two lat/lng coordinates
 */
function distanceMeters(lat1, lng1, lat2, lng2) {
  const degToRad = Math.PI / 180;
  const latScale = 111139;
  const lngScale = 111139 * Math.cos(13.06 * degToRad);
  return Math.hypot((lng2 - lng1) * lngScale, (lat2 - lat1) * latScale);
}

/**
 * Fetches customers for an area from data/customers.json or CRM database
 */
async function getActualCustomersForRoute(routeId, routeName) {
  if (customerListCache[routeId] && customerListCache[routeId].length > 0) {
    const cached = customerListCache[routeId];
    return {
      valid: cached.filter(c => c.isMapped),
      missing: cached.filter(c => !c.isMapped),
      total: cached.length,
    };
  }

  let customers = [];
  const area = resolveArea(routeId) || resolveArea(routeName);
  const targetAreaName = area ? area.name : routeName;

  // 1. Try reading from CRM DB
  try {
    const queryPromise = readFromCRM(
      `SELECT id, customer_code, name, address, lat, lng, maps_url, assigned_route_id, status
       FROM customers
       WHERE assigned_route_id = $1 OR assigned_route_id = $2
       ORDER BY name ASC`,
      [routeId, targetAreaName]
    );
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('CRM DB timeout')), 1000));
    const res = await Promise.race([queryPromise, timeoutPromise]);
    if (res?.rows && res.rows.length > 0) {
      customers = res.rows;
    }
  } catch (err) {
    // Database offline or sandboxed — use seeded JSON file
  }

  // 2. Fallback to local data/customers.json
  if (customers.length === 0) {
    try {
      const jsonPath = path.join(__dirname, '../../data/customers.json');
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const allData = JSON.parse(raw);
        customers = allData.filter(c => {
          const cArea = resolveArea(c.area);
          return (cArea && area && cArea.id === area.id) ||
                 (c.area && targetAreaName && c.area.toLowerCase().includes(targetAreaName.toLowerCase().split(' ')[0]));
        });
      }
    } catch (e) {
      console.warn('⚠️ Error reading data/customers.json fallback:', e.message);
    }
  }

  const valid = [];
  const missing = [];

  for (const c of customers) {
    const lat = parseFloat(c.lat);
    const lng = parseFloat(c.lng);
    const isMapped = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

    const item = {
      id: c.id || c.customerId || `cust-${Date.now()}-${Math.random()}`,
      customerId: c.customerId || c.customer_code,
      customer_code: c.customer_code || c.customerId,
      name: c.name,
      address: c.address || 'Chennai',
      lat: isMapped ? lat : null,
      lng: isMapped ? lng : null,
      maps_url: c.maps_url || null,
      assigned_route_id: routeId,
      route_name: targetAreaName,
      isMapped,
    };

    if (isMapped) {
      valid.push(item);
    } else {
      missing.push({
        ...item,
        issue: 'GPS coordinates unavailable / unmapped',
      });
    }
  }

  customerListCache[routeId] = [...valid, ...missing];
  return { valid, missing, total: customers.length };
}

/**
 * 2-Opt Optimization Algorithm for ordering customer stops
 * Starts from Depot, applies Nearest-Neighbour pass, then performs 2-Opt edge swaps
 */
function optimizeRouteStops(depot, stops) {
  if (!stops || stops.length <= 1) return stops || [];

  // Step 1: Nearest-Neighbour tour starting from depot
  const unvisited = [...stops];
  const tour = [];
  let current = depot;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = Math.hypot(unvisited[i].lat - current.lat, unvisited[i].lng - current.lng);
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }
    const nextStop = unvisited.splice(nearestIdx, 1)[0];
    tour.push(nextStop);
    current = nextStop;
  }

  // Step 2: 2-Opt edge swap cleanup (max 50 iterations)
  const computeTotalDist = (pts) => {
    let total = Math.hypot(pts[0].lat - depot.lat, pts[0].lng - depot.lng);
    for (let i = 0; i < pts.length - 1; i++) {
      total += Math.hypot(pts[i + 1].lat - pts[i].lat, pts[i + 1].lng - pts[i].lng);
    }
    return total;
  };

  let improved = true;
  let iterations = 0;
  const n = tour.length;

  while (improved && iterations < 50 && n > 3) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        // Reversal candidate
        const candidate = [
          ...tour.slice(0, i),
          ...tour.slice(i, k + 1).reverse(),
          ...tour.slice(k + 1),
        ];
        if (computeTotalDist(candidate) < computeTotalDist(tour) - 1e-6) {
          tour.splice(0, n, ...candidate);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return tour;
}

/**
 * Snaps ordered stops to real roads using OSRM public API, with straight-line fallback
 */
async function generateRoadFollowingRoute(validCustomers) {
  if (!validCustomers || validCustomers.length === 0) return [];
  if (validCustomers.length === 1) return [[validCustomers[0].lat, validCustomers[0].lng]];

  // 1. Optimize stops using Nearest-Neighbour + 2-Opt
  const orderedStops = optimizeRouteStops(DEPOT_COORDINATES, validCustomers);
  const orderedWithDepot = [DEPOT_COORDINATES, ...orderedStops];

  // 2. Snap to roads using OSRM public routing API (chunks of 15 stops)
  const chunkSize = 15;
  const roadCoords = [];

  try {
    for (let i = 0; i < orderedWithDepot.length - 1; i += (chunkSize - 1)) {
      const chunk = orderedWithDepot.slice(i, i + chunkSize);
      if (chunk.length < 2) continue;

      const pts = chunk.map(c => `${c.lng},${c.lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await resp.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]?.geometry?.coordinates) {
        const seg = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        roadCoords.push(...seg);
      } else {
        // Fallback to straight segment
        roadCoords.push(...chunk.map(c => [c.lat, c.lng]));
      }
    }
  } catch (err) {
    console.warn('⚠️ OSRM routing unavailable, falling back to ordered stop coordinates:', err.message);
    return orderedWithDepot.map(c => [c.lat, c.lng]);
  }

  return roadCoords.length > 0 ? roadCoords : orderedWithDepot.map(c => [c.lat, c.lng]);
}

/**
 * Retrieves the road-following polyline for an area (cached)
 */
async function getRoutePolyline(routeId, routeName) {
  if (routeGeometryCache[routeId] && routeGeometryCache[routeId].length > 0) {
    return routeGeometryCache[routeId];
  }

  const { valid } = await getActualCustomersForRoute(routeId, routeName);
  // Edge Case: Area with fewer than 2 mapped customers -> no corridor
  if (!valid || valid.length < 2) {
    console.warn(`⚠️ Route ${routeName} (${routeId}) has fewer than 2 mapped customers (${valid?.length || 0}). No corridor polyline generated.`);
    routeGeometryCache[routeId] = [];
    return [];
  }

  const roadPolyline = await generateRoadFollowingRoute(valid);
  routeGeometryCache[routeId] = roadPolyline;
  return roadPolyline;
}

/**
 * Returns complete corridor details for all 5 areas
 */
async function getRouteCorridors(configuredToleranceMeters = DEFAULT_CORRIDOR_CONFIG.corridorToleranceMeters) {
  const areaIds = Object.keys(AREA_CONFIG);
  const routeCorridors = [];

  for (const areaId of areaIds) {
    const area = AREA_CONFIG[areaId];
    const { valid, missing } = await getActualCustomersForRoute(area.id, area.name);
    const polyline = await getRoutePolyline(area.id, area.name);

    routeCorridors.push({
      id: area.id,
      name: area.name,
      code: area.code,
      color: area.color, // Colorblind-friendly palette
      corridorToleranceMeters: configuredToleranceMeters,
      polyline,
      hasCorridor: polyline && polyline.length >= 2,
      customers: valid,
      missingCustomers: missing,
      customerCount: valid.length,
      unmappedCount: missing.length,
      assignedDp: dpGpsStore[area.assignedDpId] || null,
      isRouteCorridor: true,
    });
  }

  return {
    depot: DEPOT_COORDINATES,
    routes: routeCorridors,
    sessions: deviationSessionsStore,
    alerts: alertsStore,
  };
}

/**
 * Evaluates corridor compliance for a Delivery Person given GPS coordinates
 * Implements the 2-Timer Off-Route State Machine:
 * - ON_ROUTE: inside corridor. Timers paused. Any open session resolved after hysteresis.
 * - OFF_ROUTE_DRIVING: outside corridor AND speed >= 3 km/h. Increments drivingSeconds.
 * - OFF_ROUTE_STOPPED: outside corridor AND speed < 3 km/h (or pos unchanged). Increments stoppedSeconds.
 * - In-corridor stops: NORMAL delivery at customer door, do NOT count as stopped time.
 * - Filters noisy GPS pings (accuracy > 50m) and out-of-order timestamps.
 * - 2-ping hysteresis prevents state bouncing on single noisy pings.
 * - Triggers ONE alert per deviation session when grace period exceeded or thresholds reached.
 */
async function processGpsPing({ dpId, lat, lng, speed = 0, accuracy = 10, timestamp = null }, config = {}) {
  const tolerance = config.corridorToleranceMeters || DEFAULT_CORRIDOR_CONFIG.corridorToleranceMeters;
  const gracePeriod = config.gracePeriodSeconds || DEFAULT_CORRIDOR_CONFIG.gracePeriodSeconds;
  const stopSpeedThresh = config.stopSpeedThresholdKmh || DEFAULT_CORRIDOR_CONFIG.stopSpeedThresholdKmh;
  const stopDistThresh = config.stopDistanceChangeMeters || DEFAULT_CORRIDOR_CONFIG.stopDistanceChangeMeters;
  const drivingAlertThresh = config.drivingAlertThresholdSeconds || DEFAULT_CORRIDOR_CONFIG.drivingAlertThresholdSeconds;
  const stoppedAlertThresh = config.stoppedAlertThresholdSeconds || DEFAULT_CORRIDOR_CONFIG.stoppedAlertThresholdSeconds;
  const maxAccuracy = config.maxGpsAccuracyMeters || DEFAULT_CORRIDOR_CONFIG.maxGpsAccuracyMeters;
  const staleMinutes = config.staleThresholdMinutes || DEFAULT_CORRIDOR_CONFIG.staleThresholdMinutes;

  // 1. Identify DP
  let dp = dpGpsStore[dpId];
  if (!dp) {
    // If unknown dpId, attempt to locate or assign
    const firstArea = Object.values(AREA_CONFIG)[0];
    dp = {
      id: dpId,
      name: dpId,
      dpCode: dpId,
      assignedRouteId: firstArea.id,
      assignedRouteName: firstArea.name,
      assignedAreaColor: firstArea.color,
      lastGps: null,
      status: 'GPS unavailable',
      currentState: 'ON_ROUTE',
      candidateState: null,
      candidatePingsCount: 0,
      inCorridorConsecutivePings: 0,
      deviationStartTime: null,
      lastDistanceMeters: null,
      activeSessionId: null,
    };
    dpGpsStore[dpId] = dp;
  }

  // Edge Case: DP has no assigned area
  if (!dp.assignedRouteId) {
    console.warn(`⚠️ DP ${dp.id} (${dp.name}) has no assigned area. Skipping corridor evaluation.`);
    return {
      success: true,
      evaluated: false,
      message: 'DP has no assigned area route.',
      dp,
    };
  }

  // Handle missing or invalid GPS coordinates
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng) || numLat === 0 || numLng === 0) {
    dp.status = 'GPS unavailable';
    return {
      success: true,
      status: 'GPS unavailable',
      message: 'Invalid or missing GPS coordinates.',
      dp,
    };
  }

  const pingTime = timestamp ? new Date(timestamp) : new Date();

  // Edge Case: Drop pings with GPS accuracy worse than maxAccuracy (50m)
  const gpsAccuracy = Math.max(0, parseFloat(accuracy) || 10);
  if (gpsAccuracy > maxAccuracy) {
    return {
      success: false,
      dropped: true,
      reason: `GPS accuracy (${gpsAccuracy}m) worse than threshold (${maxAccuracy}m). Ping ignored as noise.`,
      dp,
    };
  }

  // Edge Case: Drop out-of-order timestamps
  if (dp.lastGps && dp.lastGps.timestamp) {
    const prevTime = new Date(dp.lastGps.timestamp);
    if (pingTime < prevTime) {
      return {
        success: false,
        dropped: true,
        reason: 'Out-of-order GPS timestamp ignored.',
        dp,
      };
    }
  }

  // Edge Case: Check for GPS signal loss (> 10 minutes)
  let isSignalLost = false;
  let dtSeconds = 30; // default interval

  if (dp.lastGps && dp.lastGps.timestamp) {
    const timeDiffMs = pingTime.getTime() - new Date(dp.lastGps.timestamp).getTime();
    dtSeconds = Math.max(1, Math.round(timeDiffMs / 1000));
    if (timeDiffMs > staleMinutes * 60 * 1000) {
      isSignalLost = true;
      dp.status = 'signal lost';
      // Signal lost: do NOT count this gap as stopped time
      dtSeconds = 0;
    }
  }

  // Retrieve assigned route polyline
  const routePolyline = await getRoutePolyline(dp.assignedRouteId, dp.assignedRouteName);

  // Edge Case: Route with fewer than 2 stops has no corridor
  if (!routePolyline || routePolyline.length < 2) {
    dp.status = 'GREEN';
    dp.lastGps = { lat: numLat, lng: numLng, speed: parseFloat(speed) || 0, accuracy: gpsAccuracy, timestamp: pingTime.toISOString() };
    return {
      success: true,
      status: 'GREEN',
      message: 'Area has fewer than 2 mapped stops; corridor disabled.',
      dp,
    };
  }

  // Compute perpendicular distance to corridor
  const rawDistance = pointToPolylineDistanceMeters(numLat, numLng, routePolyline);
  const effectiveDistance = Math.max(0, rawDistance - (gpsAccuracy * 0.5));
  const isWithinCorridor = effectiveDistance <= tolerance;

  // Calculate distance moved from last position
  const distMoved = dp.lastGps
    ? distanceMeters(dp.lastGps.lat, dp.lastGps.lng, numLat, numLng)
    : 999;
  const currentSpeed = parseFloat(speed) || 0;

  // Determine raw target state
  let targetState = 'ON_ROUTE';
  if (!isWithinCorridor) {
    if (currentSpeed >= stopSpeedThresh || distMoved >= stopDistThresh) {
      targetState = 'OFF_ROUTE_DRIVING';
    } else {
      targetState = 'OFF_ROUTE_STOPPED';
    }
  }

  // 2-Ping Hysteresis Check: Require 2 consecutive pings to change state
  if (dp.candidateState === targetState) {
    dp.candidatePingsCount = (dp.candidatePingsCount || 0) + 1;
  } else {
    dp.candidateState = targetState;
    dp.candidatePingsCount = 1;
  }

  if (dp.candidatePingsCount >= 2 || !dp.currentState) {
    dp.currentState = dp.candidateState;
  }

  // Update DP State
  dp.lastGps = {
    lat: numLat,
    lng: numLng,
    speed: currentSpeed,
    accuracy: gpsAccuracy,
    timestamp: pingTime.toISOString(),
  };
  dp.lastDistanceMeters = Math.round(effectiveDistance);

  // =========================================================================
  // STATE MACHINE & TIMERS
  // =========================================================================

  let activeSession = null;
  let triggeredAlert = null;

  if (dp.currentState === 'ON_ROUTE') {
    dp.inCorridorConsecutivePings = (dp.inCorridorConsecutivePings || 0) + 1;

    // Inside corridor: Stopping at customer door is NORMAL. Both timers paused.
    dp.status = 'GREEN';

    // Resolve any open deviation session after 2 consecutive in-corridor pings
    if (dp.inCorridorConsecutivePings >= 2 && dp.activeSessionId) {
      activeSession = deviationSessionsStore.find(s => s.id === dp.activeSessionId && s.status === 'OPEN');
      if (activeSession) {
        activeSession.status = 'RESOLVED';
        activeSession.endedAt = pingTime.toISOString();
        activeSession.resolutionReason = 'Returned to assigned corridor';
      }
      dp.activeSessionId = null;
      dp.deviationStartTime = null;
    }

    return {
      success: true,
      status: 'GREEN',
      isWithinCorridor: true,
      currentState: 'ON_ROUTE',
      distanceMeters: Math.round(effectiveDistance),
      dp,
      activeSession: null,
    };
  }

  // OFF-ROUTE: either OFF_ROUTE_DRIVING or OFF_ROUTE_STOPPED
  dp.inCorridorConsecutivePings = 0;

  if (!dp.deviationStartTime) {
    dp.deviationStartTime = pingTime.getTime();
  }

  const elapsedDeviationSeconds = Math.round((pingTime.getTime() - dp.deviationStartTime) / 1000);

  // Apply Grace Period before escalating to RED
  if (elapsedDeviationSeconds <= gracePeriod && !isSignalLost) {
    dp.status = 'YELLOW';
  } else if (!isSignalLost) {
    dp.status = 'RED';
  }

  // Retrieve or create Deviation Session
  if (dp.activeSessionId) {
    activeSession = deviationSessionsStore.find(s => s.id === dp.activeSessionId && s.status === 'OPEN');
  }

  if (!activeSession) {
    activeSession = {
      id: `dev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dpId: dp.id,
      dpName: dp.name,
      areaId: dp.assignedRouteId,
      areaName: dp.assignedRouteName,
      startedAt: new Date(dp.deviationStartTime).toISOString(),
      endedAt: null,
      drivingSeconds: 0,
      stoppedSeconds: 0,
      maxDistanceFromCorridor: Math.round(effectiveDistance),
      lastKnownLocation: { lat: numLat, lng: numLng, speed: currentSpeed, accuracy: gpsAccuracy, timestamp: pingTime.toISOString() },
      trail: [{ lat: numLat, lng: numLng, speed: currentSpeed, timestamp: pingTime.toISOString() }],
      status: 'OPEN',
      alertTriggered: false,
    };
    deviationSessionsStore.unshift(activeSession);
    dp.activeSessionId = activeSession.id;
  }

  // Increment the specific off-route timer
  if (!isSignalLost && dtSeconds > 0) {
    if (dp.currentState === 'OFF_ROUTE_DRIVING') {
      activeSession.drivingSeconds += dtSeconds;
    } else if (dp.currentState === 'OFF_ROUTE_STOPPED') {
      activeSession.stoppedSeconds += dtSeconds;
    }
  }

  activeSession.maxDistanceFromCorridor = Math.max(activeSession.maxDistanceFromCorridor, Math.round(effectiveDistance));
  activeSession.lastKnownLocation = { lat: numLat, lng: numLng, speed: currentSpeed, accuracy: gpsAccuracy, timestamp: pingTime.toISOString() };

  // Append to trail (capped at 500 points)
  if (activeSession.trail.length < 500) {
    activeSession.trail.push({ lat: numLat, lng: numLng, speed: currentSpeed, timestamp: pingTime.toISOString() });
  }

  // =========================================================================
  // ALERT TO SUPERADMIN (Trigger ONE alert per session - no spam)
  // =========================================================================

  const shouldTriggerAlert = !activeSession.alertTriggered && (
    dp.status === 'RED' ||
    activeSession.drivingSeconds >= drivingAlertThresh ||
    activeSession.stoppedSeconds >= stoppedAlertThresh
  );

  if (shouldTriggerAlert) {
    activeSession.alertTriggered = true;

    triggeredAlert = {
      id: `alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionId: activeSession.id,
      dpId: dp.id,
      dpName: dp.name,
      areaId: dp.assignedRouteId,
      areaName: dp.assignedRouteName,
      type: dp.currentState, // OFF_ROUTE_DRIVING | OFF_ROUTE_STOPPED
      startedAt: activeSession.startedAt,
      drivingSeconds: activeSession.drivingSeconds,
      stoppedSeconds: activeSession.stoppedSeconds,
      maxDistance: activeSession.maxDistanceFromCorridor,
      location: activeSession.lastKnownLocation,
      trail: activeSession.trail.slice(-50), // keep latest 50 trail points for map display
      status: 'TO_BE_REVIEWED',
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: pingTime.toISOString(),
    };

    alertsStore.unshift(triggeredAlert);

    // Persist alert to DB1 table asynchronously
    try {
      writeToCRM(
        `INSERT INTO route_deviation_alerts
           (dp_id, dp_name, area_id, area_name, type, started_at, driving_seconds,
            stopped_seconds, max_distance, location, trail, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          triggeredAlert.dpId,
          triggeredAlert.dpName,
          triggeredAlert.areaId,
          triggeredAlert.areaName,
          triggeredAlert.type,
          triggeredAlert.startedAt,
          triggeredAlert.drivingSeconds,
          triggeredAlert.stoppedSeconds,
          triggeredAlert.maxDistance,
          JSON.stringify(triggeredAlert.location),
          JSON.stringify(triggeredAlert.trail),
          triggeredAlert.status,
        ]
      ).catch(() => {});
    } catch (e) {}
  }

  return {
    success: true,
    status: dp.status,
    isWithinCorridor: false,
    currentState: dp.currentState,
    distanceMeters: Math.round(effectiveDistance),
    drivingSeconds: activeSession.drivingSeconds,
    stoppedSeconds: activeSession.stoppedSeconds,
    dp,
    activeSession,
    alertTriggered: Boolean(triggeredAlert),
    alert: triggeredAlert,
  };
}

/**
 * Returns filtered alerts from store or database
 */
async function getAlerts({ status = '', areaId = '', dpId = '' } = {}) {
  let list = alertsStore;

  // Try reading from DB if available and alertsStore is empty
  if (list.length === 0) {
    try {
      const res = await readFromCRM(
        `SELECT id, dp_id as "dpId", dp_name as "dpName", area_id as "areaId",
                area_name as "areaName", type, started_at as "startedAt",
                driving_seconds as "drivingSeconds", stopped_seconds as "stoppedSeconds",
                max_distance as "maxDistance", location, trail, status,
                reviewed_by as "reviewedBy", reviewed_at as "reviewedAt",
                review_note as "reviewNote", created_at as "createdAt"
         FROM route_deviation_alerts
         ORDER BY created_at DESC
         LIMIT 100`
      );
      if (res?.rows && res.rows.length > 0) {
        alertsStore.push(...res.rows);
        list = alertsStore;
      }
    } catch (e) {}
  }

  return list.filter(item => {
    if (status && item.status !== status) return false;
    if (areaId && item.areaId !== areaId) return false;
    if (dpId && item.dpId !== dpId) return false;
    return true;
  });
}

/**
 * Updates review status on an alert
 */
async function reviewAlert(alertId, { status, note, reviewedBy = 'Super Admin' }) {
  const normStatus = (status || '').toUpperCase();
  if (normStatus !== 'REVIEWED' && normStatus !== 'DISMISSED') {
    throw new Error('Invalid alert status. Must be REVIEWED or DISMISSED.');
  }

  const alert = alertsStore.find(a => String(a.id) === String(alertId));
  const now = new Date().toISOString();

  if (alert) {
    alert.status = normStatus;
    alert.reviewNote = note || '';
    alert.reviewedBy = reviewedBy;
    alert.reviewedAt = now;
  }

  // Update DB1
  try {
    await writeToCRM(
      `UPDATE route_deviation_alerts
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = $4
       WHERE id::text = $5 OR id = $6`,
      [normStatus, note || '', reviewedBy, now, String(alertId), alertId]
    );
  } catch (e) {}

  return alert || { id: alertId, status: normStatus, reviewNote: note, reviewedBy, reviewedAt: now };
}

module.exports = {
  DEPOT_COORDINATES,
  AREA_CONFIG,
  DEFAULT_CORRIDOR_CONFIG,
  dpGpsStore,
  deviationSessionsStore,
  alertsStore,
  pointToSegmentDistanceMeters,
  pointToPolylineDistanceMeters,
  distanceMeters,
  optimizeRouteStops,
  generateRoadFollowingRoute,
  getActualCustomersForRoute,
  getRoutePolyline,
  getRouteCorridors,
  processGpsPing,
  getAlerts,
  reviewAlert,
};
