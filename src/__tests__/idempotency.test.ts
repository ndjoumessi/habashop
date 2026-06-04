import { newIdempotencyKey } from '@/lib/idempotency'

describe('newIdempotencyKey', () => {
  it('génère un UUID v4 bien formé', () => {
    expect(newIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
  it('est unique sur un grand nombre d’appels (pas de collision)', () => {
    const keys = new Set(Array.from({ length: 2000 }, () => newIdempotencyKey()))
    expect(keys.size).toBe(2000)
  })
})
