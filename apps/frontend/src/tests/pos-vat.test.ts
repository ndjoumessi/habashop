import { describe, it, expect } from 'vitest'
import { computePosVat } from '@/components/pos/posShared'

// Applique la config POS TVA : TTC (prix incluent la TVA) → on extrait ; HT → on ajoute.
describe('computePosVat', () => {
  it('TTC (prix incluent la TVA) : extrait la TVA, total inchangé', () => {
    const r = computePosVat(11800, 18, true)
    expect(r.total).toBe(11800)                 // ce qui est facturé = sous-total
    expect(Math.round(r.totalHT)).toBe(10000)   // 11800 / 1.18
    expect(Math.round(r.tva)).toBe(1800)
  })

  it('HT (prix hors taxes) : AJOUTE la TVA au-dessus', () => {
    const r = computePosVat(10000, 18, false)
    expect(r.totalHT).toBe(10000)
    expect(r.tva).toBe(1800)
    expect(r.total).toBe(11800)                 // 10000 × 1.18
  })

  it('taux 0 % : pas de TVA, total = sous-total dans les deux modes', () => {
    expect(computePosVat(5000, 0, true)).toEqual({ totalHT: 5000, tva: 0, total: 5000 })
    expect(computePosVat(5000, 0, false)).toEqual({ totalHT: 5000, tva: 0, total: 5000 })
  })

  it('taux négatif borné à 0', () => {
    expect(computePosVat(5000, -5, false).total).toBe(5000)
  })
})
