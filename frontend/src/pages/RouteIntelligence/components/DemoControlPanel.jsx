import React, { useState } from 'react';
import {
  MdPlayArrow, MdPause, MdRefresh, MdSpeed, MdWarningAmber,
  MdDirectionsBike, MdCheckCircle, MdTimer, MdTrendingFlat,
  MdErrorOutline, MdStorefront, MdRestore, MdInfo, MdClose
} from 'react-icons/md';
import api from '../../../services/api';
import { getAreaColor } from '../utils/areaPalette.js';
import './RouteIntelligence.css';

const SCENARIOS = [
  { id: 'diversion', label: 'Diversion', desc: 'Departs corridor (25 km/h)', color: '#f59e0b', icon: <MdTrendingFlat /> },
  { id: 'off-route-stopped', label: 'Off-Route Stop', desc: 'Stops outside corridor (0 km/h)', color: '#ef4444', icon: <MdErrorOutline /> },
  { id: 'customer-stop', label: 'Customer Stop', desc: 'Stops inside corridor (Delivery)', color: '#10b981', icon: <MdStorefront /> },
  { id: 'return-to-route', label: 'Return to Route', desc: 'Re-enters corridor', color: '#3b82f6', icon: <MdCheckCircle /> },
];

const SPEED_OPTIONS = [1, 5, 10, 30];

export default function DemoControlPanel({
  status,
  selectedDpId,
  onSelectDp,
  onStatusChange,
}) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showSummary, setShowSummary] = useState(true);

  const isRunning = Boolean(status?.isRunning);
  const currentSpeed = status?.speedMultiplier || status?.speed || 1;
  const dps = status?.dps || [];
  const selectedDp = dps.find(d => d.id === selectedDpId) || dps[0] || null;
  const activeScenario = status?.activeGuidedScenario || null;
  const lastClosedSession = status?.lastClosedSession || null;

  const handleStart = async () => {
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const res = await api.post('/route-intelligence/demo/start');
      if (res?.data?.data && onStatusChange) {
        onStatusChange(res.data.data);
      }
    } catch (err) {
      console.error('Failed to start simulation:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePause = async () => {
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const res = await api.post('/route-intelligence/demo/pause');
      if (res?.data?.data && onStatusChange) {
        onStatusChange(res.data.data);
      }
    } catch (err) {
      console.error('Failed to pause simulation:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReset = async () => {
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const res = await api.post('/route-intelligence/demo/reset');
      if (res?.data?.data && onStatusChange) {
        onStatusChange(res.data.data);
      }
    } catch (err) {
      console.error('Failed to reset simulation:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSetSpeed = async (newSpeed) => {
    try {
      const res = await api.post('/route-intelligence/demo/speed', { speed: newSpeed });
      if (res?.data?.data && onStatusChange) {
        onStatusChange(res.data.data);
      }
    } catch (err) {
      console.error('Failed to change speed:', err);
    }
  };

  // Launch Guided Scenario 1 or 2
  const handleLaunchGuidedScenario = async (scenarioId) => {
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const targetDpId = scenarioId === 'scenario1' ? 'SIM-001' : 'SIM-002';
      if (onSelectDp) onSelectDp(targetDpId);

      const res = await api.post('/route-intelligence/demo/scenario/guided', { scenarioId });
      if (res?.data?.data && onStatusChange) {
        onStatusChange(res.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start guided scenario';
      setErrorMessage(msg);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTriggerScenario = async (scenarioId) => {
    if (!selectedDp) return;
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const res = await api.post('/route-intelligence/demo/scenario', {
        dpId: selectedDp.id,
        scenario: scenarioId,
      });
      if (res?.data?.data && onStatusChange) {
        onStatusChange(res.data.data);
      }
    } catch (err) {
      console.error('Failed to trigger scenario:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const areaColor = selectedDp ? (selectedDp.areaColor || getAreaColor(selectedDp.areaName)) : '#3b82f6';

  // Compute countdown / grace status
  let graceDisplay = 'Compliant inside corridor';
  if (selectedDp) {
    if (selectedDp.currentState === 'OFF_ROUTE_DRIVING') {
      const drivingSec = selectedDp.drivingSeconds || 0;
      if (drivingSec < 180) {
        graceDisplay = `Grace: ${180 - drivingSec}s remaining`;
      } else {
        graceDisplay = 'Grace Expired — Alert Active';
      }
    } else if (selectedDp.currentState === 'OFF_ROUTE_STOPPED') {
      const stoppedSec = selectedDp.stoppedSeconds || 0;
      if (stoppedSec < 120) {
        graceDisplay = `Grace: ${120 - stoppedSec}s remaining`;
      } else {
        graceDisplay = 'Stop Grace Expired — Alert Active';
      }
    }
  }

  const formatIST = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ' IST';
  };

  return (
    <div className="ri-demo-container">
      {/* Simulation Warning Banner */}
      <div className="ri-demo-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MdWarningAmber size={20} color="#b45309" />
          <span>
            <strong>Simulation:</strong> real areas and customers, simulated delivery partners and GPS. Zero database writes.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>
            🕒 {status?.simulatedTimeFormatted || '06:00:00 AM IST'}
          </span>
          <span
            className="badge"
            style={{
              background: isRunning ? '#10b981' : '#64748b',
              color: '#ffffff',
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {isRunning ? 'RUNNING' : 'PAUSED'}
          </span>
        </div>
      </div>

      {/* Guided Scenarios Launch Section */}
      <div
        style={{
          background: '#f8fafc',
          border: '1.5px solid #cbd5e1',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🎬 Guided Demo Scenarios:
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            💡 <em>Detours exceeding the 180s grace period trigger alerts. Short detours under 180s resolve quietly without an alert.</em>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm"
            onClick={() => handleLaunchGuidedScenario('scenario1')}
            disabled={loadingAction}
            style={{
              background: activeScenario?.id === 'scenario1' ? '#2563eb' : '#ffffff',
              color: activeScenario?.id === 'scenario1' ? '#ffffff' : '#1e3a8a',
              border: '1.5px solid #2563eb',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            id="ri-launch-scenario-1"
          >
            <MdDirectionsBike size={16} /> Scenario 1: Detour without stopping (Demo Rider 1)
          </button>

          <button
            className="btn btn-sm"
            onClick={() => handleLaunchGuidedScenario('scenario2')}
            disabled={loadingAction}
            style={{
              background: activeScenario?.id === 'scenario2' ? '#059669' : '#ffffff',
              color: activeScenario?.id === 'scenario2' ? '#ffffff' : '#065f46',
              border: '1.5px solid #059669',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            id="ri-launch-scenario-2"
          >
            <MdTimer size={16} /> Scenario 2: Detour with a wait (Demo Rider 2)
          </button>
        </div>

        {errorMessage && (
          <div style={{ marginTop: 8, color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

      {/* Step-by-Step Guided Timeline HUD */}
      {activeScenario && (
        <div
          style={{
            background: '#eff6ff',
            border: '1.5px solid #3b82f6',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="badge badge-primary"
                style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px' }}
              >
                LIVE STEP {activeScenario.stepIndex} OF {activeScenario.totalSteps}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                {activeScenario.phaseTitle}
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Rider: <strong>{activeScenario.dpName}</strong> ({activeScenario.areaName})
            </span>
          </div>

          <div style={{ fontSize: 12.5, color: '#1e3a8a', background: 'rgba(255,255,255,0.7)', padding: '6px 10px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
            {activeScenario.phaseDetail}
          </div>
        </div>
      )}

      {/* Condition 6: Closed Session Summary Card (Appears whenever a session closes) */}
      {lastClosedSession && showSummary && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1.5px solid #16a34a',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 14,
            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdCheckCircle size={18} color="#16a34a" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>
                Deviation Session Closed & Resolved
              </span>
              <span
                className="badge"
                style={{
                  background: lastClosedSession.alertTriggered ? '#fee2e2' : '#dbeafe',
                  color: lastClosedSession.alertTriggered ? '#dc2626' : '#1e40af',
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {lastClosedSession.alertTriggered ? 'ALERT FIRED' : 'RESOLVED UNDER GRACE'}
              </span>
            </div>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setShowSummary(false)}
              style={{ padding: 2 }}
              title="Dismiss summary"
            >
              <MdClose />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, fontSize: 12 }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Rider & Area:</span>
              <div style={{ fontWeight: 700 }}>{lastClosedSession.dpName} ({lastClosedSession.areaName})</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Driving Time:</span>
              <div style={{ fontWeight: 700, color: '#2563eb' }}>{lastClosedSession.totalDrivingSeconds}s ({Math.round(lastClosedSession.totalDrivingSeconds / 60)} min)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Stopped Time:</span>
              <div style={{ fontWeight: 700, color: '#d97706' }}>{lastClosedSession.totalStoppedSeconds}s ({Math.round(lastClosedSession.totalStoppedSeconds / 60)} min)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Max Corridor Offset:</span>
              <div style={{ fontWeight: 700, color: '#dc2626' }}>{lastClosedSession.maxDistanceFromCorridor} m</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Window (IST):</span>
              <div style={{ fontWeight: 600, fontSize: 11 }}>
                {formatIST(lastClosedSession.startedAt)} → {formatIST(lastClosedSession.endedAt)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clock Controls Row */}
      <div className="ri-demo-row">
        {/* Play / Pause / Reset buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isRunning ? (
            <button
              className="btn btn-warning btn-sm"
              onClick={handlePause}
              disabled={loadingAction}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              id="ri-demo-pause-btn"
            >
              <MdPause size={16} /> Pause
            </button>
          ) : (
            <button
              className="btn btn-success btn-sm"
              onClick={handleStart}
              disabled={loadingAction}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              id="ri-demo-start-btn"
            >
              <MdPlayArrow size={16} /> Resume / Start
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReset}
            disabled={loadingAction}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            id="ri-demo-reset-btn"
            title="Reset simulation to depot at 06:00 AM"
          >
            <MdRestore size={16} /> Reset
          </button>
        </div>

        {/* Speed Multiplier Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Clock Speed:
          </span>
          <div className="ri-speed-btn-group">
            {SPEED_OPTIONS.map(spd => (
              <button
                key={spd}
                className={`ri-speed-btn ${currentSpeed === spd ? 'active' : ''}`}
                onClick={() => handleSetSpeed(spd)}
                id={`ri-demo-speed-${spd}x`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* DP Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select Rider:
          </span>
          <select
            className="form-input form-input-sm"
            value={selectedDp?.id || ''}
            onChange={e => onSelectDp && onSelectDp(e.target.value)}
            style={{ minWidth: 180, fontWeight: 600 }}
            id="ri-demo-rider-select"
          >
            {dps.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.areaName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Basic Scenario Buttons Row */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          Manual Triggers for {selectedDp?.name || 'Selected Rider'}:
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SCENARIOS.map(sc => {
            const isCurrentScenario = selectedDp?.scenario === sc.id;
            return (
              <button
                key={sc.id}
                className="btn btn-sm"
                onClick={() => handleTriggerScenario(sc.id)}
                disabled={loadingAction}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: `1.5px solid ${sc.color}`,
                  background: isCurrentScenario ? sc.color : '#ffffff',
                  color: isCurrentScenario ? '#ffffff' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: 12,
                }}
                id={`ri-scenario-${sc.id}`}
                title={sc.desc}
              >
                {sc.icon} {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected DP Telemetry HUD */}
      {selectedDp && (
        <div className="ri-demo-hud">
          <div>
            <div className="ri-hud-stat">Rider & Area</div>
            <div className="ri-hud-val" style={{ color: areaColor, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: areaColor }} />
              {selectedDp.name} • {selectedDp.areaName}
            </div>
          </div>

          <div>
            <div className="ri-hud-stat">Current State</div>
            <div
              className="ri-hud-val"
              style={{
                color:
                  selectedDp.status === 'RED'
                    ? '#dc2626'
                    : selectedDp.status === 'YELLOW'
                    ? '#d97706'
                    : '#16a34a',
              }}
            >
              {selectedDp.currentState || 'ON_ROUTE'}
            </div>
          </div>

          <div>
            <div className="ri-hud-stat">Corridor Distance</div>
            <div
              className="ri-hud-val"
              style={{
                color: selectedDp.isWithinCorridor ? '#16a34a' : '#dc2626',
              }}
            >
              {selectedDp.distanceFromRouteMeters || selectedDp.lastDistanceMeters || 0} m
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                ({selectedDp.isWithinCorridor ? 'In Corridor' : 'Off Corridor'})
              </span>
            </div>
          </div>

          <div>
            <div className="ri-hud-stat">Off-Route Timers</div>
            <div className="ri-hud-val" style={{ fontSize: 12 }}>
              Drive: <strong>{selectedDp.drivingSeconds || 0}s</strong> | Stop: <strong>{selectedDp.stoppedSeconds || 0}s</strong>
            </div>
          </div>

          <div>
            <div className="ri-hud-stat">Alert / Grace Countdown</div>
            <div
              className="ri-hud-val"
              style={{
                fontSize: 12,
                color:
                  selectedDp.status === 'RED'
                    ? '#dc2626'
                    : selectedDp.status === 'YELLOW'
                    ? '#b45309'
                    : '#16a34a',
              }}
            >
              {graceDisplay}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
