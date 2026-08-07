import { motion } from 'framer-motion';
import {
  MdDirectionsBike, MdRoute, MdWarningAmber, MdNotifications,
  MdRefresh, MdFilterList,
} from 'react-icons/md';
import { SectionHeader, AnalyticsCard, EventSeverityIcon } from '../components/index.jsx';
import { MOCK_DELIVERY_PARTNERS, MOCK_LIVE_EVENTS } from '../utils/mockData.js';
import {
  LeafletMapContainer, HeadOfficeMarker, CustomerMarker,
  DeliveryPartnerMarker, RoutePolyline, HEAD_OFFICE,
  MOCK_GIS_CUSTOMERS, MOCK_GIS_PARTNERS, MOCK_GIS_POLYLINES
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function LiveOperationsPage() {
  const activePartners = MOCK_DELIVERY_PARTNERS.filter(d => d.status === 'active').length;
  const deviations     = MOCK_DELIVERY_PARTNERS.filter(d => d.status === 'deviated').length;
  const stopped        = MOCK_DELIVERY_PARTNERS.filter(d => d.status === 'stopped').length;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Live Operations"
        subtitle="Real-time delivery partner tracking and route status"
      >
        <button className="btn btn-secondary btn-sm" id="ri-live-refresh-btn">
          <MdRefresh /> Refresh
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
          sub="Currently on route"
          trend="+2 vs yesterday"
          color="var(--primary)"
        />
        <AnalyticsCard
          icon={<MdRoute />}
          label="Active Routes"
          value={MOCK_DELIVERY_PARTNERS.length}
          sub="Out of 6 planned"
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
        <LeafletMapContainer height={445} center={[HEAD_OFFICE.lat, HEAD_OFFICE.lng]} zoom={12}>
          {({ showCustomers, showPartners, showRoutes }) => (
            <>
              {/* Head Office */}
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* Route Polylines */}
              {showRoutes && MOCK_GIS_POLYLINES.map(line => (
                <RoutePolyline
                  key={line.id}
                  coordinates={line.coordinates}
                  color={line.color}
                  routeName={line.routeName}
                />
              ))}

              {/* Customers */}
              {showCustomers && MOCK_GIS_CUSTOMERS.map(cust => (
                <CustomerMarker key={cust.id} customer={cust} />
              ))}

              {/* Delivery Partners */}
              {showPartners && MOCK_GIS_PARTNERS.map(partner => (
                <DeliveryPartnerMarker key={partner.id} partner={partner} />
              ))}
            </>
          )}
        </LeafletMapContainer>

        <div className="card" style={{ padding: '20px 0' }}>
          <div style={{ padding: '0 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Active Partners</span>
            <span className="badge badge-success">{activePartners} online</span>
          </div>
          <div className="ri-dp-list" style={{ padding: '12px 16px', maxHeight: 380, overflowY: 'auto' }}>
            {MOCK_DELIVERY_PARTNERS.map(dp => {
              const initials = dp.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
              const statusColor = dp.status === 'active' ? 'var(--success)' : dp.status === 'deviated' ? 'var(--danger)' : 'var(--warning)';
              return (
                <div key={dp.id} className="ri-dp-item">
                  <div className="ri-dp-avatar" style={{ background: `linear-gradient(135deg, ${statusColor}, var(--info))` }}>
                    {initials}
                  </div>
                  <div className="ri-dp-info">
                    <div className="ri-dp-name">{dp.name}</div>
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 30 minutes</span>
        </div>
        <div className="card-body">
          <div className="ri-activity-list">
            {MOCK_LIVE_EVENTS.map(ev => (
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
