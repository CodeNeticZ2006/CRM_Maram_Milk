/**
 * Route Lane Offset Utility (Render-Only Effect)
 *
 * Implements parallel lane rendering for overlapping routes sharing the same road.
 * Offsets lines in SCREEN PIXELS so lanes remain parallel, distinct, and readable
 * across all zoom levels. Deviation distance and corridor bounds continue to be
 * computed against the original centerline.
 */

const CANONICAL_AREA_ORDER = [
  'Nungambakkam 1',
  'Triplicane 1',
  'Teynampet 1',
  'Mandaveli 2',
  'Royapettah 2',
];

const CANONICAL_ID_ORDER = [
  '1b4a924f-1a3c-4658-9e23-a2a060917ac2', // Nungambakkam 1
  '9835f558-456c-423f-985b-f21b981172d6', // Triplicane 1
  '59311df6-345e-47d8-97c6-f71c0f64e1eb', // Teynampet 1
  '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9', // Mandaveli 2
  '9f3ffe40-d485-4995-9dd0-ac74735c6402', // Royapettah 2
];

/**
 * Returns stable sort rank for a route based on areaConfig order
 */
function getAreaRank(route) {
  if (!route) return 999;
  const id = String(route.id || '').toLowerCase();
  const name = String(route.name || '').toLowerCase();

  const idIdx = CANONICAL_ID_ORDER.findIndex(k => k.toLowerCase() === id);
  if (idIdx >= 0) return idIdx;

  const nameIdx = CANONICAL_AREA_ORDER.findIndex(n => name.includes(n.toLowerCase().split(' ')[0]));
  if (nameIdx >= 0) return nameIdx;

  return 99;
}

/**
 * Standard Web Mercator projection (lat, lng) => screen pixel (x, y) at given zoom
 */
function project(lat, lng, zoom) {
  const d = Math.PI / 180;
  const max = 85.0511287798;
  const latClamped = Math.max(Math.min(max, lat), -max);
  const sin = Math.sin(latClamped * d);
  const scale = 256 * Math.pow(2, zoom);
  const x = scale * (lng + 180) / 360;
  const y = scale * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI));
  return { x, y };
}

/**
 * Standard Web Mercator unproject screen pixel (x, y) => [lat, lng] at given zoom
 */
function unproject(x, y, zoom) {
  const scale = 256 * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lat, lng];
}

/**
 * Fast equirectangular distance in meters between two coordinates
 */
function groundDistanceMeters(lat1, lng1, lat2, lng2) {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lng2 - lng1) * (Math.PI / 180) * 6371000 * Math.cos(midLat);
  const dy = (lat2 - lat1) * (Math.PI / 180) * 6371000;
  return Math.hypot(dx, dy);
}

/**
 * Step 1: Resample polyline into short segments (~20-25m)
 */
function resamplePolyline(coords, stepMeters = 25) {
  if (!coords || coords.length < 2) return coords ? coords.map(c => [c[0], c[1]]) : [];
  const resampled = [[coords[0][0], coords[0][1]]];

  for (let i = 0; i < coords.length - 1; i++) {
    const lat1 = coords[i][0];
    const lng1 = coords[i][1];
    const lat2 = coords[i + 1][0];
    const lng2 = coords[i + 1][1];
    const dist = groundDistanceMeters(lat1, lng1, lat2, lng2);

    if (dist > stepMeters) {
      const numSegments = Math.ceil(dist / stepMeters);
      for (let s = 1; s < numSegments; s++) {
        const t = s / numSegments;
        resampled.push([
          lat1 + (lat2 - lat1) * t,
          lng1 + (lng2 - lng1) * t,
        ]);
      }
    }
    resampled.push([lat2, lng2]);
  }
  return resampled;
}

/**
 * Calculate bearing angle in degrees for segment from A to B
 */
function calculateSegmentBearing(lat1, lng1, lat2, lng2) {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lng2 - lng1) * Math.cos(midLat);
  const dy = lat2 - lat1;
  const rad = Math.atan2(dx, dy);
  return (rad * 180 / Math.PI + 360) % 360;
}

/**
 * Check if two segments share the same road corridor:
 * Within ~15m distance and within ~30 degrees bearing (same or opposite direction).
 */
function segmentsShareRoad(segA, segB, maxDistMeters = 15, maxAngleDeg = 30) {
  // Compare midpoint distance
  const dist = groundDistanceMeters(segA.mid[0], segA.mid[1], segB.mid[0], segB.mid[1]);
  if (dist > maxDistMeters) return false;

  // Angular difference modulo 180 to handle opposite directions
  let diff = Math.abs(segA.bearing - segB.bearing) % 360;
  if (diff > 180) diff = 360 - diff;
  const orientationDiff = diff > 90 ? Math.abs(180 - diff) : diff;

  return orientationDiff <= maxAngleDeg;
}

/**
 * Smooth transition: 5-tap Gaussian-like filter over raw pixel offset values
 */
function smoothOffsets(rawOffsets) {
  const n = rawOffsets.length;
  if (n <= 2) return rawOffsets;
  const smoothed = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let weightSum = 0;
    for (let w = -2; w <= 2; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < n) {
        const weight = w === 0 ? 0.38 : (Math.abs(w) === 1 ? 0.24 : 0.07);
        sum += rawOffsets[idx] * weight;
        weightSum += weight;
      }
    }
    smoothed[i] = sum / weightSum;
  }
  return smoothed;
}

/**
 * Computes parallel lane offset polylines for active routes.
 *
 * @param {Array} routes - Array of route objects [{ id, name, color, polyline }, ...]
 * @param {number} zoom - Map zoom level (integer or float)
 * @param {Object} options - Customization parameters
 * @returns {Array} routes with new `lanePolyline` property (and preserved original `polyline`)
 */
function computeRouteLaneOffsets(routes, zoom = 13, options = {}) {
  const {
    laneSpacingPx = 5.5,    // 5-6px spacing between lane centerlines
    matchDistanceMeters = 15, // Segments within 15m share a road
    bearingToleranceDeg = 30, // Bearing within 30 deg
    stepMeters = 25,         // Segment resampling interval (20-30m)
  } = options;

  if (!routes || routes.length === 0) return [];

  // Filter to routes with valid polylines
  const activeRoutes = routes.filter(r => {
    const pts = r.polyline || r.roadCoordinates || r.coordinates;
    return pts && pts.length >= 2;
  });

  if (activeRoutes.length <= 1) {
    // Lone line gets zero offset
    return routes.map(r => ({
      ...r,
      lanePolyline: r.polyline || r.roadCoordinates || r.coordinates,
      originalPolyline: r.polyline || r.roadCoordinates || r.coordinates,
      offsetApplied: false,
    }));
  }

  // 1. Resample each route into short segments and extract midpoints & bearings
  const routeSegments = activeRoutes.map(r => {
    const rawCoords = r.polyline || r.roadCoordinates || r.coordinates;
    const resampled = resamplePolyline(rawCoords, stepMeters);
    const segments = [];

    for (let i = 0; i < resampled.length - 1; i++) {
      const p1 = resampled[i];
      const p2 = resampled[i + 1];
      const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const bearing = calculateSegmentBearing(p1[0], p1[1], p2[0], p2[1]);
      segments.push({ p1, p2, mid, bearing, segIdx: i });
    }

    return {
      route: r,
      id: r.id,
      name: r.name,
      rank: getAreaRank(r),
      points: resampled,
      segments,
    };
  });

  // 2. For every segment of every route, find other areas' segments sharing the road
  routeSegments.forEach(rA => {
    rA.segmentLanes = rA.segments.map(segA => {
      // Find all routes that have a matching segment
      const sharingRoutes = [rA];

      routeSegments.forEach(rB => {
        if (rB.id === rA.id) return;
        const hasMatch = rB.segments.some(segB =>
          segmentsShareRoad(segA, segB, matchDistanceMeters, bearingToleranceDeg)
        );
        if (hasMatch) {
          sharingRoutes.push(rB);
        }
      });

      // Stable sort by areaConfig order
      sharingRoutes.sort((a, b) => a.rank - b.rank);

      const laneCount = sharingRoutes.length;
      const laneIndex = sharingRoutes.findIndex(s => s.id === rA.id);

      return {
        laneCount,
        laneIndex,
        // Formula: (laneIndex - (laneCount - 1) / 2) * laneSpacing
        offsetPx: laneCount > 1 ? (laneIndex - (laneCount - 1) / 2) * laneSpacingPx : 0,
      };
    });
  });

  // 3. Convert segment offsets to vertex offsets, apply smooth transition tapering, and project
  const offsetResults = routeSegments.map(rData => {
    const pts = rData.points;
    const numPts = pts.length;
    const rawPixelOffsets = new Array(numPts).fill(0);

    for (let i = 0; i < numPts; i++) {
      if (i === 0) {
        rawPixelOffsets[i] = rData.segmentLanes[0]?.offsetPx || 0;
      } else if (i === numPts - 1) {
        rawPixelOffsets[i] = rData.segmentLanes[rData.segmentLanes.length - 1]?.offsetPx || 0;
      } else {
        const off1 = rData.segmentLanes[i - 1]?.offsetPx || 0;
        const off2 = rData.segmentLanes[i]?.offsetPx || 0;
        rawPixelOffsets[i] = (off1 + off2) / 2;
      }
    }

    // Step 6: Smooth transitions (tapering over first/last 2-3 segments)
    const smoothedPixelOffsets = smoothOffsets(rawPixelOffsets);

    // Apply offset in screen pixels and unproject back to [lat, lng]
    const lanePolyline = [];

    for (let i = 0; i < numPts; i++) {
      const curLat = pts[i][0];
      const curLng = pts[i][1];
      const offsetVal = smoothedPixelOffsets[i];

      if (Math.abs(offsetVal) < 0.05) {
        lanePolyline.push([curLat, curLng]);
        continue;
      }

      // Determine local direction vector in screen pixels
      let pPrev, pNext;
      if (i === 0) {
        pPrev = project(curLat, curLng, zoom);
        pNext = project(pts[i + 1][0], pts[i + 1][1], zoom);
      } else if (i === numPts - 1) {
        pPrev = project(pts[i - 1][0], pts[i - 1][1], zoom);
        pNext = project(curLat, curLng, zoom);
      } else {
        pPrev = project(pts[i - 1][0], pts[i - 1][1], zoom);
        pNext = project(pts[i + 1][0], pts[i + 1][1], zoom);
      }

      let vx = pNext.x - pPrev.x;
      let vy = pNext.y - pPrev.y;

      // Step 4: Direction Normalization
      // Ensure SAME direction convention for all areas so lanes do not cross
      if (vx < 0 || (Math.abs(vx) < 1e-9 && vy < 0)) {
        vx = -vx;
        vy = -vy;
      }

      const len = Math.hypot(vx, vy);
      if (len < 1e-6) {
        lanePolyline.push([curLat, curLng]);
        continue;
      }

      const ux = vx / len;
      const uy = vy / len;

      // Perpendicular normal vector: 90 degrees counter-clockwise
      const nx = -uy;
      const ny = ux;

      const pCur = project(curLat, curLng, zoom);
      const shiftedX = pCur.x + offsetVal * nx;
      const shiftedY = pCur.y + offsetVal * ny;

      const [newLat, newLng] = unproject(shiftedX, shiftedY, zoom);
      lanePolyline.push([newLat, newLng]);
    }

    return {
      ...rData.route,
      lanePolyline,
      originalPolyline: rData.route.polyline || rData.route.roadCoordinates || rData.route.coordinates,
      offsetApplied: smoothedPixelOffsets.some(o => Math.abs(o) > 0.1),
    };
  });

  // Map back to original route order
  return routes.map(orig => {
    const found = offsetResults.find(r => r.id === orig.id);
    return found || orig;
  });
}

export {
  computeRouteLaneOffsets,
  resamplePolyline,
  segmentsShareRoad,
  groundDistanceMeters,
  calculateSegmentBearing,
  project,
  unproject,
  CANONICAL_AREA_ORDER,
  CANONICAL_ID_ORDER,
  getAreaRank,
};
export default computeRouteLaneOffsets;
