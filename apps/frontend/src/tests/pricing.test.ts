import { describe, it, expect } from 'vitest'
import { resolveTierPrice, validatePriceTiers, type PriceTier } from '@/lib/pricing'

// Tarification POS multi-paliers — logique métier (promo > palier > prix de base).
describe('resolveTierPrice', () => {
  const tiers: PriceTier[] = [
    { minQty: 1, price: 1000, label: 'détail' },
    { minQty: 10, price: 900, label: 'semi-gros' },
    { minQty: 50, price: 800, label: 'gros' },
  ]

  it('aucun palier ni promo → prix de base', () => {
    expect(resolveTierPrice(5, 1000)).toEqual({ price: 1000 })
    expect(resolveTierPrice(5, 1000, [])).toEqual({ price: 1000 })
    expect(resolveTierPrice(5, 1000, null)).toEqual({ price: 1000 })
  })

  it('promo active prioritaire sur paliers ET base', () => {
    expect(resolveTierPrice(100, 1000, tiers, { active: true, price: 750 })).toEqual({ price: 750 })
  })

  it('promo active mais price null → retombe sur paliers/base', () => {
    expect(resolveTierPrice(60, 1000, tiers, { active: true, price: null }))
      .toEqual({ price: 800, tierLabel: 'gros' })
    expect(resolveTierPrice(5, 1000, null, { active: true, price: null })).toEqual({ price: 1000 })
  })

  it('sélectionne le palier de plus haut minQty ≤ qty', () => {
    expect(resolveTierPrice(5, 1000, tiers)).toEqual({ price: 1000, tierLabel: 'détail' })  // ≥1
    expect(resolveTierPrice(10, 1000, tiers)).toEqual({ price: 900, tierLabel: 'semi-gros' })
    expect(resolveTierPrice(49, 1000, tiers)).toEqual({ price: 900, tierLabel: 'semi-gros' })
    expect(resolveTierPrice(50, 1000, tiers)).toEqual({ price: 800, tierLabel: 'gros' })
    expect(resolveTierPrice(999, 1000, tiers)).toEqual({ price: 800, tierLabel: 'gros' })
  })

  it('qty sous le plus petit palier (minQty>1) → prix de base', () => {
    const t: PriceTier[] = [{ minQty: 10, price: 900 }]
    expect(resolveTierPrice(3, 1000, t)).toEqual({ price: 1000 })
  })
})

describe('validatePriceTiers', () => {
  it('null/undefined → ok, liste vide', () => {
    expect(validatePriceTiers(null)).toEqual({ ok: true, tiers: [] })
    expect(validatePriceTiers(undefined)).toEqual({ ok: true, tiers: [] })
  })

  it('non-array → erreur', () => {
    expect(validatePriceTiers({}).ok).toBe(false)
    expect(validatePriceTiers('x').ok).toBe(false)
  })

  it('minQty invalide (<1, non entier) → erreur', () => {
    expect(validatePriceTiers([{ minQty: 0, price: 100 }]).ok).toBe(false)
    expect(validatePriceTiers([{ minQty: 1.5, price: 100 }]).ok).toBe(false)
  })

  it('price invalide (<0) → erreur', () => {
    expect(validatePriceTiers([{ minQty: 1, price: -1 }]).ok).toBe(false)
  })

  it('minQty dupliqué → erreur', () => {
    expect(validatePriceTiers([{ minQty: 10, price: 900 }, { minQty: 10, price: 800 }]).ok).toBe(false)
  })

  it('valide → trié par minQty asc, label trim, vide → undefined', () => {
    const r = validatePriceTiers([
      { minQty: 50, price: 800, label: '  gros  ' },
      { minQty: 1, price: 1000, label: '' },
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tiers).toEqual([
        { minQty: 1, price: 1000, label: undefined },
        { minQty: 50, price: 800, label: 'gros' },
      ])
    }
  })
})
