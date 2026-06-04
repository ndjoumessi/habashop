import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useEffect, Suspense } from 'react'
import PWAInstallButton from '@/components/ui/PWAInstallButton'
import BillingBanner from '@/components/ui/BillingBanner'
import OfflineBanner from '@/components/ui/OfflineBanner'
import { useI18n } from '@/hooks/useI18n'

export default function AppLayout() {
  const { theme } = useAppStore()
  const { i } = useI18n()
  const token = useAuthStore(s => s.token)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    useNotificationStore.getState().connect(token)
    return () => useNotificationStore.getState().disconnect()
  }, [token])

  // Échap ferme la modale la plus haute : déclenche le clic-backdrop déjà câblé
  // dans chaque modale (onClick={e => e.target === e.currentTarget && close}) →
  // fermeture clavier centralisée, sans toucher chaque composant de modale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const backdrops = document.querySelectorAll<HTMLElement>('.modal-backdrop')
      backdrops[backdrops.length - 1]?.click()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-to-content">
        {i('Aller au contenu principal', 'Skip to main content', 'Ir al contenido principal', 'Vai al contenuto principale')}
      </a>
      <Sidebar />
      <div className="main-content">
        <Header />
        <BillingBanner />
        <OfflineBanner />
        <main id="main-content" tabIndex={-1} className="page-content">
          <Suspense fallback={<div style={{ padding: 40, color: 'var(--text3)', fontFamily: 'var(--font)' }}>Chargement…</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <PWAInstallButton />
    </div>
  )
}
