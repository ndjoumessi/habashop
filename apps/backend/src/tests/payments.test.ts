import { describe, it, expect, afterEach } from 'vitest'
import crypto from 'crypto'
import { verifyOrangeWebhook } from '../services/orangeMoney'
import { decideOrangeWebhook } from '../routes/payments'

const SECRET = 'test-om-secret'
const sign = (payload: string, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex')

describe('verifyOrangeWebhook — HMAC raw body, FAIL CLOSED', () => {
  const body = JSON.stringify({ order_id: 'HABA-OM-x', status: 'SUCCESS', amount: 24900 })
  afterEach(() => { delete process.env.ORANGE_MONEY_WEBHOOK_SECRET })

  it('no secret configured → false (fail closed, contrairement à Wave)', () => {
    delete process.env.ORANGE_MONEY_WEBHOOK_SECRET
    expect(verifyOrangeWebhook(body, sign(body))).toBe(false)
  })

  it('no signature → false', () => {
    process.env.ORANGE_MONEY_WEBHOOK_SECRET = SECRET
    expect(verifyOrangeWebhook(body, undefined)).toBe(false)
  })

  it('wrong signature (wrong secret or garbage) → false', () => {
    process.env.ORANGE_MONEY_WEBHOOK_SECRET = SECRET
    expect(verifyOrangeWebhook(body, sign(body, 'other-secret'))).toBe(false)
    expect(verifyOrangeWebhook(body, 'deadbeef')).toBe(false)
  })

  it('tampered body (signature computed over a different body) → false', () => {
    process.env.ORANGE_MONEY_WEBHOOK_SECRET = SECRET
    expect(verifyOrangeWebhook(body, sign('{"amount":1}'))).toBe(false)
  })

  it('valid HMAC over the exact raw body → true', () => {
    process.env.ORANGE_MONEY_WEBHOOK_SECRET = SECRET
    expect(verifyOrangeWebhook(body, sign(body))).toBe(true)
  })
})

describe('decideOrangeWebhook — fail closed + validation contre le record', () => {
  const pending = { status: 'pending_payment', amount: 24900, currency: 'XOF' }
  const ok = { signatureValid: true, reference: 'HABA-OM-x', planReq: pending, amount: 24900, currency: 'XOF', status: 'SUCCESS' }

  it('POST forgé sans signature valide → 401, AUCUNE activation', () => {
    expect(decideOrangeWebhook({ ...ok, signatureValid: false }))
      .toEqual({ code: 401, activate: false, reason: 'invalid_signature' })
  })

  it('signé mais référence manquante → 400, pas d\'activation', () => {
    const d = decideOrangeWebhook({ ...ok, reference: undefined })
    expect(d.activate).toBe(false)
    expect(d.code).toBe(400)
  })

  it('signé + référence inconnue → 404, pas d\'activation', () => {
    expect(decideOrangeWebhook({ ...ok, planReq: null }))
      .toEqual({ code: 404, activate: false, reason: 'unknown_reference' })
  })

  it('signé mais montant ≠ record → 403, pas d\'activation (ferme l\'attaque amount)', () => {
    expect(decideOrangeWebhook({ ...ok, amount: 100 }))
      .toEqual({ code: 403, activate: false, reason: 'amount_mismatch' })
    expect(decideOrangeWebhook({ ...ok, amount: NaN }).activate).toBe(false)
  })

  it('signé mais devise ≠ record → 403', () => {
    expect(decideOrangeWebhook({ ...ok, currency: 'EUR' }))
      .toEqual({ code: 403, activate: false, reason: 'currency_mismatch' })
  })

  it('signé mais statut ≠ SUCCESS → 200 acquitté, pas d\'activation', () => {
    expect(decideOrangeWebhook({ ...ok, status: 'FAILED' }))
      .toEqual({ code: 200, activate: false, reason: 'not_success' })
  })

  it('idempotence : record déjà traité → 200, pas de double activation', () => {
    expect(decideOrangeWebhook({ ...ok, planReq: { ...pending, status: 'active' } }))
      .toEqual({ code: 200, activate: false, reason: 'already_processed' })
  })

  it('signé + montant/devise concordants + SUCCESS → activation (200, une fois)', () => {
    expect(decideOrangeWebhook(ok)).toEqual({ code: 200, activate: true, reason: 'ok' })
  })

  // Isolation tenant : la décision ne porte aucun tenantId. Le handler retrouve le record
  // par paymentRef (scopé orange_money) et active via les données du RECORD (planReq.tenantId
  // / planReq.amount), JAMAIS via le payload → un webhook forgé ne peut pas viser un autre tenant.
})
