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
    req.user = { role: 'CASHIER', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
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
const body = (over: any = {}) => ({ items: [{ productId: 'p1', qty: 1, price: 2500 }], paymentMode: 'cash', total: 2500, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false })
  db.sale.findFirst.mockResolvedValue(null)
  tx.sale.create.mockResolvedValue({ id: 's-new' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
})

describe('POST /api/sales — garde anti-survente', () => {
  it('stock=0 → 400 INSUFFICIENT_STOCK, vente NON créée ni stock touché', async () => {
    db.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Café soluble', stockQty: 0, sellPrice: 2500, hasPromotion: false, promotionPrice: null, priceTiers: null }])
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ items: [{ productId: 'p1', qty: 1, price: 2500 }] }) })
    expect(res.statusCode).toBe(400)
    const j = res.json()
    expect(j.code).toBe('INSUFFICIENT_STOCK')
    expect(j.error).toContain('Café soluble')
    expect(j.available).toBe(0)
    // Aucune création de vente ni décrément (refus AVANT la transaction)
    expect(tx.sale.create).not.toHaveBeenCalled()
    expect(tx.product.update).not.toHaveBeenCalled()
  })

  it('stock insuffisant (dispo 3 < demandé 5) → 400 INSUFFICIENT_STOCK', async () => {
    db.product.findMany.mockResolvedValue([{ id: 'p1', name: 'P1', stockQty: 3, sellPrice: 2500, hasPromotion: false, promotionPrice: null, priceTiers: null }])
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ items: [{ productId: 'p1', qty: 5, price: 2500 }] }) })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('INSUFFICIENT_STOCK')
    expect(tx.sale.create).not.toHaveBeenCalled()
  })

  it('stock suffisant (dispo 10 ≥ demandé 2) → vente créée, stock décrémenté', async () => {
    db.product.findMany.mockResolvedValue([{ id: 'p1', name: 'P1', stockQty: 10, sellPrice: 2500, hasPromotion: false, promotionPrice: null, priceTiers: null }])
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ items: [{ productId: 'p1', qty: 2, price: 2500 }] }) })
    expect(res.statusCode).toBe(200)
    expect(tx.sale.create).toHaveBeenCalled()
    expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({ data: { stockQty: { decrement: 2 } } }))
  })

  it('produit hors-catalogue (absent du map) → REFUSÉ 400 UNKNOWN_PRODUCT', async () => {
    // Anciennement « toléré » : sans données serveur, la ligne était facturée au prix
    // CHOISI par le client, sans vérification ni trace. Le serveur n'ayant aucun prix
    // auquel comparer, il refuse plutôt que d'encaisser un montant invérifiable.
    db.product.findMany.mockResolvedValue([]) // aucun produit trouvé
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body() })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('UNKNOWN_PRODUCT')
  })
})
