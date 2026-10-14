import React from 'react';
import {
  MdPeople, MdDirectionsBike, MdMap, MdTimeline, MdFilterList, MdCenterFocusWeak,
  MdFullscreen, MdFullscreenExit, MdViewSidebar,
} from 'react-icons/md';
import { MapPin, AlertTriangle } from 'lucide-react';

export default function MapControls({
  showCustomers,
  setShowCustomers,
  showPartners,
  setShowPartners,
  showTerritories,
  setShowTerritories,
  showRoutes,
  setShowRoutes,
  showGeofences,
  setShowGeofences,
  showDeviations,
  setShowDeviations,
  onResetView,
  isExpanded,
  onToggleExpand,
  isPanelOpen,
  onTogglePanel,
}) {
  return (
    <div className="leaflet-floating-controls">
      <div className="controls-title">
        <MdFilterList style={{ fontSize: 14, color: 'var(--primary, #3b82f6)' }} />
        <span>Layer Filters</span>
      </div>

      <div className="controls-buttons">
        {setShowCustomers && (
          <button
            className={`map-ctrl-btn ${showCustomers ? 'active' : ''}`}
            onClick={() => setShowCustomers(prev => !prev)}
            title="Toggle Customers"
            id="map-ctrl-customers"
          >
            <MdPeople /> Customers
          </button>
        )}

        {setShowPartners && (
          <button
            className={`map-ctrl-btn ${showPartners ? 'active' : ''}`}
            onClick={() => setShowPartners(prev => !prev)}
            title="Toggle Delivery Partners"
            id="map-ctrl-partners"
          >
            <MdDirectionsBike /> Partners
          </button>
        )}

        {setShowTerritories && (
          <button
            className={`map-ctrl-btn ${showTerritories ? 'active' : ''}`}
            onClick={() => setShowTerritories(prev => !prev)}
            title="Toggle Territories"
            id="map-ctrl-territories"
          >
            <MdMap /> Territories
          </button>
        )}

        {setShowRoutes && (
          <button
            className={`map-ctrl-btn ${showRoutes ? 'active' : ''}`}
            onClick={() => setShowRoutes(prev => !prev)}
            title="Toggle Route Lines"
            id="map-ctrl-routes"
          >
            <MdTimeline /> Routes
          </button>
        )}

        {setShowGeofences && (
          <button
            className={`map-ctrl-btn ${showGeofences ? 'active' : ''}`}
            onClick={() => setShowGeofences(prev => !prev)}
            title="Toggle Geofences"
            id="map-ctrl-geofences"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <MapPin size={13} /> Geofences
          </button>
        )}

        {setShowDeviations && (
          <button
            className={`map-ctrl-btn ${showDeviations ? 'active' : ''}`}
            onClick={() => setShowDeviations(prev => !prev)}
            title="Toggle Deviations"
            id="map-ctrl-deviations"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <AlertTriangle size={13} /> Deviations
          </button>
        )}

        {onResetView && (
          <button
            className="map-ctrl-btn reset-btn"
            onClick={onResetView}
            title="Reset Map View"
            id="map-ctrl-reset"
          >
            <MdCenterFocusWeak /> Reset View
          </button>
        )}

        {(onToggleExpand || onTogglePanel) && (
          <div style={{ margin: '6px 0 2px', borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {onToggleExpand && (
              <button
                className={`map-ctrl-btn ${isExpanded ? 'active' : ''}`}
                onClick={onToggleExpand}
                title={isExpanded ? 'Collapse Map' : 'Expand Map'}
                id="map-ctrl-expand"
              >
                {isExpanded ? <MdFullscreenExit /> : <MdFullscreen />}
                {isExpanded ? 'Collapse Map' : 'Expand Map'}
              </button>
            )}

            {onTogglePanel && (
              <button
                className={`map-ctrl-btn ${isPanelOpen ? 'active' : ''}`}
                onClick={onTogglePanel}
                title={isPanelOpen ? 'Hide Customers Panel' : 'Show Customers Panel'}
                id="map-ctrl-toggle-panel"
              >
                <MdViewSidebar />
                {isPanelOpen ? 'Hide Panel' : 'Customers Panel'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
