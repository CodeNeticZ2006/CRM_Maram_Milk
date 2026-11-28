import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

function serializeBounds(b) {
  if (!b || !Array.isArray(b) || b.length < 2) return null;
  const [sw, ne] = b;
  if (!Array.isArray(sw) || !Array.isArray(ne) || sw.length < 2 || ne.length < 2) return null;
  const sw0 = Number(sw[0]), sw1 = Number(sw[1]), ne0 = Number(ne[0]), ne1 = Number(ne[1]);
  if (isNaN(sw0) || isNaN(sw1) || isNaN(ne0) || isNaN(ne1)) return null;
  return `${sw0.toFixed(4)},${sw1.toFixed(4)}:${ne0.toFixed(4)},${ne1.toFixed(4)}`;
}

function serializeCenter(c) {
  if (!c || !Array.isArray(c) || c.length < 2) return null;
  const lat = Number(c[0]), lng = Number(c[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Controller component using React-Leaflet's useMap hook.
 * Handles programmatic pan/zoom and resetting map bounds without fighting user interaction
 * or automatically zooming out when the user zooms in.
 */
export default function LayerControl({ center, zoom, bounds }) {
  const map = useMap();

  const lastBoundsKeyRef = useRef(null);
  const lastCenterKeyRef = useRef(null);
  const lastTargetZoomRef = useRef(zoom || 12);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (!map) return;

    const currentBoundsKey = serializeBounds(bounds);
    const currentCenterKey = serializeCenter(center);
    const targetZoom = zoom || 12;

    // Initial mount behavior (also triggered when remounted by resetKey on Reset View)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (currentBoundsKey) {
        lastBoundsKeyRef.current = currentBoundsKey;
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        } catch (err) {
          if (center) map.setView(center, targetZoom);
        }
      } else if (center) {
        lastCenterKeyRef.current = currentCenterKey;
        lastTargetZoomRef.current = targetZoom;
        map.setView(center, targetZoom);
      }
      return;
    }

    // Programmatic target bounds changed (e.g. user selected a specific area)
    if (currentBoundsKey) {
      if (currentBoundsKey !== lastBoundsKeyRef.current) {
        lastBoundsKeyRef.current = currentBoundsKey;
        lastCenterKeyRef.current = null;
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        } catch (err) {
          if (center) map.setView(center, targetZoom);
        }
      }
      return;
    }

    // If bounds were previously set but are now cleared (e.g. user toggled off area filter or clicked "All Areas")
    if (lastBoundsKeyRef.current !== null && !currentBoundsKey) {
      lastBoundsKeyRef.current = null;
      if (center) {
        lastCenterKeyRef.current = currentCenterKey;
        lastTargetZoomRef.current = targetZoom;
        map.flyTo(center, targetZoom, { duration: 0.6 });
      }
      return;
    }

    // Programmatic center changed (e.g. user clicked a delivery partner or alert)
    const centerChanged = currentCenterKey && currentCenterKey !== lastCenterKeyRef.current;
    const targetZoomChanged = zoom !== undefined && zoom !== lastTargetZoomRef.current;

    if (centerChanged) {
      lastCenterKeyRef.current = currentCenterKey;
      lastTargetZoomRef.current = targetZoom;
      // Fly to the new entity using requested targetZoom, or smoothly pan and preserve current zoom if zoom wasn't explicitly changed
      if (targetZoomChanged) {
        map.flyTo(center, targetZoom, { duration: 0.6 });
      } else {
        map.panTo(center, { animate: true, duration: 0.3 });
      }
    } else if (targetZoomChanged && !centerChanged) {
      // Zoom explicitly changed programmatically without center change
      lastTargetZoomRef.current = targetZoom;
      map.setZoom(targetZoom);
    }
  }, [center, zoom, bounds, map]);

  return null;
}
