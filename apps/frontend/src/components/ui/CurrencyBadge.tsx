import { useConfig } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { Lock } from 'lucide-react'
import FocusTooltip from './FocusTooltip'

const CURRENCIES: { code: Currency; flag: string; symbol: string }[] = [
  { code: 'XOF', flag: '🇸🇳', symbol: 'XOF' },
  { code: 'XAF', flag: '🇨🇲', symbol: 'XAF' },
  { code: 'EUR', flag: '🇪🇺', symbol: 'EUR' },
  { code: 'USD', flag: '🇺🇸', symbol: 'USD' },
  { code: 'CAD', flag: '🇨🇦', symbol: 'CAD' },
  { code: 'GBP', flag: '🇬🇧', symbol: 'GBP' },
]

export default function CurrencyBadge() {
  const { currency } = useConfig()
  const { i } = useI18n()
  const current = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0]
  // Badge en lecture seule : la devise se change dans Paramètres. Cadenas + tooltip
  // (survol ET focus clavier) l'indiquent en permanence.
  const tooltipText = i(
    'Devise configurée dans Paramètres',
    'Currency set in Settings',
    'Divisa configurada en Configuración',
    'Valuta configurata in Impostazioni'
  )

  return (
    <FocusTooltip label={tooltipText} placement="bottom">
      <button
        className="icon-btn"
        type="button"
        aria-label={tooltipText}
        style={{
          gap: 4, padding: '6px 9px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
          cursor: 'help',
        }}
      >
        <span>{current.flag}</span>
        <span style={{ color: 'var(--acc)', letterSpacing: '-.3px' }}>{current.symbol}</span>
        <Lock size={10} style={{ color: 'var(--text3)', verticalAlign: 'middle' }} />
      </button>
    </FocusTooltip>
  )
}
