import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MdInventory, MdAdd, MdHistory, MdWarningAmber,
  MdCheckCircle, MdErrorOutline, MdRefresh, MdSearch,
  MdFilterList, MdEdit, MdSync, MdOutlineAssignmentReturn,
  MdClose, MdLocalShipping, MdQrCode, MdStickyNote2,
  MdCalendarToday, MdCancel, MdPerson,
  MdVerified, MdWarning, MdSave, MdBusiness,
  MdInventory2, MdFlashOn, MdStorefront, MdDateRange,
  MdDownload, MdFileDownload, MdFactCheck,
  MdLocalDrink, MdKitchen, MdOpacity, MdEco, MdShoppingCart
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useOperationalDay from '../../hooks/useOperationalDay';
import '../../pages/RouteIntelligence/components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function InventoryPage() {
  const location = useLocation();
  const { admin } = useAuthStore();
  const isSuperAdmin = (admin?.email || '').toLowerCase() === 'admin@marammilk.com' ||
                       admin?.role === 'SuperAdmin' || admin?.role === 'Super Admin';

  // Get active operational day from backend (7:00 PM IST boundary — source of truth)
  const { operationalDate, displayDate: opDisplayDate, loading: opDayLoading } = useOperationalDay();

  const [activeTab, setActiveTab]         = useState('inventory'); // 'inventory' | 'history' | 'manager-inventory' | 'stock-correctness'
  const [items, setItems]                 = useState([]);
  const [adhocItems, setAdhocItems]       = useState([]);

  const [summary, setSummary]             = useState({ totalStock: 0, todayAddedStock: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: 0 });
  const [lowStockAlerts, setLowAlerts]   = useState([]);
  const [history, setHistory]             = useState([]);
  const [historyTotal, setHistoryTotal]   = useState(0);
  // selectedDate starts empty; seeded from operationalDate once loaded
  const [selectedDate, setSelectedDate]   = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [historyLoading, setHistoryLoad] = useState(false);
  const [search, setSearch]               = useState('');
  const [historySearch, setHistSearch]    = useState('');
  const [isDb2Synced, setIsDb2Synced]     = useState(true);

  // Stock Correctness State
  const [scSubTab, setScSubTab]                     = useState('today'); // 'today' | 'history'
  const [scData, setScData]                         = useState(null);
  const [scLoading, setScLoading]                   = useState(false);
  const [scHistory, setScHistory]                   = useState([]);
  const [scHistoryLoading, setScHistoryLoading]     = useState(false);
  const [scSelectedHistory, setScSelectedHistory]   = useState(null);
  const [scHistoryDetailLoading, setScHistoryDetailLoading] = useState(false);
  const [showReviewModal, setShowReviewModal]       = useState(false);
  const [reviewItem, setReviewItem]                 = useState(null);
  const [reviewForm, setReviewForm]                 = useState({ reviewStatus: 'Reviewed', remarks: '' });
  const [submittingReview, setSubmittingReview]     = useState(false);

  // Manager Inventory State
  const [managerInvData, setManagerInvData]       = useState(null);
  const [adhocDpSales, setAdhocDpSales]           = useState([]);
  const [managerInvLoading, setManagerInvLoading] = useState(false);
  const [miDate, setMiDate]                       = useState('');
  const [miStartDate, setMiStartDate]             = useState('');
  const [miEndDate, setMiEndDate]                 = useState('');
  const [miRangeMode, setMiRangeMode]             = useState(false);

  // Download Report Modal State
  const [showReportModal, setShowReportModal]     = useState(false);
  const [reportMode, setReportMode]               = useState('today'); // 'today' | 'custom'
  const [reportDate, setReportDate]               = useState('');
  const [reportStartDate, setReportStartDate]     = useState('');
  const [reportEndDate, setReportEndDate]         = useState('');
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Seed all default date states from backend operational day once loaded
  useEffect(() => {
    if (!opDayLoading && operationalDate) {
      setSelectedDate(prev => prev || operationalDate);
      setMiDate(prev => prev || operationalDate);
      setReportDate(prev => prev || operationalDate);
    }
  }, [operationalDate, opDayLoading]);

  // Stock Add/Update Modals
  const [showAddModal, setShowAddModal]       = useState(false);
  const [selectedModalItem, setSelectedModalItem] = useState(null); // specific item when clicked from table row
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [showDb2UpdateModal, setShowDb2UpdateModal] = useState(null); // DB2 specific modal item
  const [db2Form, setDb2Form]                 = useState({ newStockAdded: 0, currentStock: 0 });
  const [confirmDialog, setConfirmDialog]     = useState(null);
  // Adhoc Override Modal
  const [showAdhocOverrideModal, setShowAdhocOverrideModal] = useState(null); // adhoc item
  const [adhocOverrideForm, setAdhocOverrideForm] = useState({ openingStock: 0, addedStock: 0, dpIssuedStock: 0, remainingStock: 0, remarks: '' });

  // Form State for Add Stock
  const [addForm, setAddForm] = useState({
    inventoryItemId: '',
    quantityAdded: '',
    unit: 'Litres',
    supplier: '',
    batchNumber: '',
    remarks: '',
  });

  // Form State for Correct Stock
  const [correctForm, setCorrectForm] = useState({
    inventoryItemId: '',
    newTotalStock: '',
    remarks: '',
  });

  const [submitting, setSubmitting] = useState(false);

  // Download Official Inventory Excel Report Handler
  const handleDownloadReport = async (e) => {
    if (e) e.preventDefault();
    if (reportMode === 'custom' && (!reportStartDate || !reportEndDate)) {
      return toast.error('Please select both Start Date and End Date for custom date range');
    }
    setDownloadingReport(true);
    try {
      const params = reportMode === 'custom'
        ? { mode: 'custom', startDate: reportStartDate, endDate: reportEndDate, generatedBy: admin?.name || 'Super Admin' }
        : { mode: 'today', date: reportDate, generatedBy: admin?.name || 'Super Admin' };

      const res = await api.get('/inventory/download-report', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let fileName = reportMode === 'custom'
        ? `Maram_Milk_Inventory_Report_${reportStartDate}_to_${reportEndDate}.xlsx`
        : `Maram_Milk_Inventory_Report_${reportDate}.xlsx`;

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

      toast.success('Inventory Excel report generated and downloaded successfully!');
      setShowReportModal(false);
    } catch (err) {
      console.error('Report download error:', err);
      toast.error('Failed to generate Inventory Excel report.');
    } finally {
      setDownloadingReport(false);
    }
  };

  // Custom Product Sorting Helper (1L Bottle, 500ml Bottle / Half Litre Bottle, 500ml Packet)
  const getItemPriority = (item) => {
    const name = (item?.name || '').toLowerCase();
    const material = (item?.material || '').toLowerCase();
    const unit = (item?.unit || '').toLowerCase();

    if (name.includes('1l bottle') || (name.includes('1l') && (name.includes('bottle') || material.includes('bottle')))) return 1;
    if (
      name.includes('half litre bottle') ||
      name.includes('500ml bottle') ||
      name.includes('500 ml bottle') ||
      (material.includes('bottle') && (name.includes('500') || name.includes('half') || unit.includes('500')))
    ) return 2;
    if (
      name.includes('500ml packet') ||
      name.includes('500 ml packet') ||
      (material.includes('packet') && (name.includes('500') || name.includes('half') || unit.includes('500')))
    ) return 3;

    return 4;
  };

  // Fetch Inventory (incorporating DB2 Manager App Stock fields & AdHoc Central Stock for categories)
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [res, adhocRes] = await Promise.all([
        api.get('/inventory', { params: { date: selectedDate } }),
        api.get('/inventory/adhoc/central', { params: { date: selectedDate } }).catch(() => ({ data: { data: [] } }))
      ]);

      if (res.data?.success) {
        const rawData = res.data.data || [];
        const sortedData = [...rawData].sort((a, b) => getItemPriority(a) - getItemPriority(b));
        setItems(sortedData);
        if (res.data.summary) setSummary(res.data.summary);
        if (res.data.lowStockAlerts) setLowAlerts(res.data.lowStockAlerts);
        if (res.data.availableDates) setAvailableDates(res.data.availableDates);
        setIsDb2Synced(true);
      }
      if (adhocRes.data?.success) {
        setAdhocItems(adhocRes.data.data || []);
      }
    } catch {
      toast.error('Failed to load inventory stock.');
      setIsDb2Synced(false);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch Stock History Ledger
  const fetchHistory = useCallback(async () => {
    setHistoryLoad(true);
    try {
      const res = await api.get('/inventory/history', { params: { search: historySearch, limit: 50 } });
      if (res.data?.success) {
        setHistory(res.data.data || []);
        setHistoryTotal(res.data.total || 0);
      }
    } catch (err) {
      console.warn('Failed to load stock history:', err.message);
    } finally {
      setHistoryLoad(false);
    }
  }, [historySearch]);

  // Fetch Manager Inventory (ShopSale + ManagerInventoryLog from DB2 + DP AdHoc Sales)
  const fetchManagerInventory = useCallback(async () => {
    setManagerInvLoading(true);
    try {
      const params = miRangeMode && miStartDate && miEndDate
        ? { startDate: miStartDate, endDate: miEndDate }
        : { date: miDate };
      const [res, adhocDpRes] = await Promise.all([
        api.get('/inventory/manager-inventory', { params }),
        api.get('/inventory/adhoc/dp-stock', { params: { date: miDate } }).catch(() => ({ data: { data: [] } }))
      ]);

      if (res.data?.success) {
        setManagerInvData(res.data);
      }
      if (adhocDpRes.data?.success) {
        setAdhocDpSales(adhocDpRes.data.data || []);
      }
    } catch {
      toast.error('Failed to load Manager Inventory data.');
    } finally {
      setManagerInvLoading(false);
    }
  }, [miDate, miStartDate, miEndDate, miRangeMode]);

  // Fetch Stock Correctness (Milk Products Only)
  const fetchStockCorrectnessToday = useCallback(async () => {
    setScLoading(true);
    try {
      const res = await api.get('/stock-correctness/today', { params: { date: selectedDate } });
      if (res.data?.success) {
        setScData(res.data.data);
      }
    } catch {
      toast.error('Failed to load Stock Correctness data.');
    } finally {
      setScLoading(false);
    }
  }, [selectedDate]);

  const fetchStockCorrectnessHistory = useCallback(async () => {
    setScHistoryLoading(true);
    try {
      const res = await api.get('/stock-correctness/history');
      if (res.data?.success) {
        setScHistory(res.data.data || []);
      }
    } catch {
      /* silent */
    } finally {
      setScHistoryLoading(false);
    }
  }, []);

  const fetchStockCorrectnessDetail = async (histDate) => {
    setScHistoryDetailLoading(true);
    try {
      const res = await api.get(`/stock-correctness/history/${histDate}`);
      if (res.data?.success) {
        setScSelectedHistory(res.data.data);
      }
    } catch {
      toast.error('Failed to load history detail.');
    } finally {
      setScHistoryDetailLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewItem || !reviewForm.reviewStatus) return;
    setSubmittingReview(true);
    try {
      const res = await api.post('/stock-correctness/review', {
        operationalDay: scData?.operationalDay || selectedDate,
        productId: reviewItem.productId,
        reviewStatus: reviewForm.reviewStatus,
        remarks: reviewForm.remarks,
        reviewedBy: admin?.name || 'Super Admin',
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Review status updated!');
        setShowReviewModal(false);
        setReviewItem(null);
        fetchStockCorrectnessToday();
        if (scSubTab === 'history') fetchStockCorrectnessHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update review status.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // URL query parameter listener for ?tab=stock-correctness
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'stock-correctness' || tabParam === 'correctness') {
      setActiveTab('stock-correctness');
    }
  }, [location.search]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    else if (activeTab === 'manager-inventory') fetchManagerInventory();
    else if (activeTab === 'stock-correctness') {
      if (scSubTab === 'today') fetchStockCorrectnessToday();
      else if (scSubTab === 'history') fetchStockCorrectnessHistory();
    }
  }, [activeTab, scSubTab, fetchHistory, fetchManagerInventory, fetchStockCorrectnessToday, fetchStockCorrectnessHistory]);

  // DB2 Direct Stock Override Handler
  const handleDb2Update = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/inventory/update', {
        inventoryItemId: showDb2UpdateModal.id,
        date: selectedDate,
        newStockAdded: db2Form.newStockAdded,
        currentStock: db2Form.currentStock,
      });
      toast.success(`Stock updated in DB2 for ${showDb2UpdateModal.name}!`);
      setShowDb2UpdateModal(null);
      fetchInventory();
    } catch {
      toast.error('Failed to update DB2 stock.');
    } finally {
      setSubmitting(false);
    }
  };

  // Adhoc Direct Stock Override Handler
  const handleAdhocOverride = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put('/inventory/adhoc/override', {
        productId: showAdhocOverrideModal.id,
        date: selectedDate,
        openingStock:  parseFloat(adhocOverrideForm.openingStock  || 0),
        addedStock:    parseFloat(adhocOverrideForm.addedStock    || 0),
        dpIssuedStock: parseFloat(adhocOverrideForm.dpIssuedStock || 0),
        remainingStock: parseFloat(adhocOverrideForm.remainingStock || 0),
        overriddenBy: admin?.name || 'Super Admin',
        remarks: adhocOverrideForm.remarks,
      });
      toast.success(`Stock overridden for ${showAdhocOverrideModal.name}!`);
      setShowAdhocOverrideModal(null);
      fetchInventory();
    } catch {
      toast.error('Failed to override adhoc stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const allProductsForModal = [
    ...items.map(i => ({ ...i, isAdhoc: false })),
    ...adhocItems.map(i => ({ ...i, isAdhoc: true }))
  ];

  const openAddModal = (item = null) => {
    setSelectedModalItem(item);
    const targetItem = item || allProductsForModal[0];
    setAddForm({
      inventoryItemId: targetItem ? targetItem.id : '',
      quantityAdded: '',
      unit: targetItem ? (targetItem.unit || 'Units') : 'Litres',
      supplier: '',
      batchNumber: '',
      remarks: '',
    });
    setShowAddModal(true);
  };

  const openCorrectModal = (item) => {
    setCorrectForm({
      inventoryItemId: item.id,
      newTotalStock: item.currentStock,
      remarks: '',
    });
    setShowCorrectModal(true);
  };

  const triggerAddConfirmation = (e) => {
    e.preventDefault();
    if (!addForm.inventoryItemId) return toast.error('Please select a product.');
    const qty = parseFloat(addForm.quantityAdded);
    if (isNaN(qty) || qty <= 0) return toast.error('Quantity added must be greater than 0.');

    const selectedItem = allProductsForModal.find(i => i.id === addForm.inventoryItemId);
    setConfirmDialog({
      type: 'ADD',
      item: selectedItem,
      isAdhoc: selectedItem?.isAdhoc || selectedItem?.category === 'AdHoc',
      qty,
      unit: addForm.unit,
      payload: {
        inventoryItemId: selectedItem?.id,
        productId: selectedItem?.id,
        quantityAdded: qty,
        quantity: qty,
        unit: addForm.unit,
        date: selectedDate,
        addedBy: admin?.name || 'Super Admin',
        supplier: addForm.supplier,
        batchNumber: addForm.batchNumber,
        remarks: addForm.remarks,
      },
    });
  };

  const triggerCorrectConfirmation = (e) => {
    e.preventDefault();
    if (!correctForm.inventoryItemId) return toast.error('Please select a product.');
    if (!correctForm.remarks.trim()) return toast.error('Reason/Remarks are required for stock correction.');
    const newStock = parseFloat(correctForm.newTotalStock);
    if (isNaN(newStock) || newStock < 0) return toast.error('New total stock must be zero or positive.');

    const selectedItem = items.find(i => i.id === correctForm.inventoryItemId);
    setConfirmDialog({
      type: 'CORRECT',
      item: selectedItem,
      newStock,
      payload: { ...correctForm, newTotalStock: newStock },
    });
  };

  const executeAddStock = async () => {
    setSubmitting(true);
    try {
      let res;
      if (confirmDialog.isAdhoc) {
        res = await api.post('/inventory/adhoc/add-stock', {
          productId: confirmDialog.item.id,
          quantity: confirmDialog.qty,
          date: selectedDate,
          addedBy: admin?.name || 'Super Admin',
          remarks: addForm.remarks,
        });
      } else {
        res = await api.post('/inventory/add-stock', confirmDialog.payload);
      }

      if (res.data?.success) {
        toast.success(`Stock updated! +${confirmDialog.qty} ${confirmDialog.unit} added for ${confirmDialog.item?.name}.`);
        setShowAddModal(false);
        setConfirmDialog(null);
        fetchInventory();
        if (activeTab === 'history') fetchHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const executeCorrectStock = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/inventory/correct-stock', confirmDialog.payload);
      if (res.data?.success) {
        toast.success(`Stock corrected for ${confirmDialog.item?.name} to ${confirmDialog.newStock} units. DB2 Synced.`);
        setShowCorrectModal(false);
        setConfirmDialog(null);
        fetchInventory();
        if (activeTab === 'history') fetchHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to correct stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedItems = [...items].sort((a, b) => getItemPriority(a) - getItemPriority(b));

  const filteredItems = sortedItems.filter(i =>
    (i?.name || '').toLowerCase().includes((search || '').toLowerCase()) ||
    (i?.material || '').toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
              Inventory Management
            </h1>
            {isDb2Synced && <span className="badge badge-success" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MdSync /> DB2 Live Sync</span>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Single source of truth for DB2 stock, inventory ledger, and manager app inventory
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-success"
            id="inventory-download-report-btn"
            onClick={() => setShowReportModal(true)}
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <MdDownload style={{ fontSize: 18 }} /> Download Report
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchInventory} disabled={loading}>
            <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" id="inventory-add-stock-btn" onClick={() => openAddModal()}>
            <MdAdd style={{ fontSize: 18 }} /> Add Stock
          </button>
        </div>
      </div>

      {/* Main Module Tab Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('inventory')}
              id="inventory-tab-current"
            >
              <MdInventory /> Current Inventory & DB2 Stock
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('history')}
              id="inventory-tab-ledger"
            >
              <MdHistory /> Stock Ledger Audit ({historyTotal})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'manager-inventory' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('manager-inventory')}
              id="inventory-tab-manager-inventory"
              style={{ background: activeTab === 'manager-inventory' ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '', borderColor: activeTab === 'manager-inventory' ? '#7c3aed' : '' }}
            >
              <MdStorefront /> Manager Inventory
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'stock-correctness' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('stock-correctness')}
              id="inventory-tab-correctness"
              style={{ background: activeTab === 'stock-correctness' ? 'linear-gradient(135deg, #10b981, #059669)' : '', borderColor: activeTab === 'stock-correctness' ? '#10b981' : '' }}
            >
              <MdFactCheck /> Stock Correctness
            </button>
          </div>

          {(activeTab === 'inventory' || activeTab === 'history') && (
            <div style={{ position: 'relative', width: 260 }}>
              <MdSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder={activeTab === 'inventory' ? 'Search products...' : 'Search ledger history...'}
                value={activeTab === 'inventory' ? search : historySearch}
                onChange={e => activeTab === 'inventory' ? setSearch(e.target.value) : setHistSearch(e.target.value)}
                style={{ paddingLeft: 34, width: '100%', fontSize: 13 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── TAB 1: CURRENT INVENTORY (Incorporating DB2 Manager App Stock fields) ────────────────────────── */}
      {activeTab === 'inventory' && (
        <div>
          {/* Date Picker Bar */}
          <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <MdFilterList style={{ color: 'var(--primary)', fontSize: 18 }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>🥛 Milk inventory tracks DB2 live dispatches.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Target Date:</label>
              <input
                type="date"
                className="form-input"
                style={{ width: 150, padding: '4px 10px', fontSize: 12.5 }}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
            <div className="stat-card" style={{ '--card-accent': 'var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>
                  {summary.totalStock.toLocaleString()}
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', fontSize: 20 }}><MdInventory /></div>
              </div>
              <div className="stat-label">Total Stock Available</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Across {summary.totalProducts} registered products
              </div>
            </div>

            <div className="stat-card" style={{ '--card-accent': summary.lowStockCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-value" style={{ color: summary.lowStockCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                  {summary.lowStockCount}
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: summary.lowStockCount > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: summary.lowStockCount > 0 ? 'var(--warning)' : 'var(--success)', fontSize: 20 }}>
                  <MdWarningAmber />
                </div>
              </div>
              <div className="stat-label">Low Stock Products</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {summary.lowStockCount > 0 ? 'Requires stock addition' : 'All stock levels healthy'}
              </div>
            </div>

            <div className="stat-card" style={{ '--card-accent': 'var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  +{summary.todayAddedStock.toLocaleString()}
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', fontSize: 20 }}><MdAdd /></div>
              </div>
              <div className="stat-label">Today's Stock Added</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Added by Super Admin today</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': summary.outOfStockCount > 0 ? 'var(--danger)' : 'var(--info)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="stat-value" style={{ color: summary.outOfStockCount > 0 ? 'var(--danger)' : 'var(--info)' }}>
                  {summary.outOfStockCount}
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: summary.outOfStockCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.1)', color: summary.outOfStockCount > 0 ? 'var(--danger)' : 'var(--info)', fontSize: 20 }}>
                  <MdErrorOutline />
                </div>
              </div>
              <div className="stat-label">Out of Stock Products</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {summary.outOfStockCount > 0 ? 'Urgent replenishment needed' : 'Zero items depleted'}
              </div>
            </div>
          </div>

          {/* ─── CATEGORY DIVISIONS ─────────────────────────────────────────── */}
          {(() => {
            /* ── helpers ── */
            const iconBox = (IconComp, bg, color) => (
              <span style={{ width: 32, height: 32, borderRadius: 8, background: bg, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                <IconComp />
              </span>
            );

            /* classify milk items (from DB2 items) */
            const classifyMilk = (item) => {
              const n = (item?.name || '').toLowerCase();
              const m = (item?.material || '').toLowerCase();
              const u = (item?.unit || '').toLowerCase();
              if (n.includes('1l bottle') || (n.includes('1l') && (n.includes('bottle') || m.includes('bottle')))) return '1L';
              if (n.includes('half litre bottle') || n.includes('500ml bottle') || n.includes('500 ml bottle') || (m.includes('bottle') && (n.includes('500') || n.includes('half') || u.includes('500')))) return 'HLB';
              if (n.includes('500ml packet') || n.includes('500 ml packet') || (m.includes('packet') && (n.includes('500') || n.includes('half') || u.includes('500')))) return 'HLP';
              return null;
            };
            const milkLabel = { '1L': 'Milk 1L Bottle', 'HLB': 'Milk ½L Bottle', 'HLP': 'Milk ½L Packet' };
            const milkItems = ['1L', 'HLB', 'HLP'].map(k => filteredItems.find(i => classifyMilk(i) === k)).filter(Boolean);

            /* classify adhoc items into categories */
            const classifyAdhoc = (item) => {
              const n = (item?.name || '').toLowerCase();
              if (n.includes('butter') || n.includes('ghee') || n.includes('curd') || n.includes('paneer') || n.includes('cheese') || n.includes('cream') || n.includes('lassi')) return 'dairy';
              if (n.includes('oil')) return 'oils';
              if (n.includes('sugar') || n.includes('honey') || n.includes('jaggery') || n.includes('sweet')) return 'sweeteners';
              return 'grocery';
            };
            const dairyItems     = adhocItems.filter(i => classifyAdhoc(i) === 'dairy');
            const oilsItems      = adhocItems.filter(i => classifyAdhoc(i) === 'oils');
            const sweetenerItems = adhocItems.filter(i => classifyAdhoc(i) === 'sweeteners');
            const groceryItems   = adhocItems.filter(i => classifyAdhoc(i) === 'grocery');

            /* reusable row renderer for milk (DB2 fields) */
            const milkRow = (item) => {
              const label     = milkLabel[classifyMilk(item)] || item.name;
              const opening   = item.carriedOverStock ?? 0;
              const added     = item.newStockAdded ?? 0;
              const expected  = item.expectedStock ?? (opening + added);
              const remaining = item.currentStock ?? 0;
              const dpTaken   = Math.max(0, expected - remaining);
              const sc = item.status === 'In Stock' ? 'badge-success' : item.status === 'Low Stock' ? 'badge-warning' : 'badge-danger';
              const remainColor = remaining <= 0 ? 'var(--danger)' : remaining <= 20 ? 'var(--warning)' : '#3b82f6';
              return (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {iconBox(MdLocalDrink, 'rgba(59,130,246,0.1)', '#3b82f6')}
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.name}</div>
                      </div>
                    </div>
                  </td>
                  <td><code style={{ fontSize: 11, background: 'var(--gray-100,#f1f5f9)', padding: '2px 6px', borderRadius: 4 }}>{item.sku || `MK-${item.id}`}</code></td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{opening} {item.unit}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>+{added} {item.unit}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{dpTaken} {item.unit}</td>
                  <td><span style={{ fontSize: 15, fontWeight: 800, color: remainColor }}>{remaining.toLocaleString()} {item.unit}</span></td>
                  <td><span className={`badge ${sc}`}>{item.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => openAddModal(item)}><MdAdd /> Add</button>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => {
                        setShowDb2UpdateModal(item);
                        setDb2Form({ newStockAdded: item.newStockAdded || 0, currentStock: item.currentStock || 0 });
                      }}><MdEdit /> DB2 Override</button>
                    </div>
                  </td>
                </tr>
              );
            };

            /* reusable row renderer for adhoc items */
            const adhocRow = (item, IconComp, iconBg, iconColor) => {
              const sc = item.status === 'In Stock' ? 'badge-success' : item.status === 'Low Stock' ? 'badge-warning' : 'badge-danger';
              const remaining = parseFloat(item.remainingStock ?? 0);
              const remainColor = remaining <= 0 ? 'var(--danger)' : remaining <= 10 ? 'var(--warning)' : iconColor;
              return (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {iconBox(IconComp, iconBg, iconColor)}
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{item.name}</div>
                    </div>
                  </td>
                  <td><code style={{ fontSize: 11, background: 'var(--gray-100,#f1f5f9)', padding: '2px 6px', borderRadius: 4 }}>{item.sku || '-'}</code></td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.openingStock ?? 0} {item.unit}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>+{item.addedStock ?? 0} {item.unit}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.dpIssuedStock ?? 0} {item.unit}</td>
                  <td><span style={{ fontSize: 15, fontWeight: 800, color: remainColor }}>{remaining.toLocaleString()} {item.unit}</span></td>
                  <td><span className={`badge ${sc}`}>{item.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => openAddModal({ ...item, isAdhoc: true })}><MdAdd /> Add</button>
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => {
                        setShowAdhocOverrideModal(item);
                        setAdhocOverrideForm({
                          openingStock:  item.openingStock  ?? 0,
                          addedStock:    item.addedStock    ?? 0,
                          dpIssuedStock: item.dpIssuedStock ?? 0,
                          remainingStock: item.remainingStock ?? 0,
                          remarks: '',
                        });
                      }}><MdEdit /> Override</button>
                    </div>
                  </td>
                </tr>
              );
            };

            /* reusable card shell */
            const DivCard = ({ title, subtitle, IconComp, accentColor, accentBg, badgeCount, badgeClass, children }) => (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ background: accentBg }}>
                  <div>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: accentColor }}>
                      <IconComp style={{ fontSize: 20 }} />
                      {title}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
                  </div>
                  <span className={`badge ${badgeClass}`} style={{ fontWeight: 700 }}>{badgeCount}</span>
                </div>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 200 }}>Product</th>
                        <th>SKU</th>
                        <th>Opening</th>
                        <th>Added</th>
                        <th>DP Taken</th>
                        <th>Remaining</th>
                        <th>Status</th>
                        <th style={{ minWidth: 110 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>{children}</tbody>
                  </table>
                </div>
              </div>
            );

            const emptyRow = (msg) => (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)', fontSize: 13 }}>{msg}</td></tr>
            );

            return (
              <>
                {/* 1. MILK */}
                <DivCard
                  title="MILK DIVISION"
                  subtitle="Central milk stock — 1L Bottle · ½L Bottle · ½L Packet"
                  IconComp={MdLocalDrink}
                  accentColor="#3b82f6"
                  accentBg="linear-gradient(135deg,rgba(59,130,246,0.06),rgba(14,165,233,0.02))"
                  badgeCount={`${milkItems.length} Products`}
                  badgeClass="badge-blue"
                >
                  {milkItems.length === 0 ? emptyRow('No milk products found for this date.') : milkItems.map(milkRow)}
                </DivCard>

                {/* 2. DAIRY */}
                <DivCard
                  title="DAIRY DIVISION"
                  subtitle="Butter · Ghee · Curd · Paneer and other dairy products"
                  IconComp={MdKitchen}
                  accentColor="#7c3aed"
                  accentBg="linear-gradient(135deg,rgba(124,58,237,0.06),rgba(91,33,182,0.02))"
                  badgeCount={`${dairyItems.length} Products`}
                  badgeClass="badge-purple"
                >
                  {dairyItems.length === 0
                    ? emptyRow('No dairy products found for this date.')
                    : dairyItems.map(i => adhocRow(i, MdKitchen, 'rgba(124,58,237,0.1)', '#7c3aed'))}
                </DivCard>

                {/* 3. OILS */}
                <DivCard
                  title="OILS DIVISION"
                  subtitle="Coconut Oil · Groundnut Oil · Sesame Oil and other cooking oils"
                  IconComp={MdOpacity}
                  accentColor="#d97706"
                  accentBg="linear-gradient(135deg,rgba(217,119,6,0.06),rgba(245,158,11,0.02))"
                  badgeCount={`${oilsItems.length} Products`}
                  badgeClass="badge-warning"
                >
                  {oilsItems.length === 0
                    ? emptyRow('No oil products found for this date.')
                    : oilsItems.map(i => adhocRow(i, MdOpacity, 'rgba(217,119,6,0.1)', '#d97706'))}
                </DivCard>

                {/* 4. SWEETENERS */}
                <DivCard
                  title="SWEETENERS DIVISION"
                  subtitle="Honey · Cane Sugar · Jaggery and other sweeteners"
                  IconComp={MdEco}
                  accentColor="#059669"
                  accentBg="linear-gradient(135deg,rgba(5,150,105,0.06),rgba(16,185,129,0.02))"
                  badgeCount={`${sweetenerItems.length} Products`}
                  badgeClass="badge-success"
                >
                  {sweetenerItems.length === 0
                    ? emptyRow('No sweetener products found for this date.')
                    : sweetenerItems.map(i => adhocRow(i, MdEco, 'rgba(5,150,105,0.1)', '#059669'))}
                </DivCard>

                {/* 5. GROCERY */}
                <DivCard
                  title="GROCERY DIVISION"
                  subtitle="Appalam · Pickles · Dry goods and other grocery items"
                  IconComp={MdShoppingCart}
                  accentColor="#0ea5e9"
                  accentBg="linear-gradient(135deg,rgba(14,165,233,0.06),rgba(6,182,212,0.02))"
                  badgeCount={`${groceryItems.length} Products`}
                  badgeClass="badge-blue"
                >
                  {groceryItems.length === 0
                    ? emptyRow('No grocery products found for this date.')
                    : groceryItems.map(i => adhocRow(i, MdShoppingCart, 'rgba(14,165,233,0.1)', '#0ea5e9'))}
                </DivCard>
              </>
            );
          })()}
        </div>
      )}

      {/* ── TAB 2: STOCK LEDGER AUDIT ───────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">Stock History Ledger</span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Read-only audit log of all stock additions and corrections
              </div>
            </div>
            <span className="badge badge-blue">{historyTotal} history records</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Previous Stock</th>
                  <th>Qty Added / Adjusted</th>
                  <th>Updated Stock</th>
                  <th>Unit</th>
                  <th>Supplier & Batch</th>
                  <th>Added By</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => {
                  const isPositive = parseFloat(row.quantity_added) >= 0;
                  return (
                    <tr key={row.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{row.product_name}</div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {parseFloat(row.previous_stock).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${isPositive ? 'badge-success' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                          {isPositive ? `+${parseFloat(row.quantity_added)}` : parseFloat(row.quantity_added)}
                        </span>
                      </td>
                      <td style={{ fontSize: 14, fontWeight: 700 }}>
                        {parseFloat(row.updated_stock).toLocaleString()}
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{row.unit}</td>
                      <td style={{ fontSize: 12 }}>
                        {row.supplier && <div>Supplier: {row.supplier}</div>}
                        {row.batch_number && <div>Batch: {row.batch_number}</div>}
                      </td>
                      <td style={{ fontSize: 12.5, fontWeight: 600 }}>{row.added_by}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{row.remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* DB2 Direct Override Modal */}
      <AnimatePresence>
        {showDb2UpdateModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowDb2UpdateModal(null)}>
            <motion.div className="modal" style={{ maxWidth: 480 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdEdit style={{ color: 'var(--primary)' }} /> DB2 Stock Override — {showDb2UpdateModal.name}
                </h2>
                <button className="icon-btn" onClick={() => setShowDb2UpdateModal(null)}><MdClose /></button>
              </div>
              <form onSubmit={handleDb2Update}>
                <div className="modal-body">
                  <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12.5 }}>
                    Target Date: <strong>{selectedDate}</strong><br />
                    Material: <strong>{showDb2UpdateModal.material} ({showDb2UpdateModal.unit})</strong>
                  </div>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">New Stock Added ({showDb2UpdateModal.unit})</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-input"
                      value={db2Form.newStockAdded}
                      onChange={e => setDb2Form({ ...db2Form, newStockAdded: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Current Available Stock ({showDb2UpdateModal.unit})</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-input"
                      value={db2Form.currentStock}
                      onChange={e => setDb2Form({ ...db2Form, currentStock: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDb2UpdateModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save to DB2'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adhoc Stock Override Modal */}
      <AnimatePresence>
        {showAdhocOverrideModal && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAdhocOverrideModal(null)}>
            <motion.div className="modal" style={{ maxWidth: 520 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdEdit style={{ color: '#7c3aed' }} /> Stock Override — {showAdhocOverrideModal.name}
                </h2>
                <button className="icon-btn" onClick={() => setShowAdhocOverrideModal(null)}><MdClose /></button>
              </div>
              <form onSubmit={handleAdhocOverride}>
                <div className="modal-body">
                  <div style={{ background: 'rgba(124,58,237,0.06)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12.5, borderLeft: '3px solid #7c3aed' }}>
                    <strong>Direct Override</strong> — overwrites all stock fields for this product on <strong>{selectedDate}</strong>.<br />
                    Unit: <strong>{showAdhocOverrideModal.unit}</strong> · SKU: <strong>{showAdhocOverrideModal.sku || 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Opening Stock ({showAdhocOverrideModal.unit})</label>
                      <input type="number" step="any" min="0" className="form-input"
                        value={adhocOverrideForm.openingStock}
                        onChange={e => setAdhocOverrideForm(f => ({ ...f, openingStock: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Added Stock ({showAdhocOverrideModal.unit})</label>
                      <input type="number" step="any" min="0" className="form-input"
                        value={adhocOverrideForm.addedStock}
                        onChange={e => setAdhocOverrideForm(f => ({ ...f, addedStock: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">DP Issued ({showAdhocOverrideModal.unit})</label>
                      <input type="number" step="any" min="0" className="form-input"
                        value={adhocOverrideForm.dpIssuedStock}
                        onChange={e => setAdhocOverrideForm(f => ({ ...f, dpIssuedStock: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#7c3aed', fontWeight: 700 }}>Remaining Stock ({showAdhocOverrideModal.unit})</label>
                      <input type="number" step="any" min="0" className="form-input"
                        style={{ borderColor: '#7c3aed' }}
                        value={adhocOverrideForm.remainingStock}
                        onChange={e => setAdhocOverrideForm(f => ({ ...f, remainingStock: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remarks (optional)</label>
                    <input type="text" className="form-input" placeholder="Reason for override..."
                      value={adhocOverrideForm.remarks}
                      onChange={e => setAdhocOverrideForm(f => ({ ...f, remarks: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdhocOverrideModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ background: '#7c3aed', borderColor: '#7c3aed' }} disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Override'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Addition & Correction Modals */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div className="card" style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdAdd style={{ color: 'var(--primary)' }} /> Add Inventory Stock
                </span>
                <button className="icon-btn" onClick={() => setShowAddModal(false)}><MdClose /></button>
              </div>
              <form onSubmit={triggerAddConfirmation} style={{ padding: 20 }}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Product Name *</label>
                  {selectedModalItem ? (
                    <div className="form-input" style={{ background: 'var(--gray-100, #f1f5f9)', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 42, padding: '0 12px' }}>
                      <span>{selectedModalItem.name}</span>
                      <span className="badge badge-blue" style={{ fontSize: 11.5 }}>
                        Available: {selectedModalItem.currentStock ?? selectedModalItem.remainingStock ?? 0} {selectedModalItem.unit}
                      </span>
                    </div>
                  ) : (
                    <select
                      className="form-input"
                      value={addForm.inventoryItemId}
                      onChange={e => {
                        const id = e.target.value;
                        const found = allProductsForModal.find(p => p.id === id);
                        setAddForm(f => ({
                          ...f,
                          inventoryItemId: id,
                          unit: found ? (found.unit || 'Units') : f.unit
                        }));
                      }}
                      required
                    >
                      <optgroup label="Milk Division">
                        {items.map(i => (
                          <option key={i.id} value={i.id}>{i.name} (Available: {i.currentStock} {i.unit})</option>
                        ))}
                      </optgroup>
                      <optgroup label="AdHoc & Other Products">
                        {adhocItems.map(i => (
                          <option key={i.id} value={i.id}>{i.name} (Available: {i.currentStock ?? i.remainingStock ?? 0} {i.unit})</option>
                        ))}
                      </optgroup>
                    </select>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Quantity to Add *</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={addForm.quantityAdded}
                      onChange={e => setAddForm(f => ({ ...f, quantityAdded: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input
                      type="text"
                      className="form-input"
                      value={addForm.unit}
                      onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Continue to Confirm</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div className="card" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
                {confirmDialog.type === 'ADD' ? 'Confirm Stock Addition' : 'Confirm Stock Correction'}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Are you sure you want to proceed with this stock update for <strong>{confirmDialog.item?.name}</strong>?
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)} disabled={submitting}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmDialog.type === 'ADD' ? executeAddStock : executeCorrectStock} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Yes, Confirm & Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── TAB 4: MANAGER INVENTORY (ShopSale + ManagerInventoryLog from DB2) ─── */}
      {activeTab === 'manager-inventory' && (
        <div>
          {/* Filter Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdDateRange style={{ color: '#7c3aed', fontSize: 20 }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Filter Mode:</span>
                  <button
                    className={`btn btn-sm ${!miRangeMode ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => setMiRangeMode(false)}
                    id="mi-filter-single"
                  >
                    Single Day
                  </button>
                  <button
                    className={`btn btn-sm ${miRangeMode ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => setMiRangeMode(true)}
                    id="mi-filter-range"
                  >
                    Date Range
                  </button>
                </div>

                {!miRangeMode ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Date:</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: 160, padding: '4px 10px', fontSize: 12.5 }}
                      value={miDate}
                      onChange={e => setMiDate(e.target.value)}
                      id="mi-date-picker"
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>From:</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: 150, padding: '4px 10px', fontSize: 12.5 }}
                      value={miStartDate}
                      onChange={e => setMiStartDate(e.target.value)}
                      id="mi-start-date"
                    />
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>To:</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ width: 150, padding: '4px 10px', fontSize: 12.5 }}
                      value={miEndDate}
                      onChange={e => setMiEndDate(e.target.value)}
                      id="mi-end-date"
                    />
                  </div>
                )}

                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', border: 'none', marginLeft: 'auto' }}
                  onClick={fetchManagerInventory}
                  disabled={managerInvLoading}
                  id="mi-refresh-btn"
                >
                  <MdRefresh className={managerInvLoading ? 'spin' : ''} />
                  {managerInvLoading ? 'Loading...' : 'Fetch Data'}
                </button>
              </div>
            </div>
          </div>

          {managerInvLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div className="loading-spinner" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: '#7c3aed', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading Manager Inventory from DB2...</p>
            </div>
          ) : managerInvData ? (
            <>
              {/* ── Section 1: ShopSale — Daily Product Totals ── */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MdStorefront style={{ color: '#7c3aed', fontSize: 20 }} />
                      Shop Sale — Daily Stock Sold
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Source: <code style={{ background: 'rgba(124,58,237,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>ShopSale</code> table · DB2 Manager App
                    </div>
                  </div>
                  <span className="badge" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                    {managerInvData.shopSale.rows.length} entries
                  </span>
                </div>

                {/* KPI Summary Cards */}
                <div style={{ padding: '16px 20px' }}>
                  <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
                    <div className="stat-card" style={{ '--card-accent': '#7c3aed' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-value" style={{ color: '#7c3aed' }}>
                          {managerInvData.shopSale.summary.total1LBottle.toLocaleString()}
                        </div>
                        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontSize: 22, fontWeight: 900 }}>1L</div>
                      </div>
                      <div className="stat-label">1L Bottle Sold</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total qty1LBottle</div>
                    </div>

                    <div className="stat-card" style={{ '--card-accent': '#0ea5e9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-value" style={{ color: '#0ea5e9' }}>
                          {managerInvData.shopSale.summary.totalHalfLBottle.toLocaleString()}
                        </div>
                        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', fontSize: 20 }}><MdInventory2 /></div>
                      </div>
                      <div className="stat-label">Half-L Bottle Sold</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total qtyHalfLBottle</div>
                    </div>

                    <div className="stat-card" style={{ '--card-accent': '#10b981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-value" style={{ color: '#10b981' }}>
                          {managerInvData.shopSale.summary.totalHalfLPacket.toLocaleString()}
                        </div>
                        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 20 }}><MdOutlineAssignmentReturn /></div>
                      </div>
                      <div className="stat-label">Half-L Packet Sold</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total qtyHalfLPacket</div>
                    </div>

                    <div className="stat-card" style={{ '--card-accent': '#f59e0b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="stat-value" style={{ color: '#f59e0b' }}>
                          {(managerInvData.shopSale.summary.total1LBottle +
                            managerInvData.shopSale.summary.totalHalfLBottle +
                            managerInvData.shopSale.summary.totalHalfLPacket).toLocaleString()}
                        </div>
                        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 20 }}><MdFlashOn /></div>
                      </div>
                      <div className="stat-label">Total Units Sold</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>All product types combined</div>
                    </div>
                  </div>

                  {/* ShopSale Rows Table */}
                  {managerInvData.shopSale.rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
                      <MdStorefront style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }} />
                      <div>No ShopSale records found for this date.</div>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th style={{ color: '#7c3aed' }}>1L Bottle Qty</th>
                            <th style={{ color: '#0ea5e9' }}>Half-L Bottle Qty</th>
                            <th style={{ color: '#10b981' }}>Half-L Packet Qty</th>
                            <th>Total Units</th>
                            <th>Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {managerInvData.shopSale.rows.map((row, idx) => {
                            const rowTotal = (parseInt(row.qty1LBottle || 0) + parseInt(row.qtyHalfLBottle || 0) + parseInt(row.qtyHalfLPacket || 0));
                            return (
                              <tr key={row.id}>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                                <td>
                                  <span className="badge badge-gray" style={{ fontFamily: 'monospace' }}>
                                    {row.date}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: '#7c3aed' }}>
                                    {row.qty1LBottle ?? 0}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: '#0ea5e9' }}>
                                    {row.qtyHalfLBottle ?? 0}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: '#10b981' }}>
                                    {row.qtyHalfLPacket ?? 0}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge" style={{ background: rowTotal > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.06)', color: rowTotal > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>
                                    {rowTotal} units
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                  {new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Totals Footer */}
                        <tfoot>
                          <tr style={{ background: 'rgba(124,58,237,0.05)', fontWeight: 800 }}>
                            <td colSpan={2} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>TOTAL ({managerInvData.shopSale.rows.length} entries)</td>
                            <td style={{ fontSize: 15, color: '#7c3aed', fontWeight: 900 }}>{managerInvData.shopSale.summary.total1LBottle}</td>
                            <td style={{ fontSize: 15, color: '#0ea5e9', fontWeight: 900 }}>{managerInvData.shopSale.summary.totalHalfLBottle}</td>
                            <td style={{ fontSize: 15, color: '#10b981', fontWeight: 900 }}>{managerInvData.shopSale.summary.totalHalfLPacket}</td>
                            <td style={{ fontSize: 15, color: '#f59e0b', fontWeight: 900 }}>
                              {managerInvData.shopSale.summary.total1LBottle + managerInvData.shopSale.summary.totalHalfLBottle + managerInvData.shopSale.summary.totalHalfLPacket}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Section 2: ManagerInventoryLog ── */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MdBusiness style={{ color: '#0ea5e9', fontSize: 20 }} />
                      Manager Inventory Log — Per Product
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Source: <code style={{ background: 'rgba(14,165,233,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>ManagerInventoryLog</code> table · DB2 Manager App
                    </div>
                  </div>
                  <span className="badge badge-blue">{managerInvData.managerInventory.totalEntries} log entries</span>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  {/* Product Summary Cards (1L (B), 500ml (B), 500ml (P), Total Units) */}
                  {(() => {
                    const milSummary = managerInvData.managerInventory.summary || (() => {
                      const rows = managerInvData.managerInventory.rows || [];
                      let total1LBottle = 0, totalHalfLBottle = 0, totalHalfLPacket = 0, totalUnits = 0;
                      rows.forEach(r => {
                        const q = parseInt(r.quantity || 0);
                        totalUnits += q;
                        const n = (r.productName || r.product || '').toLowerCase();
                        // Only count milk-specific items in the three milk KPI buckets
                        const isMilkItem = n.includes('milk');
                        if (isMilkItem && (n.includes('1l') || n.includes('1 l') || n.includes('1 litre'))) {
                          total1LBottle += q;
                        } else if (isMilkItem && (n.includes('packet') || n.includes('pack') || n.includes('(p)'))) {
                          totalHalfLPacket += q;
                        } else if (isMilkItem && (n.includes('500') || n.includes('half') || n.includes('bottle') || n.includes('(b)'))) {
                          totalHalfLBottle += q;
                        }
                        // Non-milk products (oils, dairy etc.) count toward totalUnits only
                      });
                      return { total1LBottle, totalHalfLBottle, totalHalfLPacket, totalUnits };
                    })();

                    return (
                      <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
                        <div className="stat-card" style={{ '--card-accent': '#7c3aed' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="stat-value" style={{ color: '#7c3aed' }}>
                              {milSummary.total1LBottle.toLocaleString()}
                            </div>
                            <div style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontSize: 16, fontWeight: 900 }}>1L</div>
                          </div>
                          <div className="stat-label">1L (B) BOTTLE LOGGED</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total 1L (B) Qty</div>
                        </div>

                        <div className="stat-card" style={{ '--card-accent': '#0ea5e9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="stat-value" style={{ color: '#0ea5e9' }}>
                              {milSummary.totalHalfLBottle.toLocaleString()}
                            </div>
                            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', fontSize: 20 }}><MdInventory2 /></div>
                          </div>
                          <div className="stat-label">500ML (B) BOTTLE LOGGED</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total 500ml (B) Qty</div>
                        </div>

                        <div className="stat-card" style={{ '--card-accent': '#10b981' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="stat-value" style={{ color: '#10b981' }}>
                              {milSummary.totalHalfLPacket.toLocaleString()}
                            </div>
                            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 20 }}><MdOutlineAssignmentReturn /></div>
                          </div>
                          <div className="stat-label">500ML (P) PACKET LOGGED</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total 500ml (P) Qty</div>
                        </div>

                        <div className="stat-card" style={{ '--card-accent': '#f59e0b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="stat-value" style={{ color: '#f59e0b' }}>
                              {milSummary.totalUnits.toLocaleString()}
                            </div>
                            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 20 }}><MdFlashOn /></div>
                          </div>
                          <div className="stat-label">TOTAL UNITS LOGGED</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>All product types combined</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Detailed Log Table */}
                  {managerInvData.managerInventory.rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
                      <MdBusiness style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }} />
                      <div>No ManagerInventoryLog records found for this date.</div>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Product</th>
                            <th>Unit</th>
                            <th>Quantity</th>
                            <th>Manager</th>
                            <th>Logged At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {managerInvData.managerInventory.rows.map((row, idx) => {
                            const pName = (row.productName || '').toLowerCase();
                            let badgeStyle = { background: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' };
                            let displayLabel = row.productName || '—';
                            if (pName.includes('1l') || pName.includes('1 l') || (pName.includes('bottle') && (pName.includes('1') || pName.includes('litre')))) {
                              badgeStyle = { background: 'rgba(124,58,237,0.12)', color: '#7c3aed' };
                              displayLabel = '1L Bottle';
                            } else if (pName.includes('packet') || pName.includes('pack')) {
                              badgeStyle = { background: 'rgba(16,185,129,0.12)', color: '#10b981' };
                              displayLabel = '500ml Packet (P)';
                            } else if (pName.includes('500') || pName.includes('half') || pName.includes('bottle')) {
                              badgeStyle = { background: 'rgba(14,165,233,0.12)', color: '#0ea5e9' };
                              displayLabel = '500ml Bottle (B)';
                            }

                            return (
                              <tr key={row.id}>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                                <td>
                                  <span className="badge badge-gray" style={{ fontFamily: 'monospace' }}>{row.date}</span>
                                </td>
                                <td>
                                  <span className="badge" style={{ ...badgeStyle, fontWeight: 700, fontSize: 13 }}>
                                    {displayLabel}
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.productUnit || '—'}</td>
                                <td>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: '#7c3aed' }}>
                                    {parseInt(row.quantity || 0).toLocaleString()}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                      <MdPerson />
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{row.managerName || '—'}</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                  {new Date(row.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Section 3: DP AdHoc Inventory / AdHoc DP Sales ── */}
              <div className="card" style={{ marginTop: 20 }}>
                <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(245,158,11,0.02))' }}>
                  <div>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706' }}>
                      <MdInventory2 style={{ color: '#d97706', fontSize: 20 }} />
                      ADHOC DP SALES & INVENTORY
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      AdHoc stock issued to Delivery Persons & reported sales (Strictly separated from Direct Shop Sales)
                    </div>
                  </div>
                  <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                    {adhocDpSales.length} DP Product Records
                  </span>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  {adhocDpSales.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
                      <MdInventory2 style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }} />
                      <div>No DP AdHoc sales records found for this date.</div>
                    </div>
                  ) : (
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>DP Name</th>
                            <th>Route</th>
                            <th>Product</th>
                            <th style={{ color: 'var(--primary)' }}>Taken</th>
                            <th style={{ color: 'var(--success)' }}>Sold</th>
                            <th style={{ color: 'var(--warning)' }}>Returned</th>
                            <th style={{ color: '#7c3aed' }}>Remaining</th>
                            <th>Sales Revenue (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adhocDpSales.map((row, idx) => {
                            const taken = parseFloat(row.quantity_taken || 0);
                            const sold = parseFloat(row.quantity_sold || 0);
                            const returned = parseFloat(row.quantity_returned || 0);
                            const remaining = parseFloat(row.quantity_remaining || 0);
                            const revenue = parseFloat(row.total_sales_amount || 0);

                            return (
                              <tr key={row.id || idx}>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                                <td style={{ fontWeight: 700 }}>{row.dp_name}</td>
                                <td><span className="badge badge-gray">{row.route_name || 'General Route'}</span></td>
                                <td style={{ fontWeight: 600 }}>{row.product_name}</td>
                                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{taken}</td>
                                <td style={{ fontWeight: 800, color: 'var(--success)', fontSize: 15 }}>{sold}</td>
                                <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{returned}</td>
                                <td>
                                  <span className="badge badge-blue" style={{ fontWeight: 700 }}>
                                    {remaining}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 800, color: '#d97706' }}>₹{revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <MdStorefront style={{ fontSize: 52, color: '#7c3aed', opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>No Data Loaded</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Select a date and click "Fetch Data" to load Manager Inventory from DB2.</div>
              <button
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', border: 'none' }}
                onClick={fetchManagerInventory}
                disabled={managerInvLoading}
              >
                <MdRefresh /> Load Manager Inventory
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: STOCK CORRECTNESS (DAILY MILK STOCK RECONCILIATION) ────────────────────────── */}
      {activeTab === 'stock-correctness' && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
          {/* Header Bar with Sub-tabs & Operational Day Badge */}
          <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.02))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdFactCheck style={{ color: '#10b981', fontSize: 22 }} /> Stock Correctness
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                Daily milk stock reconciliation between Inventory Expected Stock and Manager Inventory Log.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Sub-tab Switcher: Today's Check | History */}
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.05)', padding: 3, borderRadius: 8 }}>
                <button
                  className={`btn btn-sm ${scSubTab === 'today' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scSubTab === 'today' ? '#10b981' : 'transparent', border: 'none', color: scSubTab === 'today' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScSubTab('today')}
                >
                  <MdFactCheck /> Today's Check
                </button>
                <button
                  className={`btn btn-sm ${scSubTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '4px 12px', background: scSubTab === 'history' ? '#10b981' : 'transparent', border: 'none', color: scSubTab === 'history' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setScSubTab('history')}
                >
                  <MdHistory /> History
                </button>
              </div>

              {/* Active Operational Day Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 12.5, fontWeight: 700, color: '#10b981' }}>
                <MdCalendarToday style={{ fontSize: 14 }} />
                <span>Op Day: <strong>{scData?.operationalDay || selectedDate || '26-Aug-2026'}</strong></span>
                <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>
                  {scData?.isActiveDay !== false ? 'ACTIVE' : 'HISTORICAL'}
                </span>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={scSubTab === 'today' ? fetchStockCorrectnessToday : fetchStockCorrectnessHistory} disabled={scLoading || scHistoryLoading}>
                <MdRefresh className={(scLoading || scHistoryLoading) ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* SUB-TAB 1: TODAY'S RECONCILIATION CHECK */}
          {scSubTab === 'today' && (
            <div>
              {/* KPI Cards Grid */}
              <div className="ri-stat-grid-4" style={{ marginBottom: 20 }}>
                <div className="stat-card" style={{ '--card-accent': 'var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="stat-value" style={{ color: 'var(--primary)' }}>
                      {scData?.kpis?.productsChecked ?? 0}
                    </div>
                    <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', fontSize: 20 }}><MdFactCheck /></div>
                  </div>
                  <div className="stat-label">Products Checked</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Milk products evaluated today</div>
                </div>

                <div className="stat-card" style={{ '--card-accent': 'var(--success)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                      {scData?.kpis?.correctCount ?? 0}
                    </div>
                    <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', fontSize: 20 }}><MdCheckCircle /></div>
                  </div>
                  <div className="stat-label">Correct</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Exact stock match</div>
                </div>

                <div className="stat-card" style={{ '--card-accent': (scData?.kpis?.mismatchCount || 0) > 0 ? 'var(--danger)' : 'var(--info)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="stat-value" style={{ color: (scData?.kpis?.mismatchCount || 0) > 0 ? 'var(--danger)' : 'var(--info)' }}>
                      {scData?.kpis?.mismatchCount ?? 0}
                    </div>
                    <div style={{ padding: 8, borderRadius: 8, background: (scData?.kpis?.mismatchCount || 0) > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.1)', color: (scData?.kpis?.mismatchCount || 0) > 0 ? 'var(--danger)' : 'var(--info)', fontSize: 20 }}><MdErrorOutline /></div>
                  </div>
                  <div className="stat-label">Mismatch</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {(scData?.kpis?.mismatchCount || 0) > 0 ? 'Discrepancy detected' : 'Zero mismatches'}
                  </div>
                </div>

                <div className="stat-card" style={{ '--card-accent': '#d97706' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="stat-value" style={{ color: '#d97706' }}>
                      {scData?.kpis?.totalDifference ?? 0} Units
                    </div>
                    <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245,158,11,0.1)', color: '#d97706', fontSize: 20 }}><MdWarningAmber /></div>
                  </div>
                  <div className="stat-label">Total Difference</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Cumulative absolute variance</div>
                </div>
              </div>

              {/* Stock Reconciliation Table */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981' }}>
                      <MdFactCheck style={{ fontSize: 20 }} />
                      DAILY MILK STOCK RECONCILIATION TABLE
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Compares Expected Milk Stock vs Manager Inventory Logged Stock for {scData?.operationalDay || selectedDate} (Milk Products Only)
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ fontWeight: 700 }}>
                    Milk Products Only
                  </span>
                </div>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 160 }}>Product</th>
                        <th>Expected Stock</th>
                        <th>Manager Inventory Log</th>
                        <th>Difference</th>
                        <th>Status</th>
                        <th>Review Status</th>
                        <th style={{ minWidth: 120 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scLoading ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48 }}>Calculating Stock Correctness...</td></tr>
                      ) : (!scData?.reconciliation || scData.reconciliation.length === 0) ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Milk inventory records found for reconciliation.</td></tr>
                      ) : (
                        scData.reconciliation.map(item => {
                          const isCorrect = item.status === 'Correct';
                          const isMismatch = item.status === 'Mismatch';
                          const isMissing = item.status === 'Missing Log';

                          const diffValue = item.difference;
                          const diffDisplay = diffValue > 0 ? `+${diffValue}` : `${diffValue}`;

                          return (
                            <tr key={item.productId} style={{ background: isMismatch ? 'rgba(239,68,68,0.02)' : isMissing ? 'rgba(245,158,11,0.02)' : 'transparent' }}>
                              <td style={{ fontWeight: 700 }}>
                                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.productName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit}</div>
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>
                                {item.expectedStock} {item.unit}
                              </td>
                              <td style={{ fontWeight: 700, fontSize: 14, color: item.managerLoggedStock === null ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                {item.managerLoggedStock !== null ? `${item.managerLoggedStock} ${item.unit}` : <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: 600 }}>Not Logged</span>}
                              </td>
                              <td>
                                <span style={{
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: diffValue < 0 ? '#ef4444' : diffValue > 0 ? '#10b981' : 'var(--text-muted)'
                                }}>
                                  {isMissing ? '—' : `${diffDisplay} ${item.unit}`}
                                </span>
                              </td>
                              <td>
                                {isCorrect && (
                                  <span className="badge badge-success" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <MdCheckCircle /> ✅ Correct
                                  </span>
                                )}
                                {isMismatch && (
                                  <span className="badge badge-danger" style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <MdCancel /> 🔴 Mismatch ({diffDisplay})
                                  </span>
                                )}
                                {isMissing && (
                                  <span className="badge badge-warning" style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <MdWarningAmber /> ⚠️ Missing Log
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${item.reviewStatus === 'Resolved' ? 'badge-success' : item.reviewStatus === 'Reviewed' ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                                  {item.reviewStatus || 'Pending Review'}
                                </span>
                              </td>
                              <td>
                                {!isCorrect && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                                    onClick={() => {
                                      setReviewItem(item);
                                      setReviewForm({ reviewStatus: item.reviewStatus === 'Pending Review' ? 'Reviewed' : item.reviewStatus, remarks: item.remarks || '' });
                                      setShowReviewModal(true);
                                    }}
                                  >
                                    <MdEdit /> Review / Resolve
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: PERMANENT DAILY RECONCILIATION HISTORY */}
          {scSubTab === 'history' && (
            <div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981' }}>
                      <MdHistory style={{ fontSize: 20 }} />
                      PERMANENT STOCK CORRECTNESS DAILY HISTORY
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Historical daily reconciliation audit logs — Click any date to view complete breakdown
                    </div>
                  </div>
                  <span className="badge badge-blue">{scHistory.length} Days Recorded</span>
                </div>

                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Operational Date</th>
                        <th>Products Checked</th>
                        <th style={{ color: 'var(--success)' }}>Correct</th>
                        <th style={{ color: 'var(--danger)' }}>Mismatch</th>
                        <th style={{ color: '#d97706' }}>Missing Log</th>
                        <th>Total Difference</th>
                        <th>Overall Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scHistoryLoading ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>Loading correctness history...</td></tr>
                      ) : scHistory.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No historical correctness records found.</td></tr>
                      ) : (
                        scHistory.map(row => (
                          <tr key={row.operationalDay}>
                            <td style={{ fontWeight: 800, fontSize: 14 }}>
                              {row.operationalDay}
                            </td>
                            <td style={{ fontWeight: 600 }}>{row.productsChecked} Products</td>
                            <td style={{ color: 'var(--success)', fontWeight: 700 }}>{row.correctCount}</td>
                            <td style={{ color: row.mismatchCount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700 }}>
                              {row.mismatchCount}
                            </td>
                            <td style={{ color: row.missingCount > 0 ? '#d97706' : 'var(--text-muted)', fontWeight: 700 }}>
                              {row.missingCount}
                            </td>
                            <td style={{ fontWeight: 700 }}>{row.totalDifference} Units</td>
                            <td>
                              <span className={`badge ${row.mismatchCount > 0 ? 'badge-danger' : row.missingCount > 0 ? 'badge-warning' : 'badge-success'}`} style={{ fontWeight: 800 }}>
                                {row.overallStatus}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}
                                onClick={() => fetchStockCorrectnessDetail(row.operationalDay)}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historical Detail Inspection Card (when a historical date is selected) */}
              {scSelectedHistory && (
                <div className="card">
                  <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(37,99,235,0.02))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)' }}>
                        <MdCalendarToday style={{ fontSize: 20 }} />
                        Historical Reconciliation Detail — {scSelectedHistory.operationalDay}
                      </span>
                    </div>
                    <button className="icon-btn" onClick={() => setScSelectedHistory(null)}><MdClose /></button>
                  </div>

                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Expected Stock</th>
                          <th>Manager Inventory Log</th>
                          <th>Difference</th>
                          <th>Status</th>
                          <th>Review Status</th>
                          <th>Reviewed By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scSelectedHistory.reconciliation.map(item => (
                          <tr key={item.productId || item.productName}>
                            <td style={{ fontWeight: 700 }}>{item.productName}</td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.expectedStock}</td>
                            <td style={{ fontWeight: 700 }}>{item.managerLoggedStock !== null ? item.managerLoggedStock : <span style={{ color: '#d97706', fontStyle: 'italic' }}>Not Logged</span>}</td>
                            <td style={{ fontWeight: 800, color: item.difference < 0 ? '#ef4444' : item.difference > 0 ? '#10b981' : 'var(--text-muted)' }}>
                              {item.difference > 0 ? `+${item.difference}` : item.difference}
                            </td>
                            <td>
                              <span className={`badge ${item.status === 'Correct' ? 'badge-success' : item.status === 'Mismatch' ? 'badge-danger' : 'badge-warning'}`} style={{ fontWeight: 700 }}>
                                {item.status}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${item.reviewStatus === 'Resolved' ? 'badge-success' : item.reviewStatus === 'Reviewed' ? 'badge-warning' : 'badge-danger'}`}>
                                {item.reviewStatus || 'Pending Review'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {item.reviewedBy || '—'} {item.remarks ? `(${item.remarks})` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Review & Resolve Modal for Super Admin */}
          <AnimatePresence>
            {showReviewModal && reviewItem && (
              <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowReviewModal(false)}>
                <motion.div className="modal" style={{ maxWidth: 480 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="modal-header">
                    <h2 className="modal-title" style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MdEdit style={{ color: '#10b981' }} /> Review Stock Discrepancy
                    </h2>
                    <button className="icon-btn" onClick={() => setShowReviewModal(false)}><MdClose /></button>
                  </div>
                  <form onSubmit={handleReviewSubmit}>
                    <div className="modal-body" style={{ padding: '20px 24px' }}>
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>{reviewItem.productName}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Operational Day: <strong>{scData?.operationalDay || selectedDate}</strong></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, fontSize: 13 }}>
                          <div>Expected: <strong style={{ color: 'var(--primary)' }}>{reviewItem.expectedStock}</strong></div>
                          <div>Manager Logged: <strong style={{ color: '#7c3aed' }}>{reviewItem.managerLoggedStock ?? 'Not Logged'}</strong></div>
                          <div>Difference: <strong style={{ color: '#ef4444' }}>{reviewItem.difference}</strong></div>
                          <div>Current Status: <strong style={{ color: '#d97706' }}>{reviewItem.status}</strong></div>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">Review Status *</label>
                        <select
                          className="form-input"
                          required
                          value={reviewForm.reviewStatus}
                          onChange={e => setReviewForm({ ...reviewForm, reviewStatus: e.target.value })}
                        >
                          <option value="Reviewed">Reviewed (Investigation in progress)</option>
                          <option value="Resolved">Resolved (Reconciled & cleared)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Remarks / Action Taken Notes</label>
                        <textarea
                          className="form-input"
                          rows={3}
                          placeholder="Enter administrative review notes (e.g. Manager confirmed physical fridge count)..."
                          value={reviewForm.remarks}
                          onChange={e => setReviewForm({ ...reviewForm, remarks: e.target.value })}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          Note: Resolving a mismatch records administrative review and does NOT alter historical inventory transactions.
                        </span>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }} disabled={submittingReview}>
                        {submittingReview ? 'Saving...' : 'Save Review Status'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Report Download Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div className="card" style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden', borderRadius: 14, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #1e40af, #1e3a8a)', color: '#fff', padding: '16px 20px' }}>
                <div>
                  <div className="card-title" style={{ color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <MdDownload style={{ fontSize: 20 }} /> Download Inventory Excel Report
                  </div>
                  <div style={{ fontSize: 11.5, color: '#93c5fd', marginTop: 3 }}>
                    Official 3-sheet workbook (Current Inventory, Shop Sale & Manager Inventory)
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setShowReportModal(false)} style={{ color: '#fff', border: 'none', background: 'transparent', cursor: 'pointer' }}><MdClose style={{ fontSize: 20 }} /></button>
              </div>

              <form onSubmit={handleDownloadReport} style={{ padding: 20 }}>
                {/* Exclusion Callout */}
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>📌 Excludes Stock Ledger Audit:</span> Workbook strictly contains 3 sheets: <strong>Current Inventory & DB2 Stock</strong>, <strong>Shop Sale</strong>, and <strong>Manager Inventory Log</strong>.
                </div>

                {/* Filter Selector */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Select Report Date Filter:</label>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="reportMode"
                        value="today"
                        checked={reportMode === 'today'}
                        onChange={() => setReportMode('today')}
                        style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                      />
                      Today's Report (Single Day)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <input
                        type="radio"
                        name="reportMode"
                        value="custom"
                        checked={reportMode === 'custom'}
                        onChange={() => {
                          setReportMode('custom');
                          if (!reportStartDate || !reportEndDate) {
                            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                            setReportStartDate(today);
                            setReportEndDate(today);
                          }
                        }}
                        style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                      />
                      Custom Date Range
                    </label>
                  </div>
                </div>

                {reportMode === 'today' ? (
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Report Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={reportDate}
                      onChange={e => setReportDate(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Start Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={reportStartDate}
                        onChange={e => setReportStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>End Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={reportEndDate}
                        onChange={e => setReportEndDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReportModal(false)} disabled={downloadingReport}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={downloadingReport} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MdDownload /> {downloadingReport ? 'Generating Excel...' : 'Generate & Download Excel'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
