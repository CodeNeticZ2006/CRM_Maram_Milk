import { motion } from 'framer-motion';
import { MdBarChart, MdTrendingUp, MdSpeed, MdTimer, MdWarningAmber, MdCalendarToday, MdRefresh } from 'react-icons/md';
import { useState, useEffect, useCallback } from 'react';
import { SectionHeader, AnalyticsCard, ComplianceProgressBar } from '../components/index.jsx';
import api from '../../../services/api';
import { MOCK_ANALYTICS } from '../utils/mockData.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const BAR_MAX_HEIGHT = 150; // px

export default function AnalyticsPage() {
  const [analytics, setAnalytics]   = useState(MOCK_ANALYTICS);
  const [loading, setLoading]       = useState(true);
  const [isDb2Loaded, setIsDb2Loaded] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/route-intelligence/analytics');
      if (res.data?.success && res.data?.data) {
        setAnalytics(prev => ({ ...prev, ...res.data.data }));
        setIsDb2Loaded(true);
      }
    } catch (err) {
      console.warn('⚠️ Failed to fetch DB2 Analytics:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const { complianceScore, avgDrivingTime, avgStopTime, totalDeviations, topDeviatedRoutes, monthlyTrend } = analytics;
  const maxScore = Math.max(...(monthlyTrend || []).map(m => m.score), 100);

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Analytics"
        subtitle={
          <span>
            Performance insights, compliance trends, and route intelligence metrics
            {isDb2Loaded && <span className="badge badge-success" style={{ marginLeft: 10, fontSize: 11 }}>Connected to DB2</span>}
          </span>
        }
      >
        <button className="btn btn-secondary btn-sm" onClick={fetchAnalytics} disabled={loading}>
          <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
        <select className="ri-speed-select" id="ri-analytics-period">
          <option>Last 30 days</option>
          <option>Last 7 days</option>
          <option>This Month</option>
          <option>Custom Range</option>
        </select>
      </SectionHeader>

      {/* Top KPI Cards */}
      <div className="ri-stat-grid-4">
        <AnalyticsCard
          icon={<MdBarChart />}
          label="Compliance Score"
          value={`${complianceScore}%`}
          sub="Fleet-wide average (DB2)"
          trend="-1% vs last month"
          color="var(--primary)"
        />
        <AnalyticsCard
          icon={<MdWarningAmber />}
          label="Route Deviations"
          value={totalDeviations}
          sub="This month"
          trend="+2 vs last month"
          color="var(--danger)"
        />
        <AnalyticsCard
          icon={<MdSpeed />}
          label="Avg Driving Time"
          value={avgDrivingTime}
          sub="Per route"
          color="var(--success)"
        />
        <AnalyticsCard
          icon={<MdTimer />}
          label="Avg Stop Time"
          value={avgStopTime}
          sub="Per delivery"
          color="var(--warning)"
        />
      </div>

      {/* Compliance Score Ring + Monthly Trend + Top Deviated */}
      <div className="ri-three-col" style={{ marginBottom: 20 }}>
        {/* Score Ring Card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Compliance Score</span></div>
          <div className="card-body">
            <div className="ri-score-ring-wrap">
              <svg className="ri-score-ring" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10"/>
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke={complianceScore >= 85 ? 'var(--success)' : complianceScore >= 65 ? 'var(--warning)' : 'var(--danger)'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(complianceScore / 100) * 314} 314`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
                <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text-primary)">{complianceScore}%</text>
                <text x="60" y="72" textAnchor="middle" fontSize="10" fill="var(--text-muted)">Fleet Score</text>
              </svg>
              <div className="ri-score-label">
                {complianceScore >= 85 ? '✅ Excellent' : complianceScore >= 65 ? '⚠️ Needs Attention' : '🔴 Critical'}
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {[
                { label: '≥ 85% Excellent',     color: 'var(--success)' },
                { label: '65-84% Needs Attention', color: 'var(--warning)' },
                { label: '< 65% Critical',       color: 'var(--danger)'  },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Compliance Trend</span>
            <MdCalendarToday style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="card-body">
            <div className="ri-chart-placeholder">
              {monthlyTrend.map(m => {
                const h = Math.round((m.score / maxScore) * BAR_MAX_HEIGHT);
                const color = m.score >= 80 ? 'linear-gradient(180deg,var(--success),#059669)'
                            : m.score >= 65 ? 'linear-gradient(180deg,var(--warning),#d97706)'
                            : 'linear-gradient(180deg,var(--danger),#dc2626)';
                return (
                  <div key={m.month} className="ri-chart-bar-wrap">
                    <div title={`${m.score}%`} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{m.score}</div>
                    <div className="ri-chart-bar" style={{ height: h, background: color }} />
                    <div className="ri-chart-month">{m.month}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Deviated Routes */}
        <div className="card">
          <div className="card-header"><span className="card-title">Top Deviated DB2 Routes</span></div>
          <div className="card-body">
            <div className="ri-trend-table">
              {topDeviatedRoutes.map((r, i) => (
                <div key={i} className="ri-trend-row">
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div className="ri-trend-label">
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.route.split(' — ')[0]}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.deviations} deviation{r.deviations > 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ minWidth: 80 }}>
                    <ComplianceProgressBar value={r.score} />
                  </div>
                </div>
              ))}
            </div>

            {/* Quick metric */}
            <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Route Deviation Trend</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdTrendingUp style={{ color: 'var(--danger)', fontSize: 20 }} />
                <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>+28%</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs last month</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="ri-two-col-equal">
        {/* Avg Times Comparison */}
        <div className="card">
          <div className="card-header"><span className="card-title">Average Times by DB2 Route</span></div>
          <div className="card-body">
            {['Alwarpet', 'Egmore', 'Mandaveli 1', 'Mylapore 1', 'T-Nagar'].map((r, i) => {
              const driving = [22, 19, 17, 26, 18][i];
              const stopped = [4, 9, 2, 1, 10][i];
              return (
                <div key={r} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)' }}>{r}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{driving}m drive · {stopped}m stop</span>
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
                    <div style={{ flex: driving, background: 'var(--primary)', borderRadius: '99px 0 0 99px' }} />
                    <div style={{ flex: stopped, background: 'var(--warning)', borderRadius: '0 99px 99px 0' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--primary)' }} />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Driving</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--warning)' }} />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Stopped</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="card">
          <div className="card-header"><span className="card-title">This Month Summary (DB2)</span></div>
          <div className="card-body">
            {[
              { label: 'Total Routes Completed',   value: `${analytics.db2RouteCount || 14} Routes`, color: 'var(--primary)' },
              { label: 'Registered DPs (DB2)',      value: `${analytics.db2DpCount || 20} DPs`, color: 'var(--success)' },
              { label: 'Deviation Incidents',       value: `${totalDeviations}`,       color: 'var(--danger)'  },
              { label: 'Avg Route Duration',        value: '2h 14m',  color: 'var(--info)'    },
              { label: 'Total Distance Covered',    value: '3,482 km',color: 'var(--accent)'  },
              { label: 'Fuel Estimated',            value: '412 L',   color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
