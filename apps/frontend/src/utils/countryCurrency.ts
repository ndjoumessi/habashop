import type { Currency } from '@/stores/appStore'

// Auto-détection devise selon le pays choisi à l'inscription / onboarding.
// Les pays sans devise supportée (Ghana=GHS, Nigeria=NGN, Maroc=MAD, Kenya=KES,
// Suisse=CHF…) retombent sur XOF (fallback).
//
// Deux formats de clé coexistent dans les formulaires :
//   - SignupPage.tsx : codes ISO-2 ('SN', 'FR', 'US'…)
//   - Onboarding.tsx : noms FR ('Sénégal', "Côte d'Ivoire", 'France'…)
// currencyForCountry() accepte les deux.

const ISO_TO_CURRENCY: Record<string, Currency> = {
  // Franc CFA Ouest (UEMOA)
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', NE: 'XOF', TG: 'XOF', BJ: 'XOF',
  // Franc CFA Centre (CEMAC)
  CM: 'XAF', CG: 'XAF', CF: 'XAF', GA: 'XAF', TD: 'XAF', GQ: 'XAF',
  // Zone Euro
  FR: 'EUR', BE: 'EUR', ES: 'EUR', IT: 'EUR', DE: 'EUR', PT: 'EUR',
  // Anglo / Amérique du Nord
  US: 'USD', CA: 'CAD', GB: 'GBP',
}

// Noms FR (valeurs du <select> Onboarding) → code ISO-2 canonique.
const NAME_TO_ISO: Record<string, string> = {
  'Sénégal': 'SN', "Côte d'Ivoire": 'CI', 'Mali': 'ML', 'Burkina Faso': 'BF',
  'Niger': 'NE', 'Togo': 'TG', 'Bénin': 'BJ', 'Guinée': 'GN',
  'Cameroun': 'CM', 'Congo': 'CG', 'Congo RDC': 'CD', 'RD Congo': 'CD',
  'Gabon': 'GA', 'Tchad': 'TD',
  'France': 'FR', 'Belgique': 'BE', 'Suisse': 'CH',
  'España': 'ES', 'Espagne': 'ES', 'Italia': 'IT', 'Italie': 'IT',
  'Deutschland': 'DE', 'Allemagne': 'DE', 'Portugal': 'PT',
  'United Kingdom': 'GB', 'Royaume-Uni': 'GB',
  'Canada': 'CA', 'États-Unis': 'US',
  'Ghana': 'GH', 'Nigeria': 'NG', 'Maroc': 'MA', 'Algérie': 'DZ',
  'Tunisie': 'TN', 'Kenya': 'KE',
}

/** Devise par défaut pour un pays (code ISO-2 ou nom FR). Fallback XOF. */
export function currencyForCountry(country: string): Currency {
  if (!country) return 'XOF'
  const iso = country.length === 2 ? country.toUpperCase() : (NAME_TO_ISO[country] ?? country)
  return ISO_TO_CURRENCY[iso] ?? 'XOF'
}
