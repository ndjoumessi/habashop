import { describe, it, expect } from 'vitest'
import { statusOf } from '@/components/stock/stockShared'

// Statut de stock — logique métier (rupture / bas / OK selon seuil).
// On assert sur `cls` (déterministe) ; `label` passe par t() (i18n).
describe('statusOf', () => {
  it('stock 0 → rupture (badge-red), priorité sur le seuil', () => {
    expect(statusOf(0, 10).cls).toBe('badge-red')
    expect(statusOf(0, 0).cls).toBe('badge-red')
  })

  it('0 < stock ≤ seuil → bas (badge-amber)', () => {
    expect(statusOf(5, 10).cls).toBe('badge-amber')
    expect(statusOf(10, 10).cls).toBe('badge-amber')  // borne incluse
    expect(statusOf(1, 1).cls).toBe('badge-amber')
  })

  it('stock > seuil → OK (badge-green)', () => {
    expect(statusOf(11, 10).cls).toBe('badge-green')
    expect(statusOf(100, 10).cls).toBe('badge-green')
    expect(statusOf(1, 0).cls).toBe('badge-green')  // seuil 0, stock 1 → OK
  })

  it('label défini dans tous les cas', () => {
    for (const [s, t] of [[0, 10], [5, 10], [50, 10]] as const) {
      expect(typeof statusOf(s, t).label).toBe('string')
      expect(statusOf(s, t).label.length).toBeGreaterThan(0)
    }
  })
})
