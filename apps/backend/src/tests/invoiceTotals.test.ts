import { describe, it, expect } from 'vitest'
import { invoiceTotals } from '../lib/invoiceTotals'

/**
 * HT + TVA dérivés du TTC. Le PDF et la page publique lisent CETTE fonction : ce qui est
 * verrouillé ici est l'invariant que les deux surfaces promettent au client.
 */
describe('invoiceTotals', () => {
  it('⚠️ HT + TVA == TTC, exactement — l’invariant que le client vérifie des yeux', () => {
    for (const [ttc, taux] of [[5900, 18], [12800, 19.25], [1, 18], [999_999, 7.5], [0, 18]]) {
      const t = invoiceTotals(ttc, taux)
      expect(t.subtotalHT + t.vatAmount).toBeCloseTo(t.totalTTC, 9)
    }
  })

  it('TVA 18 % sur 5 900 TTC → 5 000 HT + 900 de TVA', () => {
    const t = invoiceTotals(5900, 18)
    expect(t.subtotalHT).toBeCloseTo(5000, 6)
    expect(t.vatAmount).toBeCloseTo(900, 6)
  })

  it('taux camerounais 19,25 % — le TTC se décompose sans arrondi prématuré', () => {
    const t = invoiceTotals(11925, 19.25)
    expect(t.subtotalHT).toBeCloseTo(10000, 6)
    expect(t.vatAmount).toBeCloseTo(1925, 6)
  })

  it('aucune TVA → HT = TTC et TVA 0, jamais une part inventée', () => {
    expect(invoiceTotals(4200, 0)).toEqual({ totalTTC: 4200, subtotalHT: 4200, vatAmount: 0 })
  })

  it('⚠️ taux aberrant (négatif, 100, 150) → traité comme sans TVA, jamais un HT impossible', () => {
    for (const taux of [-18, 100, 150]) {
      const t = invoiceTotals(4200, taux)
      expect(t.subtotalHT).toBe(4200)
      expect(t.vatAmount).toBe(0)
      expect(t.subtotalHT).toBeLessThanOrEqual(t.totalTTC)
    }
  })

  it('entrées non numériques → 0, jamais NaN à l’écran', () => {
    expect(invoiceTotals(NaN, 18).totalTTC).toBe(0)
    expect(invoiceTotals(5900, NaN).vatAmount).toBe(0)
  })
})
