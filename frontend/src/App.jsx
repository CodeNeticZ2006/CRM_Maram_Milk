import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layout
import AppLayout from './components/layout/AppLayout';

// Auth pages (eager — needed immediately)
import LoginPage from './pages/Auth/LoginPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';

// Lazy-load CRM pages for performance
const DashboardPage    = lazy(() => import('./pages/Dashboard/DashboardPage'));
const CustomersPage    = lazy(() => import('./pages/Customers/CustomersPage'));
const MastersPage      = lazy(() => import('./pages/Masters/MastersPage'));
const SubscriptionsPage = lazy(() => import('./pages/Subscriptions/SubscriptionsPage'));
const PausePage        = lazy(() => import('./pages/Pause/PausePage'));
const LogisticsPage    = lazy(() => import('./pages/Logistics/LogisticsPage'));
const EcomOrdersPage   = lazy(() => import('./pages/EcomOrders/EcomOrdersPage'));
const WalletPage       = lazy(() => import('./pages/Wallet/WalletPage'));
const PaymentsPage     = lazy(() => import('./pages/Payments/PaymentsPage'));
const WhatsAppPage     = lazy(() => import('./pages/WhatsApp/WhatsAppPage'));
const ReportsPage      = lazy(() => import('./pages/Reports/ReportsPage'));
const RevenuePage      = lazy(() => import('./pages/Revenue/RevenuePage'));
const FeedbackPage     = lazy(() => import('./pages/Feedback/FeedbackPage'));
const SmsPage          = lazy(() => import('./pages/Sms/SmsPage'));
const AccessControlPage = lazy(() => import('./pages/AccessControl/AccessControlPage'));
const SettingsPage     = lazy(() => import('./pages/Settings/SettingsPage'));

// Route Intelligence Module
const LiveOperationsPage            = lazy(() => import('./pages/RouteIntelligence/pages/LiveOperationsPage'));
const TerritoryMonitoringPage       = lazy(() => import('./pages/RouteIntelligence/pages/TerritoryMonitoringPage'));
const GeofencingPage                = lazy(() => import('./pages/RouteIntelligence/pages/GeofencingPage'));
const RouteCompliancePage           = lazy(() => import('./pages/RouteIntelligence/pages/RouteCompliancePage'));
const RouteReplayPage               = lazy(() => import('./pages/RouteIntelligence/pages/RouteReplayPage'));
const RIAnalyticsPage               = lazy(() => import('./pages/RouteIntelligence/pages/AnalyticsPage'));
const RouteIntelligenceSettingsPage = lazy(() => import('./pages/RouteIntelligence/pages/RouteIntelligenceSettingsPage'));

// Page loader fallback
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="loading-spinner" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontSize: 13.5, fontWeight: 500 },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected CRM routes */}
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>
          } />
          <Route path="/customers" element={
            <Suspense fallback={<PageLoader />}><CustomersPage /></Suspense>
          } />
          <Route path="/masters" element={
            <Suspense fallback={<PageLoader />}><MastersPage /></Suspense>
          } />
          <Route path="/subscriptions" element={
            <Suspense fallback={<PageLoader />}><SubscriptionsPage /></Suspense>
          } />
          <Route path="/pause" element={
            <Suspense fallback={<PageLoader />}><PausePage /></Suspense>
          } />
          <Route path="/logistics" element={
            <Suspense fallback={<PageLoader />}><LogisticsPage /></Suspense>
          } />
          <Route path="/ecom-orders" element={
            <Suspense fallback={<PageLoader />}><EcomOrdersPage /></Suspense>
          } />
          <Route path="/wallet" element={
            <Suspense fallback={<PageLoader />}><WalletPage /></Suspense>
          } />
          <Route path="/payments" element={
            <Suspense fallback={<PageLoader />}><PaymentsPage /></Suspense>
          } />
          <Route path="/whatsapp" element={
            <Suspense fallback={<PageLoader />}><WhatsAppPage /></Suspense>
          } />
          <Route path="/reports" element={
            <Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>
          } />
          <Route path="/revenue" element={
            <Suspense fallback={<PageLoader />}><RevenuePage /></Suspense>
          } />
          <Route path="/feedback" element={
            <Suspense fallback={<PageLoader />}><FeedbackPage /></Suspense>
          } />
          <Route path="/sms" element={
            <Suspense fallback={<PageLoader />}><SmsPage /></Suspense>
          } />
          <Route path="/access-control" element={
            <Suspense fallback={<PageLoader />}><AccessControlPage /></Suspense>
          } />
          <Route path="/settings" element={
            <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>
          } />

          {/* ── Route Intelligence Module ─────────────────────────── */}
          <Route path="/route-intelligence/live" element={
            <Suspense fallback={<PageLoader />}><LiveOperationsPage /></Suspense>
          } />
          <Route path="/route-intelligence/territories" element={
            <Suspense fallback={<PageLoader />}><TerritoryMonitoringPage /></Suspense>
          } />
          <Route path="/route-intelligence/geofencing" element={
            <Suspense fallback={<PageLoader />}><GeofencingPage /></Suspense>
          } />
          <Route path="/route-intelligence/compliance" element={
            <Suspense fallback={<PageLoader />}><RouteCompliancePage /></Suspense>
          } />
          <Route path="/route-intelligence/replay" element={
            <Suspense fallback={<PageLoader />}><RouteReplayPage /></Suspense>
          } />
          <Route path="/route-intelligence/analytics" element={
            <Suspense fallback={<PageLoader />}><RIAnalyticsPage /></Suspense>
          } />
          <Route path="/route-intelligence/settings" element={
            <Suspense fallback={<PageLoader />}><RouteIntelligenceSettingsPage /></Suspense>
          } />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
