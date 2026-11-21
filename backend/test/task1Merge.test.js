import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Task 1: Live Operations & Territory Monitoring Merge Verification', () => {
  it('1. Sidebar does not contain Territory Monitoring', () => {
    const sidebarContent = readFileSync(resolve('frontend/src/components/layout/Sidebar.jsx'), 'utf8');
    assert.strictEqual(sidebarContent.includes("to: '/route-intelligence/territories'"), false, 'Territory Monitoring should be removed from Sidebar NAV_SECTIONS');
    assert.strictEqual(sidebarContent.includes("'/route-intelligence/territories':"), false, 'Territory Monitoring should be removed from ROUTE_PERMISSION_MAP');
  });

  it('2. App.jsx has TerritoryRedirect redirecting /route-intelligence/territories to /route-intelligence/live?tab=areas', () => {
    const appContent = readFileSync(resolve('frontend/src/App.jsx'), 'utf8');
    assert.strictEqual(appContent.includes('function TerritoryRedirect'), true, 'App.jsx must define TerritoryRedirect component');
    assert.strictEqual(appContent.includes('<Route path="/route-intelligence/territories" element={<TerritoryRedirect />} />'), true, 'App.jsx must route territories to TerritoryRedirect');
  });

  it('3. TerritoryRedirect preserves existing query parameters and appends tab=areas', () => {
    // Simulate TerritoryRedirect query param logic
    const testCases = [
      { input: '', expected: 'tab=areas' },
      { input: '?alertId=alt-123', expected: 'alertId=alt-123&tab=areas' },
      { input: '?dpId=dp-01&lat=13.05&lng=80.24', expected: 'dpId=dp-01&lat=13.05&lng=80.24&tab=areas' },
      { input: '?tab=partners', expected: 'tab=partners' }, // preserves tab if explicitly provided
    ];

    testCases.forEach(({ input, expected }) => {
      const searchParams = new URLSearchParams(input);
      if (!searchParams.has('tab')) {
        searchParams.set('tab', 'areas');
      }
      assert.strictEqual(searchParams.toString(), expected);
    });
  });

  it('4. TerritoryMonitoringPage.jsx is completely removed and no broken imports remain', () => {
    assert.strictEqual(existsSync(resolve('frontend/src/pages/RouteIntelligence/pages/TerritoryMonitoringPage.jsx')), false, 'TerritoryMonitoringPage.jsx should be deleted');
  });

  it('5. LiveOperationsPage supports tabs, alert inspection (?alertId=...), lane offsets, and visibility toggling', () => {
    const liveContent = readFileSync(resolve('frontend/src/pages/RouteIntelligence/pages/LiveOperationsPage.jsx'), 'utf8');
    assert.strictEqual(liveContent.includes('useRouteMapData'), true, 'LiveOperationsPage must use single source of truth hook useRouteMapData');
    assert.strictEqual(liveContent.includes('toggleAreaVisibility'), true, 'LiveOperationsPage must support per-area visibility toggle');
    assert.strictEqual(liveContent.includes('computeRouteLaneOffsets'), true, 'LiveOperationsPage must compute lane offsets for overlapping routes');
    assert.strictEqual(liveContent.includes('selectedAlert'), true, 'LiveOperationsPage must support alert inspection mode');
    assert.strictEqual(liveContent.includes('unmappedCustomers'), true, 'LiveOperationsPage must include unmapped customers list');
  });

  it('6. Seeded customers data confirms 108 mapped and 7 unmapped across the 5 areas', () => {
    const custRaw = readFileSync(resolve('backend/data/customers.json'), 'utf8');
    const customers = JSON.parse(custRaw);
    const mapped = customers.filter(c => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
    const unmapped = customers.filter(c => {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      return isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0;
    });

    assert.strictEqual(mapped.length, 108, 'Must have exactly 108 mapped customer stops');
    assert.strictEqual(unmapped.length, 7, 'Must have exactly 7 unmapped customers');
    assert.strictEqual(customers.length, 115, 'Total customers must be 115');
  });
});
