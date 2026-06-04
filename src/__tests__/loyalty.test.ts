import { tierForPoints, nextTierFor, progressToNext, LOYALTY_TIERS, POINTS_PER_UNIT } from '@/lib/loyalty'

// Miroir EXACT du backend apps/backend/src/lib/loyalty.ts (paliers 2000/5000, 1 pt / 1000).
// On ne teste que la dérivation d'AFFICHAGE — la règle de gain reste serveur.

describe('constantes fidélité (alignées backend)', () => {
  it('seuils 2000/5000 et 1 pt / 1000', () => {
    expect(LOYALTY_TIERS.silver).toBe(2000)
    expect(LOYALTY_TIERS.gold).toBe(5000)
    expect(POINTS_PER_UNIT).toBe(1000)
  })
})

describe('tierForPoints', () => {
  it('Bronze < 2000', () => {
    expect(tierForPoints(0)).toBe('Bronze')
    expect(tierForPoints(1999)).toBe('Bronze')
    expect(tierForPoints(undefined)).toBe('Bronze')
    expect(tierForPoints(null)).toBe('Bronze')
  })
  it('Silver 2000–4999', () => {
    expect(tierForPoints(2000)).toBe('Silver')
    expect(tierForPoints(4999)).toBe('Silver')
  })
  it('Gold ≥ 5000', () => {
    expect(tierForPoints(5000)).toBe('Gold')
    expect(tierForPoints(99999)).toBe('Gold')
  })
})

describe('nextTierFor', () => {
  it('Bronze → Silver (2000), Silver → Gold (5000), Gold → null', () => {
    expect(nextTierFor('Bronze')).toEqual({ threshold: 2000, nextTier: 'Silver' })
    expect(nextTierFor('Silver')).toEqual({ threshold: 5000, nextTier: 'Gold' })
    expect(nextTierFor('Gold')).toBeNull()
  })
})

describe('progressToNext', () => {
  it('borne 0–100 et calcule le pourcentage', () => {
    expect(progressToNext(0, 2000)).toBe(0)
    expect(progressToNext(1000, 2000)).toBe(50)
    expect(progressToNext(2000, 2000)).toBe(100)
    expect(progressToNext(9999, 2000)).toBe(100) // borné à 100
    expect(progressToNext(100, 0)).toBe(100)     // seuil 0 → 100 (garde-fou)
  })
})
