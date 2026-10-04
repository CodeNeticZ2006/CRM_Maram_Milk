import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MdBarChart, MdSearch, MdRefresh, MdFileDownload, MdPictureAsPdf,
  MdFilterList, MdInfoOutline, MdLocalShipping, MdHistory,
  MdAssignment, MdCheckCircle, MdCalendarToday, MdPerson, MdMap
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useOperationalDay from '../../hooks/useOperationalDay';
import { exportToExcel, exportToExcelDeliveryBoyWise, exportToPDF } from '../../utils/exportUtils';

export default function GeneralReportsPage() {
  const location = useLocation();
  const { operationalDate } = useOperationalDay();

  // Determine initial report type from URL route if accessed directly via sub-path
  const getInitialReportType = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('daily-planner')) return 'Daily Planner / Delivery Report';
    if (path.includes('customer-statement')) return 'Customer Statement';
    return 'Audit Trail';
  };

  const [reportType, setReportType] = useState(getInitialReportType);

  // Filter dropdown options loaded from backend
  const [filterOptions, setFilterOptions] = useState({ customers: [], deliveryBoys: [], routes: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Filter states
  const [customerId, setCustomerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const [deliveryBoy, setDeliveryBoy] = useState('');
  const [area, setArea] = useState('');

  // Report result states
  const [reportResult, setReportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Export loading states
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingExcelDbWise, setExportingExcelDbWise] = useState(false);

  // Sync initial date from operationalDate when available
  useEffect(() => {
    if (operationalDate) {
      setSingleDate(prev => prev || operationalDate);
      setDateTo(prev => prev || operationalDate);
      const d = new Date(operationalDate);
      d.setDate(1);
      const firstOfMonth = d.toISOString().split('T')[0];
      setDateFrom(prev => prev || firstOfMonth);
    }
  }, [operationalDate]);

  // Sync route path changes if user clicks sidebar sub-links
  useEffect(() => {
    const initialType = getInitialReportType();
    if (initialType) {
      setReportType(initialType);
    }
  }, [location.pathname]);

  // Load filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      setOptionsLoading(true);
      try {
        const res = await api.get('/reports/filter-options');
        if (res.data?.success) {
          setFilterOptions(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load report filter options:', err);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  // Reset Button Handler
  const handleReset = () => {
    setCustomerId('');
    setDeliveryBoy('');
    setArea('');
    setReportResult(null);
    setSearched(false);

    if (operationalDate) {
      setSingleDate(operationalDate);
      setDateTo(operationalDate);
      const d = new Date(operationalDate);
      d.setDate(1);
      setDateFrom(d.toISOString().split('T')[0]);
    } else {
      setSingleDate('');
      setDateFrom('');
      setDateTo('');
    }
    toast.success('Filters and report results reset.');
  };

  // View / Search Button Handler
  const handleFetchReport = async () => {
    if (!reportType) {
      toast.error('Please select a Report Type.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setReportResult(null);

    try {
      if (reportType === 'Audit Trail') {
        const params = {
          customer_id: customerId,
          date_from: dateFrom,
          date_to: dateTo,
        };
        const res = await api.get('/reports/audit-trail', { params });
        if (res.data?.success) {
          setReportResult(res.data);
        }
      } else if (reportType === 'Daily Planner / Delivery Report') {
        const params = {
          date: singleDate || operationalDate,
          dp_ref_id: deliveryBoy,
          area: area,
        };
        const res = await api.get('/reports/daily-planner', { params });
        if (res.data?.success) {
          setReportResult(res.data);
        }
      } else if (reportType === 'Customer Statement') {
        if (!customerId) {
          toast.error('Please select a Customer for Customer Statement.');
          setLoading(false);
          return;
        }
        const params = {
          customer_id: customerId,
          date_from: dateFrom,
          date_to: dateTo,
        };
        const res = await api.get('/reports/customer-statement', { params });
        if (res.data?.success) {
          setReportResult(res.data);
        }
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  };

  // Export report data to Excel (.xlsx)
  const handleExportExcel = async () => {
    if (!reportResult || !reportResult.data || reportResult.data.length === 0) {
      toast.error('No data available to export.');
      return;
    }

    setExportingExcel(true);
    toast.loading('Generating Excel...', { id: 'excel-toast' });

    try {
      const rows = reportResult.data;
      let fileName = '';
      let filterInfo = '';
      let headers = [];
      let mappedRows = [];

      if (reportType === 'Audit Trail') {
        fileName = `audit_trail_${dateFrom || 'all'}_to_${dateTo || 'all'}`;
        filterInfo = `Customer: ${customerId ? 'Selected Customer' : 'All Customers'} | Date From: ${dateFrom || 'N/A'} | Date To: ${dateTo || 'N/A'}`;
        headers = ['Sr. No.', 'Date', 'User', 'Action Taken On', 'Narration'];
        mappedRows = rows.map(r => [
          r.sr_no,
          r.date,
          r.user,
          r.action_taken_on,
          r.narration || '',
        ]);
      } else if (reportType === 'Daily Planner / Delivery Report') {
        const targetDate = singleDate || operationalDate || new Date().toISOString().split('T')[0];
        fileName = `Daily_Planner_${targetDate}`;
        const dpObj = filterOptions.deliveryBoys.find(d => String(d.id) === String(deliveryBoy));
        filterInfo = `Date: ${targetDate} | Delivery Boy: ${dpObj ? dpObj.label : 'All'} | Area: ${area || 'All'} | City: Chennai | Hub: Royapettah`;
        headers = ['Customer Code', 'Customer Name', 'Address', 'Mobile', 'Hub', 'Delivery Boy', 'Mode', 'Product', 'Product Qty', 'Type', 'Delivery Type'];
        mappedRows = rows.map(r => [
          r.customer_code,
          r.customer_name,
          r.address,
          r.mobile,
          r.hub,
          r.delivery_boy,
          r.mode,
          r.product,
          r.product_qty,
          r.type,
          r.delivery_type,
        ]);
      } else if (reportType === 'Customer Statement') {
        fileName = `customer_statement_${customerId}_${dateFrom || 'start'}_to_${dateTo || 'end'}`;
        filterInfo = `Customer ID: ${customerId} | Date From: ${dateFrom || 'N/A'} | Date To: ${dateTo || 'N/A'}`;
        headers = ['Sr. No.', 'Date', 'Narration', 'Subscribed', 'Pause', 'Adhoc', 'Total Delivered', 'Empty Bottle Collected', 'Amount'];
        mappedRows = rows.map(r => [
          r.sr_no,
          r.date,
          r.narration || '',
          r.subscribed,
          r.pause,
          r.adhoc,
          r.total_delivered,
          r.empty_bottle_collected,
          r.amount,
        ]);
      }

      exportToExcel({
        fileName,
        reportTitle: reportType,
        filterInfo,
        headers,
        rows: mappedRows,
      });

      toast.success('Generated Excel file successfully!', { id: 'excel-toast' });
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('Failed to generate Excel export.', { id: 'excel-toast' });
    } finally {
      setExportingExcel(false);
    }
  };

  // Export Daily Planner Delivery Boy Wise to Excel (.xlsx)
  const handleExportExcelDeliveryBoyWise = async () => {
    if (!reportResult || !reportResult.data || reportResult.data.length === 0) {
      toast.error('No data available to export.');
      return;
    }

    setExportingExcelDbWise(true);
    toast.loading('Generating Delivery Boy Wise Excel...', { id: 'excel-db-toast' });

    try {
      const rows = reportResult.data;
      const targetDate = singleDate || operationalDate || new Date().toISOString().split('T')[0];
      const dpObj = filterOptions.deliveryBoys.find(d => String(d.id) === String(deliveryBoy));
      const filterInfo = `Date: ${targetDate} | Delivery Boy Filter: ${dpObj ? dpObj.label : 'All'} | Area: ${area || 'All'} | City: Chennai | Hub: Royapettah`;

      exportToExcelDeliveryBoyWise({
        fileName: `Daily_Planner_Delivery_Boy_Wise_${targetDate}`,
        reportTitle: 'DAILY PLANNER - DELIVERY BOY WISE',
        filterInfo,
        rows,
      });

      toast.success('Generated Delivery Boy Wise Excel file successfully!', { id: 'excel-db-toast' });
    } catch (err) {
      console.error('Export Delivery Boy Wise Excel error:', err);
      toast.error('Failed to generate Delivery Boy Wise Excel export.', { id: 'excel-db-toast' });
    } finally {
      setExportingExcelDbWise(false);
    }
  };

  // Export report data to PDF
  const handleExportPDF = async () => {
    if (!reportResult || !reportResult.data || reportResult.data.length === 0) {
      toast.error('No data available to export.');
      return;
    }

    setExportingPdf(true);
    toast.loading('Generating PDF...', { id: 'pdf-toast' });

    try {
      const rows = reportResult.data;
      let filterInfo = '';
      let headers = [];
      let mappedRows = [];
      let summaryHtml = '';

      if (reportType === 'Audit Trail') {
        filterInfo = `Customer: ${customerId ? 'Selected Customer' : 'All Customers'} | Date From: ${dateFrom || 'N/A'} | Date To: ${dateTo || 'N/A'}`;
        headers = ['Sr. No.', 'Date', 'User', 'Action Taken On', 'Narration'];
        mappedRows = rows.map(r => [
          r.sr_no,
          r.date,
          r.user,
          r.action_taken_on,
          r.narration || '',
        ]);
      } else if (reportType === 'Daily Planner / Delivery Report') {
        const targetDate = singleDate || operationalDate || new Date().toISOString().split('T')[0];
        const dpObj = filterOptions.deliveryBoys.find(d => String(d.id) === String(deliveryBoy));
        filterInfo = `Date: ${targetDate} | Delivery Boy: ${dpObj ? dpObj.label : 'All'} | Area: ${area || 'All'} | City: Chennai | Hub: Royapettah`;
        headers = ['Customer Code', 'Customer Name', 'Address', 'Mobile', 'Hub', 'Delivery Boy', 'Mode', 'Product', 'Product Qty', 'Type', 'Delivery Type'];
        mappedRows = rows.map(r => [
          r.customer_code,
          r.customer_name,
          r.address,
          r.mobile,
          r.hub,
          r.delivery_boy,
          r.mode,
          r.product,
          r.product_qty,
          r.type,
          r.delivery_type,
        ]);

        if (reportResult.summary) {
          const sum = reportResult.summary;
          summaryHtml = `
            <strong>Product Delivery Summary:</strong> Total Customers: ${sum.totalCustomers || 0} | 
            Total 1L Bottle: ${sum.total1LBottle || 0} | Total 500ml Bottle: ${sum.totalHalfLBottle || 0} | 
            Total 500ml Packet: ${sum.totalHalfLPacket || 0} | Total Units: ${sum.totalUnits || 0}
          `;
        }
      } else if (reportType === 'Customer Statement') {
        filterInfo = `Customer ID: ${customerId} | Date From: ${dateFrom || 'N/A'} | Date To: ${dateTo || 'N/A'}`;
        headers = ['Sr. No.', 'Date', 'Narration', 'Subscribed', 'Pause', 'Adhoc', 'Total Delivered', 'Empty Bottle Collected', 'Amount'];
        mappedRows = rows.map(r => [
          r.sr_no,
          r.date,
          r.narration || '',
          r.subscribed,
          r.pause,
          r.adhoc,
          r.total_delivered,
          r.empty_bottle_collected,
          r.amount,
        ]);
      }

      exportToPDF({
        reportTitle: reportType,
        filterInfo,
        headers,
        rows: mappedRows,
        totalRecords: reportResult.totalRecords || rows.length,
        summaryHtml,
      });

      toast.success('Generated PDF report preview!', { id: 'pdf-toast' });
    } catch (err) {
      console.error('Export PDF error:', err);
      toast.error('Failed to generate PDF export.', { id: 'pdf-toast' });
    } finally {
      setExportingPdf(false);
    }
  };

  // Helper for dynamic header title and description based on selected Report Type
  const getHeaderInfo = () => {
    if (reportType === 'Audit Trail') {
      return {
        title: 'AUDIT TRAIL',
        description: 'View customer wallet and financial activity.',
      };
    }
    if (reportType === 'Daily Planner / Delivery Report') {
      return {
        title: 'DAILY PLANNER / DELIVERY REPORT',
        description: 'View daily delivery quantities, customers, products, routes, and delivery assignments.',
      };
    }
    if (reportType === 'Customer Statement') {
      return {
        title: 'CUSTOMER STATEMENT',
        description: 'View customer subscription, pause, AdHoc, delivery, empty bottle, and amount history.',
      };
    }
    return {
      title: 'GENERAL REPORTS',
      description: 'Centralized reporting interface for Audit Trail, Daily Planner / Delivery, and Customer Statements.',
    };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: 6 }}>
            REPORTS &rsaquo; GENERAL
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #1e293b)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <MdBarChart style={{ color: 'var(--primary, #3b82f6)', fontSize: 28 }} />
            {headerInfo.title}
          </h1>
          <p style={{ color: 'var(--text-muted, #64748b)', fontSize: 14, marginTop: 4 }}>
            {headerInfo.description}
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════
           REPORT SELECTION & DYNAMIC FILTERS CARD
           ════════════════════════════════════════════════════════ */}
        <div
          style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '28px',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))'
          }}
        >
          {/* DYNAMIC FILTERS: AUDIT TRAIL */}
          {reportType === 'Audit Trail' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Customer
                </label>
                <select
                  className="form-select"
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                >
                  <option value="">[ All Customers ]</option>
                  {filterOptions.customers.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Date From
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Date To
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* DYNAMIC FILTERS: DAILY PLANNER / DELIVERY REPORT */}
          {reportType === 'Daily Planner / Delivery Report' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Date
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Delivery Boy
                </label>
                <select
                  className="form-select"
                  value={deliveryBoy}
                  onChange={e => setDeliveryBoy(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                >
                  <option value="">[ Select Delivery Boy ▼ ]</option>
                  {filterOptions.deliveryBoys.map(d => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Area / Route
                </label>
                <select
                  className="form-select"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                >
                  <option value="">[ Select Area ▼ ]</option>
                  {filterOptions.routes.map(r => (
                    <option key={r.id} value={r.route_name}>{r.route_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  City
                </label>
                <input
                  type="text"
                  className="form-input"
                  value="Chennai"
                  readOnly
                  disabled
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Hub
                </label>
                <input
                  type="text"
                  className="form-input"
                  value="Royapettah"
                  readOnly
                  disabled
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}
                />
              </div>
            </div>
          )}

          {/* DYNAMIC FILTERS: CUSTOMER STATEMENT */}
          {reportType === 'Customer Statement' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Customer <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                >
                  <option value="">[ Select Customer ▼ ]</option>
                  {filterOptions.customers.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Date From
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6 }}>
                  Date To
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border, #cbd5e1)', fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', gap: '10px', marginTop: 20, flexWrap: 'wrap', width: '100%', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleFetchReport}
              disabled={loading || !reportType}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                opacity: (!reportType || loading) ? 0.6 : 1
              }}
            >
              {loading ? <span className="spinner-border spinner-border-sm" /> : <MdSearch style={{ fontSize: 18 }} />}
              {reportType === 'Daily Planner / Delivery Report' ? 'Search' : 'View'}
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleReset}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <MdRefresh style={{ fontSize: 18 }} />
              Reset
            </button>

            {reportType === 'Daily Planner / Delivery Report' ? (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-success"
                  onClick={handleExportExcel}
                  disabled={!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    opacity: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise) ? 0.5 : 1,
                    cursor: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 18 }} />
                  {exportingExcel ? 'Generating Excel...' : '↓ Export to Excel'}
                </button>

                <button
                  className="btn btn-success"
                  onClick={handleExportExcelDeliveryBoyWise}
                  disabled={!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    opacity: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise) ? 0.5 : 1,
                    cursor: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 18 }} />
                  {exportingExcelDbWise ? 'Generating Delivery Boy Wise Excel...' : '↓ Export to Excel Delivery Boy Wise'}
                </button>

                <button
                  className="btn btn-danger"
                  onClick={handleExportPDF}
                  disabled={!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    opacity: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise) ? 0.5 : 1,
                    cursor: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel || exportingExcelDbWise) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdPictureAsPdf style={{ fontSize: 18 }} />
                  {exportingPdf ? 'Generating PDF...' : '↓ Export to PDF'}
                </button>
              </div>
            ) : (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger"
                  onClick={handleExportPDF}
                  disabled={!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    opacity: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel) ? 0.5 : 1,
                    cursor: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdPictureAsPdf style={{ fontSize: 18 }} />
                  {exportingPdf ? 'Generating PDF...' : 'Export to PDF'}
                </button>

                <button
                  className="btn btn-success"
                  onClick={handleExportExcel}
                  disabled={!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    opacity: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel) ? 0.5 : 1,
                    cursor: (!reportResult || !reportResult.data || reportResult.data.length === 0 || exportingPdf || exportingExcel) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 18 }} />
                  {exportingExcel ? 'Generating Excel...' : '↓ Export to Excel'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
           REPORT RESULTS SECTION
           ════════════════════════════════════════════════════════ */}

        {/* Loading Spinner */}
        {loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
            <div className="spinner-border text-primary" style={{ width: 40, height: 40, marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>Generating {reportType}...</p>
          </div>
        )}

        {/* Placeholder before search */}
        {!loading && !searched && !reportResult && (
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1px dashed var(--border, #cbd5e1)',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              color: 'var(--text-muted, #64748b)'
            }}
          >
            <MdFilterList style={{ fontSize: 48, color: 'var(--primary, #3b82f6)', marginBottom: 12, opacity: 0.8 }} />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: 0 }}>
              Set filters to generate report
            </h3>
            <p style={{ fontSize: 14, marginTop: 6, maxWidth: 460, margin: '6px auto 0' }}>
              Set your desired parameters above and click <strong>{reportType === 'Daily Planner / Delivery Report' ? 'Search' : 'View'}</strong> to view report details.
            </p>
          </div>
        )}

        {/* No Records Empty State */}
        {!loading && searched && reportResult && reportResult.data && reportResult.data.length === 0 && (
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--text-muted, #64748b)'
            }}
          >
            <MdInfoOutline style={{ fontSize: 40, color: '#f59e0b', marginBottom: 10 }} />
            <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: 0 }}>
              No records found
            </h4>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {reportResult.message || 'No data matches the selected filter parameters.'}
            </p>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
           1. AUDIT TRAIL RESULTS TABLE
           ──────────────────────────────────────────────────────── */}
        {!loading && reportResult && reportType === 'Audit Trail' && reportResult.data && reportResult.data.length > 0 && (
          <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdHistory style={{ color: '#3b82f6' }} /> Audit Trail Results
              </h3>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                Total Records: {reportResult.totalRecords}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--border, #cbd5e1)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', width: '70px' }}>Sr. No.</th>
                    <th style={{ padding: '12px 16px', width: '160px' }}>Date</th>
                    <th style={{ padding: '12px 16px', width: '140px' }}>User</th>
                    <th style={{ padding: '12px 16px', width: '220px' }}>Action Taken On</th>
                    <th style={{ padding: '12px 16px' }}>Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {reportResult.data.map((row) => (
                    <tr key={row.id || row.sr_no} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>{row.sr_no}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{row.date}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: 12 }}>
                          {row.user}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.action_taken_on}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {row.narration}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
           2. DAILY PLANNER / DELIVERY REPORT RESULTS
           ──────────────────────────────────────────────────────── */}
        {!loading && reportResult && reportType === 'Daily Planner / Delivery Report' && reportResult.data && reportResult.data.length > 0 && (
          <div>
            {/* SUMMARY CARD */}
            {reportResult.summary && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#94a3b8', fontWeight: 600, marginBottom: 12 }}>
                  Summary Product Totals &mdash; {reportResult.date}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                  {Object.entries(reportResult.summary.productTotals || {}).map(([prodName, qty]) => (
                    <div
                      key={prodName}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>{prodName}:</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>{qty}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 24, pt: 12, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 15, fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#94a3b8' }}>Total Bottle:</span>
                    <span style={{ color: '#4ade80', fontSize: 18 }}>{reportResult.summary.totalBottle}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#94a3b8' }}>Total Pouch:</span>
                    <span style={{ color: '#facc15', fontSize: 18 }}>{reportResult.summary.totalPouch}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TABLE */}
            <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdLocalShipping style={{ color: '#10b981' }} /> Daily Planner Deliveries ({reportResult.totalRecords})
                </h3>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--border, #cbd5e1)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px' }}>Customer Code</th>
                      <th style={{ padding: '12px 14px' }}>Customer Name</th>
                      <th style={{ padding: '12px 14px' }}>Address</th>
                      <th style={{ padding: '12px 14px' }}>Mobile</th>
                      <th style={{ padding: '12px 14px' }}>Hub</th>
                      <th style={{ padding: '12px 14px' }}>Delivery Boy</th>
                      <th style={{ padding: '12px 14px' }}>Mode</th>
                      <th style={{ padding: '12px 14px' }}>Product</th>
                      <th style={{ padding: '12px 14px' }}>Product Qty</th>
                      <th style={{ padding: '12px 14px' }}>Type</th>
                      <th style={{ padding: '12px 14px' }}>Delivery Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportResult.data.map((row, idx) => (
                      <tr key={row.id || idx} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--primary)' }}>{row.customer_code}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{row.customer_name}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.address}</td>
                        <td style={{ padding: '12px 14px' }}>{row.mobile}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{row.hub}</td>
                        <td style={{ padding: '12px 14px' }}>{row.delivery_boy}</td>
                        <td style={{ padding: '12px 14px' }}>{row.mode}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>{row.product}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#2563eb' }}>{row.product_qty}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: 12,
                            fontWeight: 600,
                            background: row.type === 'Subscription' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                            color: row.type === 'Subscription' ? '#059669' : '#b45309'
                          }}>
                            {row.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{row.delivery_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────
           3. CUSTOMER STATEMENT RESULTS TABLE
           ──────────────────────────────────────────────────────── */}
        {!loading && reportResult && reportType === 'Customer Statement' && reportResult.data && reportResult.data.length > 0 && (
          <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {reportResult.customer && (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdAssignment style={{ color: '#8b5cf6' }} /> Customer Statement: {reportResult.customer.name} ({reportResult.customer.code})
                  </h3>
                  <span style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginTop: 2, display: 'block' }}>
                    Period: {reportResult.date_from} to {reportResult.date_to} | Phone: {reportResult.customer.phone || 'N/A'}
                  </span>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--border, #cbd5e1)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px', width: '70px' }}>Sr. No.</th>
                    <th style={{ padding: '12px 14px', width: '130px' }}>Date</th>
                    <th style={{ padding: '12px 14px' }}>Narration</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Subscribed</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Pause</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Adhoc</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Total Delivered</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Empty Bottle Collected</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reportResult.data.map((row) => (
                    <tr key={row.sr_no} style={{ borderBottom: '1px solid var(--border, #e2e8f0)', background: row.pause === 'Yes' ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{row.sr_no}</td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontWeight: 600 }}>{row.date}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 500, color: row.pause === 'Yes' ? '#ef4444' : 'var(--text-primary)' }}>{row.narration}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: row.subscribed !== '-' ? 700 : 400 }}>{row.subscribed}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {row.pause === 'Yes' ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 700, fontSize: 12 }}>
                            Yes
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: row.adhoc > 0 ? 700 : 400, color: row.adhoc > 0 ? '#d97706' : 'inherit' }}>{row.adhoc}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: row.total_delivered > 0 ? '#10b981' : 'inherit' }}>{row.total_delivered}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{row.empty_bottle_collected}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
