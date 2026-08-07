import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  MdGpsFixed, MdHexagon, MdSpeed, MdTimer,
  MdRule, MdSave, MdInfoOutline,
} from 'react-icons/md';
import { SectionHeader } from '../components/index.jsx';
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

function NumberField({ label, defaultValue, unit, id }) {
  return (
    <div className="ri-settings-field form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          id={id}
          type="number"
          className="form-input"
          defaultValue={defaultValue}
          style={{ flex: 1 }}
        />
        {unit && <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function RouteIntelligenceSettingsPage() {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Intelligence Settings"
        subtitle="Configure tracking parameters, thresholds, and compliance rules"
      >
        <button className="btn btn-primary" id="ri-settings-save-btn">
          <MdSave /> Save Settings
        </button>
      </SectionHeader>

      {/* Info Banner */}
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
        These settings are UI placeholders. Changes will be saved to the backend when the Route Intelligence API is connected.
      </div>

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
            defaultValue={MOCK_SETTINGS.gpsUpdateInterval}
            unit="seconds"
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {[10, 30, 60, 120].map(v => (
              <button key={v} className="btn btn-secondary btn-sm" id={`ri-gps-preset-${v}`}>{v}s</button>
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
            defaultValue={MOCK_SETTINGS.geofenceRadius}
            unit="meters"
          />
          <NumberField
            id="ri-setting-geofence-alert"
            label="Alert Threshold"
            defaultValue={50}
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
            defaultValue={MOCK_SETTINGS.drivingSpeedThreshold}
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
            defaultValue={MOCK_SETTINGS.stopDetectionThreshold}
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
            defaultValue={MOCK_SETTINGS.complianceRules.allowDeviationMeters}
            unit="meters"
          />
          <NumberField
            id="ri-setting-max-stop"
            label="Max Stop Duration"
            defaultValue={MOCK_SETTINGS.complianceRules.maxStopMinutes}
            unit="minutes"
          />
          <ToggleRow label="Require geofence entry"   defaultOn={MOCK_SETTINGS.complianceRules.requireGeofenceEntry} />
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
