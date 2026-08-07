import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Controller component using React-Leaflet's useMap hook.
 * Handles programmatic pan/zoom and resetting map bounds.
 */
export default function LayerControl({ center, zoom, bounds }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (bounds && bounds.length >= 2) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } catch (err) {
        // Fallback to center/zoom if bounds fit fails
        if (center) map.setView(center, zoom || 12);
      }
    } else if (center) {
      map.setView(center, zoom || 12);
    }
  }, [center, zoom, bounds, map]);

  return null;
}
