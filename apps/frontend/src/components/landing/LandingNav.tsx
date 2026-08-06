import { LogIn } from 'lucide-react'
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
          <span className="lp-nav-wordmark" style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: D.text, letterSpacing: '-.3px', whiteSpace: 'nowrap' }}>
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
                color: D.text2, fontSize: 'var(--fs-sm)', fontWeight: 600,
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
              padding: '6px 24px 6px 10px', fontSize: 'var(--fs-label)', fontWeight: 700,
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
              padding: '6px 24px 6px 10px', fontSize: 'var(--fs-label)', fontWeight: 700,
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
            className="lp-btn-ghost lp-nav-login"
            aria-label={lp.nav_login}
            style={{
              padding: '8px 16px', borderRadius: 10, background: 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${D.border2}`, color: D.text2,
              fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.06)'; el.style.color = D.text }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = D.text2 }}
          >
            {/* ⚠️ Sous 640 px, le libellé cède la place à l'icône — mais le BOUTON RESTE.
                Il était `display:none`, avec un commentaire affirmant que « le login reste
                accessible via le CTA / le hero » : MESURÉ le 2026-08-06, c'était faux —
                zéro `<a href="/login">` dans toute la page à 390, 360 et 320 px. Le CTA
                dit « Créer ma boutique », et le hero n'a aucun lien de connexion. Un
                client existant sur téléphone ne pouvait tout simplement pas se connecter. */}
            <span className="lp-nav-login-txt">{lp.nav_login}</span>
            <LogIn className="lp-nav-login-ico" size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('/signup')}
            className="lp-nav-cta-signup"
            style={{
              padding: '8px 18px', borderRadius: 10,
              background: `linear-gradient(135deg,${D.p},${D.p2})`,
              border: 'none', color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 800,
              cursor: 'pointer', fontFamily: FONT,
              boxShadow: '0 4px 14px rgba(108,71,255,.35)',
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 6px 20px rgba(108,71,255,.5)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 4px 14px rgba(108,71,255,.35)' }}
          >{lp.cta1}</button>
        </div>
      </nav>

      {/* ⚠️ RESPONSIVE — MESURÉ à 390/360/320 px dans le DOM RENDU, pas lu dans la source.
          Le bouton « Connexion » était `display:none` sous 640 px, justifié par « le login
          reste accessible via le CTA / le hero ». C'était FAUX : aucun `<a href="/login">`
          n'existait dans la page entière à ces largeurs — ni nav, ni hero, ni pied de page.
          Un client déjà inscrit, sur téléphone, ne pouvait pas se connecter.

          Budget mesuré à 390 px : nav 390, padding 2×16 → 358 utilisables ; bloc logo 188,
          CTA 156 → 14 px libres. Un bouton TEXTE (~90 px) ne rentrait effectivement pas :
          la décision de le masquer était dimensionnellement juste, seul son repli était
          imaginaire. On garde donc la contrainte et on change la FORME — icône 38 px.

          Le mot-clé de marque cède la place (le logo reste) : 96 + 38 + 156 + gaps ≈ 300
          sur 358. Vérifié jusqu'à 320 px.

          ⚠️ LA LANGUE reste accessible, la DEVISE non : le produit est livré en 4 langues
          et un visiteur dont le téléphone est en anglais doit pouvoir changer ; la devise
          d'affichage est une préférence secondaire, modifiable une fois connecté, et les
          prix sont annoncés en F CFA de toute façon. */}
      <style>{`
        .lp-nav-login-ico { display: none; }
        @media (max-width: 640px) {
          .lp-nav-login-txt  { display: none !important; }
          .lp-nav-login-ico  { display: inline-flex !important; }
          .lp-nav-login      { padding: 8px 10px !important; }
          .lp-nav-wordmark   { display: none !important; }
          .lp-selectors > select { padding: 6px 20px 6px 7px !important; }
        }
        @media (max-width: 380px) {
          .lp-nav-cta-signup { padding: 8px 14px !important; }
        }
      `}</style>
    </>
  )
}
