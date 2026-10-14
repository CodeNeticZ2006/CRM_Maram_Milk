import React, { useState } from 'react';
import { MapContainer, TileLayer, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import LayerControl from './LayerControl.jsx';
import MapControls from './MapControls.jsx';
import MapLegend from './MapLegend.jsx';
import MapResizeHandler from './MapResizeHandler.jsx';

export default function LeafletMapContainer({
  center = [13.0604, 80.2496],
  zoom = 12,
  bounds = null,
  height = 680,
  children,
  legendItems,
  showControls = true,
  showLegend = true,
  // Expand / Panel toggle props
  isExpanded = false,
  onToggleExpand,
  isPanelOpen = false,
  onTogglePanel,
  // Initial layer state props
  initialShowCustomers = true,
  initialShowPartners = true,
  initialShowTerritories = true,
  initialShowRoutes = true,
  initialShowGeofences = true,
  initialShowDeviations = true,
  // Callback when controls change
  onControlChange,
}) {
  const [showCustomers, setShowCustomers] = useState(initialShowCustomers);
  const [showPartners, setShowPartners] = useState(initialShowPartners);
  const [showTerritories, setShowTerritories] = useState(initialShowTerritories);
  const [showRoutes, setShowRoutes] = useState(initialShowRoutes);
  const [showGeofences, setShowGeofences] = useState(initialShowGeofences);
  const [showDeviations, setShowDeviations] = useState(initialShowDeviations);
  const [resetKey, setResetKey] = useState(0);

  const handleResetView = () => {
    setResetKey(prev => prev + 1);
  };

  // State object to pass to children function if function child is passed
  const layerState = {
    showCustomers,
    showPartners,
    showTerritories,
    showRoutes,
    showGeofences,
    showDeviations,
  };

  const containerHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={`leaflet-map-wrapper ${isExpanded ? 'map-expanded' : ''}`} style={{ height: containerHeight, width: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <ScaleControl position="bottomleft" imperial={false} />

        {/* Automatic map invalidation / resizing handler */}
        <MapResizeHandler isExpanded={isExpanded} isPanelOpen={isPanelOpen} height={height} />

        {/* View controller for dynamic center/zoom reset */}
        <LayerControl key={resetKey} center={center} zoom={zoom} bounds={bounds} />

        {/* Render children (Layer components) */}
        {typeof children === 'function' ? children(layerState) : children}
      </MapContainer>

      {/* Floating Controls Overlay */}
      {showControls && (
        <MapControls
          showCustomers={showCustomers}
          setShowCustomers={setShowCustomers}
          showPartners={showPartners}
          setShowPartners={setShowPartners}
          showTerritories={showTerritories}
          setShowTerritories={setShowTerritories}
          showRoutes={showRoutes}
          setShowRoutes={setShowRoutes}
          showGeofences={showGeofences}
          setShowGeofences={setShowGeofences}
          showDeviations={showDeviations}
          setShowDeviations={setShowDeviations}
          onResetView={handleResetView}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          isPanelOpen={isPanelOpen}
          onTogglePanel={onTogglePanel}
        />
      )}

      {/* Floating Legend Overlay */}
      {showLegend && <MapLegend items={legendItems} />}
    </div>
  );
}
