// ============================================================
// ROUTE INTELLIGENCE MODULE — MOCK DATA
// Replace with real API calls when backend is ready
// ============================================================

export const MOCK_DELIVERY_PARTNERS = [
  { id: 'dp-001', name: 'Rajan Kumar',    route: 'Route A — North Zone', status: 'active',  lat: 13.082, lng: 80.270, speed: 38, lastUpdate: '2 min ago',  deliveries: 12, total: 18 },
  { id: 'dp-002', name: 'Suresh Babu',   route: 'Route B — South Zone', status: 'active',  lat: 13.071, lng: 80.254, speed: 0,  lastUpdate: '1 min ago',  deliveries: 7,  total: 14 },
  { id: 'dp-003', name: 'Muthu Raj',     route: 'Route C — East Zone',  status: 'deviated',lat: 13.088, lng: 80.282, speed: 22, lastUpdate: '5 min ago',  deliveries: 9,  total: 16 },
  { id: 'dp-004', name: 'Arjun Vel',     route: 'Route D — West Zone',  status: 'active',  lat: 13.065, lng: 80.243, speed: 45, lastUpdate: '30 sec ago', deliveries: 14, total: 15 },
  { id: 'dp-005', name: 'Prakash Nair',  route: 'Route E — Central',    status: 'stopped', lat: 13.078, lng: 80.261, speed: 0,  lastUpdate: '8 min ago',  deliveries: 5,  total: 20 },
  { id: 'dp-006', name: 'Vikram Selvan', route: 'Route F — Harbor',     status: 'active',  lat: 13.095, lng: 80.295, speed: 31, lastUpdate: '1 min ago',  deliveries: 11, total: 13 },
];

export const MOCK_ROUTES = [
  { id: 'r-001', name: 'Route A — North Zone', dp: 'Rajan Kumar',    customers: 0, status: 'active',   compliance: 94, color: '#3b82f6', area: 'Kolathur, Perambur'  },
  { id: 'r-002', name: 'Route B — South Zone', dp: 'Suresh Babu',   customers: 0, status: 'active',   compliance: 88, color: '#10b981', area: 'Adyar, Besant Nagar'  },
  { id: 'r-003', name: 'Route C — East Zone',  dp: 'Muthu Raj',     customers: 0, status: 'deviated', compliance: 67, color: '#ef4444', area: 'Sholinganallur, OMR'   },
  { id: 'r-004', name: 'Route D — West Zone',  dp: 'Arjun Vel',     customers: 0, status: 'active',   compliance: 97, color: '#8b5cf6', area: 'Anna Nagar, Mogappair' },
  { id: 'r-005', name: 'Route E — Central',    dp: 'Prakash Nair',  customers: 0, status: 'stopped',  compliance: 55, color: '#f59e0b', area: 'T Nagar, Nungambakkam' },
  { id: 'r-006', name: 'Route F — Harbor',     dp: 'Vikram Selvan', customers: 0, status: 'active',   compliance: 91, color: '#06b6d4', area: 'Mylapore, R A Puram'   },
];

export const MOCK_GEOFENCES = [
  { id: 'gf-001', name: 'North Zone Boundary',   type: 'route',     radius: 800,  status: 'active',  entries: 3,  exits: 2  },
  { id: 'gf-002', name: 'South Zone Boundary',   type: 'route',     radius: 650,  status: 'active',  entries: 1,  exits: 1  },
  { id: 'gf-003', name: 'Depot — Anna Nagar',    type: 'depot',     radius: 200,  status: 'active',  entries: 6,  exits: 5  },
  { id: 'gf-004', name: 'Restricted Area — OMR', type: 'restricted',radius: 500,  status: 'breach',  entries: 2,  exits: 2  },
  { id: 'gf-005', name: 'East Zone Boundary',    type: 'route',     radius: 700,  status: 'active',  entries: 4,  exits: 3  },
];

export const MOCK_LIVE_EVENTS = [
  { id: 'ev-001', time: '06:42 AM', dp: 'Muthu Raj',     event: 'Route deviation detected',   severity: 'danger',  route: 'Route C' },
  { id: 'ev-002', time: '06:38 AM', dp: 'Suresh Babu',   event: 'Extended stop (8 min)',       severity: 'warning', route: 'Route B' },
  { id: 'ev-003', time: '06:35 AM', dp: 'Arjun Vel',     event: 'Geofence entry — Depot',      severity: 'info',    route: 'Route D' },
  { id: 'ev-004', time: '06:31 AM', dp: 'Rajan Kumar',   event: 'Delivery confirmed — #C118',  severity: 'success', route: 'Route A' },
  { id: 'ev-005', time: '06:28 AM', dp: 'Prakash Nair',  event: 'Speed limit exceeded (72 kph)',severity: 'danger',  route: 'Route E' },
  { id: 'ev-006', time: '06:25 AM', dp: 'Vikram Selvan', event: 'Route started — 13 stops',    severity: 'info',    route: 'Route F' },
  { id: 'ev-007', time: '06:20 AM', dp: 'Rajan Kumar',   event: 'Route started — 18 stops',    severity: 'info',    route: 'Route A' },
];

export const MOCK_COMPLIANCE_ROWS = [
  { id: 'c-001', dp: 'Rajan Kumar',   assignedRoute: 'Route A — North', enteredRoute: 'Route A — North', entryTime: '06:20 AM', exitTime: '—',       drivingTime: '22 min', stoppedTime: '4 min',  distanceKm: '9.2 km',  status: 'compliant' },
  { id: 'c-002', dp: 'Suresh Babu',  assignedRoute: 'Route B — South', enteredRoute: 'Route B — South', entryTime: '06:18 AM', exitTime: '—',       drivingTime: '19 min', stoppedTime: '9 min',  distanceKm: '7.8 km',  status: 'warning'   },
  { id: 'c-003', dp: 'Muthu Raj',    assignedRoute: 'Route C — East',  enteredRoute: 'Route D — West',  entryTime: '06:25 AM', exitTime: '—',       drivingTime: '17 min', stoppedTime: '2 min',  distanceKm: '6.1 km',  status: 'deviated'  },
  { id: 'c-004', dp: 'Arjun Vel',    assignedRoute: 'Route D — West',  enteredRoute: 'Route D — West',  entryTime: '06:15 AM', exitTime: '—',       drivingTime: '26 min', stoppedTime: '1 min',  distanceKm: '11.4 km', status: 'compliant' },
  { id: 'c-005', dp: 'Prakash Nair', assignedRoute: 'Route E — Central',enteredRoute: 'Route E — Central',entryTime: '06:10 AM',exitTime: '06:38 AM',drivingTime: '18 min', stoppedTime: '10 min', distanceKm: '5.3 km',  status: 'review'    },
  { id: 'c-006', dp: 'Vikram Selvan',assignedRoute: 'Route F — Harbor', enteredRoute: 'Route F — Harbor', entryTime: '06:22 AM', exitTime: '—',       drivingTime: '21 min', stoppedTime: '3 min',  distanceKm: '8.7 km',  status: 'compliant' },
];

export const MOCK_REPLAY_EVENTS = [
  { time: '06:20:00', event: 'Route Started',            type: 'start'   },
  { time: '06:24:15', event: 'Stop #1 — Delivery Point', type: 'delivery'},
  { time: '06:26:50', event: 'Geofence Entry — Zone A',  type: 'geo'     },
  { time: '06:30:10', event: 'Stop #2 — Delivery Point', type: 'delivery'},
  { time: '06:33:00', event: 'Extended Stop (6 min)',     type: 'alert'   },
  { time: '06:39:20', event: 'Stop #3 — Delivery Point', type: 'delivery'},
  { time: '06:41:05', event: 'Speed Alert (68 kph)',      type: 'alert'   },
  { time: '06:44:30', event: 'Stop #4 — Delivery Point', type: 'delivery'},
  { time: '06:48:00', event: 'Route Deviation Detected',  type: 'alert'   },
  { time: '06:52:15', event: 'Returned to Route',         type: 'info'    },
  { time: '06:57:00', event: 'Stop #5 — Delivery Point', type: 'delivery'},
  { time: '07:02:40', event: 'Route Completed',           type: 'end'     },
];

export const MOCK_ANALYTICS = {
  complianceScore: 78,
  avgDrivingTime: '24 min',
  avgStopTime: '5.2 min',
  totalDeviations: 7,
  topDeviatedRoutes: [
    { route: 'Route C — East Zone',  deviations: 3, score: 67 },
    { route: 'Route E — Central',    deviations: 2, score: 55 },
    { route: 'Route B — South Zone', deviations: 1, score: 88 },
  ],
  monthlyTrend: [
    { month: 'Feb', score: 71 },
    { month: 'Mar', score: 74 },
    { month: 'Apr', score: 69 },
    { month: 'May', score: 82 },
    { month: 'Jun', score: 79 },
    { month: 'Jul', score: 78 },
  ],
};

export const MOCK_TERRITORIES = [
  { id: 't-001', name: 'North Zone',   routes: 2, dps: 2, customers: 0, status: 'active',   area: 'Kolathur, Perambur, Tondiarpet'  },
  { id: 't-002', name: 'South Zone',   routes: 1, dps: 1, customers: 0, status: 'active',   area: 'Adyar, Besant Nagar, Thiruvanmiyur' },
  { id: 't-003', name: 'East Zone',    routes: 1, dps: 1, customers: 0, status: 'breach',   area: 'Sholinganallur, OMR, Perungudi'   },
  { id: 't-004', name: 'West Zone',    routes: 1, dps: 1, customers: 0, status: 'active',   area: 'Anna Nagar, Mogappair, Ambattur'  },
  { id: 't-005', name: 'Central Zone', routes: 1, dps: 1, customers: 0, status: 'inactive', area: 'T Nagar, Nungambakkam, Egmore'    },
  { id: 't-006', name: 'Harbor Zone',  routes: 1, dps: 1, customers: 0, status: 'active',   area: 'Mylapore, R A Puram, Mandaveli'   },
];

export const MOCK_SETTINGS = {
  gpsUpdateInterval: 30,
  geofenceRadius: 500,
  drivingSpeedThreshold: 60,
  stopDetectionThreshold: 5,
  complianceRules: {
    allowDeviationMeters: 300,
    maxStopMinutes: 8,
    alertOnSpeedExceed: true,
    requireGeofenceEntry: true,
  },
};
