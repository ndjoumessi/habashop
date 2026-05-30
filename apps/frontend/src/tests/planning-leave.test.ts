import { describe, it, expect } from 'vitest'
import { weekdayIndicesForRange } from '@/components/planning/planningShared'

// Mappe un intervalle de dates sur des index de jour de semaine (Lun=0…Dim=6).
// Dates de référence : 2026-06-01 = lundi … 2026-06-07 = dimanche, 2026-06-08 = lundi.
describe('weekdayIndicesForRange', () => {
  it('Lun→Ven (2026-06-01 → 2026-06-05) = [0,1,2,3,4]', () => {
    expect(weekdayIndicesForRange('2026-06-01', '2026-06-05')).toEqual([0, 1, 2, 3, 4])
  })

  it('semaine complète Lun→Dim = [0..6]', () => {
    expect(weekdayIndicesForRange('2026-06-01', '2026-06-07')).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('un seul jour (mercredi 2026-06-03) = [2]', () => {
    expect(weekdayIndicesForRange('2026-06-03', '2026-06-03')).toEqual([2])
  })

  it('dédoublonne quand l\'intervalle > 7 jours (Lun→Lun suivant) = [0..6]', () => {
    expect(weekdayIndicesForRange('2026-06-01', '2026-06-08')).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('intervalle invalide (to < from) ou dates vides = []', () => {
    expect(weekdayIndicesForRange('2026-06-05', '2026-06-01')).toEqual([])
    expect(weekdayIndicesForRange('', '')).toEqual([])
  })

  it('dimanche seul (2026-06-07) → index 6 (et pas 0)', () => {
    expect(weekdayIndicesForRange('2026-06-07', '2026-06-07')).toEqual([6])
  })
})
