import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App'
import './index.css'
import './styles/public.css'
import * as Sentry from '@sentry/react'

// Sentry : actif uniquement si un DSN est fourni ET en build production (inerte sinon).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    release: 'habashop@2.3.0',
    tracesSampleRate: 0.1,
    ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection', 'NetworkError', 'Failed to fetch', 'Load failed'],
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value
      if (msg?.includes('CORS') || msg?.includes('NetworkError')) return null
      return event
    },
  })
}

// ErrorBoundary Sentry si DSN présent, sinon passe-plat (aucune dépendance au runtime Sentry).
const SentryBoundary = (SENTRY_DSN
  ? Sentry.ErrorBoundary
  : ({ children }: { children: React.ReactNode }) => <>{children}</>) as React.ComponentType<any>

function ErrorFallback({ error, resetError }: { error: unknown; resetError: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#07070F', color: '#F0F0FF', fontFamily: 'sans-serif', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Une erreur est survenue</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', textAlign: 'center', maxWidth: 400 }}>
        {(error as Error)?.message ?? 'Erreur inconnue'}
      </p>
      <button onClick={resetError} style={{ padding: '10px 24px', borderRadius: 10, background: '#6C47FF', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
        Réessayer
      </button>
      <button onClick={() => { window.location.href = '/' }} style={{ padding: '8px 20px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,.2)', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 12 }}>
        Retour à l'accueil
      </button>
    </div>
  )
}

if ('serviceWorker' in navigator) {
  // Mise à jour AUTOMATIQUE (commerçants non-techniques) : le SW est configuré en
  // skipWaiting + clientsClaim (vite.config) → le nouveau SW s'active et prend le contrôle
  // dès qu'il est prêt, ce qui déclenche `controllerchange`. On recharge alors UNE fois la
  // page → le marchand bascule sur le nouveau code sans aucune action ni vidage de cache.
  // Garde-fous : `refreshing` empêche toute boucle ; on n'attache l'écouteur QUE s'il existe
  // déjà un contrôleur (= visite de retour → tout changement = mise à jour), pour ne pas
  // recharger inutilement à la toute première visite (première activation du SW).
  if (navigator.serviceWorker.controller) {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      setInterval(() => reg.update(), 30000)
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            // Filet de sécurité : si pour une raison quelconque `controllerchange` ne
            // déclenche pas le reload auto, la bannière « Mise à jour disponible » (Header)
            // reste proposée. En pratique le reload auto arrive avant que le marchand clique.
            window.dispatchEvent(new CustomEvent('sw-update'))
          }
        })
      })
    })
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <SentryBoundary fallback={ErrorFallback}>
          <App />
        </SentryBoundary>
      </TooltipProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--card)',
            color: 'var(--text)',
            border: '1px solid var(--border2)',
            borderRadius: '10px',
            fontFamily: 'Outfit, sans-serif',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)

