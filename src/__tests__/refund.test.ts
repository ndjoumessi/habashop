import { canRefundRole, isRefunded, isTrackingPayment } from '@/lib/refund'

// Miroir des règles backend (REFUND_ROLES) + UI (badge remboursé / note suivi mobile money).

describe('canRefundRole', () => {
  it('autorise manager / admin / super_admin', () => {
    expect(canRefundRole('ADMIN')).toBe(true)
    expect(canRefundRole('SUPER_ADMIN')).toBe(true)
    expect(canRefundRole('MANAGER')).toBe(true)
  })
  it('refuse caissier / comptable / RH / inconnu', () => {
    expect(canRefundRole('CASHIER')).toBe(false)
    expect(canRefundRole('ACCOUNTANT')).toBe(false)
    expect(canRefundRole('HR')).toBe(false)
    expect(canRefundRole(undefined)).toBe(false)
    expect(canRefundRole(null)).toBe(false)
    expect(canRefundRole('')).toBe(false)
  })
})

describe('isRefunded', () => {
  it('vrai seulement si status === refunded', () => {
    expect(isRefunded({ status: 'refunded' })).toBe(true)
    expect(isRefunded({ status: 'completed' })).toBe(false)
    expect(isRefunded({ status: undefined })).toBe(false)
  })
})

describe('isTrackingPayment', () => {
  it('vrai pour wave/orange/mtn/mobile (insensible à la casse)', () => {
    expect(isTrackingPayment('wave')).toBe(true)
    expect(isTrackingPayment('Orange')).toBe(true)
    expect(isTrackingPayment('MTN')).toBe(true)
    expect(isTrackingPayment('mobile')).toBe(true)
  })
  it('faux pour espèces / carte / vide', () => {
    expect(isTrackingPayment('cash')).toBe(false)
    expect(isTrackingPayment('card')).toBe(false)
    expect(isTrackingPayment(undefined)).toBe(false)
    expect(isTrackingPayment(null)).toBe(false)
  })
})
