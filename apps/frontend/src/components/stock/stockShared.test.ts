import { describe, it, expect } from 'vitest'
import { isActivePromo, type ProductItem } from './stockShared'

// Source unique du badge PROMO de la liste ET du filtre « En promotion » : une promo
// EXPIRÉE ne doit ni afficher le badge ni compter dans le filtre (sinon la liste
// « ment » comme la tuile POS le faisait avant #128).
const base = (over: Partial<ProductItem> = {}): ProductItem => ({
  sku: 'PRD-1', name: '🐟 Sardines', category: 'Conserves',
  buy: 900, sell: 1370, stock: 10, threshold: 5, supplier: '',
  ...over,
})
const now = new Date('2026-07-24T09:00:00.000Z')

describe('isActivePromo', () => {
  it('promo active (date future) → true', () => {
    expect(isActivePromo(base({ hasPromotion: true, promotionEnd: '2999-12-31' }), now)).toBe(true)
  })

  it('promo EXPIRÉE → false (ni badge ni comptage)', () => {
    expect(isActivePromo(base({ hasPromotion: true, promotionEnd: '2020-01-01' }), now)).toBe(false)
  })

  it('promo sans date de fin → true (promo sans échéance)', () => {
    expect(isActivePromo(base({ hasPromotion: true, promotionEnd: '' }), now)).toBe(true)
  })

  it('pas de promo → false', () => {
    expect(isActivePromo(base({ hasPromotion: false }), now)).toBe(false)
  })

  it('champs promo absents → false (produit sans promo)', () => {
    expect(isActivePromo(base(), now)).toBe(false)
  })
})
