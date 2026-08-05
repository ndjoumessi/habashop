import { Smartphone, Coins, Printer } from 'lucide-react'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
}

/**
 * Trois piliers HIÉRARCHISÉS — remplace six cartes de poids identique.
 *
 * Six cartes égales ne disent pas quelle est LA raison d'acheter : le visiteur les lit
 * comme une liste de cases cochées et repart sans avoir retenu l'argument. Ici le
 * Mobile Money occupe toute la largeur, les deux autres se partagent la ligne suivante.
 *
 * ⚠️ Le pilier Mobile Money porte une MENTION DE STATUT, et elle n'est pas de la modestie :
 * mesuré le 2026-08-06 sur Railway, `WAVE_API_KEY` et `ORANGE_CLIENT_ID` sont ABSENTES
 * (le service retourne alors un lien factice `sandbox.wave.com/…`), et les trois providers
 * réellement configurés tournent en `sandbox` / `test` avec auto-approbation. Nommer un
 * provider sans dire qu'il n'encaisse pas encore d'argent réel serait exactement le genre
 * d'affirmation que ce chantier retire.
 */
export default function LandingFeatures({ lp, i }: Props) {
  const card: React.CSSProperties = {
    background: 'var(--grad-card)',
    border: '1px solid var(--border2)',
    borderRadius: 18,
    padding: 'clamp(20px,2.2vw,28px)',
    transition: 'border-color .2s, transform .2s',
  }

  const icon = (Icon: typeof Smartphone, tint: string): React.ReactNode => (
    <span style={{
      width: 44, height: 44, borderRadius: 13, flexShrink: 0,
      background: `color-mix(in srgb,${tint} 14%,transparent)`,
      border: `1px solid color-mix(in srgb,${tint} 30%,transparent)`,
      color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={21} strokeWidth={2.1}/>
    </span>
  )

  const hover = (on: boolean) => (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    el.style.transform = on ? 'translateY(-3px)' : 'none'
    el.style.borderColor = on ? 'var(--border3)' : 'var(--border2)'
  }

  return (
    <section id="section-features" style={{
      padding: '72px clamp(16px,4vw,64px)',
      background: 'var(--bg2)', borderTop: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 34 }}>
          <span style={{
            display: 'inline-block', fontSize: 'var(--fs-caption)', fontWeight: 800,
            letterSpacing: '.8px', color: 'var(--p3)',
          }}>{lp.features_label}</span>
          <h2 style={{
            fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 900, color: 'var(--text)',
            letterSpacing: '-1px', margin: '10px 0 0', lineHeight: 1.15,
          }}>{lp.features_title}</h2>
        </div>

        {/* Pilier dominant */}
        <div style={{ ...card, marginBottom: 16 }} onMouseEnter={hover(true)} onMouseLeave={hover(false)}>
          <div className="lp-pillar-lead" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            {icon(Smartphone, 'var(--p2)')}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 'clamp(18px,2vw,22px)', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-.3px' }}>
                {lp.pillar1_title}
              </h3>
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text2)', lineHeight: 1.65, margin: '0 0 12px', maxWidth: 660 }}>
                {lp.pillar1_desc}
              </p>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 'var(--fs-caption)', fontWeight: 700, padding: '5px 11px', borderRadius: 999,
                color: 'var(--acc3)', background: 'var(--c-orange-bg)', border: '1px solid var(--c-orange-border)',
              }}>
                <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>
                {lp.pillar1_status}
              </span>
            </div>
          </div>
        </div>

        {/* Deux piliers secondaires */}
        <div className="lp-pillar-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { Icon: Coins,   tint: 'var(--acc)',  title: lp.pillar2_title, desc: lp.pillar2_desc },
            { Icon: Printer, tint: 'var(--acc2)', title: lp.pillar3_title, desc: lp.pillar3_desc },
          ].map(p => (
            <div key={p.title} style={card} onMouseEnter={hover(true)} onMouseLeave={hover(false)}>
              {icon(p.Icon, p.tint)}
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)', margin: '14px 0 8px', letterSpacing: '-.2px' }}>
                {p.title}
              </h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', lineHeight: 1.65, margin: 0 }}>
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', margin: '18px 0 0', textAlign: 'center' }}>
          {i(
            'Chaque capacité listée ici est implémentée dans le produit livré.',
            'Every capability listed here is implemented in the shipped product.',
            'Cada capacidad listada aquí está implementada en el producto entregado.',
            'Ogni capacità elencata qui è implementata nel prodotto rilasciato.',
          )}
        </p>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .lp-pillar-row { grid-template-columns: 1fr !important; }
          .lp-pillar-lead { flex-direction: column !important; gap: 14px !important; }
        }
      `}</style>
    </section>
  )
}
