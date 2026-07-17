import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

const { db, tx } = vi.hoisted(() => {
  const tx = {
    sale: { create: vi.fn() },
    saleItem: { create: vi.fn() },
    product: { update: vi.fn() },
    customer: { update: vi.fn() },
    loyaltyTransaction: { create: vi.fn() },
  }
  return {
    tx,
    db: {
      sale: { findFirst: vi.fn(), findMany: vi.fn() },
      product: { findMany: vi.fn() },
      tenant: { findUnique: vi.fn() },
      $transaction: (fn: any) => fn(tx),
    },
  }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: 'CASHIER', tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: 'u1' }
    req.tenantId = req.user.tenantId
  },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes } from '../routes/sales'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(saleRoutes)
  await app.ready()
  return app
}
const PRODUCT = { id: 'p1', sellPrice: 2500, hasPromotion: false, promotionPrice: null, priceTiers: null, name: 'P1', stockQty: 10, stockMin: 2 }
const body = (over: any = {}) => ({ items: [{ productId: 'p1', qty: 1, price: 2500 }], paymentMode: 'cash', total: 2500, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  db.product.findMany.mockResolvedValue([PRODUCT])
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false })
  db.sale.findFirst.mockResolvedValue(null)
  tx.sale.create.mockResolvedValue({ id: 's-new' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
})

describe('POST /api/sales — idempotence', () => {
  it('clé déjà vue → renvoie la vente EXISTANTE, sans re-créer ni re-toucher stock', async () => {
    db.sale.findFirst.mockResolvedValue({ id: 's1', tenantId: 'T1', idempotencyKey: 'k1', total: 2500 })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ idempotencyKey: 'k1' }) })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe('s1')                  // vente existante
    // lookup scopé tenant
    expect(db.sale.findFirst).toHaveBeenCalledWith({ where: { tenantId: 'T1', idempotencyKey: 'k1' } })
    // AUCUNE création / décrément stock (court-circuit avant la transaction)
    expect(db.product.findMany).not.toHaveBeenCalled()
    expect(tx.sale.create).not.toHaveBeenCalled()
    expect(tx.product.update).not.toHaveBeenCalled()
  })

  it('clé inconnue → crée la vente + persiste la clé', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ idempotencyKey: 'k2' }) })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe('s-new')
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ idempotencyKey: 'k2', tenantId: 'T1' }),
    }))
  })

  it('clé via header Idempotency-Key (équivalent au body)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', headers: { 'idempotency-key': 'kh' }, payload: body() })
    expect(res.statusCode).toBe(200)
    expect(db.sale.findFirst).toHaveBeenCalledWith({ where: { tenantId: 'T1', idempotencyKey: 'kh' } })
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: 'kh' }) }))
  })

  it('course concurrente (création concurrente → P2002) → renvoie la gagnante, 1 seule vente', async () => {
    db.sale.findFirst
      .mockResolvedValueOnce(null)                    // lookup initial : pas encore là
      .mockResolvedValueOnce({ id: 's-winner', idempotencyKey: 'kc' }) // re-fetch après collision
    tx.sale.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ idempotencyKey: 'kc' }) })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe('s-winner')
    expect(db.sale.findFirst).toHaveBeenCalledTimes(2) // lookup + re-fetch post-collision
  })

  it('sans clé → comportement historique inchangé (crée, idempotencyKey null, pas de lookup)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body() })
    expect(res.statusCode).toBe(200)
    expect(db.sale.findFirst).not.toHaveBeenCalled()  // pas de clé → pas de lookup
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: null }) }))
  })

  it('clés différentes → 2 ventes créées (pas de dédup croisée)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: body({ idempotencyKey: 'a' }) })
    await app.inject({ method: 'POST', url: '/api/sales', payload: body({ idempotencyKey: 'b' }) })
    expect(tx.sale.create).toHaveBeenCalledTimes(2)
  })
})
