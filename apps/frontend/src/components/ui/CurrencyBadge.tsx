import { useConfig } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { Lock } from 'lucide-react'

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
  const tooltipText = i(
    'Devise configurée dans Paramètres',
    'Currency set in Settings',
    'Divisa configurada en Configuración',
    'Valuta configurata in Impostazioni'
  )

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
          gap: 4, padding: '6px 9px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
          cursor: 'default',
        }}
      >
        <span>{current.flag}</span>
        <span style={{ color: 'var(--acc)', letterSpacing: '-.3px' }}>{current.symbol}</span>
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
