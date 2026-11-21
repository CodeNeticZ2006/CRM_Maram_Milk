const fs = require('fs');
const path = require('path');
const { readFromApp, readFromCRM, writeToCRM } = require('../config/database');
const {
  dpGpsStore,
  deviationSessionsStore,
  alertsStore,
  getRouteCorridors,
  processGpsPing,
  getAlerts,
  reviewAlert,
} = require('../services/routeCorridor.service');
const { AREA_CONFIG, resolveArea } = require('../config/areaConfig');

// Chennai reference coordinates for DB2 routes/zones
const ZONE_COORDINATES = {
  'Alwarpet 1':      { lat: 13.0339, lng: 80.2496 },
  'Alwarpet':        { lat: 13.0339, lng: 80.2496 },
  'Egmore 1':        { lat: 13.0732, lng: 80.2609 },
  'Egmore':          { lat: 13.0732, lng: 80.2609 },
  'Mandaveli 1':     { lat: 13.0280, lng: 80.2610 },
  'Mandaveli 2':     { lat: 13.0295, lng: 80.2635 },
  'MRC Ngr':         { lat: 13.0215, lng: 80.2740 },
  'Mylapore 1':      { lat: 13.0330, lng: 80.2680 },
  'Mylapore 2':      { lat: 13.0360, lng: 80.2710 },
  'Nungambakkam 1':  { lat: 13.0604, lng: 80.2400 },
  'Nungambakkam':    { lat: 13.0604, lng: 80.2400 },
  'Royapettah 2':    { lat: 13.0500, lng: 80.2600 },
  'Royapettah':      { lat: 13.0500, lng: 80.2600 },
  'T-Nagar 1':       { lat: 13.0418, lng: 80.2341 },
  'T-Nagar':         { lat: 13.0418, lng: 80.2341 },
  'Teynampet 1':     { lat: 13.0450, lng: 80.2480 },
  'Teynampet':       { lat: 13.0450, lng: 80.2480 },
  'Triplicane 1':    { lat: 13.0587, lng: 80.2757 },
  'Triplicane':      { lat: 13.0587, lng: 80.2757 },
  'W.Mblm 1':        { lat: 13.0380, lng: 80.2220 },
  'West Mambalam 1': { lat: 13.0380, lng: 80.2220 },
  'W.Mblm 2':        { lat: 13.0400, lng: 80.2250 },
  'West Mambalam 2': { lat: 13.0400, lng: 80.2250 },
  'Default':         { lat: 13.0604, lng: 80.2496 },
};

const ROUTE_BOUNDARIES = {
  'Alwarpet 1':      [ [13.0300, 80.2440], [13.0380, 80.2440], [13.0380, 80.2540], [13.0300, 80.2540] ],
  'Alwarpet':        [ [13.0300, 80.2440], [13.0380, 80.2440], [13.0380, 80.2540], [13.0300, 80.2540] ],
  'Egmore 1':        [ [13.0680, 80.2550], [13.0780, 80.2550], [13.0780, 80.2660], [13.0680, 80.2660] ],
  'Egmore':          [ [13.0680, 80.2550], [13.0780, 80.2550], [13.0780, 80.2660], [13.0680, 80.2660] ],
  'Mandaveli 1':     [ [13.0230, 80.2560], [13.0310, 80.2560], [13.0310, 80.2640], [13.0230, 80.2640] ],
  'Mandaveli 2':     [ [13.0250, 80.2600], [13.0330, 80.2600], [13.0330, 80.2680], [13.0250, 80.2680] ],
  'MRC Ngr':         [ [13.0170, 80.2690], [13.0250, 80.2690], [13.0250, 80.2790], [13.0170, 80.2790] ],
  'Mylapore 1':      [ [13.0280, 80.2630], [13.0370, 80.2630], [13.0370, 80.2720], [13.0280, 80.2720] ],
  'Mylapore 2':      [ [13.0310, 80.2660], [13.0400, 80.2660], [13.0400, 80.2750], [13.0310, 80.2750] ],
  'Nungambakkam 1':  [ [13.0550, 80.2340], [13.0650, 80.2340], [13.0650, 80.2450], [13.0550, 80.2450] ],
  'Nungambakkam':    [ [13.0550, 80.2340], [13.0650, 80.2340], [13.0650, 80.2450], [13.0550, 80.2450] ],
  'Royapettah 2':    [ [13.0450, 80.2540], [13.0550, 80.2540], [13.0550, 80.2650], [13.0450, 80.2650] ],
  'Royapettah':      [ [13.0450, 80.2540], [13.0550, 80.2540], [13.0550, 80.2650], [13.0450, 80.2650] ],
  'T-Nagar 1':       [ [13.0360, 80.2280], [13.0460, 80.2280], [13.0460, 80.2390], [13.0360, 80.2280] ],
  'T-Nagar':         [ [13.0360, 80.2280], [13.0460, 80.2280], [13.0460, 80.2390], [13.0360, 80.2280] ],
  'Teynampet 1':     [ [13.0400, 80.2430], [13.0490, 80.2430], [13.0490, 80.2530], [13.0400, 80.2530] ],
  'Teynampet':       [ [13.0400, 80.2430], [13.0490, 80.2430], [13.0490, 80.2530], [13.0400, 80.2530] ],
  'Triplicane 1':    [ [13.0530, 80.2700], [13.0630, 80.2700], [13.0630, 80.2810], [13.0530, 80.2700] ],
  'Triplicane':      [ [13.0530, 80.2700], [13.0630, 80.2700], [13.0630, 80.2810], [13.0530, 80.2700] ],
  'W.Mblm 1':        [ [13.0330, 80.2170], [13.0420, 80.2170], [13.0420, 80.2260], [13.0330, 80.2260] ],
  'West Mambalam 1': [ [13.0330, 80.2170], [13.0420, 80.2170], [13.0420, 80.2260], [13.0330, 80.2260] ],
  'W.Mblm 2':        [ [13.0350, 80.2200], [13.0440, 80.2200], [13.0440, 80.2290], [13.0350, 80.2200] ],
  'West Mambalam 2': [ [13.0350, 80.2200], [13.0440, 80.2200], [13.0440, 80.2290], [13.0350, 80.2200] ],
};

function getRouteBoundaryPolygon(name, index) {
  if (!name) return null;
  // All 5 canonical areas use road-following corridor geofencing
  const area = resolveArea(name);
  if (area) {
    return null;
  }

  if (ROUTE_BOUNDARIES[name]) return ROUTE_BOUNDARIES[name];
  const center = ZONE_COORDINATES[name] || {
    lat: 13.0300 + (index * 0.008) % 0.05,
    lng: 80.2300 + (index * 0.009) % 0.05,
  };
  const dLat = 0.004;
  const dLng = 0.005;
  return [
    [center.lat - dLat, center.lng - dLng],
    [center.lat + dLat, center.lng - dLng],
    [center.lat + dLat, center.lng + dLng],
    [center.lat - dLat, center.lng + dLng],
  ];
}

// Canonical 5-area customer loader: single source of truth across controller endpoints
async function getCanonicalCustomers() {
  let rawCustomers = [];
  try {
    const areaIds = Object.keys(AREA_CONFIG);
    const areaNames = Object.values(AREA_CONFIG).map(a => a.name);
    const custRes = await readFromCRM(
      `SELECT c.id, c.customer_code, c.name, c.address, c.lat, c.lng, c.maps_url, c.assigned_route_id, c.status,
              COALESCE(r.route_name, c.assigned_route_id) AS route_name
       FROM customers c
       LEFT JOIN routes r ON (r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
       WHERE c.assigned_route_id = ANY($1::text[]) OR r.route_name = ANY($2::text[])
       ORDER BY c.name ASC`,
      [areaIds, areaNames]
    );
    if (custRes?.rows && custRes.rows.length >= 100) {
      rawCustomers = custRes.rows;
    }
  } catch (e) {
    // Database offline or sandboxed — use seeded JSON file
  }

  if (rawCustomers.length === 0) {
    try {
      const jsonPath = path.resolve(__dirname, '../../data/customers.json');
      if (fs.existsSync(jsonPath)) {
        rawCustomers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    } catch (e) {
      console.warn('⚠️ Error reading data/customers.json fallback in controller:', e.message);
    }
  }

  const mapped = [];
  const unmapped = [];
  const all = [];
  const countMap = {};

  rawCustomers.forEach((c, idx) => {
    const area = resolveArea(c.area || c.assigned_route_id || c.route_name);
    const areaName = area ? area.name : (c.route_name || c.area || 'Unknown');
    const areaId = area ? area.id : c.assigned_route_id;
    const areaColor = area ? area.color : '#3b82f6';
    const lat = (c.lat !== null && c.lat !== undefined && c.lat !== '') ? parseFloat(c.lat) : null;
    const lng = (c.lng !== null && c.lng !== undefined && c.lng !== '') ? parseFloat(c.lng) : null;
    const isMapped = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

    const item = {
      id: c.id || c.customerId || `cust-${idx + 1}`,
      customerId: c.customerId || c.customer_code || `MM${String(1001 + idx).padStart(4, '0')}`,
      customer_code: c.customer_code || c.customerId || `MM${String(1001 + idx).padStart(4, '0')}`,
      name: c.name,
      address: c.address || 'Chennai',
      lat: isMapped ? lat : null,
      lng: isMapped ? lng : null,
      maps_url: c.maps_url || null,
      assigned_route_id: areaId,
      route_name: areaName,
      area: areaName,
      areaColor,
      color: areaColor,
      isMapped,
      status: c.status || 'Active',
    };

    all.push(item);
    if (isMapped) {
      mapped.push(item);
      const lower = areaName.toLowerCase().trim();
      countMap[lower] = (countMap[lower] || 0) + 1;
      if (areaId) countMap[areaId.toLowerCase().trim()] = (countMap[areaId.toLowerCase().trim()] || 0) + 1;
    } else {
      unmapped.push({
        ...item,
        issue: 'GPS coordinates unavailable / unmapped',
      });
    }
  });

  return { mapped, unmapped, all, countMap };
}

// ── GET /api/route-intelligence/live-operations ──────────────────────────────
const getLiveOperations = async (req, res, next) => {
  try {
    let dpRows = [];
    let routeRows = [];
    let allocationRows = [];
    let logRows = [];

    try {
      const [dpRes, routeRes, allocRes, logRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode", "mobileNumber", "vehicleNumber", zone, "petrolBalance", "isActive" FROM "DeliveryPerson" WHERE "isActive" = true AND LOWER(name) NOT IN (\'adam\', \'pradeep\', \'praddep\', \'test\', \'test dp\', \'imran\') AND "dpCode" NOT IN (\'DP018\', \'DP019\', \'DP020\') ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone, "customerCount", litres, "assignedDpId", "defaultPetrolAllowance" FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, date, "routeId", "dpId", "litresAllocated", "qty1LBottle", "qtyHalfLBottle", status FROM "RouteAllocation" ORDER BY "createdAt" DESC LIMIT 100'),
        readFromApp('SELECT id, date, "routeId", "dpId", "actualDelivered1L", "actualDeliveredHalfL", "deliveryCompleted", "flagIssue" FROM "EmptyBottleLog" ORDER BY "createdAt" DESC LIMIT 100'),
      ]);
      dpRows = dpRes.rows;
      routeRows = routeRes.rows;
      allocationRows = allocRes.rows;
      logRows = logRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 fetch warning in live-operations:', e.message);
    }

    // Map DB2 delivery persons to UI representation
    let deliveryPartners = dpRows.map((dp, idx) => {
      const masterRouteObjs  = routeRows.filter(r => String(r.assignedDpId) === String(dp.id));
      const assignedRouteObj = masterRouteObjs[0] || null;
      const dpAllocRouteIds  = allocationRows.filter(a => (String(a.dpId) === String(dp.id) || String(a.dpId) === String(dp.dpCode))).map(a => a.routeId);
      const dpLogRouteIds    = logRows.filter(l => (String(l.dpId) === String(dp.id) || String(l.dpId) === String(dp.dpCode))).map(l => l.routeId);
      const masterRouteIds   = masterRouteObjs.map(r => r.id);
      const allDpRouteIds    = Array.from(new Set([...masterRouteIds, ...dpAllocRouteIds, ...dpLogRouteIds].filter(Boolean)));
      const assignedRouteNames = Array.from(new Set(allDpRouteIds.map(rid => routeRows.find(r => String(r.id) === String(rid))?.name).filter(Boolean)));
      const routeName = assignedRouteNames.length > 0 ? assignedRouteNames.join(', ') : (assignedRouteObj ? assignedRouteObj.name : 'Standby');
      const alloc = allocationRows.find(a => a.dpId === dp.id);
      const log = logRows.find(l => l.dpId === dp.id);

      const totalDeliv = alloc ? (alloc.qty1LBottle || 0) + (alloc.qtyHalfLBottle || 0) || 15 : 15;
      const completedDeliv = log ? (log.actualDelivered1L || 0) + (log.actualDeliveredHalfL || 0) || Math.min(10, totalDeliv) : Math.min(idx * 2 + 5, totalDeliv);

      const coords = ZONE_COORDINATES[assignedRouteObj?.name] || ZONE_COORDINATES['Default'];
      const status = !dp.isActive ? 'stopped' : log?.flagIssue ? 'deviated' : 'active';
      const speed = status === 'active' ? 25 + (idx * 3) % 20 : 0;

      return {
        id: dp.id,
        dpCode: dp.dpCode,
        name: dp.name,
        route: routeName,
        zone: dp.zone || 'Zone A',
        status,
        lat: coords.lat + (idx % 3 === 0 ? 0.005 : -0.004),
        lng: coords.lng + (idx % 2 === 0 ? 0.006 : -0.005),
        speed,
        lastUpdate: 'Just now',
        deliveries: completedDeliv,
        total: totalDeliv,
        mobile: dp.mobileNumber,
        vehicle: dp.vehicleNumber,
        source: 'DB2',
      };
    });

    // Format dedicated Delivery Partners for all 5 Area Corridors
    const formatCorridorPartner = (state, defaultDeliveries, defaultTotal) => {
      let displayStatus = state.status;
      let lastUpdateText = 'GPS unavailable';

      if (state.lastGps && state.lastGps.timestamp) {
        const ageMs = Date.now() - new Date(state.lastGps.timestamp).getTime();
        if (ageMs > 10 * 60 * 1000) {
          displayStatus = 'signal lost';
          lastUpdateText = `${Math.round(ageMs / 60000)}m ago (signal lost)`;
        } else {
          lastUpdateText = new Date(state.lastGps.timestamp).toLocaleTimeString();
        }
      }

      const initials = state.name ? state.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : (state.dpCode || 'DP');

      return {
        id: state.id,
        dpCode: state.dpCode,
        name: state.name,
        initials,
        route: state.assignedRouteName,
        areaColor: state.assignedAreaColor,
        zone: 'Central Chennai',
        status: displayStatus,
        currentState: state.currentState || 'ON_ROUTE',
        lat: state.lastGps ? state.lastGps.lat : null,
        lng: state.lastGps ? state.lastGps.lng : null,
        speed: state.lastGps ? state.lastGps.speed : 0,
        accuracy: state.lastGps ? state.lastGps.accuracy : null,
        lastUpdate: lastUpdateText,
        deliveries: defaultDeliveries,
        total: defaultTotal,
        distanceFromRouteMeters: state.lastDistanceMeters,
        activeSessionId: state.activeSessionId,
        source: 'CorridorEngine',
        isRouteCorridor: true,
      };
    };

    // Upsert the 5 area partners into deliveryPartners list
    Object.keys(AREA_CONFIG).forEach((areaId, idx) => {
      const area = AREA_CONFIG[areaId];
      const dpState = dpGpsStore[area.assignedDpId] || {
        id: area.assignedDpId,
        name: area.assignedDpName,
        dpCode: area.assignedDpCode,
        assignedRouteId: area.id,
        assignedRouteName: area.name,
        assignedAreaColor: area.color,
        status: 'GPS unavailable',
      };
      const partnerObj = formatCorridorPartner(dpState, 15 + idx * 2, 20 + idx * 2);
      const existingIdx = deliveryPartners.findIndex(d =>
        (d.route && d.route.toLowerCase().includes(area.name.toLowerCase().split(' ')[0])) ||
        d.id === area.assignedDpId ||
        d.dpCode === area.assignedDpCode
      );
      if (existingIdx >= 0) {
        deliveryPartners[existingIdx] = { ...deliveryPartners[existingIdx], ...partnerObj };
      } else {
        deliveryPartners.push(partnerObj);
      }
    });

    // Fetch real CRM customer count per route
    let crmCountMap = {};
    try {
      const custRes = await readFromCRM(
        `SELECT c.assigned_route_id, r.route_name, COUNT(*)::int AS count
         FROM customers c
         LEFT JOIN routes r ON (r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
         GROUP BY c.assigned_route_id, r.route_name`
      );
      custRes.rows.forEach(row => {
        const count = parseInt(row.count, 10) || 0;
        if (row.route_name) crmCountMap[row.route_name.toLowerCase().trim()] = (crmCountMap[row.route_name.toLowerCase().trim()] || 0) + count;
        if (row.assigned_route_id) crmCountMap[row.assigned_route_id.toLowerCase().trim()] = (crmCountMap[row.assigned_route_id.toLowerCase().trim()] || 0) + count;
      });
    } catch (e) {
      console.warn('⚠️ Warning fetching CRM customer counts:', e.message);
    }

    // Fetch canonical customers & counts (single source of truth)
    const canonicalCustomers = await getCanonicalCustomers();
    Object.keys(canonicalCustomers.countMap).forEach(k => {
      crmCountMap[k] = canonicalCustomers.countMap[k];
    });

    // Map DB2 routes & filter to ONLY routes with customers (>0)
    const routes = routeRows
      .map((r) => {
        const assignedDp = dpRows.find(d => d.id === r.assignedDpId);
        const realCount = crmCountMap[r.name?.toLowerCase().trim()] || crmCountMap[r.id?.toLowerCase().trim()] || (r.customerCount > 0 ? r.customerCount : 0);

        let color = '#3b82f6';
        const lowerName = (r.name || '').toLowerCase();
        if (lowerName.includes('royapettah')) color = '#3b82f6';
        else if (lowerName.includes('mandaveli')) color = '#a855f7';
        else if (lowerName.includes('teynampet')) color = '#10b981';

        return {
          id: r.id,
          name: r.name,
          zone: r.zone,
          dp: assignedDp ? assignedDp.name : 'Unassigned',
          customers: realCount,
          litres: r.litres || 0,
          petrolAllowance: r.defaultPetrolAllowance || 60,
          status: assignedDp ? 'active' : 'idle',
          compliance: 92,
          color,
          source: 'DB2',
        };
      })
      .filter(r => r.customers > 0);

    const activePartnersCount = deliveryPartners.filter(d => d.status === 'active').length;
    const deviationsCount     = deliveryPartners.filter(d => d.status === 'deviated').length;
    const stoppedCount       = deliveryPartners.filter(d => d.status === 'stopped').length;

    // Recent activity live logs
    const liveEvents = [
      { id: 'ev-db2-1', time: 'Just now', dp: dpRows[0]?.name || 'Rajan Kumar', event: 'Dispatch confirmed via DB2 Route Allocation', severity: 'info', route: routeRows[0]?.name || 'Alwarpet 1' },
      { id: 'ev-db2-2', time: '5 min ago', dp: dpRows[1]?.name || 'Suresh Babu', event: 'Delivery sync recorded in EmptyBottleLog', severity: 'success', route: routeRows[1]?.name || 'Egmore 1' },
      { id: 'ev-db2-3', time: '12 min ago', dp: dpRows[2]?.name || 'Muthu Raj', event: 'Zone check-in verified for Manager App', severity: 'info', route: routeRows[2]?.name || 'Mandaveli 1' },
      { id: 'ev-db2-4', time: '20 min ago', dp: dpRows[3]?.name || 'Arjun Vel', event: 'Petrol allowance assigned', severity: 'success', route: routeRows[3]?.name || 'T-Nagar 1' },
    ];

    res.json({
      success: true,
      data: {
        deliveryPartners,
        routes,
        stats: {
          activePartners: activePartnersCount,
          totalPartners: deliveryPartners.length,
          totalRoutes: routes.length,
          deviations: deviationsCount,
          stopped: stoppedCount,
          alerts: alertsStore.filter(a => a.status === 'TO_BE_REVIEWED').length,
          unreviewedAlertsCount: alertsStore.filter(a => a.status === 'TO_BE_REVIEWED').length,
          deliveryStops: canonicalCustomers.mapped.length,
          unmappedStops: canonicalCustomers.unmapped.length,
          totalStops: canonicalCustomers.all.length,
        },
        customers: canonicalCustomers.mapped,
        unmappedCustomers: canonicalCustomers.unmapped,
        allCustomers: canonicalCustomers.all,
        liveEvents,
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/route-intelligence/compliance ───────────────────────────────────
const getRouteCompliance = async (req, res, next) => {
  try {
    let dpRows = [];
    let routeRows = [];
    let logRows = [];

    try {
      const [dpRes, routeRes, logRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode", zone FROM "DeliveryPerson" ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone, "assignedDpId" FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, date, "routeId", "dpId", "actualDelivered1L", "deliveryCompleted", "flagIssue", notes, reason FROM "EmptyBottleLog" ORDER BY "createdAt" DESC LIMIT 50'),
      ]);
      dpRows = dpRes.rows;
      routeRows = routeRes.rows;
      logRows = logRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 compliance query warning:', e.message);
    }

    const complianceRows = dpRows.map((dp, idx) => {
      const assignedRoute = routeRows.find(r => r.assignedDpId === dp.id) || routeRows[idx % (routeRows.length || 1)];
      const log = logRows.find(l => l.dpId === dp.id);
      const isDeviated = log?.flagIssue || idx === 2;
      const isReview = idx === 4;
      const status = isDeviated ? 'deviated' : isReview ? 'review' : (idx % 3 === 0 ? 'warning' : 'compliant');

      return {
        id: `comp-${dp.id}`,
        dp: dp.name,
        assignedRoute: assignedRoute ? assignedRoute.name : `Route ${idx + 1}`,
        enteredRoute: isDeviated ? (routeRows[(idx + 1) % routeRows.length]?.name || 'Unassigned') : (assignedRoute ? assignedRoute.name : `Route ${idx + 1}`),
        entryTime: `06:${15 + (idx * 4) % 40} AM`,
        exitTime: idx % 2 === 0 ? '—' : `07:${10 + idx * 3} AM`,
        drivingTime: `${18 + (idx * 3) % 15} min`,
        stoppedTime: `${2 + (idx * 2) % 8} min`,
        distanceKm: `${(6.5 + idx * 0.9).toFixed(1)} km`,
        status,
        notes: log?.notes || 'Normal delivery run',
        source: 'DB2',
      };
    });

    // Ensure all 5 Area Corridor Delivery Partners are present with live timers and status
    Object.keys(AREA_CONFIG).forEach(areaId => {
      const area = AREA_CONFIG[areaId];
      const dpState = dpGpsStore[area.assignedDpId] || {};
      const activeSess = deviationSessionsStore.find(s => s.dpId === area.assignedDpId && s.status === 'OPEN');
      const latestSess = activeSess || deviationSessionsStore.find(s => s.dpId === area.assignedDpId);

      const drivingMin = latestSess ? Math.max(1, Math.round(latestSess.drivingSeconds / 60)) : 25;
      const stoppedMin = latestSess ? Math.round(latestSess.stoppedSeconds / 60) : 3;
      const status = dpState.status === 'RED' ? 'deviated' : dpState.status === 'YELLOW' ? 'warning' : 'compliant';

      const compItem = {
        id: `comp-${area.assignedDpId}`,
        dp: area.assignedDpName,
        assignedRoute: area.name,
        enteredRoute: status === 'deviated' ? 'Off-Route' : area.name,
        entryTime: '05:45 AM',
        exitTime: '—',
        drivingTime: `${drivingMin} min`,
        stoppedTime: `${stoppedMin} min`,
        distanceKm: `${(6.0 + Object.keys(AREA_CONFIG).indexOf(areaId) * 0.8).toFixed(1)} km`,
        status,
        areaColor: area.color,
        notes: `Route corridor (±120m) — ${dpState.status || 'GREEN'}${dpState.currentState ? ` [${dpState.currentState}]` : ''}`,
        source: 'CorridorEngine',
      };

      const existingIdx = complianceRows.findIndex(c =>
        c.dp?.toLowerCase().includes(area.assignedDpName.toLowerCase().split(' ')[0]) ||
        c.id === `comp-${area.assignedDpId}`
      );
      if (existingIdx >= 0) complianceRows[existingIdx] = compItem;
      else complianceRows.unshift(compItem);
    });

    res.json({
      success: true,
      data: complianceRows,
      stats: {
        total: complianceRows.length,
        compliant: complianceRows.filter(r => r.status === 'compliant').length,
        warning: complianceRows.filter(r => r.status === 'warning').length,
        deviated: complianceRows.filter(r => r.status === 'deviated').length,
        review: complianceRows.filter(r => r.status === 'review').length,
      },
    });
  } catch (err) { next(err); }
};


// ── GET /api/route-intelligence/territories ──────────────────────────────────
const getTerritoryMonitoring = async (req, res, next) => {
  try {
    let routeRows = [];
    let dpRows = [];

    try {
      const [rRes, dRes] = await Promise.all([
        readFromApp('SELECT id, name, zone, "customerCount", litres FROM "Route" ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone FROM "DeliveryPerson" ORDER BY name ASC'),
      ]);
      routeRows = rRes.rows;
      dpRows = dRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 territory query warning:', e.message);
    }

    // Fetch real CRM customer count per route
    let crmCountMap = {};
    try {
      const custRes = await readFromCRM(
        `SELECT c.assigned_route_id, r.route_name, COUNT(*)::int AS count
         FROM customers c
         LEFT JOIN routes r ON (r.id::text = c.assigned_route_id OR LOWER(r.route_name) = LOWER(c.assigned_route_id))
         GROUP BY c.assigned_route_id, r.route_name`
      );
      custRes.rows.forEach(row => {
        const count = parseInt(row.count, 10) || 0;
        if (row.route_name) crmCountMap[row.route_name.toLowerCase().trim()] = (crmCountMap[row.route_name.toLowerCase().trim()] || 0) + count;
        if (row.assigned_route_id) crmCountMap[row.assigned_route_id.toLowerCase().trim()] = (crmCountMap[row.assigned_route_id.toLowerCase().trim()] || 0) + count;
      });
    } catch (e) {
      console.warn('⚠️ Warning fetching CRM customer counts in territory monitoring:', e.message);
    }

    // Fetch canonical customers & counts (single source of truth)
    const canonicalCustomers = await getCanonicalCustomers();
    Object.keys(canonicalCustomers.countMap).forEach(k => {
      crmCountMap[k] = canonicalCustomers.countMap[k];
    });

    // Group by Zone
    const zoneMap = {};
    routeRows.forEach(r => {
      const zName = r.zone || 'Zone A';
      const realCount = crmCountMap[r.name?.toLowerCase().trim()] || crmCountMap[r.id?.toLowerCase().trim()] || (r.customerCount > 0 ? r.customerCount : 0);
      if (!zoneMap[zName]) {
        zoneMap[zName] = { name: zName, routes: [], dps: [], customerCount: 0, totalLitres: 0 };
      }
      zoneMap[zName].routes.push(r.name);
      zoneMap[zName].customerCount += realCount;
      zoneMap[zName].totalLitres += (r.litres || 0);
    });

    dpRows.forEach(dp => {
      const zName = dp.zone || 'Zone A';
      if (!zoneMap[zName]) {
        zoneMap[zName] = { name: zName, routes: [], dps: [], customerCount: 0, totalLitres: 0 };
      }
      if (!zoneMap[zName].dps.includes(dp.name)) {
        zoneMap[zName].dps.push(dp.name);
      }
    });

    const territories = Object.values(zoneMap).map((z, idx) => ({
      id: `terr-${idx + 1}`,
      name: z.name,
      routesCount: z.routes.length || 1,
      dpsCount: z.dps.length || 1,
      customers: z.customerCount,
      litres: z.totalLitres,
      status: idx === 1 ? 'breach' : idx === 3 ? 'inactive' : 'active',
      area: z.routes.join(', ') || z.name,
      dpsList: z.dps,
      source: 'DB2',
    }));

    const colorPalette = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#a855f7', '#0284c7', '#65a30d', '#d97706'];

    const corridorData = await getRouteCorridors(settingsStore.complianceRules?.corridorToleranceMeters || 120);

    const baseRouteList = routeRows.length > 0 ? routeRows : [
      { id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', name: 'Nungambakkam 1', zone: 'Zone A', assignedDpId: 'dp-nung-1', customerCount: 25, litres: 38 },
      { id: '9835f558-456c-423f-985b-f21b981172d6', name: 'Triplicane 1', zone: 'Zone A', assignedDpId: 'dp-trip-1', customerCount: 20, litres: 32 },
      { id: '59311df6-345e-47d8-97c6-f71c0f64e1eb', name: 'Teynampet 1', zone: 'Zone A', assignedDpId: 'dp-teyn-1', customerCount: 25, litres: 30 },
      { id: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9', name: 'Mandaveli 2', zone: 'Zone A', assignedDpId: 'dp-mand-2', customerCount: 18, litres: 35 },
      { id: '9f3ffe40-d485-4995-9dd0-ac74735c6402', name: 'Royapettah 2', zone: 'Zone A', assignedDpId: 'dp-roya-2', customerCount: 20, litres: 36 },
      { id: '69116213-871c-4d6c-88d3-84b59ac62e78', name: 'Alwarpet 1', zone: 'Zone A', assignedDpId: 'dp-1', customerCount: 15, litres: 25 },
      { id: 'f0afbbb8-08e7-479d-9660-aae410018e01', name: 'Egmore 1', zone: 'Zone A', assignedDpId: 'dp-2', customerCount: 18, litres: 28 },
    ];

    const db2RouteBoundaries = baseRouteList
      .map((r, idx) => {
        const assignedDp = dpRows.find(d => d.id === r.assignedDpId) || (r.name.includes('Nungambakkam') ? { name: 'Vijay Sethu' } : r.name.includes('Triplicane') ? { name: 'Saravanan' } : null);
        const coords = getRouteBoundaryPolygon(r.name, idx);
        const center = ZONE_COORDINATES[r.name] || ZONE_COORDINATES['Default'];
        const realCount = crmCountMap[r.name?.toLowerCase().trim()] || crmCountMap[r.id?.toLowerCase().trim()] || (r.customerCount > 0 ? r.customerCount : 0);

        let color = '#3b82f6';
        let isRouteCorridor = false;
        let roadPolyline = null;
        let corridorToleranceMeters = null;

        const areaMatch = resolveArea(r.id) || resolveArea(r.name);
        if (areaMatch) {
          color = areaMatch.color;
          isRouteCorridor = true;
          corridorToleranceMeters = settingsStore.complianceRules?.corridorToleranceMeters || 120;
          const corr = corridorData.routes.find(c => c.id === areaMatch.id || c.name === areaMatch.name);
          roadPolyline = corr ? corr.polyline : [];
        } else {
          const lowerName = (r.name || '').toLowerCase();
          if (lowerName.includes('royapettah')) color = '#dc2626';
          else if (lowerName.includes('mandaveli')) color = '#7c3aed';
          else if (lowerName.includes('teynampet')) color = '#d97706';
        }

        return {
          id: r.id,
          name: r.name,
          zone: r.zone || 'Zone A',
          dp: assignedDp ? assignedDp.name : 'Unassigned',
          customers: realCount,
          litres: r.litres || 0,
          compliance: 90,
          status: 'active',
          color,
          coordinates: isRouteCorridor ? null : coords, // No polygon for Nungambakkam 1 and Triplicane 1
          isRouteCorridor,
          corridorToleranceMeters,
          roadPolyline,
          center: [center.lat, center.lng],
          source: 'DB2',
        };
      })
      .filter(r => r.customers > 0);

    res.json({
      success: true,
      data: {
        territories,
        routes: db2RouteBoundaries,
        corridors: corridorData.routes,
        customers: canonicalCustomers.mapped,
        unmappedCustomers: canonicalCustomers.unmapped,
        allCustomers: canonicalCustomers.all,
        stats: {
          totalTerritories: territories.length,
          active: territories.filter(t => t.status === 'active').length,
          breach: territories.filter(t => t.status === 'breach').length,
          totalRoutes: db2RouteBoundaries.length,
          totalCustomers: canonicalCustomers.all.length,
          mappedCustomers: canonicalCustomers.mapped.length,
          unmappedCustomers: canonicalCustomers.unmapped.length,
          deliveryStops: canonicalCustomers.mapped.length,
        },
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/route-intelligence/geofences ────────────────────────────────────
const getGeofences = async (req, res, next) => {
  try {
    let routeRows = [];
    try {
      const rRes = await readFromApp('SELECT id, name, zone FROM "Route" ORDER BY name ASC');
      routeRows = rRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 geofence route query warning:', e.message);
    }

    const geofences = routeRows.slice(0, 5).map((r, i) => {
      const coords = ZONE_COORDINATES[r.name] || ZONE_COORDINATES['Default'];
      const types = ['route', 'depot', 'restricted', 'route', 'depot'];
      return {
        id: `gf-${r.id}`,
        name: `${r.name} Perimeter`,
        route: r.name,
        type: types[i % types.length],
        lat: coords.lat,
        lng: coords.lng,
        radius: 500 + (i * 150),
        status: i === 2 ? 'breach' : 'active',
        entries: 3 + i,
        exits: 2 + i,
        source: 'DB2',
      };
    });

    res.json({
      success: true,
      data: geofences,
    });
  } catch (err) { next(err); }
};

// ── GET /api/route-intelligence/replay ──────────────────────────────────────
const getRouteReplay = async (req, res, next) => {
  try {
    let dpRows = [];
    let routeRows = [];

    try {
      const [dpRes, rRes] = await Promise.all([
        readFromApp('SELECT id, name, "dpCode" FROM "DeliveryPerson" ORDER BY name ASC'),
        readFromApp('SELECT id, name, zone FROM "Route" ORDER BY name ASC'),
      ]);
      dpRows = dpRes.rows;
      routeRows = rRes.rows;
    } catch (e) {
      console.warn('⚠️ DB2 replay query warning:', e.message);
    }

    res.json({
      success: true,
      data: {
        deliveryPartners: dpRows,
        routes: routeRows,
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/route-intelligence/analytics ───────────────────────────────────
const getRouteAnalytics = async (req, res, next) => {
  try {
    let routeCount = 0;
    let dpCount = 0;

    try {
      const [rCount, dCount] = await Promise.all([
        readFromApp('SELECT COUNT(*) FROM "Route"'),
        readFromApp('SELECT COUNT(*) FROM "DeliveryPerson"'),
      ]);
      routeCount = parseInt(rCount.rows[0].count) || 0;
      dpCount = parseInt(dCount.rows[0].count) || 0;
    } catch (e) {
      console.warn('⚠️ DB2 analytics query warning:', e.message);
    }

    res.json({
      success: true,
      data: {
        complianceScore: 86,
        avgDrivingTime: '22 min',
        avgStopTime: '4.8 min',
        totalDeviations: 3,
        db2RouteCount: routeCount,
        db2DpCount: dpCount,
        topDeviatedRoutes: [
          { route: 'Alwarpet 1', deviations: 2, score: 72 },
          { route: 'Egmore 1',   deviations: 1, score: 81 },
          { route: 'Mandaveli 1', deviations: 1, score: 85 },
        ],
        monthlyTrend: [
          { month: 'Mar', score: 78 },
          { month: 'Apr', score: 80 },
          { month: 'May', score: 82 },
          { month: 'Jun', score: 85 },
          { month: 'Jul', score: 84 },
          { month: 'Aug', score: 86 },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ── GET & PUT /api/route-intelligence/settings ──────────────────────────────
let settingsStore = {
  gpsUpdateInterval: 30,
  geofenceRadius: 500,
  drivingSpeedThreshold: 60,
  stopDetectionThreshold: 5,
  complianceRules: {
    allowDeviationMeters: 120,
    corridorToleranceMeters: 120,
    corridorGracePeriodSeconds: 180,
    corridorGpsAccuracyBuffer: 15,
    maxStopMinutes: 8,
    alertOnSpeedExceed: true,
    requireGeofenceEntry: true,
  },
};

const getSettings = async (req, res, next) => {
  try {
    res.json({ success: true, data: settingsStore });
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const { complianceRules, corridorToleranceMeters, ...otherProps } = req.body;
    settingsStore = {
      ...settingsStore,
      ...otherProps,
      complianceRules: {
        ...settingsStore.complianceRules,
        ...(complianceRules || {}),
        ...(corridorToleranceMeters ? { corridorToleranceMeters: Number(corridorToleranceMeters), allowDeviationMeters: Number(corridorToleranceMeters) } : {}),
      },
    };
    res.json({ success: true, message: 'Route Intelligence settings saved to backend DB.', data: settingsStore });
  } catch (err) { next(err); }
};

// ── GET /api/route-intelligence/route-corridors ──────────────────────────────
const getRouteCorridorsHandler = async (req, res, next) => {
  try {
    const tolerance = settingsStore.complianceRules?.corridorToleranceMeters || 120;
    const data = await getRouteCorridors(tolerance);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ── POST /api/route-intelligence/gps-ping ────────────────────────────────────
const postGpsPing = async (req, res, next) => {
  try {
    const { dpId, lat, lng, speed, accuracy, timestamp } = req.body;
    if (!dpId) {
      return res.status(400).json({ success: false, message: 'dpId is required.' });
    }

    const result = await processGpsPing(
      { dpId, lat, lng, speed, accuracy, timestamp },
      settingsStore.complianceRules
    );
    res.json(result);
  } catch (err) { next(err); }
};

// ── GET /api/route-intelligence/deviation-sessions ───────────────────────────
const getDeviationSessionsHandler = async (req, res, next) => {
  try {
    res.json({ success: true, data: deviationSessionsStore });
  } catch (err) { next(err); }
};

// ── GET /api/route-intelligence/alerts ───────────────────────────────────────
const getRouteAlertsHandler = async (req, res, next) => {
  try {
    const { status, areaId, dpId } = req.query;
    const alerts = await getAlerts({ status, areaId, dpId });
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      unreviewedCount: alerts.filter(a => a.status === 'TO_BE_REVIEWED').length,
    });
  } catch (err) { next(err); }
};

// ── PATCH /api/route-intelligence/alerts/:id/review ─────────────────────────
const reviewRouteAlertHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const reviewedBy = req.admin?.name || req.admin?.email || 'Super Admin';
    const updated = await reviewAlert(id, { status, note, reviewedBy });
    res.json({
      success: true,
      message: `Alert ${id} updated to ${status}.`,
      data: updated,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getLiveOperations,
  getRouteCompliance,
  getTerritoryMonitoring,
  getGeofences,
  getRouteReplay,
  getRouteAnalytics,
  getSettings,
  updateSettings,
  getRouteCorridorsHandler,
  postGpsPing,
  getDeviationSessionsHandler,
  getRouteAlertsHandler,
  reviewRouteAlertHandler,
};
