import { buildMixedSplit, isMixedValid, SPLIT_METHODS } from '@/lib/paymentSplit'

// Miroir de la sémantique backend : 3 seaux, somme == total, ≥ 2 modes non nuls.

describe('SPLIT_METHODS', () => {
  it('expose cash / mobile / card', () => {
    expect(SPLIT_METHODS).toEqual(['cash', 'mobile', 'card'])
  })
})

describe('buildMixedSplit', () => {
  it('ligne 2 = reste → somme EXACTE = total', () => {
    const s = buildMixedSplit('cash', 3000, 'mobile', 5000)
    expect(s).toEqual({ cashAmount: 3000, mobileMoneyAmount: 2000, cardAmount: 0 })
    expect(s.cashAmount + s.mobileMoneyAmount + s.cardAmount).toBe(5000)
  })
  it('mappe correctement chaque méthode à son seau', () => {
    expect(buildMixedSplit('card', 1500, 'cash', 5000)).toEqual({ cashAmount: 3500, mobileMoneyAmount: 0, cardAmount: 1500 })
    expect(buildMixedSplit('mobile', 2000, 'card', 5000)).toEqual({ cashAmount: 0, mobileMoneyAmount: 2000, cardAmount: 3000 })
  })
  it('borne le montant ligne 1 à [0, total]', () => {
    expect(buildMixedSplit('cash', 9999, 'mobile', 5000)).toEqual({ cashAmount: 5000, mobileMoneyAmount: 0, cardAmount: 0 })
    expect(buildMixedSplit('cash', -100, 'mobile', 5000)).toEqual({ cashAmount: 0, mobileMoneyAmount: 5000, cardAmount: 0 })
  })
})

describe('isMixedValid', () => {
  it('valide : 2 méthodes différentes + 0 < montant1 < total', () => {
    expect(isMixedValid('cash', 'mobile', 3000, 5000)).toBe(true)
  })
  it('invalide : même méthode', () => {
    expect(isMixedValid('cash', 'cash', 3000, 5000)).toBe(false)
  })
  it('invalide : montant1 = 0 ou = total (un seul seau non nul)', () => {
    expect(isMixedValid('cash', 'mobile', 0, 5000)).toBe(false)
    expect(isMixedValid('cash', 'mobile', 5000, 5000)).toBe(false)
    expect(isMixedValid('cash', 'mobile', 6000, 5000)).toBe(false)
  })
})
