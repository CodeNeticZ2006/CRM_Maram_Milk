import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  MdInventory, MdAdd, MdHistory, MdWarningAmber,
  MdCheckCircle, MdErrorOutline, MdRefresh, MdSearch,
  MdFilterList, MdEdit, MdSync, MdOutlineAssignmentReturn,
  MdClose, MdLocalShipping, MdQrCode, MdStickyNote2
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

  const [activeTab, setActiveTab]         = useState('inventory'); // 'inventory' | 'history'
  const [items, setItems]                 = useState([]);
  const [summary, setSummary]             = useState({ totalStock: 0, todayAddedStock: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: 0 });
  const [lowStockAlerts, setLowAlerts]   = useState([]);
  const [history, setHistory]             = useState([]);
  const [historyTotal, setHistoryTotal]   = useState(0);
  const [selectedDate, setSelectedDate]   = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [loading, setLoading]             = useState(true);
  const [historyLoading, setHistoryLoad] = useState(false);
  const [search, setSearch]               = useState('');
  const [historySearch, setHistSearch]    = useState('');
  const [isDb2Synced, setIsDb2Synced]     = useState(true);

  // Modals
  const [showAddModal, setShowAddModal]       = useState(false);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [confirmDialog, setConfirmDialog]     = useState(null); // { type: 'ADD'|'CORRECT', payload: {} }

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

  // ── Fetch Current Inventory ───────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory', { params: { date: selectedDate } });
      if (res.data?.success) {
        setItems(res.data.data || []);
        if (res.data.summary) setSummary(res.data.summary);
        if (res.data.lowStockAlerts) setLowAlerts(res.data.lowStockAlerts);
        setIsDb2Synced(true);
      }
    } catch (err) {
      toast.error('Failed to load inventory stock.');
      setIsDb2Synced(false);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // ── Fetch Stock History Ledger ─────────────────────────────────────────────
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

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchHistory]);

  // Open Add Stock Modal
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

  // Open Correct Stock Modal
  const openCorrectModal = (item) => {
    setCorrectForm({
      inventoryItemId: item.id,
      newTotalStock: item.currentStock,
      remarks: '',
    });
    setShowCorrectModal(true);
  };

  // Trigger Confirmation Step before submission
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

  // Execute Add Stock API call
  const executeAddStock = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/inventory/add-stock', confirmDialog.payload);
      if (res.data?.success) {
        toast.success(`✅ Stock updated! +${confirmDialog.qty} ${confirmDialog.unit} added for ${confirmDialog.item?.name}. DB2 Synced.`);
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

  // Execute Correct Stock API call
  const executeCorrectStock = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/inventory/correct-stock', confirmDialog.payload);
      if (res.data?.success) {
        toast.success(`✅ Stock corrected for ${confirmDialog.item?.name} to ${confirmDialog.newStock} units. DB2 Synced.`);
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

  // Filter items
  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.material || '').toLowerCase().includes(search.toLowerCase())
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
            {isDb2Synced && <span className="badge badge-success" style={{ fontSize: 11 }}>DB2 Live Sync</span>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Single source of truth for stock additions, audit history, and Manager App synchronization
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchInventory} disabled={loading}>
            <MdRefresh className={loading ? 'spin' : ''} /> {loading ? 'Syncing...' : 'Refresh'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab(t => t === 'inventory' ? 'history' : 'inventory')}>
            <MdHistory /> {activeTab === 'inventory' ? 'Stock Ledger' : 'Current Stock'}
          </button>
          <button className="btn btn-primary" id="inventory-add-stock-btn" onClick={() => openAddModal()}>
            <MdAdd style={{ fontSize: 18 }} /> Add Stock
          </button>
        </div>
      </div>

      {/* Super Admin Single Source Notice Banner */}
      <div style={{
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        gap: 12,
        marginBottom: 20,
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MdSync style={{ color: 'var(--primary)', fontSize: 20, flexShrink: 0 }} />
          <span>
            <strong>Centralized Inventory Rule:</strong> Only Super Admin CRM can add or adjust stock. Manager App users have read-only stock consumption.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Date:</label>
          <input
            type="date"
            className="form-input"
            style={{ padding: '4px 10px', fontSize: 12, width: 140 }}
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

      {/* Low Stock Alert Section (If any item is low stock) */}
      {lowStockAlerts.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdWarningAmber style={{ color: 'var(--warning)', fontSize: 20 }} />
              <span className="card-title" style={{ color: 'var(--warning)' }}>Low Stock Replenishment Alerts ({lowStockAlerts.length})</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stock below threshold (20 units)</span>
          </div>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {lowStockAlerts.map(alert => (
                <div key={alert.id} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flex: 1,
                  minWidth: 260,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{alert.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>
                      Current: {alert.currentStock} {alert.unit} (Threshold: {alert.minThreshold || 20})
                    </div>
                  </div>
                  <button className="btn btn-warning btn-sm" onClick={() => openAddModal(alert)} style={{ fontSize: 12 }}>
                    + Add Stock
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Controls & Search Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn btn-sm ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('inventory')}
              id="inventory-tab-current"
            >
              <MdInventory /> Current Inventory
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('history')}
              id="inventory-tab-ledger"
            >
              <MdHistory /> Stock Ledger Audit ({historyTotal})
            </button>
          </div>

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
        </div>
      </div>

      {/* TAB 1: CURRENT INVENTORY TABLE */}
      {activeTab === 'inventory' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Product Stock Inventory</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{filteredItems.length} products</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category / Material</th>
                  <th>Available Stock</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const statusColor = item.status === 'In Stock' ? 'badge-success' : item.status === 'Low Stock' ? 'badge-warning' : 'badge-danger';
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {item.id.slice(0,8)}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{item.material || 'Milk'}</td>
                      <td>
                        <span style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: item.currentStock <= 0 ? 'var(--danger)' : item.currentStock <= 20 ? 'var(--warning)' : 'var(--text-primary)'
                        }}>
                          {item.currentStock.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.unit}</td>
                      <td>
                        <span className={`badge ${statusColor}`}>{item.status}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Today'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => openAddModal(item)}
                            id={`inventory-add-btn-${item.id}`}
                          >
                            <MdAdd /> Add Stock
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => openCorrectModal(item)}
                            id={`inventory-correct-btn-${item.id}`}
                          >
                            <MdEdit /> Correct
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No inventory items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: READ-ONLY STOCK HISTORY LEDGER TABLE */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">Stock History Ledger</span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Read-only immutable audit log of all stock additions and corrections
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
                        {row.supplier && <div>🏢 {row.supplier}</div>}
                        {row.batch_number && <div>📦 Batch: {row.batch_number}</div>}
                        {!row.supplier && !row.batch_number && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12.5, fontWeight: 600 }}>{row.added_by}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{row.remarks || '—'}</td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No history ledger entries recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL 1: ADD STOCK ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              className="card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden' }}
            >
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdAdd style={{ color: 'var(--primary)' }} /> Add Inventory Stock
                </span>
                <button className="icon-btn" onClick={() => setShowAddModal(false)}><MdClose /></button>
              </div>

              <form onSubmit={triggerAddConfirmation} style={{ padding: 20 }}>
                {/* Product Dropdown */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Select Product *</label>
                  <select
                    className="form-input"
                    value={addForm.inventoryItemId}
                    onChange={e => {
                      const sel = items.find(i => i.id === e.target.value);
                      setAddForm(f => ({ ...f, inventoryItemId: e.target.value, unit: sel ? sel.unit : 'Litres' }));
                    }}
                    required
                    id="add-stock-product-select"
                  >
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name} (Available: {i.currentStock} {i.unit})</option>
                    ))}
                  </select>
                </div>

                {/* Quantity & Unit */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Quantity to Add *</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      placeholder="e.g. 50"
                      value={addForm.quantityAdded}
                      onChange={e => setAddForm(f => ({ ...f, quantityAdded: e.target.value }))}
                      required
                      min="0.1"
                      id="add-stock-qty-input"
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

                {/* Supplier & Batch Number */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Supplier (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Mother Dairy / Local Dairy"
                      value={addForm.supplier}
                      onChange={e => setAddForm(f => ({ ...f, supplier: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Batch Number (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. BATCH-2026-08A"
                      value={addForm.batchNumber}
                      onChange={e => setAddForm(f => ({ ...f, batchNumber: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Remarks / Notes</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="e.g. Morning fresh milk batch received at warehouse"
                    value={addForm.remarks}
                    onChange={e => setAddForm(f => ({ ...f, remarks: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" id="add-stock-submit-btn">Continue to Confirm</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: CORRECT STOCK ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCorrectModal && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              className="card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden' }}
            >
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MdEdit style={{ color: 'var(--warning)' }} /> Stock Quantity Correction
                </span>
                <button className="icon-btn" onClick={() => setShowCorrectModal(false)}><MdClose /></button>
              </div>

              <form onSubmit={triggerCorrectConfirmation} style={{ padding: 20 }}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Correct Total Available Stock *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={correctForm.newTotalStock}
                    onChange={e => setCorrectForm(f => ({ ...f, newTotalStock: e.target.value }))}
                    required
                    min="0"
                    id="correct-stock-qty-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Reason / Remarks for Adjustment *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="e.g. Audit correction after physical stock count at warehouse"
                    value={correctForm.remarks}
                    onChange={e => setCorrectForm(f => ({ ...f, remarks: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCorrectModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-warning" id="correct-stock-submit-btn">Continue to Confirm</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CONFIRMATION DIALOG ───────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              className="card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: '100%', maxWidth: 440, padding: 24 }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
                {confirmDialog.type === 'ADD' ? '🔒 Confirm Stock Addition' : '🔒 Confirm Stock Correction'}
              </div>

              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                {confirmDialog.type === 'ADD' ? (
                  <>
                    Are you sure you want to add <strong>+{confirmDialog.qty} {confirmDialog.unit}</strong> to <strong>{confirmDialog.item?.name}</strong>?
                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div>Current Stock: {confirmDialog.item?.currentStock} {confirmDialog.unit}</div>
                      <div style={{ fontWeight: 700, color: 'var(--success)' }}>New Total Stock: {confirmDialog.item?.currentStock + confirmDialog.qty} {confirmDialog.unit}</div>
                    </div>
                  </>
                ) : (
                  <>
                    Are you sure you want to set available stock of <strong>{confirmDialog.item?.name}</strong> to <strong>{confirmDialog.newStock} units</strong>?
                  </>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                ⚡ This action will write a read-only audit log in CRM and synchronize live with Manager App DB2.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)} disabled={submitting}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={confirmDialog.type === 'ADD' ? executeAddStock : executeCorrectStock}
                  disabled={submitting}
                  id="confirm-inventory-save-btn"
                >
                  {submitting ? 'Saving & Syncing...' : 'Yes, Confirm & Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
