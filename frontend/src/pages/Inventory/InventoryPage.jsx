import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  MdInventory, MdAdd, MdHistory, MdWarningAmber,
  MdCheckCircle, MdErrorOutline, MdRefresh, MdSearch,
  MdFilterList, MdEdit, MdSync, MdOutlineAssignmentReturn,
  MdClose, MdLocalShipping, MdQrCode, MdStickyNote2,
  MdCalendarToday, MdCancel, MdEventBusy, MdPerson,
  MdDirectionsBike, MdVerified, MdWarning, MdEventNote,
  MdChevronLeft, MdChevronRight, MdSave, MdBusiness,
  MdInventory2, MdFlashOn, MdStorefront, MdDateRange
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import '../../pages/RouteIntelligence/components/RouteIntelligence.css';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function InventoryPage() {
  const { admin } = useAuthStore();
  const isSuperAdmin = (admin?.email || '').toLowerCase() === 'admin@marammilk.com' ||
                       admin?.role === 'SuperAdmin' || admin?.role === 'Super Admin';

  const [activeTab, setActiveTab]         = useState('inventory'); // 'inventory' | 'history' | 'attendance'
  const [items, setItems]                 = useState([]);
  const [summary, setSummary]             = useState({ totalStock: 0, todayAddedStock: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: 0 });
  const [lowStockAlerts, setLowAlerts]   = useState([]);
  const [history, setHistory]             = useState([]);
  const [historyTotal, setHistoryTotal]   = useState(0);
  const [selectedDate, setSelectedDate]   = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [historyLoading, setHistoryLoad] = useState(false);
  const [search, setSearch]               = useState('');
  const [historySearch, setHistSearch]    = useState('');
  const [isDb2Synced, setIsDb2Synced]     = useState(true);

  // DP Attendance State
  const [dpAttendance, setDpAttendance]   = useState([]);
  const [allDps, setAllDps]               = useState([]);
  const [timeFilter, setTimeFilter]       = useState('this_month');
  const [selectedDpId, setSelectedDpId]   = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [attendanceLoad, setAttLoad]     = useState(false);
  const [selectedDayDetail, setDayDetail] = useState(null);

  // Manager Inventory State
  const [managerInvData, setManagerInvData]       = useState(null);
  const [managerInvLoading, setManagerInvLoading] = useState(false);
  const [miDate, setMiDate]                       = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [miStartDate, setMiStartDate]             = useState('');
  const [miEndDate, setMiEndDate]                 = useState('');
  const [miRangeMode, setMiRangeMode]             = useState(false);

  // Calendar always starts in the current IST month and fetches that exact month from DB2.
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => {
    const istDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [year, month] = istDate.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });

  // Stock Add/Update Modals
  const [showAddModal, setShowAddModal]       = useState(false);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [showDb2UpdateModal, setShowDb2UpdateModal] = useState(null); // DB2 specific modal item
  const [db2Form, setDb2Form]                 = useState({ newStockAdded: 0, currentStock: 0 });
  const [confirmDialog, setConfirmDialog]     = useState(null);

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

  // Fetch Inventory (incorporating DB2 Manager App Stock fields)
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory', { params: { date: selectedDate } });
      if (res.data?.success) {
        const rawData = res.data.data || [];
        const sortedData = [...rawData].sort((a, b) => getItemPriority(a) - getItemPriority(b));
        setItems(sortedData);
        if (res.data.summary) setSummary(res.data.summary);
        if (res.data.lowStockAlerts) setLowAlerts(res.data.lowStockAlerts);
        if (res.data.availableDates) setAvailableDates(res.data.availableDates);
        setIsDb2Synced(true);
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

  // Fetch DP Attendance Audit
  const fetchDpAttendance = useCallback(async () => {
    setAttLoad(true);
    try {
      const params = {
        timeFilter,
        dpId: selectedDpId,
        month: `${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(2, '0')}`,
      };
      if (timeFilter === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const res = await api.get('/inventory/dp-attendance', { params });
      if (res.data?.success) {
        setDpAttendance(res.data.data || []);
        if (res.data.allDps) setAllDps(res.data.allDps);
      }
    } catch {
      toast.error('Failed to load DP attendance audit.');
    } finally {
      setAttLoad(false);
    }
  }, [timeFilter, selectedDpId, startDate, endDate, currentCalendarDate]);

  // Fetch Manager Inventory (ShopSale + ManagerInventoryLog from DB2)
  const fetchManagerInventory = useCallback(async () => {
    setManagerInvLoading(true);
    try {
      const params = miRangeMode && miStartDate && miEndDate
        ? { startDate: miStartDate, endDate: miEndDate }
        : { date: miDate };
      const res = await api.get('/inventory/manager-inventory', { params });
      if (res.data?.success) {
        setManagerInvData(res.data);
      }
    } catch {
      toast.error('Failed to load Manager Inventory data.');
    } finally {
      setManagerInvLoading(false);
    }
  }, [miDate, miStartDate, miEndDate, miRangeMode]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    else if (activeTab === 'attendance') fetchDpAttendance();
    else if (activeTab === 'manager-inventory') fetchManagerInventory();
  }, [activeTab, fetchHistory, fetchDpAttendance, fetchManagerInventory]);

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

  const openAddModal = (item = null) => {
    const targetItem = item || items[0];
    setAddForm({
      inventoryItemId: targetItem ? targetItem.id : '',
      quantityAdded: '',
      unit: targetItem ? targetItem.unit : 'Litres',
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

    const selectedItem = items.find(i => i.id === addForm.inventoryItemId);
    setConfirmDialog({
      type: 'ADD',
      item: selectedItem,
      qty,
      unit: addForm.unit,
      payload: { ...addForm, quantityAdded: qty },
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
      const res = await api.post('/inventory/add-stock', confirmDialog.payload);
      if (res.data?.success) {
        toast.success(`Stock updated! +${confirmDialog.qty} ${confirmDialog.unit} added for ${confirmDialog.item?.name}. DB2 Synced.`);
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
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.material || '').toLowerCase().includes(search.toLowerCase())
  );

  // Generate 7-column Monthly Sun-Sat Calendar Grid (Picture 2 format)
  const getMonthGridDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = [];
    // Leading empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(null);
    }
    // Days of month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      grid.push(d);
    }
    return grid;
  };

  const handlePrevMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const targetDpRecord = selectedDpId
    ? dpAttendance.find(d => d.dpId === selectedDpId)
    : dpAttendance[0];

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.25 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
              Inventory & DP Audit Management
            </h1>
            {isDb2Synced && <span className="badge badge-success" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MdSync /> DB2 Live Sync</span>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Single source of truth for DB2 stock, inventory ledger, and Delivery Person attendance audit
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
              className={`btn btn-sm ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('attendance')}
              id="inventory-tab-dp-attendance"
            >
              <MdCalendarToday /> DP Attendance Audit (DB2)
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'manager-inventory' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('manager-inventory')}
              id="inventory-tab-manager-inventory"
              style={{ background: activeTab === 'manager-inventory' ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '', borderColor: activeTab === 'manager-inventory' ? '#7c3aed' : '' }}
            >
              <MdStorefront /> Manager Inventory
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
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdSync style={{ color: 'var(--primary)', fontSize: 18 }} />
              <span><strong>DB2 Manager App Live Stock (maram_milk_db)</strong> — Tracks carried-over stock, new stock added, and expected stock.</span>
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
                <div className="stat-value" style={{ color: 'var(--primary)' }}>{summary.totalStock.toLocaleString()}</div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', fontSize: 20 }}><MdInventory /></div>
              </div>
              <div className="stat-label">Total Stock Available</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Across {summary.totalProducts} registered products</div>
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
                <div className="stat-value" style={{ color: 'var(--success)' }}>+{summary.todayAddedStock.toLocaleString()}</div>
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

          {/* Table with Manager App Inventory fields merged (Carried Over, New Stock Added, Current Available, Expected) */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Product Stock & DB2 Manager App Inventory</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{filteredItems.length} products</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 150 }}>Item Name</th>
                    <th>Material / Unit</th>
                    <th>Carried Over</th>
                    <th>New Stock Added</th>
                    <th>Current Available</th>
                    <th>Expected Stock</th>
                    <th>Status</th>
                    <th style={{ minWidth: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const statusColor = item.status === 'In Stock' ? 'badge-success' : item.status === 'Low Stock' ? 'badge-warning' : 'badge-danger';
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700 }}>
                          <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.name}</div>
                        </td>
                        <td><span className="badge badge-gray">{item.material || 'Milk'} ({item.unit})</span></td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.carriedOverStock ?? 0} {item.unit}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>+{item.newStockAdded ?? 0} {item.unit}</td>
                        <td>
                          <span style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: item.currentStock <= 0 ? 'var(--danger)' : item.currentStock <= 20 ? 'var(--warning)' : 'var(--text-primary)'
                          }}>
                            {item.currentStock.toLocaleString()} {item.unit}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.expectedStock ?? item.currentStock} {item.unit}</td>
                        <td><span className={`badge ${statusColor}`}>{item.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => openAddModal(item)}>
                              <MdAdd /> Add
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => {
                              setShowDb2UpdateModal(item);
                              setDb2Form({ newStockAdded: item.newStockAdded || 0, currentStock: item.currentStock || 0 });
                            }}>
                              <MdEdit /> DB2 Override
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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

      {/* ── TAB 3: DP ATTENDANCE AUDIT (NEW MONTHLY CALENDAR GRID & popup clean-up) ───────────────────────── */}
      {activeTab === 'attendance' && (
        <div>
          {/* Filter Bar */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdFilterList style={{ color: 'var(--primary)', fontSize: 20 }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Time Filter:</span>
                  <select
                    className="form-input"
                    style={{ width: 150 }}
                    value={timeFilter}
                    onChange={e => {
                      const nextFilter = e.target.value;
                      setTimeFilter(nextFilter);
                      if (nextFilter === 'custom' && (!startDate || !endDate)) {
                        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                        setStartDate(today);
                        setEndDate(today);
                      }
                    }}
                  >
                    <option value="this_month">This Month</option>
                    <option value="today">Today</option>
                    <option value="this_week">This Week</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {timeFilter === 'custom' && (
                    <>
                      <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} aria-label="Attendance start date" />
                      <span style={{ color: 'var(--text-muted)' }}>to</span>
                      <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} aria-label="Attendance end date" />
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                  <MdPerson style={{ color: 'var(--primary)', fontSize: 20 }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Select DP for Audit Calendar:</span>
                  <select
                    className="form-input"
                    style={{ width: 220 }}
                    value={selectedDpId}
                    onChange={e => setSelectedDpId(e.target.value)}
                  >
                    <option value="">— Select Delivery Person —</option>
                    {allDps.map(dp => (
                      <option key={dp.id} value={dp.id}>{dp.name} ({dp.dpCode})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Overview Table with dedicated NO. OF DAYS ABSENT column */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdDirectionsBike style={{ color: 'var(--primary)' }} /> Delivery Person Attendance & Absence Audit Table
              </div>
              <span className="badge badge-blue">{dpAttendance.length} Delivery Persons</span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>DELIVERY PERSON</th>
                    <th style={{ minWidth: 110 }}>VEHICLE NO</th>
                    <th style={{ minWidth: 120 }}>ASSIGNED ROUTE</th>
                    <th>TOTAL DAYS</th>
                    <th style={{ color: '#10b981' }}>PRESENT DAYS</th>
                    <th style={{ color: '#ef4444', minWidth: 140 }}>NO. OF DAYS ABSENT</th>
                    <th style={{ color: '#d97706', minWidth: 120 }}>STANDBY DAYS</th>
                    <th>OVERALL ATTENDANCE %</th>
                    <th style={{ minWidth: 180 }}>GREEN / RED / YELLOW PREVIEW</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoad ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48 }}>Loading DB2 attendance records...</td></tr>
                  ) : dpAttendance.map(dp => (
                    <tr
                      key={dp.dpId}
                      style={{ cursor: 'pointer', background: selectedDpId === dp.dpId ? 'rgba(59,130,246,0.05)' : 'transparent' }}
                      onClick={() => setSelectedDpId(dp.dpId)}
                    >
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MdPerson />
                          </div>
                          <div>
                            <div>{dp.dpName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dp.dpCode}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{dp.vehicleNumber}</td>
                      <td><span className="badge badge-gray">{dp.assignedRoute}</span></td>
                      <td style={{ fontWeight: 600 }}>{dp.totalDays} Days</td>
                      <td>
                        <span className="badge badge-success" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdCheckCircle /> {dp.presentDays} Present
                        </span>
                      </td>
                      {/* DEDICATED HIGHLIGHTED COLUMN FOR DAYS ABSENT */}
                      <td>
                        <span className="badge badge-danger" style={{ fontWeight: 800, fontSize: 12.5, padding: '4px 12px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdCancel /> {dp.absentDays} Days Absent
                        </span>
                      </td>
                      {/* DEDICATED HIGHLIGHTED COLUMN FOR STANDBY DAYS */}
                      <td>
                        <span className="badge badge-warning" style={{ fontWeight: 800, fontSize: 12.5, padding: '4px 12px', background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdEventNote /> {dp.standbyDays || 0} Standby
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${dp.attendancePercentage >= 90 ? 'badge-success' : dp.attendancePercentage >= 75 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 800 }}>
                          {dp.attendancePercentage}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 180 }}>
                          {dp.calendarGrid.slice(0, 14).map((cd, idx) => {
                            const st = String(cd.status).toUpperCase();
                            const isPres = st === 'PRESENT';
                            const isAbs = st === 'ABSENT';
                            const isStby = st === 'STANDBY' || st === 'ON_CALL';
                            return (
                              <div
                                key={idx}
                                title={`${cd.date}: ${cd.status}`}
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 2,
                                  background: isPres ? '#10b981' : isAbs ? '#ef4444' : isStby ? '#f59e0b' : '#94a3b8',
                                }}
                              />
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── FULL 7-COLUMN MONTHLY GRID CALENDAR (MATCHING PICTURE 2 FORMAT) ───────────────────────── */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MdEventNote style={{ color: 'var(--primary)', fontSize: 22 }} />
                <div>
                  <span className="card-title">
                    Monthly Audit Calendar: <strong>{targetDpRecord ? targetDpRecord.dpName : 'Delivery Person'}</strong>
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Click any day cell to view assigned route details
                  </div>
                </div>
              </div>

              {/* Month Navigation (< August 2026 >) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="icon-btn" onClick={handlePrevMonth} title="Previous Month">
                  <MdChevronLeft style={{ fontSize: 22 }} />
                </button>
                <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', minWidth: 130, textAlign: 'center' }}>
                  {currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button className="icon-btn" onClick={handleNextMonth} title="Next Month">
                  <MdChevronRight style={{ fontSize: 22 }} />
                </button>
              </div>

              {/* Status Legend (PRESENT, ABSENT & STANDBY) */}
              <div style={{ display: 'flex', gap: 14, fontSize: 12, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#10b981', borderRadius: 2 }} /> Green = PRESENT</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} /> Red = ABSENT</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} /> Yellow = STANDBY</span>
              </div>
            </div>

            <div className="card-body">
              {/* Responsive Touch-Scroll Grid Container for Mobile Devices */}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ minWidth: 540 }}>
                  {/* 7-Column Sun to Sat Day Headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
                  </div>

                  {/* Sun-Sat Day Cells Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {getMonthGridDays().map((dayNum, idx) => {
                  if (dayNum === null) {
                    return <div key={`empty-${idx}`} style={{ minHeight: 64, background: 'transparent' }} />;
                  }

                  const year = currentCalendarDate.getFullYear();
                  const monthStr = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
                  const dayStr = String(dayNum).padStart(2, '0');
                  const fullDateStr = `${year}-${monthStr}-${dayStr}`;
                  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                  const isFutureDate = fullDateStr > todayIST;

                  const DB2_START_DATE = '2026-07-15';
                  const isBeforeDb2Date = fullDateStr < DB2_START_DATE;

                  const dayRecord = targetDpRecord?.calendarGrid?.find(c => c.date === fullDateStr) || {
                    date: fullDateStr,
                    status: isFutureDate ? 'Upcoming' : isBeforeDb2Date ? 'No DB2 Record' : 'ABSENT',
                    isFuture: isFutureDate,
                    isBeforeDb2: isBeforeDb2Date,
                    route: targetDpRecord?.assignedRoute || null,
                  };

                  const isInactiveCell = dayRecord.status === 'Upcoming' || dayRecord.status === 'No DB2 Record' || dayRecord.isFuture || dayRecord.isBeforeDb2;
                  const stUpper = String(dayRecord.status).toUpperCase();
                  const isPres = stUpper === 'PRESENT';
                  const isAbs = stUpper === 'ABSENT';
                  const isStby = stUpper === 'STANDBY' || stUpper === 'ON_CALL';

                  const bgColor = isInactiveCell
                    ? 'rgba(255,255,255,0.02)'
                    : isPres
                    ? 'rgba(16,185,129,0.12)'
                    : isAbs
                    ? 'rgba(239,68,68,0.14)'
                    : 'rgba(245,158,11,0.12)';

                  const borderColor = isInactiveCell
                    ? 'var(--border)'
                    : isPres
                    ? 'rgba(16,185,129,0.35)'
                    : isAbs
                    ? 'rgba(239,68,68,0.4)'
                    : 'rgba(245,158,11,0.35)';

                  const textColor = isInactiveCell
                    ? 'var(--text-muted)'
                    : isPres
                    ? '#10b981'
                    : isAbs
                    ? '#ef4444'
                    : '#d97706';

                  return (
                    <motion.div
                      key={`day-${dayNum}`}
                      whileHover={{ scale: isInactiveCell ? 1 : 1.03 }}
                      onClick={() => !isInactiveCell && setDayDetail({ dpName: targetDpRecord?.dpName || 'Delivery Person', ...dayRecord })}
                      style={{
                        minHeight: 68,
                        borderRadius: 10,
                        padding: '8px 10px',
                        background: bgColor,
                        border: `1px solid ${borderColor}`,
                        cursor: isInactiveCell ? 'default' : 'pointer',
                        opacity: isInactiveCell ? 0.4 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' }}>
                        {dayNum}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: textColor, textAlign: 'right' }}>
                        {isInactiveCell ? '—' : dayRecord.status}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* ── SIMPLIFIED ATTENDANCE DETAIL POPUP (PICTURE 3 REQUEST: NO CHECK-IN/OUT, SHOW ROUTE ONLY) ── */}
      <AnimatePresence>
        {selectedDayDetail && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDayDetail(null)}>
            <motion.div className="modal" style={{ maxWidth: 420 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ fontSize: 18, fontWeight: 800 }}>Attendance Detail</h2>
                <button className="icon-btn" onClick={() => setDayDetail(null)}><MdClose /></button>
              </div>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {selectedDayDetail.dpName}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Date: <strong>{selectedDayDetail.date}</strong>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Status:{' '}
                  <strong style={{ color: selectedDayDetail.status === 'Present' ? '#10b981' : selectedDayDetail.status === 'Absent' ? '#ef4444' : '#d97706' }}>
                    {selectedDayDetail.status}
                  </strong>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  Route: <strong style={{ color: 'var(--text-primary)' }}>{selectedDayDetail.route || 'Manager Assigned DB2 Route'}</strong>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <label className="form-label">Select Product *</label>
                  <select
                    className="form-input"
                    value={addForm.inventoryItemId}
                    onChange={e => setAddForm(f => ({ ...f, inventoryItemId: e.target.value }))}
                    required
                  >
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name} (Available: {i.currentStock} {i.unit})</option>
                    ))}
                  </select>
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
                  {/* Product Summary Cards */}
                  {managerInvData.managerInventory.byProduct.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                      {managerInvData.managerInventory.byProduct.map((p, idx) => {
                        const colors = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b'];
                        const color = colors[idx % colors.length];
                        return (
                          <div key={p.productName} className="stat-card" style={{ '--card-accent': color, flex: '1 1 180px', minWidth: 160 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="stat-value" style={{ color }}>{p.totalQty.toLocaleString()}</div>
                              <div style={{ padding: 8, borderRadius: 8, background: `${color}1a`, color, fontSize: 20 }}><MdInventory /></div>
                            </div>
                            <div className="stat-label" style={{ fontSize: 12 }}>{p.productName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Unit: {p.unit}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

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
                          {managerInvData.managerInventory.rows.map((row, idx) => (
                            <tr key={row.id}>
                              <td style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                              <td>
                                <span className="badge badge-gray" style={{ fontFamily: 'monospace' }}>{row.date}</span>
                              </td>
                              <td style={{ fontWeight: 700, fontSize: 13.5 }}>{row.productName || '—'}</td>
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
                          ))}
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
    </motion.div>
  );
}
