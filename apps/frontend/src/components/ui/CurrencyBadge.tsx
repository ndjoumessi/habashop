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

  return (
    <button
      className="icon-btn"
      type="button"
      title={lang === 'en' ? 'Currency set in Settings'
           : lang === 'es' ? 'Divisa configurada en Configuración'
           : lang === 'it' ? 'Valuta configurata in Impostazioni'
           : 'Devise configurée dans Paramètres'}
      style={{
        gap: 4, padding: '6px 9px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
        cursor: 'default',
      }}
    >
      <span>{current.flag}</span>
      <span style={{ color: 'var(--acc)', letterSpacing: '-.3px' }}>{current.symbol}</span>
      <Lock size={10} style={{ color: 'var(--text3)', verticalAlign: 'middle' }} />
    </button>
  )
}
