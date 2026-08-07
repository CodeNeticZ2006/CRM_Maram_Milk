import React from 'react';
import { Polygon, Circle, Popup, Tooltip } from 'react-leaflet';

export default function RoutePolygon({
  type = 'polygon', // 'polygon' | 'circle'
  coordinates, // polygon coordinates array or circle center [lat, lng]
  radius = 500, // circle radius in meters
  color = '#3b82f6',
  fillColor = '#3b82f6',
  fillOpacity = 0.15,
  weight = 2,
  dashArray = '5, 5',
  title,
  subtitle,
  status,
}) {
  const pathOptions = {
    color,
    fillColor: fillColor || color,
    fillOpacity,
    weight,
    dashArray,
  };

  if (type === 'circle' && coordinates) {
    return (
      <Circle center={coordinates} radius={radius} pathOptions={pathOptions}>
        {title && (
          <Tooltip sticky>
            <span style={{ fontWeight: 600, fontSize: 12 }}>🛡️ {title}</span>
          </Tooltip>
        )}
        {title && (
          <Popup>
            <div style={{ padding: '2px 4px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                {title}
              </div>
              {subtitle && <div style={{ fontSize: 12, color: 'var(--primary, #3b82f6)', marginTop: 2 }}>{subtitle}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
                Radius: {radius}m | Status: {status || 'Active'}
              </div>
            </div>
          </Popup>
        )}
      </Circle>
    );
  }

  if (type === 'polygon' && coordinates && coordinates.length >= 3) {
    return (
      <Polygon positions={coordinates} pathOptions={pathOptions}>
        {title && (
          <Tooltip sticky>
            <span style={{ fontWeight: 600, fontSize: 12 }}>🗺️ {title}</span>
          </Tooltip>
        )}
        {title && (
          <Popup>
            <div style={{ padding: '2px 4px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                {title}
              </div>
              {subtitle && <div style={{ fontSize: 12, color: 'var(--primary, #3b82f6)', marginTop: 2 }}>{subtitle}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
                Territory Boundary | Status: {status || 'Active'}
              </div>
            </div>
          </Popup>
        )}
      </Polygon>
    );
  }

  return null;
}
