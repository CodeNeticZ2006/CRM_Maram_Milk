import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MdMap, MdArrowBack, MdSearch, MdRefresh,
  MdFileDownload, MdPictureAsPdf, MdChevronLeft, MdChevronRight
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { exportDeliveryAreaExcel, exportDeliveryAreaPDF } from '../../utils/exportUtils';

export default function DeliveryAreaReportPage() {
  const navigate = useNavigate();

  // Filter options loaded from backend
  const [filterOptions, setFilterOptions] = useState({
    states: ['Tamil Nadu'],
    cities: ['Chennai'],
    areaNames: [],
    serviceAvailabilities: ['Delivery Available', 'Not Available'],
  });
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Filter states
  const [selectedState, setSelectedState] = useState('Tamil Nadu');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedAreaName, setSelectedAreaName] = useState('');
  const [selectedService, setSelectedService] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Report data states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Export loading states
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Load filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      setOptionsLoading(true);
      try {
        const res = await api.get('/reports/delivery-area-options');
        if (res.data?.success) {
          setFilterOptions(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load delivery area options:', err);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  // Fetch report data on mount, filter change, page change, or limit change
  const fetchReport = async (targetPage = page, targetLimit = limit) => {
    setLoading(true);
    try {
      const params = {
        state: selectedState,
        city: selectedCity,
        area_name: selectedAreaName,
        service_availability: selectedService,
        page: targetPage,
        limit: targetLimit,
      };

      const res = await api.get('/reports/delivery-area', { params });
      if (res.data?.success) {
        setReportData(res.data.data || []);
        setTotalRecords(res.data.totalRecords || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        toast.error(res.data?.message || 'Failed to load delivery area report.');
      }
    } catch (err) {
      console.error('Error fetching delivery area report:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(page, limit);
  }, [page, limit]);

  // Search button handler
  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchReport(1, limit);
  };

  // Reset button handler
  const handleReset = () => {
    setSelectedState('Tamil Nadu');
    setSelectedCity('');
    setSelectedAreaName('');
    setSelectedService('');
    setPage(1);

    // Fetch default reset state
    setTimeout(() => {
      fetchReport(1, limit);
    }, 0);
    toast.success('Filters reset to default.');
  };

  // Export handlers (fetches ALL matching records)
  const fetchAllMatchingRecords = async () => {
    try {
      const params = {
        state: selectedState,
        city: selectedCity,
        area_name: selectedAreaName,
        service_availability: selectedService,
        export_all: true,
      };
      const res = await api.get('/reports/delivery-area', { params });
      if (res.data?.success) {
        return res.data.data || [];
      }
      return reportData;
    } catch (err) {
      console.error('Error fetching export records:', err);
      return reportData;
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    toast.loading('Generating Excel...', { id: 'excel-toast' });
    try {
      const rows = await fetchAllMatchingRecords();
      if (!rows || rows.length === 0) {
        toast.error('No delivery areas to export.', { id: 'excel-toast' });
        return;
      }
      const filterParts = [];
      if (selectedState) filterParts.push(`State: ${selectedState}`);
      if (selectedCity) filterParts.push(`City: ${selectedCity}`);
      if (selectedAreaName) filterParts.push(`Area: ${selectedAreaName}`);
      if (selectedService) filterParts.push(`Service: ${selectedService}`);

      exportDeliveryAreaExcel({
        city: selectedCity,
        filterInfo: filterParts.join(' | ') || 'All Delivery Areas',
        rows,
      });
      toast.success('Excel downloaded successfully!', { id: 'excel-toast' });
    } catch (err) {
      toast.error('Failed to export Excel.', { id: 'excel-toast' });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const rows = await fetchAllMatchingRecords();
      if (!rows || rows.length === 0) {
        toast.error('No delivery areas to export.');
        return;
      }
      const filterParts = [];
      if (selectedState) filterParts.push(`State: ${selectedState}`);
      if (selectedCity) filterParts.push(`City: ${selectedCity}`);
      if (selectedAreaName) filterParts.push(`Area: ${selectedAreaName}`);
      if (selectedService) filterParts.push(`Service: ${selectedService}`);

      exportDeliveryAreaPDF({
        city: selectedCity,
        filterInfo: filterParts.join(' | ') || 'All Delivery Areas',
        rows,
      });
    } catch (err) {
      toast.error('Failed to export PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Pagination calculation
  const startRecord = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRecords);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="page-container"
      style={{ padding: 24 }}
    >
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              cursor: 'pointer'
            }}
          >
            <MdArrowBack style={{ fontSize: 16 }} /> Back
          </button>

          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800, margin: 0 }}>
            <MdMap style={{ color: '#2563eb' }} /> DELIVERY AREA REPORT
          </h1>
        </div>

        {/* Export Buttons & Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportPDF}
            disabled={loading || exportingPdf || totalRecords === 0}
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
            <MdPictureAsPdf style={{ fontSize: 16 }} /> ↓ Export to PDF
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportExcel}
            disabled={loading || exportingExcel || totalRecords === 0}
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
            <MdFileDownload style={{ fontSize: 16 }} /> ↓ Export to Excel
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Page size:</span>
            <select
              className="form-select"
              value={limit}
              onChange={e => {
                const newLimit = parseInt(e.target.value, 10);
                setLimit(newLimit);
                setPage(1);
              }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13, fontWeight: 600 }}
            >
              <option value={10}>10 ▼</option>
              <option value={20}>20 ▼</option>
              <option value={50}>50 ▼</option>
              <option value={100}>100 ▼</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Section Card */}
      <div className="card" style={{ padding: 24, marginBottom: 24, background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
            {/* State Filter */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                State:
              </label>
              <select
                className="form-select"
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
                disabled={optionsLoading}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              >
                {filterOptions.states.map(st => (
                  <option key={st} value={st}>{st} ▼</option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                City:
              </label>
              <select
                className="form-select"
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                disabled={optionsLoading}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              >
                <option value="">[ Select City ▼ ]</option>
                {filterOptions.cities.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>

            {/* Area Name Filter */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                Area Name:
              </label>
              <select
                className="form-select"
                value={selectedAreaName}
                onChange={e => setSelectedAreaName(e.target.value)}
                disabled={optionsLoading}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              >
                <option value="">[ Select Area ▼ ]</option>
                {filterOptions.areaNames.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Service Availability Filter */}
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                Service Availability:
              </label>
              <select
                className="form-select"
                value={selectedService}
                onChange={e => setSelectedService(e.target.value)}
                disabled={optionsLoading}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              >
                <option value="">[ Select Service ▼ ]</option>
                {filterOptions.serviceAvailabilities.map(sa => (
                  <option key={sa} value={sa}>{sa}</option>
                ))}
              </select>
            </div>

            {/* Filter Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  padding: '9px 20px',
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
                <MdSearch style={{ fontSize: 18 }} /> {loading ? 'Loading...' : 'Search'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={loading}
                style={{
                  padding: '9px 16px',
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

      {/* Results Header Counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
          Displaying {startRecord}-{endRecord} of {totalRecords} results.
        </div>
      </div>

      {/* Report Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading delivery areas...
          </div>
        ) : reportData.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', fontSize: 12, borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 16px' }}>State</th>
                  <th style={{ padding: '12px 16px' }}>City</th>
                  <th style={{ padding: '12px 16px' }}>Area Name</th>
                  <th style={{ padding: '12px 16px' }}>Area Pin</th>
                  <th style={{ padding: '12px 16px' }}>Route</th>
                  <th style={{ padding: '12px 16px' }}>Service Availability</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, index) => {
                  const isAvailable = r.service_availability === 'Delivery Available';
                  return (
                    <tr key={r.id || index} style={{ borderBottom: '1px solid var(--border-color)', fontSize: 13, background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                      <td style={{ padding: '12px 16px' }}>{r.state}</td>
                      <td style={{ padding: '12px 16px' }}>{r.city}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>{r.area_name}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>{r.area_pin}</td>
                      <td style={{ padding: '12px 16px' }}>{r.route}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className={`badge ${isAvailable ? 'badge-success' : 'badge-danger'}`}
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: 11,
                            background: isAvailable ? '#dcfce7' : '#fee2e2',
                            color: isAvailable ? '#15803d' : '#991b1b',
                          }}
                        >
                          {r.service_availability}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <MdMap style={{ fontSize: 48, color: '#94a3b8', marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>No delivery areas found.</h3>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Try adjusting your filter parameters to view matching delivery areas.
            </p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            disabled={page === 1 || loading}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer' }}
          >
            <MdChevronLeft style={{ fontSize: 18 }} /> «
          </button>

          {Array.from({ length: totalPages }).map((_, idx) => {
            const pNum = idx + 1;
            const isActive = pNum === page;
            return (
              <button
                key={pNum}
                type="button"
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPage(pNum)}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? '#2563eb' : 'var(--bg-secondary)',
                  color: isActive ? '#fff' : 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                {pNum}
              </button>
            );
          })}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages || loading}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer' }}
          >
            » <MdChevronRight style={{ fontSize: 18 }} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
