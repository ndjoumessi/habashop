import { describe, it, expect } from 'vitest'
import { eachDateInclusive } from '../lib/dates'

describe('eachDateInclusive (backend)', () => {
  it('intervalle inclus (3 jours)', () => {
    expect(eachDateInclusive('2026-06-01', '2026-06-03')).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })
  it('un seul jour', () => {
    expect(eachDateInclusive('2026-06-10', '2026-06-10')).toEqual(['2026-06-10'])
  })
  it('traverse une fin de mois (UTC, sans dérive)', () => {
    expect(eachDateInclusive('2026-05-30', '2026-06-01')).toEqual(['2026-05-30', '2026-05-31', '2026-06-01'])
  })
  it('to < from / invalide → []', () => {
    expect(eachDateInclusive('2026-06-03', '2026-06-01')).toEqual([])
    expect(eachDateInclusive('', '2026-06-01')).toEqual([])
    expect(eachDateInclusive('03/06/2026', '2026-06-01')).toEqual([])
  })
})
