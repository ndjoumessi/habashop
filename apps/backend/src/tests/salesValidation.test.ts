import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

// Valide la couche zod des routes ventes (item 6, lot 2). Services mockés :
// un body malformé est rejeté AVANT toute logique métier / accès Prisma.
const { db } = vi.hoisted(() => ({
  db: {
    sale: { findFirst: vi.fn(), create: vi.fn() },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    tenant: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: (fn: any) => fn({}),
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'MANAGER', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes } from '../routes/sales'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(saleRoutes)
  await app.ready()
  return app
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/sales — validation zod', () => {
  it('items vide → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: { items: [], total: 0, paymentMode: 'cash' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })

  it('total manquant → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: { items: [{ productId: 'p1', qty: 1, price: 100 }], paymentMode: 'cash' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })

  it('item sans productId → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: { items: [{ qty: 1, price: 100 }], total: 100, paymentMode: 'cash' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })

  it('body valide (prix omis toléré) → passe la validation', async () => {
    db.sale.create.mockResolvedValue({ id: 's1' })
    // Le produit doit EXISTER : depuis le durcissement d'intégrité, un productId inconnu
    // est refusé (400 UNKNOWN_PRODUCT) — ce qui masquerait ce que ce test veut prouver
    // (la couche zod laisse passer un `price` omis).
    db.product.findMany.mockResolvedValue([{ id: 'p1', name: 'P', sellPrice: 100, semiWholesalePrice: null,
      wholesalePrice: null, hasPromotion: false, promotionPrice: null, promotionEnd: null, priceTiers: null,
      stockQty: 999, previousPricing: null, pricingChangedAt: null }])
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: { items: [{ productId: 'p1', qty: 2 }], total: 0, paymentMode: 'cash' } })
    // Prix omis → handler applique Number(price)||0 ; la validation ne bloque pas.
    expect(res.statusCode).not.toBe(400)
  })
})

describe('POST /api/sales/:id/refund — validation zod', () => {
  it('restock non-booléen → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/abc/refund', payload: { reason: 'erreur', restock: 'oui' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })

  it('reason absent → 400 (règle métier du handler, pas la validation)', async () => {
    db.sale.findFirst.mockResolvedValue({ id: 'abc', tenantId: 'T1', status: 'completed', items: [] })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/abc/refund', payload: {} })
    expect(res.statusCode).toBe(400)
    // Message métier conservé (pas le format VALIDATION).
    expect(JSON.parse(res.body).error).toMatch(/motif/)
  })
})
