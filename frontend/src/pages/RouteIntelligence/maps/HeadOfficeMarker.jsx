import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';

export const headOfficeIcon = L.divIcon({
  className: 'custom-leaflet-marker ho-marker-wrap',
  html: `<div class="marker-pin purple"><span class="marker-icon-symbol">🏢</span></div>`,
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
