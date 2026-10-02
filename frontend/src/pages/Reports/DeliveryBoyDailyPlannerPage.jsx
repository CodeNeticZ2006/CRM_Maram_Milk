import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MdDirectionsBike, MdCalendarToday, MdSearch, MdRefresh,
  MdFileDownload, MdAssignment
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useOperationalDay from '../../hooks/useOperationalDay';
import { exportDeliveryBoyDailySummaryExcel } from '../../utils/exportUtils';

export default function DeliveryBoyDailyPlannerPage() {
  const { operationalDate } = useOperationalDay();

  // Filter options
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Filter states
  const [singleDate, setSingleDate] = useState('');
  const [selectedDpId, setSelectedDpId] = useState('');

  // Report state
  const [reportResult, setReportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Sync initial date from operationalDate
  useEffect(() => {
    if (operationalDate) {
      setSingleDate(prev => prev || operationalDate);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setSingleDate(prev => prev || today);
    }
  }, [operationalDate]);

  // Load delivery boy options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      setOptionsLoading(true);
      try {
        const res = await api.get('/reports/filter-options');
        if (res.data?.success && res.data.data?.deliveryBoys) {
          setDeliveryBoys(res.data.data.deliveryBoys);
        }
      } catch (err) {
        console.error('Failed to load delivery boy options:', err);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  // Reset button handler
  const handleReset = () => {
    setSelectedDpId('');
    setReportResult(null);
    setSearched(false);

    if (operationalDate) {
      setSingleDate(operationalDate);
    } else {
      setSingleDate(new Date().toISOString().split('T')[0]);
    }
    toast.success('Filters reset.');
  };

  // View button handler
  const handleView = async (e) => {
    if (e) e.preventDefault();

    if (!singleDate) {
      toast.error('Please select a Date.');
      return;
    }
    if (!selectedDpId) {
      toast.error('Please select a Delivery Boy.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setReportResult(null);

    try {
      const res = await api.get('/reports/delivery-boy-daily-summary', {
        params: {
          date: singleDate,
          dp_ref_id: selectedDpId,
        }
      });

      if (res.data?.success) {
        setReportResult(res.data);
      } else {
        toast.error(res.data?.message || 'Failed to generate report.');
      }
    } catch (err) {
      console.error('Error fetching Delivery Boy daily summary:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  };

  // Export handler
  const handleExportExcel = () => {
    if (!reportResult || !reportResult.row || reportResult.totalResults === 0) {
      toast.error('No data available to export.');
      return;
    }
    exportDeliveryBoyDailySummaryExcel({
      dpName: reportResult.deliveryBoy?.name || selectedDpId,
      date: reportResult.date || singleDate,
      formattedDate: reportResult.formattedDate,
      productColumns: reportResult.productColumns || [],
      row: reportResult.row,
    });
    toast.success('Exported to Excel successfully!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="page-container"
      style={{ padding: 24 }}
    >
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800 }}>
            <MdDirectionsBike style={{ color: '#059669' }} /> Delivery Boy-Wise Daily Planner Report
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Single-date product-wise delivery summary for an individual Delivery Boy
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: 24, marginBottom: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleView}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, alignItems: 'end' }}>
            {/* Single Date */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                Date *
              </label>
              <input
                type="date"
                className="form-input"
                value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              />
            </div>

            {/* Delivery Boy Dropdown */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                Delivery Boy *
              </label>
              <select
                className="form-select"
                value={selectedDpId}
                onChange={e => setSelectedDpId(e.target.value)}
                disabled={optionsLoading}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              >
                <option value="">[ Select Delivery Boy ▼ ]</option>
                {deliveryBoys.map(dp => (
                  <option key={dp.id} value={dp.id}>
                    {dp.label || dp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  padding: '9px 24px',
                  borderRadius: 8,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <MdSearch style={{ fontSize: 18 }} /> {loading ? 'Loading...' : '🔍 View'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={loading}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  fontWeight: 600,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <MdRefresh style={{ fontSize: 18 }} /> Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Report Results */}
      {searched && reportResult && (
        <>
          {reportResult.totalResults > 0 && reportResult.row ? (
            <div className="card" style={{ padding: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              {/* Result Count & Export Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                    Total {reportResult.totalResults} result.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Delivery Boy: <strong>{reportResult.deliveryBoy?.name}</strong> | Date: <strong>{reportResult.formattedDate || reportResult.date}</strong>
                  </div>
                </div>

                {/* Export Button */}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportExcel}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    border: '1px solid #10b981',
                    color: '#10b981',
                    background: '#ecfdf5',
                    cursor: 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 18 }} /> ↓ Export to Excel
                </button>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', fontSize: 12, borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 14px' }}>Delivery Boy</th>
                      {(reportResult.productColumns || []).map(col => (
                        <th key={col} style={{ padding: '12px 14px', textAlign: 'center' }}>{col}</th>
                      ))}
                      <th style={{ padding: '12px 14px', textAlign: 'center', background: 'rgba(5, 150, 105, 0.05)' }}>Total Milk Liter</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Milk Delivered</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Extra Order Liter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Summary Row */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#059669' }}>
                        {reportResult.row.delivery_boy}
                      </td>
                      {(reportResult.productColumns || []).map(col => (
                        <td key={col} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>
                          {reportResult.row.productQuantities[col] || 0}
                        </td>
                      ))}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#059669', background: 'rgba(5, 150, 105, 0.05)' }}>
                        {reportResult.row.total_milk_liter}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#166534' }}>
                        {reportResult.row.milk_delivered}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#991b1b' }}>
                        {reportResult.row.extra_order_liter}
                      </td>
                    </tr>

                    {/* Total Row */}
                    <tr style={{ background: 'var(--bg-secondary)', fontWeight: 800, fontSize: 13, borderTop: '2px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--text-main)' }}>
                        Total
                      </td>
                      {(reportResult.productColumns || []).map(col => (
                        <td key={col} style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {reportResult.totalsRow.productQuantities[col] || 0}
                        </td>
                      ))}
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#059669', background: 'rgba(5, 150, 105, 0.08)' }}>
                        {reportResult.totalsRow.total_milk_liter}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#166534' }}>
                        {reportResult.totalsRow.milk_delivered}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#991b1b' }}>
                        {reportResult.totalsRow.extra_order_liter}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
              <MdAssignment style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>No Records Found</h3>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                No records found for the selected date and Delivery Boy.
              </p>
            </div>
          )}
        </>
      )}

      {!searched && (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
          <MdCalendarToday style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>Select Date & Delivery Boy</h3>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            Select a Date and Delivery Boy above, then click <strong>🔍 View</strong> to generate the summary report and access Excel export options.
          </p>
        </div>
      )}
    </motion.div>
  );
}
