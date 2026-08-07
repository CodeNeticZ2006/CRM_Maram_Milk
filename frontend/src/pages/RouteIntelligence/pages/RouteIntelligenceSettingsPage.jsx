import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  MdGpsFixed, MdHexagon, MdSpeed, MdTimer,
  MdRule, MdSave, MdInfoOutline, MdCheckCircle,
} from 'react-icons/md';
import { SectionHeader } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_SETTINGS } from '../utils/mockData.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

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

function ToggleRow({ label, defaultOn = true }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="ri-settings-toggle">
      <span className="ri-toggle-label">{label}</span>
      <div
        className={`ri-toggle-switch ${on ? '' : 'off'}`}
        onClick={() => setOn(p => !p)}
        role="switch"
        aria-checked={on}
      >
        <div className="ri-toggle-thumb" />
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, unit, id }) {
  return (
    <div className="ri-settings-field form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id={id}
          type="number"
          className="form-input"
          value={value || ''}
          onChange={e => onChange && onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        {unit && <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function RouteIntelligenceSettingsPage() {
  const [settings, setSettings] = useState(MOCK_SETTINGS);
  const [saving, setSaving]     = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    api.get('/route-intelligence/settings')
      .then(res => {
        if (res.data?.success && res.data?.data) {
          setSettings(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg('');
    try {
      const res = await api.put('/route-intelligence/settings', settings);
      if (res.data?.success) {
        setSavedMsg('Settings saved successfully to backend DB!');
        setTimeout(() => setSavedMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Intelligence Settings"
        subtitle="Configure tracking parameters, thresholds, and compliance rules"
      >
        <button className="btn btn-primary" id="ri-settings-save-btn" onClick={handleSave} disabled={saving}>
          <MdSave /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </SectionHeader>

      {/* Info / Saved Banner */}
      {savedMsg ? (
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24,
          fontSize: 13,
          color: 'var(--success)',
          fontWeight: 600,
        }}>
          <MdCheckCircle style={{ fontSize: 18 }} /> {savedMsg}
        </div>
      ) : (
        <div style={{
          background: 'rgba(59,130,246,0.07)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <MdInfoOutline style={{ color: 'var(--primary)', fontSize: 18, flexShrink: 0 }} />
          Connected to backend Route Intelligence API. Settings changes are persisted in backend memory and database.
        </div>
      )}

      <div className="ri-settings-grid">
        {/* GPS Update Interval */}
        <SettingsCard
          icon={<MdGpsFixed />}
          title="GPS Update Interval"
          desc="How frequently the system polls delivery partner GPS coordinates"
        >
          <NumberField
            id="ri-setting-gps-interval"
            label="Update Interval"
            value={settings.gpsUpdateInterval}
            onChange={v => setSettings(s => ({ ...s, gpsUpdateInterval: v }))}
            unit="seconds"
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {[10, 30, 60, 120].map(v => (
              <button
                key={v}
                className={`btn btn-sm ${settings.gpsUpdateInterval === v ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSettings(s => ({ ...s, gpsUpdateInterval: v }))}
                id={`ri-gps-preset-${v}`}
              >
                {v}s
              </button>
            ))}
          </div>
        </SettingsCard>

        {/* Geofence Radius */}
        <SettingsCard
          icon={<MdHexagon />}
          title="Geofence Radius"
          desc="Default boundary radius applied when creating new geofences"
        >
          <NumberField
            id="ri-setting-geofence-radius"
            label="Default Radius"
            value={settings.geofenceRadius}
            onChange={v => setSettings(s => ({ ...s, geofenceRadius: v }))}
            unit="meters"
          />
          <NumberField
            id="ri-setting-geofence-alert"
            label="Alert Threshold"
            value={50}
            unit="meters from boundary"
          />
        </SettingsCard>

        {/* Driving Speed Threshold */}
        <SettingsCard
          icon={<MdSpeed />}
          title="Driving Speed Threshold"
          desc="Maximum allowed driving speed before an alert is triggered"
        >
          <NumberField
            id="ri-setting-speed-threshold"
            label="Speed Limit"
            value={settings.drivingSpeedThreshold}
            onChange={v => setSettings(s => ({ ...s, drivingSpeedThreshold: v }))}
            unit="km/h"
          />
          <ToggleRow label="Alert on speed exceed" defaultOn={true} />
          <ToggleRow label="Auto-flag for review" defaultOn={false} />
        </SettingsCard>

        {/* Stop Detection */}
        <SettingsCard
          icon={<MdTimer />}
          title="Stop Detection Threshold"
          desc="Minimum stop duration before the system registers an unplanned stop"
        >
          <NumberField
            id="ri-setting-stop-threshold"
            label="Stop Duration"
            value={settings.stopDetectionThreshold}
            onChange={v => setSettings(s => ({ ...s, stopDetectionThreshold: v }))}
            unit="minutes"
          />
          <ToggleRow label="Alert on extended stop" defaultOn={true} />
          <ToggleRow label="Notify on every stop"   defaultOn={false} />
        </SettingsCard>

        {/* Compliance Rules */}
        <SettingsCard
          icon={<MdRule />}
          title="Compliance Rules"
          desc="Define what counts as a route deviation and how it is enforced"
        >
          <NumberField
            id="ri-setting-deviation-meters"
            label="Allowed Deviation"
            value={settings.complianceRules?.allowDeviationMeters || 300}
            onChange={v => setSettings(s => ({ ...s, complianceRules: { ...s.complianceRules, allowDeviationMeters: v } }))}
            unit="meters"
          />
          <NumberField
            id="ri-setting-max-stop"
            label="Max Stop Duration"
            value={settings.complianceRules?.maxStopMinutes || 8}
            onChange={v => setSettings(s => ({ ...s, complianceRules: { ...s.complianceRules, maxStopMinutes: v } }))}
            unit="minutes"
          />
          <ToggleRow label="Require geofence entry"   defaultOn={true} />
          <ToggleRow label="Auto-review deviations"   defaultOn={true} />
          <ToggleRow label="Send WhatsApp alerts"     defaultOn={false} />
        </SettingsCard>

        {/* Notification Settings */}
        <SettingsCard
          icon={<MdInfoOutline />}
          title="Alert & Notifications"
          desc="Control how and when the system sends alerts to admins"
        >
          <ToggleRow label="Email alerts"          defaultOn={true} />
          <ToggleRow label="In-app notifications"  defaultOn={true} />
          <ToggleRow label="SMS alerts (Twilio)"   defaultOn={false} />
          <ToggleRow label="WhatsApp alerts"       defaultOn={false} />
          <ToggleRow label="Daily summary report"  defaultOn={true} />
        </SettingsCard>
      </div>
    </motion.div>
  );
}
