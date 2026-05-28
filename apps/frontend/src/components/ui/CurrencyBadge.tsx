import { useState } from 'react'
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
  const { currency, settingsLocked } = useConfig()
  const { i } = useI18n()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const current = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0]
  const tooltipText = i(
    'Devise verrouillée dans Paramètres → Sécurité',
    'Currency locked in Settings → Security',
    'Divisa bloqueada en Configuración → Seguridad',
    'Valuta bloccata in Impostazioni → Sicurezza'
  )

  return (
    <div
      style={{ position: 'relative' }}
      onMouseMove={settingsLocked ? e => setPos({ x: e.clientX, y: e.clientY - 36 }) : undefined}
      onMouseLeave={settingsLocked ? () => setPos(null) : undefined}
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
        {settingsLocked && <Lock size={10} style={{ color: 'var(--text3)', verticalAlign: 'middle' }} />}
      </button>
      {settingsLocked && pos && (
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
