import { ArrowRight, Check, Store, WifiOff, RefreshCw } from 'lucide-react'
import { scrollTo } from './landingShared'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
  navigate: (to: string) => void
}

/**
 * Hero — split 2 colonnes, 100 % tokens CSS (lisible en thème Clair comme en Sombre).
 *
 * La colonne droite est une DÉMONSTRATION PRODUIT, et elle remplace délibérément la
 * preuve sociale qui vivait ici (« 500+ Boutiques », « 12 Pays », « 99,9 % », « 4,9/5 »).
 * Un chiffre de preuve sociale demande qu'on nous croie ; un écran de produit se vérifie.
 *
 * ⚠️ La légende « Application mobile HabaShop » est LOAD-BEARING, pas décorative : la file
 * d'attente hors-ligne n'existe QUE dans `mobile/` (`services/offlineQueue.ts`,
 * `components/ui/OfflineBanner.tsx` — d'où vient le libellé « N ventes en attente de
 * synchro » reproduit ici). Le POS web, lui, avorte la vente hors réseau. Retirer cette
 * attribution transformerait une capacité réelle en affirmation fausse.
 *
 * Densité : plus de `minHeight: 100vh` — le hero occupait un écran entier pour trois
 * lignes de texte, ce qui repoussait tout le reste sous la ligne de flottaison.
 */
export default function LandingHero({ lp, i, navigate }: Props) {
  return (
    <section style={{
      padding: '112px clamp(16px,4vw,64px) 64px',
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg,var(--bg) 0%,var(--bg2) 55%,var(--bg) 100%)',
    }}>
      {/* Grille décor (masquée en fondu radial) */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(color-mix(in srgb,var(--p) 6%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--p) 6%,transparent) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%,black 30%,transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%,black 30%,transparent 100%)',
      }}/>
      <div aria-hidden="true" style={{ position: 'absolute', top: '2%', left: '2%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--p) 16%,transparent),transparent 70%)', filter: 'blur(64px)', pointerEvents: 'none' }}/>
      <div aria-hidden="true" style={{ position: 'absolute', bottom: '-6%', right: '4%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle,color-mix(in srgb,var(--acc2) 12%,transparent),transparent 70%)', filter: 'blur(56px)', pointerEvents: 'none' }}/>

      <div className="lp-hero-grid" style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 1140, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1.04fr .96fr', gap: 'clamp(28px,4vw,56px)', alignItems: 'center',
      }}>
        {/* ── Colonne gauche : la promesse ── */}
        <div className="lp-hero-left" style={{ textAlign: 'left' }}>
          <h1 style={{
            fontSize: 'clamp(32px,4.6vw,54px)', fontWeight: 900, color: 'var(--text)',
            letterSpacing: 'clamp(-1.6px,-.12vw,-.4px)', lineHeight: 1.06,
            margin: '0 0 16px', overflowWrap: 'break-word',
          }}>
            {lp.h1a}
            <span style={{ color: 'var(--p2)' }}>{lp.h1_accent}</span>.
          </h1>

          <p style={{
            fontSize: 'clamp(15px,1.4vw,18px)', fontWeight: 500, color: 'var(--text2)',
            lineHeight: 1.6, maxWidth: 540, margin: '0 0 26px',
          }}>
            {lp.hero_sub}
          </p>

          <div className="lp-inline-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <button type="button" onClick={() => navigate('/signup')}
              style={{
                padding: '14px 28px', borderRadius: 14, background: 'var(--grad-p)',
                border: 'none', color: '#fff', fontSize: 'var(--fs-title)', fontWeight: 800,
                cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: 'var(--sh-p2)',
                transition: 'transform .2s, box-shadow .2s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 36px rgba(108,71,255,.5)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'var(--sh-p2)' }}
            >
              {lp.cta1}<ArrowRight size={16} strokeWidth={2.6}/>
            </button>
            <button type="button" onClick={() => scrollTo('section-pricing')}
              style={{
                padding: '14px 24px', borderRadius: 14, background: 'var(--card)',
                border: '1px solid var(--border2)', color: 'var(--text)',
                fontSize: 'var(--fs-title)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
                transition: 'background .2s, border-color .2s',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--card2)'; el.style.borderColor = 'var(--border3)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--card)'; el.style.borderColor = 'var(--border2)' }}
            >
              {lp.cta2}
            </button>
          </div>

          <p className="lp-inline-group" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, margin: 0,
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text3)',
          }}>
            <Check size={14} strokeWidth={3} color="var(--acc2)"/>{lp.hero_note}
          </p>
        </div>

        {/* ── Colonne droite : démonstration produit ── */}
        <div className="lp-hero-right">
          <div
            role="img"
            aria-label={i(
              'Aperçu : une vente encaissée hors-ligne dans l’application mobile, trois ventes en attente de synchronisation',
              'Preview: a sale taken offline in the mobile app, three sales waiting to sync',
              'Vista previa: una venta cobrada sin conexión en la app móvil, tres ventas pendientes de sincronizar',
              'Anteprima: una vendita incassata offline nell’app mobile, tre vendite in attesa di sincronizzazione',
            )}
            style={{
              borderRadius: 20, overflow: 'hidden',
              background: 'var(--grad-card)',
              border: '1px solid var(--border3)',
              boxShadow: '0 36px 80px -24px color-mix(in srgb,var(--p) 45%,transparent)',
            }}>
            {/* Bandeau hors-ligne — reproduit `mobile/src/components/ui/OfflineBanner.tsx` */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
              background: 'var(--c-orange-bg)', borderBottom: '1px solid var(--c-orange-border)',
              fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--acc3)', flexWrap: 'wrap',
            }}>
              <WifiOff size={13} strokeWidth={2.4}/>
              <span>{lp.demo_offline}</span>
              <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: .6 }}/>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                <RefreshCw size={12} strokeWidth={2.4}/>{lp.demo_pending}
              </span>
            </div>

            <div style={{ padding: 'clamp(16px,1.8vw,22px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Store size={14} strokeWidth={2} color="var(--text3)"/>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text2)' }}>Dakar Central</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--acc)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <Check size={12} strokeWidth={3}/>{lp.demo_recorded}
                </span>
              </div>

              {[
                { n: 'Riz local 25 kg',    q: '1 × 11 000', a: '11 000' },
                { n: 'Café Touba 250 g',   q: '2 × 1 300',  a: '2 600'  },
                { n: 'Savon de Marseille', q: '1 × 500',    a: '500'    },
              ].map((l, idx) => (
                <div key={l.n} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px',
                  padding: '8px 0', borderBottom: idx < 2 ? '1px dashed var(--border)' : 'none',
                }}>
                  <span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text)' }}>{l.n}</span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{l.q}</span>
                  </span>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}>{l.a}</span>
                </div>
              ))}

              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
                marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)',
              }}>
                <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', fontWeight: 700 }}>
                  {lp.demo_total}
                </span>
                <span style={{ fontSize: 'clamp(24px,2.6vw,30px)', fontWeight: 800, color: 'var(--acc)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', lineHeight: 1 }}>
                  14 350<small style={{ fontSize: 'var(--fs-label)', fontWeight: 600, color: 'var(--text3)', marginLeft: 5 }}>F CFA</small>
                </span>
              </div>
            </div>

            <div style={{
              padding: '9px 14px', borderTop: '1px solid var(--border)', background: 'var(--card3)',
              fontSize: 'var(--fs-caption)', fontWeight: 600, color: 'var(--text3)', textAlign: 'center',
            }}>
              {lp.demo_caption}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive : < 900px → colonne unique, carte sous le texte, contenu centré */}
      <style>{`
        @media (max-width: 900px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; }
          .lp-hero-left { text-align: center !important; }
          .lp-hero-left .lp-inline-group { justify-content: center !important; }
          .lp-hero-right { max-width: 440px; margin: 0 auto; width: 100%; }
        }
      `}</style>
    </section>
  )
}
