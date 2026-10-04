import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';

export const headOfficeIcon = L.divIcon({
  className: 'custom-leaflet-marker ho-marker-wrap',
  html: `<div class="marker-pin purple"><span class="marker-icon-symbol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

export default function HeadOfficeMarker({ office }) {
  if (!office || !office.lat || !office.lng) return null;

  return (
    <Marker position={[office.lat, office.lng]} icon={headOfficeIcon}>
      <Popup>
        <MarkerPopup
          title={office.name}
          type={office.type || 'Head Office'}
          status={office.status || 'Operational'}
          lat={office.lat}
          lng={office.lng}
          extraInfo={office.address || office.phone}
        />
      </Popup>
    </Marker>
  );
}
