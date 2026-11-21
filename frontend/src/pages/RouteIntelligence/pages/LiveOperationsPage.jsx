import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMapEvents } from 'react-leaflet';
import {
  MdDirectionsBike, MdRoute, MdWarningAmber, MdNotifications,
  MdRefresh, MdFilterList, MdClose, MdWarning, MdMap,
  MdVisibility, MdVisibilityOff, MdSearch, MdFullscreen, MdFullscreenExit,
  MdLocationOn, MdCheckCircle, MdLocalShipping,
} from 'react-icons/md';
import { SectionHeader, AnalyticsCard } from '../components/index.jsx';
import {
  LeafletMapContainer, HeadOfficeMarker, CustomerMarker,
  DeliveryPartnerMarker, RoutePolyline, HEAD_OFFICE
} from '../maps/index.js';
import { AREA_PALETTE, getAreaColor } from '../utils/areaPalette.js';
import { computeRouteLaneOffsets } from '../utils/routeLaneOffset.js';
import useRouteMapData, { CANONICAL_AREA_DEFAULTS, resolveCustomerAreaName } from '../utils/useRouteMapData.js';
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

  // Query params
  const tabParam = searchParams.get('tab');
  const alertIdParam = searchParams.get('alertId');
  const latParam = parseFloat(searchParams.get('lat'));
  const lngParam = parseFloat(searchParams.get('lng'));
  const dpIdParam = searchParams.get('dpId');

  // Shared Data Hook — Single Source of Truth
  const {
    loading,
    isDb2Loaded,
    deliveryPartners,
    activeCustomerRoutes,
    allCustomers,
    mappedCustomers,
    unmappedCustomers,
    stats,
    selectedAlert,
    setSelectedAlert,
    refresh,
  } = useRouteMapData(alertIdParam);

  // Panel & Tab State
  const [activeTab, setActiveTab] = useState(tabParam === 'areas' ? 'areas' : 'partners');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [liveZoom, setLiveZoom] = useState(12);

  // Search & Filters
  const [dpSearchQuery, setDpSearchQuery] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('All');
  const [showUnmappedDrawer, setShowUnmappedDrawer] = useState(false);
  const [highlightedArea, setHighlightedArea] = useState(null);

  // Dynamic Map Navigation Center & Bounds
  const [customCenter, setCustomCenter] = useState(null);
  const [customBounds, setCustomBounds] = useState(null);

  // Per-Area Visibility State (All 5 enabled by default)
  const [visibleAreas, setVisibleAreas] = useState(() => {
    const initial = {};
    Object.values(AREA_PALETTE).forEach(a => {
      initial[a.name] = true;
    });
    return initial;
  });

  // Sync tab with URL
  useEffect(() => {
    if (tabParam === 'areas') {
      setActiveTab('areas');
    }
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const nextParams = new URLSearchParams(searchParams);
    if (newTab === 'areas') {
      nextParams.set('tab', 'areas');
    } else {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams);
  };

  const clearAlertView = () => {
    setSelectedAlert(null);
    setCustomCenter(null);
    setCustomBounds(null);
    const nextParams = new URLSearchParams();
    if (activeTab === 'areas') nextParams.set('tab', 'areas');
    setSearchParams(nextParams);
  };

  // Toggle single area visibility
  const toggleAreaVisibility = (areaName, e) => {
    if (e) e.stopPropagation();
    setVisibleAreas(prev => ({
      ...prev,
      [areaName]: prev[areaName] === false ? true : false,
    }));
  };

  // Spiderfy duplicate customer coordinates so all 108 pins remain visible & clickable
  const spiderfiedCustomers = useMemo(() => {
    const coordGroups = {};
    mappedCustomers.forEach(c => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(c);
    });

    return mappedCustomers.map(c => {
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
  }, [mappedCustomers]);

  // Per-area customer breakdowns (Mapped & Unmapped)
  const areaCustomerStats = useMemo(() => {
    const statsMap = {};
    Object.values(AREA_PALETTE).forEach(area => {
      const mapped = mappedCustomers.filter(c => resolveCustomerAreaName(c) === area.name).length;
      const unmapped = unmappedCustomers.filter(c => resolveCustomerAreaName(c) === area.name).length;
      const defLitres = CANONICAL_AREA_DEFAULTS.find(d => d.name === area.name)?.litres || 30;
      statsMap[area.name] = {
        mapped,
        unmapped,
        total: mapped + unmapped,
        litres: defLitres,
      };
    });
    return statsMap;
  }, [mappedCustomers, unmappedCustomers]);

  // Routes filtered by visibility
  const routesToRender = useMemo(() => {
    return activeCustomerRoutes.filter(r => visibleAreas[r.name] !== false);
  }, [activeCustomerRoutes, visibleAreas]);

  // Parallel lane offsets for visible routes (automatically re-packs lanes when areas are toggled off)
  const offsetCustomerRoutes = useMemo(() => {
    if (!routesToRender || routesToRender.length === 0) return [];
    return computeRouteLaneOffsets(routesToRender, liveZoom, {
      laneSpacingPx: 5.5,
      matchDistanceMeters: 15,
      stepMeters: 25,
    });
  }, [routesToRender, liveZoom]);

  // Pins to render: visible areas + selectedAreaFilter
  const pinsToRender = useMemo(() => {
    return spiderfiedCustomers.filter(c => {
      const aName = resolveCustomerAreaName(c);
      if (visibleAreas[aName] === false) return false;
      if (selectedAreaFilter !== 'All' && aName !== selectedAreaFilter) return false;
      return true;
    });
  }, [spiderfiedCustomers, visibleAreas, selectedAreaFilter]);

  // Visible unmapped customers
  const visibleUnmappedCustomers = useMemo(() => {
    return unmappedCustomers.filter(c => {
      const aName = resolveCustomerAreaName(c);
      if (visibleAreas[aName] === false) return false;
      if (selectedAreaFilter !== 'All' && aName !== selectedAreaFilter) return false;
      return true;
    });
  }, [unmappedCustomers, visibleAreas, selectedAreaFilter]);

  // Delivery Partners to render
  const filteredDeliveryPartners = useMemo(() => {
    return deliveryPartners.filter(dp => {
      const dpArea = dp.route || '';
      if (selectedAreaFilter !== 'All' && !dpArea.toLowerCase().includes(selectedAreaFilter.toLowerCase().split(' ')[0])) {
        return false;
      }
      if (dpSearchQuery.trim()) {
        const q = dpSearchQuery.toLowerCase().trim();
        const name = (dp.name || '').toLowerCase();
        const code = (dp.dpCode || '').toLowerCase();
        const route = (dp.route || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !route.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [deliveryPartners, selectedAreaFilter, dpSearchQuery]);

  // Zoom to an area's customer bounds and route polyline
  const handleAreaRowClick = (areaName) => {
    if (selectedAreaFilter === areaName) {
      // Toggle off filter if clicked again
      setSelectedAreaFilter('All');
      setHighlightedArea(null);
      setCustomBounds(null);
      return;
    }

    setSelectedAreaFilter(areaName);
    setHighlightedArea(areaName);

    const areaPins = mappedCustomers.filter(c => resolveCustomerAreaName(c) === areaName);
    const areaRoute = activeCustomerRoutes.find(r => r.name === areaName);
    const polyCoords = areaRoute?.polyline || [];

    const allLats = [...areaPins.map(c => parseFloat(c.lat)), ...polyCoords.map(p => p[0])].filter(n => !isNaN(n) && n > 0);
    const allLngs = [...areaPins.map(c => parseFloat(c.lng)), ...polyCoords.map(p => p[1])].filter(n => !isNaN(n) && n > 0);

    if (allLats.length > 0 && allLngs.length > 0) {
      const minLat = Math.min(...allLats);
      const maxLat = Math.max(...allLats);
      const minLng = Math.min(...allLngs);
      const maxLng = Math.max(...allLngs);
      const latMargin = (maxLat - minLat) * 0.15 || 0.008;
      const lngMargin = (maxLng - minLng) * 0.15 || 0.008;

      setCustomCenter(null);
      setCustomBounds([
        [minLat - latMargin, minLng - lngMargin],
        [maxLat + latMargin, maxLng + lngMargin],
      ]);
    }
  };

  // Zoom to delivery partner location
  const handleDpClick = (dp) => {
    if (dp.lat && dp.lng) {
      setCustomBounds(null);
      setCustomCenter([dp.lat, dp.lng]);
      setLiveZoom(16);
      if (dp.route) {
        setHighlightedArea(dp.route);
      }
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('dpId', dp.id);
        next.set('lat', dp.lat);
        next.set('lng', dp.lng);
        return next;
      });
    }
  };

  // Map center calculation
  const mapCenter = useMemo(() => {
    if (customCenter) return customCenter;
    if (selectedAlert?.location?.lat && selectedAlert?.location?.lng) {
      return [selectedAlert.location.lat, selectedAlert.location.lng];
    }
    if (!isNaN(latParam) && !isNaN(lngParam) && latParam > 0 && lngParam > 0) {
      return [latParam, lngParam];
    }
    return [HEAD_OFFICE.lat, HEAD_OFFICE.lng];
  }, [customCenter, selectedAlert, latParam, lngParam]);

  // Map bounds calculation
  const mapBounds = useMemo(() => {
    if (customBounds) return customBounds;
    if (selectedAlert || customCenter || (!isNaN(latParam) && !isNaN(lngParam) && latParam > 0)) {
      return null;
    }
    if (pinsToRender.length === 0) return null;

    const lats = pinsToRender.map(c => parseFloat(c.lat));
    const lngs = pinsToRender.map(c => parseFloat(c.lng));
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
  }, [customBounds, pinsToRender, selectedAlert, customCenter, latParam, lngParam]);

  // Derived KPI card values
  const activePartnersCount = stats.activePartners || deliveryPartners.filter(d => d.status === 'active' || d.status === 'GREEN').length;
  const pendingAlertsCount = stats.unreviewedAlertsCount || stats.alerts || 0;
  const visibleCorridorsCount = routesToRender.length;
  const visibleStopsCount = pinsToRender.length;
  const visibleUnmappedCount = visibleUnmappedCustomers.length;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Live Operations & Territory Monitoring"
        subtitle={
          <span>
            Real-time delivery partner tracking and area corridor intelligence across 5 Chennai delivery zones
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" id="ri-live-refresh-btn" onClick={refresh} disabled={loading}>
          <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/route-intelligence/compliance')}>
          <MdWarningAmber /> View Compliance ({pendingAlertsCount} Alerts)
        </button>
      </SectionHeader>

      {/* Alert Focus Banner (Inspection Mode) */}
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

      {/* 4 Stat Cards */}
      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
        <AnalyticsCard
          icon={<MdDirectionsBike />}
          label="Active Partners"
          value={activePartnersCount}
          sub={`${deliveryPartners.length} registered DPs`}
          color="var(--success)"
        />
        <AnalyticsCard
          icon={<MdRoute />}
          label="Area Corridors"
          value={visibleCorridorsCount}
          sub="5 Unique-Colored Area Lines"
          color="var(--primary)"
        />
        <AnalyticsCard
          icon={<MdWarningAmber />}
          label="Off-Route Alerts"
          value={pendingAlertsCount}
          sub="Pending Superadmin Review"
          color="var(--danger)"
        />
        <AnalyticsCard
          icon={<MdNotifications />}
          label="Delivery Stops"
          value={visibleStopsCount}
          sub={`${visibleUnmappedCount} unmapped`}
          color="var(--info)"
        />
      </div>

      {/* Active Filter & Action Bar */}
      <div className="card" style={{ marginBottom: 16, padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <MdFilterList /> Quick Area Filter:
            </span>
            <button
              className={`btn btn-xs ${selectedAreaFilter === 'All' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setSelectedAreaFilter('All'); setHighlightedArea(null); setCustomBounds(null); }}
            >
              All 5 Areas ({mappedCustomers.length})
            </button>
            {Object.values(AREA_PALETTE).map(area => {
              const custCount = areaCustomerStats[area.name]?.mapped || 0;
              const isSelected = selectedAreaFilter === area.name;
              return (
                <button
                  key={area.id}
                  className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                  style={isSelected
                    ? { background: area.color, borderColor: area.color, color: '#fff', fontWeight: 700 }
                    : { borderColor: area.color, color: area.color }
                  }
                  onClick={() => handleAreaRowClick(area.name)}
                >
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isSelected ? '#fff' : area.color, marginRight: 5 }} />
                  {area.name} ({custCount})
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`btn btn-xs ${isMapExpanded ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setIsMapExpanded(prev => !prev)}
              id="ri-expand-map-btn"
              title={isMapExpanded ? 'Collapse Map' : 'Expand Map'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              {isMapExpanded ? <MdFullscreenExit size={16} /> : <MdFullscreen size={16} />}
              {isMapExpanded ? 'Standard Map' : 'Maximize Map'}
            </button>

            <button
              className={`btn btn-xs ${isPanelOpen ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setIsPanelOpen(prev => !prev)}
              id="ri-toggle-panel-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              <MdMap size={16} />
              {isPanelOpen ? 'Hide Panel' : 'Show Panel'}
            </button>
          </div>
        </div>
      </div>

      {/* Map + Right-Hand Tabbed Panel Layout */}
      <div className={`ri-map-layout ${isPanelOpen ? 'panel-open' : 'panel-closed'} ${isMapExpanded ? 'map-expanded' : ''}`}>
        {/* Full Map Container */}
        <div className="ri-map-container-col">
          <LeafletMapContainer
            height={isMapExpanded ? 780 : 680}
            center={mapCenter}
            zoom={selectedAlert ? 15 : liveZoom}
            bounds={mapBounds}
            isExpanded={isMapExpanded}
            onToggleExpand={() => setIsMapExpanded(prev => !prev)}
            isPanelOpen={isPanelOpen}
            onTogglePanel={() => setIsPanelOpen(prev => !prev)}
            legendItems={[
              ...Object.values(AREA_PALETTE).map(a => ({ label: `${a.name} (${a.code})`, color: a.color })),
              { label: 'DP: GREEN (Inside Corridor)', color: '#10b981', shape: 'circle' },
              { label: 'DP: YELLOW (Grace Period)', color: '#f59e0b', shape: 'circle' },
              { label: 'DP: RED (Deviated / Review)', color: '#ef4444', shape: 'circle' },
              { label: 'Customer Stops (Per-Area Color)', color: '#f59e0b' },
            ]}
          >
            {({ showCustomers, showPartners, showRoutes }) => (
              <>
                <MapZoomListener onZoom={setLiveZoom} />
                <HeadOfficeMarker office={HEAD_OFFICE} />

                {/* Road-following Corridor Polylines (Rendered in parallel lanes along shared roads with white casing) */}
                {showRoutes && offsetCustomerRoutes.map(route => {
                  const isHighlighted = highlightedArea && (
                    route.name.toLowerCase() === highlightedArea.toLowerCase() ||
                    route.name.toLowerCase().includes(highlightedArea.toLowerCase().split(' ')[0])
                  );
                  return (
                    <RoutePolyline
                      key={route.id}
                      coordinates={route.lanePolyline || route.roadCoordinates || route.polyline}
                      originalCoordinates={route.originalPolyline || route.roadCoordinates || route.polyline}
                      color={route.color}
                      weight={isHighlighted ? 6 : 4.5}
                      routeName={`${route.name} (${route.customerCount || 0} Customers)`}
                      isRouteCorridor={route.isRouteCorridor}
                      corridorTolerance={route.corridorToleranceMeters || 120}
                      customerCount={route.customerCount}
                      assignedDp={route.assignedDp}
                    />
                  );
                })}

                {/* Red Deviation Trail for Alert Inspection Mode */}
                {selectedAlert && selectedAlert.trail && selectedAlert.trail.length >= 2 && (
                  <RoutePolyline
                    key="deviation-trail-red"
                    coordinates={selectedAlert.trail.map(t => [t.lat, t.lng])}
                    color="#ef4444"
                    routeName={`Deviation Trail: ${selectedAlert.dpName} (${selectedAlert.maxDistance}m off-route)`}
                    weight={5}
                    dashArray="6, 6"
                  />
                )}

                {/* Customer Stops (108 mapped pins colored per area, spiderfied to prevent overlap) */}
                {showCustomers && pinsToRender.map(cust => (
                  <CustomerMarker key={cust.id} customer={cust} selectedRouteFilter={selectedAreaFilter} />
                ))}

                {/* Delivery Partners (Live GPS locations with area color tint and initials) */}
                {showPartners && deliveryPartners.map(partner => (
                  <DeliveryPartnerMarker key={partner.id} partner={partner} />
                ))}
              </>
            )}
          </LeafletMapContainer>
        </div>

        {/* Right-Hand Side Panel with Two Tabs */}
        {isPanelOpen && (
          <div className="ri-merged-panel">
            {/* Tab Navigation Header */}
            <div className="ri-panel-tabs">
              <button
                className={`ri-panel-tab ${activeTab === 'partners' ? 'active' : ''}`}
                onClick={() => handleTabChange('partners')}
                id="ri-tab-partners"
              >
                <MdDirectionsBike size={16} /> Delivery Partners ({filteredDeliveryPartners.length})
              </button>
              <button
                className={`ri-panel-tab ${activeTab === 'areas' ? 'active' : ''}`}
                onClick={() => handleTabChange('areas')}
                id="ri-tab-areas"
              >
                <MdMap size={16} /> Areas ({Object.keys(AREA_PALETTE).length})
              </button>
            </div>

            {/* Tab 1: Delivery Partners List */}
            {activeTab === 'partners' && (
              <div className="ri-panel-body">
                {/* Search Box */}
                <div className="ri-customer-search-box" style={{ borderRadius: 6, margin: '-4px 0 4px' }}>
                  <MdSearch className="ri-search-icon" />
                  <input
                    type="text"
                    placeholder="Search DP name, code, route..."
                    value={dpSearchQuery}
                    onChange={e => setDpSearchQuery(e.target.value)}
                    className="ri-customer-search-input"
                  />
                  {dpSearchQuery && (
                    <button className="ri-search-clear-btn" onClick={() => setDpSearchQuery('')}>✕</button>
                  )}
                </div>

                <div className="ri-dp-list">
                  {filteredDeliveryPartners.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                      No delivery partners found.
                    </div>
                  ) : (
                    filteredDeliveryPartners.map(dp => {
                      const initials = dp.initials || (dp.name ? dp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : (dp.dpCode || 'DP'));
                      const cStatus = (dp.corridorStatus || dp.status || '').toUpperCase();
                      const isOutsideWindow = dp.status === 'Outside Window' || dp.status === 'Off Duty';
                      const isGpsUnavailable = !isOutsideWindow && (dp.gpsStatus === 'unavailable' || dp.status === 'GPS unavailable' || !dp.lat || !dp.lng);
                      const areaColor = dp.areaColor || getAreaColor(dp.route);

                      let badgeBg = '#dcfce7';
                      let badgeColor = '#166534';
                      if (isOutsideWindow) {
                        badgeBg = '#f1f5f9';
                        badgeColor = '#475569';
                      } else if (isGpsUnavailable) {
                        badgeBg = '#f1f5f9';
                        badgeColor = '#64748b';
                      } else if (cStatus === 'RED' || dp.status === 'deviated') {
                        badgeBg = '#fee2e2';
                        badgeColor = '#991b1b';
                      } else if (cStatus === 'YELLOW' || dp.status === 'stopped' || dp.status === 'Location stale') {
                        badgeBg = '#fef3c7';
                        badgeColor = '#92400e';
                      }

                      return (
                        <div
                          key={dp.id}
                          className="ri-dp-item"
                          onClick={() => handleDpClick(dp)}
                          title="Click to zoom to DP and highlight route"
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
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: badgeBg, color: badgeColor }}>
                                {isOutsideWindow ? 'Outside Window' : isGpsUnavailable ? 'No GPS' : dp.status || 'Active'}
                              </span>
                            </div>
                          </div>
                          <div className="ri-dp-speed">
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {isOutsideWindow ? 'Off Duty' : isGpsUnavailable ? '—' : dp.speed > 0 ? `${dp.speed} kph` : 'Stopped'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dp.lastUpdate || 'Live'}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Areas & Corridors List */}
            {activeTab === 'areas' && (
              <div className="ri-panel-body">
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  Click an area to zoom to its boundaries & filter DPs. Use the eye icon to toggle visibility and re-pack road lanes.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.values(AREA_PALETTE).map(area => {
                    const statsForArea = areaCustomerStats[area.name] || { mapped: 0, unmapped: 0, litres: 30 };
                    const isVisible = visibleAreas[area.name] !== false;
                    const isSelected = selectedAreaFilter === area.name;

                    return (
                      <div
                        key={area.id}
                        className={`ri-area-row ${isSelected ? 'selected' : ''} ${!isVisible ? 'hidden-area' : ''}`}
                        onClick={() => handleAreaRowClick(area.name)}
                        title="Click to zoom to area and filter DPs"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="ri-area-swatch" style={{ background: area.color }} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                              {area.name}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
                              <span><strong>{statsForArea.mapped}</strong> stops</span>
                              <span>•</span>
                              <span><MdLocalShipping size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />{statsForArea.litres} L</span>
                              {statsForArea.unmapped > 0 && (
                                <span style={{ color: '#d97706', fontWeight: 600 }}>({statsForArea.unmapped} unmapped)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            className={`ri-area-toggle-btn ${isVisible ? 'active' : ''}`}
                            onClick={(e) => toggleAreaVisibility(area.name, e)}
                            title={isVisible ? 'Hide area on map' : 'Show area on map'}
                          >
                            {isVisible ? <MdVisibility size={18} /> : <MdVisibilityOff size={18} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Unmapped Customers List Drawer */}
                <div className="ri-unmapped-section">
                  <div className="ri-unmapped-header" onClick={() => setShowUnmappedDrawer(prev => !prev)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdWarning size={16} />
                      <span>Unmapped Customers ({unmappedCustomers.length})</span>
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: 10, cursor: 'pointer' }}>
                      {showUnmappedDrawer ? 'Hide Details' : 'View List'}
                    </span>
                  </div>

                  {showUnmappedDrawer && (
                    <div className="ri-unmapped-list">
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Customers lacking latitude/longitude coordinates ("Location unavailable"):
                      </div>
                      {unmappedCustomers.map(c => (
                        <div key={c.id} className="ri-unmapped-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{c.name}</strong>
                            <span style={{ fontSize: 10, fontFamily: 'monospace', background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 4 }}>
                              {c.customer_code || 'CUST'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {c.address || 'Address unavailable'}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Area: <strong>{resolveCustomerAreaName(c)}</strong></span>
                            <span style={{ color: '#d97706', fontWeight: 600 }}>Location unavailable</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
