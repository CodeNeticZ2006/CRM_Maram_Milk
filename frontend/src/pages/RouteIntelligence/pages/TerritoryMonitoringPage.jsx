import { motion } from 'framer-motion';
import { MdMap, MdPeople, MdAddLocation, MdRefresh } from 'react-icons/md';
import { SectionHeader, TerritoryCard, StatusBadge, ComplianceProgressBar } from '../components/index.jsx';
import { MOCK_TERRITORIES, MOCK_ROUTES } from '../utils/mockData.js';
import {
  LeafletMapContainer, RoutePolygon, DeliveryPartnerMarker,
  HeadOfficeMarker, HEAD_OFFICE, MOCK_GIS_TERRITORIES, MOCK_GIS_PARTNERS
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function TerritoryMonitoringPage() {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Territory Monitoring"
        subtitle="Manage and monitor delivery zones, route boundaries, and assigned partners"
      >
        <button className="btn btn-secondary btn-sm"><MdRefresh /> Refresh</button>
        <button className="btn btn-primary btn-sm" id="ri-add-territory-btn"><MdAddLocation /> Add Territory</button>
      </SectionHeader>

      {/* Territory KPIs */}
      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Territories', value: MOCK_TERRITORIES.length, color: 'var(--primary)' },
          { label: 'Active',            value: MOCK_TERRITORIES.filter(t=>t.status==='active').length, color: 'var(--success)' },
          { label: 'Breach Detected',   value: MOCK_TERRITORIES.filter(t=>t.status==='breach').length, color: 'var(--danger)'  },
          { label: 'Total Routes',      value: MOCK_ROUTES.length,      color: 'var(--info)'    },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--card-accent': s.color }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Map + Territory Cards */}
      <div className="ri-two-col">
        <LeafletMapContainer height={420} center={[HEAD_OFFICE.lat, HEAD_OFFICE.lng]} zoom={11}>
          {({ showTerritories, showPartners }) => (
            <>
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* Territory Polygons */}
              {showTerritories && MOCK_GIS_TERRITORIES.map(t => (
                <RoutePolygon
                  key={t.id}
                  type="polygon"
                  coordinates={t.coordinates}
                  color={t.color}
                  fillColor={t.color}
                  fillOpacity={0.2}
                  title={t.name}
                  subtitle={`${t.route} (${t.dp})`}
                  status={t.status}
                />
              ))}

              {/* Delivery Partners */}
              {showPartners && MOCK_GIS_PARTNERS.map(partner => (
                <DeliveryPartnerMarker key={partner.id} partner={partner} />
              ))}
            </>
          )}
        </LeafletMapContainer>

        <div className="card">
          <div className="card-header"><span className="card-title">Territories</span></div>
          <div className="card-body" style={{ padding: '12px 16px', maxHeight: 360, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MOCK_TERRITORIES.map(t => <TerritoryCard key={t.id} territory={t} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Route Boundary List */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ paddingBottom: 16 }}>
          <span className="card-title">Route Boundaries</span>
          <span className="badge badge-blue">{MOCK_ROUTES.length} routes</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Route Name</th>
                <th>Assigned DP</th>
                <th>Customers</th>
                <th>Compliance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ROUTES.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdPeople style={{ color: 'var(--text-muted)' }} />
                      {r.dp}
                    </div>
                  </td>
                  <td>{r.customers} stops</td>
                  <td style={{ minWidth: 140 }}>
                    <ComplianceProgressBar value={r.compliance} />
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
