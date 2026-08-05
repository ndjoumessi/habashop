import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { D, FONT, LANDING_TRANSLATIONS } from '@/components/landing/landingShared'
import LandingPricing from '@/components/landing/LandingPricing'
import LandingFAQ from '@/components/landing/LandingFAQ'
import LandingFooter from '@/components/landing/LandingFooter'

/**
 * Page /pricing.
 *
 * ⚠️ Elle portait sa PROPRE grille tarifaire — Starter 9 900 / Pro 24 900 / Enterprise
 * 49 900 XOF — pendant que la vitrine en affichait une autre (14 400 / 34 750) et que
 * `index.html` en publiait une troisième dans son JSON-LD. Trois prix pour le même
 * produit, sur le même domaine, dont un dans les données structurées lues par Google.
 * La page réutilise désormais `LandingPricing` : une grille, une source
 * (`landingShared.PLAN_PRICE_XOF`).
 *
 * Sont partis avec l'ancienne grille, sans remplacement :
 *  • la bascule « Annuel −20 % » et « 🎁 2 mois offerts » — aucune remise annuelle n'a
 *    jamais été définie ; le prix annuel n'était que le mensuel ×10 déguisé en promotion ;
 *  • le badge « ⚡ PLUS POPULAIRE » — affirmation factuelle sur le comportement d'autres
 *    acheteurs, invérifiable avec zéro client. Remplacé par « Recommandé », qui est un
 *    avis que nous avons le droit d'émettre ;
 *  • le contresens « 22 €/mois » + bouton « Commencer gratuitement » sur la même carte ;
 *  • la réponse FAQ « Hébergé avec SSL » — le chiffrement est un acquis, pas un argument
 *    (les badges SSL/TLS avaient déjà été retirés de la page de connexion pour ce motif).
 */
export default function Pricing() {
  const navigate = useNavigate()
  const { lang } = useAppStore()
  const { i } = useI18n()
  const lp = (LANDING_TRANSLATIONS as Record<string, typeof LANDING_TRANSLATIONS.fr>)[lang] ?? LANDING_TRANSLATIONS.fr

  /**
   * L'ancienne page routait un visiteur DÉJÀ CONNECTÉ vers `/app/upgrade` plutôt que vers
   * l'inscription. `LandingPricing` ne connaît pas la session (elle sert aussi la vitrine
   * publique) : on réécrit donc la destination ici, au lieu de perdre le comportement en
   * réutilisant le composant.
   */
  const goPlan = (to: string) => {
    const connecte = !!localStorage.getItem('habashop_token')
    navigate(connecte ? to.replace('/signup?', '/app/upgrade?') : to)
  }

  return (
    <div className="public-scope" style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: FONT, overflowX: 'hidden' }}>
      <div style={{ padding: 'clamp(20px,3vw,32px) clamp(16px,4vw,64px) 0' }}>
        <button type="button" onClick={() => navigate('/')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'transparent', border: '1px solid var(--border2)', borderRadius: 10,
            padding: '8px 14px', color: 'var(--text2)', fontSize: 'var(--fs-sm)',
            fontWeight: 600, cursor: 'pointer', fontFamily: FONT, transition: 'color .15s, border-color .15s',
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text)'; el.style.borderColor = 'var(--border3)' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text2)'; el.style.borderColor = 'var(--border2)' }}
        >
          <ArrowLeft size={15} strokeWidth={2.4} />
          {i('Accueil', 'Home', 'Inicio', 'Home')}
        </button>
      </div>

      <LandingPricing lp={lp} i={i} navigate={goPlan} />
      <LandingFAQ lp={lp} />
      <LandingFooter lp={lp} />
    </div>
  )
}
