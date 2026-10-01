import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { D, FONT, LANDING_TRANSLATIONS } from '@/components/landing/landingShared'
import type { Lang, Currency } from '@/components/landing/landingShared'
import LandingNav from '@/components/landing/LandingNav'
import DemoExpiredNotice from '@/components/landing/DemoExpiredNotice'
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
  const [demoEnCours, setDemoEnCours] = useState(false)

  /**
   * Ouvre une démo jetable et y entre.
   *
   * ⚠️ On ne remet PAS `demoEnCours` à false en cas de succès : la navigation démonte le
   * composant, et le remettre avant ferait clignoter le bouton.
   *
   * ⚠️ Un échec se DIT. Un bouton qui ne répond pas laisse le visiteur sans information, et
   * le repli nommé (créer sa boutique) est ce qu'on a de mieux à lui proposer.
   */
  const ouvrirDemo = async () => {
    setDemoEnCours(true)
    try {
      await useAuthStore.getState().startDemo()
      navigate('/app/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : i(
          'Impossible d’ouvrir la démonstration. Créez votre boutique — l’essai est gratuit.',
          'Could not open the demo. Create your shop — the trial is free.',
          'No se pudo abrir la demostración. Cree su tienda: la prueba es gratuita.',
          'Impossibile aprire la dimostrazione. Crea il tuo negozio: la prova è gratuita.',
        )
      toast.error(message)
      setDemoEnCours(false)
    }
  }

  return (
    <div className="public-scope" style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: FONT, overflowX: 'hidden' }}>
      <LandingNav lp={lp} navigate={navigate} lang={lang as Lang} setLang={setLang} currency={currency as Currency} setCurrency={setCurrency} />
      <DemoExpiredNotice />
      <LandingHero lp={lp} i={i} navigate={navigate} onDemo={ouvrirDemo} demoEnCours={demoEnCours} />
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
