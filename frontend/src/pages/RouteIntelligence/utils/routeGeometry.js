// ============================================================
// ROUTE INTELLIGENCE — REAL CUSTOMER ROUTE GEOMETRY GENERATOR
// Route-based Geofencing for Nungambakkam 1 (Blue) & Triplicane 1 (Green)
// Generates road-following route polylines through actual customer coordinates
// ============================================================

// Standardized Head Office Coordinates
export const DEFAULT_HEAD_OFFICE = { lat: 13.0604, lng: 80.2496 };

// Standardized Route Color Assignment
export const ROUTE_COLOR_MAP = {
  'nungambakkam 1': '#2563eb',  // Blue (Requirement 3)
  'nungambakkam':   '#2563eb',
  'triplicane 1':   '#10b981',  // Green (Requirement 3)
  'triplicane':     '#10b981',
  'royapettah':     '#3b82f6',
  'royapettah 2':   '#3b82f6',
  'mandaveli 2':    '#a855f7',
  'mandaveli':      '#a855f7',
  'teynampet':      '#10b981',
  'teynampet 1':    '#10b981',
};

export const DEFAULT_ROUTE_COLORS = ['#2563eb', '#10b981', '#3b82f6', '#a855f7'];

// Memory cache for road-following routes in frontend session
const roadRouteCache = {};

/**
 * Standardizes raw route names into canonical display names & color
 */
export function normalizeRouteInfo(rawName, index = 0) {
  if (!rawName) return { id: 'route-unassigned', name: 'Unassigned Route', color: DEFAULT_ROUTE_COLORS[index % 4], isRouteCorridor: false };
  const lower = rawName.toLowerCase().trim();

  if (lower.includes('nungambakkam')) {
    return { id: 'route-nungambakkam1', name: 'Nungambakkam 1', color: '#2563eb', isRouteCorridor: true };
  }
  if (lower.includes('triplicane')) {
    return { id: 'route-triplicane1', name: 'Triplicane 1', color: '#10b981', isRouteCorridor: true };
  }
  if (lower.includes('royapettah')) {
    return { id: 'route-royapettah', name: 'Royapettah Route', color: '#3b82f6', isRouteCorridor: false };
  }
  if (lower.includes('mandaveli')) {
    return { id: 'route-mandaveli2', name: 'Mandaveli 2 Route', color: '#a855f7', isRouteCorridor: false };
  }
  if (lower.includes('teynampet')) {
    return { id: 'route-teynampet', name: 'Teynampet Route', color: '#10b981', isRouteCorridor: false };
  }

  return {
    id: `route-${index}`,
    name: rawName,
    color: DEFAULT_ROUTE_COLORS[index % DEFAULT_ROUTE_COLORS.length],
    isRouteCorridor: false,
  };
}

/**
 * Distance in meters from point P to segment AB (Equirectangular projection)
 */
export function pointToSegmentDistanceMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const degToRad = Math.PI / 180;
  const latScale = 111139;
  const lngScale = 111139 * Math.cos(13.06 * degToRad);

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
 * Calculates minimum distance from a point to a road polyline in meters
 */
export function pointToPolylineDistanceMeters(lat, lng, polyline) {
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
 * Check if a location is within the permitted corridor tolerance
 */
export function isWithinCorridor(lat, lng, polyline, toleranceMeters = 120, accuracy = 0) {
  const rawDist = pointToPolylineDistanceMeters(lat, lng, polyline);
  const effectiveDist = Math.max(0, rawDist - (accuracy || 0));
  return {
    isWithin: effectiveDist <= toleranceMeters,
    distanceMeters: Math.round(effectiveDist),
    rawDistanceMeters: Math.round(rawDist),
  };
}

/**
 * Nearest-neighbor path ordering through delivery stop coordinates
 */
export function orderCustomerStops(customers, startPoint = null) {
  const valid = customers
    .filter(c => c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng)))
    .map(c => ({
      ...c,
      lat: parseFloat(c.lat),
      lng: parseFloat(c.lng),
    }));

  if (valid.length === 0) return [];
  const start = startPoint || valid[0];

  const unvisited = [...valid];
  const ordered = [];
  let current = start;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const dist = Math.hypot(unvisited[i].lat - current.lat, unvisited[i].lng - current.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }
    current = unvisited.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

/**
 * Generates road-following route using OSRM through actual customer coordinates
 */
export async function fetchRoadFollowingRoute(orderedStops, cacheKey = null) {
  if (cacheKey && roadRouteCache[cacheKey]) {
    return roadRouteCache[cacheKey];
  }
  if (!orderedStops || orderedStops.length < 2) {
    return orderedStops ? orderedStops.map(s => [s.lat, s.lng]) : [];
  }

  const chunkSize = 15;
  const roadCoords = [];

  try {
    for (let i = 0; i < orderedStops.length - 1; i += (chunkSize - 1)) {
      const chunk = orderedStops.slice(i, i + chunkSize);
      if (chunk.length < 2) continue;

      const pts = chunk.map(c => `${c.lng},${c.lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await resp.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]?.geometry?.coordinates) {
        const seg = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        roadCoords.push(...seg);
      } else {
        roadCoords.push(...chunk.map(c => [c.lat, c.lng]));
      }
    }
  } catch (err) {
    // If routing service is unavailable, fallback to straight line segments
    const fallback = orderedStops.map(c => [c.lat, c.lng]);
    if (cacheKey) roadRouteCache[cacheKey] = fallback;
    return fallback;
  }

  const result = roadCoords.length > 0 ? roadCoords : orderedStops.map(c => [c.lat, c.lng]);
  if (cacheKey) roadRouteCache[cacheKey] = result;
  return result;
}

/**
 * Synchronous route polyline generator (nearest-neighbor ordering)
 */
export function generateRoutePolylinePoints(customers, headOffice = null) {
  const ordered = orderCustomerStops(customers, headOffice);
  const coords = ordered.map(c => [c.lat, c.lng]);
  if (headOffice && coords.length > 0) {
    return [[headOffice.lat, headOffice.lng], ...coords];
  }
  return coords;
}

/**
 * Groups real customers by route and generates active routes with polylines
 */
export function buildActiveCustomerRoutes(customers, headOffice = null) {
  const routeGroups = {};

  customers.forEach(c => {
    const rawRoute = c.route_name || c.assigned_route_id || c.route;
    if (!rawRoute) return;

    const norm = normalizeRouteInfo(rawRoute);
    const key = norm.name;

    if (!routeGroups[key]) {
      routeGroups[key] = {
        id: norm.id,
        name: norm.name,
        color: norm.color,
        isRouteCorridor: norm.isRouteCorridor || false,
        corridorToleranceMeters: norm.isRouteCorridor ? 120 : null,
        customers: [],
        validCustomers: [],
        missingCustomers: [],
      };
    }

    routeGroups[key].customers.push(c);
    if (c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng))) {
      routeGroups[key].validCustomers.push(c);
    } else {
      routeGroups[key].missingCustomers.push(c);
    }
  });

  return Object.values(routeGroups)
    .filter(rg => rg.customers.length > 0)
    .map(rg => {
      const polyline = generateRoutePolylinePoints(rg.validCustomers, headOffice);
      return {
        id: rg.id,
        name: rg.name,
        color: rg.color,
        isRouteCorridor: rg.isRouteCorridor,
        corridorToleranceMeters: rg.corridorToleranceMeters,
        customerCount: rg.customers.length,
        validLocationCount: rg.validCustomers.length,
        missingLocationCount: rg.missingCustomers.length,
        polyline,
        customers: rg.customers,
        missingCustomers: rg.missingCustomers,
      };
    });
}
