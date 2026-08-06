import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MdDashboard, MdPeople, MdCategory, MdLocalShipping, MdPause,
  MdSubscriptions, MdShoppingCart, MdBarChart, MdTrendingUp,
  MdAccountBalanceWallet, MdPayment, MdWhatsapp, MdFeedback,
  MdSms, MdAdminPanelSettings, MdLogout, MdSettings
} from 'react-icons/md';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const ROUTE_PERMISSION_MAP = {
  '/dashboard': 'DASHBOARD',
  '/customers': 'CUSTOMERS',
  '/masters': 'MASTERS',
  '/subscriptions': 'SUBSCRIPTIONS',
  '/pause': 'PAUSE_MANAGEMENT',
  '/logistics': 'LOGISTICS',
  '/ecom-orders': 'ECOM_ORDERS',
  '/wallet': 'WALLET',
  '/payments': 'PAYMENTS',
  '/whatsapp': 'WHATSAPP',
  '/reports': 'REPORTS',
  '/revenue': 'REVENUE',
  '/feedback': 'FEEDBACK',
  '/sms': 'SMS',
  '/access-control': 'ACCESS_CONTROL',
  '/settings': 'SETTINGS',
};

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', icon: <MdDashboard />, label: 'Dashboard' },
    ]
  },
  {
    label: 'CRM',
    items: [
      { to: '/customers', icon: <MdPeople />, label: 'Customer' },
      { to: '/masters', icon: <MdCategory />, label: 'Masters' },
      { to: '/subscriptions', icon: <MdSubscriptions />, label: 'Subscriptions' },
      { to: '/pause', icon: <MdPause />, label: 'Pause' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { to: '/logistics', icon: <MdLocalShipping />, label: 'Logistics' },
      { to: '/ecom-orders', icon: <MdShoppingCart />, label: 'Ecom Orders' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { to: '/wallet', icon: <MdAccountBalanceWallet />, label: 'Wallet' },
      { to: '/payments', icon: <MdPayment />, label: 'Payments' },
      { to: '/whatsapp', icon: <MdWhatsapp />, label: 'WhatsApp Ops' },
    ]
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', icon: <MdBarChart />, label: 'Reports' },
      { to: '/revenue', icon: <MdTrendingUp />, label: 'Revenue Report' },
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/feedback', icon: <MdFeedback />, label: 'Feedback' },
      { to: '/sms', icon: <MdSms />, label: 'SMS / Notifications' },
      { to: '/access-control', icon: <MdAdminPanelSettings />, label: 'User Access Control' },
      { to: '/settings', icon: <MdSettings />, label: 'Settings' },
    ]
  }
];

export default function Sidebar({ pendingCount }) {
  const { admin, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const isSuperAdmin = (admin?.email || '').toLowerCase() === 'admin@marammilk.com' ||
                       admin?.role === 'SuperAdmin' || admin?.role === 'Super Admin';

  const userPermissions = admin?.permissions || [];
  const accessLevel = admin?.access || (isSuperAdmin ? 'FULL_CONTROL' : 'LIMITED');

  // Filter sections and items based on permissions
  const filteredSections = NAV_SECTIONS.map(sec => {
    const validItems = sec.items.filter(item => {
      if (isSuperAdmin || accessLevel === 'FULL_CONTROL') return true;
      const reqPerm = ROUTE_PERMISSION_MAP[item.to];
      return userPermissions.includes('*') || userPermissions.includes(reqPerm);
    });
    return { ...sec, items: validItems };
  }).filter(sec => sec.items.length > 0);

  const initials = admin?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA';

  return (
    <motion.aside
      className="sidebar"
      initial={{ x: -260 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="brand">
          <div className="brand-icon">🥛</div>
          <div>
            <div className="brand-name">Maram Milk</div>
            <div className="brand-sub">{isSuperAdmin ? 'Super Admin CRM' : `${admin?.role || 'CRM'} Portal`}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {filteredSections.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-admin">
          <div className="admin-avatar">{initials}</div>
          <div className="admin-info">
            <div className="admin-name">{admin?.name || 'Sarfaz Ahamed'}</div>
            <div className="admin-role" style={{ color: isSuperAdmin ? '#10b981' : 'var(--primary)' }}>
              {isSuperAdmin ? '👑 Dedicated Super Admin' : (admin?.role || 'Manager')}
            </div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: 18, cursor: 'pointer', padding: 4 }}>
            <MdLogout />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
