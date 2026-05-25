import { useState, useEffect } from 'react'
import { useI18n } from '@/hooks/useI18n'

export default function OfflineBanner() {
  const { i } = useI18n()
  const [offline, setOffline] = useState(!navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const [showOnline, setShowOnline] = useState(false)

  useEffect(() => {
    const onOffline = () => {
      setOffline(true)
      setWasOffline(true)
      setShowOnline(false)
    }
    const onOnline = () => {
      setOffline(false)
      if (wasOffline) {
        setShowOnline(true)
        setTimeout(() => {
          setShowOnline(false)
          setWasOffline(false)
        }, 3000)
      }
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [wasOffline])

  if (!offline && !showOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '10px 20px',
        background: offline ? 'rgba(255,59,92,.12)' : 'rgba(0,208,132,.1)',
        border: `1px solid ${offline ? 'rgba(255,59,92,.3)' : 'rgba(0,208,132,.25)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        fontWeight: 600,
        color: offline ? 'var(--danger)' : 'var(--acc2)',
        transition: 'all .3s',
      }}
    >
      <span aria-hidden="true">{offline ? '📡' : '✅'}</span>
      <span>
        {offline
          ? i(
              'Hors-ligne — certaines fonctionnalités sont indisponibles',
              'Offline — some features are unavailable',
              'Sin conexión — algunas funciones no están disponibles',
              'Offline — alcune funzionalità non disponibili',
            )
          : i(
              'Connexion rétablie',
              'Connection restored',
              'Conexión restablecida',
              'Connessione ripristinata',
            )}
      </span>
    </div>
  )
}
