import { motion } from 'framer-motion';
import {
  MdMap, MdPeople, MdAddLocation, MdRefresh, MdLocationOn, MdPlace, MdWarning, MdFilterList,
  MdFullscreen, MdFullscreenExit, MdClose, MdSearch, MdViewSidebar
} from 'react-icons/md';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionHeader, TerritoryCard, StatusBadge, ComplianceProgressBar } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_TERRITORIES } from '../utils/mockData.js';
import { buildActiveCustomerRoutes } from '../utils/routeGeometry.js';
import {
  LeafletMapContainer, RoutePolygon, RoutePolyline, DeliveryPartnerMarker, CustomerMarker,
  HeadOfficeMarker, HEAD_OFFICE, MOCK_GIS_PARTNERS
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

// Default fallback Chennai bounding box generator for routes
const FALLBACK_ROUTE_BOUNDARIES = [
  { id: 'rb-1', name: 'Alwarpet 1',      color: '#3b82f6', coordinates: [[13.0300, 80.2440], [13.0380, 80.2440], [13.0380, 80.2540], [13.0300, 80.2540]], dp: 'Rajan Kumar', customers: 0, compliance: 94, status: 'active' },
  { id: 'rb-2', name: 'Egmore 1',        color: '#10b981', coordinates: [[13.0680, 80.2550], [13.0780, 80.2550], [13.0780, 80.2660], [13.0680, 80.2660]], dp: 'Suresh Babu', customers: 0, compliance: 88, status: 'active' },
  { id: 'rb-3', name: 'Mandaveli 1',   color: '#ef4444', coordinates: [[13.0230, 80.2560], [13.0310, 80.2560], [13.0310, 80.2640], [13.0230, 80.2640]], dp: 'Muthu Raj',   customers: 0, compliance: 67, status: 'breach' },
  { id: 'rb-4', name: 'Mandaveli 2',   color: '#8b5cf6', coordinates: [[13.0250, 80.2600], [13.0330, 80.2600], [13.0330, 80.2680], [13.0250, 80.2680]], dp: 'Arjun Vel',   customers: 0, compliance: 97, status: 'active' },
  { id: 'rb-5', name: 'MRC Ngr',       color: '#f59e0b', coordinates: [[13.0170, 80.2690], [13.0250, 80.2690], [13.0250, 80.2790], [13.0170, 80.2790]], dp: 'Prakash Nair',customers: 0, compliance: 55, status: 'stopped' },
  { id: 'rb-6', name: 'Mylapore 1',    color: '#06b6d4', coordinates: [[13.0280, 80.2630], [13.0370, 80.2630], [13.0370, 80.2720], [13.0280, 80.2720]], dp: 'Vikram Selvan',customers: 0, compliance: 91, status: 'active' },
  { id: 'rb-7', name: 'Mylapore 2',    color: '#ec4899', coordinates: [[13.0310, 80.2660], [13.0400, 80.2660], [13.0400, 80.2750], [13.0310, 80.2750]], dp: 'Karthik Raja',customers: 0, compliance: 89, status: 'active' },
  { id: 'rb-8', name: 'Nungambakkam 1',color: '#2563eb', coordinates: null, isRouteCorridor: true, corridorTolerance: 120, dp: 'Vijay Sethu', customers: 25, compliance: 96, status: 'active' },
  { id: 'rb-9', name: 'Royapettah 2',   color: '#f97316', coordinates: [[13.0450, 80.2540], [13.0550, 80.2540], [13.0550, 80.2650], [13.0450, 80.2540]], dp: 'Saravanan',   customers: 0, compliance: 82, status: 'active' },
  { id: 'rb-10', name: 'T-Nagar 1',     color: '#84cc16', coordinates: [[13.0360, 80.2280], [13.0460, 80.2280], [13.0460, 80.2390], [13.0360, 80.2390]], dp: 'Manikandan',  customers: 0, compliance: 98, status: 'active' },
  { id: 'rb-11', name: 'Teynampet 1',   color: '#6366f1', coordinates: [[13.0400, 80.2430], [13.0490, 80.2430], [13.0490, 80.2530], [13.0400, 80.2530]], dp: 'Karthik Raja',customers: 0, compliance: 92, status: 'active' },
  { id: 'rb-12', name: 'Triplicane 1',  color: '#10b981', coordinates: null, isRouteCorridor: true, corridorTolerance: 120, dp: 'Saravanan',   customers: 20, compliance: 94, status: 'active' },
  { id: 'rb-13', name: 'West Mambalam 1', color: '#0284c7', coordinates: [[13.0330, 80.2170], [13.0420, 80.2170], [13.0420, 80.2260], [13.0330, 80.2260]], dp: 'Ramesh Babu',  customers: 0, compliance: 96, status: 'active' },
  { id: 'rb-14', name: 'West Mambalam 2', color: '#0d9488', coordinates: [[13.0350, 80.2200], [13.0440, 80.2200], [13.0440, 80.2290], [13.0350, 80.2200]], dp: 'Saravana Kumar', customers: 0, compliance: 93, status: 'active' },
];


export default function TerritoryMonitoringPage() {
  const [territories, setTerritories] = useState(MOCK_TERRITORIES);
  const [routes, setRoutes]           = useState(FALLBACK_ROUTE_BOUNDARIES);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [mapCenter, setMapCenter]     = useState([HEAD_OFFICE.lat, HEAD_OFFICE.lng]);
  const [mapZoom, setMapZoom]         = useState(11);
  const [mapBounds, setMapBounds]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);

  // Dynamic Customer Data Integration (Reusing /api/customers)
  const [customers, setCustomers]               = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerError, setCustomerError]       = useState(null);
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('All');
  const [showUnmappedDrawer, setShowUnmappedDrawer] = useState(false);

  // Enlarged Map & Collapsible Customer Panel State
  const [isCustomerPanelOpen, setIsCustomerPanelOpen] = useState(true);
  const [isMapExpanded, setIsMapExpanded]             = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const fetchTerritories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/route-intelligence/territories');
      if (res.data?.success && res.data?.data) {
        const { territories: terrs, routes: rts } = res.data.data;
        if (terrs && terrs.length > 0) setTerritories(terrs);
        if (rts && rts.length > 0) {
          setRoutes(rts);
        }
        setIsDb2Loaded(true);
      }
    } catch (err) {
      console.warn('Failed to load DB2 Territories:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    setCustomerError(null);
    try {
      // Reuse existing Customer Management API endpoint
      const res = await api.get('/customers', { params: { limit: 500 } });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setCustomers(res.data.data);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.error('Error loading customer locations:', err.message);
      setCustomerError('Failed to load customer locations from CRM.');
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  // Route Corridor Data (Road-following polylines for Nungambakkam 1 and Triplicane 1)
  const [routeCorridors, setRouteCorridors] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);

  const fetchRouteCorridors = useCallback(async () => {
    try {
      const res = await api.get('/route-intelligence/route-corridors');
      if (res.data?.success && res.data?.data?.routes) {
        setRouteCorridors(res.data.data.routes);
      }
    } catch (err) {
      console.warn('Failed to load route corridors from API:', err.message);
    }
  }, []);

  const fetchLivePartners = useCallback(async () => {
    try {
      const res = await api.get('/route-intelligence/live-operations');
      if (res.data?.success && res.data?.data?.deliveryPartners) {
        setDeliveryPartners(res.data.data.deliveryPartners);
      }
    } catch (err) {
      console.warn('Failed to load live delivery partners:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchTerritories();
    fetchCustomers();
    fetchRouteCorridors();
    fetchLivePartners();
  }, [fetchTerritories, fetchCustomers, fetchRouteCorridors, fetchLivePartners]);

  // Extract valid mapped customers (numeric lat & lng) vs unmapped ("Location unavailable")
  const mappedCustomers = useMemo(() => {
    return customers.filter(c => {
      if (!c.lat || !c.lng) return false;
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }, [customers]);

  const unmappedCustomers = useMemo(() => {
    return customers.filter(c => {
      if (!c.lat || !c.lng) return true;
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      return isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0;
    });
  }, [customers]);

  // Generate active customer route polylines
  const activeCustomerRoutes = useMemo(() => {
    return buildActiveCustomerRoutes(customers, HEAD_OFFICE);
  }, [customers]);

  // Combined active routes with road-following geometry for Nungambakkam 1 (Blue) and Triplicane 1 (Green)
  const combinedRoutes = useMemo(() => {
    if (routeCorridors && routeCorridors.length > 0) {
      return routeCorridors.map(rc => {
        const dpName = typeof rc.assignedDp === 'object' ? rc.assignedDp?.name || 'Unassigned' : (rc.assignedDp || rc.dp || 'Unassigned');
        const coords = rc.polyline || rc.roadCoordinates || [];
        return {
          id: rc.id,
          name: rc.name,
          color: rc.color,
          isRouteCorridor: true,
          corridorToleranceMeters: rc.corridorToleranceMeters || 120,
          customerCount: rc.customerCount || (rc.customers ? rc.customers.length : 0),
          customers: rc.customers || [],
          polyline: coords,
          roadCoordinates: coords,
          dp: dpName,
          compliance: 95,
          status: 'active',
        };
      });
    }
    return activeCustomerRoutes;
  }, [routeCorridors, activeCustomerRoutes]);


  // Routes filtered by the selected route filter
  const routesToRender = useMemo(() => {
    if (selectedRouteFilter === 'All' || selectedRouteFilter === 'All two routes' || selectedRouteFilter === 'All Routes') {
      return combinedRoutes;
    }
    return combinedRoutes.filter(r => r.name.toLowerCase().trim() === selectedRouteFilter.toLowerCase().trim());
  }, [combinedRoutes, selectedRouteFilter]);

  // Delivery partners filtered by selected route filter
  const partnersToRender = useMemo(() => {
    const list = deliveryPartners.length > 0 ? deliveryPartners : [
      { id: 'dp-1', name: 'Vijay Sethu', route: 'Nungambakkam 1', dpCode: 'DP-001', status: 'GREEN', corridorStatus: 'GREEN', corridorDistanceMeters: 0, lat: 13.0595, lng: 80.2422, speed: 24, lastUpdate: 'Just now' },
      { id: 'dp-2', name: 'Saravanan',   route: 'Triplicane 1',   dpCode: 'DP-002', status: 'GREEN', corridorStatus: 'GREEN', corridorDistanceMeters: 0, lat: 13.0578, lng: 80.2745, speed: 20, lastUpdate: '1 min ago' },
    ];
    if (selectedRouteFilter === 'All' || selectedRouteFilter === 'All two routes' || selectedRouteFilter === 'All Routes') {
      return list;
    }
    return list.filter(dp => (dp.route || '').toLowerCase().trim() === selectedRouteFilter.toLowerCase().trim());
  }, [deliveryPartners, selectedRouteFilter]);

  // Map Legend items identifying both route corridors and DP statuses
  const mapLegendItems = [
    { label: 'Nungambakkam 1 (Blue Corridor ±120m)', color: '#2563eb' },
    { label: 'Triplicane 1 (Green Corridor ±120m)', color: '#10b981' },
    { label: 'Vijay Sethu (DP - Nungambakkam 1)', color: '#2563eb', shape: 'circle' },
    { label: 'Saravanan (DP - Triplicane 1)', color: '#10b981', shape: 'circle' },
    { label: 'Customer Stops', color: '#f59e0b' },
  ];

  // Routes filtered to ONLY routes with customers
  const activeRoutesList = useMemo(() => {
    return routes.filter(r => r.customers > 0);
  }, [routes]);

  // Filter mapped customers by route
  const filteredMappedCustomers = useMemo(() => {
    if (selectedRouteFilter === 'All' || selectedRouteFilter === 'All two routes' || selectedRouteFilter === 'All Routes') return mappedCustomers;
    return mappedCustomers.filter(c => {
      const rName = c.route_name || c.assigned_route_id || '';
      return rName.toLowerCase().trim() === selectedRouteFilter.toLowerCase().trim();
    });
  }, [mappedCustomers, selectedRouteFilter]);

  // Filter mapped customers by search query inside customer panel
  const searchedCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return filteredMappedCustomers;
    const q = customerSearchQuery.toLowerCase().trim();
    return filteredMappedCustomers.filter(c => {
      const name = (c.name || '').toLowerCase();
      const code = (c.customer_code || c.code || '').toLowerCase();
      const addr = (c.address || '').toLowerCase();
      const rName = (c.route_name || c.assigned_route_id || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      return name.includes(q) || code.includes(q) || addr.includes(q) || rName.includes(q) || phone.includes(q);
    });
  }, [filteredMappedCustomers, customerSearchQuery]);

  // Pan and zoom to customer location on map when clicked from panel
  const handleCustomerClick = useCallback((customer) => {
    if (!customer?.lat || !customer?.lng) return;
    const lat = parseFloat(customer.lat);
    const lng = parseFloat(customer.lng);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      setMapBounds(null);
      setMapCenter([lat, lng]);
      setMapZoom(16);
    }
  }, []);


  // Calculate dynamic Leaflet map bounds to fit mapped customer locations automatically
  useEffect(() => {
    const listToFit = filteredMappedCustomers.length > 0 ? filteredMappedCustomers : mappedCustomers;
    if (listToFit.length > 0) {
      const lats = listToFit.map(c => parseFloat(c.lat));
      const lngs = listToFit.map(c => parseFloat(c.lng));
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // Expand margin slightly for clear view
      const latMargin = (maxLat - minLat) * 0.1 || 0.01;
      const lngMargin = (maxLng - minLng) * 0.1 || 0.01;

      setMapBounds([
        [minLat - latMargin, minLng - lngMargin],
        [maxLat + latMargin, maxLng + lngMargin],
      ]);
    }
  }, [filteredMappedCustomers, mappedCustomers]);

  const handleSelectRoute = (route) => {
    setSelectedRouteId(route.id);
    setSelectedRouteFilter(route.name);
    setMapBounds(null);
    if (route.center) {
      setMapCenter(route.center);
      setMapZoom(13);
    } else if (route.coordinates && route.coordinates.length > 0) {
      setMapCenter(route.coordinates[0]);
      setMapZoom(13);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Territory Monitoring"
        subtitle={
          <span>
            Manage and monitor delivery zones, route boundaries, and real customer locations
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" onClick={() => { fetchTerritories(); fetchCustomers(); }} disabled={loading || loadingCustomers}>
          <MdRefresh className={(loading || loadingCustomers) ? 'spin' : ''} /> {(loading || loadingCustomers) ? 'Syncing...' : 'Refresh'}
        </button>
        <button className="btn btn-primary btn-sm" id="ri-add-territory-btn"><MdAddLocation /> Add Territory</button>
      </SectionHeader>

      {/* Territory & Customer Location KPIs */}
      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total CRM Customers',     value: customers.length, color: 'var(--primary)' },
          { label: 'Mapped on Map',          value: mappedCustomers.length, color: 'var(--success)' },
          { label: 'Location Unavailable',   value: unmappedCustomers.length, color: 'var(--warning)'  },
          { label: 'Configured Routes',      value: routes.length,       color: 'var(--info)'    },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--card-accent': s.color }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Route Filter Controls & Location Unavailable Bar */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <MdFilterList /> Route Filter:
            </span>
            <button
              className={`btn btn-xs ${selectedRouteFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedRouteFilter('All')}
            >
              All two routes ({mappedCustomers.length})
            </button>
            <button
              className={`btn btn-xs ${selectedRouteFilter === 'Nungambakkam 1' ? 'btn-primary' : 'btn-outline'}`}
              style={selectedRouteFilter === 'Nungambakkam 1' ? { background: '#2563eb', borderColor: '#2563eb', color: '#fff' } : { borderColor: '#2563eb', color: '#2563eb' }}
              onClick={() => setSelectedRouteFilter('Nungambakkam 1')}
            >
              Nungambakkam 1 ({mappedCustomers.filter(c => (c.route_name || '').toLowerCase().includes('nungambakkam')).length || 25})
            </button>
            <button
              className={`btn btn-xs ${selectedRouteFilter === 'Triplicane 1' ? 'btn-primary' : 'btn-outline'}`}
              style={selectedRouteFilter === 'Triplicane 1' ? { background: '#10b981', borderColor: '#10b981', color: '#fff' } : { borderColor: '#10b981', color: '#10b981' }}
              onClick={() => setSelectedRouteFilter('Triplicane 1')}
            >
              Triplicane 1 ({mappedCustomers.filter(c => (c.route_name || '').toLowerCase().includes('triplicane')).length || 20})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Expand / Collapse Map control */}
            <button
              className={`btn btn-xs ${isMapExpanded ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setIsMapExpanded(prev => !prev)}
              id="ri-expand-map-btn"
              title={isMapExpanded ? 'Collapse Map' : 'Expand Map to primary view'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              {isMapExpanded ? <MdFullscreenExit size={16} /> : <MdFullscreen size={16} />}
              {isMapExpanded ? 'Collapse Map' : 'Expand Map'}
            </button>

            {/* Customers Panel Toggle button */}
            <button
              className={`btn btn-xs ${isCustomerPanelOpen ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setIsCustomerPanelOpen(prev => !prev)}
              id="ri-toggle-customer-panel-btn"
              title={isCustomerPanelOpen ? 'Hide Customers Panel to maximize map' : 'Show Mapped Customers Panel'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              <MdPeople size={16} />
              {isCustomerPanelOpen ? 'Hide Panel' : `Customers (${filteredMappedCustomers.length})`}
            </button>

            {unmappedCustomers.length > 0 && (
              <button
                className="btn btn-warning btn-xs"
                onClick={() => setShowUnmappedDrawer(!showUnmappedDrawer)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <MdWarning /> Location unavailable ({unmappedCustomers.length})
              </button>
            )}
          </div>
        </div>

        {/* Location Unavailable Customer List */}
        {showUnmappedDrawer && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', background: 'rgba(245,158,11,0.05)', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#d97706', marginBottom: 8 }}>
              <MdWarning /> Customers without GPS Coordinates ("Location unavailable"):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {unmappedCustomers.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                  <strong>{c.name}</strong> ({c.customer_code || 'No Code'}) — <span style={{ color: 'var(--text-muted)' }}>{c.address || 'No Address'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map + Collapsible Customer Panel */}
      <div className={`ri-map-layout ${isCustomerPanelOpen ? 'panel-open' : 'panel-closed'} ${isMapExpanded ? 'map-expanded' : ''}`}>
        <div className="ri-map-container-col">
          {loadingCustomers && (
            <div className="ri-map-loading-badge">
              Loading customer locations...
            </div>
          )}

          {customerError && (
            <div className="ri-map-error-badge">
              {customerError}
            </div>
          )}

          <LeafletMapContainer
            height={isMapExpanded ? 780 : 680}
            center={mapCenter}
            zoom={mapZoom}
            bounds={mapBounds}
            legendItems={mapLegendItems}
            isExpanded={isMapExpanded}
            onToggleExpand={() => setIsMapExpanded(prev => !prev)}
            isPanelOpen={isCustomerPanelOpen}
            onTogglePanel={() => setIsCustomerPanelOpen(prev => !prev)}
          >
            {({ showCustomers, showTerritories, showPartners, showRoutes }) => (
              <>
                <HeadOfficeMarker office={HEAD_OFFICE} />

                {/* Road-following Route Polylines + Corridor Buffers (Nungambakkam 1 Blue, Triplicane 1 Green) */}
                {showRoutes && routesToRender.map(r => (
                  <RoutePolyline
                    key={r.id}
                    coordinates={r.roadCoordinates || r.polyline}
                    color={r.color}
                    routeName={`${r.name} (${r.customerCount} Customers)`}
                    isRouteCorridor={r.isRouteCorridor}
                    corridorTolerance={r.corridorToleranceMeters || 120}
                    customerCount={r.customerCount}
                    assignedDp={r.dp}
                  />
                ))}

                {/* Territory Boundaries (Overlay only for other routes; Nungambakkam 1 and Triplicane 1 use corridor geofencing) */}
                {showTerritories && routes.map(r => {
                  const isSelected = selectedRouteId === r.id;
                  // REPLACED POLYGON-BASED MONITORING: Never draw polygon for corridor routes
                  if (r.isRouteCorridor || r.name === 'Nungambakkam 1' || r.name === 'Triplicane 1' || !r.coordinates || r.coordinates.length < 3) {
                    return null;
                  }
                  return (
                    <RoutePolygon
                      key={r.id}
                      type="polygon"
                      coordinates={r.coordinates}
                      color={r.color || '#3b82f6'}
                      fillColor={r.color || '#3b82f6'}
                      fillOpacity={isSelected ? 0.35 : 0.15}
                      weight={isSelected ? 3.5 : 1.5}
                      title={`DB2 Route Area: ${r.name}`}
                      subtitle={`Zone: ${r.zone || 'Zone A'} | Assigned DP: ${r.dp} | Stops: ${r.customers || 0}`}
                      status={r.status || 'active'}
                    />
                  );
                })}

                {/* Real Customer Markers (Filtered to selected route or both routes) */}
                {showCustomers && filteredMappedCustomers.map(cust => (
                  <CustomerMarker key={cust.id} customer={cust} selectedRouteFilter={selectedRouteFilter} />
                ))}

                {/* Delivery Partners (Filtered by selected route with actual corridor compliance) */}
                {showPartners && partnersToRender.map(partner => (
                  <DeliveryPartnerMarker key={partner.id} partner={partner} />
                ))}
              </>
            )}
          </LeafletMapContainer>
        </div>

        {/* Collapsible Customer Panel / Drawer */}
        {isCustomerPanelOpen && (
          <div className="card ri-customer-panel">
            <div className="card-header ri-customer-panel-header">
              <div>
                <span className="card-title" style={{ fontSize: 13.5, fontWeight: 700 }}>Mapped Customers</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                  <span className="badge badge-blue" style={{ fontSize: 10.5 }}>{selectedRouteFilter}</span>
                  <span className="badge badge-outline" style={{ fontSize: 10.5 }}>
                    {searchedCustomers.length} of {filteredMappedCustomers.length} stops
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => setIsCustomerPanelOpen(false)}
                title="Collapse Customer Panel (Expand Map)"
                id="ri-close-customer-panel-btn"
                style={{ padding: '4px 6px', borderRadius: 6 }}
              >
                <MdClose size={18} />
              </button>
            </div>

            {/* Customer Search Field */}
            <div className="ri-customer-search-box">
              <MdSearch className="ri-search-icon" />
              <input
                type="text"
                placeholder="Search name, code, address..."
                value={customerSearchQuery}
                onChange={e => setCustomerSearchQuery(e.target.value)}
                className="ri-customer-search-input"
              />
              {customerSearchQuery && (
                <button
                  className="ri-search-clear-btn"
                  onClick={() => setCustomerSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="card-body ri-customer-panel-body">
              {searchedCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                  {customerSearchQuery ? 'No customers matching search query.' : 'No customer locations available for this filter.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {searchedCustomers.map(c => {
                    const isNungambakkam = (c.route_name || '').toLowerCase().includes('nungambakkam');
                    const isTriplicane = (c.route_name || '').toLowerCase().includes('triplicane');
                    const routeColor = isNungambakkam ? '#2563eb' : (isTriplicane ? '#10b981' : '#64748b');

                    return (
                      <div
                        key={c.id}
                        className="ri-customer-card"
                        onClick={() => handleCustomerClick(c)}
                        title="Click to focus on map"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>{c.name}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 10.5, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '2px 5px', borderRadius: 4 }}>
                            {c.customer_code || 'CUST'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                          <MdPlace style={{ color: routeColor, flexShrink: 0, marginTop: 2 }} />
                          <span style={{ lineHeight: 1.3 }}>{c.address}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: routeColor, display: 'inline-block' }} />
                            <strong style={{ color: routeColor }}>{c.route_name || c.assigned_route_id || 'Unassigned'}</strong>
                          </span>
                          <span style={{ fontSize: 10, fontFamily: 'monospace' }}>
                            {parseFloat(c.lat).toFixed(4)}, {parseFloat(c.lng).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Routes with Customers Summary Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="card-title">Routes with Customers ({combinedRoutes.length})</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Displaying route corridor geofencing for Nungambakkam 1 and Triplicane 1
            </div>
          </div>
          <span className="badge badge-success">{combinedRoutes.length} Active Routes</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Assigned DP</th>
                <th>Customers</th>
                <th>Corridor Tolerance</th>
                <th>Compliance</th>
                <th>Status</th>
                <th>Map Action</th>
              </tr>
            </thead>
            <tbody>
              {combinedRoutes.map(r => {
                const isSelected = selectedRouteFilter === r.name;
                return (
                  <tr
                    key={r.id}
                    onClick={() => handleSelectRoute(r)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: r.color || 'var(--primary)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--primary)' : 'inherit' }}>
                          {r.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MdPeople style={{ color: 'var(--text-muted)' }} />
                        {typeof r.dp === 'object' ? r.dp?.name || 'Unassigned' : (r.dp || 'Unassigned')}
                      </div>
                    </td>
                    <td>{r.customerCount || r.customers?.length || 0} stops</td>
                    <td>
                      <span className="badge badge-outline" style={{ fontSize: 11 }}>
                        ±{r.corridorToleranceMeters || 120}m corridor
                      </span>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <ComplianceProgressBar value={r.compliance || 95} />
                    </td>
                    <td><StatusBadge status={r.status || 'active'} /></td>
                    <td>
                      <button
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRoute(r);
                        }}
                        style={{ fontSize: 11.5 }}
                      >
                        <MdLocationOn /> {isSelected ? 'Focused' : 'Locate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

