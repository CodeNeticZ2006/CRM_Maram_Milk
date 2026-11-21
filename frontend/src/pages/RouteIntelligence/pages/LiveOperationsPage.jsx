import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMapEvents } from 'react-leaflet';
import {
  MdDirectionsBike, MdRoute, MdWarningAmber, MdNotifications,
  MdRefresh, MdFilterList, MdClose, MdWarning,
} from 'react-icons/md';
import { SectionHeader, AnalyticsCard, EventSeverityIcon } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_DELIVERY_PARTNERS, MOCK_LIVE_EVENTS } from '../utils/mockData.js';
import { buildActiveCustomerRoutes } from '../utils/routeGeometry.js';
import {
  LeafletMapContainer, HeadOfficeMarker, CustomerMarker,
  DeliveryPartnerMarker, RoutePolyline, HEAD_OFFICE
} from '../maps/index.js';
import { AREA_PALETTE, getAreaColor } from '../utils/areaPalette.js';
import { computeRouteLaneOffsets } from '../utils/routeLaneOffset.js';
import '../components/RouteIntelligence.css';

function MapZoomListener({ onZoom }) {
  useMapEvents({
    zoomend: (e) => {
      onZoom(e.target.getZoom());
    },
  });
  return null;
}

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function LiveOperationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [deliveryPartners, setPartners] = useState(MOCK_DELIVERY_PARTNERS);
  const [routes, setRoutes] = useState([]);
  const [stats, setStats] = useState({ activePartners: 0, totalRoutes: 0, deviations: 0, stopped: 0, alerts: 0, unreviewedAlertsCount: 0 });
  const [liveEvents, setEvents] = useState(MOCK_LIVE_EVENTS);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);

  const [allCustomers, setAllCustomers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [routeCorridors, setRouteCorridors] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Per-area toggle and zoom state
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('All');
  const [liveZoom, setLiveZoom] = useState(12);
  const [showUnmappedDrawer, setShowUnmappedDrawer] = useState(false);

  const alertIdParam = searchParams.get('alertId');
  const latParam = parseFloat(searchParams.get('lat'));
  const lngParam = parseFloat(searchParams.get('lng'));

  const fetchLiveOps = useCallback(async () => {
    setLoading(true);
    try {
      const [opsRes, corrRes, alertRes] = await Promise.all([
        api.get('/route-intelligence/live-operations').catch(() => null),
        api.get('/route-intelligence/route-corridors').catch(() => null),
        alertIdParam ? api.get('/route-intelligence/alerts').catch(() => null) : null,
      ]);

      let loadedMapped = [];
      let loadedAll = [];

      if (opsRes?.data?.success && opsRes?.data?.data) {
        const { deliveryPartners: dps, routes: rts, stats: st, liveEvents: evs, customers: cList, unmappedCustomers: uList, allCustomers: aList } = opsRes.data.data;
        if (dps && dps.length > 0) setPartners(dps);
        if (rts && rts.length > 0) setRoutes(rts);
        if (st) setStats(st);
        if (evs && evs.length > 0) setEvents(evs);
        if (cList && cList.length > 0) {
          loadedMapped = cList;
          loadedAll = aList || [...cList, ...(uList || [])];
        }
        setIsDb2Loaded(true);
      }

      if (corrRes?.data?.success && corrRes.data?.data?.routes) {
        setRouteCorridors(corrRes.data.data.routes);
        if (loadedMapped.length === 0) {
          const corrCust = [];
          const missingCust = [];
          corrRes.data.data.routes.forEach(r => {
            if (r.customers) corrCust.push(...r.customers);
            if (r.missingCustomers) missingCust.push(...r.missingCustomers);
          });
          if (corrCust.length > 0) {
            loadedMapped = corrCust;
            loadedAll = [...corrCust, ...missingCust];
          }
        }
      }

      if (loadedMapped.length > 0) {
        setAllCustomers(loadedAll);
        setCustomers(loadedMapped);
      }
    } catch (err) {
      console.warn('Failed to load DB2 Live Operations data:', err.message);
    } finally {
      setLoading(false);
    }
  }, [alertIdParam]);

  useEffect(() => {
    fetchLiveOps();
  }, [fetchLiveOps]);

  const clearAlertView = () => {
    setSelectedAlert(null);
    setSearchParams({});
  };

  // Spiderfy duplicate customer coordinates so all 108 pins remain visible & clickable
  const spiderfiedCustomers = useMemo(() => {
    const coordGroups = {};
    customers.forEach(c => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(c);
    });

    return customers.map(c => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const group = coordGroups[key];

      if (group && group.length > 1) {
        const idx = group.indexOf(c);
        const total = group.length;
        const angle = (idx / total) * 2 * Math.PI;
        const dLat = 0.00010 * Math.cos(angle);
        const dLng = (0.00010 * Math.sin(angle)) / Math.cos(lat * Math.PI / 180);
        return {
          ...c,
          spiderfyLat: lat + dLat,
          spiderfyLng: lng + dLng,
        };
      }
      return {
        ...c,
        spiderfyLat: lat,
        spiderfyLng: lng,
      };
    });
  }, [customers]);

  const filterMatchesArea = (c, filter) => {
    if (!filter || filter === 'All' || filter === 'All Routes' || filter === 'All 5 Areas') return true;
    const rName = (c.route_name || c.assigned_route_id || c.area || '').toLowerCase().trim();
    const fLower = filter.toLowerCase().trim();
    return rName === fLower || rName.includes(fLower.split(' ')[0]);
  };

  const filteredMappedPins = useMemo(() => {
    if (selectedAreaFilter === 'All') return spiderfiedCustomers;
    return spiderfiedCustomers.filter(c => filterMatchesArea(c, selectedAreaFilter));
  }, [spiderfiedCustomers, selectedAreaFilter]);

  const unmappedCustomers = useMemo(() => {
    return allCustomers.filter(c => {
      if (!c.lat || !c.lng) return true;
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      return isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0;
    });
  }, [allCustomers]);

  const filteredUnmappedCustomers = useMemo(() => {
    if (selectedAreaFilter === 'All') return unmappedCustomers;
    return unmappedCustomers.filter(c => filterMatchesArea(c, selectedAreaFilter));
  }, [unmappedCustomers, selectedAreaFilter]);

  // Generate road-following corridor polylines for all 5 areas
  const activeCustomerRoutes = useMemo(() => {
    if (routeCorridors && routeCorridors.length > 0) {
      return routeCorridors.map(rc => ({
        id: rc.id,
        name: rc.name,
        color: rc.color,
        isRouteCorridor: true,
        corridorToleranceMeters: rc.corridorToleranceMeters || 120,
        customerCount: rc.customerCount,
        polyline: rc.polyline || rc.roadCoordinates,
        roadCoordinates: rc.polyline || rc.roadCoordinates,
        assignedDp: rc.assignedDp,
      }));
    }
    return buildActiveCustomerRoutes(allCustomers, HEAD_OFFICE);
  }, [routeCorridors, allCustomers]);

  const routesToRender = useMemo(() => {
    if (selectedAreaFilter === 'All') return activeCustomerRoutes;
    return activeCustomerRoutes.filter(r => r.name.toLowerCase().trim() === selectedAreaFilter.toLowerCase().trim());
  }, [activeCustomerRoutes, selectedAreaFilter]);

  const offsetCustomerRoutes = useMemo(() => {
    if (!routesToRender || routesToRender.length === 0) return [];
    return computeRouteLaneOffsets(routesToRender, liveZoom, {
      laneSpacingPx: 5.5,
      matchDistanceMeters: 15,
      stepMeters: 25,
    });
  }, [routesToRender, liveZoom]);

  // Dynamic map bounds or center on alert
  const mapCenter = useMemo(() => {
    if (selectedAlert?.location?.lat && selectedAlert?.location?.lng) {
      return [selectedAlert.location.lat, selectedAlert.location.lng];
    }
    if (!isNaN(latParam) && !isNaN(lngParam)) {
      return [latParam, lngParam];
    }
    return [HEAD_OFFICE.lat, HEAD_OFFICE.lng];
  }, [selectedAlert, latParam, lngParam]);

  const mapBounds = useMemo(() => {
    if (selectedAlert || (!isNaN(latParam) && !isNaN(lngParam))) return null;
    if (customers.length === 0) return null;
    const lats = customers.map(c => parseFloat(c.lat));
    const lngs = customers.map(c => parseFloat(c.lng));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const marginLat = (maxLat - minLat) * 0.1 || 0.01;
    const marginLng = (maxLng - minLng) * 0.1 || 0.01;
    return [
      [minLat - marginLat, minLng - marginLng],
      [maxLat + marginLat, maxLng + marginLng],
    ];
  }, [customers, selectedAlert, latParam, lngParam]);

  const activePartners = stats.activePartners || deliveryPartners.filter(d => d.status === 'active' || d.status === 'GREEN').length;
  const deviations     = stats.deviations || deliveryPartners.filter(d => d.status === 'deviated' || d.status === 'RED').length;
  const stopped        = stats.stopped || deliveryPartners.filter(d => d.status === 'stopped' || d.status === 'YELLOW').length;
  const pendingAlerts  = stats.unreviewedAlertsCount || stats.alerts || 0;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Live Operations"
        subtitle={
          <span>
            Real-time delivery partner tracking across 5 Area Corridors ({activeCustomerRoutes.length} Active Corridors)
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" id="ri-live-refresh-btn" onClick={fetchLiveOps} disabled={loading}>
          <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/route-intelligence/compliance')}>
          <MdWarningAmber /> View Compliance ({pendingAlerts} Alerts)
        </button>
      </SectionHeader>

      {/* Alert Focus Banner */}
      {selectedAlert && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>
                Inspecting Off-Route Deviation: {selectedAlert.dpName} ({selectedAlert.areaName})
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>
                Status: <strong>{selectedAlert.status}</strong> • Type: {selectedAlert.type === 'OFF_ROUTE_DRIVING' ? 'Driving Off-Route' : 'Stopped Off-Route'} • Offset: <strong>{selectedAlert.maxDistance}m</strong> • Driving: {selectedAlert.drivingSeconds}s • Stopped: {selectedAlert.stoppedSeconds}s
              </div>
            </div>
          </div>
          <button className="btn btn-xs btn-outline" onClick={clearAlertView} style={{ borderColor: '#ef4444', color: '#b91c1c' }}>
            <MdClose /> Clear Deviation View
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
        <AnalyticsCard
          icon={<MdDirectionsBike />}
          label="Active Partners"
          value={activePartners}
          sub={`${deliveryPartners.length} registered DPs`}
          color="var(--success)"
        />
        <AnalyticsCard
          icon={<MdRoute />}
          label="Area Corridors"
          value={activeCustomerRoutes.length || 5}
          sub="5 Unique-Colored Area Lines"
          color="var(--primary)"
        />
        <AnalyticsCard
          icon={<MdWarningAmber />}
          label="Off-Route Alerts"
          value={pendingAlerts}
          sub="Pending Superadmin Review"
          color="var(--danger)"
        />
        <AnalyticsCard
          icon={<MdNotifications />}
          label="Delivery Stops"
          value={filteredMappedPins.length}
          sub={`${filteredUnmappedCustomers.length} unmapped`}
          color="var(--info)"
        />
      </div>

      {/* Area Filter Controls */}
      <div className="card" style={{ marginBottom: 16, padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <MdFilterList /> Area Filter:
            </span>
            <button
              className={`btn btn-xs ${selectedAreaFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedAreaFilter('All')}
            >
              All 5 Areas ({customers.length})
            </button>
            {Object.values(AREA_PALETTE).map(area => {
              const custCount = customers.filter(c =>
                (c.route_name || c.assigned_route_id || c.area || '').toLowerCase().includes(area.name.toLowerCase().split(' ')[0])
              ).length;
              const isActive = selectedAreaFilter === area.name;
              return (
                <button
                  key={area.id}
                  className={`btn btn-xs ${isActive ? 'btn-primary' : 'btn-outline'}`}
                  style={isActive
                    ? { background: area.color, borderColor: area.color, color: '#fff', fontWeight: 700 }
                    : { borderColor: area.color, color: area.color }
                  }
                  onClick={() => setSelectedAreaFilter(area.name)}
                >
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isActive ? '#fff' : area.color, marginRight: 5 }} />
                  {area.name} ({custCount})
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
              <MdWarning /> Location unavailable ({filteredUnmappedCustomers.length})
            </button>
          )}
        </div>

        {showUnmappedDrawer && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', background: 'rgba(245,158,11,0.05)', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#d97706', marginBottom: 8 }}>
              <MdWarning /> Customers without GPS Coordinates ("Location unavailable"):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {filteredUnmappedCustomers.map(c => (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                  <strong>{c.name}</strong> ({c.customer_code || 'No Code'}) — <span style={{ color: 'var(--text-muted)' }}>{c.address || 'No Address'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map + DP List */}
      <div className="ri-two-col">
        <LeafletMapContainer
          height={480}
          center={mapCenter}
          zoom={selectedAlert ? 15 : 12}
          bounds={mapBounds}
          legendItems={[
            ...Object.values(AREA_PALETTE).map(a => ({ label: `${a.name} (${a.code})`, color: a.color })),
            { label: 'DP: GREEN (Inside Corridor)', color: '#10b981', shape: 'circle' },
            { label: 'DP: YELLOW (Grace Period)', color: '#f59e0b', shape: 'circle' },
            { label: 'DP: RED (Deviated / Review)', color: '#ef4444', shape: 'circle' },
            { label: 'Customer Stops', color: '#f59e0b' },
          ]}
        >
          {({ showCustomers, showPartners, showRoutes }) => (
            <>
              <MapZoomListener onZoom={setLiveZoom} />
              {/* Head Office */}
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* Road-following corridor polylines for all 5 areas rendered in parallel lanes */}
              {showRoutes && offsetCustomerRoutes.map(route => (
                <RoutePolyline
                  key={route.id}
                  coordinates={route.lanePolyline || route.roadCoordinates || route.polyline}
                  originalCoordinates={route.originalPolyline || route.roadCoordinates || route.polyline}
                  color={route.color}
                  routeName={`${route.name} (${route.customerCount || 0} Customers)`}
                  isRouteCorridor={route.isRouteCorridor}
                  corridorTolerance={route.corridorToleranceMeters || 120}
                  customerCount={route.customerCount}
                  assignedDp={route.assignedDp}
                />
              ))}

              {/* Deviation Trail in Red when inspecting an alert */}
              {selectedAlert && selectedAlert.trail && selectedAlert.trail.length >= 2 && (
                <RoutePolyline
                  key="deviation-trail-red"
                  coordinates={selectedAlert.trail.map(t => [t.lat, t.lng])}
                  color="#ef4444"
                  routeName={`Deviation Trail: ${selectedAlert.dpName} (${selectedAlert.maxDistance}m off-route)`}
                  strokeWeight={4}
                  dashArray="6, 6"
                />
              )}

              {/* Customers (Filtered mapped customer pins in area colors) */}
              {showCustomers && filteredMappedPins.map(cust => (
                <CustomerMarker key={cust.id} customer={cust} selectedRouteFilter={selectedAreaFilter} />
              ))}

              {/* Delivery Partners (Actual GPS coordinates with area color tint and initials) */}
              {showPartners && deliveryPartners.map(partner => (
                <DeliveryPartnerMarker key={partner.id} partner={partner} />
              ))}
            </>
          )}
        </LeafletMapContainer>

        <div className="card" style={{ padding: '20px 0' }}>
          <div style={{ padding: '0 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Assigned Area DPs ({deliveryPartners.length})</span>
            <span className="badge badge-success">{activePartners} online</span>
          </div>
          <div className="ri-dp-list" style={{ padding: '12px 16px', maxHeight: 410, overflowY: 'auto' }}>
            {deliveryPartners.map(dp => {
              const initials = dp.initials || (dp.name ? dp.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : (dp.dpCode || 'DP'));
              const cStatus = (dp.corridorStatus || dp.status || '').toUpperCase();
              const isGpsUnavailable = dp.gpsStatus === 'unavailable' || dp.status === 'GPS unavailable' || !dp.lat || !dp.lng;
              const areaColor = dp.areaColor || 'var(--primary)';

              let statusColor = 'var(--success)';
              if (isGpsUnavailable) {
                statusColor = 'var(--text-muted)';
              } else if (cStatus === 'RED' || dp.status === 'deviated') {
                statusColor = 'var(--danger)';
              } else if (cStatus === 'YELLOW' || dp.status === 'stopped' || dp.status === 'Location stale') {
                statusColor = 'var(--warning)';
              }

              return (
                <div
                  key={dp.id}
                  className="ri-dp-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (dp.lat && dp.lng) {
                      setSearchParams({ dpId: dp.id, lat: dp.lat, lng: dp.lng });
                    }
                  }}
                >
                  <div className="ri-dp-avatar" style={{ background: areaColor }}>
                    {initials}
                  </div>
                  <div className="ri-dp-info">
                    <div className="ri-dp-name">
                      {dp.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({dp.dpCode || 'DP'})</span>
                    </div>
                    <div className="ri-dp-route" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: areaColor }}>{dp.route}</span>
                      {dp.status && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: cStatus === 'GREEN' ? '#dcfce7' : cStatus === 'YELLOW' ? '#fef3c7' : '#fee2e2', color: cStatus === 'GREEN' ? '#166534' : cStatus === 'YELLOW' ? '#92400e' : '#991b1b' }}>
                          {dp.status}
                        </span>
                      )}
                      {dp.currentState && (
                        <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                          [{dp.currentState}]
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ri-dp-speed">
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isGpsUnavailable ? 'No GPS' : dp.speed > 0 ? `${dp.speed} kph` : 'Stopped'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dp.lastUpdate || 'Live'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
