import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdDownload, MdClose, MdInfoOutline, MdPerson, MdAssignment, MdCalendarToday, MdDirectionsBike } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../services/api';

export default function DpAuditReportModal({
  isOpen,
  onClose,
  activeTab = 'attendance-route',
  deliveryPersons = [],
  selectedDpId = '',
  operationalDate = '',
  admin = null
}) {
  const [section, setSection] = useState('attendance');
  const [dpId, setDpId] = useState('all');
  const [period, setPeriod] = useState('today');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Set default section based on current active page tab
  useEffect(() => {
    if (activeTab === 'daily-audit') {
      setSection('daily_audit');
    } else if (activeTab === 'dp-overview') {
      setSection('overview');
    } else {
      setSection('attendance');
    }
  }, [activeTab, isOpen]);

  // Seed dates from operationalDate or current IST date
  useEffect(() => {
    if (isOpen) {
      const todayIST = operationalDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      setSingleDate(todayIST);
      setStartDate(todayIST);
      setEndDate(todayIST);
      if (selectedDpId) {
        setDpId(selectedDpId);
      } else {
        setDpId('all');
      }
    }
  }, [isOpen, operationalDate, selectedDpId]);

  if (!isOpen) return null;

  const getSectionCallout = () => {
    switch (section) {
      case 'attendance':
        return {
          title: '📋 Attendance Report:',
          desc: 'Columns mirror Attendance tab: DP Code, Name, Vehicle No, Assigned Route, Total Days, Present Days, Absent Days, Standby Days, Not Marked Days, Attendance %.',
          color: '#10b981',
          bg: 'rgba(16,185,129,0.06)',
          border: 'rgba(16,185,129,0.2)'
        };
      case 'route':
        return {
          title: '🛵 Route & Logistics Report:',
          desc: 'Columns mirror Route tab: Route ID/Name, DP Code & Name, Assigned Date, Stops Assigned, Stops Completed, Geofence Compliance %, Distance Covered (km).',
          color: '#3b82f6',
          bg: 'rgba(59,130,246,0.06)',
          border: 'rgba(59,130,246,0.2)'
        };
      case 'daily_audit':
        return {
          title: '📊 Daily Audit Report:',
          desc: 'Columns mirror Daily Audit tab: DP Code & Name, Assigned Route, Route Status, Milk Taken (L), Milk Delivered (L), Undelivered Milk (L), Petrol Paid (₹), Extra Paid (₹), Short Paid (₹), plus AdHoc products summary.',
          color: '#d97706',
          bg: 'rgba(217,119,6,0.06)',
          border: 'rgba(217,119,6,0.2)'
        };
      case 'overview':
        return {
          title: '👤 DP Overview Report:',
          desc: 'Summary sheet: DP Code, Name, Mobile Number, Vehicle Number, Assigned Route/Zone, Account Status (Active/Inactive), Total Deliveries & Performance Metrics.',
          color: '#7c3aed',
          bg: 'rgba(124,58,237,0.06)',
          border: 'rgba(124,58,237,0.2)'
        };
      default:
        return {
          title: '📊 Audit Report:',
          desc: 'Comprehensive Delivery Person audit metrics exported directly from live DB2 & DB1 stores.',
          color: '#3b82f6',
          bg: 'rgba(59,130,246,0.06)',
          border: 'rgba(59,130,246,0.2)'
        };
    }
  };

  const callout = getSectionCallout();

  const handleGenerateReport = async (e) => {
    if (e) e.preventDefault();

    if (period === 'custom' && (!startDate || !endDate)) {
      return toast.error('Please select both Start Date and End Date for custom date range');
    }

    setDownloading(true);
    try {
      const params = {
        section,
        period,
        dpId,
        date: singleDate,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        generatedBy: admin?.name || 'Super Admin',
      };

      const res = await api.get('/inventory/dp-audit/report', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let dpLabel = dpId === 'all' ? 'All_DPs' : (deliveryPersons.find(d => String(d.id) === String(dpId) || String(d.dpCode) === String(dpId))?.dpCode || 'DP');
      let periodLabel = period === 'custom' ? `${startDate}_to_${endDate}` : period;
      let fileName = `DP_Audit_${section.toUpperCase()}_${dpLabel}_${periodLabel}.xlsx`;

      const contentDisposition = res.headers['content-disposition'];
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) fileName = match[1];
      }

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Delivery Person Audit Excel report downloaded successfully!');
      onClose();
    } catch (err) {
      console.error('DP Audit report download error:', err);
      toast.error('Failed to generate Delivery Person Audit Excel report.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          padding: 20
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="card"
          style={{
            width: '100%',
            maxWidth: 520,
            padding: 0,
            overflow: 'hidden',
            borderRadius: 14,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          {/* Header */}
          <div
            className="card-header"
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #1e40af, #1e3a8a)',
              color: '#fff',
              padding: '16px 20px'
            }}
          >
            <div>
              <div
                className="card-title"
                style={{ color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}
              >
                <MdDownload style={{ fontSize: 20 }} /> Download DP Audit Excel Report
              </div>
              <div style={{ fontSize: 11.5, color: '#93c5fd', marginTop: 3 }}>
                Generate customized audit sheet for Delivery Persons
              </div>
            </div>
            <button
              className="icon-btn"
              onClick={onClose}
              style={{ color: '#fff', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <MdClose style={{ fontSize: 20 }} />
            </button>
          </div>

          <form onSubmit={handleGenerateReport} style={{ padding: 20 }}>
            {/* Callout Banner */}
            <div
              style={{
                background: callout.bg,
                border: `1px solid ${callout.border}`,
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 18,
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.4
              }}
            >
              <span style={{ fontWeight: 700, color: callout.color }}>{callout.title}</span> {callout.desc}
            </div>

            {/* Section/Tab Selection */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                Report Section / View *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setSection('attendance')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: section === 'attendance' ? '2px solid #10b981' : '1px solid var(--border)',
                    background: section === 'attendance' ? 'rgba(16,185,129,0.08)' : 'var(--card-bg)',
                    fontWeight: section === 'attendance' ? 700 : 500,
                    color: section === 'attendance' ? '#10b981' : 'var(--text-primary)',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <MdCalendarToday /> Attendance
                </button>

                <button
                  type="button"
                  onClick={() => setSection('route')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: section === 'route' ? '2px solid #3b82f6' : '1px solid var(--border)',
                    background: section === 'route' ? 'rgba(59,130,246,0.08)' : 'var(--card-bg)',
                    fontWeight: section === 'route' ? 700 : 500,
                    color: section === 'route' ? '#3b82f6' : 'var(--text-primary)',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <MdDirectionsBike /> Route
                </button>

                <button
                  type="button"
                  onClick={() => setSection('daily_audit')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: section === 'daily_audit' ? '2px solid #d97706' : '1px solid var(--border)',
                    background: section === 'daily_audit' ? 'rgba(217,119,6,0.08)' : 'var(--card-bg)',
                    fontWeight: section === 'daily_audit' ? 700 : 500,
                    color: section === 'daily_audit' ? '#d97706' : 'var(--text-primary)',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <MdAssignment /> Daily Audit
                </button>

                <button
                  type="button"
                  onClick={() => setSection('overview')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: section === 'overview' ? '2px solid #7c3aed' : '1px solid var(--border)',
                    background: section === 'overview' ? 'rgba(124,58,237,0.08)' : 'var(--card-bg)',
                    fontWeight: section === 'overview' ? 700 : 500,
                    color: section === 'overview' ? '#7c3aed' : 'var(--text-primary)',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <MdPerson /> DP Overview
                </button>
              </div>
            </div>

            {/* Delivery Person Scope Selector */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                Target Delivery Person:
              </label>
              <select
                className="form-input"
                style={{ fontSize: 13, marginTop: 4 }}
                value={dpId}
                onChange={(e) => setDpId(e.target.value)}
              >
                <option value="all">👥 All Delivery Persons</option>
                {deliveryPersons.map((dp) => (
                  <option key={dp.id || dp.dpCode} value={dp.id || dp.dpCode}>
                    🛵 {dp.name} ({dp.dpCode || 'DP'}) — {dp.assignedRoute || dp.zone || 'Unassigned'}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter Selection: 4 Options */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                Select Period / Date Range *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="periodOption"
                    value="today"
                    checked={period === 'today'}
                    onChange={() => setPeriod('today')}
                    style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                  />
                  Today
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="periodOption"
                    value="this_week"
                    checked={period === 'this_week'}
                    onChange={() => setPeriod('this_week')}
                    style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                  />
                  This Week
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="periodOption"
                    value="this_month"
                    checked={period === 'this_month'}
                    onChange={() => setPeriod('this_month')}
                    style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                  />
                  This Month
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <input
                    type="radio"
                    name="periodOption"
                    value="custom"
                    checked={period === 'custom'}
                    onChange={() => setPeriod('custom')}
                    style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                  />
                  Custom Date Range
                </label>
              </div>
            </div>

            {/* Date Pickers */}
            {period === 'today' ? (
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Target Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  required
                />
              </div>
            ) : period === 'custom' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>From Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>To Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, fontStyle: 'italic' }}>
                Note: Standard range will automatically include all records for {period === 'this_week' ? 'the current calendar week' : 'the current month'}.
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={downloading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={downloading}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <MdDownload /> {downloading ? 'Generating Excel...' : 'Generate & Download Excel'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
