import { resolveLinePrice, capToStock, vatBreakdown } from '@/stores/posStore'
import type { PriceTier } from '@/types'

const TIERS: PriceTier[] = [
  { minQty: 6, price: 1500, label: 'Gros 6+' },
  { minQty: 3, price: 1700, label: 'Semi 3+' },
]

describe('resolveLinePrice (miroir backend resolveTierPrice)', () => {
  it('prix de base si ni promo ni palier', () => {
    expect(resolveLinePrice(2000, 1, null, false, null)).toEqual({ price: 2000 })
  })

  it('la promo gagne sur tout (même avec paliers)', () => {
    expect(resolveLinePrice(2000, 10, TIERS, true, 1200)).toEqual({ price: 1200 })
  })

  it('promo active sans prix → ignore la promo (prix de base)', () => {
    expect(resolveLinePrice(2000, 1, null, true, null)).toEqual({ price: 2000 })
  })

  it('applique le palier matchant la quantité (semi à qty 4)', () => {
    expect(resolveLinePrice(2000, 4, TIERS, false, null)).toEqual({ price: 1700, tierLabel: 'Semi 3+' })
  })

  it('applique le palier le plus haut atteint (gros à qty 6)', () => {
    expect(resolveLinePrice(2000, 6, TIERS, false, null)).toEqual({ price: 1500, tierLabel: 'Gros 6+' })
  })

  it('sous le premier seuil → prix de base', () => {
    expect(resolveLinePrice(2000, 2, TIERS, false, null)).toEqual({ price: 2000 })
  })

  it('paliers vides → prix de base', () => {
    expect(resolveLinePrice(900, 5, [], false, null)).toEqual({ price: 900 })
  })
})

describe('capToStock (anti sur-vente)', () => {
  it('plafonne au stock', () => {
    expect(capToStock(10, 3)).toBe(3)
  })
  it('laisse passer sous le stock', () => {
    expect(capToStock(2, 3)).toBe(2)
  })
  it('égalité = limite', () => {
    expect(capToStock(3, 3)).toBe(3)
  })
  it('stock 0 ou absent → pas de plafond', () => {
    expect(capToStock(5, 0)).toBe(5)
    expect(capToStock(5, undefined)).toBe(5)
  })
})

describe('vatBreakdown (TTC → HT + TVA)', () => {
  it('ventile correctement à 18%', () => {
    const v = vatBreakdown(11800, 18)
    expect(Math.round(v.ht)).toBe(10000)
    expect(Math.round(v.tva)).toBe(1800)
    expect(v.rate).toBe(18)
  })
  it('taux 0 / absent → pas de TVA', () => {
    expect(vatBreakdown(5000, 0)).toEqual({ ht: 5000, tva: 0, rate: 0 })
    expect(vatBreakdown(5000, undefined)).toEqual({ ht: 5000, tva: 0, rate: 0 })
  })
  it('HT + TVA = TTC', () => {
    const v = vatBreakdown(7777, 20)
    expect(Math.round(v.ht + v.tva)).toBe(7777)
  })
})
