import { motion } from 'framer-motion';
import {
  MdCheckCircle, MdFilterList, MdDownload, MdSearch, MdRefresh,
  MdWarningAmber, MdLocationOn, MdCheck, MdClose, MdVisibility
} from 'react-icons/md';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SectionHeader, StatusBadge, AlertDetailDrawer } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_COMPLIANCE_ROWS } from '../utils/mockData.js';
import { getAreaColor } from '../utils/areaPalette.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const STATUS_FILTER_OPTIONS = ['All', 'compliant', 'warning', 'deviated', 'review'];

export default function RouteCompliancePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const alertIdParam = searchParams.get('alertId');

  const [search, setSearch]             = useState('');
  const [statusFilter, setFilter]       = useState('All');
  const [rows, setRows]                 = useState(MOCK_COMPLIANCE_ROWS);
  const [alerts, setAlerts]             = useState([]);
  const [demoAlerts, setDemoAlerts]     = useState([]);
  const [corridors, setCorridors]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [isDb2Loaded, setIsDb2Loaded]   = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Review modal state
  const [reviewModal, setReviewModal] = useState({
    open: false,
    alert: null,
    action: 'REVIEWED',
    note: '',
    submitting: false,
  });

  const fetchCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, alertRes, demoAlertRes, corridorsRes] = await Promise.all([
        api.get('/route-intelligence/compliance').catch(() => null),
        api.get('/route-intelligence/alerts').catch(() => null),
        api.get('/route-intelligence/demo/alerts').catch(() => null),
        api.get('/route-intelligence/route-corridors').catch(() => null),
      ]);

      if (compRes?.data?.success && compRes?.data?.data && compRes.data.data.length > 0) {
        setRows(compRes.data.data);
        setIsDb2Loaded(true);
      }
      if (alertRes?.data?.success && Array.isArray(alertRes.data?.data)) {
        setAlerts(alertRes.data.data);
      }
      if (demoAlertRes?.data?.success && Array.isArray(demoAlertRes.data?.data)) {
        setDemoAlerts(demoAlertRes.data.data);
      }
      if (corridorsRes?.data?.success && Array.isArray(corridorsRes.data?.data?.routes)) {
        setCorridors(corridorsRes.data.data.routes);
      }
    } catch (err) {
      console.warn('Failed to load DB2 Compliance data:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  // Deep link sync: if ?alertId=... exists, select that alert
  useEffect(() => {
    if (alertIdParam) {
      const allKnownAlerts = [...alerts, ...demoAlerts];
      const match = allKnownAlerts.find(a => String(a.id) === String(alertIdParam));
      if (match) {
        setSelectedAlert(match);
      }
    }
  }, [alertIdParam, alerts, demoAlerts]);

  const handleOpenAlertDrawer = (alertItem) => {
    setSelectedAlert(alertItem);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('alertId', alertItem.id);
    setSearchParams(nextParams);
  };

  const handleCloseAlertDrawer = () => {
    setSelectedAlert(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('alertId');
    setSearchParams(nextParams);
  };

  const handleAlertUpdated = (updatedAlert) => {
    if (updatedAlert.source === 'simulator') {
      setDemoAlerts(prev => prev.map(a => a.id === updatedAlert.id ? updatedAlert : a));
    } else {
      setAlerts(prev => prev.map(a => a.id === updatedAlert.id ? updatedAlert : a));
    }
    setSelectedAlert(updatedAlert);
  };

  const handleReviewSubmit = async () => {
    if (!reviewModal.alert) return;
    setReviewModal(prev => ({ ...prev, submitting: true }));
    try {
      const isSim = reviewModal.alert.source === 'simulator';
      const endpoint = isSim
        ? `/route-intelligence/demo/alerts/${reviewModal.alert.id}/review`
        : `/route-intelligence/alerts/${reviewModal.alert.id}/review`;

      const res = await api.patch(endpoint, {
        status: reviewModal.action,
        note: reviewModal.note,
      });
      if (res?.data?.success) {
        const updated = res.data.data?.alert || {
          ...reviewModal.alert,
          status: reviewModal.action,
          reviewNote: reviewModal.note,
        };
        handleAlertUpdated(updated);
        setReviewModal({ open: false, alert: null, action: 'REVIEWED', note: '', submitting: false });
      }
    } catch (err) {
      alert(`Failed to submit review: ${err.message}`);
      setReviewModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const filtered = rows.filter(row => {
    const matchSearch = (row?.dp || '').toLowerCase().includes((search || '').toLowerCase()) ||
                        (row?.assignedRoute || '').toLowerCase().includes((search || '').toLowerCase());
    const matchStatus = statusFilter === 'All' || row.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const inReviewAlerts = alerts.filter(a => a.status === 'TO_BE_REVIEWED');
  const inReviewDemoAlerts = demoAlerts.filter(a => a.status === 'TO_BE_REVIEWED');
  const totalCompliant = rows.filter(r => r.status === 'compliant').length;
  const totalDeviated  = rows.filter(r => r.status === 'deviated').length;
  const totalWarning   = rows.filter(r => r.status === 'warning').length;

  // Selected corridor polyline for drawer
  const selectedCorridorPolyline = selectedAlert
    ? corridors.find(c => c.name === selectedAlert.areaName || c.id === selectedAlert.areaId)?.polyline || []
    : [];

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Compliance"
        subtitle={
          <span>
            Monitor whether delivery partners stay on their assigned area route corridors
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" onClick={fetchCompliance} disabled={loading}>
          <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
        <button className="btn btn-secondary btn-sm"><MdDownload /> Export</button>
        <button className="btn btn-primary btn-sm"><MdFilterList /> Filter</button>
      </SectionHeader>

      {/* Summary KPIs */}
      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Partners (DB2)', value: rows.length,            color: 'var(--primary)' },
          { label: 'Compliant',             value: totalCompliant,         color: 'var(--success)' },
          { label: 'Off-Route Alerts',      value: inReviewAlerts.length,  color: 'var(--danger)'  },
          { label: 'Warnings',              value: totalWarning,           color: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--card-accent': s.color }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── SIMULATED OFF-ROUTE ALERTS (DEMO MODE SECTION) ────────────────── */}
      {demoAlerts.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            border: '1.5px solid #f59e0b',
            background: '#fffdf5',
          }}
        >
          <div className="card-header" style={{ paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="card-title" style={{ color: '#b45309' }}>
                    Simulated Off-Route Alerts (Demo Mode)
                  </span>
                  <span
                    className="badge"
                    style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: 10.5, fontWeight: 800 }}
                  >
                    SIMULATED
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  In-memory simulation alerts. Zero real database writes. Click any row to inspect replay.
                </div>
              </div>
            </div>
            <span className={`badge ${inReviewDemoAlerts.length > 0 ? 'badge-danger' : 'badge-success'}`}>
              {inReviewDemoAlerts.length} To Be Reviewed
            </span>
          </div>

          <div className="ri-compliance-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Simulated DP</th>
                  <th>Assigned Area</th>
                  <th>Deviation Type</th>
                  <th>Driving Off-Route</th>
                  <th>Stopped Off-Route</th>
                  <th>Max Offset</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {demoAlerts.map(alert => {
                  const areaColor = getAreaColor(alert.areaName || alert.areaId);
                  const drivingMin = alert.drivingSeconds ? `${Math.round(alert.drivingSeconds / 60)} min (${alert.drivingSeconds}s)` : '0 min';
                  const stoppedMin = alert.stoppedSeconds ? `${Math.round(alert.stoppedSeconds / 60)} min (${alert.stoppedSeconds}s)` : '0 min';

                  return (
                    <tr
                      key={alert.id}
                      style={{ cursor: 'pointer', background: alert.status === 'TO_BE_REVIEWED' ? '#fff9f0' : '#ffffff' }}
                      onClick={() => handleOpenAlertDrawer(alert)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: areaColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {alert.dpName ? alert.dpName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'SIM'}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600 }}>{alert.dpName}</span>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {alert.dpId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: areaColor }}>{alert.areaName}</span>
                      </td>
                      <td>
                        <span className={`badge ${alert.type === 'OFF_ROUTE_DRIVING' ? 'badge-warning' : 'badge-danger'}`}>
                          {alert.type === 'OFF_ROUTE_DRIVING' ? 'Driving Off-Route' : 'Stopped Off-Route'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, fontWeight: alert.drivingSeconds > 0 ? 600 : 400 }}>{drivingMin}</td>
                      <td style={{ fontSize: 13, fontWeight: alert.stoppedSeconds > 0 ? 600 : 400 }}>{stoppedMin}</td>
                      <td style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{alert.maxDistance}m</td>
                      <td>
                        <span className={`badge ${alert.status === 'TO_BE_REVIEWED' ? 'badge-danger' : alert.status === 'REVIEWED' ? 'badge-success' : 'badge-secondary'}`}>
                          {alert.status}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleOpenAlertDrawer(alert)}
                          >
                            Inspect & Replay
                          </button>
                          {alert.status === 'TO_BE_REVIEWED' && (
                            <button
                              className="btn btn-success btn-xs"
                              onClick={() => setReviewModal({ open: true, alert, action: 'REVIEWED', note: '', submitting: false })}
                            >
                              <MdCheck /> Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUPERADMIN REAL OFF-ROUTE ALERTS (IN REVIEW LIST) ───────────────── */}
      <div className="card" style={{ marginBottom: 24, border: inReviewAlerts.length > 0 ? '1.5px solid #fecaca' : '1px solid var(--border)' }}>
        <div className="card-header" style={{ paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <span className="card-title" style={{ color: inReviewAlerts.length > 0 ? '#991b1b' : 'inherit' }}>
                Off-Route Deviation Alerts — In Review
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Deviations exceeding permitted area corridor tolerance or stop/driving thresholds
              </div>
            </div>
          </div>
          <span className={`badge ${inReviewAlerts.length > 0 ? 'badge-danger' : 'badge-success'}`}>
            {inReviewAlerts.length} To Be Reviewed
          </span>
        </div>

        <div className="ri-compliance-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Delivery Partner</th>
                <th>Assigned Area</th>
                <th>Deviation Type</th>
                <th>Driving Off-Route</th>
                <th>Stopped Off-Route</th>
                <th>Max Offset</th>
                <th>Started At (IST)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inReviewAlerts.map(alert => {
                const areaColor = getAreaColor(alert.areaName || alert.areaId);
                const istTime = alert.startedAt ? new Date(alert.startedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }) : '—';
                const drivingMin = alert.drivingSeconds ? `${Math.round(alert.drivingSeconds / 60)} min (${alert.drivingSeconds}s)` : '0 min';
                const stoppedMin = alert.stoppedSeconds ? `${Math.round(alert.stoppedSeconds / 60)} min (${alert.stoppedSeconds}s)` : '0 min';

                return (
                  <tr
                    key={alert.id}
                    style={{ background: '#fff9f9', cursor: 'pointer' }}
                    onClick={() => handleOpenAlertDrawer(alert)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: areaColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {alert.dpName ? alert.dpName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'DP'}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600 }}>{alert.dpName}</span>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {alert.dpId}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: areaColor }}>
                        {alert.areaName}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${alert.type === 'OFF_ROUTE_DRIVING' ? 'badge-warning' : 'badge-danger'}`}>
                        {alert.type === 'OFF_ROUTE_DRIVING' ? 'Driving Off-Route' : 'Stopped Off-Route'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: alert.drivingSeconds > 0 ? 600 : 400 }}>{drivingMin}</td>
                    <td style={{ fontSize: 13, fontWeight: alert.stoppedSeconds > 0 ? 600 : 400 }}>{stoppedMin}</td>
                    <td style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{alert.maxDistance}m</td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{istTime}</td>
                    <td>
                      <span className="badge badge-danger">TO BE REVIEWED</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary btn-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleOpenAlertDrawer(alert)}
                        >
                          <MdLocationOn /> View & Replay
                        </button>
                        <button
                          className="btn btn-success btn-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setReviewModal({ open: true, alert, action: 'REVIEWED', note: '', submitting: false })}
                        >
                          <MdCheck /> Review
                        </button>
                        <button
                          className="btn btn-outline btn-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, borderColor: 'var(--border)' }}
                          onClick={() => setReviewModal({ open: true, alert, action: 'DISMISSED', note: '', submitting: false })}
                        >
                          <MdClose /> Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {inReviewAlerts.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <MdCheckCircle style={{ color: 'var(--success)', fontSize: 18 }} />
                      <span>All DPs on route. No off-route deviations pending review.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Action Modal */}
      {reviewModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 440, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {reviewModal.action === 'REVIEWED' ? 'Mark Alert as Reviewed' : 'Dismiss Alert'}
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setReviewModal({ open: false, alert: null, action: 'REVIEWED', note: '', submitting: false })}>
                <MdClose />
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Delivery Partner: <strong>{reviewModal.alert?.dpName}</strong> ({reviewModal.alert?.areaName})<br />
              Deviation: <strong>{reviewModal.alert?.maxDistance}m</strong> off-route • {reviewModal.alert?.type}
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">SuperAdmin Review Note:</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder={reviewModal.action === 'REVIEWED' ? 'e.g., Road work diversion verified with DP; approved.' : 'e.g., Temporary detour due to roadblock.'}
                value={reviewModal.note}
                onChange={e => setReviewModal(prev => ({ ...prev, note: e.target.value }))}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setReviewModal({ open: false, alert: null, action: 'REVIEWED', note: '', submitting: false })}
                disabled={reviewModal.submitting}
              >
                Cancel
              </button>
              <button
                className={`btn btn-sm ${reviewModal.action === 'REVIEWED' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleReviewSubmit}
                disabled={reviewModal.submitting}
              >
                {reviewModal.submitting ? 'Submitting...' : `Confirm ${reviewModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Detail Drawer */}
      {selectedAlert && (
        <AlertDetailDrawer
          alert={selectedAlert}
          onClose={handleCloseAlertDrawer}
          onAlertUpdated={handleAlertUpdated}
          corridorPolyline={selectedCorridorPolyline}
        />
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 17 }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by name or route..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%' }}
              id="ri-compliance-search"
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`btn btn-sm ${statusFilter === opt ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(opt)}
                id={`ri-filter-${opt}`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance Table */}
      <div className="card">
        <div className="card-header" style={{ paddingBottom: 0 }}>
          <span className="card-title">Compliance Records</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{filtered.length} DB2 records</span>
        </div>
        <div className="ri-compliance-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Delivery Partner</th>
                <th>Assigned Route</th>
                <th>Entered Route</th>
                <th>Entry Time</th>
                <th>Exit Time</th>
                <th>Driving Time</th>
                <th>Stopped Time</th>
                <th>Distance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const areaColor = row.areaColor || getAreaColor(row.assignedRoute);
                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: areaColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {row.dp.split(' ').map(w=>w[0]).join('').slice(0,2)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{row.dp}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: areaColor }}>{row.assignedRoute}</td>
                    <td>
                      <span style={{
                        fontSize: 13,
                        color: row.enteredRoute !== row.assignedRoute ? 'var(--danger)' : 'var(--success)',
                        fontWeight: row.enteredRoute !== row.assignedRoute ? 700 : 400,
                      }}>
                        {row.enteredRoute}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{row.entryTime}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.exitTime}</td>
                    <td style={{ fontSize: 13 }}>{row.drivingTime}</td>
                    <td style={{ fontSize: 13 }}>{row.stoppedTime}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{row.distanceKm}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          id={`ri-view-${row.id}`}
                          style={{ fontSize: 12 }}
                          onClick={() => navigate('/route-intelligence/live')}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    No records match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
