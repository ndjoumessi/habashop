import { convertFromXOF, convertToXOF } from '@/services/exchangeRate'

const RATES = { EUR: 0.001524, USD: 0.00164 }

describe('convertFromXOF', () => {
  it('XOF/XAF = identité', () => {
    expect(convertFromXOF(10000, 'XOF', RATES)).toBe(10000)
    expect(convertFromXOF(10000, 'XAF', RATES)).toBe(10000)
  })
  it('convertit vers la devise cible', () => {
    expect(convertFromXOF(10000, 'EUR', RATES)).toBeCloseTo(15.24, 2)
  })
  it('devise inconnue → identité (pas de taux)', () => {
    expect(convertFromXOF(10000, 'JPY', RATES)).toBe(10000)
  })
})

describe('convertToXOF (inverse — fix montant espèces)', () => {
  it('XOF/XAF = identité', () => {
    expect(convertToXOF(12000, 'XOF', RATES)).toBe(12000)
    expect(convertToXOF(12000, 'XAF', RATES)).toBe(12000)
  })
  it('ramène un montant saisi en devise → XOF', () => {
    // 20 € reçus ≈ 13123 XOF
    expect(Math.round(convertToXOF(20, 'EUR', RATES))).toBe(13123)
  })
  it('devise inconnue → identité', () => {
    expect(convertToXOF(20, 'JPY', RATES)).toBe(20)
  })
  it('round-trip XOF → devise → XOF', () => {
    const xof = 10000
    const eur = convertFromXOF(xof, 'EUR', RATES)
    expect(Math.round(convertToXOF(eur, 'EUR', RATES))).toBe(xof)
  })
  it('garde espèces : 20€ reçu couvre un total de 10000 XOF', () => {
    const totalXOF = 10000
    const cashGivenXOF = convertToXOF(20, 'EUR', RATES)
    expect(cashGivenXOF >= totalXOF).toBe(true) // pas « espèces insuffisantes »
  })
})
