import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const { i } = useI18n()
  // Source de vérité partagée (ping backend), pas navigator.onLine → plus de
  // contradiction avec le badge header, ni de faux « hors-ligne » au chargement.
  const offline = !useOnlineStatus()
  const wasOffline = useRef(false)
  const [showOnline, setShowOnline] = useState(false)

  useEffect(() => {
    if (offline) {
      wasOffline.current = true
      setShowOnline(false)
      return
    }
    // Retour en ligne après une coupure : message transitoire « Connexion rétablie »
    if (wasOffline.current) {
      setShowOnline(true)
      const t = setTimeout(() => {
        setShowOnline(false)
        wasOffline.current = false
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [offline])

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
        fontSize: 'var(--fs-sm)',
        fontWeight: 'var(--fw-regular)',
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
