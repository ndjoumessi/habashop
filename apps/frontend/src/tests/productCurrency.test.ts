import { describe, it, expect } from 'vitest'
import { hydratePricesFromApi, dehydratePricesForApi } from '@/lib/productCurrency'
import { XOF_PER_EUR } from '@/lib/plans'

/**
 * ⚠️ La parité était RECOPIÉE ici (`const EUR_RATE = 655.957 // approx`) et le commentaire
 * était faux : le franc CFA est arrimé à l'euro à taux FIXE, il n'y a rien d'approximatif.
 * Elle est désormais LUE depuis la source unique. La tolérance epsilon de 1 reste, elle :
 * elle absorbe l'arrondi entier, pas une incertitude de change.
 */
const EUR_RATE = XOF_PER_EUR

describe('hydratePricesFromApi', () => {
  it('XOF → EUR convertit tous les champs prix', () => {
    const api = {
      buyPrice: 1000,
      sellPrice: 1400,
      wholesalePrice: 1200,
      semiWholesalePrice: 1300,
      promotionPrice: 900,
      priceTiers: [
        { minQty: 10, price: 1400, label: 'semi gros' },
        { minQty: 20, price: 1330, label: 'gros' },
      ],
    }
    const h = hydratePricesFromApi(api, 'EUR')
    expect(h.buy).toBeCloseTo(1000 / EUR_RATE, 2)
    expect(h.sell).toBeCloseTo(1400 / EUR_RATE, 2)
    expect(h.priceWholesale).toBeCloseTo(1200 / EUR_RATE, 2)
    expect(h.priceSemiWholesale).toBeCloseTo(1300 / EUR_RATE, 2)
    expect(h.promotionPrice).toBeCloseTo(900 / EUR_RATE, 2)
    expect(h.priceTiers).toHaveLength(2)
    expect(h.priceTiers[0]).toEqual({ minQty: 10, price: expect.any(Number), label: 'semi gros' })
    expect(h.priceTiers[0].price).toBeCloseTo(1400 / EUR_RATE, 2)
    expect(h.priceTiers[1].price).toBeCloseTo(1330 / EUR_RATE, 2)
    expect(h.priceTiers[1].label).toBe('gros')
  })

  it('XOF → XOF (passthrough) ne change rien', () => {
    const api = {
      buyPrice: 1000,
      sellPrice: 1400,
      wholesalePrice: 1200,
      semiWholesalePrice: 1300,
      promotionPrice: null,
      priceTiers: [{ minQty: 10, price: 1400 }],
    }
    const h = hydratePricesFromApi(api, 'XOF')
    expect(h.buy).toBe(1000)
    expect(h.sell).toBe(1400)
    expect(h.priceWholesale).toBe(1200)
    expect(h.priceSemiWholesale).toBe(1300)
    expect(h.promotionPrice).toBe(0)
    expect(h.priceTiers[0].price).toBe(1400)
  })

  it('priceTiers null/undefined → tableau vide', () => {
    expect(hydratePricesFromApi({ priceTiers: null }, 'EUR').priceTiers).toEqual([])
    expect(hydratePricesFromApi({}, 'EUR').priceTiers).toEqual([])
    expect(hydratePricesFromApi({ priceTiers: 'oops' as unknown }, 'EUR').priceTiers).toEqual([])
  })

  it('champs absents → 0 (pas de NaN)', () => {
    const h = hydratePricesFromApi({}, 'EUR')
    expect(h.buy).toBe(0)
    expect(h.sell).toBe(0)
    expect(h.priceWholesale).toBe(0)
    expect(h.priceSemiWholesale).toBe(0)
    expect(h.promotionPrice).toBe(0)
  })

  it('label vide sur tier → key label absente du résultat', () => {
    const h = hydratePricesFromApi({ priceTiers: [{ minQty: 5, price: 100 }] }, 'XOF')
    expect(h.priceTiers[0].label).toBeUndefined()
  })
})

describe('dehydratePricesForApi', () => {
  it('EUR → XOF convertit tous les champs prix', () => {
    const form = {
      buy: 1.52,
      sell: 2.13,
      priceWholesale: 1.83,
      priceSemiWholesale: 1.98,
      promotionPrice: 1.37,
      priceTiers: [
        { minQty: 10, price: 2.13, label: 'semi gros' },
        { minQty: 20, price: 2.03, label: 'gros' },
      ],
    }
    const d = dehydratePricesForApi(form, 'EUR')
    expect(d.buyPrice).toBeCloseTo(1.52 * EUR_RATE, 0) // ~997
    expect(d.sellPrice).toBeCloseTo(2.13 * EUR_RATE, 0) // ~1397
    expect(d.wholesalePrice).toBeCloseTo(1.83 * EUR_RATE, 0)
    expect(d.semiWholesalePrice).toBeCloseTo(1.98 * EUR_RATE, 0)
    expect(d.promotionPrice).toBeCloseTo(1.37 * EUR_RATE, 0)
    expect(d.priceTiers).toHaveLength(2)
    expect(d.priceTiers![0].price).toBeCloseTo(2.13 * EUR_RATE, 0)
    expect(d.priceTiers![0].label).toBe('semi gros')
    expect(d.priceTiers![1].price).toBeCloseTo(2.03 * EUR_RATE, 0)
  })

  it('champs optionnels vides → null (pas 0 forcé)', () => {
    const d = dehydratePricesForApi({ buy: 100, sell: 200 }, 'XOF')
    expect(d.wholesalePrice).toBeNull()
    expect(d.semiWholesalePrice).toBeNull()
    expect(d.promotionPrice).toBeNull()
    expect(d.priceTiers).toBeNull()
  })

  it('priceTiers vide → null (pas []), non-vide → array', () => {
    expect(dehydratePricesForApi({ priceTiers: [] }, 'XOF').priceTiers).toBeNull()
    expect(dehydratePricesForApi({ priceTiers: [{ minQty: 10, price: 100 }] }, 'XOF').priceTiers).toHaveLength(1)
  })
})

describe('round-trip hydrate(dehydrate(x))', () => {
  it('EUR : valeurs préservées à epsilon près', () => {
    const original = {
      buy: 1.52, sell: 2.13,
      priceWholesale: 1.83, priceSemiWholesale: 1.98,
      promotionPrice: 0,
      priceTiers: [{ minQty: 10, price: 2.13, label: 'demi-gros' }],
    }
    const api = dehydratePricesForApi(original, 'EUR')
    const back = hydratePricesFromApi(api, 'EUR')
    expect(back.buy).toBeCloseTo(original.buy, 4)
    expect(back.sell).toBeCloseTo(original.sell, 4)
    expect(back.priceWholesale).toBeCloseTo(original.priceWholesale, 4)
    expect(back.priceSemiWholesale).toBeCloseTo(original.priceSemiWholesale, 4)
    expect(back.priceTiers[0].minQty).toBe(10)
    expect(back.priceTiers[0].label).toBe('demi-gros')
    expect(back.priceTiers[0].price).toBeCloseTo(original.priceTiers[0].price, 4)
  })

  it('XOF (passthrough) : strictement identique', () => {
    const original = {
      buy: 1000, sell: 1400,
      priceWholesale: 1200, priceSemiWholesale: 1300,
      promotionPrice: 900,
      priceTiers: [{ minQty: 10, price: 1400, label: 'semi gros' }],
    }
    const api = dehydratePricesForApi(original, 'XOF')
    const back = hydratePricesFromApi(api, 'XOF')
    expect(back.buy).toBe(1000)
    expect(back.sell).toBe(1400)
    expect(back.priceTiers[0].price).toBe(1400)
    expect(back.priceTiers[0].label).toBe('semi gros')
  })
})

describe('bug réel reproduit (Tomate concentrée 800g)', () => {
  it('user EUR tape 1400 dans tier → backend reçoit ~918K XOF', () => {
    const form = {
      buy: 0, sell: 2.13,
      priceTiers: [
        { minQty: 10, price: 1400, label: 'semi gros' },
        { minQty: 20, price: 1330, label: 'gros' },
      ],
    }
    const d = dehydratePricesForApi(form, 'EUR')
    expect(d.priceTiers![0].price).toBeCloseTo(1400 * EUR_RATE, 0) // ~918340 XOF
    expect(d.priceTiers![1].price).toBeCloseTo(1330 * EUR_RATE, 0)
    // Au POS, ce 918K XOF affiché en EUR via fmt redonnera 1400 EUR. Donc :
    // qty=10 × 1400 EUR = 14000 EUR (match l'attente utilisateur)
  })
})
