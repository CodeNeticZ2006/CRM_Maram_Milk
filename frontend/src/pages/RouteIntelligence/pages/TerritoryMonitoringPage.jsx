import { motion } from 'framer-motion';
import { MdMap, MdPeople, MdAddLocation, MdRefresh, MdLocationOn } from 'react-icons/md';
import { useState, useEffect, useCallback } from 'react';
import { SectionHeader, TerritoryCard, StatusBadge, ComplianceProgressBar } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_TERRITORIES, MOCK_ROUTES } from '../utils/mockData.js';
import {
  LeafletMapContainer, RoutePolygon, DeliveryPartnerMarker,
  HeadOfficeMarker, HEAD_OFFICE, MOCK_GIS_TERRITORIES, MOCK_GIS_PARTNERS
} from '../maps/index.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

// Default fallback Chennai bounding box generator for routes
const FALLBACK_ROUTE_BOUNDARIES = [
  { id: 'rb-1', name: 'Alwarpet 1',      color: '#3b82f6', coordinates: [[13.0300, 80.2440], [13.0380, 80.2440], [13.0380, 80.2540], [13.0300, 80.2540]], dp: 'Rajan Kumar', customers: 18, compliance: 94, status: 'active' },
  { id: 'rb-2', name: 'Egmore 1',        color: '#10b981', coordinates: [[13.0680, 80.2550], [13.0780, 80.2550], [13.0780, 80.2660], [13.0680, 80.2660]], dp: 'Suresh Babu', customers: 14, compliance: 88, status: 'active' },
  { id: 'rb-3', name: 'Mandaveli 1',   color: '#ef4444', coordinates: [[13.0230, 80.2560], [13.0310, 80.2560], [13.0310, 80.2640], [13.0230, 80.2640]], dp: 'Muthu Raj',   customers: 16, compliance: 67, status: 'breach' },
  { id: 'rb-4', name: 'Mandaveli 2',   color: '#8b5cf6', coordinates: [[13.0250, 80.2600], [13.0330, 80.2600], [13.0330, 80.2680], [13.0250, 80.2680]], dp: 'Arjun Vel',   customers: 15, compliance: 97, status: 'active' },
  { id: 'rb-5', name: 'MRC Ngr',       color: '#f59e0b', coordinates: [[13.0170, 80.2690], [13.0250, 80.2690], [13.0250, 80.2790], [13.0170, 80.2790]], dp: 'Prakash Nair',customers: 20, compliance: 55, status: 'stopped' },
  { id: 'rb-6', name: 'Mylapore 1',    color: '#06b6d4', coordinates: [[13.0280, 80.2630], [13.0370, 80.2630], [13.0370, 80.2720], [13.0280, 80.2720]], dp: 'Vikram Selvan',customers: 13, compliance: 91, status: 'active' },
  { id: 'rb-7', name: 'Mylapore 2',    color: '#ec4899', coordinates: [[13.0310, 80.2660], [13.0400, 80.2660], [13.0400, 80.2750], [13.0310, 80.2750]], dp: 'Karthik Raja',customers: 11, compliance: 89, status: 'active' },
  { id: 'rb-8', name: 'Nungambakkam 1',color: '#14b8a6', coordinates: [[13.0550, 80.2340], [13.0650, 80.2340], [13.0650, 80.2450], [13.0550, 80.2450]], dp: 'Vijay Sethu', customers: 22, compliance: 95, status: 'active' },
  { id: 'rb-9', name: 'Royapettah 2',   color: '#f97316', coordinates: [[13.0450, 80.2540], [13.0550, 80.2540], [13.0550, 80.2650], [13.0450, 80.2650]], dp: 'Saravanan',   customers: 17, compliance: 82, status: 'active' },
  { id: 'rb-10', name: 'T-Nagar 1',     color: '#84cc16', coordinates: [[13.0360, 80.2280], [13.0460, 80.2280], [13.0460, 80.2390], [13.0360, 80.2390]], dp: 'Manikandan',  customers: 25, compliance: 98, status: 'active' },
  { id: 'rb-11', name: 'Teynampet 1',   color: '#6366f1', coordinates: [[13.0400, 80.2430], [13.0490, 80.2430], [13.0490, 80.2530], [13.0400, 80.2530]], dp: 'Karthik Raja',customers: 19, compliance: 92, status: 'active' },
  { id: 'rb-12', name: 'Triplicane 1',  color: '#a855f7', coordinates: [[13.0530, 80.2700], [13.0630, 80.2700], [13.0630, 80.2810], [13.0530, 80.2700]], dp: 'Saravanan',   customers: 24, compliance: 90, status: 'active' },
  { id: 'rb-13', name: 'West Mambalam 1', color: '#0284c7', coordinates: [[13.0330, 80.2170], [13.0420, 80.2170], [13.0420, 80.2260], [13.0330, 80.2260]], dp: 'Ramesh Babu',  customers: 21, compliance: 96, status: 'active' },
  { id: 'rb-14', name: 'West Mambalam 2', color: '#0d9488', coordinates: [[13.0350, 80.2200], [13.0440, 80.2200], [13.0440, 80.2290], [13.0350, 80.2200]], dp: 'Saravana Kumar', customers: 16, compliance: 93, status: 'active' },
];

export default function TerritoryMonitoringPage() {
  const [territories, setTerritories] = useState(MOCK_TERRITORIES);
  const [routes, setRoutes]           = useState(FALLBACK_ROUTE_BOUNDARIES);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [mapCenter, setMapCenter]     = useState([HEAD_OFFICE.lat, HEAD_OFFICE.lng]);
  const [mapZoom, setMapZoom]         = useState(11);
  const [loading, setLoading]         = useState(true);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);

  const fetchTerritories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/route-intelligence/territories');
      if (res.data?.success && res.data?.data) {
        const { territories: terrs, routes: rts } = res.data.data;
        if (terrs && terrs.length > 0) setTerritories(terrs);
        if (rts && rts.length > 0) {
          setRoutes(rts);
        }
        setIsDb2Loaded(true);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load DB2 Territories:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerritories();
  }, [fetchTerritories]);

  const handleSelectRoute = (route) => {
    setSelectedRouteId(route.id);
    if (route.center) {
      setMapCenter(route.center);
      setMapZoom(13);
    } else if (route.coordinates && route.coordinates.length > 0) {
      setMapCenter(route.coordinates[0]);
      setMapZoom(13);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Territory Monitoring"
        subtitle={
          <span>
            Manage and monitor delivery zones, route boundaries, and assigned partners
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" onClick={fetchTerritories} disabled={loading}>
          <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
        <button className="btn btn-primary btn-sm" id="ri-add-territory-btn"><MdAddLocation /> Add Territory</button>
      </SectionHeader>

      {/* Territory KPIs */}
      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total DB2 Territories', value: territories.length, color: 'var(--primary)' },
          { label: 'Active',            value: territories.filter(t=>t.status==='active').length, color: 'var(--success)' },
          { label: 'Breach Detected',   value: territories.filter(t=>t.status==='breach').length, color: 'var(--danger)'  },
          { label: 'DB2 Marked Boundaries', value: routes.length,       color: 'var(--info)'    },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--card-accent': s.color }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Map + Territory Cards */}
      <div className="ri-two-col">
        <LeafletMapContainer height={440} center={mapCenter} zoom={mapZoom}>
          {({ showTerritories, showPartners }) => (
            <>
              <HeadOfficeMarker office={HEAD_OFFICE} />

              {/* DB2 Route Area Boundaries marked on map */}
              {showTerritories && routes.map(r => {
                const isSelected = selectedRouteId === r.id;
                return (
                  <RoutePolygon
                    key={r.id}
                    type="polygon"
                    coordinates={r.coordinates || [[13.04, 80.24], [13.05, 80.24], [13.05, 80.25], [13.04, 80.25]]}
                    color={r.color || '#3b82f6'}
                    fillColor={r.color || '#3b82f6'}
                    fillOpacity={isSelected ? 0.35 : 0.15}
                    weight={isSelected ? 3.5 : 1.5}
                    title={`DB2 Route Area: ${r.name}`}
                    subtitle={`Zone: ${r.zone || 'Zone A'} | Assigned DP: ${r.dp} | Stops: ${r.customers || 10}`}
                    status={r.status || 'active'}
                  />
                );
              })}

              {/* Delivery Partners */}
              {showPartners && MOCK_GIS_PARTNERS.map(partner => (
                <DeliveryPartnerMarker key={partner.id} partner={partner} />
              ))}
            </>
          )}
        </LeafletMapContainer>

        <div className="card">
          <div className="card-header"><span className="card-title">DB2 Zones ({territories.length})</span></div>
          <div className="card-body" style={{ padding: '12px 16px', maxHeight: 380, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {territories.map(t => <TerritoryCard key={t.id} territory={t} />)}
            </div>
          </div>
        </div>
      </div>

      {/* DB2 Route Boundaries Table with Map Marking Action */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="card-title">DB2 Route Area Boundaries</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Click any route to mark and focus its geographical area boundary on the map
            </div>
          </div>
          <span className="badge badge-blue">{routes.length} DB2 routes marked</span>
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
                <th>Map Action</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => {
                const isSelected = selectedRouteId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => handleSelectRoute(r)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(59,130,246,0.08)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: r.color || 'var(--primary)', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--primary)' : 'inherit' }}>
                          {r.name}
                        </span>
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
                    <td>
                      <button
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRoute(r);
                        }}
                        style={{ fontSize: 11.5 }}
                      >
                        <MdLocationOn /> {isSelected ? 'Focused' : 'Locate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
