import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdWineBar, MdRefresh, MdWarning, MdCheckCircle, MdCancel,
  MdReportProblem, MdPerson, MdSearch, MdClose, MdLocalShipping,
  MdInventory2, MdFactCheck, MdAssignmentTurnedIn
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function EmptyBottlesPage() {
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ totalIssued: 0, totalReturned: 0, returnRate: 100, pendingIncidents: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/empty-bottles');
      setLogs(res.data.data || []);
      setStats(res.data.stats || { totalIssued: 0, totalReturned: 0, returnRate: 100, pendingIncidents: 0 });
      setIncidents(res.data.incidents || []);
    } catch {
      toast.error('Failed to load empty bottle logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResolveIncident = async (statusChoice) => {
    if (!reviewModal) return;
    setResolving(true);
    try {
      await api.put(`/empty-bottles/incidents/${reviewModal.id}/review`, {
        status: statusChoice,
        resolutionNotes,
      });
      toast.success(`Incident updated: ${statusChoice}`);
      setReviewModal(null);
      setResolutionNotes('');
      fetchData();
    } catch {
      toast.error('Failed to update incident.');
    } finally {
      setResolving(false);
    }
  };

  const filteredLogs = logs.filter(l =>
    l.dpName.toLowerCase().includes(search.toLowerCase()) ||
    l.routeName.toLowerCase().includes(search.toLowerCase()) ||
    l.vehicleNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Empty Bottle Management</h1>
          <p className="page-subtitle">Track daily 1L & 0.5L glass bottle returns DP-wise & review breakage flags from DB2</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
          <MdRefresh /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdLocalShipping />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Bottles Dispatched</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalIssued} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bottles</span></div>
            </div>
          </div>
        </div>

        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdCheckCircle />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Empty Returned Today</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{stats.totalReturned} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bottles</span></div>
            </div>
          </div>
        </div>

        <div className="card card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(139,92,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdFactCheck />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Overall Return Rate</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{stats.returnRate}%</div>
            </div>
          </div>
        </div>

        <div className="card card-body" style={{ borderColor: stats.pendingIncidents > 0 ? 'rgba(239,68,68,0.4)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              <MdWarning />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Manager Incident Flags</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{stats.pendingIncidents} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pending</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Flagged Incidents Alert Banner */}
      {incidents.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <MdReportProblem style={{ color: '#ef4444', fontSize: 22 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#ef4444' }}>
              Manager Bottle Breakage & Unreturned Bottle Flags ({incidents.length})
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {incidents.map(inc => (
              <div key={inc.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{inc.dp_name}</div>
                  <span className={`badge ${inc.status === 'Pending Review' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: 10 }}>
                    {inc.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Route: <strong>{inc.route_name}</strong> | Type: <strong>{inc.bottle_type}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginTop: 4 }}>
                  Broken: {inc.broken_count} | Unreturned: {inc.missing_count}
                </div>
                {inc.manager_notes && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                    "{inc.manager_notes}"
                  </div>
                )}
                {inc.status === 'Pending Review' && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 10, width: '100%', fontSize: 12 }}
                    onClick={() => setReviewModal(inc)}
                  >
                    <MdAssignmentTurnedIn /> Review Incident
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Collection Table Card */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdInventory2 style={{ color: 'var(--primary)' }} /> Daily DP Glass Bottle Return Logs
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 18 }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 34, width: 220 }}
                placeholder="Search DP or route..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Delivery Partner</th>
                  <th>Vehicle No</th>
                  <th>Route / Zone</th>
                  <th>1 Litre Bottles (Issued / Returned / Missing)</th>
                  <th>0.5 Litre Bottles (Issued / Returned / Missing)</th>
                  <th>Return Rate</th>
                  <th>Incident Flag</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>Loading DB2 bottle logs...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No bottle return records found.</td></tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                            <MdPerson />
                          </div>
                          <div>
                            <div>{log.dpName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.dpCode}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.vehicleNumber}</td>
                      <td>
                        <span className="badge badge-gray">{log.routeName} ({log.zone})</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{log.issued1L}</span> /{' '}
                        <span style={{ fontWeight: 700, color: '#10b981' }}>{log.returned1L}</span> /{' '}
                        <span style={{ fontWeight: 700, color: log.missing1L > 0 ? '#ef4444' : 'var(--text-muted)' }}>{log.missing1L}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{log.issuedHalfL}</span> /{' '}
                        <span style={{ fontWeight: 700, color: '#10b981' }}>{log.returnedHalfL}</span> /{' '}
                        <span style={{ fontWeight: 700, color: log.missingHalfL > 0 ? '#ef4444' : 'var(--text-muted)' }}>{log.missingHalfL}</span>
                      </td>
                      <td>
                        <span className={`badge ${log.returnRate >= 95 ? 'badge-success' : log.returnRate >= 85 ? 'badge-warning' : 'badge-danger'}`}>
                          {log.returnRate}%
                        </span>
                      </td>
                      <td>
                        {log.hasFlag ? (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MdWarning /> {log.flagReason || 'Bottle Unreturned'}
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MdCheckCircle /> Clean Return
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Super Admin Incident Review Modal */}
      <AnimatePresence>
        {reviewModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setReviewModal(null)}>
            <motion.div className="modal" style={{ maxWidth: 520 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdReportProblem style={{ color: '#ef4444' }} /> Super Admin Incident Review
                </h2>
                <button className="icon-btn" onClick={() => setReviewModal(null)}><MdClose /></button>
              </div>

              <div className="modal-body">
                <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{reviewModal.dp_name} ({reviewModal.route_name})</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Bottle Type: <strong>{reviewModal.bottle_type}</strong> | Broken: <strong style={{ color: '#ef4444' }}>{reviewModal.broken_count}</strong> | Unreturned: <strong style={{ color: '#ef4444' }}>{reviewModal.missing_count}</strong>
                  </div>
                  {reviewModal.manager_notes && (
                    <div style={{ fontSize: 12, marginTop: 8, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      Manager Note: "{reviewModal.manager_notes}"
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Super Admin Resolution Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Enter audit notes or resolution details..."
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setReviewModal(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm" disabled={resolving} onClick={() => handleResolveIncident('Resolved - Charged DP')}>
                  Charge DP
                </button>
                <button className="btn btn-success btn-sm" disabled={resolving} onClick={() => handleResolveIncident('Resolved - Reimbursed')}>
                  Reimburse & Resolve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
