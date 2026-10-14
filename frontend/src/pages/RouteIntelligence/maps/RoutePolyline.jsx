import React from 'react';
import { Polyline, Popup, Tooltip } from 'react-leaflet';

export default function RoutePolyline({
  coordinates,
  color = '#3b82f6',
  weight = 4,
  dashArray = null,
  opacity = 0.9,
  routeName,
  completed = false,
  isRouteCorridor = false,
  corridorTolerance = null,
  customerCount = null,
  assignedDp = null,
}) {
  if (!coordinates || coordinates.length < 2) return null;

  const roadPathOptions = {
    color: completed ? '#10b981' : color,
    weight,
    opacity,
    dashArray,
    lineCap: 'round',
    lineJoin: 'round',
  };

  const corridorPathOptions = {
    color,
    weight: Math.min(32, Math.max(16, (corridorTolerance || 120) / 6)),
    opacity: 0.18,
    lineCap: 'round',
    lineJoin: 'round',
  };

  return (
    <>
      {/* Visual Corridor Buffer (Rendered for Route-Corridor Geofenced routes) */}
      {isRouteCorridor && (
        <Polyline positions={coordinates} pathOptions={corridorPathOptions} />
      )}

      {/* Actual Road-Following Polyline */}
      <Polyline positions={coordinates} pathOptions={roadPathOptions}>
        {routeName && (
          <Tooltip sticky>
            <span style={{ fontWeight: 600, fontSize: 12 }}>
              {routeName} {isRouteCorridor ? `(Corridor ±${corridorTolerance || 120}m)` : ''}
            </span>
          </Tooltip>
        )}
        <Popup>
          <div style={{ padding: '4px 6px', minWidth: 200, fontFamily: 'var(--font-sans, system-ui)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: color }}>
                {isRouteCorridor ? 'Route Corridor Geofence' : 'Route Polyline'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: `${color}20`, color: color }}>
                {isRouteCorridor ? `±${corridorTolerance || 120}m Buffer` : 'Active'}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 2 }}>
              {routeName}
            </div>
            {assignedDp && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 2 }}>
                Assigned DP: <strong>{typeof assignedDp === 'string' ? assignedDp : assignedDp.name || 'Vijay Sethu'}</strong>
              </div>
            )}
            {customerCount !== null && (
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 4 }}>
                Customer Stops: <strong>{customerCount}</strong>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', borderTop: '1px solid #e2e8f0', paddingTop: 4, marginTop: 4 }}>
              {isRouteCorridor ? 'Road-following Corridor Compliance Enabled' : 'Standard Delivery Polyline'}
            </div>
          </div>
        </Popup>
      </Polyline>
    </>
  );
}
