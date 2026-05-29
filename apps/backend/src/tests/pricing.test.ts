import { describe, it, expect } from 'vitest'
import { resolveTierPrice, validatePriceTiers, type PriceTier } from '../utils/pricing'

describe('resolveTierPrice', () => {
  it('sans tiers ni promo → basePrice', () => {
    expect(resolveTierPrice(5, 4500)).toEqual({ price: 4500 })
    expect(resolveTierPrice(5, 4500, null)).toEqual({ price: 4500 })
    expect(resolveTierPrice(5, 4500, [])).toEqual({ price: 4500 })
  })

  it('1 palier qui matche', () => {
    const tiers: PriceTier[] = [{ minQty: 10, price: 4200, label: 'demi-gros' }]
    expect(resolveTierPrice(10, 4500, tiers)).toEqual({ price: 4200, tierLabel: 'demi-gros' })
    expect(resolveTierPrice(25, 4500, tiers)).toEqual({ price: 4200, tierLabel: 'demi-gros' })
  })

  it('1 palier mais qty insuffisante → basePrice', () => {
    const tiers: PriceTier[] = [{ minQty: 10, price: 4200, label: 'demi-gros' }]
    expect(resolveTierPrice(9, 4500, tiers)).toEqual({ price: 4500 })
    expect(resolveTierPrice(1, 4500, tiers)).toEqual({ price: 4500 })
  })

  it('3 paliers — sélectionne le plus élevé atteint', () => {
    const tiers: PriceTier[] = [
      { minQty: 10, price: 4200, label: 'demi-gros' },
      { minQty: 50, price: 3900, label: 'gros' },
      { minQty: 100, price: 3500, label: 'mega' },
    ]
    expect(resolveTierPrice(1,  4500, tiers)).toEqual({ price: 4500 })
    expect(resolveTierPrice(9,  4500, tiers)).toEqual({ price: 4500 })
    expect(resolveTierPrice(10, 4500, tiers)).toEqual({ price: 4200, tierLabel: 'demi-gros' })
    expect(resolveTierPrice(49, 4500, tiers)).toEqual({ price: 4200, tierLabel: 'demi-gros' })
    expect(resolveTierPrice(50, 4500, tiers)).toEqual({ price: 3900, tierLabel: 'gros' })
    expect(resolveTierPrice(99, 4500, tiers)).toEqual({ price: 3900, tierLabel: 'gros' })
    expect(resolveTierPrice(100, 4500, tiers)).toEqual({ price: 3500, tierLabel: 'mega' })
    expect(resolveTierPrice(500, 4500, tiers)).toEqual({ price: 3500, tierLabel: 'mega' })
  })

  it('3 paliers passés dans le désordre → comportement identique (sort interne)', () => {
    const tiers: PriceTier[] = [
      { minQty: 100, price: 3500, label: 'mega' },
      { minQty: 10, price: 4200, label: 'demi-gros' },
      { minQty: 50, price: 3900, label: 'gros' },
    ]
    expect(resolveTierPrice(75, 4500, tiers)).toEqual({ price: 3900, tierLabel: 'gros' })
  })

  it('promo écrase tout (paliers ignorés)', () => {
    const tiers: PriceTier[] = [{ minQty: 10, price: 4200, label: 'demi-gros' }]
    const promo = { active: true, price: 2000 }
    expect(resolveTierPrice(50, 4500, tiers, promo)).toEqual({ price: 2000 })
    expect(resolveTierPrice(1,  4500, tiers, promo)).toEqual({ price: 2000 })
  })

  it('promo active mais sans price → fallback basePrice (pas casser)', () => {
    const promo = { active: true, price: null }
    expect(resolveTierPrice(5, 4500, null, promo)).toEqual({ price: 4500 })
    expect(resolveTierPrice(50, 4500, [{ minQty: 10, price: 4200, label: 'x' }], promo))
      .toEqual({ price: 4200, tierLabel: 'x' })
  })

  it('promo inactive → on regarde paliers normalement', () => {
    const tiers: PriceTier[] = [{ minQty: 10, price: 4200, label: 'demi-gros' }]
    expect(resolveTierPrice(20, 4500, tiers, { active: false, price: 2000 })).toEqual({ price: 4200, tierLabel: 'demi-gros' })
  })
})

describe('validatePriceTiers', () => {
  it('null / undefined → tableau vide ok', () => {
    expect(validatePriceTiers(null)).toEqual({ ok: true, tiers: [] })
    expect(validatePriceTiers(undefined)).toEqual({ ok: true, tiers: [] })
  })

  it('tableau vide → ok', () => {
    expect(validatePriceTiers([])).toEqual({ ok: true, tiers: [] })
  })

  it('rejette non-array', () => {
    const r = validatePriceTiers('hello')
    expect(r.ok).toBe(false)
  })

  it('rejette item non-objet', () => {
    const r = validatePriceTiers([null, { minQty: 1, price: 1 }])
    expect(r.ok).toBe(false)
  })

  it('rejette minQty < 1', () => {
    expect(validatePriceTiers([{ minQty: 0, price: 100 }]).ok).toBe(false)
    expect(validatePriceTiers([{ minQty: -5, price: 100 }]).ok).toBe(false)
  })

  it('rejette minQty non entier', () => {
    expect(validatePriceTiers([{ minQty: 1.5, price: 100 }]).ok).toBe(false)
  })

  it('rejette price négatif', () => {
    expect(validatePriceTiers([{ minQty: 1, price: -10 }]).ok).toBe(false)
  })

  it('rejette price NaN/Infinity', () => {
    expect(validatePriceTiers([{ minQty: 1, price: NaN }]).ok).toBe(false)
    expect(validatePriceTiers([{ minQty: 1, price: Infinity }]).ok).toBe(false)
  })

  it('rejette doublons minQty', () => {
    const r = validatePriceTiers([
      { minQty: 10, price: 4200 },
      { minQty: 10, price: 4000 },
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) expect((r as { error: string }).error).toMatch(/Duplicate/)
  })

  it('trie ASC par minQty', () => {
    const r = validatePriceTiers([
      { minQty: 100, price: 3500, label: 'mega' },
      { minQty: 10,  price: 4200, label: 'demi' },
      { minQty: 50,  price: 3900, label: 'gros' },
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tiers.map(t => t.minQty)).toEqual([10, 50, 100])
    }
  })

  it('normalise label vide → undefined', () => {
    const r = validatePriceTiers([
      { minQty: 10, price: 4200, label: '   ' },
      { minQty: 50, price: 3900, label: 'gros' },
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tiers[0].label).toBeUndefined()
      expect(r.tiers[1].label).toBe('gros')
    }
  })

  it('accepte 0 prix (article gratuit)', () => {
    expect(validatePriceTiers([{ minQty: 100, price: 0 }]).ok).toBe(true)
  })
})
