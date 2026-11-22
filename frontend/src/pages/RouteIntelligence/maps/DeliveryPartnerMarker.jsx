import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import MarkerPopup from './MarkerPopup.jsx';
import { getAreaColor } from '../utils/areaPalette.js';

export const createDpIcon = (status = 'active', areaColor = null, initials = null, heading = null, isSimulated = false) => {
  const normStatus = (status || '').toUpperCase();
  let ringColor = 'green';

  if (normStatus === 'RED' || status === 'deviated' || status === 'persistent_deviation' || status === 'breach') {
    ringColor = 'red';
  } else if (normStatus === 'YELLOW' || status === 'stopped' || status === 'warning' || status === 'temporary_deviation') {
    ringColor = 'warning';
  } else if (normStatus === 'OUTSIDE WINDOW' || status === 'Outside Window' || status === 'Off Duty') {
    ringColor = 'outside-window';
  } else {
    ringColor = 'green';
  }

  const safeColor = areaColor || '#2563eb';
  const rotDeg = heading !== undefined && heading !== null && !isNaN(Number(heading)) ? Number(heading) : 0;
  const simBadgeHtml = isSimulated ? `<span class="marker-sim-badge">SIM</span>` : '';
  const initialsHtml = initials ? `<span class="marker-dp-initials-badge">${initials}</span>` : '';

  // Top-down bike/scooter SVG (area color fill + heading rotation)
  const bikeSvg = `
    <svg width="26" height="26" viewBox="0 0 32 32" class="dp-bike-svg" style="transform: rotate(${rotDeg}deg);">
      <!-- Front Wheel -->
      <rect x="14" y="2" width="4" height="6" rx="2" fill="#0f172a"/>
      <!-- Handlebars -->
      <line x1="8" y1="8" x2="24" y2="8" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Mirrors -->
      <circle cx="7" cy="7" r="1.5" fill="#64748b"/>
      <circle cx="25" cy="7" r="1.5" fill="#64748b"/>
      <!-- Scooter Main Chassis (Area Color Fill) -->
      <path d="M12 9 C11 14 11 19 12 24 C13 25.5 19 25.5 20 24 C21 19 21 14 20 9 Z" fill="${safeColor}" stroke="#ffffff" stroke-width="1.2"/>
      <!-- Rider Helmet -->
      <circle cx="16" cy="15" r="3.2" fill="#0f172a"/>
      <circle cx="16" cy="15" r="2.2" fill="#ffffff" fill-opacity="0.35"/>
      <!-- Rear Wheel -->
      <rect x="14" y="24" width="4" height="6" rx="2" fill="#0f172a"/>
    </svg>
  `;

  return L.divIcon({
    className: `custom-leaflet-marker dp-bike-marker-wrap ${status}`,
    html: `
      <div class="dp-bike-marker-container">
        <span class="marker-pulse-ring ${ringColor}"></span>
        ${bikeSvg}
        ${initialsHtml}
        ${simBadgeHtml}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

export const currentPosIcon = L.divIcon({
  className: 'custom-leaflet-marker current-pos-marker-wrap',
  html: `<div class="marker-pin blue"><span class="marker-icon-symbol"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span><span class="marker-pulse-ring blue"></span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

export default function DeliveryPartnerMarker({ partner, isCurrentPos = false, ...props }) {
  if (!partner) return null;

  // Source of Truth: Do not render mock coordinates if GPS is unavailable or missing
  if (partner.gpsStatus === 'unavailable' || partner.status === 'GPS unavailable') return null;

  const lat = parseFloat(partner.lat);
  const lng = parseFloat(partner.lng);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  const status = partner.corridorStatus || partner.status || 'GREEN';
  const initials = partner.initials || (partner.name ? partner.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : (partner.dpCode || 'DP'));
  const areaColor = partner.areaColor || partner.color || getAreaColor(partner.route);

  const heading = partner.heading ?? partner.bearing ?? partner.lastGps?.heading ?? partner.lastGps?.bearing ?? null;
  const isSimulated = partner.source === 'simulator' || partner.isSimulated || false;
  const icon = isCurrentPos ? currentPosIcon : createDpIcon(status, areaColor, initials, heading, isSimulated);

  const extraParts = [];
  if (partner.route) {
    extraParts.push(`Area: ${partner.route}`);
  }
  if (partner.corridorStatus) {
    extraParts.push(`Status: ${partner.corridorStatus}`);
  }
  if (partner.distanceFromRouteMeters !== undefined && partner.distanceFromRouteMeters !== null) {
    extraParts.push(`Offset: ${partner.distanceFromRouteMeters}m`);
  }
  if (partner.speed) {
    extraParts.push(`Speed: ${partner.speed} km/h`);
  }
  const lastTime = partner.lastUpdate || partner.last_ping || partner.timestamp;
  if (lastTime) {
    extraParts.push(`Last GPS: ${lastTime}`);
  }

  return (
    <Marker position={[lat, lng]} icon={icon} {...props}>
      <Popup>
        <MarkerPopup
          title={`${partner.name} (${initials})`}
          type={partner.type || `DP • ${partner.dpCode || 'Assigned'}`}
          route={partner.route ? `Assigned Area: ${partner.route}` : 'Unassigned'}
          status={status}
          lat={lat}
          lng={lng}
          extraInfo={extraParts.length > 0 ? extraParts.join(' • ') : null}
        />
      </Popup>
    </Marker>
  );
}
