import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';
import { getAreaColor } from '../utils/areaPalette.js';

// Icon cache for different route colors
const iconCache = {};

export const getCustomerIcon = (routeName = '', customColor = null) => {
  const color = customColor || getAreaColor(routeName, '#f59e0b');
  const cacheKey = color.toLowerCase();

  if (!iconCache[cacheKey]) {
    iconCache[cacheKey] = L.divIcon({
      className: `custom-leaflet-marker customer-marker-wrap`,
      html: `<div class="marker-pin" style="background-color: ${color} !important; border-color: ${color} !important;"><span class="marker-icon-symbol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  }
  return iconCache[cacheKey];
};

export const customerIcon = getCustomerIcon();

export default function CustomerMarker({ customer, selectedRouteFilter, position }) {
  if (!customer) return null;

  // Source of Truth: Customer coordinates (with optional spiderfy offset for duplicates)
  const baseLat = parseFloat(customer.lat);
  const baseLng = parseFloat(customer.lng);
  if (isNaN(baseLat) || isNaN(baseLng) || baseLat === 0 || baseLng === 0) return null;

  const lat = position ? position[0] : (customer.spiderfyLat || baseLat);
  const lng = position ? position[1] : (customer.spiderfyLng || baseLng);

  const routeName = customer.route_name || customer.area || customer.assigned_route_id || customer.route || 'Unassigned';
  const code = customer.customer_code || customer.customerId || customer.code || '';
  const address = customer.address || 'Address unavailable';
  const territory = customer.territory || customer.zone || 'Central Chennai';
  const pinColor = customer.areaColor || customer.color || getAreaColor(routeName, '#2563eb');

  // Determine if customer is outside the currently selected route/territory filter
  const isOutside = Boolean(
    selectedRouteFilter &&
    selectedRouteFilter !== 'All' &&
    selectedRouteFilter !== 'All Routes' &&
    selectedRouteFilter !== 'All 5 Areas' &&
    selectedRouteFilter !== 'All two routes' &&
    routeName.toLowerCase().trim() !== selectedRouteFilter.toLowerCase().trim() &&
    !routeName.toLowerCase().includes(selectedRouteFilter.toLowerCase().split(' ')[0])
  );

  return (
    <Marker position={[lat, lng]} icon={getCustomerIcon(routeName, pinColor)}>
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
