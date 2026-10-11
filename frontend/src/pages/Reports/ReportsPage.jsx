import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MdRefresh, MdCalendarToday, MdDownload, MdFileDownload,
  MdInventory2, MdAnalytics, MdFilterList, MdSearch,
  MdCheckCircle, MdDateRange, MdGridOn, MdStorefront, MdBusiness,
  MdOutlineAssignmentReturn, MdFlashOn, MdPictureAsPdf,
  MdLocalDrink, MdSchedule, MdPauseCircleOutline, MdPeopleAlt, MdLayers
} from 'react-icons/md';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useOperationalDay from '../../hooks/useOperationalDay';
import { exportToExcel, exportToPDF, downloadDirectPDF } from '../../utils/exportUtils';
import CustomerSearchSelector from '../../components/common/CustomerSearchSelector';

export default function ReportsPage() {
  const { admin } = useAuthStore();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'milk-requirement' | 'subscription-status' | 'pause-impact' | 'stock-correctness-reports' | 'adhoc-reports' | 'inventory-reports'
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [customerAnalysis, setCustomerAnalysis] = useState(null);
  const [managerInvData, setManagerInvData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active operational day — backend is source of truth (7:00 PM IST boundary)
  const { operationalDate, loading: opDayLoading } = useOperationalDay();
  const [date, setDate] = useState('');

  // Seed date from operational day once loaded
  useEffect(() => {
    if (!opDayLoading && operationalDate) {
      setDate(prev => prev || operationalDate);
      setMilkReqDate(prev => prev || operationalDate);
    }
  }, [operationalDate, opDayLoading]);

  // Inventory Reports Archive State
  const [archivedReports, setArchivedReports]   = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [reportFilterType, setReportFilterType] = useState('Inventory Report');
  const [reportFilterFormat, setReportFilterFormat] = useState('');
  const [reportSearch, setReportSearch]       = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate]     = useState('');

  // AdHoc Product Reports State
  const [adhocReportData, setAdhocReportData] = useState(null);
  const [adhocReportMode, setAdhocReportMode] = useState('daily');
  const [adhocReportStartDate, setAdhocReportStartDate] = useState('');
  const [adhocReportEndDate, setAdhocReportEndDate]     = useState('');
  const [adhocLoading, setAdhocLoading]             = useState(false);

  // Stock Correctness Reports State
  const [scReportData, setScReportData]         = useState(null);
  const [scReportMode, setScReportMode]         = useState('daily'); // 'daily' | 'monthly' | 'custom'
  const [scReportStartDate, setScReportStartDate] = useState('');
  const [scReportEndDate, setScReportEndDate]     = useState('');
  const [scReportLoading, setScReportLoading]   = useState(false);

  // ── Phase 4: Daily Milk Requirement State ──
  const [milkReqDate, setMilkReqDate] = useState('');
  const [milkReqData, setMilkReqData] = useState(null);
  const [milkReqLoading, setMilkReqLoading] = useState(false);

  // ── Phase 4: Subscription Status State ──
  const [subStatusFilter, setSubStatusFilter] = useState('All');
  const [subFrequencyFilter, setSubFrequencyFilter] = useState('All');
  const [subCustomerFilter, setSubCustomerFilter] = useState('');
  const [subHubFilter, setSubHubFilter] = useState('All');
  const [subPage, setSubPage] = useState(1);
  const [subLimit, setSubLimit] = useState(10);
  const [subData, setSubData] = useState(null);
  const [subLoading, setSubLoading] = useState(false);

  // ── Phase 4: Pause Impact State ──
  const [pauseStatusFilter, setPauseStatusFilter] = useState('All');
  const [pauseDateFrom, setPauseDateFrom] = useState('');
  const [pauseDateTo, setPauseDateTo] = useState('');
  const [pauseCustomerFilter, setPauseCustomerFilter] = useState('');
  const [pausePage, setPausePage] = useState(1);
  const [pauseLimit, setPauseLimit] = useState(10);
  const [pauseData, setPauseData] = useState(null);
  const [pauseLoading, setPauseLoading] = useState(false);

  // ── Fetchers ──

  const fetchAdhocReports = async () => {
    setAdhocLoading(true);
    try {
      const params = {
        mode: adhocReportMode,
        date: date || operationalDate,
        startDate: adhocReportStartDate,
        endDate: adhocReportEndDate,
      };
      const res = await api.get('/reports/adhoc', { params });
      if (res.data?.success) {
        setAdhocReportData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load AdHoc report:', err);
      toast.error('Failed to load AdHoc report.');
    } finally {
      setAdhocLoading(false);
    }
  };

  const fetchStockCorrectnessReports = async () => {
    setScReportLoading(true);
    try {
      const params = {
        type: scReportMode,
        date: date || operationalDate,
        startDate: scReportStartDate,
        endDate: scReportEndDate,
      };
      const res = await api.get('/reports/stock-correctness', { params });
      if (res.data?.success) {
        setScReportData(res.data);
      }
    } catch {
      toast.error('Failed to load Stock Correctness Report.');
    } finally {
      setScReportLoading(false);
    }
  };

  const fetchMilkRequirement = async () => {
    setMilkReqLoading(true);
    try {
      const targetDate = milkReqDate || date || operationalDate;
      const res = await api.get('/reports/milk-requirement-report', { params: { date: targetDate } });
      if (res.data?.success) {
        setMilkReqData(res.data);
      }
    } catch (err) {
      console.error('Failed to load Milk Requirement report:', err);
      toast.error('Failed to load Daily Milk Requirement report.');
    } finally {
      setMilkReqLoading(false);
    }
  };

  const fetchSubscriptionStatus = async (pageOverride) => {
    setSubLoading(true);
    try {
      const p = pageOverride !== undefined ? pageOverride : subPage;
      const params = {
        status: subStatusFilter,
        frequency_type: subFrequencyFilter,
        customer_id: subCustomerFilter,
        hub: subHubFilter,
        page: p,
        limit: subLimit,
      };
      const res = await api.get('/reports/subscription-status-report', { params });
      if (res.data?.success) {
        setSubData(res.data);
      }
    } catch (err) {
      console.error('Failed to load Subscription Status report:', err);
      toast.error('Failed to load Subscription Status report.');
    } finally {
      setSubLoading(false);
    }
  };

  const fetchPauseImpact = async (pageOverride) => {
    setPauseLoading(true);
    try {
      const p = pageOverride !== undefined ? pageOverride : pausePage;
      const params = {
        status: pauseStatusFilter,
        date_from: pauseDateFrom,
        date_to: pauseDateTo,
        customer_id: pauseCustomerFilter,
        page: p,
        limit: pauseLimit,
      };
      const res = await api.get('/reports/pause-impact-report', { params });
      if (res.data?.success) {
        setPauseData(res.data);
      }
    } catch (err) {
      console.error('Failed to load Pause Impact report:', err);
      toast.error('Failed to load Pause Impact report.');
    } finally {
      setPauseLoading(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [d, m, ca, mi] = await Promise.all([
        api.get('/reports/daily-summary', { params: { date } }),
        api.get('/reports/monthly'),
        api.get('/reports/customer-analysis'),
        api.get('/inventory/manager-inventory', { params: { date } }).catch(() => ({ data: null })),
      ]);
      setDaily(d.data);
      setMonthly(m.data);
      setCustomerAnalysis(ca.data?.data || ca.data);
      setManagerInvData(mi.data);
    } catch { toast.error('Failed to load reports.'); }
    finally { setLoading(false); }
  };

  const fetchArchivedReports = async () => {
    setArchivedLoading(true);
    try {
      const params = {
        category: reportFilterType,
        format: reportFilterFormat,
        search: reportSearch,
        startDate: reportStartDate,
        endDate: reportEndDate,
      };
      const res = await api.get('/reports/archived', { params });
      setArchivedReports(res.data.data || []);
    } catch (err) {
      console.error('Error loading archived reports:', err);
      toast.error('Failed to fetch archived reports.');
    } finally {
      setArchivedLoading(false);
    }
  };

  // ── Phase 4 Exports ──

  const handleExportMilkReqPdf = () => {
    if (!milkReqData || !milkReqData.products || milkReqData.products.length === 0) {
      toast.error('No milk requirement data available to export.');
      return;
    }
    const headers = ['#', 'Product Name', 'Category', 'Unit', 'Total Quantity', 'Customers', 'Delivery Boy Allocations', 'Hub Allocations'];
    const rows = milkReqData.products.map((p, idx) => [
      idx + 1,
      p.productName,
      p.category || 'Milk',
      p.unit,
      p.totalQuantity,
      p.customerCount,
      Object.entries(p.deliveryPersons || {}).map(([dp, q]) => `${dp}: ${q}`).join(' | ') || 'None',
      Object.entries(p.hubs || {}).map(([h, q]) => `${h}: ${q}`).join(' | ') || 'None'
    ]);
    downloadDirectPDF({
      fileName: `Daily_Milk_Requirement_${milkReqData.date}`,
      reportTitle: 'Daily Milk Requirement & Procurement Report',
      filterInfo: `Operational Date: ${milkReqData.date}`,
      headers,
      rows,
      summaryBoxes: [
        { label: 'Scheduled Customers', value: milkReqData.totalScheduledCustomers },
        { label: 'Total Milk Liters', value: `${milkReqData.totalMilkLiters} L` },
        { label: 'Other Product Units', value: `${milkReqData.totalOtherUnits} Units` },
        { label: 'Distinct Products', value: milkReqData.products.length }
      ],
      orientation: 'landscape'
    });
    toast.success('Generated Milk Requirement PDF!');
  };

  const handleExportMilkReqExcel = () => {
    if (!milkReqData || !milkReqData.products || milkReqData.products.length === 0) {
      toast.error('No milk requirement data available to export.');
      return;
    }
    const headers = ['#', 'Product Name', 'Category', 'Unit', 'Total Quantity', 'Customers', 'Delivery Boy Allocations', 'Hub Allocations'];
    const rows = milkReqData.products.map((p, idx) => [
      idx + 1,
      p.productName,
      p.category || 'Milk',
      p.unit,
      p.totalQuantity,
      p.customerCount,
      Object.entries(p.deliveryPersons || {}).map(([dp, q]) => `${dp}: ${q}`).join(' | ') || 'None',
      Object.entries(p.hubs || {}).map(([h, q]) => `${h}: ${q}`).join(' | ') || 'None'
    ]);
    exportToExcel({
      fileName: `Daily_Milk_Requirement_${milkReqData.date}`,
      sheetName: 'Milk Requirement',
      reportTitle: 'Daily Milk Requirement & Procurement Report',
      filterInfo: `Operational Date: ${milkReqData.date} | Milk Liters: ${milkReqData.totalMilkLiters}L | Scheduled Customers: ${milkReqData.totalScheduledCustomers}`,
      headers,
      rows
    });
    toast.success('Exported to Excel!');
  };

  const handleExportSubStatusPdf = async () => {
    try {
      toast.loading('Preparing full subscription PDF...', { id: 'sub-export' });
      const res = await api.get('/reports/subscription-status-report', {
        params: {
          status: subStatusFilter,
          frequency_type: subFrequencyFilter,
          customer_id: subCustomerFilter,
          hub: subHubFilter,
          export_all: true
        }
      });
      const rowsData = res.data?.rows || [];
      if (rowsData.length === 0) {
        toast.error('No subscriptions to export.', { id: 'sub-export' });
        return;
      }
      const headers = ['Code', 'Customer', 'Phone', 'Frequency', 'Schedule Pattern', 'Products & Qty', 'Hub', 'Delivery Boy', 'Status', 'Pause Details'];
      const rows = rowsData.map(r => [
        r.customer_code || '-',
        r.customer_name || '-',
        r.customer_phone || '-',
        r.frequency_type || '-',
        r.frequency_type === 'ALTERNATE_DAY' ? `Anchor: ${r.alternate_anchor_date || '-'}` :
        r.frequency_type === 'CUSTOM_WEEKLY' ? (r.custom_weekdays ? r.custom_weekdays.join(', ') : 'Weekly') : 'Daily',
        (r.items || []).map(i => `${i.product_name} (${i.quantity} ${i.unit || ''})`).join(', ') || 'No Items',
        r.hub || '-',
        r.delivery_person_name || 'Unassigned',
        r.status || 'Active',
        r.active_pause ? `PAUSED (${r.active_pause.pause_start_date} to ${r.active_pause.pause_end_date})` : 'Active'
      ]);
      downloadDirectPDF({
        fileName: 'Subscription_Status_Report',
        reportTitle: 'Subscription Status & Schedules Report',
        filterInfo: `Status: ${subStatusFilter} | Frequency: ${subFrequencyFilter} | Total Subscriptions: ${rows.length}`,
        headers,
        rows,
        orientation: 'landscape'
      });
      toast.success('Downloaded Subscription Status PDF!', { id: 'sub-export' });
    } catch (err) {
      console.error(err);
      toast.error('Export failed.', { id: 'sub-export' });
    }
  };

  const handleExportSubStatusExcel = async () => {
    try {
      toast.loading('Preparing full subscription Excel...', { id: 'sub-export' });
      const res = await api.get('/reports/subscription-status-report', {
        params: {
          status: subStatusFilter,
          frequency_type: subFrequencyFilter,
          customer_id: subCustomerFilter,
          hub: subHubFilter,
          export_all: true
        }
      });
      const rowsData = res.data?.rows || [];
      if (rowsData.length === 0) {
        toast.error('No subscriptions to export.', { id: 'sub-export' });
        return;
      }
      const headers = ['Customer Code', 'Customer Name', 'Phone', 'Frequency Type', 'Schedule Details', 'Start Date', 'First Delivery Date', 'Products & Quantities', 'Hub', 'Delivery Boy', 'Status', 'Active Pause'];
      const rows = rowsData.map(r => [
        r.customer_code || '',
        r.customer_name || '',
        r.customer_phone || '',
        r.frequency_type || '',
        r.frequency_type === 'ALTERNATE_DAY' ? `Alternate (Anchor: ${r.alternate_anchor_date || ''})` :
        r.frequency_type === 'CUSTOM_WEEKLY' ? `Weekly: ${r.custom_weekdays ? r.custom_weekdays.join(', ') : ''}` : 'Everyday',
        r.start_date || '',
        r.first_delivery_date || '',
        (r.items || []).map(i => `${i.product_name} (${i.quantity} ${i.unit || ''})`).join('; '),
        r.hub || '',
        r.delivery_person_name || 'Unassigned',
        r.status || 'Active',
        r.active_pause ? `Paused: ${r.active_pause.pause_start_date} to ${r.active_pause.pause_end_date} (${r.active_pause.reason || ''})` : 'None'
      ]);
      exportToExcel({
        fileName: 'Subscription_Status_Report',
        sheetName: 'Subscriptions',
        reportTitle: 'Subscription Status & Schedules Report',
        filterInfo: `Status: ${subStatusFilter} | Frequency: ${subFrequencyFilter} | Total Subscriptions: ${rows.length}`,
        headers,
        rows
      });
      toast.success('Exported Subscriptions to Excel!', { id: 'sub-export' });
    } catch (err) {
      console.error(err);
      toast.error('Export failed.', { id: 'sub-export' });
    }
  };

  const handleExportPauseImpactPdf = async () => {
    try {
      toast.loading('Preparing Pause Impact PDF...', { id: 'pause-export' });
      const res = await api.get('/reports/pause-impact-report', {
        params: {
          status: pauseStatusFilter,
          date_from: pauseDateFrom,
          date_to: pauseDateTo,
          customer_id: pauseCustomerFilter,
          export_all: true
        }
      });
      const rowsData = res.data?.rows || [];
      if (rowsData.length === 0) {
        toast.error('No pauses to export.', { id: 'pause-export' });
        return;
      }
      const headers = ['Code', 'Customer Name', 'Phone', 'Pause Start', 'Pause End', 'Status', 'Reason', 'Impacted Products', 'Hub', 'Delivery Boy'];
      const rows = rowsData.map(r => [
        r.customer_code || '-',
        r.customer_name || '-',
        r.customer_phone || '-',
        r.pause_start_date || '-',
        r.pause_end_date || '-',
        r.pause_status || '-',
        r.reason || '-',
        (r.paused_items || []).map(i => `${i.product_name} (${i.quantity} ${i.unit || ''})`).join(', ') || 'No Items',
        r.hub || '-',
        r.delivery_person_name || 'Unassigned'
      ]);
      downloadDirectPDF({
        fileName: 'Pause_Impact_Report',
        reportTitle: 'Subscription Pause Impact & Schedules Report',
        filterInfo: `Status: ${pauseStatusFilter} | Total Pauses: ${rows.length}`,
        headers,
        rows,
        orientation: 'landscape'
      });
      toast.success('Downloaded Pause Impact PDF!', { id: 'pause-export' });
    } catch (err) {
      console.error(err);
      toast.error('Export failed.', { id: 'pause-export' });
    }
  };

  const handleExportPauseImpactExcel = async () => {
    try {
      toast.loading('Preparing Pause Impact Excel...', { id: 'pause-export' });
      const res = await api.get('/reports/pause-impact-report', {
        params: {
          status: pauseStatusFilter,
          date_from: pauseDateFrom,
          date_to: pauseDateTo,
          customer_id: pauseCustomerFilter,
          export_all: true
        }
      });
      const rowsData = res.data?.rows || [];
      if (rowsData.length === 0) {
        toast.error('No pauses to export.', { id: 'pause-export' });
        return;
      }
      const headers = ['Customer Code', 'Customer Name', 'Phone', 'Pause Start Date', 'Pause End Date', 'Pause Status', 'Reason', 'Impacted Products', 'Hub', 'Delivery Boy'];
      const rows = rowsData.map(r => [
        r.customer_code || '',
        r.customer_name || '',
        r.customer_phone || '',
        r.pause_start_date || '',
        r.pause_end_date || '',
        r.pause_status || '',
        r.reason || '',
        (r.paused_items || []).map(i => `${i.product_name} (${i.quantity} ${i.unit || ''})`).join('; '),
        r.hub || '',
        r.delivery_person_name || 'Unassigned'
      ]);
      exportToExcel({
        fileName: 'Pause_Impact_Report',
        sheetName: 'Pause Impact',
        reportTitle: 'Subscription Pause Impact & Schedules Report',
        filterInfo: `Status: ${pauseStatusFilter} | Total Pauses: ${rows.length}`,
        headers,
        rows
      });
      toast.success('Exported Pause Impact to Excel!', { id: 'pause-export' });
    } catch (err) {
      console.error(err);
      toast.error('Export failed.', { id: 'pause-export' });
    }
  };

  // ── Existing Exports ──

  const handleExportAdhocPdf = () => {
    if (!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0) {
      toast.error('No AdHoc sales data available to export.');
      return;
    }
    const headers = ['Date', 'DP Name', 'Route', 'Product', 'Taken', 'Sold', 'Returned', 'Remaining', 'Sales Amount (₹)'];
    const rows = adhocReportData.dpSalesAudit.map(r => [
      r.date, r.dp_name, r.route_name, r.product_name, r.quantity_taken, r.quantity_sold, r.quantity_returned, r.quantity_remaining, `₹${parseFloat(r.total_sales_amount || 0).toFixed(2)}`
    ]);
    exportToPDF({
      reportTitle: 'AdHoc Product Sales Report',
      filterInfo: `Mode: ${adhocReportMode}`,
      headers,
      rows,
      totalRecords: rows.length,
    });
    toast.success('Generated PDF report!');
  };

  const handleExportAdhocExcel = () => {
    if (!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0) {
      toast.error('No AdHoc sales data available to export.');
      return;
    }
    const headers = ['Date', 'DP Name', 'Route', 'Product', 'Taken', 'Sold', 'Returned', 'Remaining', 'Sales Amount (₹)'];
    const rows = adhocReportData.dpSalesAudit.map(r => [
      r.date, r.dp_name, r.route_name, r.product_name, r.quantity_taken, r.quantity_sold, r.quantity_returned, r.quantity_remaining, `₹${parseFloat(r.total_sales_amount || 0).toFixed(2)}`
    ]);
    exportToExcel({
      fileName: `adhoc_sales_report_${adhocReportMode}`,
      reportTitle: 'AdHoc Product Sales Report',
      filterInfo: `Mode: ${adhocReportMode}`,
      headers,
      rows,
    });
    toast.success('Exported to Excel!');
  };

  const handleExportScPdf = () => {
    if (!scReportData || !scReportData.data || scReportData.data.length === 0) {
      toast.error('No stock correctness data available to export.');
      return;
    }
    const headers = ['Operational Day', 'Product Name', 'Expected Stock', 'Manager Logged Stock', 'Difference', 'Status', 'Review Status', 'Remarks'];
    const rows = scReportData.data.map(r => [
      r.operationalDay, r.productName, r.expectedStock, r.managerLoggedStock !== null ? r.managerLoggedStock : 'Not Logged', r.difference, r.status, r.reviewStatus, r.remarks || '-'
    ]);
    exportToPDF({
      reportTitle: 'Stock Correctness Report',
      filterInfo: `Mode: ${scReportMode}`,
      headers,
      rows,
      totalRecords: rows.length,
    });
    toast.success('Generated PDF report!');
  };

  const handleExportScExcel = () => {
    if (!scReportData || !scReportData.data || scReportData.data.length === 0) {
      toast.error('No stock correctness data available to export.');
      return;
    }
    const headers = ['Operational Day', 'Product Name', 'Expected Stock', 'Manager Logged Stock', 'Difference', 'Status', 'Review Status', 'Remarks'];
    const rows = scReportData.data.map(r => [
      r.operationalDay, r.productName, r.expectedStock, r.managerLoggedStock !== null ? r.managerLoggedStock : 'Not Logged', r.difference, r.status, r.reviewStatus, r.remarks || '-'
    ]);
    exportToExcel({
      fileName: `stock_correctness_report_${scReportMode}`,
      reportTitle: 'Stock Correctness Report',
      filterInfo: `Mode: ${scReportMode}`,
      headers,
      rows,
    });
    toast.success('Exported to Excel!');
  };

  const handleGenerateReportDirect = async () => {
    try {
      toast.loading('Generating Inventory Report...', { id: 'gen-report' });
      const res = await api.get('/inventory/download-report', {
        params: { mode: 'today', date, generatedBy: admin?.name || 'Sarfaraz Ahmed' },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Maram_Milk_Inventory_Report_${date}.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Inventory Report generated and downloaded!', { id: 'gen-report' });
      if (activeTab === 'inventory-reports') fetchArchivedReports();
    } catch (err) {
      console.error('Report generation error:', err);
      toast.error('Failed to generate report.', { id: 'gen-report' });
    }
  };

  const handleDownloadArchived = async (report) => {
    try {
      const res = await api.get(`/reports/download/${report.id}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const fileName = report.report_name || `Maram_Milk_${(report.report_type || 'Report').replace(/\s+/g, '_')}.xlsx`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${fileName}`);
    } catch (err) {
      console.error('Archived report download error:', err);
      toast.error('Failed to download report file.');
    }
  };

  // Trigger data load on tab or filter change
  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAll();
    } else if (activeTab === 'inventory-reports') {
      fetchArchivedReports();
    } else if (activeTab === 'adhoc-reports') {
      fetchAdhocReports();
    } else if (activeTab === 'stock-correctness-reports') {
      fetchStockCorrectnessReports();
    } else if (activeTab === 'milk-requirement') {
      fetchMilkRequirement();
    } else if (activeTab === 'subscription-status') {
      fetchSubscriptionStatus();
    } else if (activeTab === 'pause-impact') {
      fetchPauseImpact();
    }
  }, [
    date, activeTab,
    adhocReportMode, adhocReportStartDate, adhocReportEndDate,
    scReportMode, scReportStartDate, scReportEndDate,
    milkReqDate,
    subStatusFilter, subFrequencyFilter, subCustomerFilter, subHubFilter, subPage,
    pauseStatusFilter, pauseDateFrom, pauseDateTo, pauseCustomerFilter, pausePage
  ]);

  const handleTopRefresh = () => {
    if (activeTab === 'analytics') fetchAll();
    else if (activeTab === 'adhoc-reports') fetchAdhocReports();
    else if (activeTab === 'stock-correctness-reports') fetchStockCorrectnessReports();
    else if (activeTab === 'inventory-reports') fetchArchivedReports();
    else if (activeTab === 'milk-requirement') fetchMilkRequirement();
    else if (activeTab === 'subscription-status') fetchSubscriptionStatus();
    else if (activeTab === 'pause-impact') fetchPauseImpact();
  };

  if (loading && activeTab === 'analytics') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <span className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
    </div>
  );

  const d = daily?.data;
  const m = monthly?.data;
  const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Daily summary, milk requirement scheduler, subscriptions, pauses, stock correctness & archive</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'analytics' && (
            <div className="input-with-icon">
              <MdCalendarToday className="input-icon" />
              <input id="reports-date" type="date" className="form-input" style={{ paddingLeft: 36 }} value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleTopRefresh}>
            <MdRefresh className={loading || archivedLoading || adhocLoading || scReportLoading || milkReqLoading || subLoading || pauseLoading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '10px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('analytics')}
          >
            <MdAnalytics /> Analytics & Metrics
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'milk-requirement' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('milk-requirement')}
            id="reports-tab-milk-requirement"
          >
            <MdLocalDrink /> Daily Milk Requirement
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'subscription-status' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('subscription-status')}
            id="reports-tab-subscription-status"
          >
            <MdSchedule /> Subscription Status & Schedules
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'pause-impact' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pause-impact')}
            id="reports-tab-pause-impact"
          >
            <MdPauseCircleOutline /> Pause Impact & Schedules
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'stock-correctness-reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('stock-correctness-reports')}
            id="reports-tab-stock-correctness"
            style={{ background: activeTab === 'stock-correctness-reports' ? 'linear-gradient(135deg, #10b981, #059669)' : '', borderColor: activeTab === 'stock-correctness-reports' ? '#10b981' : '' }}
          >
            <MdCheckCircle /> Stock Correctness Reports
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'adhoc-reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('adhoc-reports')}
            id="reports-tab-adhoc"
            style={{ background: activeTab === 'adhoc-reports' ? 'linear-gradient(135deg, #d97706, #b45309)' : '', borderColor: activeTab === 'adhoc-reports' ? '#d97706' : '' }}
          >
            <MdInventory2 /> AdHoc Product Reports
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'inventory-reports' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('inventory-reports')}
            id="reports-tab-inventory"
          >
            <MdInventory2 /> Inventory Reports Archive
          </button>
        </div>
      </div>

      {/* ── TAB 1: ANALYTICS & METRICS ── */}
      {activeTab === 'analytics' && (
        <div>
          {/* Daily Summary */}
          <p className="section-title" style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>DAILY SUMMARY — {date}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: "Today's Revenue", value: `₹${parseFloat(d?.payments?.total || 0).toLocaleString('en-IN')}`, color: '#10b981' },
              { label: 'Deliveries', value: `${d?.deliveries?.delivered || 0} / ${d?.deliveries?.total || 0}`, color: '#3b82f6' },
              { label: 'Wallet Recharge', value: `₹${parseFloat(d?.wallet_recharge || 0).toLocaleString('en-IN')}`, color: '#8b5cf6' },
              { label: 'New Customers', value: d?.new_customers || 0, color: '#f59e0b' },
            ].map(card => (
              <motion.div key={card.label} className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="card-body" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: card.color, marginBottom: 4 }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{card.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Delivery Status Pie + Revenue Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Delivery Status Today</span></div>
              <div className="card-body" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Delivered', value: d?.deliveries?.delivered || 0 },
                        { name: 'Pending', value: d?.deliveries?.pending || 0 },
                        { name: 'Missed', value: d?.deliveries?.missed || 0 },
                      ]}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {['#10b981', '#f59e0b', '#ef4444'].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Daily Revenue Trend</span></div>
              <div className="card-body" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m?.daily_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Products + Customer Analysis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Top Products by Quantity</span></div>
              <div className="card-body" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d?.top_products || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="product_name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total_quantity" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Customer Performance Breakdown</span></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Active Subscriptions', val: customerAnalysis?.active_subscriptions || 0, color: 'var(--primary)' },
                    { label: 'Wallet Negative Balances', val: customerAnalysis?.negative_balance_customers || 0, color: '#ef4444' },
                    { label: 'Avg Monthly Spend', val: `₹${parseFloat(customerAnalysis?.avg_monthly_spend || 0).toFixed(0)}`, color: '#8b5cf6' },
                    { label: 'Retention Rate', val: `${customerAnalysis?.retention_rate || 92}%`, color: '#10b981' },
                  ].map(stat => (
                    <div key={stat.label} style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.val}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Manager App Inventory Reconciliation Card */}
          {managerInvData && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdStorefront style={{ color: 'var(--primary)' }} /> Manager App Stock Reconciliation (DB2)
                </span>
                <span className="badge badge-success" style={{ fontSize: 11 }}>Read-Only Live Sync</span>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Variant</th>
                      <th>Route</th>
                      <th>Expected Stock</th>
                      <th>Actual Logged</th>
                      <th>Variance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(managerInvData.items || []).length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No manager inventory logs recorded for {date}.</td></tr>
                    ) : (
                      managerInvData.items.map(row => (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 700 }}>{row.product_name}</td>
                          <td>{row.variant || 'Standard'}</td>
                          <td>{row.route_name || 'Main Route'}</td>
                          <td style={{ fontWeight: 600 }}>{row.expected_qty}</td>
                          <td style={{ fontWeight: 600 }}>{row.actual_qty}</td>
                          <td style={{ fontWeight: 700, color: row.variance < 0 ? '#ef4444' : row.variance > 0 ? '#10b981' : 'inherit' }}>
                            {row.variance > 0 ? `+${row.variance}` : row.variance}
                          </td>
                          <td>
                            <span className={`badge ${row.status === 'MATCH' ? 'badge-success' : 'badge-warning'}`}>{row.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: DAILY MILK REQUIREMENT ── */}
      {activeTab === 'milk-requirement' && (
        <div>
          {/* Controls Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdLocalDrink style={{ color: 'var(--primary)', fontSize: 18 }} /> Target Operational Date:
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 160 }}
                  value={milkReqDate}
                  onChange={e => setMilkReqDate(e.target.value)}
                />
                <button className="btn btn-primary btn-sm" onClick={fetchMilkRequirement} disabled={milkReqLoading}>
                  <MdRefresh className={milkReqLoading ? 'spin' : ''} /> {milkReqLoading ? 'Calculating...' : 'Recalculate Requirements'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleExportMilkReqPdf}
                  disabled={!milkReqData || !milkReqData.products || milkReqData.products.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    opacity: (!milkReqData || !milkReqData.products || milkReqData.products.length === 0) ? 0.5 : 1,
                    cursor: (!milkReqData || !milkReqData.products || milkReqData.products.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdPictureAsPdf style={{ fontSize: 15 }} /> Export to PDF
                </button>

                <button
                  className="btn btn-success btn-sm"
                  onClick={handleExportMilkReqExcel}
                  disabled={!milkReqData || !milkReqData.products || milkReqData.products.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    opacity: (!milkReqData || !milkReqData.products || milkReqData.products.length === 0) ? 0.5 : 1,
                    cursor: (!milkReqData || !milkReqData.products || milkReqData.products.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 15 }} /> Export to Excel
                </button>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {milkReqData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary)' }}>{milkReqData.totalScheduledCustomers}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>Scheduled Customers</div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>{milkReqData.totalMilkLiters} L</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>Total Milk Liters Required</div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#3b82f6' }}>{milkReqData.totalOtherUnits} Units</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>Other Product Units</div>
                </div>
              </div>
              <div className="card">
                <div className="card-body" style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>{(milkReqData.products || []).length}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>Distinct Products</div>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdLocalDrink style={{ color: 'var(--primary)' }} /> Product Procurement Breakdown — {milkReqData?.date || milkReqDate || date}
              </span>
              <span className="badge badge-info" style={{ fontSize: 11 }}>Computed Authoritatively by Subscription Scheduler</span>
            </div>
            <div className="table-wrapper">
              {milkReqLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <span className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
                  <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>Calculating milk and product requirements for {milkReqDate}...</div>
                </div>
              ) : !milkReqData || (milkReqData.products || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No customer deliveries scheduled for {milkReqDate || date}.
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Total Quantity Scheduled</th>
                      <th style={{ textAlign: 'right' }}>Customer Count</th>
                      <th>Delivery Boys Allocation</th>
                      <th>Hubs Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milkReqData.products.map((p, idx) => (
                      <tr key={p.productId || idx}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.productName}</td>
                        <td>
                          <span className={`badge ${(p.category || '').toLowerCase().includes('milk') ? 'badge-primary' : 'badge-gray'}`}>
                            {p.category || 'Milk'}
                          </span>
                        </td>
                        <td>{p.unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: (p.category || '').toLowerCase().includes('milk') ? '#10b981' : 'var(--primary)' }}>
                          {p.totalQuantity} {p.unit}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.customerCount}</td>
                        <td style={{ fontSize: 12 }}>
                          {Object.keys(p.deliveryPersons || {}).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                          ) : (
                            Object.entries(p.deliveryPersons).map(([dp, q]) => (
                              <span key={dp} className="badge badge-gray" style={{ marginRight: 4, marginBottom: 2 }}>
                                {dp}: {q}
                              </span>
                            ))
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {Object.keys(p.hubs || {}).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>Default</span>
                          ) : (
                            Object.entries(p.hubs).map(([hub, q]) => (
                              <span key={hub} className="badge badge-info" style={{ marginRight: 4, marginBottom: 2 }}>
                                {hub}: {q}
                              </span>
                            ))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SUBSCRIPTION STATUS & SCHEDULES ── */}
      {activeTab === 'subscription-status' && (
        <div>
          {/* Controls Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
                <div style={{ minWidth: 260, maxWidth: 340 }}>
                  <CustomerSearchSelector
                    value={subCustomerFilter}
                    onChange={(val) => { setSubCustomerFilter(val); setSubPage(1); }}
                    placeholder="Search by name, code, phone..."
                    allowAll={true}
                    allLabel="[ All Customers ]"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Status:</label>
                  <select
                    className="form-select"
                    style={{ width: 130, height: 38, fontSize: 13 }}
                    value={subStatusFilter}
                    onChange={e => { setSubStatusFilter(e.target.value); setSubPage(1); }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Frequency:</label>
                  <select
                    className="form-select"
                    style={{ width: 150, height: 38, fontSize: 13 }}
                    value={subFrequencyFilter}
                    onChange={e => { setSubFrequencyFilter(e.target.value); setSubPage(1); }}
                  >
                    <option value="All">All Frequencies</option>
                    <option value="DAILY">Daily</option>
                    <option value="ALTERNATE_DAY">Alternate Day</option>
                    <option value="CUSTOM_WEEKLY">Custom Weekly</option>
                  </select>
                </div>

                <button className="btn btn-primary btn-sm" onClick={() => fetchSubscriptionStatus(1)} disabled={subLoading}>
                  <MdRefresh className={subLoading ? 'spin' : ''} /> Filter
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleExportSubStatusPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <MdPictureAsPdf style={{ fontSize: 15 }} /> Export to PDF
                </button>

                <button
                  className="btn btn-success btn-sm"
                  onClick={handleExportSubStatusExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 15 }} /> Export to Excel
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdSchedule style={{ color: 'var(--primary)' }} /> Subscriptions & Schedules List
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Total Records: <strong>{subData?.totalRecords || 0}</strong>
              </span>
            </div>

            <div className="table-wrapper">
              {subLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <span className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
                  <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>Loading subscriptions...</div>
                </div>
              ) : !subData || (subData.rows || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No subscriptions match the selected filters.
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer Code & Name</th>
                      <th>Phone</th>
                      <th>Frequency / Schedule Pattern</th>
                      <th>Products & Quantities</th>
                      <th>Hub & Delivery Boy</th>
                      <th>Status</th>
                      <th>Active Pause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subData.rows.map((row) => (
                      <tr key={row.subscription_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.customer_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Code: {row.customer_code || '-'}</div>
                        </td>
                        <td style={{ fontSize: 12.5 }}>{row.customer_phone || '-'}</td>
                        <td>
                          <span className="badge badge-primary" style={{ fontSize: 11 }}>
                            {row.frequency_type || 'DAILY'}
                          </span>
                          {row.frequency_type === 'ALTERNATE_DAY' && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              Anchor: {row.alternate_anchor_date || '-'}
                            </div>
                          )}
                          {row.frequency_type === 'CUSTOM_WEEKLY' && row.custom_weekdays && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              Days: {row.custom_weekdays.join(', ')}
                            </div>
                          )}
                        </td>
                        <td>
                          {(row.items || []).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No Active Items</span>
                          ) : (
                            (row.items || []).map((it, idx) => (
                              <div key={idx} style={{ fontSize: 12, marginBottom: 2 }}>
                                <strong>{it.product_name}</strong>: {it.quantity} {it.unit || ''}
                              </div>
                            ))
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 12 }}>Hub: <strong>{row.hub || 'Default'}</strong></div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DP: {row.delivery_person_name || 'Unassigned'}</div>
                        </td>
                        <td>
                          <span className={`badge ${row.status === 'Active' ? 'badge-success' : row.status === 'Paused' ? 'badge-warning' : 'badge-danger'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>
                          {row.active_pause ? (
                            <div>
                              <span className="badge badge-warning" style={{ fontSize: 10 }}>Currently Paused</span>
                              <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>
                                {row.active_pause.pause_start_date} → {row.active_pause.pause_end_date}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {subData && subData.totalPages > 1 && (
              <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Page {subData.page} of {subData.totalPages} ({subData.totalRecords} records)
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={subData.page <= 1}
                    onClick={() => { const p = subData.page - 1; setSubPage(p); fetchSubscriptionStatus(p); }}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={subData.page >= subData.totalPages}
                    onClick={() => { const p = subData.page + 1; setSubPage(p); fetchSubscriptionStatus(p); }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: PAUSE IMPACT & SCHEDULES ── */}
      {activeTab === 'pause-impact' && (
        <div>
          {/* Controls Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
                <div style={{ minWidth: 240, maxWidth: 320 }}>
                  <CustomerSearchSelector
                    value={pauseCustomerFilter}
                    onChange={(val) => { setPauseCustomerFilter(val); setPausePage(1); }}
                    placeholder="Search by name, code, phone..."
                    allowAll={true}
                    allLabel="[ All Customers ]"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Status:</label>
                  <select
                    className="form-select"
                    style={{ width: 140, height: 38, fontSize: 13 }}
                    value={pauseStatusFilter}
                    onChange={e => { setPauseStatusFilter(e.target.value); setPausePage(1); }}
                  >
                    <option value="All">All Pauses</option>
                    <option value="Active">Currently Paused</option>
                    <option value="Upcoming">Upcoming Pause</option>
                    <option value="Completed">Completed / Resumed</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From:</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 140, height: 38 }}
                    value={pauseDateFrom}
                    onChange={e => { setPauseDateFrom(e.target.value); setPausePage(1); }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To:</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 140, height: 38 }}
                    value={pauseDateTo}
                    onChange={e => { setPauseDateTo(e.target.value); setPausePage(1); }}
                  />
                </div>

                <button className="btn btn-primary btn-sm" onClick={() => fetchPauseImpact(1)} disabled={pauseLoading}>
                  <MdRefresh className={pauseLoading ? 'spin' : ''} /> Filter
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleExportPauseImpactPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <MdPictureAsPdf style={{ fontSize: 15 }} /> Export to PDF
                </button>

                <button
                  className="btn btn-success btn-sm"
                  onClick={handleExportPauseImpactExcel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 15 }} /> Export to Excel
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdPauseCircleOutline style={{ color: '#d97706' }} /> Subscription Pause Impact & Schedules
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Total Records: <strong>{pauseData?.totalRecords || 0}</strong>
              </span>
            </div>

            <div className="table-wrapper">
              {pauseLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <span className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
                  <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>Loading pause records...</div>
                </div>
              ) : !pauseData || (pauseData.rows || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No pause records match the selected filters.
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer Code & Name</th>
                      <th>Phone</th>
                      <th>Pause Window</th>
                      <th>Pause Status</th>
                      <th>Reason</th>
                      <th>Impacted Product Lines</th>
                      <th>Hub & DP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pauseData.rows.map((row) => (
                      <tr key={row.pause_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.customer_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Code: {row.customer_code || '-'}</div>
                        </td>
                        <td style={{ fontSize: 12.5 }}>{row.customer_phone || '-'}</td>
                        <td style={{ fontSize: 12.5, fontWeight: 700 }}>
                          {row.pause_start_date} → {row.pause_end_date}
                        </td>
                        <td>
                          <span className={`badge ${
                            row.pause_status === 'Currently Paused' ? 'badge-warning' :
                            row.pause_status === 'Upcoming Pause' ? 'badge-primary' : 'badge-gray'
                          }`}>
                            {row.pause_status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.reason || 'Not Specified'}</td>
                        <td>
                          {(row.paused_items || []).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>All Lines</span>
                          ) : (
                            (row.paused_items || []).map((it, idx) => (
                              <div key={idx} style={{ fontSize: 12, marginBottom: 2 }}>
                                <strong>{it.product_name}</strong>: {it.quantity} {it.unit || ''}
                              </div>
                            ))
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: 12 }}>Hub: <strong>{row.hub || 'Default'}</strong></div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DP: {row.delivery_person_name || 'Unassigned'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {pauseData && pauseData.totalPages > 1 && (
              <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Page {pauseData.page} of {pauseData.totalPages} ({pauseData.totalRecords} records)
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={pauseData.page <= 1}
                    onClick={() => { const p = pauseData.page - 1; setPausePage(p); fetchPauseImpact(p); }}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={pauseData.page >= pauseData.totalPages}
                    onClick={() => { const p = pauseData.page + 1; setPausePage(p); fetchPauseImpact(p); }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: STOCK CORRECTNESS REPORTS ── */}
      {activeTab === 'stock-correctness-reports' && (
        <div className="card">
          <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.02))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <span className="card-title" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdCheckCircle style={{ fontSize: 22 }} /> STOCK CORRECTNESS REPORT SYSTEM
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Daily, monthly & custom date range stock reconciliation reports for Milk products
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
                <button
                  className={`btn btn-sm ${scReportMode === 'daily' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scReportMode === 'daily' ? '#10b981' : 'transparent', border: 'none', color: scReportMode === 'daily' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScReportMode('daily')}
                >
                  Daily Report
                </button>
                <button
                  className={`btn btn-sm ${scReportMode === 'monthly' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scReportMode === 'monthly' ? '#10b981' : 'transparent', border: 'none', color: scReportMode === 'monthly' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScReportMode('monthly')}
                >
                  Monthly Report
                </button>
                <button
                  className={`btn btn-sm ${scReportMode === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scReportMode === 'custom' ? '#10b981' : 'transparent', border: 'none', color: scReportMode === 'custom' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScReportMode('custom')}
                >
                  Custom Date Range
                </button>
              </div>

              {scReportMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={scReportStartDate} onChange={e => setScReportStartDate(e.target.value)} />
                  <span style={{ fontSize: 12 }}>to</span>
                  <input type="date" className="form-input" style={{ fontSize: 12, padding: '4px 8px' }} value={scReportEndDate} onChange={e => setScReportEndDate(e.target.value)} />
                </div>
              )}

              <button className="btn btn-secondary btn-sm" onClick={fetchStockCorrectnessReports} disabled={scReportLoading}>
                <MdRefresh className={scReportLoading ? 'spin' : ''} /> {scReportLoading ? 'Loading...' : 'Generate'}
              </button>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleExportScPdf}
                  disabled={!scReportData || !scReportData.data || scReportData.data.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    opacity: (!scReportData || !scReportData.data || scReportData.data.length === 0) ? 0.5 : 1,
                    cursor: (!scReportData || !scReportData.data || scReportData.data.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdPictureAsPdf style={{ fontSize: 14 }} /> Export to PDF
                </button>

                <button
                  className="btn btn-success btn-sm"
                  onClick={handleExportScExcel}
                  disabled={!scReportData || !scReportData.data || scReportData.data.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: '6px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    opacity: (!scReportData || !scReportData.data || scReportData.data.length === 0) ? 0.5 : 1,
                    cursor: (!scReportData || !scReportData.data || scReportData.data.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 14 }} /> Export to Excel
                </button>
              </div>
            </div>
          </div>

          <div className="table-wrapper" style={{ padding: '16px 20px' }}>
            {scReportLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>Generating Stock Correctness Report...</div>
            ) : !scReportData || scReportData.totalRecords === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No stock correctness report records found for the selected period.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Operational Day</th>
                    <th>Product Name</th>
                    <th>Expected Stock</th>
                    <th>Manager Logged Stock</th>
                    <th>Difference</th>
                    <th>Status</th>
                    <th>Review Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {scReportData.data.map((row, idx) => (
                    <tr key={row.id || idx}>
                      <td style={{ fontWeight: 800 }}>{row.operationalDay}</td>
                      <td style={{ fontWeight: 700 }}>{row.productName}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{row.expectedStock}</td>
                      <td style={{ fontWeight: 700 }}>{row.managerLoggedStock !== null ? row.managerLoggedStock : <span style={{ color: '#d97706', fontStyle: 'italic' }}>Not Logged</span>}</td>
                      <td style={{ fontWeight: 800, color: row.difference < 0 ? '#ef4444' : row.difference > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {row.difference > 0 ? `+${row.difference}` : row.difference}
                      </td>
                      <td>
                        <span className={`badge ${row.status === 'Correct' ? 'badge-success' : row.status === 'Mismatch' ? 'badge-danger' : 'badge-warning'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${row.reviewStatus === 'Resolved' ? 'badge-success' : row.reviewStatus === 'Reviewed' ? 'badge-warning' : 'badge-danger'}`}>
                          {row.reviewStatus || 'Pending Review'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {row.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 6: ADHOC PRODUCT REPORTS ── */}
      {activeTab === 'adhoc-reports' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {/* Controls Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Report Mode:</label>
                  <select
                    className="form-input"
                    style={{ width: 140 }}
                    value={adhocReportMode}
                    onChange={e => setAdhocReportMode(e.target.value)}
                  >
                    <option value="daily">Daily Report</option>
                    <option value="monthly">Monthly Report</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>

                {adhocReportMode === 'daily' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Target Date:</label>
                    <input type="date" className="form-input" style={{ width: 150 }} value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                )}

                {adhocReportMode === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" className="form-input" value={adhocReportStartDate} onChange={e => setAdhocReportStartDate(e.target.value)} />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input type="date" className="form-input" value={adhocReportEndDate} onChange={e => setAdhocReportEndDate(e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleExportAdhocPdf}
                  disabled={!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0}
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
                    opacity: (!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0) ? 0.5 : 1,
                    cursor: (!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdPictureAsPdf style={{ fontSize: 16 }} /> Export to PDF
                </button>

                <button
                  className="btn btn-success btn-sm"
                  onClick={handleExportAdhocExcel}
                  disabled={!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0}
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
                    opacity: (!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0) ? 0.5 : 1,
                    cursor: (!adhocReportData || !adhocReportData.dpSalesAudit || adhocReportData.dpSalesAudit.length === 0) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <MdFileDownload style={{ fontSize: 16 }} /> Export to Excel
                </button>
              </div>
            </div>
          </div>

          {/* AdHoc Stats Overview */}
          {adhocReportData && adhocReportData.totals && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{adhocReportData.totals.totalTaken || 0}</div>
                <div className="stat-label">Total Qty Taken</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success)' }}>{adhocReportData.totals.totalSold || 0}</div>
                <div className="stat-label">Total Qty Sold</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{adhocReportData.totals.totalReturned || 0}</div>
                <div className="stat-label">Total Qty Returned</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#d97706' }}>₹{(adhocReportData.totals.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div className="stat-label">Total AdHoc Revenue</div>
              </div>
            </div>
          )}

          {/* Central AdHoc Inventory Table */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(245,158,11,0.02))' }}>
              <span className="card-title" style={{ color: '#d97706' }}>Central AdHoc Inventory Summary</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Packing Type</th>
                    <th>Opening</th>
                    <th>Added</th>
                    <th>DP Issued</th>
                    <th>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(adhocReportData?.centralSummary || []).length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No central AdHoc inventory data.</td></tr>
                  ) : (
                    adhocReportData.centralSummary.map(row => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td><span className="badge badge-gray">{row.packing_type || ((row.unit || '').toLowerCase().includes('packet') || (row.name || '').toLowerCase().includes('packet') ? 'Packet' : 'Bottle')}</span></td>
                        <td>{row.openingStock} {row.unit}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>+{row.addedStock}</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 700 }}>{row.dpIssuedStock}</td>
                        <td style={{ fontWeight: 800 }}>{row.remainingStock} {row.unit}</td>
                        <td><span className="badge badge-warning">{row.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DP AdHoc Sales Audit Breakdown Table */}
          <div className="card">
            <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(245,158,11,0.02))' }}>
              <span className="card-title" style={{ color: '#d97706' }}>Delivery Person (DP) AdHoc Sales Breakdown</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>DP Name</th>
                    <th>Route</th>
                    <th>Product</th>
                    <th>Taken</th>
                    <th>Sold</th>
                    <th>Returned</th>
                    <th>Remaining</th>
                    <th>Sales Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(adhocReportData?.dpSalesAudit || []).length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No DP AdHoc sales records for this period.</td></tr>
                  ) : (
                    adhocReportData.dpSalesAudit.map(row => (
                      <tr key={row.id}>
                        <td>{row.date}</td>
                        <td style={{ fontWeight: 700 }}>{row.dp_name}</td>
                        <td><span className="badge badge-gray">{row.route_name}</span></td>
                        <td style={{ fontWeight: 600 }}>{row.product_name}</td>
                        <td>{row.quantity_taken}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 800 }}>{row.quantity_sold}</td>
                        <td style={{ color: 'var(--warning)' }}>{row.quantity_returned}</td>
                        <td>{row.quantity_remaining}</td>
                        <td style={{ fontWeight: 800, color: '#d97706' }}>₹{parseFloat(row.total_sales_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB 7: INVENTORY REPORTS ARCHIVE ── */}
      {activeTab === 'inventory-reports' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdInventory2 style={{ color: 'var(--primary)' }} /> Inventory Reports Archive
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                All generated 3-sheet Inventory Excel reports saved for Super Admin audit & download
              </p>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ width: 160 }}
                value={reportFilterType}
                onChange={e => setReportFilterType(e.target.value)}
              >
                <option value="Inventory Report">Category: Inventory Report</option>
                <option value="">All Categories</option>
              </select>

              <select
                className="form-select"
                style={{ width: 130 }}
                value={reportFilterFormat}
                onChange={e => setReportFilterFormat(e.target.value)}
              >
                <option value="">Format: All</option>
                <option value="Excel">Excel (.xlsx)</option>
              </select>

              <div className="input-with-icon" style={{ width: 160 }}>
                <MdSearch className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search name..."
                  style={{ paddingLeft: 34 }}
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                />
              </div>

              <button className="btn btn-primary btn-sm" onClick={fetchArchivedReports}>
                <MdFilterList /> Filter
              </button>

              <button
                className="btn btn-sm btn-success"
                onClick={handleGenerateReportDirect}
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <MdFileDownload style={{ fontSize: 16 }} /> Generate & Download Report
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {archivedLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <span className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
              </div>
            ) : archivedReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                <MdGridOn style={{ fontSize: 44, color: 'var(--text-muted)', opacity: 0.4, marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>No Archived Inventory Reports Found</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Generate an Inventory report from the Inventory Management page to view and re-download it here.
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Report Name</th>
                      <th>Category</th>
                      <th>Period</th>
                      <th>Format</th>
                      <th>Status</th>
                      <th>Generated By</th>
                      <th>Generated Date</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedReports.map((report) => (
                      <tr key={report.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                            {report.report_name || `Maram_Milk_Inventory_Report_${report.date_from}.xlsx`}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {report.id}</div>
                        </td>
                        <td>
                          <span className="badge badge-primary" style={{ fontSize: 11 }}>
                            {report.report_type}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                          {report.date_from === report.date_to
                            ? report.date_from
                            : `${report.date_from} → ${report.date_to}`}
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: 11, background: '#dcfce7', color: '#15803d' }}>
                            {report.format || 'Excel'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MdCheckCircle /> {report.status || 'Ready'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {report.generated_by || admin?.name || 'Sarfaraz Ahmed'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(report.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleDownloadArchived(report)}
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 600 }}
                          >
                            <MdDownload /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
