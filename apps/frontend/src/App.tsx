import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, canAccess, getLandingForRole } from '@/stores/authStore'
import { authApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import AppLayout from '@/components/layout/AppLayout'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/LoginPage'
import Dashboard from '@/pages/Dashboard'
import POS from '@/pages/POS'
import Stock from '@/pages/Stock'
import Orders from '@/pages/Orders'
import Suppliers from '@/pages/Suppliers'
import Customers from '@/pages/Customers'
import Reports from '@/pages/Reports'
import HR from '@/pages/HR'
import Planning from '@/pages/Planning'
import Payroll from '@/pages/Payroll'
import Expenses from '@/pages/Expenses'
import Forecasts from '@/pages/Forecasts'
import Users from '@/pages/Users'
import Activity from '@/pages/Activity'
import Notifications from '@/pages/Notifications'
import Settings from '@/pages/Settings'
import SignupPage from '@/pages/SignupPage'
import AdminDashboard from '@/pages/AdminDashboard'
import Marketing from '@/pages/Marketing'
import AIAssistant from '@/pages/AIAssistant'
import Goals from '@/pages/Goals'
import APIDocs from '@/pages/APIDocs'
import Integrations from '@/pages/Integrations'
import Onboarding from '@/pages/Onboarding'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function RoleRoute({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!canAccess(user?.role, slug)) {
    return <Navigate to={getLandingForRole(user?.role)} replace />
  }
  return <>{children}</>
}

function AppIndex() {
  const { user } = useAuthStore()
  return <Navigate to={getLandingForRole(user?.role)} replace />
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const role = String(user?.role || '').toUpperCase()
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return <Navigate to={getLandingForRole(user?.role)} replace />
  }
  return <>{children}</>
}

export default function App() {
  const { token, logout, updateUser } = useAuthStore()

  useEffect(() => {
    if (token && token !== 'demo-token-local') {
      authApi.me()
        .then(user => updateUser(user))
        .catch(() => logout())
    }
    // Mise à jour des taux de change au démarrage
    useAppStore.getState().fetchExchangeRates()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AppIndex />} />
        <Route path="dashboard"     element={<RoleRoute slug="dashboard"><Dashboard /></RoleRoute>} />
        <Route path="pos"           element={<RoleRoute slug="pos"><POS /></RoleRoute>} />
        <Route path="stock"         element={<RoleRoute slug="stock"><Stock /></RoleRoute>} />
        <Route path="orders"        element={<RoleRoute slug="orders"><Orders /></RoleRoute>} />
        <Route path="suppliers"     element={<RoleRoute slug="suppliers"><Suppliers /></RoleRoute>} />
        <Route path="customers"     element={<RoleRoute slug="customers"><Customers /></RoleRoute>} />
        <Route path="reports"       element={<RoleRoute slug="reports"><Reports /></RoleRoute>} />
        <Route path="hr"            element={<RoleRoute slug="hr"><HR /></RoleRoute>} />
        <Route path="planning"      element={<RoleRoute slug="planning"><Planning /></RoleRoute>} />
        <Route path="payroll"       element={<RoleRoute slug="payroll"><Payroll /></RoleRoute>} />
        <Route path="expenses"      element={<RoleRoute slug="expenses"><Expenses /></RoleRoute>} />
        <Route path="forecasts"     element={<RoleRoute slug="forecasts"><Forecasts /></RoleRoute>} />
        <Route path="users"         element={<AdminOnly><Users /></AdminOnly>} />
        <Route path="activity"      element={<RoleRoute slug="activity"><Activity /></RoleRoute>} />
        <Route path="notifications" element={<RoleRoute slug="notifications"><Notifications /></RoleRoute>} />
        <Route path="settings"      element={<RoleRoute slug="settings"><Settings /></RoleRoute>} />
        <Route path="marketing"     element={<RoleRoute slug="marketing"><Marketing /></RoleRoute>} />
        <Route path="ai"            element={<RoleRoute slug="ai"><AIAssistant /></RoleRoute>} />
        <Route path="goals"         element={<RoleRoute slug="goals"><Goals /></RoleRoute>} />
        <Route path="api-docs"      element={<AdminOnly><APIDocs /></AdminOnly>} />
        <Route path="integrations"  element={<AdminOnly><Integrations /></AdminOnly>} />
      </Route>
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminOnly>
            <AdminDashboard />
          </AdminOnly>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
