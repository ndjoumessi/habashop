import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { createHash } from 'crypto'

const { db } = vi.hoisted(() => ({
  db: {
    sale:   { findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'CASHIER', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
}))

import { paydunyaPaymentRoutes } from '../routes/paydunyaPayment'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  // Même parser urlencoded que server.ts (clés à plat data[...]).
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_r, body: string, done) => {
    try { done(null, { _form: Object.fromEntries(new URLSearchParams(body)) }) } catch (e) { done(e as Error) }
  })
  await app.register(paydunyaPaymentRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PAYDUNYA_MASTER_KEY = 'master-xyz'
  process.env.PAYDUNYA_PRIVATE_KEY = 'priv'
  process.env.PAYDUNYA_PUBLIC_KEY = 'pub'
  process.env.PAYDUNYA_TOKEN = 'tok'
})

describe('POST /api/payments/paydunya/ipn — hash fail-closed', () => {
  it('hash invalide → 401, pas de lookup vente', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/paydunya/ipn',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'data[status]=completed&data[hash]=deadbeef&data[invoice][token]=tok_1',
    })
    expect(res.statusCode).toBe(401)
    expect(db.sale.findFirst).not.toHaveBeenCalled()
  })

  it('hash valide → 200 + réconciliation (lookup par token)', async () => {
    db.sale.findFirst.mockResolvedValue({ id: 's1' })
    const validHash = createHash('sha512').update('master-xyz').digest('hex')
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/paydunya/ipn',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `data[status]=completed&data[hash]=${validHash}&data[invoice][token]=tok_1`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(db.sale.findFirst).toHaveBeenCalledWith({ where: { paydunyaReference: 'tok_1' }, select: { id: true } })
  })
})

describe('POST /api/payments/paydunya/initiate — garde configuration', () => {
  it('non configuré → 503', async () => {
    delete process.env.PAYDUNYA_MASTER_KEY
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/payments/paydunya/initiate', payload: { amount: 5000 } })
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('PAYDUNYA_NOT_CONFIGURED')
  })

  it('montant invalide → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/payments/paydunya/initiate', payload: { amount: 0 } })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/payments/paydunya/config', () => {
  it('configuré → configured:true + méthodes', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/payments/paydunya/config' })
    expect(res.statusCode).toBe(200)
    const j = res.json()
    expect(j.configured).toBe(true)
    expect(j.methods).toContain('Wave')
  })
})
