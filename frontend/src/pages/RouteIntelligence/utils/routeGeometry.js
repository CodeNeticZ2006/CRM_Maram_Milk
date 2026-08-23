// ============================================================
// ROUTE INTELLIGENCE — REAL CUSTOMER ROUTE GEOMETRY GENERATOR
// Generates delivery route polylines directly from DB customer coordinates
// ============================================================

// Standardized Head Office Coordinates
const DEFAULT_HEAD_OFFICE = { lat: 13.0604, lng: 80.2496 };

// Standardized Route Color Assignment
export const ROUTE_COLOR_MAP = {
  'royapettah': '#3b82f6',    // Blue
  'royapettah 2': '#3b82f6',
  'royapettah route': '#3b82f6',
  'mandaveli 2': '#a855f7',   // Purple
  'mandaveli': '#a855f7',
  'mandaveli 2 route': '#a855f7',
  'teynampet': '#10b981',     // Green
  'teynampet 1': '#10b981',
  'teynampet route': '#10b981',
};

export const DEFAULT_ROUTE_COLORS = ['#3b82f6', '#a855f7', '#10b981'];

/**
 * Standardizes raw route names into canonical display names & color
 */
export function normalizeRouteInfo(rawName, index = 0) {
  if (!rawName) return { id: 'route-unassigned', name: 'Unassigned Route', color: DEFAULT_ROUTE_COLORS[index % 3] };
  const lower = rawName.toLowerCase().trim();

  if (lower.includes('royapettah')) {
    return { id: 'route-royapettah', name: 'Royapettah Route', color: '#3b82f6' };
  }
  if (lower.includes('mandaveli')) {
    return { id: 'route-mandaveli2', name: 'Mandaveli 2 Route', color: '#a855f7' };
  }
  if (lower.includes('teynampet')) {
    return { id: 'route-teynampet', name: 'Teynampet Route', color: '#10b981' };
  }

  return {
    id: `route-${index}`,
    name: rawName,
    color: DEFAULT_ROUTE_COLORS[index % DEFAULT_ROUTE_COLORS.length],
  };
}

/**
 * Nearest-neighbor path ordering from Head Office through delivery stop coordinates
 */
export function generateRoutePolylinePoints(customers, headOffice = DEFAULT_HEAD_OFFICE) {
  const valid = customers
    .filter(c => c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng)))
    .map(c => ({
      lat: parseFloat(c.lat),
      lng: parseFloat(c.lng),
      name: c.name,
      code: c.customer_code || c.code || '',
    }));

  if (valid.length === 0) return [];

  const hqPoint = headOffice ? { lat: headOffice.lat, lng: headOffice.lng } : { lat: 13.0604, lng: 80.2496 };

  // Nearest-neighbor ordering
  const unvisited = [...valid];
  const orderedCoords = [[hqPoint.lat, hqPoint.lng]];
  let current = hqPoint;

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
    orderedCoords.push([current.lat, current.lng]);
  }

  return orderedCoords;
}

/**
 * Groups real customers by route and generates ONLY active routes (customers > 0) with polylines
 */
export function buildActiveCustomerRoutes(customers, headOffice = DEFAULT_HEAD_OFFICE) {
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
        customers: [],
        validCustomers: [],
      };
    }

    routeGroups[key].customers.push(c);
    if (c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng))) {
      routeGroups[key].validCustomers.push(c);
    }
  });

  // Convert to array and keep ONLY routes that have at least 1 customer
  return Object.values(routeGroups)
    .filter(rg => rg.customers.length > 0)
    .map(rg => {
      const polyline = generateRoutePolylinePoints(rg.validCustomers, headOffice);
      return {
        id: rg.id,
        name: rg.name,
        color: rg.color,
        customerCount: rg.customers.length,
        validLocationCount: rg.validCustomers.length,
        polyline,
        customers: rg.customers,
      };
    });
}
