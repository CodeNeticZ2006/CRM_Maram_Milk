import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * MapResizeHandler
 * Listens to map dimension changes (expanding/collapsing map, opening/closing customer panel,
 * height changes, and window resizing) and reliably calls `map.invalidateSize()`
 * so that Leaflet recalculates viewport bounds and renders all tiles without gray gaps.
 */
export default function MapResizeHandler({ isExpanded, isPanelOpen, height }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Immediate recalculation
    map.invalidateSize({ pan: false });

    // Staggered recalculations to match CSS grid / panel transitions (100ms, 250ms, 450ms)
    const t1 = setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 100);

    const t2 = setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 250);

    const t3 = setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 450);

    const onWindowResize = () => {
      map.invalidateSize({ pan: false });
    };

    window.addEventListener('resize', onWindowResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', onWindowResize);
    };
  }, [map, isExpanded, isPanelOpen, height]);

  return null;
}
