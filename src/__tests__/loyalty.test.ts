import {
  tierForPoints, nextTierFor, progressToNext, loyaltyConfig,
  DEFAULT_POINTS_PER_AMOUNT, DEFAULT_BRONZE_THRESHOLD, DEFAULT_SILVER_THRESHOLD,
} from '@/lib/loyalty'

// Miroir EXACT du backend apps/backend/src/lib/loyalty.ts.
// ⚠️ bronzeThreshold = entrée Silver ; silverThreshold = entrée Gold.
// On ne teste que la dérivation d'AFFICHAGE — la règle de gain reste serveur.

describe('défauts fidélité (v1, alignés backend)', () => {
  it('1 pt / 1000, Bronze→Silver 2000, Silver→Gold 5000', () => {
    expect(DEFAULT_POINTS_PER_AMOUNT).toBe(1000)
    expect(DEFAULT_BRONZE_THRESHOLD).toBe(2000)
    expect(DEFAULT_SILVER_THRESHOLD).toBe(5000)
  })
})

describe('loyaltyConfig (normalisation + garde-fous)', () => {
  it('applique les défauts quand rien n’est fourni', () => {
    expect(loyaltyConfig()).toEqual({ pointsPerAmount: 1000, bronzeThreshold: 2000, silverThreshold: 5000 })
    expect(loyaltyConfig(null)).toEqual({ pointsPerAmount: 1000, bronzeThreshold: 2000, silverThreshold: 5000 })
  })
  it('respecte les valeurs custom du tenant', () => {
    expect(loyaltyConfig({ pointsPerAmount: 500, bronzeThreshold: 1000, silverThreshold: 3000 }))
      .toEqual({ pointsPerAmount: 500, bronzeThreshold: 1000, silverThreshold: 3000 })
  })
  it('ignore les valeurs invalides (0 / NaN / négatif / undefined) → défaut', () => {
    expect(loyaltyConfig({ pointsPerAmount: 0, bronzeThreshold: -5, silverThreshold: NaN }))
      .toEqual({ pointsPerAmount: 1000, bronzeThreshold: 2000, silverThreshold: 5000 })
    expect(loyaltyConfig({ pointsPerAmount: 500 }))
      .toEqual({ pointsPerAmount: 500, bronzeThreshold: 2000, silverThreshold: 5000 })
  })
})

describe('tierForPoints (seuils par défaut)', () => {
  it('Bronze < 2000, Silver 2000–4999, Gold ≥ 5000', () => {
    expect(tierForPoints(0)).toBe('Bronze')
    expect(tierForPoints(1999)).toBe('Bronze')
    expect(tierForPoints(2000)).toBe('Silver')
    expect(tierForPoints(4999)).toBe('Silver')
    expect(tierForPoints(5000)).toBe('Gold')
    expect(tierForPoints(null)).toBe('Bronze')
  })
})

describe('tierForPoints (seuils CUSTOM tenant)', () => {
  it('avec bronze=1000 / silver=3000', () => {
    expect(tierForPoints(999, 1000, 3000)).toBe('Bronze')
    expect(tierForPoints(1000, 1000, 3000)).toBe('Silver')
    expect(tierForPoints(2999, 1000, 3000)).toBe('Silver')
    expect(tierForPoints(3000, 1000, 3000)).toBe('Gold')
  })
})

describe('nextTierFor', () => {
  it('utilise les seuils par défaut', () => {
    expect(nextTierFor('Bronze')).toEqual({ threshold: 2000, nextTier: 'Silver' })
    expect(nextTierFor('Silver')).toEqual({ threshold: 5000, nextTier: 'Gold' })
    expect(nextTierFor('Gold')).toBeNull()
  })
  it('utilise les seuils custom du tenant', () => {
    expect(nextTierFor('Bronze', 1000, 3000)).toEqual({ threshold: 1000, nextTier: 'Silver' })
    expect(nextTierFor('Silver', 1000, 3000)).toEqual({ threshold: 3000, nextTier: 'Gold' })
    expect(nextTierFor('Gold', 1000, 3000)).toBeNull()
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
