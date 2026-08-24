import { useLocation } from 'react-router-dom';
import { MdNotifications, MdMenu } from 'react-icons/md';

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
      <div className="topbar-actions">
        <button className="icon-btn" id="notifications-btn" title="Notifications">
          <MdNotifications />
        </button>
      </div>
    </header>
  );
}
