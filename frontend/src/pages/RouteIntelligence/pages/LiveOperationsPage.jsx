import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MdDirectionsBike, MdRoute, MdWarningAmber, MdNotifications,
  MdRefresh, MdFilterList, MdClose,
} from 'react-icons/md';
import { SectionHeader, AnalyticsCard, EventSeverityIcon } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_DELIVERY_PARTNERS, MOCK_LIVE_EVENTS } from '../utils/mockData.js';
import { buildActiveCustomerRoutes } from '../utils/routeGeometry.js';
import {
  LeafletMapContainer, HeadOfficeMarker, CustomerMarker,
  DeliveryPartnerMarker, RoutePolyline, HEAD_OFFICE
} from '../maps/index.js';
import { AREA_PALETTE } from '../utils/areaPalette.js';
import '../components/RouteIntelligence.css';

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

  const alertIdParam = searchParams.get('alertId');
  const latParam = parseFloat(searchParams.get('lat'));
  const lngParam = parseFloat(searchParams.get('lng'));

  const fetchLiveOps = useCallback(async () => {
    setLoading(true);
    try {
      const [opsRes, custRes, corrRes, alertRes] = await Promise.all([
        api.get('/route-intelligence/live-operations').catch(() => null),
        api.get('/customers', { params: { limit: 500 } }).catch(() => null),
        api.get('/route-intelligence/route-corridors').catch(() => null),
        alertIdParam ? api.get('/route-intelligence/alerts').catch(() => null) : null,
      ]);

      if (opsRes?.data?.success && opsRes?.data?.data) {
        const { deliveryPartners: dps, routes: rts, stats: st, liveEvents: evs } = opsRes.data.data;
        if (dps && dps.length > 0) setPartners(dps);
        if (rts && rts.length > 0) setRoutes(rts);
        if (st) setStats(st);
        if (evs && evs.length > 0) setEvents(evs);
        setIsDb2Loaded(true);
      }

      if (custRes?.data?.success && Array.isArray(custRes.data?.data)) {
        setAllCustomers(custRes.data.data);
        setCustomers(custRes.data.data.filter(c => c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng))));
      }

      if (corrRes?.data?.success && corrRes.data?.data?.routes) {
        setRouteCorridors(corrRes.data.data.routes);
        // Consolidate customers if needed
        const corrCust = [];
        corrRes.data.data.routes.forEach(r => {
          if (r.customers) corrCust.push(...r.customers);
        });
        if (corrCust.length > 0 && customers.length === 0) {
          setCustomers(corrCust);
        }
      }

      if (alertRes?.data?.success && Array.isArray(alertRes.data?.data)) {
        const found = alertRes.data.data.find(a => String(a.id) === String(alertIdParam));
        if (found) setSelectedAlert(found);
      }
    } catch (err) {
      console.warn('Failed to load DB2 Live Operations data:', err.message);
    } finally {
      setLoading(false);
    }
  }, [alertIdParam, customers.length]);

  useEffect(() => {
    fetchLiveOps();
  }, [fetchLiveOps]);

  const clearAlertView = () => {
    setSelectedAlert(null);
    setSearchParams({});
  };

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
          value={customers.length}
          sub="Mapped Customer Pins"
          color="var(--info)"
        />
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
              {/* Head Office */}
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* Road-following corridor polylines for all 5 areas */}
              {showRoutes && activeCustomerRoutes.map(route => (
                <RoutePolyline
                  key={route.id}
                  coordinates={route.roadCoordinates || route.polyline}
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

              {/* Customers (Dynamic from CRM DB with route pin colors) */}
              {showCustomers && customers.map(cust => (
                <CustomerMarker key={cust.id} customer={cust} />
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
