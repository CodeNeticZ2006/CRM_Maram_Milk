import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';

export const createDpIcon = (status = 'active') => {
  const normStatus = (status || '').toUpperCase();
  let colorClass = 'green';
  let pulseRingColor = 'green';

  if (normStatus === 'RED' || status === 'deviated' || status === 'persistent_deviation' || status === 'breach') {
    colorClass = 'red';
    pulseRingColor = 'red';
  } else if (normStatus === 'YELLOW' || status === 'stopped' || status === 'warning' || status === 'temporary_deviation') {
    colorClass = 'warning';
    pulseRingColor = 'warning';
  } else {
    colorClass = 'green';
    pulseRingColor = 'green';
  }

  return L.divIcon({
    className: `custom-leaflet-marker dp-marker-wrap ${status}`,
    html: `<div class="marker-pin ${colorClass}"><span class="marker-icon-symbol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg></span><span class="marker-pulse-ring ${pulseRingColor}"></span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export const currentPosIcon = L.divIcon({
  className: 'custom-leaflet-marker current-pos-marker-wrap',
  html: `<div class="marker-pin blue"><span class="marker-icon-symbol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span><span class="marker-pulse-ring blue"></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

export default function DeliveryPartnerMarker({ partner, isCurrentPos = false }) {
  if (!partner) return null;

  // Source of Truth: Do not render mock coordinates if GPS is unavailable or missing
  if (partner.gpsStatus === 'unavailable' || partner.status === 'GPS unavailable') return null;

  const lat = parseFloat(partner.lat);
  const lng = parseFloat(partner.lng);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  const status = partner.corridorStatus || partner.status || 'GREEN';
  const icon = isCurrentPos ? currentPosIcon : createDpIcon(status);

  const extraParts = [];
  if (partner.corridorStatus) {
    extraParts.push(`Status: ${partner.corridorStatus}`);
  }
  if (partner.corridorDistanceMeters !== undefined && partner.corridorDistanceMeters !== null) {
    extraParts.push(`Corridor Offset: ${partner.corridorDistanceMeters}m (Tol: ±120m)`);
  }
  if (partner.speed) {
    extraParts.push(`Speed: ${partner.speed}`);
  }
  const lastTime = partner.lastUpdate || partner.last_ping || partner.timestamp;
  if (lastTime) {
    extraParts.push(`Latest GPS: ${lastTime}`);
  }

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup>
        <MarkerPopup
          title={partner.name}
          type={partner.type || 'Delivery Partner'}
          route={partner.route ? `Assigned Route: ${partner.route}` : 'Unassigned'}
          status={status}
          lat={lat}
          lng={lng}
          extraInfo={extraParts.length > 0 ? extraParts.join(' • ') : null}
        />
      </Popup>
    </Marker>
  );
}

