import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MdLocalShipping, MdChevronLeft, MdChevronRight, MdFileDownload,
  MdPictureAsPdf, MdPerson, MdSearch, MdRefresh, MdCalendarToday
} from 'react-icons/md';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useOperationalDay from '../../hooks/useOperationalDay';
import { exportDeliveryPlannerExcel, exportDeliveryPlannerPDF } from '../../utils/exportUtils';

export default function DeliveryPlannerPage() {
  const { operationalDate } = useOperationalDay();

  // Filter options: customer list
  const [customers, setCustomers] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Selected customer & active month
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [submittedCustomerId, setSubmittedCustomerId] = useState('');
  
  // Current month date object (defaults to operationalDate or current date)
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    if (operationalDate) return new Date(operationalDate);
    return new Date();
  });

  // Calendar data from backend
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load customer options on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      setOptionsLoading(true);
      try {
        const res = await api.get('/reports/filter-options');
        if (res.data?.success && res.data.data?.customers) {
          setCustomers(res.data.data.customers);
        } else {
          // Fallback to customers API if needed
          const custRes = await api.get('/customers?limit=500');
          if (custRes.data?.data) {
            setCustomers(custRes.data.data.map(c => ({
              id: c.id,
              code: c.customer_code || `CUST-${c.id}`,
              name: c.name,
              label: `${c.name} (${c.customer_code || `CUST-${c.id}`})`
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load customer list:', err);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch Delivery Planner calendar data when submitted customer or currentMonthDate changes
  const fetchDeliveryPlanner = async (targetCustId = submittedCustomerId, targetDate = currentMonthDate) => {
    if (!targetCustId) return;

    setLoading(true);
    try {
      const year = targetDate.getFullYear();
      const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
      const formattedMonth = `${year}-${monthStr}`;

      const res = await api.get('/reports/delivery-planner-calendar', {
        params: {
          customer_id: targetCustId,
          month: formattedMonth,
        }
      });

      if (res.data?.success) {
        setCalendarData(res.data);
      } else {
        toast.error(res.data?.message || 'Failed to load delivery planner calendar.');
      }
    } catch (err) {
      console.error('Error fetching delivery planner calendar:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch delivery planner data.');
    } finally {
      setLoading(false);
    }
  };

  // Submit button handler
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!selectedCustomerId) {
      toast.error('Please select a customer.');
      return;
    }
    setSubmittedCustomerId(selectedCustomerId);
    fetchDeliveryPlanner(selectedCustomerId, currentMonthDate);
  };

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    const newDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    setCurrentMonthDate(newDate);
    if (submittedCustomerId) {
      fetchDeliveryPlanner(submittedCustomerId, newDate);
    }
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
    setCurrentMonthDate(newDate);
    if (submittedCustomerId) {
      fetchDeliveryPlanner(submittedCustomerId, newDate);
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!calendarData || !calendarData.days || calendarData.days.length === 0) {
      toast.error('No calendar data available to export.');
      return;
    }
    exportDeliveryPlannerExcel({
      customerCode: calendarData.customer?.customer_code || submittedCustomerId,
      customerName: calendarData.customer?.name || 'Customer',
      monthName: calendarData.monthName,
      year: calendarData.year,
      monthStr: calendarData.month,
      days: calendarData.days,
    });
    toast.success('Exported to Excel successfully!');
  };

  const handleExportPDF = () => {
    if (!calendarData || !calendarData.days || calendarData.days.length === 0) {
      toast.error('No calendar data available to export.');
      return;
    }
    exportDeliveryPlannerPDF({
      customerCode: calendarData.customer?.customer_code || submittedCustomerId,
      customerName: calendarData.customer?.name || 'Customer',
      monthName: calendarData.monthName,
      year: calendarData.year,
      monthStr: calendarData.month,
      days: calendarData.days,
    });
  };

  // Render Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Mark Delivered':
        return <span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Delivered</span>;
      case 'AdHoc':
        return <span className="badge badge-success" style={{ background: '#f0fdf4', color: '#166534', fontWeight: 600 }}>AdHoc</span>;
      case 'Pause':
        return <span className="badge badge-danger" style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>Pause</span>;
      case 'Daily Delivery':
        return <span className="badge badge-warning" style={{ background: '#fef9c3', color: '#854d0e', fontWeight: 600 }}>Daily Delivery</span>;
      case 'Not Delivered':
      default:
        return <span className="badge badge-secondary" style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 600 }}>Not Delivered</span>;
    }
  };

  // Helper for generating calendar grid layout
  const renderCalendarGrid = () => {
    if (!calendarData || !calendarData.days) return null;

    const firstDayIndex = new Date(calendarData.year, calendarData.monthNum - 1, 1).getDay();
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="calendar-grid-container" style={{ marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          {dayLabels.map(day => (
            <div key={day} style={{ padding: '8px 0', background: 'var(--bg-secondary)', borderRadius: 6 }}>{day}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {/* Empty padding slots for days before 1st of month */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} style={{ minHeight: 90, background: 'transparent' }} />
          ))}

          {/* Actual day cells */}
          {calendarData.days.map(d => {
            let borderColor = 'var(--border-color)';
            let cellBg = 'var(--bg-primary)';

            if (d.status === 'Mark Delivered') { cellBg = '#f0fdf4'; borderColor = '#bbf7d0'; }
            else if (d.status === 'AdHoc') { cellBg = '#f0fdf4'; borderColor = '#86efac'; }
            else if (d.status === 'Pause') { cellBg = '#fef2f2'; borderColor = '#fca5a5'; }
            else if (d.status === 'Daily Delivery') { cellBg = '#fffbeb'; borderColor = '#fde68a'; }

            return (
              <div
                key={d.date}
                style={{
                  minHeight: 95,
                  padding: 8,
                  borderRadius: 8,
                  border: `1px solid ${borderColor}`,
                  background: cellBg,
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-main)' }}>{d.dayNumber}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.dayName.substring(0, 3)}</span>
                </div>

                <div style={{ margin: '4px 0' }}>
                  {renderStatusBadge(d.status)}
                </div>

                {d.product && d.product !== '-' && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 'auto', paddingTop: 4 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.product}</div>
                    {d.quantity && d.quantity !== '-' && (
                      <div style={{ color: 'var(--text-muted)' }}>Qty: {d.quantity}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
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
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800 }}>
            <MdLocalShipping style={{ color: '#059669' }} /> Delivery Planner
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Customer-specific monthly delivery planning & status calendar
          </p>
        </div>
      </div>

      {/* Customer Selection Card */}
      <div className="card" style={{ padding: 20, marginBottom: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 6, display: 'block', fontSize: 13 }}>
              Customer Name:
            </label>
            <select
              className="form-select"
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              disabled={optionsLoading}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
            >
              <option value="">[ Select Customer ]</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label || `${c.name} (${c.code || c.id})`}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!selectedCustomerId || loading}
            style={{
              padding: '9px 24px',
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Submit'}
          </button>
        </form>
      </div>

      {/* Monthly Delivery Planner Display */}
      {submittedCustomerId && calendarData && (
        <div className="card" style={{ padding: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
          {/* Header Bar with Customer Info and Export Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Delivery Planner for Customer:
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                {calendarData.customer?.name} ({calendarData.customer?.customer_code})
              </h2>
              {calendarData.customer?.mobile && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mobile: {calendarData.customer.mobile}</span>
              )}
            </div>

            {/* Export Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
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
            </div>
          </div>

          {/* Month Navigation & Legend Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            {/* Previous / Next Month Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <MdChevronLeft style={{ fontSize: 20 }} />
              </button>

              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', minWidth: 140, textAlign: 'center' }}>
                {calendarData.monthName}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <MdChevronRight style={{ fontSize: 20 }} />
              </button>
            </div>

            {/* Legend Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--bg-secondary)', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              <span style={{ color: 'var(--text-muted)' }}>Legend:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#166534' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#166534' }} /> AdHoc</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#991b1b' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#991b1b' }} /> Pause</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#854d0e' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#854d0e' }} /> Daily Delivery</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b91c1c' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b91c1c' }} /> Not Delivered</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#15803d' }}><CheckCircle2 size={13} /> Mark Delivered</span>
            </div>
          </div>

          {/* Calendar View */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading delivery planner calendar...
            </div>
          ) : (
            <>
              {renderCalendarGrid()}

              {/* Detailed Day-by-Day Table View */}
              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text-main)' }}>
                  Daily Status Breakdown ({calendarData.monthName})
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', fontSize: 12, borderBottom: '2px solid var(--border-color)' }}>
                        <th style={{ padding: '10px 12px' }}>Date</th>
                        <th style={{ padding: '10px 12px' }}>Day</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                        <th style={{ padding: '10px 12px' }}>Delivery Type / Product Information</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarData.days.map((d, index) => (
                        <tr key={d.date} style={{ borderBottom: '1px solid var(--border-color)', fontSize: 13, background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.formattedDate}</td>
                          <td style={{ padding: '10px 12px' }}>{d.dayName}</td>
                          <td style={{ padding: '10px 12px' }}>{renderStatusBadge(d.status)}</td>
                          <td style={{ padding: '10px 12px' }}>{d.product || '-'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{d.quantity || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!submittedCustomerId && (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
          <MdCalendarToday style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>No Customer Selected</h3>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            Please select a customer from the dropdown above and click <strong>Submit</strong> to view their monthly Delivery Planner calendar and access PDF & Excel export options.
          </p>
        </div>
      )}
    </motion.div>
  );
}
