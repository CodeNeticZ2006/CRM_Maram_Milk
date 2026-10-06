import { useState, useEffect, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Search, RefreshCw, Pause, Play, Trash2, Clock,
  Pencil, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  User, Package, MapPin, Truck, AlertCircle, CheckCircle2, Zap,
  ClipboardList, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const WEEKDAY_SHORT = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun' };

const FREQ_LABELS = {
  DAILY: { label: 'Daily', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  ALTERNATE_DAY: { label: 'Alternate Day', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  CUSTOM_WEEKLY: { label: 'Custom Weekly', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

// ── Frequency Badge ───────────────────────────────────────────────
function FreqBadge({ type }) {
  const f = FREQ_LABELS[type] || FREQ_LABELS.DAILY;
  return (
    <span style={{ background: f.bg, color: f.color, borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
      {f.label}
    </span>
  );
}

// ── Add/Edit Subscription Modal ───────────────────────────────────
function SubscriptionModal({ editData, onClose, onSaved }) {
  const isEdit = Boolean(editData);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    if (editData) {
      const name = editData.customer_name || editData.name || editData.customer?.name;
      const id = editData.customer_id || editData.id;
      if (name || id) {
        return {
          id: id,
          name: name || 'Selected Customer',
          customer_code: editData.customer_code || editData.customer?.customer_code || '',
          phone: editData.customer_phone || editData.phone || editData.customer?.phone || '',
          address: editData.address || editData.customer?.address || '',
          area: editData.area || editData.route_name || '',
        };
      }
    }
    return null;
  });
  const [routes, setRoutes] = useState([]);
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [form, setForm] = useState({
    customer_id: editData?.customer_id || '',
    frequency_type: editData?.frequency_type || 'DAILY',
    start_date: editData?.start_date ? editData.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
    first_delivery_date: editData?.first_delivery_date ? editData.first_delivery_date.split('T')[0] : (editData?.start_date ? editData.start_date.split('T')[0] : ''),
    billing_cycle_start: editData?.billing_cycle_start ? editData.billing_cycle_start.split('T')[0] : (editData?.start_date ? editData.start_date.split('T')[0] : ''),
    hub: editData?.hub || '',
    area: editData?.area || '',
    delivery_person_name: editData?.delivery_person_name || '',
    delivery_person_id: editData?.delivery_person_id || '',
    customer_type: editData?.customer_type || 'Regular',
    delivery_type: editData?.delivery_type || 'Doorstep',
    notes: editData?.notes || '',
    custom_weekdays: editData?.schedule?.custom_weekdays || [],
    items: editData?.items && editData.items.length > 0
      ? editData.items.map(i => ({ _id: i.id || Math.random(), product_id: i.product_id, quantity: i.quantity, rate_snapshot: i.rate_snapshot || '' }))
      : [{ _id: 1, product_id: '', quantity: 1, rate_snapshot: '' }],
  });

  useEffect(() => {
    Promise.all([
      api.get('/masters/products').then(r => setProducts(r.data.data || [])),
      api.get('/masters/routes').then(r => setRoutes(r.data.data || [])),
      api.get('/access-control/delivery-persons').then(r => setDeliveryPersons(r.data.data || [])),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    if (editData) {
      const name = editData.customer_name || editData.name || editData.customer?.name;
      const id = editData.customer_id;
      if (name) {
        setSelectedCustomer({
          id: id,
          name: name,
          customer_code: editData.customer_code || editData.customer?.customer_code || '',
          phone: editData.customer_phone || editData.phone || editData.customer?.phone || '',
          address: editData.address || editData.customer?.address || '',
          area: editData.area || editData.route_name || '',
        });
        setForm(f => ({ ...f, customer_id: id || f.customer_id }));
      } else if (id) {
        // Fetch customer details if name is missing from editData
        api.get(`/customers/${id}`).then(r => {
          const c = r.data?.data;
          if (c) {
            setSelectedCustomer({
              id: c.id,
              name: c.name,
              customer_code: c.customer_code,
              phone: c.phone,
              address: c.address,
              area: c.route_name || editData.area || '',
            });
            setForm(f => ({ ...f, customer_id: c.id }));
          }
        }).catch(() => {});
      }
    }
  }, [editData]);

  const fetchCustomers = (q = '') => {
    setCustomerLoading(true);
    const params = q.trim() ? { search: q.trim(), limit: 12 } : { limit: 12 };
    api.get('/customers', { params })
      .then(r => setCustomers(r.data.data || []))
      .catch(() => {})
      .finally(() => setCustomerLoading(false));
  };

  useEffect(() => {
    if (!selectedCustomer) {
      const timer = setTimeout(() => {
        fetchCustomers(customerSearch);
      }, customerSearch ? 250 : 0);
      return () => clearTimeout(timer);
    } else {
      setCustomers([]);
      setShowCustomerDropdown(false);
    }
  }, [customerSearch, selectedCustomer]);

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { _id: Date.now() + Math.random(), product_id: '', quantity: 1, rate_snapshot: '' }]
  }));

  const removeItem = (idx) => {
    setForm(f => {
      if (f.items.length <= 1) {
        // Reset single item fields so user can easily clear
        return {
          ...f,
          items: [{ _id: Date.now(), product_id: '', quantity: 1, rate_snapshot: '' }]
        };
      }
      return {
        ...f,
        items: f.items.filter((_, i) => i !== idx)
      };
    });
  };

  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      if (prod) items[idx].rate_snapshot = prod.price_per_unit;
    }
    return { ...f, items };
  });

  const toggleWeekday = (day) => {
    setForm(f => ({
      ...f,
      custom_weekdays: f.custom_weekdays.includes(day)
        ? f.custom_weekdays.filter(d => d !== day)
        : [...f.custom_weekdays, day],
    }));
  };

  const validateStep = (s) => {
    if (s === 1) {
      if (!selectedCustomer && !form.customer_id) {
        toast.error('Please select a customer to proceed.');
        return false;
      }
    }
    if (s === 2) {
      if (!form.start_date) {
        toast.error('Please select a subscription start date.');
        return false;
      }
      if (form.frequency_type === 'CUSTOM_WEEKLY' && (!form.custom_weekdays || form.custom_weekdays.length === 0)) {
        toast.error('Please select at least one delivery weekday for Custom Weekly.');
        return false;
      }
    }
    if (s === 3) {
      const validItems = form.items.filter(i => i.product_id && parseFloat(i.quantity) > 0);
      if (validItems.length === 0) {
        toast.error('Please configure at least one product with quantity > 0.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep(s => Math.min(4, s + 1));
  };

  const handleStepClick = (targetStep) => {
    if (targetStep > step) {
      for (let s = step; s < targetStep; s++) {
        if (!validateStep(s)) return;
      }
    }
    setStep(targetStep);
  };

  const handleSubmit = async () => {
    if (!form.customer_id) return toast.error('Please select a customer.');
    if (form.frequency_type === 'CUSTOM_WEEKLY' && form.custom_weekdays.length === 0) {
      return toast.error('Select at least one weekday for Custom Weekly.');
    }
    const validItems = form.items.filter(i => i.product_id && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      return toast.error('At least one product with quantity > 0 is required.');
    }

    setLoading(true);
    try {
      const totalQty = validItems.reduce((acc, i) => acc + (parseFloat(i.quantity) || 0), 0);
      const payload = {
        ...form,
        items: validItems,
        quantity: totalQty,
        product_id: validItems[0]?.product_id,
      };
      if (isEdit) {
        await api.put(`/subscriptions/${editData.id}`, payload);
        toast.success('Subscription updated successfully!');
      } else {
        await api.post('/subscriptions', payload);
        toast.success('Subscription created successfully!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save subscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal"
        style={{ maxWidth: 740, width: '95%', background: '#ffffff', borderRadius: 16, overflow: 'visible' }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="modal-header" style={{ padding: '22px 26px 0' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700 }}>
            {isEdit ? <><Pencil size={18} style={{ color: 'var(--primary)' }} /> Edit Subscription</> : <><Plus size={20} style={{ color: 'var(--primary)' }} /> New Subscription</>}
          </h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 26px', marginTop: 14 }}>
          {['Customer', 'Schedule', 'Products', 'Details'].map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => handleStepClick(i + 1)}
              style={{
                background: 'none', border: 'none', padding: '12px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                color: step === i + 1 ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: step === i + 1 ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: step === i + 1 ? 'var(--primary)' : 'rgba(148,163,184,0.2)',
                color: step === i + 1 ? '#ffffff' : 'var(--text-secondary)',
                fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {i + 1}
              </span>
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ minHeight: 340, padding: '22px 26px' }}>
          {/* Step 1: Customer Selection */}
          {step === 1 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="form-group" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                    Select Customer <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  {!selectedCustomer && (
                    <span style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>
                      Required to continue
                    </span>
                  )}
                </div>
                
                {selectedCustomer ? (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(34,197,94,0.08)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={16} /> {selectedCustomer.name}
                        {selectedCustomer.customer_code && (
                          <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                            {selectedCustomer.customer_code}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>
                        {selectedCustomer.phone && <>Phone: <strong>{selectedCustomer.phone}</strong></>}
                        {selectedCustomer.address && ` · ${selectedCustomer.address}`}
                        {selectedCustomer.area && ` · Route: ${selectedCustomer.area}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12, height: 32, padding: '0 12px', background: '#ffffff', border: '1px solid #cbd5e1' }}
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch('');
                        setForm(f => ({ ...f, customer_id: '' }));
                        setShowCustomerDropdown(true);
                        fetchCustomers('');
                      }}
                    >
                      <X size={14} /> Change Customer
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        className="form-input"
                        style={{
                          paddingLeft: 36,
                          paddingRight: customerLoading ? 36 : 12,
                          width: '100%',
                          height: 42,
                          border: !form.customer_id ? '1.5px solid #93c5fd' : undefined
                        }}
                        placeholder="Search by customer name, phone, or code (MM00...)"
                        value={customerSearch}
                        onChange={e => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => {
                          setShowCustomerDropdown(true);
                          if (customers.length === 0) fetchCustomers(customerSearch);
                        }}
                        autoFocus
                      />
                      {customerLoading && (
                        <div className="loading-spinner" style={{ width: 16, height: 16, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      )}
                    </div>

                    {showCustomerDropdown && customers.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 10,
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                        maxHeight: 220,
                        overflowY: 'auto',
                        marginTop: 4
                      }}>
                        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          CLICK TO SELECT A CUSTOMER:
                        </div>
                        {customers.map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setForm(f => ({ ...f, customer_id: c.id, area: c.route_name || f.area }));
                              setCustomers([]);
                              setShowCustomerDropdown(false);
                            }}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              fontSize: 13,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                          >
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>{c.name}</strong>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.customer_code} · {c.phone}</div>
                            </div>
                            {c.route_name && (
                              <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>
                                {c.route_name}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Customer Type</label>
                  <select className="form-input" value={form.customer_type} onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))}>
                    <option value="Regular">Regular</option>
                    <option value="Trial">Trial</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Delivery Type</label>
                  <select className="form-input" value={form.delivery_type} onChange={e => setForm(f => ({ ...f, delivery_type: e.target.value }))}>
                    <option value="Doorstep">DoorStep Delivery</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Delivery Schedule */}
          {step === 2 && (
            <div style={{ display: 'grid', gap: 18 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 13, fontWeight: 600 }}>Delivery Frequency *</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {['DAILY', 'ALTERNATE_DAY', 'CUSTOM_WEEKLY'].map(ft => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, frequency_type: ft }))}
                      style={{
                        flex: '1 1 140px',
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: form.frequency_type === ft ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                        background: form.frequency_type === ft ? 'rgba(59,130,246,0.06)' : '#ffffff',
                        color: form.frequency_type === ft ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: 13,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {FREQ_LABELS[ft]?.label || ft}
                    </button>
                  ))}
                </div>
              </div>

              {form.frequency_type === 'CUSTOM_WEEKLY' && (
                <div className="form-group" style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Select Delivery Weekdays *</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {WEEKDAYS.map(day => {
                      const sel = form.custom_weekdays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleWeekday(day)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: sel ? '1px solid var(--primary)' : '1px solid #cbd5e1',
                            background: sel ? 'var(--primary)' : '#ffffff',
                            color: sel ? '#ffffff' : 'var(--text-secondary)',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          {WEEKDAY_SHORT[day]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Subscription Start Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value, first_delivery_date: f.first_delivery_date || e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>First Delivery Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.first_delivery_date || form.start_date}
                    onChange={e => setForm(f => ({ ...f, first_delivery_date: e.target.value }))}
                  />
                  {form.frequency_type === 'ALTERNATE_DAY' && (
                    <small style={{ fontSize: 11, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Zap size={12} /> Anchor date for alternate-day cycle
                    </small>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Multi-product line items */}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Configured Products</div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Each item has its own quantity and rate snapshot</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={addItem}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={15} /> Add Another Product
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {form.items.map((item, idx) => {
                  const selectedProd = products.find(p => p.id === item.product_id);
                  return (
                    <div
                      key={item._id || idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(180px, 2fr) 95px 110px 40px',
                        gap: 10,
                        alignItems: 'flex-end',
                        background: '#f8fafc',
                        borderRadius: 10,
                        padding: '12px 14px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Product</label>
                        <select className="form-input" style={{ width: '100%' }} value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                          <option value="">— Select Product —</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.unit}) — ₹{p.price_per_unit}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Qty</label>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          className="form-input"
                          style={{ width: '100%' }}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input"
                          style={{ width: '100%' }}
                          value={item.rate_snapshot || (selectedProd?.price_per_unit || '')}
                          onChange={e => updateItem(idx, 'rate_snapshot', e.target.value)}
                          placeholder={selectedProd?.price_per_unit || '0'}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          type="button"
                          id={`remove-product-row-${idx}`}
                          title={form.items.length === 1 ? 'Clear item' : 'Delete item'}
                          onClick={() => removeItem(idx)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border: '1px solid #fecaca',
                            background: '#fee2e2',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {form.items.filter(i => i.product_id && parseFloat(i.quantity) > 0).length > 0 && (
                <div style={{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#166534' }}>Estimated Daily Cost:</span>
                    <strong style={{ fontSize: 16, color: '#15803d' }}>
                      ₹{form.items.reduce((sum, i) => {
                        const prod = products.find(p => p.id === i.product_id);
                        const rate = parseFloat(i.rate_snapshot || prod?.price_per_unit || 0);
                        return sum + (parseFloat(i.quantity) || 0) * rate;
                      }, 0).toFixed(2)}/day
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Routing & Notes */}
          {step === 4 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Delivery Area / Route</label>
                  <select className="form-input" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}>
                    <option value="">— Select Route / Area —</option>
                    {routes.map(r => <option key={r.id} value={r.route_name}>{r.route_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Delivery Person (DP)</label>
                  <select
                    className="form-input"
                    value={form.delivery_person_name}
                    onChange={e => {
                      const sel = deliveryPersons.find(dp => dp.name === e.target.value);
                      setForm(f => ({
                        ...f,
                        delivery_person_name: e.target.value,
                        delivery_person_id: sel?.id || ''
                      }));
                    }}
                  >
                    <option value="">— Select Delivery Person —</option>
                    {deliveryPersons.map(dp => (
                      <option key={dp.id} value={dp.name}>
                        {dp.name} ({dp.dpCode || 'DP'}{dp.assignedRoute ? ` · ${dp.assignedRoute}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Notes / Instructions</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Gate code, landmark, delivery preferences..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Review card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ClipboardList size={16} /> Subscription Summary
                </div>
                <div>Customer: <strong>{selectedCustomer?.name || '—'}</strong></div>
                <div>Frequency: <strong>{FREQ_LABELS[form.frequency_type]?.label}</strong></div>
                <div>Start Date: <strong>{form.start_date}</strong></div>
                <div>Products: <strong>{form.items.filter(i => i.product_id).length} item(s) configured</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '0 26px 22px', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          {step > 1 && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep(s => s - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {step < 4 ? (
            <button type="button" className="btn btn-primary" onClick={handleNext} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {loading ? <span className="loading-spinner" /> : <><Check size={16} /> {isEdit ? 'Save Changes' : 'Confirm Subscription'}</>}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────
function DetailDrawer({ subscriptionId, onClose, onRefresh, initialShowDp = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDpPicker, setShowDpPicker] = useState(initialShowDp);
  const [dpList, setDpList] = useState([]);
  const [dpSearch, setDpSearch] = useState('');
  const [assigningDp, setAssigningDp] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/subscriptions/${subscriptionId}`);
      setData(res.data.data);
    } catch {
      toast.error('Failed to load subscription details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    api.get('/access-control/delivery-persons')
      .then(r => setDpList(r.data.data || []))
      .catch(() => {});
  }, [subscriptionId]);

  const handleAssignDp = async (dp) => {
    setAssigningDp(true);
    try {
      await api.put(`/subscriptions/${subscriptionId}`, {
        delivery_person_name: dp ? dp.name : null,
        delivery_person_id: dp ? dp.id : null,
      });
      toast.success(dp ? `Assigned DP: ${dp.name}` : 'DP unassigned');
      await fetchDetail();
      onRefresh();
      setShowDpPicker(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update Delivery Person.');
    } finally {
      setAssigningDp(false);
    }
  };

  const filteredDps = dpList.filter(dp => {
    if (!dpSearch.trim()) return true;
    const q = dpSearch.toLowerCase();
    return (
      (dp.name && dp.name.toLowerCase().includes(q)) ||
      (dp.dpCode && dp.dpCode.toLowerCase().includes(q)) ||
      (dp.mobileNumber && dp.mobileNumber.toLowerCase().includes(q)) ||
      (dp.assignedRoute && dp.assignedRoute.toLowerCase().includes(q)) ||
      (dp.zone && dp.zone.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!data) return null;

  const isTrial = data.customer_type === 'Trial';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: 500 }}
        animate={{ x: 0 }}
        exit={{ x: 500 }}
        transition={{ type: 'spring', damping: 28 }}
        style={{
          width: '100%',
          maxWidth: 580,
          height: '100%',
          background: '#ffffff',
          boxShadow: '-10px 0 35px rgba(0,0,0,0.15)',
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Subscription Details</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Pencil size={14} /> Edit
            </button>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Customer Info Card */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <User size={14} /> Customer Information
            </div>
            {/* Customer Type Badge in Slider */}
            <span style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
              background: isTrial ? '#fef3c7' : '#eff6ff',
              color: isTrial ? '#b45309' : '#1d4ed8',
              border: isTrial ? '1px solid #fde68a' : '1px solid #bfdbfe',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              {isTrial ? '⏳ Trial Customer' : '👤 Regular Customer'}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{data.customer_name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{data.customer_code} · {data.customer_phone}</div>
          {data.address && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{data.address}</div>}
        </div>

        {/* Delivery Schedule Card */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={14} /> Schedule & Route
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <FreqBadge type={data.frequency_type || 'DAILY'} />
            <span className={`badge ${data.status === 'Active' ? 'badge-success' : data.status === 'Paused' ? 'badge-warning' : 'badge-danger'}`}>
              {data.status}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 12,
              background: isTrial ? '#fffbeb' : '#f0f9ff',
              color: isTrial ? '#b45309' : '#0369a1',
              border: isTrial ? '1px solid #fde68a' : '1px solid #bae6fd',
            }}>
              {isTrial ? 'Trial' : 'Regular'}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 12,
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #e2e8f0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              🚪 DoorStep Delivery
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Start Date: </span><strong>{data.start_date ? data.start_date.split('T')[0] : '—'}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>First Delivery: </span><strong>{data.first_delivery_date ? data.first_delivery_date.split('T')[0] : (data.start_date ? data.start_date.split('T')[0] : '—')}</strong></div>
            {data.area && <div><span style={{ color: 'var(--text-muted)' }}>Route / Area: </span><strong>{data.area}</strong></div>}
            <div>
              <span style={{ color: 'var(--text-muted)' }}>DP: </span>
              <button
                type="button"
                id="drawer-dp-toggle-btn"
                onClick={() => setShowDpPicker(v => !v)}
                style={{
                  background: data.delivery_person_name ? '#eff6ff' : '#fff7ed',
                  border: data.delivery_person_name ? '1px solid #bfdbfe' : '1px solid #fed7aa',
                  color: data.delivery_person_name ? '#1d4ed8' : '#c2410c',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 2
                }}
                title="Click to view delivery persons list and assign"
              >
                <Truck size={13} />
                <span>{data.delivery_person_name || 'Unassigned — Click to Assign DP'}</span>
                <Pencil size={11} style={{ opacity: 0.7 }} />
              </button>
            </div>
          </div>
          {data.schedule?.custom_weekdays?.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 13, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Days: </span>
              <strong>{data.schedule.custom_weekdays.map(d => WEEKDAY_SHORT[d]).join(', ')}</strong>
            </div>
          )}
        </div>

        {/* DP Selection Drawer / Panel */}
        <AnimatePresence>
          {showDpPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: 12,
                padding: 16,
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Truck size={16} /> Delivery Person List ({dpList.length})
                  </div>
                  <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 2 }}>
                    Click a delivery person below to assign immediately to this subscription
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowDpPicker(false)}
                  style={{ width: 26, height: 26 }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Search filter for DP */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search DP by name, code, route, phone..."
                  className="form-input"
                  style={{ paddingLeft: 30, height: 34, fontSize: 12, background: '#ffffff' }}
                  value={dpSearch}
                  onChange={e => setDpSearch(e.target.value)}
                />
              </div>

              {/* Scrollable list of DPs */}
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 6 }}>
                {filteredDps.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: 16, background: '#ffffff', borderRadius: 8 }}>
                    No delivery persons found.
                  </div>
                ) : (
                  filteredDps.map(dp => {
                    const isSelected = data.delivery_person_name === dp.name || String(data.delivery_person_id) === String(dp.id);
                    return (
                      <div
                        key={dp.id}
                        onClick={() => handleAssignDp(dp)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: isSelected ? '#dcfce7' : '#ffffff',
                          border: isSelected ? '1.5px solid #22c55e' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {dp.name}
                            <span style={{ fontSize: 10.5, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>
                              {dp.dpCode || 'DP'}
                            </span>
                            {isSelected && (
                              <span style={{ fontSize: 10.5, background: '#16a34a', color: '#ffffff', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                                Current
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {dp.mobileNumber && `📞 ${dp.mobileNumber}`}
                            {(dp.assignedRoute || dp.zone) && ` · 📍 ${dp.assignedRoute || dp.zone}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-success' : 'btn-secondary'}`}
                          style={{ fontSize: 11, padding: '4px 10px', height: 28 }}
                          disabled={assigningDp}
                        >
                          {isSelected ? 'Assigned' : 'Assign'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {data.delivery_person_name && (
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => handleAssignDp(null)}
                    disabled={assigningDp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Unassign current delivery person
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products Card */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Package size={14} /> Products in this Subscription
          </div>
          {data.items && data.items.length > 0 ? data.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < data.items.length - 1 ? '1px solid #e2e8f0' : 'none'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.product_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.unit} · ₹{item.rate_snapshot || item.price_per_unit}/unit</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>× {item.quantity}</div>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                  ₹{(parseFloat(item.quantity) * parseFloat(item.rate_snapshot || item.price_per_unit || 0)).toFixed(2)}/day
                </div>
              </div>
            </div>
          )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No products configured.</div>}
        </div>

        {/* Pause Notice Banner */}
        {data.status === 'Paused' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#b45309' }}>⏸️ Subscription Currently Paused</div>
              <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 2 }}>
                Deliveries are suspended. All pause schedules and resumptions are managed in the Pause module.
              </div>
            </div>
            <a
              href="/pause"
              className="btn btn-warning btn-sm"
              style={{ fontSize: 11, fontWeight: 700, textDecoration: 'none', padding: '6px 12px', whiteSpace: 'nowrap' }}
            >
              Open Pause Module →
            </a>
          </div>
        )}

        {/* Read-Only Pause History */}
        {data.pauses && data.pauses.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={14} /> Pause Schedule Records
              </div>
              <a href="/pause" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                Manage in Pause Module →
              </a>
            </div>
            {data.pauses.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < data.pauses.length - 1 ? '1px solid #e2e8f0' : 'none'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {p.pause_start_date ? p.pause_start_date.split('T')[0] : (p.pause_date ? p.pause_date.split('T')[0] : '')}
                    {' → '}
                    {p.pause_end_date ? p.pause_end_date.split('T')[0] : (p.resume_date ? p.resume_date.split('T')[0] : (p.pause_date ? p.pause_date.split('T')[0] : ''))}
                  </div>
                  {p.reason && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.reason}</div>}
                </div>
                <div>
                  <span className={`badge ${p.is_active !== false && p.status !== 'Cancelled' ? 'badge-warning' : 'badge-gray'}`}>
                    {p.status || 'Active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 30-Day Delivery Calendar Preview */}
        {data.deliveryPreview && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} /> 30-Day Delivery Calendar
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>From Today</span>
            </div>

            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6, textAlign: 'center' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {data.deliveryPreview.slice(0, 30).map((day, i) => {
                const dateObj = new Date(day.date + 'T12:00:00Z');
                const dayNum = dateObj.getDate();
                const isDel = day.status === 'Delivery';
                const isPaused = day.status === 'Paused';
                return (
                  <div
                    key={i}
                    title={`${day.date}: ${day.label}`}
                    style={{
                      background: isDel ? '#ecfdf5' : isPaused ? '#fffbeb' : '#f1f5f9',
                      border: `1px solid ${isDel ? '#a7f3d0' : isPaused ? '#fde68a' : '#e2e8f0'}`,
                      borderRadius: 6,
                      padding: '6px 2px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: isDel ? '#047857' : isPaused ? '#b45309' : '#64748b',
                      fontWeight: 700,
                      cursor: 'default',
                    }}
                  >
                    <div>{dayNum}</div>
                    <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', marginTop: 1, opacity: 0.85 }}>
                      {isDel ? 'DEL' : isPaused ? 'PAUSE' : 'SKIP'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', fontSize: 11, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
                Scheduled Delivery
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f59e0b', display: 'inline-block' }} />
                Paused
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#94a3b8', display: 'inline-block' }} />
                No Delivery
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {showEdit && (
        <SubscriptionModal
          editData={data}
          onClose={() => setShowEdit(false)}
          onSaved={() => { fetchDetail(); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Main Subscriptions Page ───────────────────────────────────────
export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ Active: 0, Paused: 0, Cancelled: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [freqFilter, setFreqFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [openWithDpPicker, setOpenWithDpPicker] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const limit = 20;

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/subscriptions', {
        params: { page, limit, status: statusFilter, frequency_type: freqFilter, customer_type: typeFilter, search }
      });
      setSubs(res.data.data || []);
      setTotal(res.data.total || 0);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch {
      toast.error('Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, freqFilter, typeFilter, search]);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/subscriptions/${id}/status`, { status });
      toast.success(`Subscription marked as ${status.toLowerCase()}.`);
      fetchSubs();
    } catch {
      toast.error('Failed to update subscription status.');
    }
  };

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">{total} total subscriptions</p>
        </div>
        <button id="add-subscription-btn" className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={18} /> New Subscription
        </button>
      </div>

      {/* Status Summary Pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.08)', key: 'Active' },
          { label: 'Paused', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', key: 'Paused' },
          { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', key: 'Cancelled' },
        ].map(pill => (
          <div
            key={pill.key}
            id={`sub-filter-pill-${pill.key.toLowerCase()}`}
            onClick={() => {
              setStatusFilter(prev => prev === pill.key ? '' : pill.key);
              setPage(1);
            }}
            style={{
              background: pill.bg,
              border: `1px solid ${pill.color}30`,
              borderRadius: 12,
              padding: '10px 20px',
              cursor: 'pointer',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              outline: statusFilter === pill.key ? `2px solid ${pill.color}` : 'none'
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: pill.color }}>{counts[pill.key] ?? 0}</span>
            <span style={{ fontSize: 13, color: pill.color, fontWeight: 600 }}>{pill.label}</span>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="sub-search"
              className="form-input"
              style={{ paddingLeft: 34, height: 38 }}
              placeholder="Search customer, phone, code..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            id="sub-status-filter"
            className="form-input"
            style={{ width: 140, height: 38 }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            id="sub-type-filter"
            className="form-input"
            style={{ width: 150, height: 38 }}
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Customer Types</option>
            <option value="Regular">Regular Customer</option>
            <option value="Trial">Trial Customer</option>
          </select>
          <select
            id="sub-freq-filter"
            className="form-input"
            style={{ width: 160, height: 38 }}
            value={freqFilter}
            onChange={e => { setFreqFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Frequencies</option>
            <option value="DAILY">Daily</option>
            <option value="ALTERNATE_DAY">Alternate Day</option>
            <option value="CUSTOM_WEEKLY">Custom Weekly</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchSubs} style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 44 }}></th>
                <th>Customer</th>
                <th>Frequency</th>
                <th>Products</th>
                <th>Start Date</th>
                <th>Route / DP</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading subscriptions...</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No subscriptions found.</td></tr>
              ) : subs.map((s, i) => {
                const items = s.items || [];
                const isExpanded = expandedRows[s.id];
                const isSubTrial = s.customer_type === 'Trial';
                return (
                  <Fragment key={s.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <button className="icon-btn" onClick={() => toggleRow(s.id)}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.customer_name}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 7px',
                            borderRadius: 10,
                            background: isSubTrial ? '#fef3c7' : '#eff6ff',
                            color: isSubTrial ? '#b45309' : '#1d4ed8',
                            border: isSubTrial ? '1px solid #fde68a' : '1px solid #bfdbfe'
                          }}>
                            {isSubTrial ? '⏳ Trial' : 'Regular'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.customer_code} · {s.customer_phone}</div>
                      </td>
                      <td><FreqBadge type={s.frequency_type || 'DAILY'} /></td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.item_count || (items.length > 0 ? items.length : '—')}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> products</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.start_date ? new Date(s.start_date + 'T00:00:00').toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{s.area || '—'}</div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(s.id);
                            setOpenWithDpPicker(true);
                          }}
                          style={{
                            marginTop: 4,
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            border: s.delivery_person_name ? '1px solid #bfdbfe' : '1px dashed #f59e0b',
                            background: s.delivery_person_name ? '#eff6ff' : '#fffbeb',
                            color: s.delivery_person_name ? '#1d4ed8' : '#b45309',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Click to view & assign Delivery Person in the slider"
                        >
                          <Truck size={11} />
                          {s.delivery_person_name || 'Assign DP'}
                        </button>
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'Active' ? 'badge-success' : s.status === 'Paused' ? 'badge-warning' : 'badge-danger'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            id={`sub-view-${s.id}`}
                            className="btn btn-ghost btn-sm"
                            title="View Details & 30-Day Calendar"
                            onClick={() => { setSelectedId(s.id); setOpenWithDpPicker(false); }}
                            style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Clock size={16} />
                          </button>
                          {s.status !== 'Active' && (
                            <button
                              id={`sub-activate-${s.id}`}
                              className="btn btn-success btn-sm"
                              title="Activate"
                              onClick={() => changeStatus(s.id, 'Active')}
                              style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Play size={15} />
                            </button>
                          )}

                          {s.status !== 'Cancelled' && (
                            <button
                              id={`sub-cancel-${s.id}`}
                              className="btn btn-danger btn-sm"
                              title="Cancel"
                              onClick={() => changeStatus(s.id, 'Cancelled')}
                              style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>

                    {/* Expanded product items row */}
                    {isExpanded && items.length > 0 && (
                      <tr key={`${s.id}-items`} style={{ background: 'rgba(99,102,241,0.03)' }}>
                        <td></td>
                        <td colSpan={7} style={{ padding: '8px 20px 14px' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {items.map((item, ii) => (
                              <div
                                key={ii}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 8,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>{item.product_name}</span>
                                <span style={{ color: 'var(--text-muted)' }}> × {item.quantity} {item.unit}</span>
                                <span style={{ color: '#10b981', marginLeft: 6, fontWeight: 600 }}>₹{item.rate}/unit</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {Math.ceil(total / limit) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <button className="btn btn-secondary btn-sm" disabled={page === Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <SubscriptionModal onClose={() => setShowAdd(false)} onSaved={fetchSubs} />}
        {selectedId && (
          <DetailDrawer
            subscriptionId={selectedId}
            initialShowDp={openWithDpPicker}
            onClose={() => { setSelectedId(null); setOpenWithDpPicker(false); }}
            onRefresh={fetchSubs}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
