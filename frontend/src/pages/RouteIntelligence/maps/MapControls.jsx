import React from 'react';
import {
  MdPeople, MdDirectionsBike, MdMap, MdTimeline,
  MdCenterFocusWeak, MdFilterList
} from 'react-icons/md';

export default function MapControls({
  showCustomers,
  setShowCustomers,
  showPartners,
  setShowPartners,
  showTerritories,
  setShowTerritories,
  showRoutes,
  setShowRoutes,
  onResetView
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
      </div>
    </div>
  );
}
