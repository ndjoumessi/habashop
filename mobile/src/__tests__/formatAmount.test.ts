import { formatAmount, formatAmountParts } from '@/stores/appStore'

// Non-régression fuites devise (widget backgroundRefresh + libellé settings) :
// formatAmount doit être DYNAMIQUE — jamais « F »/« FCFA » figé pour un tenant non-XOF.
// Rates explicites → test déterministe (indépendant du cache réseau).
// ⚠️ Séparateur de milliers = U+202F/U+00A0 selon l'ICU → assertions via \s (les couvre).
const RATES = { XOF: 1, XAF: 1, EUR: 0.001524, USD: 0.001639, GBP: 0.001295, CAD: 0.002237, NGN: 1.5 }

describe('formatAmount — devise dynamique (partagé écrans + widget + libellés)', () => {
  it('XOF → FCFA, sans décimales', () => {
    expect(formatAmount(1000, 'XOF', RATES)).toMatch(/^1\s000 FCFA$/)
  })

  it('tenant NON-XOF (EUR) → symbole €, jamais « F » figé', () => {
    const out = formatAmount(1000, 'EUR', RATES)
    expect(out).toMatch(/€$/)
    expect(out).not.toMatch(/FCFA|\bF\b/)
  })

  it('USD → préfixe $', () => {
    expect(formatAmount(1000, 'USD', RATES)).toMatch(/^\$/)
  })

  it('devise inconnue → code ISO en suffixe (pas de « F » ni crash)', () => {
    expect(formatAmount(1000, 'NGN', RATES)).toMatch(/ NGN$/)
  })

  it('XAF (Afrique centrale) → FCFA aussi', () => {
    expect(formatAmount(1000, 'XAF', RATES)).toMatch(/^1\s000 FCFA$/)
  })
})

describe('formatAmountParts — rendu bi-ton tuiles POS (maquette 01)', () => {
  it('XOF → suffixe FCFA séparé, pas de préfixe', () => {
    const p = formatAmountParts(2800, 'XOF', RATES)
    expect(p.prefix).toBe('')
    expect(p.suffix).toBe('FCFA')
    expect(p.amount).toMatch(/^2\s800$/)
  })

  it('USD → préfixe $, suffixe vide', () => {
    const p = formatAmountParts(1000, 'USD', RATES)
    expect(p.prefix).toBe('$')
    expect(p.suffix).toBe('')
  })

  it('formatAmount = préfixe+montant+suffixe (composition, sortie inchangée)', () => {
    const p = formatAmountParts(1000, 'EUR', RATES)
    expect(formatAmount(1000, 'EUR', RATES)).toBe(`${p.prefix}${p.amount} ${p.suffix}`)
  })
})
