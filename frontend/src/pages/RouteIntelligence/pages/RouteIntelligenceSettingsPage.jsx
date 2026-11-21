import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import {
  MdGpsFixed, MdSpeed, MdTimer,
  MdRule, MdSave, MdInfoOutline, MdCheckCircle,
  MdRestartAlt, MdSchedule, MdNotificationsActive,
} from 'react-icons/md';
import { SectionHeader } from '../components/index.jsx';
import api from '../../../services/api';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const DEFAULT_SETTINGS_FALLBACK = {
  gpsUpdateInterval: 30,
  maxGpsAccuracyMeters: 50,
  signalLostThresholdMinutes: 10,
  corridorToleranceMeters: 120,
  corridorGracePeriodSeconds: 180,
  hysteresisCount: 2,
  stopSpeedThresholdKmh: 3.0,
  drivingAlertThresholdSeconds: 300,
  stoppedAlertThresholdSeconds: 300,
  inAppAlerts: true,
  trackingWindow: {
    enabled: false,
    startTime: '04:00',
    endTime: '11:00',
  },
  geofenceRadius: 500,
  updatedAt: '',
  updatedBy: 'System',
};

function SettingsCard({ icon, title, desc, children }) {
  return (
    <div className="card ri-settings-card">
      <div className="ri-settings-card-title">
        <span style={{ fontSize: 18, color: 'var(--primary)' }}>{icon}</span>
        {title}
      </div>
      <div className="ri-settings-card-desc">{desc}</div>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, unit, id, min, max, step = 1, helper, error }) {
  return (
    <div className="ri-settings-field form-group" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label className="form-label" htmlFor={id} style={{ marginBottom: 0, fontWeight: 600, fontSize: 13 }}>
          {label}
        </label>
        {min !== undefined && max !== undefined && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Allowed: {min}–{max} {unit || ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          className={`form-input ${error ? 'input-error' : ''}`}
          value={value !== undefined && value !== null ? value : ''}
          onChange={e => {
            const raw = e.target.value;
            onChange(raw === '' ? '' : Number(raw));
          }}
          style={{ flex: 1, borderColor: error ? 'var(--danger, #ef4444)' : undefined }}
        />
        {unit && <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{unit}</span>}
      </div>
      {helper && !error && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{helper}</div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger, #ef4444)', marginTop: 4, fontWeight: 600 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default function RouteIntelligenceSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS_FALLBACK);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await api.get('/route-intelligence/settings');
      if (res.data?.success && res.data?.data) {
        setSettings({
          ...DEFAULT_SETTINGS_FALLBACK,
          ...res.data.data,
          trackingWindow: {
            ...DEFAULT_SETTINGS_FALLBACK.trackingWindow,
            ...(res.data.data.trackingWindow || {}),
          },
        });
      }
    } catch (err) {
      console.warn('Failed to load settings from API:', err.message);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Validation checks
  const errors = useMemo(() => {
    const errs = {};
    if (settings.gpsUpdateInterval < 10 || settings.gpsUpdateInterval > 300) {
      errs.gpsUpdateInterval = 'Update interval must be between 10 and 300 seconds';
    }
    if (settings.maxGpsAccuracyMeters < 10 || settings.maxGpsAccuracyMeters > 200) {
      errs.maxGpsAccuracyMeters = 'GPS accuracy threshold must be between 10 and 200 meters';
    }
    if (settings.signalLostThresholdMinutes < 1 || settings.signalLostThresholdMinutes > 60) {
      errs.signalLostThresholdMinutes = 'Signal lost threshold must be between 1 and 60 minutes';
    }
    if (settings.corridorToleranceMeters < 30 || settings.corridorToleranceMeters > 500) {
      errs.corridorToleranceMeters = 'Corridor tolerance buffer must be between 30 and 500 meters';
    }
    if (settings.corridorGracePeriodSeconds < 30 || settings.corridorGracePeriodSeconds > 900) {
      errs.corridorGracePeriodSeconds = 'Grace period must be between 30 and 900 seconds';
    }
    if (settings.hysteresisCount < 1 || settings.hysteresisCount > 5) {
      errs.hysteresisCount = 'Confirmation pings must be between 1 and 5';
    }
    if (settings.stopSpeedThresholdKmh < 0.5 || settings.stopSpeedThresholdKmh > 20) {
      errs.stopSpeedThresholdKmh = 'Stationary speed must be between 0.5 and 20 km/h';
    }
    if (settings.drivingAlertThresholdSeconds < 60 || settings.drivingAlertThresholdSeconds > 1800) {
      errs.drivingAlertThresholdSeconds = 'Driving alert timer must be between 60 and 1800 seconds';
    }
    if (settings.stoppedAlertThresholdSeconds < 60 || settings.stoppedAlertThresholdSeconds > 1800) {
      errs.stoppedAlertThresholdSeconds = 'Stopped alert timer must be between 60 and 1800 seconds';
    }
    return errs;
  }, [settings]);

  const isValid = Object.keys(errors).length === 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');
    try {
      const res = await api.put('/route-intelligence/settings', settings);
      if (res.data?.success && res.data?.data) {
        setSettings({
          ...DEFAULT_SETTINGS_FALLBACK,
          ...res.data.data,
          trackingWindow: {
            ...DEFAULT_SETTINGS_FALLBACK.trackingWindow,
            ...(res.data.data.trackingWindow || {}),
          },
        });
        setSavedMsg('Settings saved successfully and persisted across server restarts!');
        setTimeout(() => setSavedMsg(''), 4500);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save settings to backend.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm('Reset all Route Intelligence settings to canonical factory defaults?')) {
      return;
    }
    setResetting(true);
    setSavedMsg('');
    setErrorMsg('');
    try {
      const res = await api.put('/route-intelligence/settings', { reset: true });
      if (res.data?.success && res.data?.data) {
        setSettings({
          ...DEFAULT_SETTINGS_FALLBACK,
          ...res.data.data,
          trackingWindow: {
            ...DEFAULT_SETTINGS_FALLBACK.trackingWindow,
            ...(res.data.data.trackingWindow || {}),
          },
        });
        setSavedMsg('Settings reset to factory defaults and persisted to disk.');
        setTimeout(() => setSavedMsg(''), 4500);
      }
    } catch (err) {
      setErrorMsg('Failed to reset settings.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Intelligence Settings"
        subtitle="Configure active tracking parameters, corridor buffers, off-route timers, and delivery tracking windows"
      >
        <button
          className="btn btn-secondary btn-sm"
          id="ri-settings-reset-btn"
          onClick={handleResetToDefaults}
          disabled={resetting || saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <MdRestartAlt size={16} /> {resetting ? 'Resetting...' : 'Reset to Defaults'}
        </button>
        <button
          className="btn btn-primary"
          id="ri-settings-save-btn"
          onClick={handleSave}
          disabled={saving || !isValid}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <MdSave size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </SectionHeader>

      {/* Status & Banner Alerts */}
      {savedMsg && (
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--success, #10b981)',
          fontWeight: 600,
        }}>
          <MdCheckCircle style={{ fontSize: 18 }} /> {savedMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--danger, #ef4444)',
          fontWeight: 600,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Metadata & Persistence Banner */}
      <div style={{
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 24,
        fontSize: 12.5,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MdInfoOutline style={{ color: 'var(--primary)', fontSize: 18, flexShrink: 0 }} />
          <span>Settings are persisted to <code>backend/data/routeSettings.json</code> and survive server restarts.</span>
        </div>
        {settings.updatedAt && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Last saved by <strong>{settings.updatedBy || 'SuperAdmin'}</strong> at {new Date(settings.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </div>
        )}
      </div>

      <div className="ri-settings-grid">
        {/* Card 1: GPS Tracking */}
        <SettingsCard
          icon={<MdGpsFixed />}
          title="GPS Tracking Parameters"
          desc="Polling intervals, noise rejection thresholds, and offline timeouts"
        >
          <NumberField
            id="ri-setting-gps-interval"
            label="GPS Polling Interval"
            value={settings.gpsUpdateInterval}
            onChange={v => setSettings(s => ({ ...s, gpsUpdateInterval: v }))}
            unit="seconds"
            min={10}
            max={300}
            helper="Controls the live map auto-refresh interval on Live Operations and the suggested ping interval (nextIntervalSeconds) returned to field devices"
            error={errors.gpsUpdateInterval}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: -8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[10, 30, 60, 120].map(v => (
              <button
                key={v}
                type="button"
                className={`btn btn-xs ${settings.gpsUpdateInterval === v ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setSettings(s => ({ ...s, gpsUpdateInterval: v }))}
                id={`ri-gps-preset-${v}`}
              >
                {v}s
              </button>
            ))}
          </div>

          <NumberField
            id="ri-setting-gps-accuracy"
            label="Max GPS Accuracy Error"
            value={settings.maxGpsAccuracyMeters}
            onChange={v => setSettings(s => ({ ...s, maxGpsAccuracyMeters: v }))}
            unit="meters"
            min={10}
            max={200}
            helper="Pings with horizontal accuracy error greater than this are dropped as noise"
            error={errors.maxGpsAccuracyMeters}
          />

          <NumberField
            id="ri-setting-signal-lost"
            label="Signal Lost Timeout"
            value={settings.signalLostThresholdMinutes}
            onChange={v => setSettings(s => ({ ...s, signalLostThresholdMinutes: v }))}
            unit="minutes"
            min={1}
            max={60}
            helper="Mark delivery partner as 'signal lost' if no pings received within this window"
            error={errors.signalLostThresholdMinutes}
          />
        </SettingsCard>

        {/* Card 2: Route Corridor Buffers */}
        <SettingsCard
          icon={<MdRule />}
          title="Route Corridor Buffers"
          desc="Configures road corridor boundary width, grace period, and state debouncing"
        >
          <NumberField
            id="ri-setting-corridor-tolerance"
            label="Corridor Tolerance Buffer"
            value={settings.corridorToleranceMeters}
            onChange={v => setSettings(s => ({ ...s, corridorToleranceMeters: v }))}
            unit="meters (± width)"
            min={30}
            max={500}
            helper="Allowed lateral deviation on either side of the road centerline"
            error={errors.corridorToleranceMeters}
          />

          <NumberField
            id="ri-setting-corridor-grace"
            label="Deviation Grace Period"
            value={settings.corridorGracePeriodSeconds}
            onChange={v => setSettings(s => ({ ...s, corridorGracePeriodSeconds: v }))}
            unit="seconds"
            min={30}
            max={900}
            helper="Allowed duration outside the corridor (YELLOW) before escalating to RED incident"
            error={errors.corridorGracePeriodSeconds}
          />

          <NumberField
            id="ri-setting-hysteresis"
            label="Confirmation Pings (Hysteresis)"
            value={settings.hysteresisCount}
            onChange={v => setSettings(s => ({ ...s, hysteresisCount: v }))}
            unit="pings"
            min={1}
            max={5}
            helper="Consecutive pings required outside or inside corridor before switching states"
            error={errors.hysteresisCount}
          />
        </SettingsCard>

        {/* Card 3: Off-Route Timers */}
        <SettingsCard
          icon={<MdTimer />}
          title="Off-Route Incident Timers"
          desc="Thresholds for detecting stationary stops vs active off-route driving"
        >
          <NumberField
            id="ri-setting-stop-speed"
            label="Stationary Speed Threshold"
            value={settings.stopSpeedThresholdKmh}
            onChange={v => setSettings(s => ({ ...s, stopSpeedThresholdKmh: v }))}
            unit="km/h"
            min={0.5}
            max={20}
            step={0.5}
            helper="Speeds below this threshold are evaluated as STOPPED"
            error={errors.stopSpeedThresholdKmh}
          />

          <NumberField
            id="ri-setting-driving-alert"
            label="Alert after Off-Route DRIVING"
            value={settings.drivingAlertThresholdSeconds}
            onChange={v => setSettings(s => ({ ...s, drivingAlertThresholdSeconds: v }))}
            unit="seconds"
            min={60}
            max={1800}
            helper="Time spent driving off-route before triggering an off-route incident"
            error={errors.drivingAlertThresholdSeconds}
          />

          <NumberField
            id="ri-setting-stopped-alert"
            label="Alert after Off-Route STOPPED"
            value={settings.stoppedAlertThresholdSeconds}
            onChange={v => setSettings(s => ({ ...s, stoppedAlertThresholdSeconds: v }))}
            unit="seconds"
            min={60}
            max={1800}
            helper="Time spent stopped outside corridor before triggering an incident (door deliveries are ignored)"
            error={errors.stoppedAlertThresholdSeconds}
          />
        </SettingsCard>

        {/* Card 4: Delivery Tracking Window (Condition 4) */}
        <SettingsCard
          icon={<MdSchedule />}
          title="Delivery Tracking Window"
          desc="Active monitoring schedule (Indian Standard Time). Pings outside window are ignored."
        >
          <div className="ri-settings-toggle" style={{ marginBottom: 16 }}>
            <span className="ri-toggle-label" style={{ fontWeight: 600 }}>Enable Tracking Window</span>
            <div
              className={`ri-toggle-switch ${settings.trackingWindow?.enabled ? '' : 'off'}`}
              onClick={() => setSettings(s => ({
                ...s,
                trackingWindow: { ...s.trackingWindow, enabled: !s.trackingWindow?.enabled },
              }))}
              role="switch"
              aria-checked={Boolean(settings.trackingWindow?.enabled)}
            >
              <div className="ri-toggle-thumb" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="ri-window-start" style={{ fontSize: 12.5, fontWeight: 600 }}>
                Start Time (IST)
              </label>
              <input
                id="ri-window-start"
                type="time"
                className="form-input"
                value={settings.trackingWindow?.startTime || '04:00'}
                disabled={!settings.trackingWindow?.enabled}
                onChange={e => setSettings(s => ({
                  ...s,
                  trackingWindow: { ...s.trackingWindow, startTime: e.target.value },
                }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ri-window-end" style={{ fontSize: 12.5, fontWeight: 600 }}>
                End Time (IST)
              </label>
              <input
                id="ri-window-end"
                type="time"
                className="form-input"
                value={settings.trackingWindow?.endTime || '11:00'}
                disabled={!settings.trackingWindow?.enabled}
                onChange={e => setSettings(s => ({
                  ...s,
                  trackingWindow: { ...s.trackingWindow, endTime: e.target.value },
                }))}
              />
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
            Standard Chennai morning milk deliveries operate from 04:00 to 11:00 IST (22:30 to 05:30 UTC). When enabled, deviation monitoring is active only during this window.
          </div>
        </SettingsCard>

        {/* Card 5: In-App Alerts (Locked ON) */}
        <SettingsCard
          icon={<MdNotificationsActive />}
          title="Incident Alerts & Notifications"
          desc="System compliance notifications and deviation review routing"
        >
          <div className="ri-settings-toggle" style={{ marginBottom: 12 }}>
            <div>
              <div className="ri-toggle-label" style={{ fontWeight: 600 }}>In-App Deviation Alerts</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Records deviation sessions in memory and flags alerts in the Superadmin review queue
              </div>
            </div>
            <span className="badge badge-success" style={{ fontSize: 11, padding: '4px 8px' }}>
              Always Active
            </span>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            All off-route breaches, unreviewed alerts, and live deviation trails are recorded in real-time and reviewable on the <strong>Route Compliance</strong> page.
          </div>
        </SettingsCard>
      </div>
    </motion.div>
  );
}
