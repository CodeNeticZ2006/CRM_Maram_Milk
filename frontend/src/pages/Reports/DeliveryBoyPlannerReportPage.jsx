import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MdDirectionsBike, MdCalendarToday, MdSearch, MdRefresh,
  MdFileDownload, MdPictureAsPdf, MdAssignment
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useOperationalDay from '../../hooks/useOperationalDay';
import { exportDeliveryBoyPlannerExcel, exportDeliveryBoyPlannerPDF } from '../../utils/exportUtils';

export default function DeliveryBoyPlannerReportPage() {
  const { operationalDate } = useOperationalDay();

  // Filter options
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Filter states
  const [selectedDpId, setSelectedDpId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Report state
  const [reportResult, setReportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Initialize date range to current month on mount or operationalDate update
  useEffect(() => {
    const baseDate = operationalDate ? new Date(operationalDate) : new Date();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    
    // First day of month: YYYY-MM-01
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    // Last day of month
    const lastDayNum = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    setDateFrom(prev => prev || firstDay);
    setDateTo(prev => prev || lastDay);
  }, [operationalDate]);

  // Load delivery boy filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      setOptionsLoading(true);
      try {
        const res = await api.get('/reports/filter-options');
        if (res.data?.success && res.data.data?.deliveryBoys) {
          setDeliveryBoys(res.data.data.deliveryBoys);
        }
      } catch (err) {
        console.error('Failed to load delivery boy filter options:', err);
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

    const baseDate = operationalDate ? new Date(operationalDate) : new Date();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDayNum = new Date(year, month + 1, 0).getDate();
    const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    setDateFrom(firstDay);
    setDateTo(lastDay);
    toast.success('Filters reset.');
  };

  // Search button handler
  const handleSearch = async (e) => {
    if (e) e.preventDefault();

    if (!selectedDpId) {
      toast.error('Please select a Delivery Boy.');
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.error('Both Start Date and End Date are required.');
      return;
    }
    if (dateFrom > dateTo) {
      toast.error('Start Date cannot be after End Date.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setReportResult(null);

    try {
      const res = await api.get('/reports/delivery-boy-planner', {
        params: {
          dp_ref_id: selectedDpId,
          date_from: dateFrom,
          date_to: dateTo,
        }
      });

      if (res.data?.success) {
        setReportResult(res.data);
      } else {
        toast.error(res.data?.message || 'Failed to generate report.');
      }
    } catch (err) {
      console.error('Error fetching Delivery Boy planner report:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!reportResult || !reportResult.dayRecords || reportResult.dayRecords.length === 0) {
      toast.error('No report data available to export.');
      return;
    }
    exportDeliveryBoyPlannerExcel({
      dpName: reportResult.deliveryBoy?.name || selectedDpId,
      dateFrom: reportResult.period?.dateFrom || dateFrom,
      dateTo: reportResult.period?.dateTo || dateTo,
      formattedPeriod: reportResult.period?.formatted || `${dateFrom} to ${dateTo}`,
      dayRecords: reportResult.dayRecords,
      periodTotals: reportResult.periodTotals,
    });
    toast.success('Exported to Excel successfully!');
  };

  const handleExportPDF = () => {
    if (!reportResult || !reportResult.dayRecords || reportResult.dayRecords.length === 0) {
      toast.error('No report data available to export.');
      return;
    }
    exportDeliveryBoyPlannerPDF({
      dpName: reportResult.deliveryBoy?.name || selectedDpId,
      dateFrom: reportResult.period?.dateFrom || dateFrom,
      dateTo: reportResult.period?.dateTo || dateTo,
      formattedPeriod: reportResult.period?.formatted || `${dateFrom} to ${dateTo}`,
      dayRecords: reportResult.dayRecords,
      periodTotals: reportResult.periodTotals,
    });
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
            <MdDirectionsBike style={{ color: '#2563eb' }} /> DELIVERY BOY-WISE MONTHLY PLANNER
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Date-range and month-level daily planning report for an individual Delivery Boy
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ padding: 24, marginBottom: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, alignItems: 'end' }}>
            {/* Start Date */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                Start Date *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  className="form-input"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                End Date *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  className="form-input"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            {/* Delivery Boy Selection */}
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

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  padding: '9px 24px',
                  borderRadius: 8,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <MdSearch style={{ fontSize: 18 }} /> {loading ? 'Searching...' : 'Search'}
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
          {reportResult.dayRecords && reportResult.dayRecords.length > 0 ? (
            <div className="card" style={{ padding: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              {/* Header Info & Export Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
                    Delivery Boy: <span style={{ color: '#2563eb' }}>{reportResult.deliveryBoy?.name}</span>
                  </h2>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4 }}>
                    Period: <strong>{reportResult.period?.formatted}</strong>
                  </div>
                </div>

                {/* Export Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleExportExcel}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      border: '1px solid #10b981',
                      color: '#10b981',
                      background: '#ecfdf5',
                      cursor: 'pointer'
                    }}
                  >
                    <MdFileDownload style={{ fontSize: 16 }} /> Export to Excel
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleExportPDF}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      background: '#fef2f2',
                      cursor: 'pointer'
                    }}
                  >
                    <MdPictureAsPdf style={{ fontSize: 16 }} /> Export to PDF
                  </button>
                </div>
              </div>

              {/* Date-Wise Breakdown Table */}
              <div style={{ overflowX: 'auto', marginBottom: 32 }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', fontSize: 12, borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 12px' }}>Date</th>
                      <th style={{ padding: '10px 12px' }}>Day</th>
                      <th style={{ padding: '10px 12px' }}>Route / Area</th>
                      <th style={{ padding: '10px 12px' }}>Product Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Packing</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Milk Delivered</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Extra Order</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Milk Liter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportResult.dayRecords.map((day) => {
                      if (!day.productRows || day.productRows.length === 0) return null;

                      return day.productRows.map((p, pIdx) => (
                        <tr
                          key={`${day.date}-${p.product_name}-${pIdx}`}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            fontSize: 13,
                            borderTop: pIdx === 0 ? '1.5px solid var(--border-color)' : 'none',
                            background: pIdx === 0 ? 'rgba(0,0,0,0.01)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                            {pIdx === 0 ? day.formattedDate : ''}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {pIdx === 0 ? day.dayName : ''}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {pIdx === 0 ? day.routes : ''}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            {p.product_name}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {p.packing_type || '-'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>
                            {p.total_qty}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#166534', fontWeight: 600 }}>
                            {pIdx === 0 ? `${day.dayTotals.milkDeliveredLiters} L` : ''}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#991b1b', fontWeight: 600 }}>
                            {pIdx === 0 ? `${day.dayTotals.extraOrderLiters} L` : ''}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#064e3b' }}>
                            {pIdx === 0 ? `${day.dayTotals.totalMilkLiters} L` : ''}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>

              {/* Period Totals Summary Block */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: 'var(--text-main)' }}>
                  PERIOD TOTALS SUMMARY ({reportResult.period?.formatted})
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                  <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Milk Liter</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', marginTop: 4 }}>{reportResult.periodTotals?.totalMilkLiters} L</div>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Milk Delivered</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#166534', marginTop: 4 }}>{reportResult.periodTotals?.totalMilkDeliveredLiters} L</div>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Extra Order Liter</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#991b1b', marginTop: 4 }}>{reportResult.periodTotals?.totalExtraOrderLiters} L</div>
                  </div>
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)' }}>
                  Product-Wise Total Quantities
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-primary)', borderRadius: 8 }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.03)', textAlign: 'left', fontSize: 12 }}>
                        <th style={{ padding: '8px 12px' }}>Product Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Packing</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Total Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportResult.periodTotals?.productTotals || []).map((pt, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid var(--border-color)', fontSize: 13 }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{pt.product_name}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{pt.packing_type || '-'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{pt.total_qty} {pt.unit || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
              <MdAssignment style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>No Delivery Records Found</h3>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                No delivery records found for the selected Delivery Boy and date range.
              </p>
            </div>
          )}
        </>
      )}

      {!searched && (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
          <MdCalendarToday style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>Select Filters to Generate Report</h3>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            Select a Delivery Boy and date range above, then click <strong>Search</strong> to view the full period report and access PDF & Excel export options.
          </p>
        </div>
      )}
    </motion.div>
  );
}
