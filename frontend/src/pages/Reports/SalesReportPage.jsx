import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiDownload, FiSearch, FiRotateCcw, FiFileText, FiClock } from 'react-icons/fi';
import api from '../../services/api';
import { exportSalesReportExcel } from '../../utils/exportUtils';

export default function SalesReportPage() {
  const navigate = useNavigate();

  // Helper dates
  const getTodayStr = () => new Date().toISOString().substring(0, 10);
  const getFirstDayOfMonthStr = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  };

  // Filters
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [selectedHub, setSelectedHub] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Dropdown options
  const [customers, setCustomers] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [cities, setCities] = useState(['Chennai']);

  // Table Data & Pagination
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [viewBillModal, setViewBillModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchReport(page, pageSize);
  }, [page, pageSize]);

  const fetchOptions = async () => {
    try {
      const res = await api.get('/reports/sales-report-options');
      if (res.data?.success) {
        setCustomers(res.data.customers || []);
        setHubs(res.data.hubs || []);
        setCities(res.data.cities || ['Chennai']);
      }
    } catch (err) {
      console.error('Error fetching sales report options:', err);
    }
  };

  const fetchReport = async (targetPage = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const params = {
        customer_id: selectedCustomer,
        date_from: dateFrom,
        date_to: dateTo,
        hub: selectedHub,
        city: selectedCity,
        page: targetPage,
        limit,
      };

      const res = await api.get('/reports/sales-report', { params });
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
      console.error('Error fetching sales report:', err);
      toast.error('Failed to load Sales Report.');
      setRows([]);
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
    const startD = getFirstDayOfMonthStr();
    const endD = getTodayStr();
    setSelectedCustomer('');
    setDateFrom(startD);
    setDateTo(endD);
    setSelectedHub('');
    setSelectedCity('');
    setPage(1);

    setLoading(true);
    api.get('/reports/sales-report', {
      params: {
        customer_id: '',
        date_from: startD,
        date_to: endD,
        hub: '',
        city: '',
        page: 1,
        limit: pageSize,
      }
    }).then(res => {
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    }).finally(() => setLoading(false));
  };

  const handleExportExcel = async () => {
    if (totalRecords === 0) {
      toast.error('No data available to export');
      return;
    }
    setExporting(true);
    try {
      const params = {
        customer_id: selectedCustomer,
        date_from: dateFrom,
        date_to: dateTo,
        hub: selectedHub,
        city: selectedCity,
        export_all: 'true',
      };
      const res = await api.get('/reports/sales-report', { params });
      const exportRows = res.data?.rows || rows;

      const filterInfo = `Period: ${dateFrom} to ${dateTo} | Customer: ${selectedCustomer || 'All'} | Hub: ${selectedHub || 'All'} | City: ${selectedCity || 'All'}`;
      exportSalesReportExcel({
        rows: exportRows,
        startDate: dateFrom,
        endDate: dateTo,
        filterInfo,
      });
      toast.success('Sales Report exported to Excel!');
    } catch (err) {
      console.error('Error exporting Excel:', err);
      toast.error('Failed to export Sales Report Excel.');
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

      {/* Page Title Row */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
          Sales Report
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
          Track sales transactions, generate customer bills, and view payment histories
        </p>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            
            {/* Customer */}
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
                <option value="">[ Select Customer ▼ ]</option>
                {customers.map((c) => (
                  <option key={c.id || c.customer_ref_id} value={c.customer_ref_id || c.id}>
                    {c.customer_ref_id} - {c.name} ({c.phone || ''})
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            {/* To Date */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            {/* Hub */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Hub
              </label>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Hub ▼ ]</option>
                {hubs.map((h) => (
                  <option key={h.id || h.branch_name} value={h.branch_name || h.id}>
                    {h.branch_name}
                  </option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                City
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select City ▼ ]</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Search & Reset Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
            >
              <FiSearch size={16} /> 🔍 Search
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
            'Loading sales report data...'
          ) : (
            `Displaying ${startRecord}-${endRecord} of ${totalRecords} results.`
          )}
        </p>
      </div>

      {/* Table Section */}
      <div className="card" style={{ padding: 0, borderRadius: 12, overflowX: 'auto', backgroundColor: '#fff', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 950 }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer ID</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Route</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Date</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>View Bill</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Payment History</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading sales report records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No sales records found for the selected criteria.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                    {row.customer_id}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                    {row.customer}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                    {row.route}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {row.date}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#166534', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    ₹{parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'center' }}>
                    <button
                      onClick={() => setViewBillModal(row)}
                      className="btn btn-outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#2563eb' }}
                    >
                      <FiFileText size={14} /> View Bill
                    </button>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'center' }}>
                    <button
                      onClick={() => setHistoryModal(row)}
                      className="btn btn-outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                    >
                      <FiClock size={14} /> Payment History
                    </button>
                  </td>
                </tr>
              ))
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

      {/* View Bill Modal */}
      {viewBillModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>Bill Invoice Summary</h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>{viewBillModal.invoice_number || 'INV-2026-001'}</p>
              </div>
              <button onClick={() => setViewBillModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Customer:</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{viewBillModal.customer} ({viewBillModal.customer_id})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Route:</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{viewBillModal.route}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Bill Date:</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{viewBillModal.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>City / Location:</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{viewBillModal.city || 'Chennai'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Total Bill Amount:</span>
                <span style={{ fontWeight: 800, color: '#166534', fontSize: 16 }}>₹{parseFloat(viewBillModal.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setViewBillModal(null)}
                className="btn btn-primary"
                style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {historyModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>Customer Payment History</h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>{historyModal.customer} ({historyModal.customer_id})</p>
              </div>
              <button onClick={() => setHistoryModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ padding: '16px 0', fontSize: 14 }}>
              <div style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Recent Transactions</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Recharge on {historyModal.date}:</span>
                  <span style={{ fontWeight: 700, color: '#166534' }}>₹{parseFloat(historyModal.amount || 0).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Payment Method: Online (UPI / Wallet)</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setHistoryModal(null)}
                className="btn btn-primary"
                style={{ padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
