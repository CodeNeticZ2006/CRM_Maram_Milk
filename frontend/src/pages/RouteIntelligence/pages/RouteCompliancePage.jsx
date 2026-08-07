import { motion } from 'framer-motion';
import { MdCheckCircle, MdFilterList, MdDownload, MdSearch } from 'react-icons/md';
import { useState } from 'react';
import { SectionHeader, StatusBadge } from '../components/index.jsx';
import { MOCK_COMPLIANCE_ROWS } from '../utils/mockData.js';
import '../components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const STATUS_FILTER_OPTIONS = ['All', 'compliant', 'warning', 'deviated', 'review'];

export default function RouteCompliancePage() {
  const [search, setSearch]       = useState('');
  const [statusFilter, setFilter] = useState('All');

  const filtered = MOCK_COMPLIANCE_ROWS.filter(row => {
    const matchSearch = row.dp.toLowerCase().includes(search.toLowerCase()) ||
                        row.assignedRoute.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || row.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCompliant = MOCK_COMPLIANCE_ROWS.filter(r => r.status === 'compliant').length;
  const totalDeviated  = MOCK_COMPLIANCE_ROWS.filter(r => r.status === 'deviated').length;
  const totalWarning   = MOCK_COMPLIANCE_ROWS.filter(r => r.status === 'warning').length;

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      <SectionHeader
        title="Route Compliance"
        subtitle="Monitor whether delivery partners are following their assigned routes"
      >
        <button className="btn btn-secondary btn-sm"><MdDownload /> Export</button>
        <button className="btn btn-primary btn-sm"><MdFilterList /> Filter</button>
      </SectionHeader>

      {/* Summary KPIs */}
      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Partners',  value: MOCK_COMPLIANCE_ROWS.length, color: 'var(--primary)' },
          { label: 'Compliant',       value: totalCompliant,              color: 'var(--success)' },
          { label: 'Warnings',        value: totalWarning,                color: 'var(--warning)' },
          { label: 'Deviated',        value: totalDeviated,               color: 'var(--danger)'  },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--card-accent': s.color }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

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
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{filtered.length} records</span>
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
              {filtered.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {row.dp.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{row.dp}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{row.assignedRoute}</td>
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
                      <button className="btn btn-ghost btn-sm" id={`ri-view-${row.id}`} style={{ fontSize: 12 }}>View</button>
                      {row.status === 'deviated' && (
                        <button className="btn btn-danger btn-sm" id={`ri-flag-${row.id}`} style={{ fontSize: 12 }}>Flag</button>
                      )}
                      {row.status === 'review' && (
                        <button className="btn btn-success btn-sm" id={`ri-approve-${row.id}`} style={{ fontSize: 12 }}>
                          <MdCheckCircle style={{ fontSize: 13 }} /> Approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
