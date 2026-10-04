import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  FiArrowLeft,
  FiDownload,
  FiSearch,
  FiRotateCcw,
  FiCalendar,
  FiUser,
  FiMapPin,
  FiTruck,
  FiInfo,
  FiCheckCircle,
} from 'react-icons/fi';
import api from '../../services/api';
import { exportMarkDeliveryExcel, exportMarkDeliveryPDF } from '../../utils/exportUtils';

export default function MarkDeliveryReportPage() {
  const navigate = useNavigate();

  // Helper for formatting date as YYYY-MM-DD
  const getTodayStr = () => new Date().toISOString().substring(0, 10);
  const getFirstDayOfMonthStr = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  };

  // Filter States
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedHub, setSelectedHub] = useState('');
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState('');
  const [city] = useState('Chennai');

  // Option Dropdowns
  const [customers, setCustomers] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [deliveryBoys, setDeliveryBoys] = useState([]);

  // Data & Pagination
  const [rows, setRows] = useState([]);
  const [totalsRow, setTotalsRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch filter options on mount
  useEffect(() => {
    fetchOptions();
  }, []);

  // Fetch report data on filter or pagination changes
  useEffect(() => {
    fetchReport(page, pageSize);
  }, [page, pageSize]);

  const fetchOptions = async () => {
    try {
      const res = await api.get('/reports/mark-delivery-options');
      if (res.data?.success) {
        const d = res.data.data;
        setCustomers(d.customers || []);
        setHubs(d.hubs || []);
        setDeliveryBoys(d.deliveryBoys || []);
      }
    } catch (err) {
      console.error('Error fetching Mark Delivery options:', err);
    }
  };

  const fetchReport = async (targetPage = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        customer_id: selectedCustomer,
        hub_id: selectedHub,
        delivery_boy_id: selectedDeliveryBoy,
        city,
        page: targetPage,
        limit,
      };

      const res = await api.get('/reports/mark-delivery', { params });
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotalsRow(res.data.totalsRow || null);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setRows([]);
        setTotalsRow(null);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching Mark Delivery Report:', err);
      toast.error('Failed to load Mark Delivery Report data.');
      setRows([]);
      setTotalsRow(null);
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
    const startD = getFirstDayOfMonthStr();
    const endD = getTodayStr();
    setDateFrom(startD);
    setDateTo(endD);
    setSelectedCustomer('');
    setSelectedHub('');
    setSelectedDeliveryBoy('');
    setPage(1);
    
    // Trigger reset fetch
    setLoading(true);
    api.get('/reports/mark-delivery', {
      params: {
        date_from: startD,
        date_to: endD,
        customer_id: '',
        hub_id: '',
        delivery_boy_id: '',
        city: 'Chennai',
        page: 1,
        limit: pageSize,
      }
    }).then(res => {
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotalsRow(res.data.totalsRow || null);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    }).finally(() => setLoading(false));
  };

  const fetchAllFilteredDataForExport = async () => {
    const params = {
      date_from: dateFrom,
      date_to: dateTo,
      customer_id: selectedCustomer,
      hub_id: selectedHub,
      delivery_boy_id: selectedDeliveryBoy,
      city,
      export_all: 'true',
    };
    const res = await api.get('/reports/mark-delivery', { params });
    if (res.data?.success) {
      return {
        rows: res.data.rows || [],
        totalsRow: res.data.totalsRow || null,
        startDate: res.data.startDate || dateFrom,
        endDate: res.data.endDate || dateTo,
      };
    }
    throw new Error('Failed to fetch filtered data for export');
  };

  const getFilterLabels = () => {
    const custObj = customers.find(c => c.id === selectedCustomer);
    const hubObj = hubs.find(h => h.id === selectedHub || h.name === selectedHub);
    const dpObj = deliveryBoys.find(d => d.id === selectedDeliveryBoy);

    return {
      customer: custObj ? custObj.label : selectedCustomer,
      hub: hubObj ? hubObj.name : selectedHub,
      deliveryBoy: dpObj ? dpObj.label : selectedDeliveryBoy,
      city,
    };
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const data = await fetchAllFilteredDataForExport();
      exportMarkDeliveryExcel({
        rows: data.rows,
        totalsRow: data.totalsRow,
        startDate: data.startDate,
        endDate: data.endDate,
        filters: getFilterLabels(),
      });
      toast.success('Mark Delivery Report exported to Excel successfully!');
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
      const data = await fetchAllFilteredDataForExport();
      exportMarkDeliveryPDF({
        rows: data.rows,
        totalsRow: data.totalsRow,
        startDate: data.startDate,
        endDate: data.endDate,
        filters: getFilterLabels(),
      });
      toast.success('PDF print window opened for Mark Delivery Report!');
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
          MARK DELIVERY REPORT
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
          View and compare scheduled vs delivered quantities, bottle deliveries, and collections across customers and delivery boys.
        </p>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
            
            {/* Date Range Filters */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Start Date
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
                End Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
                <option value="">[ Select Customer ▼ ]</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Hub Filter */}
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
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Boy Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Delivery Boy
              </label>
              <select
                value={selectedDeliveryBoy}
                onChange={(e) => setSelectedDeliveryBoy(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Delivery Boy ▼ ]</option>
                {deliveryBoys.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* City Filter (Read-only) */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                City
              </label>
              <input
                type="text"
                value="Chennai"
                readOnly
                disabled
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
              />
            </div>
          </div>

          {/* Action Buttons */}
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

      {/* Business Note Box */}
      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderLeft: '4px solid #f59e0b', padding: '12px 16px', borderRadius: 8, marginBottom: 20 }}>
        <p style={{ margin: 0, color: '#92400e', fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>
          <strong>Note:</strong> *If bottle count is in negative (that might be because of previously unmarked delivery/deliveries). Bottles would be adjusted in the next delivery.
        </p>
      </div>

      {/* Results Header Counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
          {loading ? (
            'Loading report data...'
          ) : (
            `Displaying ${startRecord}-${endRecord} of ${totalRecords} results.`
          )}
        </p>
      </div>

      {/* Table Section */}
      <div className="card" style={{ padding: 0, borderRadius: 12, overflowX: 'auto', backgroundColor: '#fff', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1200 }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Delivery Date</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer Name</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Address</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>City</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Hub</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Delivery Boy</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Subscription Type</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Product</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Scheduled Qty</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Delivered Qty</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Bottle Delivered</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Bottle Collected</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Remark</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Narration</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading Mark Delivery records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No results found.
                </td>
              </tr>
            ) : (
              <>
                {rows.map((row, idx) => (
                  <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {row.delivery_date}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                      {row.customer_name}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.address}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                      {row.city || 'Chennai'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                      {row.hub}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                      {row.delivery_boy}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                        {row.subscription_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                      {row.product}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>
                      {row.scheduled_qty}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#166534', textAlign: 'right' }}>
                      {row.delivered_qty}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: row.bottle_delivered < 0 ? '#dc2626' : 'var(--text-main)', textAlign: 'right' }}>
                      {row.bottle_delivered}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#0284c7', textAlign: 'right' }}>
                      {row.bottle_collected}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {row.remark}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {row.narration}
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                {totalsRow && (
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700, borderTop: '2px solid #0284c7', borderBottom: '2px solid #0284c7' }}>
                    <td style={{ padding: '14px', fontSize: 14, color: '#0f172a', fontWeight: 800 }}>
                      Total
                    </td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px', fontSize: 14, color: '#0f172a', fontWeight: 800, textAlign: 'right' }}>
                      {totalsRow.scheduled_qty}
                    </td>
                    <td style={{ padding: '14px', fontSize: 14, color: '#166534', fontWeight: 800, textAlign: 'right' }}>
                      {totalsRow.delivered_qty}
                    </td>
                    <td style={{ padding: '14px', fontSize: 14, color: '#0f172a', fontWeight: 800, textAlign: 'right' }}>
                      {totalsRow.bottle_delivered}
                    </td>
                    <td style={{ padding: '14px', fontSize: 14, color: '#0284c7', fontWeight: 800, textAlign: 'right' }}>
                      {totalsRow.bottle_collected}
                    </td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
                  </tr>
                )}
              </>
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
