import { useLocation } from 'react-router-dom';
import { MdNotifications } from 'react-icons/md';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customer CRM',
  '/masters': 'Masters',
  '/inventory': 'Inventory Management',
  '/subscriptions': 'Subscriptions',
  '/pause': 'Pause Management',
  '/logistics': 'Logistics & Routes',
  '/ecom-orders': 'Ecom Orders',
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

export default function Topbar() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Maram Milk CRM';
  const now = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{now}</div>
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" id="notifications-btn" title="Notifications">
          <MdNotifications />
        </button>
      </div>
    </header>
  );
}
