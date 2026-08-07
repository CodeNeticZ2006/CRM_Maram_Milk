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
  if (!customer || !customer.lat || !customer.lng) return null;

  return (
    <Marker position={[customer.lat, customer.lng]} icon={customerIcon}>
      <Popup>
        <MarkerPopup
          title={customer.name}
          type={customer.type || 'Customer'}
          route={customer.route}
          status={customer.status || 'Active'}
          lat={customer.lat}
          lng={customer.lng}
          extraInfo={customer.address ? `Address: ${customer.address} (Wallet: ${customer.wallet || '₹0'})` : null}
        />
      </Popup>
    </Marker>
  );
}
