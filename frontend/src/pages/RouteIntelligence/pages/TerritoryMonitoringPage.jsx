import { motion } from 'framer-motion';
import { MdMap, MdPeople, MdAddLocation, MdRefresh, MdLocationOn, MdPlace, MdWarning, MdFilterList } from 'react-icons/md';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { SectionHeader, TerritoryCard, StatusBadge, ComplianceProgressBar } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_TERRITORIES } from '../utils/mockData.js';
import {
  LeafletMapContainer, RoutePolygon, DeliveryPartnerMarker, CustomerMarker,
  HeadOfficeMarker, HEAD_OFFICE, MOCK_GIS_PARTNERS
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

// Default fallback Chennai bounding box generator for routes
const FALLBACK_ROUTE_BOUNDARIES = [
  { id: 'rb-1', name: 'Alwarpet 1',      color: '#3b82f6', coordinates: [[13.0300, 80.2440], [13.0380, 80.2440], [13.0380, 80.2540], [13.0300, 80.2540]], dp: 'Rajan Kumar', customers: 18, compliance: 94, status: 'active' },
  { id: 'rb-2', name: 'Egmore 1',        color: '#10b981', coordinates: [[13.0680, 80.2550], [13.0780, 80.2550], [13.0780, 80.2660], [13.0680, 80.2660]], dp: 'Suresh Babu', customers: 14, compliance: 88, status: 'active' },
  { id: 'rb-3', name: 'Mandaveli 1',   color: '#ef4444', coordinates: [[13.0230, 80.2560], [13.0310, 80.2560], [13.0310, 80.2640], [13.0230, 80.2640]], dp: 'Muthu Raj',   customers: 16, compliance: 67, status: 'breach' },
  { id: 'rb-4', name: 'Mandaveli 2',   color: '#8b5cf6', coordinates: [[13.0250, 80.2600], [13.0330, 80.2600], [13.0330, 80.2680], [13.0250, 80.2680]], dp: 'Arjun Vel',   customers: 15, compliance: 97, status: 'active' },
  { id: 'rb-5', name: 'MRC Ngr',       color: '#f59e0b', coordinates: [[13.0170, 80.2690], [13.0250, 80.2690], [13.0250, 80.2790], [13.0170, 80.2790]], dp: 'Prakash Nair',customers: 20, compliance: 55, status: 'stopped' },
  { id: 'rb-6', name: 'Mylapore 1',    color: '#06b6d4', coordinates: [[13.0280, 80.2630], [13.0370, 80.2630], [13.0370, 80.2720], [13.0280, 80.2720]], dp: 'Vikram Selvan',customers: 13, compliance: 91, status: 'active' },
  { id: 'rb-7', name: 'Mylapore 2',    color: '#ec4899', coordinates: [[13.0310, 80.2660], [13.0400, 80.2660], [13.0400, 80.2750], [13.0310, 80.2750]], dp: 'Karthik Raja',customers: 11, compliance: 89, status: 'active' },
  { id: 'rb-8', name: 'Nungambakkam 1',color: '#14b8a6', coordinates: [[13.0550, 80.2340], [13.0650, 80.2340], [13.0650, 80.2450], [13.0550, 80.2450]], dp: 'Vijay Sethu', customers: 22, compliance: 95, status: 'active' },
  { id: 'rb-9', name: 'Royapettah 2',   color: '#f97316', coordinates: [[13.0450, 80.2540], [13.0550, 80.2540], [13.0550, 80.2650], [13.0450, 80.2540]], dp: 'Saravanan',   customers: 17, compliance: 82, status: 'active' },
  { id: 'rb-10', name: 'T-Nagar 1',     color: '#84cc16', coordinates: [[13.0360, 80.2280], [13.0460, 80.2280], [13.0460, 80.2390], [13.0360, 80.2390]], dp: 'Manikandan',  customers: 25, compliance: 98, status: 'active' },
  { id: 'rb-11', name: 'Teynampet 1',   color: '#6366f1', coordinates: [[13.0400, 80.2430], [13.0490, 80.2430], [13.0490, 80.2530], [13.0400, 80.2530]], dp: 'Karthik Raja',customers: 19, compliance: 92, status: 'active' },
  { id: 'rb-12', name: 'Triplicane 1',  color: '#a855f7', coordinates: [[13.0530, 80.2700], [13.0630, 80.2700], [13.0630, 80.2810], [13.0530, 80.2700]], dp: 'Saravanan',   customers: 24, compliance: 90, status: 'active' },
  { id: 'rb-13', name: 'West Mambalam 1', color: '#0284c7', coordinates: [[13.0330, 80.2170], [13.0420, 80.2170], [13.0420, 80.2260], [13.0330, 80.2260]], dp: 'Ramesh Babu',  customers: 21, compliance: 96, status: 'active' },
  { id: 'rb-14', name: 'West Mambalam 2', color: '#0d9488', coordinates: [[13.0350, 80.2200], [13.0440, 80.2200], [13.0440, 80.2290], [13.0350, 80.2200]], dp: 'Saravana Kumar', customers: 16, compliance: 93, status: 'active' },
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
      console.warn('⚠️ Failed to load DB2 Territories:', err.message);
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
      console.error('❌ Error loading customer locations:', err.message);
      setCustomerError('Failed to load customer locations from CRM.');
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  useEffect(() => {
    fetchTerritories();
    fetchCustomers();
  }, [fetchTerritories, fetchCustomers]);

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

  // Distinct routes available among real customer records
  const availableCustomerRoutes = useMemo(() => {
    const rSet = new Set();
    customers.forEach(c => {
      const rName = c.route_name || c.assigned_route_id;
      if (rName) rSet.add(rName);
    });
    return Array.from(rSet).sort();
  }, [customers]);

  // Filter mapped customers by route
  const filteredMappedCustomers = useMemo(() => {
    if (selectedRouteFilter === 'All') return mappedCustomers;
    return mappedCustomers.filter(c => {
      const rName = c.route_name || c.assigned_route_id || '';
      return rName.toLowerCase().trim() === selectedRouteFilter.toLowerCase().trim();
    });
  }, [mappedCustomers, selectedRouteFilter]);

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
              All Routes ({mappedCustomers.length})
            </button>
            {availableCustomerRoutes.map(rName => {
              const count = mappedCustomers.filter(c => (c.route_name || c.assigned_route_id) === rName).length;
              return (
                <button
                  key={rName}
                  className={`btn btn-xs ${selectedRouteFilter === rName ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedRouteFilter(rName)}
                >
                  {rName} ({count})
                </button>
              );
            })}
          </div>

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

        {/* Location Unavailable Customer List */}
        {showUnmappedDrawer && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', background: 'rgba(245,158,11,0.05)', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#d97706', marginBottom: 8 }}>
              ⚠️ Customers without GPS Coordinates ("Location unavailable"):
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

      {/* Map + Territory Cards */}
      <div className="ri-two-col">
        <div style={{ position: 'relative' }}>
          {loadingCustomers && (
            <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(255,255,255,0.92)', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              Loading customer locations...
            </div>
          )}

          {customerError && (
            <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              {customerError}
            </div>
          )}

          <LeafletMapContainer height={480} center={mapCenter} zoom={mapZoom} bounds={mapBounds}>
            {({ showCustomers, showTerritories, showPartners }) => (
              <>
                <HeadOfficeMarker office={HEAD_OFFICE} />

                {/* DB2 Route Area Boundaries marked on map */}
                {showTerritories && routes.map(r => {
                  const isSelected = selectedRouteId === r.id;
                  return (
                    <RoutePolygon
                      key={r.id}
                      type="polygon"
                      coordinates={r.coordinates || [[13.04, 80.24], [13.05, 80.24], [13.05, 80.25], [13.04, 80.25]]}
                      color={r.color || '#3b82f6'}
                      fillColor={r.color || '#3b82f6'}
                      fillOpacity={isSelected ? 0.35 : 0.15}
                      weight={isSelected ? 3.5 : 1.5}
                      title={`DB2 Route Area: ${r.name}`}
                      subtitle={`Zone: ${r.zone || 'Zone A'} | Assigned DP: ${r.dp} | Stops: ${r.customers || 10}`}
                      status={r.status || 'active'}
                    />
                  );
                })}

                {/* Plot Dynamic Real Customer Markers from Customer Management Module */}
                {showCustomers && filteredMappedCustomers.map(cust => (
                  <CustomerMarker key={cust.id} customer={cust} />
                ))}

                {/* Delivery Partners */}
                {showPartners && MOCK_GIS_PARTNERS.map(partner => (
                  <DeliveryPartnerMarker key={partner.id} partner={partner} />
                ))}
              </>
            )}
          </LeafletMapContainer>
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Mapped Customers ({filteredMappedCustomers.length})</span>
            <span className="badge badge-blue">{selectedRouteFilter}</span>
          </div>
          <div className="card-body" style={{ padding: '12px 16px', maxHeight: 420, overflowY: 'auto' }}>
            {filteredMappedCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                No customer locations available for this filter.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredMappedCustomers.map(c => (
                  <div key={c.id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 4 }}>{c.customer_code || 'CUST'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <MdPlace style={{ color: 'var(--primary)', marginRight: 4 }} /> {c.address}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>Route: <strong>{c.route_name || c.assigned_route_id || 'Unassigned'}</strong></span>
                      <span>Lat: {parseFloat(c.lat).toFixed(4)}, Lng: {parseFloat(c.lng).toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DB2 Route Boundaries Table with Map Marking Action */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="card-title">DB2 Route Area Boundaries</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Click any route to mark and focus its geographical area boundary on the map
            </div>
          </div>
          <span className="badge badge-blue">{routes.length} DB2 routes marked</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Assigned DP</th>
                <th>Customers</th>
                <th>Compliance</th>
                <th>Status</th>
                <th>Map Action</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => {
                const isSelected = selectedRouteId === r.id;
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
                        {r.dp}
                      </div>
                    </td>
                    <td>{r.customers} stops</td>
                    <td style={{ minWidth: 140 }}>
                      <ComplianceProgressBar value={r.compliance} />
                    </td>
                    <td><StatusBadge status={r.status} /></td>
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
