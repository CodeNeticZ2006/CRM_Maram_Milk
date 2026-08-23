import React from 'react';
import { StatusBadge } from '../components/index.jsx';

export default function MarkerPopup({ title, type, route, territory, status, isOutside, lat, lng, extraInfo }) {
  const formattedLat = !isNaN(parseFloat(lat)) ? parseFloat(lat).toFixed(5) : lat;
  const formattedLng = !isNaN(parseFloat(lng)) ? parseFloat(lng).toFixed(5) : lng;

  return (
    <div style={{ minWidth: 220, padding: '4px 2px', fontFamily: 'var(--font-sans, system-ui)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #94a3b8)', letterSpacing: '0.5px' }}>
          {type || 'Location'}
        </span>
        {isOutside ? (
          <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 10, border: '1px solid #fde68a' }}>
            Outside Territory
          </span>
        ) : (
          status && <StatusBadge status={status} />
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 4 }}>
        {title}
      </div>

      {route && (
        <div style={{ fontSize: 12, color: 'var(--primary, #3b82f6)', fontWeight: 600, marginBottom: 4 }}>
          📍 {route}
        </div>
      )}

      {territory && (
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
          🗺️ Territory: <strong>{territory}</strong>
        </div>
      )}

      {extraInfo && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 8, background: '#f8fafc', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          {extraInfo}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
        <span>Lat: {formattedLat}</span>
        <span>Lng: {formattedLng}</span>
      </div>
    </div>
  );
}
