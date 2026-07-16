import LogoMark from '@/components/ui/LogoMark'
import { D, FONT, scrollTo } from './landingShared'
import type { LandingT, Lang, Currency } from './landingShared'

interface Props {
  lp: LandingT
  navigate: (to: string) => void
  lang: Lang
  setLang: (l: Lang) => void
  currency: Currency
  setCurrency: (c: Currency) => void
}

export default function LandingNav({ lp, navigate, lang, setLang, currency, setCurrency }: Props) {

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 100,
        background: 'rgba(7,7,15,.85)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${D.border}`,
        display: 'flex', alignItems: 'center',
        padding: '0 clamp(16px,4vw,60px)', gap: 14,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            overflow: 'hidden', display: 'flex',
            boxShadow: 'var(--sh-p)', flexShrink: 0,
          }}>
            <LogoMark />
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: D.text, letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>
            Haba<span style={{ background: `linear-gradient(135deg,${D.p2},${D.p3})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Shop</span>
          </span>
        </div>

        {/* Nav links (desktop) */}
        <div className="lp-nav-desktop" style={{ display: 'flex', gap: 4 }}>
          {[
            { label: lp.nav_features, target: 'section-features' },
            { label: lp.nav_pricing,  target: 'section-pricing'  },
            { label: lp.nav_faq,      target: 'section-faq'      },
          ].map(it => (
            <a key={it.target} href={`#${it.target}`}
              onClick={e => { e.preventDefault(); scrollTo(it.target) }}
              style={{
                padding: '7px 14px', borderRadius: 99,
                color: D.text2, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', cursor: 'pointer', transition: 'color .15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = D.text}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = D.text2}
            >{it.label}</a>
          ))}
        </div>

        {/* Language + Currency */}
        <div className="lp-selectors" style={{ display: 'flex', gap: 6 }}>
          <select value={lang} onChange={e => setLang(e.target.value as Lang)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              background: 'rgba(255,255,255,.05)',
              border: `1px solid ${D.border2}`, borderRadius: 9,
              padding: '6px 24px 6px 10px', fontSize: 12, fontWeight: 700,
              color: D.p3, cursor: 'pointer', fontFamily: FONT, outline: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A991FF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}>
            <option value="fr">🇫🇷 FR</option>
            <option value="en">🇬🇧 EN</option>
            <option value="es">🇪🇸 ES</option>
            <option value="it">🇮🇹 IT</option>
          </select>
          <select value={currency} onChange={e => setCurrency(e.target.value as Currency)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              background: 'rgba(255,255,255,.05)',
              border: `1px solid ${D.border2}`, borderRadius: 9,
              padding: '6px 24px 6px 10px', fontSize: 12, fontWeight: 700,
              color: D.p3, cursor: 'pointer', fontFamily: FONT, outline: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A991FF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}>
            <option value="XOF">XOF</option>
            <option value="XAF">XAF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => navigate('/login')}
            className="lp-btn-ghost"
            style={{
              padding: '8px 16px', borderRadius: 10, background: 'transparent',
              border: `1px solid ${D.border2}`, color: D.text2,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.06)'; el.style.color = D.text }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = D.text2 }}
          >{lp.nav_login}</button>
          <button type="button" onClick={() => navigate('/signup')}
            style={{
              padding: '8px 18px', borderRadius: 10,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: '0 4px 14px rgba(108,71,255,.35)',
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 20px rgba(108,71,255,.5)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 4px 14px rgba(108,71,255,.35)' }}
          >{lp.cta1}</button>
        </div>
      </nav>
    </>
  )
}
