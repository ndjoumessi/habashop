import { useState } from 'react'
import { Check, ArrowRight } from 'lucide-react'
import { PLANS, YEARLY_MONTHS, amountEur } from '@/lib/plans'
import type { BillingPeriod } from '@/lib/plans'
import type { LandingT } from './landingShared'

interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
  navigate: (to: string) => void
}

/**
 * Grille tarifaire — refonte 2026-08, alignée sur le catalogue le 2026-08-06.
 *
 * ⚠️ LES PRIX VIENNENT DE `lib/plans.ts`, jumeau du backend. Ils ont été en dur ici,
 * et c'est ainsi que la vitrine a pu afficher 8 000 pendant que le tunnel aurait
 * prélevé 9 900. Ne jamais réintroduire un montant littéral dans ce fichier —
 * `planCatalog.test.ts` échoue si on le fait.
 *
 * ⚠️ LE PRIX EST EN FCFA, TOUJOURS, quel que soit le sélecteur de devise de la barre de
 * navigation. Même règle que la console plateforme (#165) : ces montants sont TARIFÉS en
 * franc CFA ; les convertir au taux d'affichage du visiteur rendrait un chiffre qui n'est
 * le prix de personne. L'euro est une mention secondaire, à la PARITÉ FIXE (655,957) —
 * d'où l'absence de « ≈ », qui suggérait un taux flottant.
 *
 * ⚠️ LA BASCULE MENSUEL/ANNUEL EST RÉELLE, contrairement à ce que j'avais conclu au tour
 * précédent en la retirant : `yearly = monthly × 10` est la règle DÉJÀ appliquée par le
 * code (10 mois payés sur 12 = 2 mois offerts). Ce qui était faux, c'était l'ancien
 * libellé « Annuel −20 % » — 2/12 fait 16,7 %, pas 20 %. La remise est annoncée en mois
 * offerts, ce qui se vérifie à la lecture des deux prix.
 *
 * Trois défauts de mise en page corrigés, dans cet ordre d'importance :
 *  1. la carte recommandée avait un FOND PLEIN violet face à deux cartes sombres → on
 *     comparait des cartes, pas des offres. Même surface, même fond ;
 *  2. les trois CTA flottaient à des hauteurs différentes → `flex` colonne + `flex:1` ;
 *  3. les limites étaient DEUX LIGNES BARRÉES juste avant le bouton.
 */
export default function LandingPricing({ lp, i, navigate }: Props) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly')

  const fcfa = (xof: number) => new Intl.NumberFormat('fr-FR').format(xof)
  const euro = (xof: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(amountEur(xof))

  const COPY: Record<string, { sub: string; features: string[] }> = {
    starter:    { sub: lp.starter_sub,    features: [lp.feat_pos_1, lp.feat_stock_500, lp.feat_reports, lp.feat_support] },
    business:   { sub: lp.business_sub,   features: [lp.feat_pos_3, lp.feat_stock_inf, lp.feat_crm, lp.feat_hr_full, lp.feat_5users, lp.feat_priority] },
    enterprise: { sub: lp.enterprise_sub, features: [lp.feat_pos_inf, lp.feat_multi_shop, lp.feat_users_inf, lp.feat_api, lp.feat_onboarding, lp.feat_support_start] },
  }
  // `business` est la formule recommandée ; `enterprise` est sur devis (non achetable).
  const RECOMMENDED = 'business'

  // ⚠️ L'identifiant transmis est celui que le BACKEND connaît. `pro` n'est plus émis :
  // c'est un alias de LECTURE, accepté mais jamais écrit (cf. lib/plans.ts).
  const ctaFor = (id: string, purchasable: boolean) =>
    purchasable
      ? { label: lp.try_free, run: () => navigate(`/signup?plan=${id}&period=${period}`) }
      : { label: lp.contact_us, run: () => { window.location.href = 'mailto:contact@habashop.com' } }

  return (
    <section id="section-pricing" style={{
      padding: '72px clamp(16px,4vw,64px)',
      background: 'var(--bg)', borderTop: '1px solid var(--border)',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 800, letterSpacing: '.8px', color: 'var(--p3)' }}>
            {lp.pricing_label}
          </span>
          <h2 style={{ fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', margin: '10px 0 8px', lineHeight: 1.15 }}>
            {lp.pricing_title}
          </h2>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text2)', margin: 0 }}>{lp.pricing_sub}</p>
        </div>

        {/* Bascule mensuel / annuel — la remise est annoncée en MOIS OFFERTS, pas en
            pourcentage : 2 mois sur 12 font 16,7 %, et l'ancien libellé disait 20 %. */}
        <div role="group" aria-label={lp.period_label} style={{
          display: 'flex', gap: 4, width: 'fit-content', margin: '0 auto 26px',
          background: 'var(--card3)', border: '1px solid var(--border2)', borderRadius: 12, padding: 4,
        }}>
          {([
            { id: 'monthly' as BillingPeriod, label: lp.period_monthly },
            { id: 'yearly'  as BillingPeriod, label: lp.period_yearly  },
          ]).map(p => (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              style={{
                padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', fontSize: 'var(--fs-sm)', fontWeight: 700,
                background: period === p.id ? 'var(--grad-p)' : 'transparent',
                color: period === p.id ? '#fff' : 'var(--text2)',
                transition: 'background .15s, color .15s',
              }}>{p.label}</button>
          ))}
        </div>

        <div className="lp-price-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'stretch',
        }}>
          {PLANS.map(plan => {
            const amount = period === 'yearly' ? plan.yearly : plan.monthly
            const recommended = plan.id === RECOMMENDED
            const copy = COPY[plan.id]
            const cta = ctaFor(plan.id, plan.purchasable)
            return (
              <div key={plan.id} style={{
                display: 'flex', flexDirection: 'column',
                background: 'var(--grad-card)',
                // ⚠️ bordure 2 px sur les TROIS cartes : passer de 1 à 2 px sur la seule
                // carte recommandée la décalerait d'un pixel et casserait l'alignement.
                border: `2px solid ${recommended ? 'var(--p2)' : 'var(--border2)'}`,
                borderRadius: 18, padding: '18px clamp(18px,2vw,24px) clamp(18px,2vw,24px)',
                boxShadow: recommended ? '0 18px 46px -20px color-mix(in srgb,var(--p) 55%,transparent)' : 'none',
              }}>
                {/* Rangée de badge de hauteur FIXE sur les trois cartes → surfaces identiques */}
                <div style={{ minHeight: 24, marginBottom: 10 }}>
                  {recommended && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: 'var(--fs-caption)', fontWeight: 800, letterSpacing: '.5px',
                      textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999,
                      color: 'var(--p3)', background: 'color-mix(in srgb,var(--p) 16%,transparent)',
                      border: '1px solid color-mix(in srgb,var(--p2) 40%,transparent)',
                    }}>{lp.recommended}</span>
                  )}
                </div>

                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-.2px' }}>
                  {plan.label}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', marginTop: 3, marginBottom: 18 }}>
                  {copy.sub}
                </div>

                {/* Prix — FCFA à 24 px, chiffres tabulaires */}
                <div style={{
                  fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1,
                  letterSpacing: '-.5px', fontVariantNumeric: 'tabular-nums',
                }}>
                  {amount === null
                    ? lp.on_estimate
                    : <>{fcfa(amount)}<span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text2)', marginLeft: 5 }}>FCFA</span></>}
                </div>
                {/* « par mois/an » et l'euro sur la MÊME ligne, 12 px — hauteur réservée
                    pour que les listes des trois cartes démarrent au même endroit. */}
                <div style={{ minHeight: 18, marginTop: 5, fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                  {amount !== null && <>{period === 'yearly' ? lp.per_year : lp.per_month} · {euro(amount)} €</>}
                </div>
                <div style={{ minHeight: 16, marginTop: 3, fontSize: 11, fontWeight: 700, color: 'var(--acc)' }}>
                  {amount !== null && period === 'yearly' && lp.months_free}
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '16px 0 18px' }}/>

                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {copy.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 'var(--fs-sm)', color: 'var(--text2)', lineHeight: 1.45 }}>
                      <span aria-hidden="true" style={{
                        width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 1,
                        background: 'color-mix(in srgb,var(--p) 18%,transparent)', color: 'var(--p3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={10} strokeWidth={3.4}/>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button type="button" onClick={cta.run}
                  style={{
                    marginTop: 22, width: '100%', borderRadius: 12, padding: '12px 0',
                    fontSize: 'var(--fs-body)', fontWeight: 800, cursor: 'pointer',
                    fontFamily: 'var(--font)', transition: 'filter .15s, background .15s',
                    background: recommended ? 'var(--grad-p)' : 'var(--card3)',
                    color: recommended ? '#fff' : 'var(--text)',
                    border: recommended ? 'none' : '1px solid var(--border2)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none' }}
                >
                  {cta.label}<ArrowRight size={14}/>
                </button>
              </div>
            )
          })}
        </div>

        {/* La première question d'un commerçant — elle n'était nulle part. */}
        <p style={{
          maxWidth: 640, margin: '22px auto 0', textAlign: 'center',
          fontSize: 'var(--fs-sm)', color: 'var(--text3)', lineHeight: 1.6,
        }}>
          {lp.pay_note}
        </p>
        <p style={{ textAlign: 'center', fontSize: 'var(--fs-caption)', color: 'var(--text4)', margin: '8px 0 0' }}>
          {i(
            `Prix hors taxes, en franc CFA. L’équivalent en euro suit la parité fixe de 655,957. L’abonnement annuel se paie ${YEARLY_MONTHS} mois.`,
            `Prices excluding tax, in CFA francs. The euro figure follows the fixed 655.957 parity. The yearly plan is billed as ${YEARLY_MONTHS} months.`,
            `Precios sin impuestos, en francos CFA. El importe en euros sigue la paridad fija de 655,957. El plan anual se factura ${YEARLY_MONTHS} meses.`,
            `Prezzi al netto delle imposte, in franchi CFA. L’importo in euro segue la parità fissa di 655,957. Il piano annuale è fatturato ${YEARLY_MONTHS} mesi.`,
          )}
        </p>
      </div>

      <style>{`
        @media (max-width: 880px) {
          .lp-price-grid { grid-template-columns: 1fr !important; max-width: 420px; margin: 0 auto; }
        }
      `}</style>
    </section>
  )
}
