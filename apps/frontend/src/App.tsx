import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, canAccess, getLandingForRole } from '@/stores/authStore'
import { authApi, tenantApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import AppLayout from '@/components/layout/AppLayout'
import { ConfirmHost } from '@/lib/confirm'

// Pages chargées à la demande (code-splitting par route) → réduit le bundle initial
const LandingPage    = lazy(() => import('@/pages/LandingPage'))
const LoginPage      = lazy(() => import('@/pages/LoginPage'))
const Dashboard      = lazy(() => import('@/pages/Dashboard'))
const POS            = lazy(() => import('@/pages/POS'))
const Stock          = lazy(() => import('@/pages/Stock'))
const Orders         = lazy(() => import('@/pages/Orders'))
const Suppliers      = lazy(() => import('@/pages/Suppliers'))
const Customers      = lazy(() => import('@/pages/Customers'))
const Reports        = lazy(() => import('@/pages/Reports'))
const HR             = lazy(() => import('@/pages/HR'))
const Planning       = lazy(() => import('@/pages/Planning'))
const Payroll        = lazy(() => import('@/pages/Payroll'))
const Expenses       = lazy(() => import('@/pages/Expenses'))
const Forecasts      = lazy(() => import('@/pages/Forecasts'))
const Users          = lazy(() => import('@/pages/Users'))
const Activity       = lazy(() => import('@/pages/Activity'))
const Notifications  = lazy(() => import('@/pages/Notifications'))
const Settings       = lazy(() => import('@/pages/Settings'))
const SignupPage     = lazy(() => import('@/pages/SignupPage'))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'))
const Marketing      = lazy(() => import('@/pages/Marketing'))
const AIAssistant    = lazy(() => import('@/pages/AIAssistant'))
const Goals          = lazy(() => import('@/pages/Goals'))
const Subscriptions  = lazy(() => import('@/pages/Subscriptions'))
const APIDocs        = lazy(() => import('@/pages/APIDocs'))
const Integrations   = lazy(() => import('@/pages/Integrations'))
const Onboarding     = lazy(() => import('@/pages/Onboarding'))
const SelectShop     = lazy(() => import('@/pages/SelectShop'))
const Pricing        = lazy(() => import('@/pages/Pricing'))
const UpgradePlan    = lazy(() => import('@/pages/UpgradePlan'))
const PaymentCallback = lazy(() => import('@/pages/PaymentCallback'))
const Privacy        = lazy(() => import('@/pages/Privacy'))
const PublicCatalog  = lazy(() => import('@/pages/PublicCatalog'))

function RouteFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontFamily: 'var(--font)', fontSize: 14 }}>
      Chargement…
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, tenants, activeTenantId } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // Multi-boutiques : authentifié mais aucune boutique active → sélection requise.
  if (tenants.length > 1 && !activeTenantId) return <Navigate to="/select-shop" replace />
  return <>{children}</>
}

// Sélecteur de boutique : authentification requise, mais PAS de boutique active
// (c'est l'écran qui sert à en choisir une). Redirige si rien à choisir.
function ProtectedSelectShop() {
  const { isAuthenticated, tenants, activeTenantId, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (activeTenantId || tenants.length <= 1) return <Navigate to={getLandingForRole(user?.role)} replace />
  return <SelectShop />
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
    if (token) {
      authApi.me()
        .then(user => updateUser(user))
        .catch(() => logout())
      // Re-synchronise le tenant (non persisté) au rechargement → la devise
      // d'affichage suit la boutique (setTenant aligne currency sur tenant.currency).
      tenantApi.get()
        .then(t => { if (t?.id) useAppStore.getState().setTenant(t) })
        .catch(() => {})
    }
    // Reset session caisse UNIQUEMENT s'il n'y a PAS de session authentifiée active
    // (évite les valeurs résiduelles d'un logout brutal sans casser le refresh d'un
    // caissier connecté — la session caisse étant persistée via zustand persist).
    // Les changements d'utilisateur sont déjà gérés par closeCashier() dans
    // authStore.login() (ligne 86, 110) et authStore.logout() (ligne 141).
    const hasActiveSession = !!token || !!localStorage.getItem('habashop_token')
    if (!hasActiveSession) {
      useAppStore.setState({
        cashierOpen:        false,
        cashierOpenedAt:    null,
        cashierOpeningFund: 0,
        cashierSessionTx:   0,
        cashierSessionCA:   0,
      })
    }
    // Mise à jour des taux de change au démarrage
    useAppStore.getState().fetchExchangeRates()
    // Préchauffage des routes critiques (mêmes spécifieurs que les lazy() → même chunk) :
    // dès que le thread est libre, Dashboard et POS sont déjà en cache au 1er clic.
    if (token) {
      const warm = () => { import('@/pages/Dashboard'); import('@/pages/POS') }
      if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 })
      else setTimeout(warm, 1500)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/c/:slug" element={<PublicCatalog />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/select-shop" element={<ProtectedSelectShop />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AppIndex />} />
        <Route path="upgrade"          element={<UpgradePlan />} />
        <Route path="upgrade/callback" element={<PaymentCallback />} />
        <Route path="dashboard"     element={<RoleRoute slug="dashboard"><Dashboard /></RoleRoute>} />
        <Route path="pos"           element={<RoleRoute slug="pos"><POS /></RoleRoute>} />
        <Route path="stock"         element={<RoleRoute slug="stock"><Stock /></RoleRoute>} />
        <Route path="orders"        element={<RoleRoute slug="orders"><Orders /></RoleRoute>} />
        <Route path="suppliers"     element={<RoleRoute slug="suppliers"><Suppliers /></RoleRoute>} />
        <Route path="customers"     element={<RoleRoute slug="customers"><Customers /></RoleRoute>} />
        <Route path="subscriptions" element={<RoleRoute slug="subscriptions"><Subscriptions /></RoleRoute>} />
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
    </Suspense>
    <ConfirmHost />
    </>
  )
}
