import { describe, it, expect } from 'vitest'
import { suggestedCurrencyForCountry } from '@/utils/countryCurrency'

// Auto-détection devise (Signup ISO-2 / Onboarding noms FR). Pays non mappé → undefined
// (l'appelant ne préremplit pas → laisse le défaut formulaire).
describe('suggestedCurrencyForCountry', () => {
  it('codes ISO-2 → devise zone', () => {
    expect(suggestedCurrencyForCountry('SN')).toBe('XOF')  // UEMOA
    expect(suggestedCurrencyForCountry('CI')).toBe('XOF')
    expect(suggestedCurrencyForCountry('CM')).toBe('XAF')  // CEMAC
    expect(suggestedCurrencyForCountry('FR')).toBe('EUR')
    expect(suggestedCurrencyForCountry('US')).toBe('USD')
    expect(suggestedCurrencyForCountry('CA')).toBe('CAD')
    expect(suggestedCurrencyForCountry('GB')).toBe('GBP')
  })

  it('Maghreb / Suisse (devise locale non supportée) → EUR', () => {
    expect(suggestedCurrencyForCountry('MA')).toBe('EUR')
    expect(suggestedCurrencyForCountry('DZ')).toBe('EUR')
    expect(suggestedCurrencyForCountry('CH')).toBe('EUR')
  })

  it('noms FR (Onboarding) → mappés via ISO', () => {
    expect(suggestedCurrencyForCountry('Sénégal')).toBe('XOF')
    expect(suggestedCurrencyForCountry("Côte d'Ivoire")).toBe('XOF')
    expect(suggestedCurrencyForCountry('France')).toBe('EUR')
    expect(suggestedCurrencyForCountry('Maroc')).toBe('EUR')
  })

  it('code ISO insensible à la casse', () => {
    expect(suggestedCurrencyForCountry('sn')).toBe('XOF')
    expect(suggestedCurrencyForCountry('fr')).toBe('EUR')
  })

  it('pays non mappé / vide → undefined (devise inchangée par l’appelant)', () => {
    expect(suggestedCurrencyForCountry('GH')).toBeUndefined()   // Ghana=GHS non supporté
    expect(suggestedCurrencyForCountry('Nigeria')).toBeUndefined()
    expect(suggestedCurrencyForCountry('Kenya')).toBeUndefined()
    expect(suggestedCurrencyForCountry('')).toBeUndefined()
  })
})
