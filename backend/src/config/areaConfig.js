// ==============================================================================
// ROUTE INTELLIGENCE — CANONICAL 5-AREA CONFIGURATION & COLOR PALETTE
// Colorblind-friendly, standardized across lines, customer pins, and DP markers
// ==============================================================================

const DEPOT_COORDINATES = {
  id: 'depot-hq',
  name: 'Maram Milk Central Dispatch HQ',
  address: 'No. 45, Greams Road, Thousand Lights, Chennai',
  lat: 13.0604,
  lng: 80.2496,
};

// 5 Target Areas with canonical Route IDs and Visually Distinct Colors
const AREA_CONFIG = {
  '1b4a924f-1a3c-4658-9e23-a2a060917ac2': {
    id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2',
    name: 'Nungambakkam 1',
    code: 'NUNG-1',
    color: '#2563eb', // Royal Blue
    assignedDpId: 'dp-nung-1',
    assignedDpName: 'Vijay Sethu',
    assignedDpCode: 'DP008',
  },
  '9835f558-456c-423f-985b-f21b981172d6': {
    id: '9835f558-456c-423f-985b-f21b981172d6',
    name: 'Triplicane 1',
    code: 'TRIP-1',
    color: '#059669', // Emerald Green
    assignedDpId: 'dp-trip-1',
    assignedDpName: 'Saravanan',
    assignedDpCode: 'DP012',
  },
  '59311df6-345e-47d8-97c6-f71c0f64e1eb': {
    id: '59311df6-345e-47d8-97c6-f71c0f64e1eb',
    name: 'Teynampet 1',
    code: 'TEYN-1',
    color: '#d97706', // Warm Amber / Ochre
    assignedDpId: 'dp-teyn-1',
    assignedDpName: 'Karthik Raja',
    assignedDpCode: 'DP011',
  },
  '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9': {
    id: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9',
    name: 'Mandaveli 2',
    code: 'MAND-2',
    color: '#7c3aed', // Rich Purple / Violet
    assignedDpId: 'dp-mand-2',
    assignedDpName: 'Arjun Vel',
    assignedDpCode: 'DP004',
  },
  '9f3ffe40-d485-4995-9dd0-ac74735c6402': {
    id: '9f3ffe40-d485-4995-9dd0-ac74735c6402',
    name: 'Royapettah 2',
    code: 'ROYA-2',
    color: '#dc2626', // Crimson / Coral Red
    assignedDpId: 'dp-roya-2',
    assignedDpName: 'Rajan Kumar',
    assignedDpCode: 'DP001',
  },
};

// Quick helper to resolve area config by route ID or name
function resolveArea(idOrName) {
  if (!idOrName) return null;
  const str = String(idOrName).trim();
  if (AREA_CONFIG[str]) return AREA_CONFIG[str];

  const lower = str.toLowerCase();
  for (const key of Object.keys(AREA_CONFIG)) {
    const area = AREA_CONFIG[key];
    if (area.name.toLowerCase() === lower || lower.includes(area.name.toLowerCase().split(' ')[0])) {
      return area;
    }
  }
  return null;
}

const DEFAULT_CORRIDOR_CONFIG = {
  corridorToleranceMeters: 120,    // Buffer around road polyline
  gracePeriodSeconds: 180,         // Grace period before RED alert
  stopSpeedThresholdKmh: 3.0,      // Below 3 km/h counts as stopped
  stopDistanceChangeMeters: 25.0,  // Or unchanged position within 25m
  drivingAlertThresholdSeconds: 300, // 5 min driving off-route triggers alert
  stoppedAlertThresholdSeconds: 300, // 5 min stopped off-route triggers alert
  staleThresholdMinutes: 10,       // > 10 min without ping = "signal lost"
  maxGpsAccuracyMeters: 50,        // Ignore noisy pings > 50m accuracy error
  hysteresisCount: 2,              // Require 2 consecutive pings to switch state
};

module.exports = {
  DEPOT_COORDINATES,
  AREA_CONFIG,
  resolveArea,
  DEFAULT_CORRIDOR_CONFIG,
};
