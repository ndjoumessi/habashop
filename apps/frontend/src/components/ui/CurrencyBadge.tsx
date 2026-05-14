import { useState, useRef, useEffect } from 'react'
import { useConfig } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'

const CURRENCIES: { code: Currency; flag: string; symbol: string }[] = [
  { code: 'XOF', flag: '🇸🇳', symbol: 'XOF' },
  { code: 'XAF', flag: '🇨🇲', symbol: 'XAF' },
  { code: 'EUR', flag: '🇪🇺', symbol: 'EUR' },
  { code: 'USD', flag: '🇺🇸', symbol: 'USD' },
  { code: 'CAD', flag: '🇨🇦', symbol: 'CAD' },
]

export default function CurrencyBadge() {
  const { currency, updateConfig } = useConfig()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        onClick={() => setOpen(o => !o)}
        title="Changer la devise"
        style={{ gap: 4, padding: '6px 9px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)' }}
      >
        <span>{current.flag}</span>
        <span style={{ color: 'var(--acc)', letterSpacing: '-.3px' }}>{current.symbol}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 100,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 6, minWidth: 150,
            boxShadow: '0 12px 40px rgba(0,0,0,.45)',
            animation: 'fadeIn .15s ease',
          }}
        >
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => { updateConfig({ currency: c.code }); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px', borderRadius: 8,
                background: currency === c.code ? 'rgba(14,196,126,0.12)' : 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                color: currency === c.code ? 'var(--acc2)' : 'var(--text)',
                fontSize: 13, fontWeight: currency === c.code ? 600 : 400,
                transition: 'background .12s',
              }}
            >
              <span style={{ fontSize: 17 }}>{c.flag}</span>
              <span>{c.code}</span>
              {currency === c.code && <span style={{ marginLeft: 'auto', color: 'var(--acc2)', fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
