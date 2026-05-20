import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
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
import Onboarding from '@/pages/Onboarding'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="stock" element={<Stock />} />
        <Route path="orders" element={<Orders />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="hr" element={<HR />} />
        <Route path="planning" element={<Planning />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="forecasts" element={<Forecasts />} />
        <Route path="users" element={<Users />} />
        <Route path="activity" element={<Activity />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="ai" element={<AIAssistant />} />
        <Route path="goals" element={<Goals />} />
        <Route path="api-docs" element={<APIDocs />} />
      </Route>
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
