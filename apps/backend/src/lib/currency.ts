// Conversion devise — source unique pour les rapports (paie + comptable).
// Les montants financiers sont stockés en base XOF (conversion aux frontières
// I/O des forms côté frontend) ; on convertit vers la devise du tenant en sortie.
// Taux fixes (miroir du frontend). XOF/XAF = identité.
export const TO_XOF_RATES: Record<string, number> = { XOF: 1, XAF: 1, EUR: 655.957, USD: 602, CAD: 443, GBP: 763 }

/** Convertit un montant base XOF vers `currency` (arrondi entier). XOF/XAF → identité. */
export function xofToCurrency(amountXOF: number, currency: string): number {
  return Math.round(amountXOF / (TO_XOF_RATES[currency] ?? 1))
}
