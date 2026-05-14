import { useState, useRef, useEffect } from 'react'
import { useConfig } from '@/stores/appStore'
import type { Lang } from '@/stores/appStore'

const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'it', flag: '🇮🇹', label: 'IT' },
]

export default function LanguageSwitcher() {
  const { lang, updateConfig } = useConfig()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = LANGS.find(l => l.code === lang) ?? LANGS[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        onClick={() => setOpen(o => !o)}
        title="Changer la langue"
        style={{ gap: 4, padding: '6px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)' }}
      >
        <span>{current.flag}</span>
        <span style={{ color: 'var(--text2)', fontSize: 11 }}>{current.label}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 100,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 6, minWidth: 130,
            boxShadow: '0 12px 40px rgba(0,0,0,.45)',
            animation: 'fadeIn .15s ease',
          }}
        >
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { updateConfig({ lang: l.code }); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px', borderRadius: 8,
                background: lang === l.code ? 'rgba(99,102,241,0.12)' : 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                color: lang === l.code ? 'var(--p2)' : 'var(--text)',
                fontSize: 13, fontWeight: lang === l.code ? 600 : 400,
                transition: 'background .12s',
              }}
            >
              <span style={{ fontSize: 17 }}>{l.flag}</span>
              <span>{l.label}</span>
              {lang === l.code && <span style={{ marginLeft: 'auto', color: 'var(--acc2)', fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
