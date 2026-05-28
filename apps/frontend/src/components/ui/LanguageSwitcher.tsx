import { useConfig } from '@/stores/appStore'
import type { Lang } from '@/stores/appStore'
import { Lock } from 'lucide-react'

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'it', flag: '🇮🇹', label: 'IT' },
]

export default function LanguageSwitcher() {
  const { lang } = useConfig()
  const current = LANGS.find(l => l.code === lang) ?? LANGS[0]
  const tooltipText = lang === 'en' ? 'Language set in Settings'
                    : lang === 'es' ? 'Idioma configurado en Configuración'
                    : lang === 'it' ? 'Lingua configurata in Impostazioni'
                    : 'Langue configurée dans Paramètres'

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={e => {
        const tip = e.currentTarget.querySelector<HTMLSpanElement>(':scope > span')
        if (tip) tip.style.opacity = '1'
      }}
      onMouseLeave={e => {
        const tip = e.currentTarget.querySelector<HTMLSpanElement>(':scope > span')
        if (tip) tip.style.opacity = '0'
      }}
    >
      <button
        className="icon-btn"
        type="button"
        style={{
          gap: 4, padding: '6px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
          cursor: 'default',
        }}
      >
        <span>{current.flag}</span>
        <span style={{ color: 'var(--text2)', fontSize: 11 }}>{current.label}</span>
        <Lock size={10} style={{ color: 'var(--text3)', verticalAlign: 'middle' }} />
      </button>
      <span style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        color: 'var(--text2)',
        fontSize: 11,
        padding: '4px 8px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: 0,
        transition: 'opacity .15s',
        zIndex: 9999,
      }}>
        {tooltipText}
      </span>
    </div>
  )
}
