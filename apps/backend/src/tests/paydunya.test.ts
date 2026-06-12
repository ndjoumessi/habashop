import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { verifyIpnHash, normalizeStatus } from '../services/paydunya'

describe('PayDunya — verifyIpnHash (SHA-512 master key, fail-closed)', () => {
  const MASTER = 'test-master-key-123'
  const validHash = createHash('sha512').update(MASTER).digest('hex')

  it('hash valide → accepté', () => {
    expect(verifyIpnHash(validHash, MASTER)).toBe(true)
  })

  it('hash invalide → rejeté', () => {
    expect(verifyIpnHash('deadbeef', MASTER)).toBe(false)
  })

  it('hash absent → rejeté (fail-closed)', () => {
    expect(verifyIpnHash(undefined, MASTER)).toBe(false)
  })

  it('master key absente → rejeté (fail-closed)', () => {
    expect(verifyIpnHash(validHash, undefined)).toBe(false)
  })

  it('longueurs différentes → rejeté (pas de throw)', () => {
    expect(verifyIpnHash('abc', MASTER)).toBe(false)
  })
})

describe('PayDunya — normalizeStatus', () => {
  it('completed reste completed', () => expect(normalizeStatus('completed')).toBe('completed'))
  it('cancelled / canceled → cancelled', () => {
    expect(normalizeStatus('cancelled')).toBe('cancelled')
    expect(normalizeStatus('canceled')).toBe('cancelled')
  })
  it('failed → failed', () => expect(normalizeStatus('failed')).toBe('failed'))
  it('inconnu / vide → pending', () => {
    expect(normalizeStatus('whatever')).toBe('pending')
    expect(normalizeStatus(undefined)).toBe('pending')
  })
})

describe('PayDunya — createInvoice (fetch mocké)', () => {
  beforeEach(() => {
    process.env.PAYDUNYA_MASTER_KEY = 'm'
    process.env.PAYDUNYA_PRIVATE_KEY = 'p'
    process.env.PAYDUNYA_PUBLIC_KEY = 'pub'
    process.env.PAYDUNYA_TOKEN = 't'
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('response_code "00" → retourne token + url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ response_code: '00', response_text: 'https://paydunya.com/checkout/x', token: 'tok_123' }),
    }))
    const { createInvoice } = await import('../services/paydunya')
    const r = await createInvoice({ amount: 5000, description: 'd', storeName: 's', cancelUrl: 'c', returnUrl: 'r', callbackUrl: 'cb' })
    expect(r.token).toBe('tok_123')
    expect(r.url).toContain('paydunya.com')
  })

  it('response_code != "00" → throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ response_code: '1001', response_text: 'clé invalide' }),
    }))
    const { createInvoice } = await import('../services/paydunya')
    await expect(createInvoice({ amount: 5000, description: 'd', storeName: 's', cancelUrl: 'c', returnUrl: 'r', callbackUrl: 'cb' }))
      .rejects.toThrow(/clé invalide/)
  })
})
