import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';

export const customerIcon = L.divIcon({
  className: 'custom-leaflet-marker customer-marker-wrap',
  html: `<div class="marker-pin orange"><span class="marker-icon-symbol">🏠</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

export default function CustomerMarker({ customer }) {
  if (!customer) return null;
  const lat = parseFloat(customer.lat);
  const lng = parseFloat(customer.lng);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  const routeName = customer.route_name || customer.route || 'Unassigned';
  const code = customer.customer_code || customer.code || '';
  const address = customer.address || 'Address unavailable';

  return (
    <Marker position={[lat, lng]} icon={customerIcon}>
      <Popup>
        <MarkerPopup
          title={customer.name}
          type={code ? `Customer • ${code}` : 'Customer'}
          route={`Route: ${routeName}`}
          status={customer.status || 'Active'}
          lat={lat}
          lng={lng}
          extraInfo={`Address: ${address}`}
        />
      </Popup>
    </Marker>
  );
}
