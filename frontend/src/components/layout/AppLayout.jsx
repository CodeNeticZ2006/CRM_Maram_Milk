import { Outlet, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import useAuthStore from '../../store/authStore';

export default function AppLayout() {
  const { token } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  const toggleMobileSidebar = () => setMobileOpen(prev => !prev);
  const closeMobileSidebar = () => setMobileOpen(false);

  return (
    <div className="app-layout">
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={closeMobileSidebar}
      />
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={closeMobileSidebar} />
      <div className="main-content">
        <Topbar onToggleMobileSidebar={toggleMobileSidebar} />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
