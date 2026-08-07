import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';

export const createDpIcon = (status = 'active') => {
  const isDeviated = status === 'deviated';
  const colorClass = isDeviated ? 'red' : status === 'stopped' ? 'warning' : 'green';
  return L.divIcon({
    className: `custom-leaflet-marker dp-marker-wrap ${status}`,
    html: `<div class="marker-pin ${colorClass}"><span class="marker-icon-symbol">🛵</span><span class="marker-pulse-ring"></span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export const currentPosIcon = L.divIcon({
  className: 'custom-leaflet-marker current-pos-marker-wrap',
  html: `<div class="marker-pin blue"><span class="marker-icon-symbol">📍</span><span class="marker-pulse-ring blue"></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

export default function DeliveryPartnerMarker({ partner, isCurrentPos = false }) {
  if (!partner || !partner.lat || !partner.lng) return null;

  const icon = isCurrentPos ? currentPosIcon : createDpIcon(partner.status);

  return (
    <Marker position={[partner.lat, partner.lng]} icon={icon}>
      <Popup>
        <MarkerPopup
          title={partner.name}
          type={partner.type || 'Delivery Partner'}
          route={partner.route}
          status={partner.status || 'active'}
          lat={partner.lat}
          lng={partner.lng}
          extraInfo={partner.speed ? `Speed: ${partner.speed} | Deliveries: ${partner.deliveries || 'In Progress'}` : null}
        />
      </Popup>
    </Marker>
  );
}
