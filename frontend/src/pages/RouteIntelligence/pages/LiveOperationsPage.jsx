import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MdDirectionsBike, MdRoute, MdWarningAmber, MdNotifications,
  MdRefresh, MdFilterList,
} from 'react-icons/md';
import { SectionHeader, AnalyticsCard, EventSeverityIcon } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_DELIVERY_PARTNERS, MOCK_LIVE_EVENTS } from '../utils/mockData.js';
import { buildActiveCustomerRoutes } from '../utils/routeGeometry.js';
import {
  LeafletMapContainer, HeadOfficeMarker, CustomerMarker,
  DeliveryPartnerMarker, RoutePolyline, HEAD_OFFICE
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function LiveOperationsPage() {
  const [loading, setLoading] = useState(true);
  const [deliveryPartners, setPartners] = useState(MOCK_DELIVERY_PARTNERS);
  const [routes, setRoutes] = useState([]);
  const [stats, setStats] = useState({ activePartners: 0, totalRoutes: 0, deviations: 0, stopped: 0, alerts: 0 });
  const [liveEvents, setEvents] = useState(MOCK_LIVE_EVENTS);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);

  const [allCustomers, setAllCustomers] = useState([]);
  const [customers, setCustomers] = useState([]);

  const fetchLiveOps = useCallback(async () => {
    setLoading(true);
    try {
      const [opsRes, custRes] = await Promise.all([
        api.get('/route-intelligence/live-operations').catch(() => null),
        api.get('/customers', { params: { limit: 500 } }).catch(() => null),
      ]);

      if (opsRes?.data?.success && opsRes?.data?.data) {
        const { deliveryPartners: dps, routes: rts, stats: st, liveEvents: evs } = opsRes.data.data;
        if (dps && dps.length > 0) setPartners(dps);
        if (rts && rts.length > 0) setRoutes(rts);
        if (st) setStats(st);
        if (evs && evs.length > 0) setEvents(evs);
        setIsDb2Loaded(true);
      }

      if (custRes?.data?.success && Array.isArray(custRes.data?.data)) {
        setAllCustomers(custRes.data.data);
        setCustomers(custRes.data.data.filter(c => c.lat && c.lng && !isNaN(parseFloat(c.lat)) && !isNaN(parseFloat(c.lng))));
      }
    } catch (err) {
      console.warn('⚠️ Failed to load DB2 Live Operations data:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveOps();
  }, [fetchLiveOps]);

  // Generate ONLY active route polylines connecting real customer locations
  const activeCustomerRoutes = useMemo(() => {
    return buildActiveCustomerRoutes(allCustomers, HEAD_OFFICE);
  }, [allCustomers]);

  // Calculate dynamic map bounds focused on actual customer coordinates
  const mapBounds = useMemo(() => {
    if (customers.length === 0) return null;
    const lats = customers.map(c => parseFloat(c.lat));
    const lngs = customers.map(c => parseFloat(c.lng));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const marginLat = (maxLat - minLat) * 0.1 || 0.01;
    const marginLng = (maxLng - minLng) * 0.1 || 0.01;
    return [
      [minLat - marginLat, minLng - marginLng],
      [maxLat + marginLat, maxLng + marginLng],
    ];
  }, [customers]);

  const activePartners = stats.activePartners || deliveryPartners.filter(d => d.status === 'active').length;
  const deviations     = stats.deviations || deliveryPartners.filter(d => d.status === 'deviated').length;
  const stopped        = stats.stopped || deliveryPartners.filter(d => d.status === 'stopped').length;
  const totalRoutes    = activeCustomerRoutes.length || 3;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Live Operations"
        subtitle={
          <span>
            Real-time delivery partner tracking and route status ({activeCustomerRoutes.length} Active Customer Routes)
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" id="ri-live-refresh-btn" onClick={fetchLiveOps} disabled={loading}>
          <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
        <button className="btn btn-primary btn-sm" id="ri-live-filter-btn">
          <MdFilterList /> Filter
        </button>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="ri-stat-grid-4">
        <AnalyticsCard
          icon={<MdDirectionsBike />}
          label="Active Delivery Partners"
          value={activePartners}
          sub="Currently on route (DB2)"
          trend="+2 vs yesterday"
          color="var(--primary)"
        />
        <AnalyticsCard
          icon={<MdRoute />}
          label="Routes with Customers"
          value={activeCustomerRoutes.length}
          sub="Royapettah, Mandaveli 2, Teynampet"
          color="var(--success)"
        />
        <AnalyticsCard
          icon={<MdWarningAmber />}
          label="Route Deviations"
          value={deviations}
          sub="Flagged for review"
          trend={deviations > 0 ? `+${deviations} alerts` : undefined}
          color="var(--danger)"
        />
        <AnalyticsCard
          icon={<MdNotifications />}
          label="Current Alerts"
          value={stopped + deviations}
          sub="Deviations + stops"
          color="var(--warning)"
        />
      </div>

      {/* Map + DP List */}
      <div className="ri-two-col">
        <LeafletMapContainer height={445} center={[HEAD_OFFICE.lat, HEAD_OFFICE.lng]} zoom={12} bounds={mapBounds}>
          {({ showCustomers, showPartners, showRoutes }) => (
            <>
              {/* Head Office */}
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* Dynamic Route Polylines generated from real DB customer locations (Exactly 3 active customer routes) */}
              {showRoutes && activeCustomerRoutes.map(route => (
                <RoutePolyline
                  key={route.id}
                  coordinates={route.polyline}
                  color={route.color}
                  routeName={`${route.name} (${route.customerCount} Customers)`}
                />
              ))}

              {/* Customers (Dynamic from CRM DB) */}
              {showCustomers && customers.map(cust => (
                <CustomerMarker key={cust.id} customer={cust} />
              ))}

              {/* Delivery Partners (from DB2) */}
              {showPartners && deliveryPartners.map(partner => (
                <DeliveryPartnerMarker key={partner.id} partner={partner} />
              ))}
            </>
          )}
        </LeafletMapContainer>

        <div className="card" style={{ padding: '20px 0' }}>
          <div style={{ padding: '0 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Active Partners ({deliveryPartners.length})</span>
            <span className="badge badge-success">{activePartners} online</span>
          </div>
          <div className="ri-dp-list" style={{ padding: '12px 16px', maxHeight: 380, overflowY: 'auto' }}>
            {deliveryPartners.map(dp => {
              const initials = dp.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
              const statusColor = dp.status === 'active' ? 'var(--success)' : dp.status === 'deviated' ? 'var(--danger)' : 'var(--warning)';
              return (
                <div key={dp.id} className="ri-dp-item">
                  <div className="ri-dp-avatar" style={{ background: `linear-gradient(135deg, ${statusColor}, var(--info))` }}>
                    {initials}
                  </div>
                  <div className="ri-dp-info">
                    <div className="ri-dp-name">{dp.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({dp.dpCode || 'DB2'})</span></div>
                    <div className="ri-dp-route">{dp.route}</div>
                  </div>
                  <div className="ri-dp-speed">
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {dp.speed > 0 ? `${dp.speed} kph` : 'Stopped'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dp.lastUpdate}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live from DB2 records</span>
        </div>
        <div className="card-body">
          <div className="ri-activity-list">
            {liveEvents.map(ev => (
              <div key={ev.id} className="ri-activity-item">
                <div className="ri-activity-icon-wrap">
                  <EventSeverityIcon severity={ev.severity} />
                </div>
                <div className="ri-activity-text">
                  <div className="ri-activity-dp">{ev.dp} &mdash; <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{ev.route}</span></div>
                  <div className="ri-activity-event">{ev.event}</div>
                </div>
                <div className="ri-activity-time">{ev.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
