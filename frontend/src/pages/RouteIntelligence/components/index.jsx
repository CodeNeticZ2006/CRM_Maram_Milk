// ============================================================
// ROUTE INTELLIGENCE MODULE — SHARED COMPONENTS
// ============================================================

import { motion } from 'framer-motion';
import {
  MdCheckCircle, MdWarning, MdError, MdInfo,
  MdTrendingUp, MdTrendingDown,
} from 'react-icons/md';

// ── StatusBadge ─────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    active:    { cls: 'badge-success', label: 'Active'    },
    deviated:  { cls: 'badge-danger',  label: 'Deviated'  },
    stopped:   { cls: 'badge-warning', label: 'Stopped'   },
    compliant: { cls: 'badge-success', label: 'Compliant' },
    warning:   { cls: 'badge-warning', label: 'Warning'   },
    review:    { cls: 'badge-info',    label: 'In Review'  },
    inactive:  { cls: 'badge-gray',    label: 'Inactive'  },
    breach:    { cls: 'badge-danger',  label: 'Breach'    },
    route:     { cls: 'badge-blue',    label: 'Route'     },
    depot:     { cls: 'badge-info',    label: 'Depot'     },
    restricted:{ cls: 'badge-danger',  label: 'Restricted'},
  };
  const { cls, label } = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── SectionHeader ────────────────────────────────────────────
export function SectionHeader({ title, subtitle, children }) {
  return (
    <div className="ri-section-header">
      <div>
        <div className="ri-section-title">{title}</div>
        {subtitle && <div className="ri-section-sub">{subtitle}</div>}
      </div>
      {children && <div className="ri-section-actions">{children}</div>}
    </div>
  );
}

// ── AnalyticsCard ────────────────────────────────────────────
export function AnalyticsCard({ icon, label, value, sub, trend, color = 'var(--primary)', iconBg }) {
  const isUp = trend?.startsWith('+');
  return (
    <motion.div
      className="stat-card"
      style={{ '--card-accent': color, '--icon-bg': iconBg || `${color}18` }}
      whileHover={{ translateY: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="stat-card-header">
        <div className="stat-icon" style={{ color }}>{icon}</div>
        {trend && (
          <span className={`stat-change ${isUp ? 'up' : 'down'}`}>
            {isUp ? <MdTrendingUp /> : <MdTrendingDown />} {trend}
          </span>
        )}
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

// ── LiveMapCard ──────────────────────────────────────────────
export function LiveMapCard({ title = 'Live Map', height = 420, children }) {
  return (
    <div className="card ri-map-card" style={{ '--map-height': `${height}px` }}>
      <div className="card-header" style={{ paddingBottom: 16 }}>
        <span className="card-title">{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ri-live-dot" />
          <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>LIVE</span>
        </div>
      </div>
      <div className="ri-map-placeholder">
        <div className="ri-map-grid" />
        <div className="ri-map-center">
          <div className="ri-map-icon">🗺️</div>
          <div className="ri-map-label">Interactive Map</div>
          <div className="ri-map-sub">Google Maps / Leaflet will render here</div>
          <div className="ri-map-badge">Plug-in Ready</div>
        </div>
        {/* Decorative mock route lines */}
        <svg className="ri-map-svg" viewBox="0 0 600 300" fill="none">
          <path d="M60 200 Q150 120 240 160 Q330 200 400 110 Q470 50 540 90" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="6 3" opacity="0.5"/>
          <path d="M80 250 Q160 180 260 220 Q350 260 440 200 Q490 170 540 190" stroke="#10b981" strokeWidth="2.5" strokeDasharray="6 3" opacity="0.4"/>
          <path d="M40 150 Q120 80 200 130 Q280 180 350 90 Q420 20 520 60" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6 3" opacity="0.35"/>
          {/* Mock DP pins */}
          <circle cx="240" cy="160" r="7" fill="#3b82f6" opacity="0.9"/>
          <circle cx="350" cy="90" r="7" fill="#ef4444" opacity="0.9"/>
          <circle cx="440" cy="200" r="7" fill="#10b981" opacity="0.9"/>
          <circle cx="160" cy="180" r="7" fill="#8b5cf6" opacity="0.9"/>
          <circle cx="490" cy="170" r="7" fill="#f59e0b" opacity="0.9"/>
        </svg>
        {children}
      </div>
    </div>
  );
}

// ── TerritoryCard ────────────────────────────────────────────
export function TerritoryCard({ territory }) {
  return (
    <motion.div
      className="card ri-territory-card"
      whileHover={{ translateY: -2, boxShadow: 'var(--shadow-md)' }}
      transition={{ duration: 0.15 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{territory.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{territory.area}</div>
        </div>
        <StatusBadge status={territory.status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Routes',   value: territory.routes },
          { label: 'DPs',      value: territory.dps },
          { label: 'Customers',value: territory.customers },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── RouteReplayCard ──────────────────────────────────────────
export function RouteReplayCard({ event }) {
  const iconMap = {
    start:    { icon: '🟢', color: 'var(--success)' },
    end:      { icon: '🔴', color: 'var(--danger)'  },
    delivery: { icon: '📦', color: 'var(--primary)' },
    alert:    { icon: '⚠️', color: 'var(--warning)' },
    geo:      { icon: '📍', color: 'var(--info)'    },
    info:     { icon: 'ℹ️',  color: 'var(--accent)'  },
  };
  const { icon, color } = iconMap[event.type] || iconMap.info;
  return (
    <div className="ri-replay-event">
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{event.event}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{event.time}</div>
      </div>
    </div>
  );
}

// ── EventSeverityIcon ────────────────────────────────────────
export function EventSeverityIcon({ severity }) {
  const map = {
    success: { icon: <MdCheckCircle />, color: 'var(--success)' },
    warning: { icon: <MdWarning />,     color: 'var(--warning)' },
    danger:  { icon: <MdError />,       color: 'var(--danger)'  },
    info:    { icon: <MdInfo />,         color: 'var(--info)'    },
  };
  const { icon, color } = map[severity] || map.info;
  return <span style={{ color, fontSize: 16, display: 'flex' }}>{icon}</span>;
}

// ── ComplianceProgressBar ────────────────────────────────────
export function ComplianceProgressBar({ value, max = 100 }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 85 ? 'var(--success)' : pct >= 65 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 30 }}>{pct}%</span>
    </div>
  );
}
