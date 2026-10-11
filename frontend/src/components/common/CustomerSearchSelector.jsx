import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, ChevronDown, User, Phone, Check } from 'lucide-react';
import api from '../../services/api';

/**
 * Normalizes phone number by removing country code (+91), spaces, dashes, brackets
 * for clean digit-based substring matching.
 */
export const normalizePhone = (phoneStr) => {
  if (!phoneStr) return '';
  return String(phoneStr)
    .replace(/^(\+91|91)/, '')
    .replace(/[\s\-\(\)\.]/g, '')
    .trim();
};

/**
 * Reusable Searchable Customer Selector Component
 *
 * Props:
 * - value: string (selected customer ID or customer code)
 * - onChange: (customerId: string, customerObj: object | null) => void
 * - placeholder: string (optional)
 * - disabled: boolean (optional)
 * - allowAll: boolean (whether to include an "[ All Customers ]" option, default true)
 * - allLabel: string (default "[ All Customers ]")
 * - preloadedCustomers: Array (optional array of customers; if omitted, fetches from API)
 * - id: string (optional DOM id)
 */
export default function CustomerSearchSelector({
  value,
  onChange,
  placeholder = 'Search customer by Name, Code, or Mobile...',
  disabled = false,
  allowAll = true,
  allLabel = '[ All Customers ]',
  preloadedCustomers = null,
  id = 'customer-search-selector',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load customer list
  useEffect(() => {
    if (Array.isArray(preloadedCustomers)) {
      setCustomers(preloadedCustomers);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchCustomers = async () => {
      try {
        // Try filter-options first
        const res = await api.get('/reports/filter-options').catch(() => ({ data: null }));
        if (isMounted && res.data?.success && Array.isArray(res.data.data?.customers)) {
          setCustomers(res.data.data.customers);
        } else {
          // Fallback to customer master
          const cRes = await api.get('/customers?limit=1000').catch(() => ({ data: null }));
          if (isMounted && cRes.data?.data && Array.isArray(cRes.data.data)) {
            const mapped = cRes.data.data.map(c => ({
              id: c.id,
              customer_code: c.customer_code || `CUST-${c.id}`,
              name: c.name,
              phone: c.phone || '',
              label: `${c.customer_code || `CUST-${c.id}`} : ${c.name} : ${c.phone || ''}`,
            }));
            setCustomers(mapped);
          }
        }
      } catch (err) {
        console.warn('CustomerSearchSelector: Failed to load customer options', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCustomers();
    return () => { isMounted = false; };
  }, [preloadedCustomers]);

  // Find currently selected customer
  const selectedCustomer = useMemo(() => {
    if (!value || value === '' || value === 'All') return null;
    return customers.find(c =>
      String(c.id) === String(value) ||
      String(c.customer_code).toLowerCase() === String(value).toLowerCase()
    ) || null;
  }, [value, customers]);

  // Filter customers matching searchTerm
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customers;

    const normTerm = normalizePhone(term);

    return customers.filter(c => {
      const code = String(c.customer_code || c.code || '').toLowerCase();
      const name = String(c.name || '').toLowerCase();
      const rawPhone = String(c.phone || c.mobile || '');
      const normPhone = normalizePhone(rawPhone);
      const label = String(c.label || '').toLowerCase();

      // Case-insensitive name, code, label matching
      if (name.includes(term) || code.includes(term) || label.includes(term)) {
        return true;
      }

      // Normalized phone number matching
      if (normTerm && normPhone.includes(normTerm)) {
        return true;
      }

      return false;
    });
  }, [customers, searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Keyboard Navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev + 1;
        const max = allowAll ? filteredCustomers.length : filteredCustomers.length - 1;
        return next > max ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev - 1;
        const max = allowAll ? filteredCustomers.length : filteredCustomers.length - 1;
        return next < 0 ? max : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allowAll && highlightedIndex === 0) {
        handleSelectAll();
      } else {
        const adjustedIdx = allowAll ? highlightedIndex - 1 : highlightedIndex;
        if (adjustedIdx >= 0 && adjustedIdx < filteredCustomers.length) {
          handleSelectCustomer(filteredCustomers[adjustedIdx]);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  };

  const handleSelectCustomer = (customer) => {
    onChange(customer.id, customer);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleSelectAll = () => {
    onChange('', null);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.selector-option');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div
      ref={containerRef}
      id={id}
      style={{ position: 'relative', width: '100%', userSelect: 'none' }}
      onKeyDown={handleKeyDown}
    >
      {/* Selector Trigger Input / Button */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          background: disabled ? 'var(--bg-secondary, #f1f5f9)' : 'var(--bg-card, #ffffff)',
          border: isOpen ? '1px solid var(--primary, #3b82f6)' : '1px solid var(--border, #cbd5e1)',
          boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
          borderRadius: '8px',
          fontSize: '13px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '38px',
          gap: '8px',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          <User size={15} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
          {selectedCustomer ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary, #3b82f6)' }}>
                {selectedCustomer.customer_code || selectedCustomer.code || 'CUST'}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                {selectedCustomer.name}
              </span>
              {selectedCustomer.phone && (
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                  ({selectedCustomer.phone})
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: value ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)', fontWeight: value ? 600 : 400 }}>
              {value ? value : (allowAll ? allLabel : placeholder)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {selectedCustomer && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={15}
            style={{
              color: 'var(--text-muted, #94a3b8)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: '340px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search Input Bar */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border, #e2e8f0)', background: '#f8fafc' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: '6px',
                padding: '6px 10px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted, #94a3b8)' }} />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Type name, code, or phone number..."
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '12.5px',
                  color: 'var(--text-primary, #0f172a)',
                  background: 'transparent',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            style={{
              overflowY: 'auto',
              flex: 1,
              maxHeight: '260px',
              padding: '4px',
            }}
          >
            {/* All Customers Option */}
            {allowAll && !searchTerm && (
              <div
                className="selector-option"
                onClick={handleSelectAll}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: !value ? 'var(--primary, #3b82f6)' : 'var(--text-secondary, #475569)',
                  background: highlightedIndex === 0 ? 'rgba(59, 130, 246, 0.08)' : (!value ? '#f0fdf4' : 'transparent'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '2px',
                }}
              >
                <span>{allLabel}</span>
                {!value && <Check size={14} style={{ color: 'var(--primary, #3b82f6)' }} />}
              </div>
            )}

            {loading && customers.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                Loading customer directory...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                <p style={{ fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>No customers found</p>
                <p style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  No customer matches "{searchTerm}". Check spelling or try phone digits.
                </p>
              </div>
            ) : (
              filteredCustomers.map((cust, idx) => {
                const isSelected = selectedCustomer?.id === cust.id;
                const isHighlighted = allowAll ? (idx + 1 === highlightedIndex) : (idx === highlightedIndex);

                return (
                  <div
                    key={cust.id}
                    className="selector-option"
                    onClick={() => handleSelectCustomer(cust)}
                    onMouseEnter={() => setHighlightedIndex(allowAll ? idx + 1 : idx)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      background: isHighlighted
                        ? 'rgba(59, 130, 246, 0.08)'
                        : (isSelected ? '#eff6ff' : 'transparent'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '2px',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary, #3b82f6)', flexShrink: 0 }}>
                          {cust.customer_code || cust.code || 'CUST'}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cust.name}
                        </span>
                      </div>
                      {cust.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                          <Phone size={11} style={{ flexShrink: 0 }} />
                          <span>{cust.phone}</span>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check size={14} style={{ color: 'var(--primary, #3b82f6)', flexShrink: 0, marginLeft: '6px' }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
