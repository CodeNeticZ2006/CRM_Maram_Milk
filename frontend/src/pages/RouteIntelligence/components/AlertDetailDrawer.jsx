import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdClose, MdCheckCircle, MdWarning, MdAccessTime, MdLocationOn,
  MdSpeed, MdDirectionsBike, MdCheck, MdOpenInNew, MdRefresh
} from 'react-icons/md';
import RoutePlayer from './RoutePlayer.jsx';
import {
  LeafletMapContainer, RoutePolyline, DeliveryPartnerMarker,
  HeadOfficeMarker, HEAD_OFFICE
} from '../maps/index.js';
import { getAreaColor } from '../utils/areaPalette.js';
import api from '../../../services/api';
import './RouteIntelligence.css';

export default function AlertDetailDrawer({
  alert: initialAlert,
  onClose,
  onAlertUpdated,
  corridorPolyline = [],
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'replay' | 'map'
  const [alert, setAlert] = useState(initialAlert);
  const [replayData, setReplayData] = useState(null);
  const [loadingReplay, setLoadingReplay] = useState(false);

  // Review action form state
  const [reviewAction, setReviewAction] = useState('REVIEWED'); // 'REVIEWED' | 'DISMISSED'
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  useEffect(() => {
    setAlert(initialAlert);
    if (initialAlert?.reviewNote) {
      setReviewNote(initialAlert.reviewNote);
    }
  }, [initialAlert]);

  const isSimulated = alert?.source === 'simulator';
  const areaColor = getAreaColor(alert?.areaName || alert?.areaId);

  // Fetch replay telemetry when replay tab opens
  const fetchReplayStream = useCallback(async () => {
    if (!alert?.id) return;
    setLoadingReplay(true);
    try {
      if (isSimulated) {
        const res = await api.get('/route-intelligence/demo/replay-stream', {
          params: { alertId: alert.id, dpId: alert.dpId }
        });
        if (res?.data?.success && res.data?.data) {
          setReplayData(res.data.data);
        }
      } else {
        // Real alert: use alert trail or check replay endpoint
        setReplayData({
          pings: alert.trail || [],
          deviationTrail: alert.trail || [],
        });
      }
    } catch (err) {
      console.warn('Failed to load alert replay stream:', err.message);
    } finally {
      setLoadingReplay(false);
    }
  }, [alert?.id, alert?.dpId, alert?.trail, isSimulated]);

  useEffect(() => {
    if (activeTab === 'replay' && !replayData) {
      fetchReplayStream();
    }
  }, [activeTab, replayData, fetchReplayStream]);

  // Submit Review or Dismiss
  const handleSubmitReview = async () => {
    if (!alert?.id) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const endpoint = isSimulated
        ? `/route-intelligence/demo/alerts/${alert.id}/review`
        : `/route-intelligence/alerts/${alert.id}/review`;

      const res = await api.patch(endpoint, {
        status: reviewAction,
        note: reviewNote,
      });

      if (res?.data?.success) {
        const updatedAlert = res.data.data?.alert || {
          ...alert,
          status: reviewAction,
          reviewNote: reviewNote,
          reviewedBy: 'SuperAdmin',
          reviewedAt: new Date().toISOString(),
        };

        setAlert(updatedAlert);
        if (onAlertUpdated) {
          onAlertUpdated(updatedAlert);
        }
      }
    } catch (err) {
      setReviewError(err?.response?.data?.message || err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!alert) return null;

  const istStartTime = alert.startedAt
    ? new Date(alert.startedAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : '—';

  const istReviewedTime = alert.reviewedAt
    ? new Date(alert.reviewedAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : null;

  const drivingMin = `${Math.round((alert.drivingSeconds || 0) / 60)} min (${alert.drivingSeconds || 0}s)`;
  const stoppedMin = `${Math.round((alert.stoppedSeconds || 0) / 60)} min (${alert.stoppedSeconds || 0}s)`;

  return (
    <div className="ri-drawer-overlay" onClick={onClose}>
      <div className="ri-drawer-content" onClick={e => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="ri-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🚨</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Deviation Alert
                </span>
                {isSimulated && (
                  <span
                    className="badge"
                    style={{
                      background: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    SIMULATED
                  </span>
                )}
                <span
                  className={`badge ${
                    alert.status === 'TO_BE_REVIEWED'
                      ? 'badge-danger'
                      : alert.status === 'REVIEWED'
                      ? 'badge-success'
                      : 'badge-secondary'
                  }`}
                  style={{ fontSize: 11 }}
                >
                  {alert.status === 'TO_BE_REVIEWED' ? 'To Be Reviewed' : alert.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Alert ID: {alert.id}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={onClose}
            title="Close Drawer"
            style={{ fontSize: 18, padding: 6 }}
          >
            <MdClose />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="ri-drawer-tabs">
          <button
            className={`ri-drawer-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary & Review
          </button>
          <button
            className={`ri-drawer-tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            Replay Telemetry
          </button>
          <button
            className={`ri-drawer-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            Live Mini-Map
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="ri-drawer-body" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* ── TAB 1: SUMMARY ──────────────────────────────────────────────── */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* DP Banner */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: areaColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: 16,
                    fontWeight: 800,
                  }}
                >
                  {alert.dpName ? alert.dpName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'DP'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                    {alert.dpName || alert.dpId}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, marginTop: 2 }}>
                    <span>DP ID: <strong>{alert.dpId}</strong></span>
                    <span>•</span>
                    <span style={{ color: areaColor, fontWeight: 700 }}>{alert.areaName}</span>
                  </div>
                </div>
                <span className={`badge ${alert.type === 'OFF_ROUTE_DRIVING' ? 'badge-warning' : 'badge-danger'}`}>
                  {alert.type === 'OFF_ROUTE_DRIVING' ? 'Driving Off-Route' : 'Stopped Off-Route'}
                </span>
              </div>

              {/* Deviation Details Grid */}
              <div className="ri-stat-grid-3" style={{ gap: 12 }}>
                <div className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Max Corridor Offset</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                    {alert.maxDistance || 0} m
                  </div>
                </div>
                <div className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Driving Off-Route</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                    {drivingMin}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stopped Off-Route</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                    {stoppedMin}
                  </div>
                </div>
              </div>

              {/* Timing & Location Info */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Incident Telemetry</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Deviation Start Time (IST):</span>
                    <span style={{ fontWeight: 600 }}>{istStartTime}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Reported Coordinates:</span>
                    <span style={{ fontWeight: 600 }}>
                      {alert.location?.lat ? `${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Corridor Source:</span>
                    <span>{isSimulated ? 'Simulation Sandbox (In-Memory)' : 'Production Route Engine'}</span>
                  </div>
                </div>
              </div>

              {/* Review / Status Action Section */}
              {alert.status === 'TO_BE_REVIEWED' ? (
                <div
                  className="card"
                  style={{
                    padding: 18,
                    border: '1.5px solid #fecaca',
                    background: '#fffdfd',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b', marginBottom: 12 }}>
                    SuperAdmin Review Action
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${reviewAction === 'REVIEWED' ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => setReviewAction('REVIEWED')}
                    >
                      <MdCheck /> Mark as Reviewed
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${reviewAction === 'DISMISSED' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => setReviewAction('DISMISSED')}
                    >
                      <MdClose /> Dismiss Alert
                    </button>
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                      Review Notes & Explanation:
                    </label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder={
                        reviewAction === 'REVIEWED'
                          ? 'e.g., Road construction detour verified with rider; approved.'
                          : 'e.g., False positive, GPS drift while waiting at traffic signal.'
                      }
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  {reviewError && (
                    <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>
                      {reviewError}
                    </div>
                  )}

                  <button
                    className={`btn btn-sm ${reviewAction === 'REVIEWED' ? 'btn-success' : 'btn-danger'}`}
                    onClick={handleSubmitReview}
                    disabled={submittingReview}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {submittingReview
                      ? 'Submitting Decision...'
                      : `Confirm ${reviewAction === 'REVIEWED' ? 'Review & Approve' : 'Dismissal'}`}
                  </button>
                </div>
              ) : (
                /* Already Reviewed Card */
                <div
                  className="card"
                  style={{
                    padding: 18,
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <MdCheckCircle style={{ color: '#16a34a', fontSize: 20 }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#166534' }}>
                      Alert Decision Recorded ({alert.status})
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#1f2937', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      Reviewed By: <strong>{alert.reviewedBy || 'SuperAdmin'}</strong>
                    </div>
                    {istReviewedTime && (
                      <div>
                        Reviewed At: <strong>{istReviewedTime}</strong>
                      </div>
                    )}
                    <div>
                      Review Note:{' '}
                      <em>{alert.reviewNote ? `"${alert.reviewNote}"` : '(No note provided)'}</em>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: REPLAY ───────────────────────────────────────────────── */}
          {activeTab === 'replay' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Interactive Trajectory Replay (±10m Window)
                </span>
                <button
                  className="btn btn-secondary btn-xs"
                  onClick={fetchReplayStream}
                  disabled={loadingReplay}
                >
                  <MdRefresh className={loadingReplay ? 'spin' : ''} /> {loadingReplay ? 'Loading...' : 'Reload Stream'}
                </button>
              </div>

              {loadingReplay ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Loading replay pings...
                </div>
              ) : (
                <RoutePlayer
                  dp={{
                    id: alert.dpId,
                    name: alert.dpName,
                    route: alert.areaName,
                    areaColor,
                  }}
                  corridorPolyline={corridorPolyline}
                  deviationTrail={alert.trail || replayData?.deviationTrail || []}
                  pings={replayData?.pings || alert.trail || []}
                  height={320}
                  isSimulated={isSimulated}
                  emptyMessage="No telemetry pings logged for this incident yet."
                />
              )}
            </div>
          )}

          {/* ── TAB 3: LIVE MINI-MAP ────────────────────────────────────────── */}
          {activeTab === 'map' && (
            <div>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Incident Map Overview
                </span>
                <button
                  className="btn btn-primary btn-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    const lat = alert.location?.lat || 13.0604;
                    const lng = alert.location?.lng || 80.2496;
                    navigate(`/route-intelligence/live?alertId=${alert.id}&lat=${lat}&lng=${lng}&dpId=${alert.dpId}`);
                  }}
                >
                  <MdOpenInNew /> Open in Live Operations
                </button>
              </div>

              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <LeafletMapContainer
                  height={340}
                  center={[alert.location?.lat || 13.0604, alert.location?.lng || 80.2496]}
                  zoom={15}
                  legendItems={[
                    { label: alert.areaName, color: areaColor },
                    { label: 'Off-Route Trail', color: '#dc2626' },
                    { label: 'Incident Point', color: '#dc2626', shape: 'circle' },
                  ]}
                >
                  {({ showRoutes }) => (
                    <>
                      <HeadOfficeMarker office={HEAD_OFFICE} />

                      {/* Area Corridor */}
                      {showRoutes && corridorPolyline.length > 0 && (
                        <RoutePolyline
                          coordinates={corridorPolyline}
                          color={areaColor}
                          weight={4}
                          routeName={`${alert.areaName} Corridor`}
                        />
                      )}

                      {/* Deviation Trail */}
                      {showRoutes && alert.trail && alert.trail.length > 0 && (
                        <RoutePolyline
                          coordinates={alert.trail.map(t => [t.lat, t.lng])}
                          color="#dc2626"
                          weight={5.5}
                          dashArray="4, 4"
                          routeName="Incident Deviation Trail"
                        />
                      )}

                      {/* Incident Bike Marker */}
                      <DeliveryPartnerMarker
                        partner={{
                          id: alert.dpId,
                          name: alert.dpName,
                          route: alert.areaName,
                          areaColor,
                          status: 'RED',
                          lat: alert.location?.lat || 13.0604,
                          lng: alert.location?.lng || 80.2496,
                          speed: alert.location?.speed || 0,
                          heading: alert.location?.heading || 0,
                          isSimulated,
                          source: isSimulated ? 'simulator' : 'live',
                        }}
                      />
                    </>
                  )}
                </LeafletMapContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
