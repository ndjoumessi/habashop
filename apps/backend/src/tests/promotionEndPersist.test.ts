import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

// ⚠️ promotionEnd n'était PERSISTÉ NULLE PART à la création (le handler create ne le
// destructurait pas) → une promo créée d'emblée n'avait jamais de date de fin, donc
// n'expirait jamais. Le champ « DATE FIN PROMO » du web était mort. Ce test verrouille
// la persistance dans les DEUX chemins (create + update).
const { db } = vi.hoisted(() => ({
  db: {
    product: { update: vi.fn(), count: vi.fn().mockResolvedValue(0), create: vi.fn(), findFirst: vi.fn() },
    // ⚠️ Les routes de ce fichier écrivent désormais un audit (`writeAudit`) : sans ce
    // mock, `prisma.auditLog.create` est `undefined` et lève AVANT que le fail-open ne
    // puisse s'appliquer — l'argument de `writeAudit` est évalué à l'appel.
    auditLog: { create: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => { req.user = { role: 'ADMIN', tenantId: 'MINE', userId: 'u1' }; req.tenantId = 'MINE' },
}))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { productRoutes } from '../routes/products'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(productRoutes)
  await app.ready()
  return app
}

beforeEach(() => vi.clearAllMocks())

describe('promotionEnd — persistance create + update', () => {
  it('POST /api/products : promotionEnd persisté (Date), plus un champ mort', async () => {
    db.product.create.mockResolvedValue({ id: 'p1' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/products',
      payload: { name: 'Riz promo', sellPrice: 1000, hasPromotion: true, promotionPrice: 800, promotionEnd: '2026-06-15T00:00:00.000Z' },
    })
    expect(res.statusCode).toBe(200)
    const data = db.product.create.mock.calls[0][0].data
    expect(data.hasPromotion).toBe(true)
    expect(data.promotionEnd).toBeInstanceOf(Date)
    expect((data.promotionEnd as Date).toISOString()).toBe('2026-06-15T00:00:00.000Z')
  })

  it('POST sans promotionEnd → null (pas de date fabriquée)', async () => {
    db.product.create.mockResolvedValue({ id: 'p2' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/products',
      payload: { name: 'Sucre', sellPrice: 500, hasPromotion: false },
    })
    expect(res.statusCode).toBe(200)
    expect(db.product.create.mock.calls[0][0].data.promotionEnd).toBeNull()
  })

  it('PUT /api/products/:id : promotionEnd transmis à Prisma (liste blanche)', async () => {
    db.product.update.mockResolvedValue({ id: 'p1' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT', url: '/api/products/p1',
      payload: { hasPromotion: true, promotionPrice: 800, promotionEnd: '2026-06-15T00:00:00.000Z' },
    })
    expect(res.statusCode).toBe(200)
    const data = db.product.update.mock.calls[0][0].data
    expect(data.promotionEnd).toBe('2026-06-15T00:00:00.000Z')
  })
})
