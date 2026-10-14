// ==============================================================================
// ROUTE CORRIDOR SERVICE — ROUTE-BASED GEOFENCING & DEVIATION SESSION ENGINE
// STRICTLY SCOPED ONLY TO: 'Nungambakkam 1' & 'Triplicane 1'
// ==============================================================================

const { readFromCRM, writeToCRM } = require('../config/database');
const {
  nungambakkamCustomers,
  triplicaneCustomers,
  OFFICIAL_ROUTES,
} = require('../migrations/007_seed_missing_route_customers');

// Canonical Route Identifiers
const ROUTE_NUNGAMBAKKAM_ID = '1b4a924f-1a3c-4658-9e23-a2a060917ac2';
const ROUTE_TRIPLICANE_ID   = '9835f558-456c-423f-985b-f21b981172d6';

// Colors specified in Requirement 3
const ROUTE_COLORS = {
  [ROUTE_NUNGAMBAKKAM_ID]: '#2563eb', // Blue
  [ROUTE_TRIPLICANE_ID]:   '#10b981', // Green
  'Nungambakkam 1':        '#2563eb',
  'Triplicane 1':          '#10b981',
};

// In-memory cache for road-following polylines so subsequent requests are <1ms
const routeGeometryCache = {
  [ROUTE_NUNGAMBAKKAM_ID]: null,
  [ROUTE_TRIPLICANE_ID]:   null,
};

// Configurable Corridor Defaults
const DEFAULT_CORRIDOR_CONFIG = {
  corridorToleranceMeters: 120,    // Configurable corridor width around polyline
  gracePeriodSeconds: 180,         // 3 minutes before YELLOW transitions to RED
  staleThresholdMinutes: 15,       // Mark as 'Location stale' if no update in 15 min
};

// In-Memory DP GPS State Store (Maps dpId -> state)
const dpGpsStore = {
  'dp-nung-1': {
    id: 'dp-nung-1',
    name: 'Vijay Sethu',
    dpCode: 'DP008',
    assignedRouteId: ROUTE_NUNGAMBAKKAM_ID,
    assignedRouteName: 'Nungambakkam 1',
    lastGps: null,              // null initially -> 'GPS unavailable'
    status: 'GPS unavailable',
    deviationStartTime: null,
    lastDistanceMeters: null,
    activeSessionId: null,
  },
  'dp-trip-1': {
    id: 'dp-trip-1',
    name: 'Saravanan',
    dpCode: 'DP012',
    assignedRouteId: ROUTE_TRIPLICANE_ID,
    assignedRouteName: 'Triplicane 1',
    lastGps: null,              // null initially -> 'GPS unavailable'
    status: 'GPS unavailable',
    deviationStartTime: null,
    lastDistanceMeters: null,
    activeSessionId: null,
  },
};

// Active & Historical Deviation Sessions
// Format: { id, dpId, dpName, routeId, routeName, startedAt, lastSeenAt, resolvedAt, status: 'ACTIVE' | 'RESOLVED', maxDistanceMeters, currentDistanceMeters, trail: [] }
const deviationSessionsStore = [];

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

  // Projection scalar t clamped to [0, 1]
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

// In-memory cache for customer lists
const customerListCache = {};

/**
 * Fetches actual customers for the specified route from CRM DB or fallback seed
 */
async function getActualCustomersForRoute(routeId, routeName) {
  if (customerListCache[routeId] && customerListCache[routeId].length > 0) {
    const cached = customerListCache[routeId];
    return {
      valid: cached.filter(c => c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng))),
      missing: cached.filter(c => !c.lat || !c.lng || isNaN(parseFloat(c.lat)) || isNaN(parseFloat(c.lng))),
      total: cached.length,
    };
  }

  let dbCustomers = [];
  try {
    const queryPromise = readFromCRM(
      `SELECT id, customer_code, name, address, lat, lng, maps_url, assigned_route_id, status
       FROM customers
       WHERE assigned_route_id = $1 OR assigned_route_id = $2
       ORDER BY name ASC`,
      [routeId, routeName]
    );
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('CRM DB timeout')), 1500));
    const res = await Promise.race([queryPromise, timeoutPromise]);
    if (res.rows && res.rows.length > 0) {
      dbCustomers = res.rows;
    }
  } catch (err) {
    // Database offline or ECONNRESET — use confirmed standardized seed
  }

  if (dbCustomers.length === 0) {
    const isNung = routeName.toLowerCase().includes('nung') || routeId === ROUTE_NUNGAMBAKKAM_ID;
    const seedList = isNung ? nungambakkamCustomers : triplicaneCustomers;
    dbCustomers = seedList.map((c, i) => ({
      id: `cust-${isNung ? 'nung' : 'trip'}-${i + 1}`,
      customer_code: `MM${String((isNung ? 1001 : 2001) + i).padStart(4, '0')}`,
      name: c.name,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      maps_url: c.maps_url,
      assigned_route_id: routeId,
      status: 'Active',
    }));
  }

  customerListCache[routeId] = dbCustomers;

  // Segregate valid customer coordinates vs missing coordinates
  const valid = [];
  const missing = [];

  for (const c of dbCustomers) {
    const lat = parseFloat(c.lat);
    const lng = parseFloat(c.lng);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      valid.push({
        ...c,
        lat,
        lng,
        assigned_route_id: routeId,
        route_name: routeName,
      });
    } else {
      missing.push({
        ...c,
        assigned_route_id: routeId,
        route_name: routeName,
        issue: 'GPS coordinates unavailable',
      });
    }
  }

  return { valid, missing, total: dbCustomers.length };
}

/**
 * Queries OSRM road-following routing service through actual customer stops
 */
async function generateRoadFollowingRoute(validCustomers) {
  if (!validCustomers || validCustomers.length === 0) return [];
  if (validCustomers.length === 1) return [[validCustomers[0].lat, validCustomers[0].lng]];

  // Sort customers with simple nearest-neighbor to ensure logical street traversal
  const unvisited = [...validCustomers];
  const ordered = [unvisited.shift()];
  while (unvisited.length > 0) {
    const curr = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = Math.hypot(unvisited[i].lat - curr.lat, unvisited[i].lng - curr.lng);
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }
    ordered.push(unvisited.splice(nearestIdx, 1)[0]);
  }

  // Chunk stops into OSRM requests (max 15-20 stops per request for stability)
  const chunkSize = 15;
  const roadCoords = [];

  try {
    for (let i = 0; i < ordered.length - 1; i += (chunkSize - 1)) {
      const chunk = ordered.slice(i, i + chunkSize);
      if (chunk.length < 2) continue;

      const pts = chunk.map(c => `${c.lng},${c.lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await resp.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]?.geometry?.coordinates) {
        const seg = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        roadCoords.push(...seg);
      } else {
        // Fallback to ordered straight segments if OSRM response is not Ok
        roadCoords.push(...chunk.map(c => [c.lat, c.lng]));
      }
    }
  } catch (err) {
    console.warn('⚠️ OSRM routing request error, falling back to ordered stop coordinates:', err.message);
    return ordered.map(c => [c.lat, c.lng]);
  }

  return roadCoords.length > 0 ? roadCoords : ordered.map(c => [c.lat, c.lng]);
}

/**
 * Retrieves the road-following polyline for one of the two routes (cached)
 */
async function getRoutePolyline(routeId, routeName) {
  if (routeGeometryCache[routeId] && routeGeometryCache[routeId].length > 0) {
    return routeGeometryCache[routeId];
  }

  const { valid } = await getActualCustomersForRoute(routeId, routeName);
  const roadPolyline = await generateRoadFollowingRoute(valid);
  routeGeometryCache[routeId] = roadPolyline;
  return roadPolyline;
}

/**
 * Returns complete corridor details for Nungambakkam 1 and Triplicane 1
 */
async function getRouteCorridors(configuredToleranceMeters = DEFAULT_CORRIDOR_CONFIG.corridorToleranceMeters) {
  const [nungCust, tripCust] = await Promise.all([
    getActualCustomersForRoute(ROUTE_NUNGAMBAKKAM_ID, 'Nungambakkam 1'),
    getActualCustomersForRoute(ROUTE_TRIPLICANE_ID, 'Triplicane 1'),
  ]);

  const [nungPolyline, tripPolyline] = await Promise.all([
    getRoutePolyline(ROUTE_NUNGAMBAKKAM_ID, 'Nungambakkam 1'),
    getRoutePolyline(ROUTE_TRIPLICANE_ID, 'Triplicane 1'),
  ]);

  return {
    routes: [
      {
        id: ROUTE_NUNGAMBAKKAM_ID,
        name: 'Nungambakkam 1',
        color: ROUTE_COLORS[ROUTE_NUNGAMBAKKAM_ID], // Blue
        corridorToleranceMeters: configuredToleranceMeters,
        polyline: nungPolyline,
        customers: nungCust.valid,
        missingCustomers: nungCust.missing,
        customerCount: nungCust.valid.length,
        assignedDp: dpGpsStore['dp-nung-1'],
        isRouteCorridor: true,
      },
      {
        id: ROUTE_TRIPLICANE_ID,
        name: 'Triplicane 1',
        color: ROUTE_COLORS[ROUTE_TRIPLICANE_ID], // Green
        corridorToleranceMeters: configuredToleranceMeters,
        polyline: tripPolyline,
        customers: tripCust.valid,
        missingCustomers: tripCust.missing,
        customerCount: tripCust.valid.length,
        assignedDp: dpGpsStore['dp-trip-1'],
        isRouteCorridor: true,
      },
    ],
    sessions: deviationSessionsStore,
  };
}

/**
 * Evaluates corridor compliance for a Delivery Person given GPS coordinates
 * Updates or creates a deviation session and ensures:
 * - 1 session per continuous deviation incident
 * - Resolves session when returning to corridor
 * - Accounts for GPS accuracy
 * - Checks against DP's actual assigned route
 */
async function processGpsPing({ dpId, lat, lng, speed = 0, accuracy = 10, timestamp = null }, config = {}) {
  const tolerance = config.corridorToleranceMeters || DEFAULT_CORRIDOR_CONFIG.corridorToleranceMeters;
  const gracePeriod = config.gracePeriodSeconds || DEFAULT_CORRIDOR_CONFIG.gracePeriodSeconds;

  // Identify DP
  let dp = dpGpsStore[dpId];
  if (!dp) {
    // If unknown dpId, lookup in DB2 or create temporary entry
    dp = {
      id: dpId,
      name: dpId.includes('trip') ? 'Saravanan' : 'Vijay Sethu',
      assignedRouteId: dpId.includes('trip') ? ROUTE_TRIPLICANE_ID : ROUTE_NUNGAMBAKKAM_ID,
      assignedRouteName: dpId.includes('trip') ? 'Triplicane 1' : 'Nungambakkam 1',
      lastGps: null,
      status: 'GPS unavailable',
      deviationStartTime: null,
      lastDistanceMeters: null,
      activeSessionId: null,
    };
    dpGpsStore[dpId] = dp;
  }

  // Handle missing or invalid GPS
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng) || numLat === 0 || numLng === 0) {
    dp.status = 'GPS unavailable';
    return {
      success: true,
      status: 'GPS unavailable',
      message: 'Invalid or missing GPS coordinates. Not flagged as deviation.',
      dp,
    };
  }

  const now = timestamp ? new Date(timestamp) : new Date();

  // Retrieve assigned route polyline ONLY
  const routePolyline = await getRoutePolyline(dp.assignedRouteId, dp.assignedRouteName);

  // Compute distance to assigned route
  const rawDistance = pointToPolylineDistanceMeters(numLat, numLng, routePolyline);

  // Account for GPS accuracy and temporary fluctuations
  const gpsAccuracy = Math.max(0, parseFloat(accuracy) || 10);
  const effectiveDistance = Math.max(0, rawDistance - gpsAccuracy);

  const isWithinCorridor = effectiveDistance <= tolerance;

  dp.lastGps = {
    lat: numLat,
    lng: numLng,
    speed: parseFloat(speed) || 0,
    accuracy: gpsAccuracy,
    timestamp: now.toISOString(),
  };
  dp.lastDistanceMeters = Math.round(effectiveDistance);

  // Non-blocking persist to gps_tracking table if CRM DB is reachable
  try {
    writeToCRM(
      `INSERT INTO gps_tracking (dp_ref_id, route_id, lat, lng, speed, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        dp.assignedRouteId,
        dp.assignedRouteId,
        numLat,
        numLng,
        speed,
        now,
      ]
    ).catch(() => {});
  } catch (e) {}

  // =========================================================================
  // MONITORING STATE MACHINE: GREEN -> YELLOW -> RED
  // =========================================================================

  if (isWithinCorridor) {
    // DP is inside permitted corridor -> GREEN
    dp.status = 'GREEN';

    // If an active deviation session existed, CLOSE / RESOLVE it
    if (dp.activeSessionId) {
      const activeSession = deviationSessionsStore.find(s => s.id === dp.activeSessionId && s.status === 'ACTIVE');
      if (activeSession) {
        activeSession.status = 'RESOLVED';
        activeSession.resolvedAt = now.toISOString();
        activeSession.durationSeconds = Math.round((now - new Date(activeSession.startedAt)) / 1000);
        activeSession.resolutionReason = 'Returned to permitted route corridor';
      }
      dp.activeSessionId = null;
    }

    dp.deviationStartTime = null;

    return {
      success: true,
      status: 'GREEN',
      isWithinCorridor: true,
      distanceMeters: Math.round(effectiveDistance),
      rawDistanceMeters: Math.round(rawDistance),
      corridorToleranceMeters: tolerance,
      dp,
      activeSession: null,
    };
  }

  // Outside corridor:
  if (!dp.deviationStartTime) {
    dp.deviationStartTime = now.getTime();
  }

  const elapsedSeconds = Math.round((now.getTime() - dp.deviationStartTime) / 1000);

  if (elapsedSeconds <= gracePeriod) {
    // Temporarily outside corridor within grace period -> YELLOW
    dp.status = 'YELLOW';

    return {
      success: true,
      status: 'YELLOW',
      isWithinCorridor: false,
      gracePeriodRemainingSeconds: Math.max(0, gracePeriod - elapsedSeconds),
      distanceMeters: Math.round(effectiveDistance),
      corridorToleranceMeters: tolerance,
      dp,
      activeSession: null,
    };
  }

  // Persistently outside corridor beyond grace period -> RED
  dp.status = 'RED';

  // Session Mechanism: Maintain ONE session for continuous deviation
  let session = null;
  if (dp.activeSessionId) {
    session = deviationSessionsStore.find(s => s.id === dp.activeSessionId && s.status === 'ACTIVE');
  }

  if (!session) {
    // Initiate ONE new continuous deviation session
    session = {
      id: `dev-sess-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dpId: dp.id,
      dpName: dp.name,
      routeId: dp.assignedRouteId,
      routeName: dp.assignedRouteName,
      startedAt: new Date(dp.deviationStartTime).toISOString(),
      lastSeenAt: now.toISOString(),
      resolvedAt: null,
      status: 'ACTIVE',
      maxDistanceMeters: Math.round(effectiveDistance),
      currentDistanceMeters: Math.round(effectiveDistance),
      gpsUpdatesCount: 1,
      trail: [{ lat: numLat, lng: numLng, timestamp: now.toISOString(), distanceMeters: Math.round(effectiveDistance) }],
    };
    deviationSessionsStore.unshift(session);
    dp.activeSessionId = session.id;
  } else {
    // Update existing deviation session without creating new duplicate incident
    session.lastSeenAt = now.toISOString();
    session.currentDistanceMeters = Math.round(effectiveDistance);
    session.maxDistanceMeters = Math.max(session.maxDistanceMeters, Math.round(effectiveDistance));
    session.gpsUpdatesCount = (session.gpsUpdatesCount || 1) + 1;
    session.trail.push({ lat: numLat, lng: numLng, timestamp: now.toISOString(), distanceMeters: Math.round(effectiveDistance) });
  }

  return {
    success: true,
    status: 'RED',
    isWithinCorridor: false,
    distanceMeters: Math.round(effectiveDistance),
    corridorToleranceMeters: tolerance,
    dp,
    activeSession: session,
  };
}

module.exports = {
  ROUTE_NUNGAMBAKKAM_ID,
  ROUTE_TRIPLICANE_ID,
  ROUTE_COLORS,
  DEFAULT_CORRIDOR_CONFIG,
  dpGpsStore,
  deviationSessionsStore,
  pointToSegmentDistanceMeters,
  pointToPolylineDistanceMeters,
  getActualCustomersForRoute,
  generateRoadFollowingRoute,
  getRoutePolyline,
  getRouteCorridors,
  processGpsPing,
};
