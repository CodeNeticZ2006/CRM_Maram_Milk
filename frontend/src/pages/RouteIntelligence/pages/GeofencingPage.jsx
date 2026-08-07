import { motion } from 'framer-motion';
import { MdHexagon, MdLogin, MdLogout, MdBolt, MdAdd } from 'react-icons/md';
import { SectionHeader, AnalyticsCard, StatusBadge, EventSeverityIcon } from '../components/index.jsx';
import { MOCK_GEOFENCES, MOCK_TERRITORIES, MOCK_LIVE_EVENTS } from '../utils/mockData.js';
import {
  LeafletMapContainer, RoutePolygon, DeliveryPartnerMarker,
  HeadOfficeMarker, HEAD_OFFICE, MOCK_GIS_GEOFENCES,
  MOCK_GIS_TERRITORIES, MOCK_GIS_PARTNERS
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const GEOFENCE_TYPE_META = {
  route:      { icon: '📍', bg: 'rgba(59,130,246,0.10)',  color: 'var(--primary)'  },
  depot:      { icon: '🏭', bg: 'rgba(16,185,129,0.10)',  color: 'var(--success)'  },
  restricted: { icon: '🚫', bg: 'rgba(239,68,68,0.10)',   color: 'var(--danger)'   },
};

export default function GeofencingPage() {
  const totalEntries  = MOCK_GEOFENCES.reduce((a, g) => a + g.entries, 0);
  const totalExits    = MOCK_GEOFENCES.reduce((a, g) => a + g.exits, 0);
  const activeGf      = MOCK_GEOFENCES.filter(g => g.status === 'active').length;
  const assignedTerr  = MOCK_TERRITORIES.filter(t => t.status !== 'inactive').length;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Geofencing"
        subtitle="Configure and monitor geofence boundaries for all territories and depots"
      >
        <button className="btn btn-primary btn-sm" id="ri-add-geofence-btn">
          <MdAdd /> New Geofence
        </button>
      </SectionHeader>

      {/* KPI Cards */}
      <div className="ri-stat-grid-4">
        <AnalyticsCard icon={<MdHexagon />}  label="Assigned Territories" value={assignedTerr}  color="var(--primary)" />
        <AnalyticsCard icon={<MdBolt />}     label="Active Geofences"     value={activeGf}       color="var(--success)" />
        <AnalyticsCard icon={<MdLogin />}    label="Today's Entries"      value={totalEntries}   color="var(--info)"    />
        <AnalyticsCard icon={<MdLogout />}   label="Today's Exits"        value={totalExits}     color="var(--accent)"  />
      </div>

      {/* Map + Geofence List */}
      <div className="ri-two-col">
        <LeafletMapContainer height={420} center={[HEAD_OFFICE.lat, HEAD_OFFICE.lng]} zoom={11}>
          {({ showTerritories, showPartners }) => (
            <>
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* Territory Boundary Polygons */}
              {showTerritories && MOCK_GIS_TERRITORIES.map(t => (
                <RoutePolygon
                  key={t.id}
                  type="polygon"
                  coordinates={t.coordinates}
                  color={t.color}
                  fillOpacity={0.08}
                  weight={1.5}
                  dashArray="4, 4"
                  title={`Territory: ${t.name}`}
                />
              ))}

              {/* Geofence Circles */}
              {MOCK_GIS_GEOFENCES.map(gf => (
                <RoutePolygon
                  key={gf.id}
                  type="circle"
                  coordinates={gf.center}
                  radius={gf.radius}
                  color={gf.color}
                  fillColor={gf.color}
                  fillOpacity={0.2}
                  title={gf.name}
                  subtitle={`Entries: ${gf.entries} | Exits: ${gf.exits}`}
                  status={gf.status}
                />
              ))}

              {/* Delivery Partner Markers */}
              {showPartners && MOCK_GIS_PARTNERS.map(partner => (
                <DeliveryPartnerMarker key={partner.id} partner={partner} />
              ))}
            </>
          )}
        </LeafletMapContainer>

        <div className="card">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <span className="card-title">Configured Geofences</span>
            <button className="btn btn-secondary btn-sm"><MdAdd /></button>
          </div>
          <div className="card-body" style={{ padding: '0 16px 16px' }}>
            <div className="ri-geofence-list">
              {MOCK_GEOFENCES.map(gf => {
                const meta = GEOFENCE_TYPE_META[gf.type] || GEOFENCE_TYPE_META.route;
                return (
                  <div key={gf.id} className="ri-geofence-item">
                    <div className="ri-geofence-icon" style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon}
                    </div>
                    <div className="ri-geofence-info">
                      <div className="ri-geofence-name">{gf.name}</div>
                      <div className="ri-geofence-meta">Radius: {gf.radius}m &nbsp;·&nbsp; <StatusBadge status={gf.status} /></div>
                    </div>
                    <div className="ri-geofence-counts">
                      <div className="ri-count-chip">
                        <div className="ri-count-val" style={{ color: 'var(--success)' }}>{gf.entries}</div>
                        <div className="ri-count-lbl">In</div>
                      </div>
                      <div className="ri-count-chip">
                        <div className="ri-count-val" style={{ color: 'var(--danger)' }}>{gf.exits}</div>
                        <div className="ri-count-lbl">Out</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Live Events */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Live Geofence Events</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ri-live-dot" />
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>LIVE</span>
          </div>
        </div>
        <div className="card-body">
          <div className="ri-activity-list">
            {MOCK_LIVE_EVENTS.slice(0, 5).map(ev => (
              <div key={ev.id} className="ri-activity-item">
                <div className="ri-activity-icon-wrap">
                  <EventSeverityIcon severity={ev.severity} />
                </div>
                <div className="ri-activity-text">
                  <div className="ri-activity-dp">{ev.dp}</div>
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
