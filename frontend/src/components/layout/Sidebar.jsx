import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MdDashboard, MdPeople, MdCategory, MdLocalShipping, MdPause,
  MdSubscriptions, MdShoppingCart, MdBarChart, MdTrendingUp,
  MdAccountBalanceWallet, MdPayment, MdWhatsapp, MdFeedback,
  MdSms, MdAdminPanelSettings, MdLogout, MdSettings,
  MdMap, MdSatellite, MdHexagon, MdRule, MdHistory, MdInsights,
  MdTune, MdExpandMore, MdExpandLess, MdInventory, MdWineBar,
  MdLocalDrink, MdWorkspacePremium, MdClose, MdCalendarToday, MdDirectionsBike,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';

const ROUTE_PERMISSION_MAP = {
  '/dashboard': 'DASHBOARD',
  '/customers': 'CUSTOMERS',
  '/masters': 'MASTERS',
  '/inventory': 'INVENTORY',
  '/subscriptions': 'SUBSCRIPTIONS',
  '/pause': 'PAUSE_MANAGEMENT',
  '/delivery-person-audit': 'LOGISTICS',
  '/route': 'LOGISTICS',
  '/logistics': 'LOGISTICS',
  '/ecom-orders': 'ECOM_ORDERS',
  '/empty-bottles': 'EMPTY_BOTTLES',
  '/wallet': 'WALLET',
  '/payments': 'PAYMENTS',
  '/whatsapp': 'WHATSAPP',
  '/reports': 'REPORTS',
  '/revenue': 'REVENUE',
  '/feedback': 'FEEDBACK',
  '/sms': 'SMS',
  '/access-control': 'ACCESS_CONTROL',
  '/settings': 'SETTINGS',
  // Route Intelligence — always visible to SuperAdmin
  '/route-intelligence/live':        'ROUTE_INTELLIGENCE',
  '/route-intelligence/territories':  'ROUTE_INTELLIGENCE',
  '/route-intelligence/geofencing':   'ROUTE_INTELLIGENCE',
  '/route-intelligence/compliance':   'ROUTE_INTELLIGENCE',
  '/route-intelligence/replay':       'ROUTE_INTELLIGENCE',
  '/route-intelligence/analytics':    'ROUTE_INTELLIGENCE',
  '/route-intelligence/settings':     'ROUTE_INTELLIGENCE',
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
      { to: '/inventory', icon: <MdInventory />, label: 'Inventory' },
      { to: '/delivery-person-audit', icon: <MdCalendarToday />, label: 'Delivery Person Audit' },
      { to: '/route', icon: <MdDirectionsBike />, label: 'Route' },
      { to: '/ecom-orders', icon: <MdShoppingCart />, label: 'Ecom Orders' },
      { to: '/empty-bottles', icon: <MdWineBar />, label: 'Empty Bottles' },
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
  },
  {
    label: 'Route Intelligence',
    isGroup: true,
    groupIcon: <MdMap />,
    items: [
      { to: '/route-intelligence/live',        icon: <MdSatellite />,  label: 'Live Operations'    },
      { to: '/route-intelligence/territories',  icon: <MdMap />,        label: 'Territory Monitoring'},
      { to: '/route-intelligence/geofencing',   icon: <MdHexagon />,    label: 'Geofencing'          },
      { to: '/route-intelligence/compliance',   icon: <MdRule />,       label: 'Route Compliance'    },
      { to: '/route-intelligence/replay',       icon: <MdHistory />,    label: 'Route Replay'        },
      { to: '/route-intelligence/analytics',    icon: <MdInsights />,   label: 'Analytics'           },
      { to: '/route-intelligence/settings',     icon: <MdTune />,       label: 'Settings'            },
    ]
  }
];

export default function Sidebar({ pendingCount, mobileOpen, onCloseMobile }) {
  const { admin, logout } = useAuthStore();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState({ 'Route Intelligence': true });

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

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
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      {/* Logo & Mobile Close Header */}
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="brand">
          <div className="brand-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MdLocalDrink style={{ fontSize: 22, color: '#fff' }} />
          </div>
          <div>
            <div className="brand-name">Maram Milk</div>
            <div className="brand-sub">{isSuperAdmin ? 'Super Admin CRM' : `${admin?.role || 'CRM'} Portal`}</div>
          </div>
        </div>
        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            className="icon-btn"
            style={{ border: 'none', color: '#94a3b8', background: 'transparent' }}
            onClick={onCloseMobile}
            title="Close menu"
          >
            <MdClose style={{ fontSize: 24 }} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {filteredSections.map((section) => (
          <div className="nav-section" key={section.label}>
            {section.isGroup ? (
              /* Collapsible group header for Route Intelligence */
              <>
                <button
                  className="nav-section-group-btn"
                  onClick={() => toggleGroup(section.label)}
                  id={`sidebar-group-${section.label.replace(/\s/g,'-').toLowerCase()}`}
                >
                  <span className="nav-icon" style={{ fontSize: 16, color: 'var(--primary)' }}>{section.groupIcon}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', color: '#fff' }}>{section.label}</span>
                  {openGroups[section.label] ? <MdExpandLess style={{ fontSize: 16 }} /> : <MdExpandMore style={{ fontSize: 16 }} />}
                </button>
                <AnimatePresence initial={false}>
                  {openGroups[section.label] && (
                    <motion.div
                      key="ri-submenu"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      {section.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={onCloseMobile}
                          className={({ isActive }) => `nav-item nav-item-sub${isActive ? ' active' : ''}`}
                        >
                          <span className="nav-icon">{item.icon}</span>
                          {item.label}
                        </NavLink>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              /* Regular section */
              <>
                <div className="nav-section-label">{section.label}</div>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onCloseMobile}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                  </NavLink>
                ))}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-admin">
          <div className="admin-avatar">{initials}</div>
          <div className="admin-info">
            <div className="admin-name">{admin?.name || 'Sarfaz Ahamed'}</div>
            <div className="admin-role" style={{ color: isSuperAdmin ? '#10b981' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {isSuperAdmin ? <><MdWorkspacePremium style={{ fontSize: 14 }} /> Dedicated Super Admin</> : (admin?.role || 'Manager')}
            </div>
          </div>
          <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', fontSize: 18, cursor: 'pointer', padding: 4 }}>
            <MdLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
