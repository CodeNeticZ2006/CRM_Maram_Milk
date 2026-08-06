import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import useAuthStore from '../../store/authStore';

export default function AppLayout() {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
