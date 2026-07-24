import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { createHmac } from 'crypto'

// ⚠️ Le webhook Campay signe son JSON en HMAC-SHA256(rawBody, clé). Sans capture du corps
// BRUT, la vérif retombe sur JSON.stringify(request.body) — qui NE reproduit PAS les octets
// signés (espaces, ordre des clés) → tous les webhooks Campay légitimes rejetés en 401.
// Ce test envoie un JSON AVEC ESPACES et signe les octets EXACTS : il ne passe que si le
// plugin capture réellement rawBody (un re-JSON.stringify compact échouerait).

const { db } = vi.hoisted(() => ({ db: { sale: { findFirst: vi.fn(), update: vi.fn() } } }))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({ authenticate: vi.fn(async () => {}) }))
vi.mock('../services/campay', () => ({ collect: vi.fn(), getStatus: vi.fn(), getPaymentLink: vi.fn() }))

import { campayPaymentRoutes } from '../routes/campayPayment'

const KEY = 'campay-webhook-secret'
const OLD_ENV = { ...process.env }

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler) // route /request porte un schema zod
  await app.register(campayPaymentRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CAMPAY_WEBHOOK_KEY = KEY
  db.sale.findFirst.mockResolvedValue(null) // vente non trouvée → 200 (mais signature acceptée)
})
afterEach(() => { process.env = { ...OLD_ENV } })

describe('POST /api/payments/campay/webhook — capture rawBody', () => {
  // JSON AVEC espaces + retours : JSON.stringify(objet parsé) donnerait une forme COMPACTE
  // différente → un fallback re-sérialisé échouerait la signature. Seul le vrai rawBody matche.
  const rawBody = '{\n  "reference": "CMP-123",\n  "status": "SUCCESS",\n  "external_reference": "sale-1"\n}'
  const sign = (body: string) => createHmac('sha256', KEY).update(body).digest('hex')

  it('signature calculée sur les octets EXACTS → ACCEPTÉE (pas de 401)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/campay/webhook',
      headers: { 'x-campay-signature': sign(rawBody), 'content-type': 'application/json' },
      payload: rawBody,
    })
    expect(res.statusCode).not.toBe(401) // signature acceptée (le rawBody a bien été capturé)
    expect(res.statusCode).toBe(200)     // vente non trouvée → traité, pas rejeté
  })

  it('mauvaise signature → 401 (le garde tient toujours)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/campay/webhook',
      headers: { 'x-campay-signature': 'deadbeef', 'content-type': 'application/json' },
      payload: rawBody,
    })
    expect(res.statusCode).toBe(401)
  })

  it('clé webhook absente → 401 (fail-closed)', async () => {
    delete process.env.CAMPAY_WEBHOOK_KEY
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/campay/webhook',
      headers: { 'x-campay-signature': sign(rawBody), 'content-type': 'application/json' },
      payload: rawBody,
    })
    expect(res.statusCode).toBe(401)
  })
})
