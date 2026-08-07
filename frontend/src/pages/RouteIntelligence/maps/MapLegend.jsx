import React, { useState } from 'react';
import { MdLayers, MdChevronRight, MdExpandMore } from 'react-icons/md';

export default function MapLegend({ items }) {
  const [collapsed, setCollapsed] = useState(false);

  const defaultItems = [
    { label: 'Head Office',      color: '#8b5cf6', icon: '🏢' },
    { label: 'Delivery Partner', color: '#10b981', icon: '🛵' },
    { label: 'Customer',         color: '#f59e0b', icon: '🏠' },
    { label: 'Assigned Route',   color: '#3b82f6', icon: '➖' },
    { label: 'Completed Route',  color: '#64748b', icon: '➖' },
  ];

  const legendList = items || defaultItems;

  return (
    <div className="leaflet-floating-legend">
      <div
        className="legend-header"
        onClick={() => setCollapsed(prev => !prev)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}>
          <MdLayers style={{ color: 'var(--primary, #3b82f6)', fontSize: 15 }} />
          <span>Map Legend</span>
        </div>
        {collapsed ? <MdChevronRight style={{ fontSize: 16 }} /> : <MdExpandMore style={{ fontSize: 16 }} />}
      </div>

      {!collapsed && (
        <div className="legend-body" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {legendList.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-secondary, #475569)' }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: item.shape === 'circle' ? '50%' : 3,
                  background: item.color,
                  display: 'inline-block',
                  flexShrink: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              />
              <span style={{ fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
