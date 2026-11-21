import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../../services/api';
import { AREA_PALETTE, getAreaColor, getAreaByRouteName } from './areaPalette.js';
import { MOCK_DELIVERY_PARTNERS, MOCK_LIVE_EVENTS } from './mockData.js';
import { buildActiveCustomerRoutes, DEFAULT_HEAD_OFFICE } from './routeGeometry.js';

export const CANONICAL_AREA_DEFAULTS = [
  { id: '1b4a924f-1a3c-4658-9e23-a2a060917ac2', name: 'Nungambakkam 1', code: 'NUNG-1', color: '#2563eb', dpName: 'Vijay Sethu', dpCode: 'DP008', litres: 38 },
  { id: '9835f558-456c-423f-985b-f21b981172d6', name: 'Triplicane 1', code: 'TRIP-1', color: '#059669', dpName: 'Saravanan', dpCode: 'DP012', litres: 32 },
  { id: '59311df6-345e-47d8-97c6-f71c0f64e1eb', name: 'Teynampet 1', code: 'TEYN-1', color: '#d97706', dpName: 'Karthik Raja', dpCode: 'DP011', litres: 30 },
  { id: '9f2e4943-c2db-4ca8-9ee5-5a2c337241f9', name: 'Mandaveli 2', code: 'MAND-2', color: '#7c3aed', dpName: 'Arjun Vel', dpCode: 'DP004', litres: 35 },
  { id: '9f3ffe40-d485-4995-9dd0-ac74735c6402', name: 'Royapettah 2', code: 'ROYA-2', color: '#dc2626', dpName: 'Rajan Kumar', dpCode: 'DP001', litres: 36 },
];

export function resolveCustomerAreaName(c) {
  if (!c) return 'Unassigned';
  const raw = c.route_name || c.assigned_route_id || c.area || c.route || '';
  const area = getAreaByRouteName(raw);
  return area ? area.name : raw || 'Unassigned';
}

export function isCustomerMapped(c) {
  if (!c || !c.lat || !c.lng) return false;
  const lat = parseFloat(c.lat);
  const lng = parseFloat(c.lng);
  return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
}

export default function useRouteMapData(alertId = null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);

  const [deliveryPartners, setDeliveryPartners] = useState(MOCK_DELIVERY_PARTNERS);
  const [routeCorridors, setRouteCorridors] = useState([]);
  const [rawCustomers, setRawCustomers] = useState([]);
  const [stats, setStats] = useState({
    activePartners: 0,
    totalRoutes: 5,
    deviations: 0,
    stopped: 0,
    alerts: 0,
    unreviewedAlertsCount: 0,
  });
  const [liveEvents, setLiveEvents] = useState(MOCK_LIVE_EVENTS);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const [opsRes, corrRes, alertsRes] = await Promise.all([
        api.get('/route-intelligence/live-operations').catch(() => null),
        api.get('/route-intelligence/route-corridors').catch(() => null),
        alertId ? api.get('/route-intelligence/alerts').catch(() => null) : null,
      ]);

      let allCustList = [];
      let mappedList = [];
      let unmappedList = [];

      if (opsRes?.data?.success && opsRes?.data?.data) {
        const data = opsRes.data.data;
        if (data.gpsUpdateInterval || data.stats?.gpsUpdateInterval) {
          const interval = Number(data.gpsUpdateInterval || data.stats?.gpsUpdateInterval);
          if (!isNaN(interval) && interval >= 10) {
            setRefreshInterval(interval);
          }
        }
        if (data.deliveryPartners && data.deliveryPartners.length > 0) {
          setDeliveryPartners(data.deliveryPartners);
        }
        if (data.stats) {
          setStats(data.stats);
        }
        if (data.liveEvents && data.liveEvents.length > 0) {
          setLiveEvents(data.liveEvents);
        }
        if (data.customers && data.customers.length > 0) {
          mappedList = data.customers;
        }
        if (data.unmappedCustomers && data.unmappedCustomers.length > 0) {
          unmappedList = data.unmappedCustomers;
        }
        if (data.allCustomers && data.allCustomers.length > 0) {
          allCustList = data.allCustomers;
        } else {
          allCustList = [...mappedList, ...unmappedList];
        }
        setIsDb2Loaded(true);
      }

      if (corrRes?.data?.success && corrRes.data?.data?.routes) {
        setRouteCorridors(corrRes.data.data.routes);
        // Fallback for customers if live-operations didn't provide them
        if (allCustList.length === 0) {
          const cCust = [];
          const mCust = [];
          corrRes.data.data.routes.forEach(r => {
            if (r.customers) cCust.push(...r.customers);
            if (r.missingCustomers) mCust.push(...r.missingCustomers);
          });
          mappedList = cCust;
          unmappedList = mCust;
          allCustList = [...cCust, ...mCust];
        }
      }

      if (allCustList.length > 0) {
        setRawCustomers(allCustList);
      }

      if (alertId && alertsRes?.data?.success && alertsRes.data.data) {
        const found = alertsRes.data.data.find(a => a.id === alertId);
        if (found) {
          setSelectedAlert(found);
        }
      }
    } catch (err) {
      console.warn('useRouteMapData fetch error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchData();
    // Auto-refresh dynamically matching gpsUpdateInterval from settings (min 10s)
    const intervalMs = Math.max(10, refreshInterval) * 1000;
    const timer = setInterval(() => {
      fetchData();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval]);

  // Unified customer lists
  const allCustomers = useMemo(() => {
    return rawCustomers.map(c => {
      const areaName = resolveCustomerAreaName(c);
      const areaColor = c.areaColor || c.color || getAreaColor(areaName);
      return {
        ...c,
        areaName,
        areaColor,
      };
    });
  }, [rawCustomers]);

  const mappedCustomers = useMemo(() => {
    return allCustomers.filter(isCustomerMapped);
  }, [allCustomers]);

  const unmappedCustomers = useMemo(() => {
    return allCustomers.filter(c => !isCustomerMapped(c));
  }, [allCustomers]);

  // Standardized road-following active customer routes (5 area corridors)
  const activeCustomerRoutes = useMemo(() => {
    if (routeCorridors && routeCorridors.length > 0) {
      return routeCorridors.map((rc, idx) => {
        const areaName = rc.name || CANONICAL_AREA_DEFAULTS[idx]?.name || `Area ${idx + 1}`;
        const areaMeta = getAreaByRouteName(areaName) || CANONICAL_AREA_DEFAULTS[idx];
        const defaultLitres = CANONICAL_AREA_DEFAULTS.find(a => a.name === areaName)?.litres || 30;

        return {
          id: rc.id || areaMeta?.id || `corr-${idx}`,
          name: areaName,
          code: rc.code || areaMeta?.code || `AREA-${idx + 1}`,
          color: rc.color || areaMeta?.color || '#2563eb',
          isRouteCorridor: true,
          corridorToleranceMeters: rc.corridorToleranceMeters || 120,
          customerCount: rc.customerCount !== undefined ? rc.customerCount : (rc.customers ? rc.customers.length : 0),
          litres: rc.litres || defaultLitres,
          polyline: rc.polyline || rc.roadCoordinates || [],
          roadCoordinates: rc.polyline || rc.roadCoordinates || [],
          assignedDp: rc.assignedDp || areaMeta?.dpName || 'Assigned DP',
          compliance: rc.compliance || 95,
          status: rc.status || 'active',
        };
      });
    }
    // Fallback using route geometry generator
    const generated = buildActiveCustomerRoutes(allCustomers, DEFAULT_HEAD_OFFICE);
    return generated.map((r, idx) => {
      const areaMeta = getAreaByRouteName(r.name) || CANONICAL_AREA_DEFAULTS[idx];
      return {
        ...r,
        code: areaMeta?.code || `AREA-${idx + 1}`,
        litres: areaMeta?.litres || 30,
        assignedDp: areaMeta?.dpName || 'Assigned DP',
      };
    });
  }, [routeCorridors, allCustomers]);

  return {
    loading,
    error,
    isDb2Loaded,
    deliveryPartners,
    activeCustomerRoutes,
    allCustomers,
    mappedCustomers,
    unmappedCustomers,
    stats,
    liveEvents,
    selectedAlert,
    setSelectedAlert,
    refresh: fetchData,
  };
}
