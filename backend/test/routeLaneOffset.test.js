const test = require('node:test');
const assert = require('node:assert/strict');

// Asynchronous dynamic import for ES module in Node.js test runner
const getLaneOffsetUtils = async () => {
  return await import('../../frontend/src/pages/RouteIntelligence/utils/routeLaneOffset.js');
};

test('routeLaneOffset 1: A lone line gets zero offset', async () => {
  const { computeRouteLaneOffsets } = await getLaneOffsetUtils();
  const loneRoute = [
    {
      id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2',
      name: 'Nungambakkam 1',
      polyline: [
        [13.0600, 80.2400],
        [13.0600, 80.2500],
      ],
    },
  ];

  const result = computeRouteLaneOffsets(loneRoute, 14);
  assert.equal(result.length, 1);
  const orig = loneRoute[0].polyline;
  const lane = result[0].lanePolyline;

  assert.equal(lane.length, orig.length);
  for (let i = 0; i < orig.length; i++) {
    assert.ok(
      Math.abs(lane[i][0] - orig[i][0]) < 1e-6,
      `Lone line point ${i} lat shifted unexpectedly`
    );
    assert.ok(
      Math.abs(lane[i][1] - orig[i][1]) < 1e-6,
      `Lone line point ${i} lng shifted unexpectedly`
    );
  }
});

test('routeLaneOffset 2: Two lines sharing a stretch get different offsets', async () => {
  const { computeRouteLaneOffsets, groundDistanceMeters } = await getLaneOffsetUtils();
  // Shared east-west stretch from [13.0600, 80.2400] to [13.0600, 80.2500]
  const routeA = {
    id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', // Nungambakkam 1 (Rank 0)
    name: 'Nungambakkam 1',
    polyline: [
      [13.0600, 80.2400],
      [13.0600, 80.2500],
    ],
  };
  const routeB = {
    id: '9835f558-456c-423f-985b-f21b981172d6', // Triplicane 1 (Rank 1)
    name: 'Triplicane 1',
    polyline: [
      [13.0600, 80.2400],
      [13.0600, 80.2500],
    ],
  };

  const results = computeRouteLaneOffsets([routeA, routeB], 14, { laneSpacingPx: 6 });
  assert.equal(results.length, 2);

  const laneA = results[0].lanePolyline;
  const laneB = results[1].lanePolyline;

  // Middle points should be offset from each other
  const midIdxA = Math.floor(laneA.length / 2);
  const midIdxB = Math.floor(laneB.length / 2);

  const distBetweenLanes = groundDistanceMeters(
    laneA[midIdxA][0], laneA[midIdxA][1],
    laneB[midIdxB][0], laneB[midIdxB][1]
  );

  // At zoom 14, 6px spacing translates to ~4-8m in ground distance
  assert.ok(distBetweenLanes > 2.0, `Expected separate lanes, got ${distBetweenLanes}m`);

  // Route A (Rank 0) and Route B (Rank 1) must have opposite signed offsets (one left, one right)
  const origLat = 13.0600;
  const shiftA = laneA[midIdxA][0] - origLat;
  const shiftB = laneB[midIdxB][0] - origLat;

  assert.ok(shiftA * shiftB < 0, `Lanes must be on opposite sides of centerline: shiftA=${shiftA}, shiftB=${shiftB}`);
});

test('routeLaneOffset 3: Opposite-direction lines on the same road still get separate lanes', async () => {
  const { computeRouteLaneOffsets, groundDistanceMeters } = await getLaneOffsetUtils();
  // Route A goes East: [80.2400 -> 80.2500]
  const routeA = {
    id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', // Nungambakkam 1 (Rank 0)
    name: 'Nungambakkam 1',
    polyline: [
      [13.0600, 80.2400],
      [13.0600, 80.2500],
    ],
  };
  // Route B goes West (opposite): [80.2500 -> 80.2400]
  const routeB = {
    id: '9f3ffe40-d485-4995-9dd0-ac74735c6402', // Royapettah 2 (Rank 4)
    name: 'Royapettah 2',
    polyline: [
      [13.0600, 80.2500],
      [13.0600, 80.2400],
    ],
  };

  const results = computeRouteLaneOffsets([routeA, routeB], 14, { laneSpacingPx: 6 });
  assert.equal(results.length, 2);

  const laneA = results[0].lanePolyline;
  const laneB = results[1].lanePolyline;

  const midA = laneA[Math.floor(laneA.length / 2)];
  const midB = laneB[Math.floor(laneB.length / 2)];

  const distBetweenLanes = groundDistanceMeters(midA[0], midA[1], midB[0], midB[1]);
  assert.ok(distBetweenLanes > 2.0, `Opposite-direction lines must maintain separate lanes: ${distBetweenLanes}m`);

  // Both should maintain standard normal convention: one positive shift, one negative shift
  const shiftA = midA[0] - 13.0600;
  const shiftB = midB[0] - 13.0600;
  assert.ok(shiftA * shiftB < 0, `Opposite-direction lanes must not overlap: shiftA=${shiftA}, shiftB=${shiftB}`);
});

test('routeLaneOffset 4: Hiding one area re-packs the remaining areas into fewer lanes', async () => {
  const { computeRouteLaneOffsets } = await getLaneOffsetUtils();
  const route1 = { id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', name: 'Nungambakkam 1', polyline: [[13.0600, 80.2400], [13.0600, 80.2500]] };
  const route2 = { id: '9835f558-456c-423f-985b-f21b981172d6', name: 'Triplicane 1', polyline: [[13.0600, 80.2400], [13.0600, 80.2500]] };
  const route3 = { id: '59311df6-345e-47d8-97c6-f71c0f64e1eb', name: 'Teynampet 1', polyline: [[13.0600, 80.2400], [13.0600, 80.2500]] };

  // 3 routes sharing
  const res3 = computeRouteLaneOffsets([route1, route2, route3], 14, { laneSpacingPx: 6 });
  // Route 2 is the middle lane (laneIndex 1 of 3) => offset ~0
  const mid3_2 = res3[1].lanePolyline[Math.floor(res3[1].lanePolyline.length / 2)];
  assert.ok(Math.abs(mid3_2[0] - 13.0600) < 1e-4, 'Middle of 3 lanes sits at center');

  // Hide Route 1: now only Route 2 and Route 3 remain
  const res2 = computeRouteLaneOffsets([route2, route3], 14, { laneSpacingPx: 6 });
  // Route 2 is now lane 0 of 2 => offset should be -0.5 * laneSpacing (NOT centered at 0 anymore)
  const mid2_2 = res2[0].lanePolyline[Math.floor(res2[0].lanePolyline.length / 2)];
  const shift2_2 = Math.abs(mid2_2[0] - 13.0600);
  assert.ok(shift2_2 > 1e-5, 'Remaining routes successfully re-pack into 2 lanes');
});
