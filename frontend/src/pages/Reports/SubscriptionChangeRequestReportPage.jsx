import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiDownload, FiSearch, FiRotateCcw } from 'react-icons/fi';
import api from '../../services/api';
import { exportSubscriptionChangeRequestExcel, exportSubscriptionChangeRequestPDF } from '../../utils/exportUtils';

export default function SubscriptionChangeRequestReportPage() {
  const navigate = useNavigate();

  // Filters
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedSubType, setSelectedSubType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Dropdowns
  const [customers, setCustomers] = useState([]);
  const [subscriptionTypes, setSubscriptionTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [statuses, setStatuses] = useState([]);

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
      const res = await api.get('/reports/subscription-change-options');
      if (res.data?.success) {
        const d = res.data.data;
        setCustomers(d.customers || []);
        setSubscriptionTypes(d.subscriptionTypes || ['Subscribe', 'Daily', 'Weekly', 'Monthly']);
        setProducts(d.products || []);
        setStatuses(d.statuses || ['Pending', 'Approved', 'Rejected', 'Completed']);
      }
    } catch (err) {
      console.error('Error fetching subscription change options:', err);
    }
  };

  const fetchReport = async (targetPage = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const params = {
        customer_id: selectedCustomer,
        subscription_type: selectedSubType,
        date_from: dateFrom,
        date_to: dateTo,
        product_id: selectedProduct,
        status: selectedStatus,
        page: targetPage,
        limit,
      };

      const res = await api.get('/reports/subscription-change-report', { params });
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
      console.error('Error fetching Subscription Change Request Report:', err);
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
    setSelectedSubType('');
    setDateFrom('');
    setDateTo('');
    setSelectedProduct('');
    setSelectedStatus('');
    setPage(1);
    setLoading(true);
    api.get('/reports/subscription-change-report', {
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
      subscription_type: selectedSubType,
      date_from: dateFrom,
      date_to: dateTo,
      product_id: selectedProduct,
      status: selectedStatus,
      export_all: 'true',
    };
    const res = await api.get('/reports/subscription-change-report', { params });
    if (res.data?.success) {
      return res.data.rows || [];
    }
    throw new Error('Failed to fetch filtered export data');
  };

  const getFilterLabels = () => {
    const custObj = customers.find(c => c.id === selectedCustomer);
    const prodObj = products.find(p => p.id === selectedProduct || p.name === selectedProduct);
    let dateStr = '';
    if (dateFrom && dateTo) dateStr = `${dateFrom} to ${dateTo}`;
    else if (dateFrom) dateStr = `From ${dateFrom}`;
    else if (dateTo) dateStr = `Up to ${dateTo}`;

    return {
      customer: custObj ? custObj.label : selectedCustomer,
      subscriptionType: selectedSubType,
      changeRequestDate: dateStr,
      product: prodObj ? prodObj.name : selectedProduct,
      status: selectedStatus,
    };
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const dataRows = await fetchAllFilteredDataForExport();
      exportSubscriptionChangeRequestExcel({ rows: dataRows, filters: getFilterLabels() });
      toast.success('Subscription Change Request Report exported to Excel!');
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
      exportSubscriptionChangeRequestPDF({ rows: dataRows, filters: getFilterLabels() });
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
          Customer - Subscription Change Request Report
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
          View subscription change requests with previous vs changed quantities and request details.
        </p>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            
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
                <option value="">[ Select Customer ▼ ]</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subscription Type Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Subscription Type
              </label>
              <select
                value={selectedSubType}
                onChange={(e) => setSelectedSubType(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Type ▼ ]</option>
                {subscriptionTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Change Request Date Filters */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Start Request Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                End Request Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            {/* Product Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Product
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Product ▼ ]</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Status ▼ ]</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
            >
              <FiSearch size={16} /> View
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
            'Loading change request data...'
          ) : (
            `Displaying ${startRecord}-${endRecord} of ${totalRecords} results.`
          )}
        </p>
      </div>

      {/* Table Section */}
      <div className="card" style={{ padding: 0, borderRadius: 12, overflowX: 'auto', backgroundColor: '#fff', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1100 }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Subscription Type</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Start Date</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Delivery Type</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Delivery Boy</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Product Name</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Packaging</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Qty</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Changed Qty</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Change Request Date</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Entry by</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading change request records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No results found.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                    {row.customer}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                      {row.subscription_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {row.start_date}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                    {row.delivery_type}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                    {row.delivery_boy}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                    {row.product_name}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                    {row.packaging}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>
                    {row.qty}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#166534', textAlign: 'right' }}>
                    {row.changed_qty}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {row.change_request_date}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {row.entry_by}
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
