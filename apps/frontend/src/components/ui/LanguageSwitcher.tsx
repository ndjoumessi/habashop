import { useConfig } from '@/stores/appStore'
import type { Lang } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { Lock } from 'lucide-react'
import FocusTooltip from './FocusTooltip'

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'it', flag: '🇮🇹', label: 'IT' },
]

export default function LanguageSwitcher() {
  const { lang } = useConfig()
  const { i } = useI18n()
  const current = LANGS.find(l => l.code === lang) ?? LANGS[0]
  // Badge en lecture seule : la langue se change dans Paramètres. Cadenas + tooltip
  // (survol ET focus clavier) l'indiquent en permanence.
  const tooltipText = i(
    'Langue configurée dans Paramètres',
    'Language set in Settings',
    'Idioma configurado en Configuración',
    'Lingua configurata in Impostazioni'
  )

  return (
    <FocusTooltip label={tooltipText} placement="bottom">
      <button
        className="icon-btn"
        type="button"
        aria-label={tooltipText}
        style={{
          gap: 4, padding: '6px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
          cursor: 'help',
        }}
      >
        <span>{current.flag}</span>
        <span style={{ color: 'var(--text2)', fontSize: 11 }}>{current.label}</span>
        <Lock size={10} style={{ color: 'var(--text3)', verticalAlign: 'middle' }} />
      </button>
    </FocusTooltip>
  )
}
