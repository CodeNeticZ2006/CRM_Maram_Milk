import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';

// Icon cache for different route colors
const iconCache = {};

export const getCustomerIcon = (routeName = '') => {
  const lower = (routeName || '').toLowerCase().trim();
  let color = 'orange'; // default for other routes

  if (lower.includes('nungambakkam')) {
    color = 'blue';  // Requirement 3: Blue for Nungambakkam 1
  } else if (lower.includes('triplicane')) {
    color = 'green'; // Requirement 3: Green for Triplicane 1
  }

  if (!iconCache[color]) {
    iconCache[color] = L.divIcon({
      className: `custom-leaflet-marker customer-marker-wrap customer-${color}`,
      html: `<div class="marker-pin ${color}"><span class="marker-icon-symbol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  }
  return iconCache[color];
};

export const customerIcon = getCustomerIcon();

export default function CustomerMarker({ customer, selectedRouteFilter }) {
  if (!customer) return null;

  // Source of Truth: Customer database coordinates
  const lat = parseFloat(customer.lat);
  const lng = parseFloat(customer.lng);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  const routeName = customer.route_name || customer.assigned_route_id || customer.route || 'Unassigned';
  const code = customer.customer_code || customer.code || '';
  const address = customer.address || 'Address unavailable';
  const territory = customer.territory || customer.zone || 'Central Chennai';

  // Determine if customer is outside the currently selected route/territory filter
  const isOutside = Boolean(
    selectedRouteFilter &&
    selectedRouteFilter !== 'All' &&
    selectedRouteFilter !== 'All Routes' &&
    selectedRouteFilter !== 'All two routes' &&
    routeName.toLowerCase().trim() !== selectedRouteFilter.toLowerCase().trim()
  );

  return (
    <Marker position={[lat, lng]} icon={getCustomerIcon(routeName)}>
      <Popup>
        <MarkerPopup
          title={customer.name}
          type={code ? `Customer • ${code}` : 'Customer'}
          route={`Assigned Route: ${routeName}`}
          territory={territory}
          status={customer.status || 'Active'}
          isOutside={isOutside}
          lat={lat}
          lng={lng}
          extraInfo={`Address: ${address}`}
        />
      </Popup>
    </Marker>
  );
}

