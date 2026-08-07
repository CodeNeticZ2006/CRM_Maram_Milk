import React from 'react';
import { Polyline, Popup, Tooltip } from 'react-leaflet';

export default function RoutePolyline({
  coordinates,
  color = '#3b82f6',
  weight = 4,
  dashArray = null,
  opacity = 0.85,
  routeName,
  completed = false,
}) {
  if (!coordinates || coordinates.length < 2) return null;

  const pathOptions = {
    color: completed ? '#10b981' : color,
    weight,
    opacity,
    dashArray,
    lineCap: 'round',
    lineJoin: 'round',
  };

  return (
    <Polyline positions={coordinates} pathOptions={pathOptions}>
      {routeName && (
        <Tooltip sticky>
          <span style={{ fontWeight: 600, fontSize: 12 }}>
            {completed ? '✅ Completed Segment' : `📍 ${routeName}`}
          </span>
        </Tooltip>
      )}
      {routeName && (
        <Popup>
          <div style={{ padding: '2px 4px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              {routeName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
              Status: {completed ? 'Completed' : 'Active Route Polyline'}
            </div>
          </div>
        </Popup>
      )}
    </Polyline>
  );
}
