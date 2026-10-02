import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiDownload, FiSearch, FiRotateCcw, FiCheckCircle } from 'react-icons/fi';
import api from '../../services/api';
import { exportPaymentApprovalPDF } from '../../utils/exportUtils';

export default function PaymentApprovalReportPage() {
  const navigate = useNavigate();

  // Helper dates
  const getTodayStr = () => new Date().toISOString().substring(0, 10);
  const getFirstDayOfMonthStr = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  };

  // Filters
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [selectedOfficeUser, setSelectedOfficeUser] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Dropdown options
  const [officeUsers, setOfficeUsers] = useState([]);
  const [cities, setCities] = useState(['Chennai']);

  // Table Data & Pagination
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
      const res = await api.get('/reports/payment-approval-options');
      if (res.data?.success) {
        setOfficeUsers(res.data.officeUsers || []);
        setCities(res.data.cities || ['Chennai']);
      }
    } catch (err) {
      console.error('Error fetching payment approval options:', err);
    }
  };

  const fetchReport = async (targetPage = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        office_user: selectedOfficeUser,
        city: selectedCity,
        page: targetPage,
        limit,
      };

      const res = await api.get('/reports/payment-approval', { params });
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
      console.error('Error fetching payment approval report:', err);
      toast.error('Failed to load Payment Approval report.');
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
    setDateFrom(startD);
    setDateTo(endD);
    setSelectedOfficeUser('');
    setSelectedCity('');
    setPage(1);

    setLoading(true);
    api.get('/reports/payment-approval', {
      params: {
        date_from: startD,
        date_to: endD,
        office_user: '',
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

  const handleExportPDF = async () => {
    if (totalRecords === 0) {
      toast.error('No data available to export');
      return;
    }
    setExporting(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        office_user: selectedOfficeUser,
        city: selectedCity,
        export_all: 'true',
      };
      const res = await api.get('/reports/payment-approval', { params });
      const exportRows = res.data?.rows || rows;

      const filterInfo = `Period: ${dateFrom} to ${dateTo} | Office User: ${selectedOfficeUser || 'All'} | City: ${selectedCity || 'All'}`;
      exportPaymentApprovalPDF({
        rows: exportRows,
        startDate: dateFrom,
        endDate: dateTo,
        filterInfo,
      });
      toast.success('PDF print window opened!');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      toast.error('Failed to export PDF report.');
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
          Payment Approval
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
          View and verify payment approval records for office transactions
        </p>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            
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

            {/* Office User */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Office User
              </label>
              <select
                value={selectedOfficeUser}
                onChange={(e) => setSelectedOfficeUser(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Office User ▼ ]</option>
                {officeUsers.map((u) => (
                  <option key={u.id || u.name} value={u.name || u.id}>
                    {u.name} ({u.role || 'Admin'})
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
            'Loading payment approval data...'
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
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer Id</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Pay Date</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Remark / Payment History</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Entry by</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>Approval</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading payment approval records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No payment approval records found for the selected criteria.
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
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {row.pay_date}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {row.remark || '-'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#166534', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    ₹{parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                    {row.entry_by || 'Admin'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                      <FiCheckCircle size={13} />
                      {row.approval || 'Approved'}
                    </span>
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

    </div>
  );
}
