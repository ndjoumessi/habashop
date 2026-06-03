import { useState } from 'react'
import { useConfig } from '@/stores/appStore'
import type { Lang } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { Lock } from 'lucide-react'

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'it', flag: '🇮🇹', label: 'IT' },
]

export default function LanguageSwitcher() {
  const { lang } = useConfig()
  const { i } = useI18n()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const current = LANGS.find(l => l.code === lang) ?? LANGS[0]
  // Badge en lecture seule : la langue se change dans Paramètres. Cadenas + tooltip au
  // survol l'indiquent en permanence (indicateur, pas lié au toggle settingsLocked).
  const tooltipText = i(
    'Langue configurée dans Paramètres',
    'Language set in Settings',
    'Idioma configurado en Configuración',
    'Lingua configurata in Impostazioni'
  )

  return (
    <div
      style={{ position: 'relative' }}
      onMouseMove={e => setPos({ x: e.clientX, y: e.clientY - 36 })}
      onMouseLeave={() => setPos(null)}
    >
      <button
        className="icon-btn"
        type="button"
        style={{
          gap: 4, padding: '6px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
          cursor: 'pointer',
        }}
      >
        <span>{current.flag}</span>
        <span style={{ color: 'var(--text2)', fontSize: 11 }}>{current.label}</span>
        <Lock size={10} style={{ color: 'var(--text3)', verticalAlign: 'middle' }} />
      </button>
      {pos && (
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translateX(-50%)',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--text2)',
          fontSize: 11,
          padding: '4px 8px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 99999,
          boxShadow: 'var(--sh-xs)',
        }}>
          {tooltipText}
        </div>
      )}
    </div>
  )
}
