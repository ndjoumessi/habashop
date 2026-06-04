import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { pointsForAmount, tierForPoints } from '../lib/loyalty'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Helpers purs (règle + paliers)
// ─────────────────────────────────────────────────────────────────────────────
describe('loyalty — règle de gain (floor 1pt/1000)', () => {
  it('floor(montant/1000)', () => {
    expect(pointsForAmount(999)).toBe(0)
    expect(pointsForAmount(1000)).toBe(1)
    expect(pointsForAmount(2500)).toBe(2)   // 2,5 → floor 2
    expect(pointsForAmount(5000)).toBe(5)
  })
  it('montants invalides/négatifs → 0', () => {
    expect(pointsForAmount(0)).toBe(0)
    expect(pointsForAmount(-100)).toBe(0)
    expect(pointsForAmount(NaN)).toBe(0)
  })
})
describe('loyalty — paliers (2000/5000)', () => {
  it('Bronze <2000, Silver 2000–4999, Gold ≥5000', () => {
    expect(tierForPoints(0)).toBe('Bronze')
    expect(tierForPoints(1999)).toBe('Bronze')
    expect(tierForPoints(2000)).toBe('Silver')
    expect(tierForPoints(4999)).toBe('Silver')
    expect(tierForPoints(5000)).toBe('Gold')
    expect(tierForPoints(99999)).toBe('Gold')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Créditage à la vente (POST /api/sales)
// ─────────────────────────────────────────────────────────────────────────────
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
      sale: { findMany: vi.fn() },
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
  await app.register(saleRoutes)
  await app.ready()
  return app
}
const PRODUCT = { id: 'p1', sellPrice: 2500, hasPromotion: false, promotionPrice: null, priceTiers: null, name: 'P1', stockQty: 10, stockMin: 2 }
const saleBody = (over: any = {}) => ({ items: [{ productId: 'p1', qty: 1, price: 2500 }], paymentMode: 'cash', total: 2500, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  db.product.findMany.mockResolvedValue([PRODUCT])
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: true })
  tx.sale.create.mockResolvedValue({ id: 's1' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
  tx.customer.update.mockResolvedValue({})
  tx.loyaltyTransaction.create.mockResolvedValue({})
})

describe('POST /api/sales — créditage fidélité', () => {
  it('client lié + loyalty ON → floor(total/1000) crédité + LoyaltyTransaction earn', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1' }) })
    expect(res.statusCode).toBe(200)
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c1' },
      data: expect.objectContaining({ totalRevenue: { increment: 2500 }, loyaltyPoints: { increment: 2 } }),
    }))
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'T1', customerId: 'c1', saleId: 's1', points: 2, type: 'earn' }),
    }))
  })

  it('après remise : crédite sur le total PAYÉ (floor)', async () => {
    const app = await buildApp()
    // total payé = 3990 → floor(3990/1000) = 3 points
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1', total: 3990, items: [{ productId: 'p1', qty: 2, price: 2500 }] }) })
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ points: 3 }) }))
  })

  it('loyalty OFF → aucun point, aucune LoyaltyTransaction', async () => {
    db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false })
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1' }) })
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({ data: { totalRevenue: { increment: 2500 } } }))
  })

  it('pas de client lié → aucun créditage', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody() })
    expect(tx.customer.update).not.toHaveBeenCalled()
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
  })

  it('total < 1000 → 0 point, pas de ligne fidélité (mais revenu crédité)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1', total: 800, items: [{ productId: 'p1', qty: 1, price: 800 }] }) })
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({ data: { totalRevenue: { increment: 800 } } }))
  })
})
