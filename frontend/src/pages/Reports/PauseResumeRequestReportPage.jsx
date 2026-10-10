import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiDownload, FiSearch, FiRotateCcw } from 'react-icons/fi';
import { PauseCircle, CalendarDays, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { exportPauseResumeRequestExcel, exportPauseResumeRequestPDF } from '../../utils/exportUtils';

export default function PauseResumeRequestReportPage() {
  const navigate = useNavigate();

  // Filters
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [pauseDateFrom, setPauseDateFrom] = useState('');
  const [pauseDateTo, setPauseDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdowns
  const [customers, setCustomers] = useState([]);

  // Data & Pagination
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchReport(page, pageSize);
  }, [page, pageSize]);

  const fetchOptions = async () => {
    try {
      const res = await api.get('/reports/pause-resume-options');
      if (res.data?.success) {
        setCustomers(res.data.data.customers || []);
      }
    } catch (err) {
      console.error('Error fetching pause options:', err);
    }
  };

  const fetchReport = async (targetPage = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const params = {
        customer_id: selectedCustomer,
        pause_date_from: pauseDateFrom,
        pause_date_to: pauseDateTo,
        status_filter: statusFilter,
        page: targetPage,
        limit,
      };

      const res = await api.get('/reports/pause-resume-report', { params });
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setRows([]);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching Pause Resume Request Report:', err);
      toast.error('Failed to load report data.');
      setRows([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchReport(1, pageSize);
  };

  const handleReset = () => {
    setSelectedCustomer('');
    setPauseDateFrom('');
    setPauseDateTo('');
    setStatusFilter('');
    setPage(1);
    setLoading(true);
    api.get('/reports/pause-resume-report', {
      params: { page: 1, limit: pageSize }
    }).then(res => {
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    }).finally(() => setLoading(false));
  };

  const fetchAllFilteredDataForExport = async () => {
    const params = {
      customer_id: selectedCustomer,
      pause_date_from: pauseDateFrom,
      pause_date_to: pauseDateTo,
      export_all: 'true',
    };
    const res = await api.get('/reports/pause-resume-report', { params });
    if (res.data?.success) {
      return res.data.rows || [];
    }
    throw new Error('Failed to fetch filtered export data');
  };

  const getFilterLabels = () => {
    const custObj = customers.find(c => c.id === selectedCustomer);
    let pDateStr = '';
    if (pauseDateFrom && pauseDateTo) pDateStr = `${pauseDateFrom} to ${pauseDateTo}`;
    else if (pauseDateFrom) pDateStr = `From ${pauseDateFrom}`;
    else if (pauseDateTo) pDateStr = `Up to ${pauseDateTo}`;

    return {
      customer: custObj ? custObj.label : selectedCustomer,
      pauseDate: pDateStr,
    };
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const dataRows = await fetchAllFilteredDataForExport();
      exportPauseResumeRequestExcel({ rows: dataRows, filters: getFilterLabels() });
      toast.success('Pause Resume Request Report exported to Excel!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export to Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const dataRows = await fetchAllFilteredDataForExport();
      exportPauseResumeRequestPDF({ rows: dataRows, filters: getFilterLabels() });
      toast.success('PDF print window opened!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export to PDF.');
    } finally {
      setExporting(false);
    }
  };

  const startRecord = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalRecords);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Top Header & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/reports')}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
          >
            <FiArrowLeft size={16} /> ← Back
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting || totalRecords === 0}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
          >
            <FiDownload size={16} /> ↓ Export to PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting || totalRecords === 0}
            className="btn btn-success"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14, backgroundColor: '#166534', color: '#fff' }}
          >
            <FiDownload size={16} /> ↓ Export to Excel
          </button>
        </div>

        {/* Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Page size:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="form-control"
            style={{ width: 80, padding: '6px 10px', borderRadius: 6, fontSize: 14 }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Page Title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
          Pause Resume Request Report
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
          View customer subscription pause and hold requests with request dates and status.
        </p>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>

            {/* Pause Start Date */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Pause Start Date
              </label>
              <input
                type="date"
                value={pauseDateFrom}
                onChange={(e) => setPauseDateFrom(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            {/* Pause End Date */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Pause End Date
              </label>
              <input
                type="date"
                value={pauseDateTo}
                onChange={(e) => setPauseDateTo(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            {/* Customer Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ All Customers ]</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ All Statuses ]</option>
                <option value="Active">Active (Currently Paused)</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed / Resumed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
            >
              <FiSearch size={16} /> Search
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
            >
              <FiRotateCcw size={16} /> Reset
            </button>
          </div>
        </form>
      </div>

      {/* Results Header Counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
          {loading ? (
            'Loading pause request data...'
          ) : (
            `Displaying ${startRecord}-${endRecord} of ${totalRecords} results.`
          )}
        </p>
      </div>

      {/* Table Section */}
      <div className="card" style={{ padding: 0, borderRadius: 12, overflowX: 'auto', backgroundColor: '#fff', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>#</th>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer</th>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Products / Plan</th>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Type</th>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Pause Period</th>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Reason</th>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Requested On</th>
              <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading pause request records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <PauseCircle size={36} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                  No pause records found.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                // Compute badge colors based on status
                const statusColors = {
                  Active:    { bg: '#fee2e2', color: '#991b1b' },
                  Upcoming:  { bg: '#fef9c3', color: '#854d0e' },
                  Completed: { bg: '#dcfce7', color: '#166534' },
                  Resumed:   { bg: '#dcfce7', color: '#166534' },
                  Cancelled: { bg: '#f1f5f9', color: '#64748b' },
                };
                const sc = statusColors[row.status] || { bg: '#f1f5f9', color: '#64748b' };

                // Pause period display
                const startDate = row.pause_start_date || row.pause_date || '—';
                const endDate   = row.pause_end_date   || row.pause_date || '—';
                const sameDay   = startDate === endDate;

                return (
                  <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {(page - 1) * pageSize + idx + 1}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>{row.customer_name}</div>
                      {row.customer_phone && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{row.customer_phone}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-main)' }}>
                      {row.plan}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', background: '#ede9fe', color: '#4c1d95', borderRadius: 4, fontWeight: 600 }}>
                        {row.pause_type || 'Pause'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CalendarDays size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{startDate}</span>
                        {!sameDay && (
                          <>
                            <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontWeight: 600 }}>{endDate}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 180 }}>
                      {row.reason || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {row.pause_request_date}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', backgroundColor: sc.bg, color: sc.color, borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
          <button
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="btn btn-outline"
            style={{ padding: '6px 12px', borderRadius: 6, fontSize: 14, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          >
            «
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
            <button
              key={pNum}
              onClick={() => setPage(pNum)}
              className={page === pNum ? 'btn btn-primary' : 'btn btn-outline'}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: page === pNum ? 700 : 500,
                backgroundColor: page === pNum ? 'var(--primary)' : 'transparent',
                color: page === pNum ? '#fff' : 'var(--text-main)',
              }}
            >
              {pNum}
            </button>
          ))}

          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages}
            className="btn btn-outline"
            style={{ padding: '6px 12px', borderRadius: 6, fontSize: 14, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
          >
            »
          </button>
        </div>
      )}

    </div>
  );
}
