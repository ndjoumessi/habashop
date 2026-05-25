import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useEffect, Suspense } from 'react'
import PWAInstallButton from '@/components/ui/PWAInstallButton'
import BillingBanner from '@/components/ui/BillingBanner'

export default function AppLayout() {
  const { theme } = useAppStore()
  const token = useAuthStore(s => s.token)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    useNotificationStore.getState().connect(token)
    return () => useNotificationStore.getState().disconnect()
  }, [token])

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Header />
        <BillingBanner />
        <main className="page-content">
          <Suspense fallback={<div style={{ padding: 40, color: 'var(--text3)', fontFamily: 'var(--font)' }}>Chargement…</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <PWAInstallButton />
    </div>
  )
}
