// ============================================================
// ROUTE INTELLIGENCE — GIS & LEAFLET MOCK DATASET
// Chennai, Tamil Nadu coordinates for Maram Milk Operations
// ============================================================

export const HEAD_OFFICE = {
  id: 'ho-001',
  name: 'Maram Milk Central Processing & Dispatch HQ',
  type: 'Head Office',
  address: 'No. 45, Greams Road, Thousand Lights, Chennai',
  lat: 13.0604,
  lng: 80.2496,
  phone: '+91 44 2829 0000',
  status: 'Operational',
};

export const MOCK_GIS_CUSTOMERS = [
  { id: 'cust-101', name: 'Ravi Shankar',     type: 'Customer', route: 'Route A — North Zone', lat: 13.0950, lng: 80.2650, address: 'Perambur, Chennai',      wallet: '₹1,240', status: 'Active' },
  { id: 'cust-102', name: 'Meena Devi',      type: 'Customer', route: 'Route A — North Zone', lat: 13.0900, lng: 80.2780, address: 'Kolathur, Chennai',      wallet: '₹850',   status: 'Active' },
  { id: 'cust-103', name: 'Ramesh Kumar',    type: 'Customer', route: 'Route B — South Zone', lat: 13.0012, lng: 80.2565, address: 'Adyar, Chennai',         wallet: '₹2,100', status: 'Active' },
  { id: 'cust-104', name: 'Lakshmi Priya',   type: 'Customer', route: 'Route B — South Zone', lat: 13.0060, lng: 80.2680, address: 'Besant Nagar, Chennai',  wallet: '₹420',   status: 'Active' },
  { id: 'cust-105', name: 'Suresh Nair',     type: 'Customer', route: 'Route C — East Zone',  lat: 12.9010, lng: 80.2270, address: 'Sholinganallur, OMR',   wallet: '₹1,680', status: 'Active' },
  { id: 'cust-106', name: 'Kavitha Rajan',   type: 'Customer', route: 'Route D — West Zone',  lat: 13.0850, lng: 80.2100, address: 'Anna Nagar, Chennai',    wallet: '₹3,400', status: 'Active' },
  { id: 'cust-107', name: 'Anand Venkatesh', type: 'Customer', route: 'Route E — Central',    lat: 13.0418, lng: 80.2341, address: 'T Nagar, Chennai',       wallet: '₹990',   status: 'Active' },
  { id: 'cust-108', name: 'Priya Dharshini', type: 'Customer', route: 'Route F — Harbor',     lat: 13.0339, lng: 80.2683, address: 'Mylapore, Chennai',      wallet: '₹1,450', status: 'Active' },
];

export const MOCK_GIS_PARTNERS = [
  { id: 'dp-001', name: 'Rajan Kumar',    type: 'Delivery Partner', route: 'Route A — North Zone', lat: 13.0920, lng: 80.2700, speed: '38 km/h', status: 'active',   deliveries: '12 / 18' },
  { id: 'dp-002', name: 'Suresh Babu',   type: 'Delivery Partner', route: 'Route B — South Zone', lat: 13.0035, lng: 80.2620, speed: '0 km/h',  status: 'active',   deliveries: '7 / 14'  },
  { id: 'dp-003', name: 'Muthu Raj',     type: 'Delivery Partner', route: 'Route C — East Zone',  lat: 12.9050, lng: 80.2300, speed: '22 km/h', status: 'deviated', deliveries: '9 / 16'  },
  { id: 'dp-004', name: 'Arjun Vel',     type: 'Delivery Partner', route: 'Route D — West Zone',  lat: 13.0820, lng: 80.2150, speed: '45 km/h', status: 'active',   deliveries: '14 / 15' },
  { id: 'dp-005', name: 'Prakash Nair',  type: 'Delivery Partner', route: 'Route E — Central',    lat: 13.0400, lng: 80.2380, speed: '0 km/h',  status: 'stopped',  deliveries: '5 / 20'  },
  { id: 'dp-006', name: 'Vikram Selvan', type: 'Delivery Partner', route: 'Route F — Harbor',     lat: 13.0350, lng: 80.2700, speed: '31 km/h', status: 'active',   deliveries: '11 / 13' },
];

export const MOCK_GIS_POLYLINES = [
  {
    id: 'poly-a',
    routeName: 'Route A — North Zone',
    color: '#3b82f6',
    coordinates: [
      [13.0604, 80.2496], // HQ
      [13.0750, 80.2580],
      [13.0900, 80.2780], // Cust 2
      [13.0950, 80.2650], // Cust 1
      [13.0920, 80.2700], // DP 1
    ]
  },
  {
    id: 'poly-b',
    routeName: 'Route B — South Zone',
    color: '#10b981',
    coordinates: [
      [13.0604, 80.2496], // HQ
      [13.0300, 80.2500],
      [13.0012, 80.2565], // Cust 3
      [13.0060, 80.2680], // Cust 4
      [13.0035, 80.2620], // DP 2
    ]
  },
  {
    id: 'poly-c',
    routeName: 'Route C — East Zone',
    color: '#ef4444',
    coordinates: [
      [13.0604, 80.2496], // HQ
      [12.9800, 80.2400],
      [12.9010, 80.2270], // Cust 5
      [12.9050, 80.2300], // DP 3
    ]
  },
  {
    id: 'poly-d',
    routeName: 'Route D — West Zone',
    color: '#8b5cf6',
    coordinates: [
      [13.0604, 80.2496], // HQ
      [13.0700, 80.2300],
      [13.0850, 80.2100], // Cust 6
      [13.0820, 80.2150], // DP 4
    ]
  }
];

export const MOCK_GIS_TERRITORIES = [
  {
    id: 'terr-north',
    name: 'North Zone Territory',
    route: 'Route A — North Zone',
    color: '#3b82f6',
    status: 'Active',
    dp: 'Rajan Kumar',
    customersCount: 32,
    coordinates: [
      [13.0750, 80.2450],
      [13.1150, 80.2450],
      [13.1150, 80.2950],
      [13.0750, 80.2950],
    ]
  },
  {
    id: 'terr-south',
    name: 'South Zone Territory',
    route: 'Route B — South Zone',
    color: '#10b981',
    status: 'Active',
    dp: 'Suresh Babu',
    customersCount: 14,
    coordinates: [
      [12.9800, 80.2350],
      [13.0250, 80.2350],
      [13.0250, 80.2850],
      [12.9800, 80.2850],
    ]
  },
  {
    id: 'terr-east',
    name: 'East Zone Territory',
    route: 'Route C — East Zone',
    color: '#ef4444',
    status: 'Breach',
    dp: 'Muthu Raj',
    customersCount: 16,
    coordinates: [
      [12.8700, 80.2000],
      [12.9500, 80.2000],
      [12.9500, 80.2600],
      [12.8700, 80.2600],
    ]
  },
  {
    id: 'terr-west',
    name: 'West Zone Territory',
    route: 'Route D — West Zone',
    color: '#8b5cf6',
    status: 'Active',
    dp: 'Arjun Vel',
    customersCount: 15,
    coordinates: [
      [13.0600, 80.1800],
      [13.1100, 80.1800],
      [13.1100, 80.2350],
      [13.0600, 80.2350],
    ]
  },
];

export const MOCK_GIS_GEOFENCES = [
  {
    id: 'gf-circle-01',
    name: 'North Zone Boundary Geofence',
    type: 'Circle',
    center: [13.0920, 80.2700],
    radius: 900,
    color: '#3b82f6',
    status: 'Active',
    entries: 3,
    exits: 2,
  },
  {
    id: 'gf-circle-02',
    name: 'Anna Nagar Depot Perimeter',
    type: 'Circle',
    center: [13.0850, 80.2100],
    radius: 500,
    color: '#10b981',
    status: 'Active',
    entries: 6,
    exits: 5,
  },
  {
    id: 'gf-circle-03',
    name: 'OMR High-Risk Restricted Geofence',
    type: 'Circle',
    center: [12.9050, 80.2300],
    radius: 750,
    color: '#ef4444',
    status: 'Breach Alert',
    entries: 2,
    exits: 2,
  }
];

export const MOCK_REPLAY_GIS_DATA = {
  route: 'Route A — North Zone',
  dpName: 'Rajan Kumar',
  fullPath: [
    [13.0604, 80.2496],
    [13.0700, 80.2550],
    [13.0780, 80.2620],
    [13.0850, 80.2670],
    [13.0900, 80.2780],
    [13.0950, 80.2650],
    [13.0920, 80.2700],
  ],
  completedPath: [
    [13.0604, 80.2496],
    [13.0700, 80.2550],
    [13.0780, 80.2620],
    [13.0850, 80.2670],
    [13.0900, 80.2780],
  ],
  currentPos: [13.0900, 80.2780],
  completedStops: [
    { id: 'stop-1', name: 'Ravi Shankar', lat: 13.0780, lng: 80.2620, time: '06:24 AM', status: 'Delivered' },
    { id: 'stop-2', name: 'Meena Devi', lat: 13.0900, lng: 80.2780, time: '06:30 AM', status: 'Delivered' },
  ],
  remainingStops: [
    { id: 'stop-3', name: 'Kavitha Rajan', lat: 13.0950, lng: 80.2650, time: 'Pending', status: 'In Transit' },
    { id: 'stop-4', name: 'Anand Venkatesh', lat: 13.0920, lng: 80.2700, time: 'Pending', status: 'In Transit' },
  ]
};
