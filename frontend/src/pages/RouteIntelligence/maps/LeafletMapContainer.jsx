import React, { useState } from 'react';
import { MapContainer, TileLayer, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import LayerControl from './LayerControl.jsx';
import MapControls from './MapControls.jsx';
import MapLegend from './MapLegend.jsx';

export default function LeafletMapContainer({
  center = [13.0604, 80.2496],
  zoom = 12,
  bounds = null,
  height = 440,
  children,
  legendItems,
  showControls = true,
  showLegend = true,
  // Initial layer state props
  initialShowCustomers = true,
  initialShowPartners = true,
  initialShowTerritories = true,
  initialShowRoutes = true,
  // Callback when controls change
  onControlChange,
}) {
  const [showCustomers, setShowCustomers] = useState(initialShowCustomers);
  const [showPartners, setShowPartners] = useState(initialShowPartners);
  const [showTerritories, setShowTerritories] = useState(initialShowTerritories);
  const [showRoutes, setShowRoutes] = useState(initialShowRoutes);
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
  };

  return (
    <div className="leaflet-map-wrapper" style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
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
          onResetView={handleResetView}
        />
      )}

      {/* Floating Legend Overlay */}
      {showLegend && <MapLegend items={legendItems} />}
    </div>
  );
}
