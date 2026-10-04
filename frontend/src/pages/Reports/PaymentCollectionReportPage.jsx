import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FiArrowLeft, FiDownload, FiSearch, FiRotateCcw, FiDollarSign, FiGift } from 'react-icons/fi';
import api from '../../services/api';
import { exportPaymentCollectionExcel, exportPaymentCollectionPDF } from '../../utils/exportUtils';

export default function PaymentCollectionReportPage() {
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
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedCustomerType, setSelectedCustomerType] = useState('');
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedCity] = useState('Chennai');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  // Option Dropdowns
  const [customers, setCustomers] = useState([]);
  const [customerTypes, setCustomerTypes] = useState(['Prepaid', 'Postpaid']);
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [modes, setModes] = useState(['Cash', 'Online']);
  const [paymentMethods, setPaymentMethods] = useState(['Card', 'Netbanking', 'Wallet', 'Emi', 'Upi', 'Cash', 'GPay', 'PhonePe', 'Razorpay']);

  // Data & Totals
  const [rows, setRows] = useState([]);
  const [totalsRow, setTotalsRow] = useState(null);
  const [totalAmountRecharged, setTotalAmountRecharged] = useState(0);
  const [totalCashback, setTotalCashback] = useState(0);
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
      const res = await api.get('/reports/payment-collection-options');
      if (res.data?.success) {
        const d = res.data.data;
        setCustomers(d.customers || []);
        setCustomerTypes(d.customerTypes || ['Prepaid', 'Postpaid']);
        setDeliveryBoys(d.deliveryBoys || []);
        setModes(d.modes || ['Cash', 'Online']);
        setPaymentMethods(d.paymentMethods || ['Card', 'Netbanking', 'Wallet', 'Emi', 'Upi', 'Cash', 'GPay', 'PhonePe', 'Razorpay']);
      }
    } catch (err) {
      console.error('Error fetching payment collection options:', err);
    }
  };

  const fetchReport = async (targetPage = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        customer_id: selectedCustomer,
        customer_type: selectedCustomerType,
        delivery_boy_id: selectedDeliveryBoy,
        mode: selectedMode,
        city: selectedCity,
        payment_method: selectedPaymentMethod,
        page: targetPage,
        limit,
      };

      const res = await api.get('/reports/payment-collection', { params });
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotalsRow(res.data.totalsRow || null);
        setTotalAmountRecharged(res.data.totalAmountRecharged || 0);
        setTotalCashback(res.data.totalCashback || 0);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setRows([]);
        setTotalsRow(null);
        setTotalAmountRecharged(0);
        setTotalCashback(0);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching Payment Collection Report:', err);
      toast.error('Failed to load Payment Collection Report.');
      setRows([]);
      setTotalsRow(null);
      setTotalAmountRecharged(0);
      setTotalCashback(0);
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
    setSelectedCustomerType('');
    setSelectedDeliveryBoy('');
    setSelectedMode('');
    setSelectedPaymentMethod('');
    setPage(1);

    setLoading(true);
    api.get('/reports/payment-collection', {
      params: {
        date_from: startD,
        date_to: endD,
        customer_id: '',
        customer_type: '',
        delivery_boy_id: '',
        mode: '',
        city: 'Chennai',
        payment_method: '',
        page: 1,
        limit: pageSize,
      }
    }).then(res => {
      if (res.data?.success) {
        setRows(res.data.rows || []);
        setTotalsRow(res.data.totalsRow || null);
        setTotalAmountRecharged(res.data.totalAmountRecharged || 0);
        setTotalCashback(res.data.totalCashback || 0);
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
      customer_type: selectedCustomerType,
      delivery_boy_id: selectedDeliveryBoy,
      mode: selectedMode,
      city: selectedCity,
      payment_method: selectedPaymentMethod,
      export_all: 'true',
    };
    const res = await api.get('/reports/payment-collection', { params });
    if (res.data?.success) {
      return {
        rows: res.data.rows || [],
        totalsRow: res.data.totalsRow || null,
        totalAmountRecharged: res.data.totalAmountRecharged || 0,
        totalCashback: res.data.totalCashback || 0,
        startDate: res.data.startDate || dateFrom,
        endDate: res.data.endDate || dateTo,
      };
    }
    throw new Error('Failed to fetch filtered export data');
  };

  const getFilterLabels = () => {
    const custObj = customers.find(c => c.id === selectedCustomer);
    const dpObj = deliveryBoys.find(d => d.id === selectedDeliveryBoy);

    return {
      customer: custObj ? custObj.label : selectedCustomer,
      customerType: selectedCustomerType,
      deliveryBoy: dpObj ? dpObj.label : selectedDeliveryBoy,
      mode: selectedMode,
      city: selectedCity,
      paymentMethod: selectedPaymentMethod,
    };
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const data = await fetchAllFilteredDataForExport();
      exportPaymentCollectionExcel({
        rows: data.rows,
        totalsRow: data.totalsRow,
        startDate: data.startDate,
        endDate: data.endDate,
        totalAmountRecharged: data.totalAmountRecharged,
        totalCashback: data.totalCashback,
        filters: getFilterLabels(),
      });
      toast.success('Payment Collection Report exported to Excel!');
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
      exportPaymentCollectionPDF({
        rows: data.rows,
        totalsRow: data.totalsRow,
        startDate: data.startDate,
        endDate: data.endDate,
        totalAmountRecharged: data.totalAmountRecharged,
        totalCashback: data.totalCashback,
        filters: getFilterLabels(),
      });
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

      {/* Page Title & Summary Cards Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
            Payment Collection Report
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
            Read-only summary of customer payments, wallet recharges, promocodes, cashback, and payment methods.
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 20px', borderRadius: 10, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Amount recharged
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 4 }}>
              Rs. {totalAmountRecharged.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '12px 20px', borderRadius: 10, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Cashback
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
              Rs. {totalCashback.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 16 }}>
            
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
                Customer Name
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

            {/* Customer Type Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Customer Type
              </label>
              <select
                value={selectedCustomerType}
                onChange={(e) => setSelectedCustomerType(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Customer Type ▼ ]</option>
                {customerTypes.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
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

            {/* Mode Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Mode
              </label>
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Mode ▼ ]</option>
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {m}
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

            {/* Payment Method Filter */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                Payment Method
              </label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              >
                <option value="">[ Select Payment Method ▼ ]</option>
                {paymentMethods.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
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
            'Loading payment collection data...'
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
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Date</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Customer</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Amount(Rs)</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Promocode</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>Cashback Amount</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Payment Method</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Remark / Payment History</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Mode</th>
              <th style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Narration</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading payment collection records...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No results found.
                </td>
              </tr>
            ) : (
              <>
                {rows.map((row, idx) => (
                  <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                      {row.customer}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#166534', textAlign: 'right' }}>
                      {row.amount}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-main)' }}>
                      {row.promocode}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#0284c7', textAlign: 'right' }}>
                      {row.cashback_amount}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                        {row.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {row.remark}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#334155', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                        {row.mode}
                      </span>
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
                    <td style={{ padding: '14px', fontSize: 14, color: '#166534', fontWeight: 800, textAlign: 'right' }}>
                      {totalsRow.amount}
                    </td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px', fontSize: 14, color: '#0284c7', fontWeight: 800, textAlign: 'right' }}>
                      {totalsRow.cashback_amount}
                    </td>
                    <td style={{ padding: '14px' }}></td>
                    <td style={{ padding: '14px' }}></td>
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
