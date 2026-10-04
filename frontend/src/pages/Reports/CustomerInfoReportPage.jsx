import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MdArrowBack, MdViewList, MdPictureAsPdf, MdFileDownload,
  MdSearch, MdRefresh, MdBuild, MdContactPage, MdChevronLeft, MdChevronRight
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

export default function CustomerInfoReportPage() {
  const navigate = useNavigate();

  // Filter & Pagination States
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Customer options for filter dropdown
  const [customerOptions, setCustomerOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Report Data States
  const [reportData, setReportData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Export loading states
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Load customer filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setOptionsLoading(true);
      try {
        const res = await api.get('/reports/filter-options');
        if (res.data?.success && res.data.data?.customers) {
          setCustomerOptions(res.data.data.customers);
        }
      } catch (err) {
        console.error('Failed to load customer list:', err);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch Report Data from API
  const fetchReportData = async (page = currentPage, limit = pageSize, custId = selectedCustomerId) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        customer_id: custId || '',
      };
      const res = await api.get('/reports/customer-info', { params });
      if (res.data?.success) {
        setReportData(res.data.data || []);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch Customer Info Report:', err);
      toast.error('Failed to load customer information report.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch report on page/pageSize changes
  useEffect(() => {
    fetchReportData(currentPage, pageSize, selectedCustomerId);
  }, [currentPage, pageSize]);

  // Handle Search Click
  const handleSearch = () => {
    setCurrentPage(1);
    fetchReportData(1, pageSize, selectedCustomerId);
  };

  // Handle Reset Click
  const handleReset = () => {
    setSelectedCustomerId('');
    setCurrentPage(1);
    fetchReportData(1, pageSize, '');
    toast.success('Filters reset to show all customers.');
  };

  // Handle Page Size Change
  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Helper to fetch all matching customer records for export regardless of UI pagination
  const fetchAllExportRows = async () => {
    const params = {
      page: 1,
      limit: 100000,
      customer_id: selectedCustomerId || '',
    };
    const res = await api.get('/reports/customer-info', { params });
    return res.data?.data || reportData;
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    if (totalRecords === 0) {
      toast.error('No customer data available to export.');
      return;
    }

    setExportingExcel(true);
    toast.loading('Generating Excel...', { id: 'export-toast' });

    try {
      const exportRows = await fetchAllExportRows();

      if (!exportRows || exportRows.length === 0) {
        toast.error('No customer data available to export.', { id: 'export-toast' });
        return;
      }

      const headers = [
        'Customer ID',
        'Customer Name',
        'Mobile',
        'Current Wallet Balance',
        'Last Recharge Date',
        'Last Recharge Amount',
        'Last Order Delivered Date',
        'Last Subscription Delivered Date',
      ];

      const mappedRows = exportRows.map(r => [
        r.customer_id,
        r.customer_name,
        r.mobile,
        `₹${r.wallet_balance}`,
        r.last_recharge_date,
        r.last_recharge_amount !== '-' ? `₹${r.last_recharge_amount}` : '-',
        r.last_order_delivered_date,
        r.last_subscription_delivered_date,
      ]);

      const custObj = customerOptions.find(c => String(c.id) === String(selectedCustomerId));
      const filterInfo = `Customer Filter: ${custObj ? custObj.label : 'All Customers'} | Total Records: ${exportRows.length}`;

      exportToExcel({
        fileName: 'customer_information_report',
        reportTitle: 'Customer Information Report',
        filterInfo,
        headers,
        rows: mappedRows,
      });

      toast.success('Customer Information Report exported to Excel successfully!', { id: 'export-toast' });
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('Failed to export report.', { id: 'export-toast' });
    } finally {
      setExportingExcel(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (totalRecords === 0) {
      toast.error('No customer data available to export.');
      return;
    }

    setExportingPdf(true);
    toast.loading('Generating PDF...', { id: 'pdf-toast' });

    try {
      const exportRows = await fetchAllExportRows();

      if (!exportRows || exportRows.length === 0) {
        toast.error('No customer data available for PDF.', { id: 'pdf-toast' });
        return;
      }

      const headers = [
        'Customer ID',
        'Customer Name',
        'Mobile',
        'Current Wallet Balance',
        'Last Recharge Date',
        'Last Recharge Amount',
        'Last Order Delivered Date',
        'Last Subscription Delivered Date',
      ];

      const mappedRows = exportRows.map(r => [
        r.customer_id,
        r.customer_name,
        r.mobile,
        `₹${r.wallet_balance}`,
        r.last_recharge_date,
        r.last_recharge_amount !== '-' ? `₹${r.last_recharge_amount}` : '-',
        r.last_order_delivered_date,
        r.last_subscription_delivered_date,
      ]);

      const custObj = customerOptions.find(c => String(c.id) === String(selectedCustomerId));
      const filterInfo = `Customer Filter: ${custObj ? custObj.label : 'All Customers'}`;

      exportToPDF({
        reportTitle: 'Customer Information Report',
        filterInfo,
        headers,
        rows: mappedRows,
        totalRecords: exportRows.length,
      });

      toast.success('Generated PDF report preview!', { id: 'pdf-toast' });
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Failed to generate PDF report.', { id: 'pdf-toast' });
    } finally {
      setExportingPdf(false);
    }
  };

  // Helper for rendering pagination page numbers
  const renderPaginationButtons = () => {
    const pages = [];
    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      pages.push(p);
    }

    return pages;
  };

  // Calculate Displaying X-Y of Z text
  const startIdx = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalRecords);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ════════════════════════════════════════════════════════
           TOP ACTION BAR
           ════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/reports/general')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, padding: '7px 14px', borderRadius: '8px' }}
            >
              <MdArrowBack style={{ fontSize: 16 }} /> Back
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSelectedCustomerId(''); setCurrentPage(1); fetchReportData(1, pageSize, ''); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, padding: '7px 14px', borderRadius: '8px' }}
            >
              <MdViewList style={{ fontSize: 16 }} /> List
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleExportPDF}
              disabled={totalRecords === 0 || exportingPdf || exportingExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                opacity: (totalRecords === 0 || exportingPdf || exportingExcel) ? 0.5 : 1,
                cursor: (totalRecords === 0 || exportingPdf || exportingExcel) ? 'not-allowed' : 'pointer'
              }}
            >
              <MdPictureAsPdf style={{ fontSize: 16 }} />
              {exportingPdf ? 'Generating PDF...' : 'Export to PDF'}
            </button>

            <button
              className="btn btn-success btn-sm"
              onClick={handleExportExcel}
              disabled={totalRecords === 0 || exportingPdf || exportingExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                opacity: (totalRecords === 0 || exportingPdf || exportingExcel) ? 0.5 : 1,
                cursor: (totalRecords === 0 || exportingPdf || exportingExcel) ? 'not-allowed' : 'pointer'
              }}
            >
              <MdFileDownload style={{ fontSize: 16 }} />
              {exportingExcel ? 'Generating Excel...' : '↓ Export to Excel'}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
           REPORT HEADER & PAGE SIZE / LAYOUT CONTROLS
           ════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: 4 }}>
              Reports &rsaquo; General
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <MdContactPage style={{ color: 'var(--primary, #3b82f6)', fontSize: 26 }} />
              Customer Information Report
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
              <span>Page Size:</span>
              <select
                className="form-select"
                value={pageSize}
                onChange={handlePageSizeChange}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13, fontWeight: 600 }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: '6px', fontSize: 13, fontWeight: 600 }}
            >
              <MdBuild style={{ fontSize: 14 }} /> Layout
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
           FILTER CARD
           ════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                Customer Name
              </label>
              <select
                className="form-select"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
              >
                <option value="">[ Select Customer Name ▼ ]</option>
                {customerOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleSearch}
                disabled={loading}
                style={{ padding: '9px 20px', borderRadius: '8px', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <MdSearch style={{ fontSize: 16 }} /> Search
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={loading}
                style={{ padding: '9px 16px', borderRadius: '8px', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <MdRefresh style={{ fontSize: 16 }} /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
           PAGINATION INFO & REPORT TABLE
           ════════════════════════════════════════════════════════ */}
        <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {/* Table Toolbar & Pagination Counter */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>
              Displaying {startIdx}-{endIdx} of {totalRecords} results.
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  style={{ padding: '4px 8px', borderRadius: '6px' }}
                >
                  &laquo;
                </button>

                {renderPaginationButtons().map(p => (
                  <button
                    key={p}
                    className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCurrentPage(p)}
                    disabled={loading}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: p === currentPage ? 700 : 500,
                      minWidth: 32
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                  style={{ padding: '4px 8px', borderRadius: '6px' }}
                >
                  &raquo;
                </button>
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <div className="spinner-border text-primary" style={{ width: 36, height: 36, marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 500 }}>Loading Customer Information Report...</p>
            </div>
          ) : reportData.length === 0 ? (
            /* Empty State */
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: 0 }}>
                No customer records found.
              </h4>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                No matching customer data is available for the selected filter.
              </p>
            </div>
          ) : (
            /* Report Table */
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--border, #cbd5e1)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Customer ID</th>
                    <th style={{ padding: '12px 14px' }}>Customer Name</th>
                    <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Mobile</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Current Wallet Balance</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Last Recharge Date</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Last Recharge Amount</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Last Order Delivered Date</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Last Subscription Delivered Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row) => {
                    const isNeg = row.wallet_balance < 0;
                    const isPos = row.wallet_balance > 0;
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--primary, #3b82f6)', whiteSpace: 'nowrap' }}>
                          {row.customer_id}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                          {row.customer_name}
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary, #475569)' }}>
                          {row.mobile}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: isNeg ? '#ef4444' : (isPos ? '#10b981' : 'var(--text-primary)') }}>
                          ₹{row.wallet_balance}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {row.last_recharge_date}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {row.last_recharge_amount !== '-' ? `₹${row.last_recharge_amount}` : '-'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {row.last_order_delivered_date}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {row.last_subscription_delivered_date}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Pagination Bar */}
          {!loading && totalPages > 1 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, #e2e8f0)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                Page {currentPage} of {totalPages}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '4px 8px', borderRadius: '6px' }}
                >
                  &laquo;
                </button>

                {renderPaginationButtons().map(p => (
                  <button
                    key={p}
                    className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCurrentPage(p)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: p === currentPage ? 700 : 500,
                      minWidth: 32
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '4px 8px', borderRadius: '6px' }}
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
