import { D, FONT, MONO } from './landingShared'
import type { LandingT, Lang } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
  lang: Lang
  setLang: (l: Lang) => void
}

export default function LandingCurrencies({ lp, i, lang, setLang }: Props) {
  const currencyChips = [
    { code: 'XOF', flag: '🇸🇳', name: i('Franc CFA Ouest', 'West African CFA', 'Franco CFA Oeste', 'Franco CFA Ovest') },
    { code: 'XAF', flag: '🇨🇲', name: i('Franc CFA Centre', 'Central African CFA', 'Franco CFA Centro', 'Franco CFA Centro') },
    { code: 'EUR', flag: '🇪🇺', name: i('Euro', 'Euro', 'Euro', 'Euro') },
    { code: 'USD', flag: '🇺🇸', name: i('Dollar US', 'US Dollar', 'Dólar US', 'Dollaro US') },
    { code: 'CAD', flag: '🇨🇦', name: i('Dollar CA', 'CA Dollar', 'Dólar CA', 'Dollaro CA') },
    { code: 'GBP', flag: '🇬🇧', name: i('Livre Sterling', 'Pound Sterling', 'Libra Esterlina', 'Sterlina') },
  ]

  const languageChips = [
    { flag: '🇫🇷', name: 'Français', code: 'fr' as Lang },
    { flag: '🇬🇧', name: 'English',  code: 'en' as Lang },
    { flag: '🇪🇸', name: 'Español',  code: 'es' as Lang },
    { flag: '🇮🇹', name: 'Italiano', code: 'it' as Lang },
  ]
  return (
    <>
      <section style={{ padding: '64px clamp(16px,4vw,80px)', background: D.bg2, borderTop: `1px solid ${D.border}`, textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 900, color: D.text, letterSpacing: '-.5px', marginBottom: 10 }}>
          {lp.cur_title}
        </h2>
        <p style={{ fontSize: 'var(--fs-body)', color: D.text3, marginBottom: 28 }}>{lp.cur_sub}</p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24, maxWidth: 880, margin: '0 auto 24px' }}>
          {currencyChips.map(c => (
            <div key={c.code} style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${D.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all .15s', cursor: 'default',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,184,0,.08)'; el.style.borderColor = 'rgba(255,184,0,.2)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.04)'; el.style.borderColor = D.border }}
            >
              <span style={{ fontSize: 'var(--fs-xl)' }}>{c.flag}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 'var(--fs-label)', fontWeight: 800, color: D.text, fontFamily: MONO }}>{c.code}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: D.text3 }}>{c.name}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {languageChips.map(l => (
            <button key={l.code} type="button" onClick={() => setLang(l.code)}
              style={{
                padding: '8px 16px', borderRadius: 99,
                background: lang === l.code ? 'rgba(108,71,255,.16)' : 'rgba(108,71,255,.06)',
                border: `1px solid ${lang === l.code ? 'rgba(108,71,255,.4)' : 'rgba(108,71,255,.18)'}`,
                fontSize: 'var(--fs-sm)', fontWeight: 700, color: D.p3,
                cursor: 'pointer', fontFamily: FONT,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all .15s',
              }}>
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
