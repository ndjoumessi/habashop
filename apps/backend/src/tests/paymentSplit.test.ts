import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { resolvePaymentSplit } from '../lib/paymentSplit'
import { computeTicketZ } from '../lib/ticketZ'

// ── 1. Helper pur ──
describe('resolvePaymentSplit', () => {
  it('paiement simple → seau unique (autres = 0)', () => {
    expect(resolvePaymentSplit('cash', 5000)).toEqual({ cashAmount: 5000, mobileMoneyAmount: 0, cardAmount: 0 })
    expect(resolvePaymentSplit('card', 5000)).toEqual({ cashAmount: 0, mobileMoneyAmount: 0, cardAmount: 5000 })
    expect(resolvePaymentSplit('wave', 5000)).toEqual({ cashAmount: 0, mobileMoneyAmount: 5000, cardAmount: 0 })
    expect(resolvePaymentSplit('orange', 5000)).toEqual({ cashAmount: 0, mobileMoneyAmount: 5000, cardAmount: 0 })
  })
  it('mixte valide (somme = total) → ventilation', () => {
    expect(resolvePaymentSplit('mixed', 5000, { cashAmount: 3000, mobileMoneyAmount: 2000 }))
      .toEqual({ cashAmount: 3000, mobileMoneyAmount: 2000, cardAmount: 0 })
  })
  it('mixte : tolérance arrondi ±1', () => {
    expect(resolvePaymentSplit('mixed', 5000, { cashAmount: 3000, cardAmount: 2001 }))
      .toMatchObject({ cashAmount: 3000, cardAmount: 2001 })
  })
  it('mixte : somme ≠ total → erreur', () => {
    expect(resolvePaymentSplit('mixed', 5000, { cashAmount: 3000, mobileMoneyAmount: 1000 })).toEqual({ error: 'MIXED_SUM_MISMATCH' })
  })
  it('mixte : un seul mode non nul → erreur (pas vraiment mixte)', () => {
    expect(resolvePaymentSplit('mixed', 5000, { cashAmount: 5000 })).toEqual({ error: 'MIXED_NEEDS_TWO' })
  })
})

// ── 2. Ticket Z COALESCE (split récent vs fallback paymentMode ancien) ──
describe('computeTicketZ — COALESCE split/paymentMode', () => {
  it('ventes récentes (champs split) + anciennes (NULL → fallback paymentMode)', () => {
    const a = computeTicketZ([
      // récente mixte : 3000 espèces + 2000 mobile
      { total: 5000, status: 'completed', paymentMode: 'mixed', customerId: 'c1', cashAmount: 3000, mobileMoneyAmount: 2000, cardAmount: 0 },
      // récente simple carte (champs renseignés)
      { total: 1500, status: 'completed', paymentMode: 'card', customerId: null, cashAmount: 0, mobileMoneyAmount: 0, cardAmount: 1500 },
      // ANCIENNE (champs null) → fallback paymentMode 'cash'
      { total: 1000, status: 'completed', paymentMode: 'cash', customerId: 'c2', cashAmount: null, mobileMoneyAmount: null, cardAmount: null },
    ])
    expect(a.caVentes).toBe(7500)
    expect(a.cashAmount).toBe(4000)        // 3000 (split) + 1000 (fallback)
    expect(a.mobileMoneyAmount).toBe(2000) // split
    expect(a.cardAmount).toBe(1500)        // split
    // le breakdown somme bien au CA
    expect(a.cashAmount + a.mobileMoneyAmount + a.cardAmount).toBe(a.caVentes)
  })
})

// ── 3. Route POST /api/sales — stockage du split ──
const { db, tx } = vi.hoisted(() => {
  const tx = {
    sale: { create: vi.fn() }, saleItem: { create: vi.fn() }, product: { update: vi.fn() },
    customer: { update: vi.fn() }, loyaltyTransaction: { create: vi.fn() },
  }
  return { tx, db: { sale: { findFirst: vi.fn(), findMany: vi.fn() }, product: { findMany: vi.fn() }, tenant: { findUnique: vi.fn() }, $transaction: (fn: any) => fn(tx) } }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'CASHIER', tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: 'u1' }; req.tenantId = req.user.tenantId },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes } from '../routes/sales'
async function buildApp() { const app = Fastify(); await app.register(saleRoutes); await app.ready(); return app }
const PRODUCT = { id: 'p1', sellPrice: 2500, hasPromotion: false, promotionPrice: null, priceTiers: null, name: 'P1', stockQty: 10, stockMin: 2 }
const body = (over: any = {}) => ({ items: [{ productId: 'p1', qty: 2, price: 2500 }], paymentMode: 'cash', total: 5000, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  db.product.findMany.mockResolvedValue([PRODUCT])
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false })
  db.sale.findFirst.mockResolvedValue(null)
  tx.sale.create.mockResolvedValue({ id: 's-new' })
  tx.saleItem.create.mockResolvedValue({}); tx.product.update.mockResolvedValue({})
})

describe('POST /api/sales — paiement mixte', () => {
  it('mixte valide → stocke cashAmount + mobileMoneyAmount (cardAmount 0)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ paymentMode: 'mixed', cashAmount: 3000, mobileMoneyAmount: 2000 }) })
    expect(res.statusCode).toBe(200)
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cashAmount: 3000, mobileMoneyAmount: 2000, cardAmount: 0, paymentMode: 'mixed' }),
    }))
  })

  it('mixte : somme ≠ total → 400 (rien créé)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ paymentMode: 'mixed', cashAmount: 3000, mobileMoneyAmount: 1000 }) })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('MIXED_SUM_MISMATCH')
    expect(tx.sale.create).not.toHaveBeenCalled()
  })

  it('paiement simple (cash) → cashAmount = total, autres 0 (rétro-compat)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: body({ paymentMode: 'cash' }) })
    expect(res.statusCode).toBe(200)
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cashAmount: 5000, mobileMoneyAmount: 0, cardAmount: 0 }),
    }))
  })

  it('isolation tenant (création scopée au tenant du JWT)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', headers: { 'x-test-tenant': 'TENANT_X' }, payload: body() })
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'TENANT_X' }) }))
  })
})
