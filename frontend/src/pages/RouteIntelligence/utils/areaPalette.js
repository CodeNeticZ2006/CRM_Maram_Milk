// ==============================================================================
// ROUTE INTELLIGENCE — COLORBLIND-FRIENDLY AREA PALETTE & CONFIG
// Synchronized with backend areaConfig.js
// ==============================================================================

export const DEPOT_COORDINATES = {
  lat: 13.0604,
  lng: 80.2496,
  name: 'Maram Milk Central Dispatch HQ',
  address: 'No. 45, Greams Road, Thousand Lights, Chennai',
};

export const AREA_PALETTE = {
  '1b4a924f-1a3c-4658-9e23-a2a060917ac2': {
    id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2',
    name: 'Nungambakkam 1',
    code: 'NUNG-1',
    color: '#2563eb', // Royal Blue
    dpName: 'Vijay Sethu',
    initials: 'VS',
    dpCode: 'DP008',
  },
  '9835f558-456c-423f-985b-f21b981172d6': {
    id: '9835f558-456c-423f-985b-f21b981172d6',
    name: 'Triplicane 1',
    code: 'TRIP-1',
    color: '#059669', // Emerald Green
    dpName: 'Saravanan',
    initials: 'SR',
    dpCode: 'DP012',
  },
  '59311df6-345e-47d8-97c6-f71c0f64e1eb': {
    id: '59311df6-345e-47d8-97c6-f71c0f64e1eb',
    name: 'Teynampet 1',
    code: 'TEYN-1',
    color: '#d97706', // Warm Amber
    dpName: 'Karthik Raja',
    initials: 'KR',
    dpCode: 'DP011',
  },
  '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9': {
    id: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9',
    name: 'Mandaveli 2',
    code: 'MAND-2',
    color: '#7c3aed', // Rich Purple
    dpName: 'Arjun Vel',
    initials: 'AV',
    dpCode: 'DP004',
  },
  '9f3ffe40-d485-4995-9dd0-ac74735c6402': {
    id: '9f3ffe40-d485-4995-9dd0-ac74735c6402',
    name: 'Royapettah 2',
    code: 'ROYA-2',
    color: '#dc2626', // Crimson Red
    dpName: 'Rajan Kumar',
    initials: 'RK',
    dpCode: 'DP001',
  },
};

export function getAreaByRouteName(routeNameOrId) {
  if (!routeNameOrId) return null;
  const str = String(routeNameOrId).trim();
  if (AREA_PALETTE[str]) return AREA_PALETTE[str];

  const lower = str.toLowerCase();
  for (const key of Object.keys(AREA_PALETTE)) {
    const area = AREA_PALETTE[key];
    if (area.name.toLowerCase() === lower || lower.includes(area.name.toLowerCase().split(' ')[0])) {
      return area;
    }
  }
  return null;
}

export function getAreaColor(routeNameOrId, defaultColor = '#3b82f6') {
  const area = getAreaByRouteName(routeNameOrId);
  return area ? area.color : defaultColor;
}
