import { describe, it, expect } from 'vitest'
import { computePaymentStats, type PaymentStatSale } from '../routes/paymentStats'

const sale = (over: Partial<PaymentStatSale>): PaymentStatSale => ({
  total: 1000, status: 'completed', createdAt: new Date('2026-06-12T08:00:00Z'),
  mtnMomoReference: null, campayReference: null, ...over,
})

describe('computePaymentStats', () => {
  it('agrège les ventes MTN (count + montant + dernière)', () => {
    const r = computePaymentStats([
      sale({ mtnMomoReference: 'm1', total: 1000, createdAt: new Date('2026-06-12T08:00:00Z') }),
      sale({ mtnMomoReference: 'm2', total: 2500, createdAt: new Date('2026-06-12T10:30:00Z') }),
    ])
    expect(r.mtn.count).toBe(2)
    expect(r.mtn.amountXof).toBe(3500)
    expect(r.mtn.lastAt).toBe('2026-06-12T10:30:00.000Z')
    expect(r.campay.count).toBe(0)
  })

  it('agrège les ventes Campay séparément de MTN', () => {
    const r = computePaymentStats([
      sale({ campayReference: 'c1', total: 5000 }),
      sale({ mtnMomoReference: 'm1', total: 1000 }),
    ])
    expect(r.campay.count).toBe(1)
    expect(r.campay.amountXof).toBe(5000)
    expect(r.mtn.count).toBe(1)
  })

  it('exclut les ventes remboursées', () => {
    const r = computePaymentStats([
      sale({ mtnMomoReference: 'm1', total: 1000, status: 'refunded' }),
      sale({ mtnMomoReference: 'm2', total: 2000, status: 'completed' }),
    ])
    expect(r.mtn.count).toBe(1)
    expect(r.mtn.amountXof).toBe(2000)
  })

  it('retourne des stats vides sans ventes', () => {
    const r = computePaymentStats([])
    expect(r).toEqual({
      mtn:    { count: 0, amountXof: 0, lastAt: null },
      campay: { count: 0, amountXof: 0, lastAt: null },
    })
  })

  it('garde la transaction la plus récente comme lastAt', () => {
    const r = computePaymentStats([
      sale({ campayReference: 'c1', createdAt: new Date('2026-06-12T14:00:00Z') }),
      sale({ campayReference: 'c2', createdAt: new Date('2026-06-12T09:00:00Z') }),
    ])
    expect(r.campay.lastAt).toBe('2026-06-12T14:00:00.000Z')
  })
})
