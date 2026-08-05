import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { D, FONT, LANDING_TRANSLATIONS } from '@/components/landing/landingShared'
import type { Lang, Currency } from '@/components/landing/landingShared'
import LandingNav from '@/components/landing/LandingNav'
import LandingHero from '@/components/landing/LandingHero'
import LandingFeatures from '@/components/landing/LandingFeatures'
import LandingHowItWorks from '@/components/landing/LandingHowItWorks'
import LandingCurrencies from '@/components/landing/LandingCurrencies'
import LandingPricing from '@/components/landing/LandingPricing'
import LandingFAQ from '@/components/landing/LandingFAQ'
import LandingCTA from '@/components/landing/LandingCTA'
import LandingFooter from '@/components/landing/LandingFooter'

/**
 * Vitrine.
 *
 * Quatre sections ont été SUPPRIMÉES le 2026-08-06, sans remplacement :
 *  • `LandingTestimonials` — trois témoignages fabriqués attribués à des personnes
 *    nommées (Mamadou Diallo, Fatou Koné, Ibrahim Touré). Ce n'est pas une licence
 *    marketing mais une pratique commerciale trompeuse ;
 *  • `LandingStats`  — « 16 modules », « 15+ pays cibles » ;
 *  • `LandingTrustBand` — « Déjà actifs … et 8+ pays africains », plus huit drapeaux
 *    dont le Ghana et le Nigeria, qui ne sont pas francophones ;
 *  • `LandingCountries` — « + 140 autres pays », « plus de 150 pays ».
 *
 * Les compteurs de pays de la page se contredisaient : 12 · 8+ · 15+ · 140 · 150+ ·
 * 10 drapeaux. On n'en garde AUCUN — c'est le « 2 vs 7 ruptures » de l'écran Rapports,
 * transposé sur la vitrine.
 */
export default function LandingPage() {
  const navigate = useNavigate()
  const { lang, setLang, currency, setCurrency } = useAppStore()
  const { i } = useI18n()
  const lp = (LANDING_TRANSLATIONS as Record<string, typeof LANDING_TRANSLATIONS.fr>)[lang] ?? LANDING_TRANSLATIONS.fr

  return (
    <div className="public-scope" style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: FONT, overflowX: 'hidden' }}>
      <LandingNav lp={lp} navigate={navigate} lang={lang as Lang} setLang={setLang} currency={currency as Currency} setCurrency={setCurrency} />
      <LandingHero lp={lp} i={i} navigate={navigate} />
      <LandingFeatures lp={lp} i={i} />
      <LandingHowItWorks lp={lp} />
      <LandingCurrencies lp={lp} i={i} lang={lang as Lang} setLang={setLang} />
      <LandingPricing lp={lp} i={i} navigate={navigate} />
      <LandingFAQ lp={lp} />
      <LandingCTA lp={lp} navigate={navigate} />
      <LandingFooter lp={lp} />
    </div>
  )
}
