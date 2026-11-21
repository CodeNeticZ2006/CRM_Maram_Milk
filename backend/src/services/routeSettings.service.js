/**
 * Route Intelligence Settings Service
 * Single Source of Truth for corridor parameters, tracking window, and persistence.
 * Persists to backend/data/routeSettings.json and survives server restarts.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_CORRIDOR_CONFIG } = require('../config/areaConfig');

const SETTINGS_FILE_PATH = path.resolve(__dirname, '../../data/routeSettings.json');

// Canonical default settings
const DEFAULT_SETTINGS = {
  // Tracking
  gpsUpdateInterval: 30, // seconds: 10, 30, 60, 120
  maxGpsAccuracyMeters: 50, // drop pings noisier than 50m
  signalLostThresholdMinutes: 10, // DP marked signal lost if inactive > 10m

  // Route Corridor
  corridorToleranceMeters: 120, // ±120m buffer around centerline (30m - 500m)
  corridorGracePeriodSeconds: 180, // grace period before RED alert (30s - 900s)
  hysteresisCount: 2, // 2 consecutive pings to transition state (1 - 5)

  // Off-Route Timers
  stopSpeedThresholdKmh: 3.0, // speed below this is stopped (0.5 - 10 km/h)
  drivingAlertThresholdSeconds: 300, // driving off-route alert timer (60s - 1800s)
  stoppedAlertThresholdSeconds: 300, // stopped off-route alert timer (60s - 1800s)

  // Alerts
  inAppAlerts: true, // locked ON

  // Tracking Window (Delivery Hours)
  trackingWindow: {
    enabled: false,
    startTime: '04:00', // IST "HH:mm"
    endTime: '11:00',   // IST "HH:mm"
  },

  // Retained backend fields (Condition 1)
  geofenceRadius: 500,

  // Metadata
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default',
};

// In-memory cache
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * Format current timestamp in IST (Indian Standard Time, UTC+5:30)
 */
function getIstTimestamp() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().replace('Z', '+05:30');
}

/**
 * Evaluates whether a timestamp falls within the configured tracking window.
 * Always converts to IST first to correctly handle UTC midnight crossing.
 * (e.g. 04:00 IST to 11:00 IST is 22:30 UTC day D-1 to 05:30 UTC day D).
 */
function isPingWithinTrackingWindow(timestamp, trackingWindow = currentSettings.trackingWindow) {
  if (!trackingWindow || !trackingWindow.enabled) return true;
  if (!trackingWindow.startTime || !trackingWindow.endTime) return true;

  const dateObj = timestamp ? new Date(timestamp) : new Date();
  if (isNaN(dateObj.getTime())) return true;

  // Convert to IST (UTC + 5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(dateObj.getTime() + istOffsetMs);
  const istHours = istDate.getUTCHours();
  const istMinutes = istDate.getUTCMinutes();
  const pingMinutes = istHours * 60 + istMinutes;

  const [startH, startM] = trackingWindow.startTime.split(':').map(Number);
  const [endH, endM] = trackingWindow.endTime.split(':').map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    return pingMinutes >= startMinutes && pingMinutes <= endMinutes;
  } else {
    // Window crosses midnight in IST (e.g. 22:00 to 06:00 IST)
    return pingMinutes >= startMinutes || pingMinutes <= endMinutes;
  }
}

/**
 * Generates read-only legacy alias mirrors so two values can NEVER conflict
 */
function attachLegacyMirrors(settings) {
  const tolerance = Number(settings.corridorToleranceMeters) || 120;
  const grace = Number(settings.corridorGracePeriodSeconds) || 180;
  const accuracy = Number(settings.maxGpsAccuracyMeters) || 50;
  const stoppedSeconds = Number(settings.stoppedAlertThresholdSeconds) || 300;
  const stopMinutes = Math.round(stoppedSeconds / 60);

  return {
    ...settings,
    // Top-level legacy aliases (read-only mirrors)
    allowDeviationMeters: tolerance,
    corridorGpsAccuracyBuffer: accuracy,
    gracePeriodSeconds: grace,
    stopDetectionThreshold: stopMinutes,
    // Nested complianceRules legacy object
    complianceRules: {
      corridorToleranceMeters: tolerance,
      allowDeviationMeters: tolerance, // read-only mirror
      corridorGracePeriodSeconds: grace,
      gracePeriodSeconds: grace, // read-only mirror
      corridorGpsAccuracyBuffer: accuracy, // read-only mirror
      maxGpsAccuracyMeters: accuracy,
      stopSpeedThresholdKmh: Number(settings.stopSpeedThresholdKmh) || 3.0,
      drivingAlertThresholdSeconds: Number(settings.drivingAlertThresholdSeconds) || 300,
      stoppedAlertThresholdSeconds: stoppedSeconds,
      maxStopMinutes: stopMinutes, // read-only mirror
      hysteresisCount: Number(settings.hysteresisCount) || 2,
      staleThresholdMinutes: Number(settings.signalLostThresholdMinutes) || 10,
    },
  };
}

/**
 * Normalizes input settings, migrating any legacy keys to canonical keys
 */
function normalizeSettings(input = {}) {
  const merged = { ...DEFAULT_SETTINGS };

  // 1. Direct canonical fields or legacy fallback
  if (input.gpsUpdateInterval !== undefined) merged.gpsUpdateInterval = Number(input.gpsUpdateInterval);
  if (input.geofenceRadius !== undefined) merged.geofenceRadius = Number(input.geofenceRadius);

  // Corridor Tolerance: canonical corridorToleranceMeters > legacy allowDeviationMeters
  const tolerance = input.corridorToleranceMeters !== undefined
    ? input.corridorToleranceMeters
    : (input.complianceRules?.corridorToleranceMeters !== undefined
        ? input.complianceRules.corridorToleranceMeters
        : (input.allowDeviationMeters !== undefined
            ? input.allowDeviationMeters
            : input.complianceRules?.allowDeviationMeters));
  if (tolerance !== undefined) merged.corridorToleranceMeters = Number(tolerance);

  // Grace Period: canonical corridorGracePeriodSeconds > legacy gracePeriodSeconds
  const grace = input.corridorGracePeriodSeconds !== undefined
    ? input.corridorGracePeriodSeconds
    : (input.complianceRules?.corridorGracePeriodSeconds !== undefined
        ? input.complianceRules.corridorGracePeriodSeconds
        : (input.gracePeriodSeconds !== undefined
            ? input.gracePeriodSeconds
            : input.complianceRules?.gracePeriodSeconds));
  if (grace !== undefined) merged.corridorGracePeriodSeconds = Number(grace);

  // GPS Accuracy: canonical maxGpsAccuracyMeters > legacy corridorGpsAccuracyBuffer
  const accuracy = input.maxGpsAccuracyMeters !== undefined
    ? input.maxGpsAccuracyMeters
    : (input.complianceRules?.maxGpsAccuracyMeters !== undefined
        ? input.complianceRules.maxGpsAccuracyMeters
        : (input.corridorGpsAccuracyBuffer !== undefined
            ? input.corridorGpsAccuracyBuffer
            : input.complianceRules?.corridorGpsAccuracyBuffer));
  if (accuracy !== undefined) merged.maxGpsAccuracyMeters = Number(accuracy);

  // Signal Lost Timeout
  const signalLost = input.signalLostThresholdMinutes !== undefined
    ? input.signalLostThresholdMinutes
    : input.complianceRules?.staleThresholdMinutes;
  if (signalLost !== undefined) merged.signalLostThresholdMinutes = Number(signalLost);

  // Hysteresis
  const hysteresis = input.hysteresisCount !== undefined
    ? input.hysteresisCount
    : input.complianceRules?.hysteresisCount;
  if (hysteresis !== undefined) merged.hysteresisCount = Number(hysteresis);

  // Stop Speed Threshold
  const stopSpeed = input.stopSpeedThresholdKmh !== undefined
    ? input.stopSpeedThresholdKmh
    : input.complianceRules?.stopSpeedThresholdKmh;
  if (stopSpeed !== undefined) merged.stopSpeedThresholdKmh = Number(stopSpeed);

  // Driving Alert Threshold
  const drivingAlert = input.drivingAlertThresholdSeconds !== undefined
    ? input.drivingAlertThresholdSeconds
    : input.complianceRules?.drivingAlertThresholdSeconds;
  if (drivingAlert !== undefined) merged.drivingAlertThresholdSeconds = Number(drivingAlert);

  // Stopped Alert Threshold: canonical stoppedAlertThresholdSeconds > legacy stopDetectionThreshold / maxStopMinutes
  let stoppedAlert = input.stoppedAlertThresholdSeconds !== undefined
    ? input.stoppedAlertThresholdSeconds
    : input.complianceRules?.stoppedAlertThresholdSeconds;
  if (stoppedAlert === undefined) {
    if (input.stopDetectionThreshold !== undefined) {
      stoppedAlert = Number(input.stopDetectionThreshold) * 60;
    } else if (input.complianceRules?.maxStopMinutes !== undefined) {
      stoppedAlert = Number(input.complianceRules.maxStopMinutes) * 60;
    }
  }
  if (stoppedAlert !== undefined) merged.stoppedAlertThresholdSeconds = Number(stoppedAlert);

  // Tracking Window
  if (input.trackingWindow && typeof input.trackingWindow === 'object') {
    merged.trackingWindow = {
      enabled: Boolean(input.trackingWindow.enabled),
      startTime: input.trackingWindow.startTime || '04:00',
      endTime: input.trackingWindow.endTime || '11:00',
    };
  }

  merged.inAppAlerts = true;
  merged.updatedAt = input.updatedAt || getIstTimestamp();
  merged.updatedBy = input.updatedBy || 'SuperAdmin';

  return merged;
}

/**
 * Load settings from disk (with fallback to default if missing or corrupted)
 */
function loadSettingsFromDisk() {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      currentSettings = normalizeSettings(parsed);
      return currentSettings;
    }
  } catch (err) {
    console.warn('⚠️ Warning loading routeSettings.json, falling back to defaults:', err.message);
  }
  currentSettings = { ...DEFAULT_SETTINGS, updatedAt: getIstTimestamp() };
  saveSettingsToDisk(currentSettings);
  return currentSettings;
}

/**
 * Persist settings atomically to disk
 */
function saveSettingsToDisk(settings) {
  try {
    const dir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${SETTINGS_FILE_PATH}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tempFile, SETTINGS_FILE_PATH);
    return true;
  } catch (err) {
    console.error('❌ Failed to save routeSettings.json to disk:', err.message);
    return false;
  }
}

// Validation ranges for Route Intelligence parameters
const VALIDATION_RANGES = {
  gpsUpdateInterval: { min: 10, max: 300, label: 'GPS update interval (seconds)' },
  corridorToleranceMeters: { min: 30, max: 500, label: 'Corridor tolerance (meters)' },
  corridorGracePeriodSeconds: { min: 30, max: 900, label: 'Corridor grace period (seconds)' },
  maxGpsAccuracyMeters: { min: 10, max: 200, label: 'Max GPS accuracy (meters)' },
  signalLostThresholdMinutes: { min: 1, max: 60, label: 'Signal lost threshold (minutes)' },
  hysteresisCount: { min: 1, max: 5, label: 'Hysteresis confirmation count' },
  stopSpeedThresholdKmh: { min: 0.5, max: 20, label: 'Stop speed threshold (km/h)' },
  drivingAlertThresholdSeconds: { min: 60, max: 1800, label: 'Driving alert threshold (seconds)' },
  stoppedAlertThresholdSeconds: { min: 60, max: 1800, label: 'Stopped alert threshold (seconds)' },
};

/**
 * Validates settings patch against strict operational bounds.
 * Handles both canonical keys and legacy alias keys.
 */
function validateSettings(input = {}) {
  const errors = [];
  if (typeof input !== 'object' || input === null) {
    return { isValid: false, errors: ['Settings payload must be a JSON object'] };
  }

  const checkNumber = (val, rule) => {
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (isNaN(num)) {
        errors.push(`${rule.label} must be a valid number`);
      } else if (num < rule.min || num > rule.max) {
        errors.push(`${rule.label} must be between ${rule.min} and ${rule.max}`);
      }
    }
  };

  // 1. GPS Update Interval (10 - 300s)
  checkNumber(input.gpsUpdateInterval, VALIDATION_RANGES.gpsUpdateInterval);

  // 2. Corridor Tolerance (30 - 500m)
  const tol = input.corridorToleranceMeters ?? input.allowDeviationMeters ?? input.complianceRules?.corridorToleranceMeters ?? input.complianceRules?.allowDeviationMeters;
  checkNumber(tol, VALIDATION_RANGES.corridorToleranceMeters);

  // 3. Corridor Grace Period (30 - 900s)
  const grace = input.corridorGracePeriodSeconds ?? input.gracePeriodSeconds ?? input.complianceRules?.corridorGracePeriodSeconds ?? input.complianceRules?.gracePeriodSeconds;
  checkNumber(grace, VALIDATION_RANGES.corridorGracePeriodSeconds);

  // 4. Max GPS Accuracy (10 - 200m)
  const acc = input.maxGpsAccuracyMeters ?? input.corridorGpsAccuracyBuffer ?? input.complianceRules?.maxGpsAccuracyMeters ?? input.complianceRules?.corridorGpsAccuracyBuffer;
  checkNumber(acc, VALIDATION_RANGES.maxGpsAccuracyMeters);

  // 5. Signal Lost Threshold (1 - 60 min)
  const stale = input.signalLostThresholdMinutes ?? input.complianceRules?.staleThresholdMinutes;
  checkNumber(stale, VALIDATION_RANGES.signalLostThresholdMinutes);

  // 6. Hysteresis Count (1 - 5)
  const hyst = input.hysteresisCount ?? input.complianceRules?.hysteresisCount;
  checkNumber(hyst, VALIDATION_RANGES.hysteresisCount);

  // 7. Stop Speed Threshold (0.5 - 20 km/h)
  const speed = input.stopSpeedThresholdKmh ?? input.complianceRules?.stopSpeedThresholdKmh;
  checkNumber(speed, VALIDATION_RANGES.stopSpeedThresholdKmh);

  // 8. Driving Alert Threshold (60 - 1800s)
  const driving = input.drivingAlertThresholdSeconds ?? input.complianceRules?.drivingAlertThresholdSeconds;
  checkNumber(driving, VALIDATION_RANGES.drivingAlertThresholdSeconds);

  // 9. Stopped Alert Threshold (60 - 1800s)
  let stopped = input.stoppedAlertThresholdSeconds ?? input.complianceRules?.stoppedAlertThresholdSeconds;
  if (stopped === undefined) {
    if (input.stopDetectionThreshold !== undefined) stopped = Number(input.stopDetectionThreshold) * 60;
    else if (input.complianceRules?.maxStopMinutes !== undefined) stopped = Number(input.complianceRules.maxStopMinutes) * 60;
  }
  checkNumber(stopped, VALIDATION_RANGES.stoppedAlertThresholdSeconds);

  // 10. Tracking Window
  if (input.trackingWindow && typeof input.trackingWindow === 'object') {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (input.trackingWindow.startTime && !timeRegex.test(input.trackingWindow.startTime)) {
      errors.push('Tracking window startTime must be in HH:mm format');
    }
    if (input.trackingWindow.endTime && !timeRegex.test(input.trackingWindow.endTime)) {
      errors.push('Tracking window endTime must be in HH:mm format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Public API: Get current active settings with legacy mirrors
 */
function getSettings() {
  return attachLegacyMirrors(currentSettings);
}

/**
 * Public API: Update active settings, persist to disk, and return mirrored result.
 * Throws a ValidationError if any values fall outside allowed operational bounds.
 */
function updateSettings(patch = {}, updatedBy = 'SuperAdmin') {
  const validation = validateSettings(patch);
  if (!validation.isValid) {
    const err = new Error(`Validation failed: ${validation.errors.join('; ')}`);
    err.name = 'ValidationError';
    err.status = 400;
    err.errors = validation.errors;
    throw err;
  }

  const merged = normalizeSettings({
    ...currentSettings,
    ...patch,
    updatedBy,
    updatedAt: getIstTimestamp(),
  });
  currentSettings = merged;
  saveSettingsToDisk(currentSettings);
  return attachLegacyMirrors(currentSettings);
}

/**
 * Public API: Reset settings to default configuration
 */
function resetSettings(updatedBy = 'SuperAdmin') {
  currentSettings = {
    ...DEFAULT_SETTINGS,
    updatedAt: getIstTimestamp(),
    updatedBy: `${updatedBy} (Reset to Defaults)`,
  };
  saveSettingsToDisk(currentSettings);
  return attachLegacyMirrors(currentSettings);
}

// Initialize on module load
loadSettingsFromDisk();

module.exports = {
  DEFAULT_SETTINGS,
  SETTINGS_FILE_PATH,
  VALIDATION_RANGES,
  validateSettings,
  getSettings,
  updateSettings,
  resetSettings,
  loadSettingsFromDisk,
  saveSettingsToDisk,
  normalizeSettings,
  attachLegacyMirrors,
  isPingWithinTrackingWindow,
  getIstTimestamp,
};
