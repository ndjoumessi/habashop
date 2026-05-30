import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { D, FONT, LANDING_TRANSLATIONS } from '@/components/landing/landingShared'
import type { Lang, Currency } from '@/components/landing/landingShared'
import LandingNav from '@/components/landing/LandingNav'
import LandingHero from '@/components/landing/LandingHero'
import LandingTrustBand from '@/components/landing/LandingTrustBand'
import LandingStats from '@/components/landing/LandingStats'
import LandingFeatures from '@/components/landing/LandingFeatures'
import LandingHowItWorks from '@/components/landing/LandingHowItWorks'
import LandingCurrencies from '@/components/landing/LandingCurrencies'
import LandingTestimonials from '@/components/landing/LandingTestimonials'
import LandingCountries from '@/components/landing/LandingCountries'
import LandingPricing from '@/components/landing/LandingPricing'
import LandingFAQ from '@/components/landing/LandingFAQ'
import LandingCTA from '@/components/landing/LandingCTA'
import LandingFooter from '@/components/landing/LandingFooter'

export default function LandingPage() {
  const navigate = useNavigate()
  const { lang, setLang, currency, setCurrency } = useAppStore()
  const { i } = useI18n()
  const lp = (LANDING_TRANSLATIONS as Record<string, typeof LANDING_TRANSLATIONS.fr>)[lang] ?? LANDING_TRANSLATIONS.fr

  return (
    <div className="public-scope" style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: FONT, overflowX: 'hidden' }}>
      <LandingNav lp={lp} navigate={navigate} lang={lang as Lang} setLang={setLang} currency={currency as Currency} setCurrency={setCurrency} />
      <LandingHero lp={lp} i={i} navigate={navigate} />
      <LandingTrustBand lp={lp} i={i} />
      <LandingStats lp={lp} />
      <LandingFeatures lp={lp} i={i} />
      <LandingHowItWorks lp={lp} />
      <LandingCurrencies lp={lp} i={i} lang={lang as Lang} setLang={setLang} />
      <LandingTestimonials lp={lp} />
      <LandingCountries i={i} />
      <LandingPricing lp={lp} navigate={navigate} lang={lang as Lang} currency={currency as Currency} />
      <LandingFAQ lp={lp} />
      <LandingCTA lp={lp} i={i} navigate={navigate} />
      <LandingFooter lp={lp} />
    </div>
  )
}
