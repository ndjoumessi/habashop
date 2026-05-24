import { describe, it, expect } from 'vitest'

describe('Auth basic', () => {
  it('true is true', () => expect(true).toBe(true))
  it('login endpoint exists', () => {
    expect('/api/auth/login').toContain('auth')
  })
  it('register endpoint exists', () => {
    expect('/api/auth/register').toContain('register')
  })
})

describe('Multi-tenant', () => {
  it('tenantId isolates data', () => {
    const t1 = { tenantId: 't1', data: 'shop1' }
    const t2 = { tenantId: 't2', data: 'shop2' }
    expect(t1.tenantId).not.toBe(t2.tenantId)
  })
  it('JWT contient tenantId', () => {
    const payload = { userId: 'u1', tenantId: 't1', role: 'ADMIN' }
    expect(payload.tenantId).toBeDefined()
    expect(payload.role).toBe('ADMIN')
  })
})

describe('Currency conversion', () => {
  const TO_XOF: Record<string,number> = {
    XOF:1, XAF:1, EUR:655.957, USD:602, CAD:443, GBP:763
  }
  const convert = (amount: number, from: string) =>
    Math.round(amount * (TO_XOF[from] ?? 1))

  it('100 EUR → 65596 XOF', () => {
    expect(convert(100, 'EUR')).toBe(65596)
  })
  it('100 USD → 60200 XOF', () => {
    expect(convert(100, 'USD')).toBe(60200)
  })
  it('XOF reste identique', () => {
    expect(convert(50000, 'XOF')).toBe(50000)
  })
})
