import { useState } from 'react'
import ReactDOM from 'react-dom'
import { useConfig } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
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
  const { currency, lang } = useConfig()
  const current = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0]
  const tooltipText = lang === 'en' ? 'Currency set in Settings'
                    : lang === 'es' ? 'Divisa configurada en Configuración'
                    : lang === 'it' ? 'Valuta configurata in Impostazioni'
                    : 'Devise configurée dans Paramètres'

  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={e => {
        const r = e.currentTarget.getBoundingClientRect()
        setTip({ x: r.left + r.width / 2, y: r.top - 8 })
      }}
      onMouseLeave={() => setTip(null)}
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
      {tip && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          left: tip.x,
          top: tip.y,
          transform: 'translate(-50%, -100%)',
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
        </div>,
        document.body
      )}
    </div>
  )
}
