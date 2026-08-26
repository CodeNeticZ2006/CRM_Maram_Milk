import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MdNotifications, MdMenu, MdCalendarToday, MdCheckCircle, MdClose, MdRefresh, MdSchedule } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customer CRM',
  '/masters': 'Masters',
  '/inventory': 'Inventory Management',
  '/subscriptions': 'Subscriptions',
  '/pause': 'Pause Management',
  '/delivery-person-audit': 'Delivery Person Audit',
  '/route': 'Route & Dispatches',
  '/logistics': 'Route & Dispatches',
  '/ecom-orders': 'Ecom Orders',
  '/empty-bottles': 'Empty Bottle Management',
  '/wallet': 'Wallet Management',
  '/payments': 'Payments & Invoices',
  '/whatsapp': 'WhatsApp Operations',
  '/reports': 'Reports & Analytics',
  '/revenue': 'Revenue Report',
  '/feedback': 'Customer Feedback',
  '/sms': 'SMS / Notifications',
  '/access-control': 'User Access Control',
  '/settings': 'Settings',
  // Route Intelligence
  '/route-intelligence/live':        '📍 Live Operations',
  '/route-intelligence/territories':  '📍 Territory Monitoring',
  '/route-intelligence/geofencing':   '📍 Geofencing',
  '/route-intelligence/compliance':   '📍 Route Compliance',
  '/route-intelligence/replay':       '📍 Route Replay',
  '/route-intelligence/analytics':    '📍 Route Analytics',
  '/route-intelligence/settings':     '📍 Route Intelligence Settings',
};

export default function Topbar({ onToggleMobileSidebar }) {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Maram Milk CRM';
  const now = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [opDayData, setOpDayData] = useState(null);
  const [showOpModal, setShowOpModal] = useState(false);
  const [loadingRollover, setLoadingRollover] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const fetchOpDay = async () => {
    try {
      const res = await api.get('/operational-day/current');
      if (res.data?.success) {
        setOpDayData(res.data.data);
      }
    } catch (err) {
      /* silent warning */
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchOpDay();
    fetchNotifications();
    const interval = setInterval(() => {
      fetchOpDay();
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (notifId = null, markAll = false) => {
    try {
      await api.post('/notifications/mark-read', { notificationId: notifId, markAll });
      fetchNotifications();
    } catch { /* silent */ }
  };

  const handleManualRolloverCheck = async () => {
    setLoadingRollover(true);
    try {
      const res = await api.post('/operational-day/trigger-rollover');
      if (res.data?.success) {
        toast.success(res.data.message || 'Operational day checked successfully!');
        await fetchOpDay();
      }
    } catch (err) {
      toast.error('Failed to trigger operational rollover.');
    } finally {
      setLoadingRollover(false);
    }
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onToggleMobileSidebar && (
          <button
            className="icon-btn mobile-menu-btn"
            onClick={onToggleMobileSidebar}
            title="Toggle Menu"
            style={{ minWidth: 38 }}
          >
            <MdMenu style={{ fontSize: 22 }} />
          </button>
        )}
        <div>
          <div className="topbar-title">{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{now}</div>
        </div>
      </div>

      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        {/* Operational Day Indicator Badge */}
        {opDayData && (
          <button
            onClick={() => setShowOpModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(91,33,182,0.15))',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 20,
              padding: '5px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: '#7c3aed',
              transition: 'all 0.2s ease',
            }}
            title="Click to view Operational Day Details (7:00 PM IST Rollover System)"
          >
            <MdCalendarToday style={{ fontSize: 14 }} />
            <span>Op Day: <strong>{opDayData.displayDate || opDayData.formattedDate || opDayData.date}</strong></span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 10,
                background: '#10b981',
                color: '#fff',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {opDayData.status || 'ACTIVE'}
            </span>
          </button>
        )}

        {/* Bell Notifications Button */}
        <div style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            id="notifications-btn"
            title="Notifications"
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            style={{ position: 'relative' }}
          >
            <MdNotifications style={{ fontSize: 22 }} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 900,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #fff',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Overlay Dropdown */}
          <AnimatePresence>
            {showNotifDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 48,
                  width: 360,
                  maxHeight: 440,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                    Notifications ({unreadCount} new)
                  </div>
                  {unreadCount > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, color: 'var(--primary)', padding: '2px 6px' }}
                      onClick={() => handleMarkRead(null, true)}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid #f1f5f9',
                          background: n.isRead ? 'transparent' : 'rgba(239,68,68,0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                        }}
                        onClick={() => {
                          handleMarkRead(n.id);
                          setShowNotifDropdown(false);
                          window.location.href = `${n.linkUrl || '/inventory'}?tab=stock-correctness`;
                        }}
                      >
                        <div style={{ fontSize: 18, marginTop: 2 }}>
                          {n.type === 'Mismatch' ? '🔴' : n.type === 'Missing Log' ? '⚠️' : 'ℹ️'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.35 }}>{n.message}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                            {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Operational Day Modal */}
      <AnimatePresence>
        {showOpModal && opDayData && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div className="card" style={{ width: '100%', maxWidth: 440, padding: 0, overflow: 'hidden', borderRadius: 14, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', padding: '16px 20px' }}>
                <div>
                  <div className="card-title" style={{ color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <MdSchedule style={{ fontSize: 20 }} /> Central Operational Day System
                  </div>
                  <div style={{ fontSize: 11.5, color: '#ddd6fe', marginTop: 3 }}>
                    7:00 PM IST Central Rollover Cycle (Asia/Kolkata)
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setShowOpModal(false)} style={{ color: '#fff', border: 'none', background: 'transparent', cursor: 'pointer' }}><MdClose style={{ fontSize: 20 }} /></button>
              </div>

              <div style={{ padding: 20 }}>
                <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Active Operational Date:</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#7c3aed' }}>{opDayData.displayDate || opDayData.formattedDate || opDayData.date}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>System Status:</span>
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11 }}>
                      <MdCheckCircle /> {opDayData.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Timezone:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{opDayData.timezone} (IST)</span>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div>
                    <strong>Current IST Time:</strong> <span style={{ color: 'var(--primary)' }}>{opDayData.currentISTTime}</span>
                  </div>
                  <div>
                    <strong>Daily Rollover Time:</strong> <span style={{ color: '#7c3aed' }}>7:00 PM IST (Daily)</span>
                  </div>
                  <div>
                    <strong>Next Scheduled Rollover:</strong> <span>{opDayData.nextRolloverIST}</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 16 }}>
                  📌 <strong>Rollover Rules:</strong> Inventory remaining stock carries forward automatically at 7:00 PM IST. Daily counters for Inventory, Attendance, Audit, and Empty Bottles reset. Master profiles, wallet, payments, and history are never deleted.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleManualRolloverCheck}
                    disabled={loadingRollover}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <MdRefresh className={loadingRollover ? 'spin' : ''} />
                    {loadingRollover ? 'Checking...' : 'Check Rollover Status'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowOpModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
}
