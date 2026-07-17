import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

// tx mock contrôlable (hoisté pour la factory de vi.mock)
const { db, tx } = vi.hoisted(() => {
  const tx = {
    sale:     { updateMany: vi.fn() },
    product:  { updateMany: vi.fn() },
    customer: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    loyaltyTransaction: { aggregate: vi.fn(), create: vi.fn() },
  }
  return {
    tx,
    db: {
      sale: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
      product: { findMany: vi.fn() },
      $transaction: (fn: any) => fn(tx),
    },
  }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: req.headers['x-test-role'], tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: req.headers['x-test-user'] ?? 'u1' }
    req.tenantId = req.user.tenantId
  },
}))
vi.mock('./notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes, canRefund } from '../routes/sales'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(saleRoutes)
  await app.ready()
  return app
}
const H = (role: string) => ({ 'x-test-role': role, 'x-test-tenant': 'T1' })
const SALE = { id: 's1', tenantId: 'T1', total: 1000, paymentMode: 'cash', status: 'completed', customerId: null, items: [{ productId: 'p1', qty: 3 }, { productId: 'p2', qty: 1 }] }

beforeEach(() => {
  vi.clearAllMocks()
  db.sale.findFirst.mockResolvedValue({ ...SALE })
  tx.sale.updateMany.mockResolvedValue({ count: 1 })
  tx.product.updateMany.mockResolvedValue({ count: 1 })
  tx.customer.updateMany.mockResolvedValue({ count: 1 })
  tx.auditLog.create.mockResolvedValue({ id: 'a1' })
  tx.loyaltyTransaction.aggregate.mockResolvedValue({ _sum: { points: 0 } })
  tx.loyaltyTransaction.create.mockResolvedValue({})
})

describe('canRefund (pur)', () => {
  it('manager/admin/super_admin OK ; caissier & autres KO', () => {
    expect(canRefund('ADMIN')).toBe(true)
    expect(canRefund('SUPER_ADMIN')).toBe(true)
    expect(canRefund('MANAGER')).toBe(true)
    expect(canRefund('CASHIER')).toBe(false)
    expect(canRefund('ACCOUNTANT')).toBe(false)
    expect(canRefund('HR')).toBe(false)
    expect(canRefund(undefined)).toBe(false)
  })
})

describe('POST /api/sales/:id/refund', () => {
  it('MANAGER rembourse OK + restock par défaut (ON) + audit', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('MANAGER'), payload: { reason: 'Client insatisfait' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, id: 's1', status: 'refunded', restocked: true })
    // marque la vente remboursée avec garde d'idempotence (status != refunded)
    expect(tx.sale.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1', tenantId: 'T1', status: { not: 'refunded' } },
      data: expect.objectContaining({ status: 'refunded', refundedBy: 'u1', refundReason: 'Client insatisfait', restocked: true }),
    }))
    // restock des 2 articles
    expect(tx.product.updateMany).toHaveBeenCalledTimes(2)
    expect(tx.product.updateMany).toHaveBeenCalledWith({ where: { id: 'p1', tenantId: 'T1' }, data: { stockQty: { increment: 3 } } })
    // entrée d'audit
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ module: 'sales', action: 'REFUND_SALE', userId: 'u1', tenantId: 'T1' }),
    }))
  })

  it('ADMIN rembourse sans restock (restock:false) → aucun mouvement de stock', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('ADMIN'), payload: { reason: 'Marchandise abîmée', restock: false } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ restocked: false })
    expect(tx.sale.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ restocked: false }) }))
    expect(tx.product.updateMany).not.toHaveBeenCalled()
  })

  it('CASHIER rejeté (403) — anti-fraude', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('CASHIER'), payload: { reason: 'x' } })
    expect(res.statusCode).toBe(403)
    expect(db.sale.findFirst).not.toHaveBeenCalled()
  })

  it('motif manquant/vide → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('MANAGER'), payload: { reason: '   ' } })
    expect(res.statusCode).toBe(400)
    expect(tx.sale.updateMany).not.toHaveBeenCalled()
  })

  it('vente introuvable → 404', async () => {
    db.sale.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/sX/refund', headers: H('MANAGER'), payload: { reason: 'test' } })
    expect(res.statusCode).toBe(404)
  })

  it('déjà remboursée (fast-path) → 409', async () => {
    db.sale.findFirst.mockResolvedValue({ ...SALE, status: 'refunded' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('MANAGER'), payload: { reason: 'test' } })
    expect(res.statusCode).toBe(409)
    expect(tx.sale.updateMany).not.toHaveBeenCalled()
  })

  it('course concurrente (updateMany count=0) → 409', async () => {
    tx.sale.updateMany.mockResolvedValue({ count: 0 })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('MANAGER'), payload: { reason: 'test' } })
    expect(res.statusCode).toBe(409)
    expect(tx.product.updateMany).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })

  it('vente liée à un client → décrémente son revenu (0 point gagné → pas de retrait)', async () => {
    db.sale.findFirst.mockResolvedValue({ ...SALE, customerId: 'c1' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('MANAGER'), payload: { reason: 'retour' } })
    expect(res.statusCode).toBe(200)
    expect(tx.customer.updateMany).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 'T1' }, data: { totalRevenue: { decrement: 1000 } } })
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
  })

  it('remboursement RETIRE les points gagnés sur la vente (LoyaltyTransaction reverse)', async () => {
    db.sale.findFirst.mockResolvedValue({ ...SALE, customerId: 'c1' })
    tx.loyaltyTransaction.aggregate.mockResolvedValue({ _sum: { points: 5 } }) // 5 pts gagnés à l'origine
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: H('MANAGER'), payload: { reason: 'retour' } })
    expect(res.statusCode).toBe(200)
    // somme des 'earn' du saleId, scopée tenant
    expect(tx.loyaltyTransaction.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { saleId: 's1', tenantId: 'T1', type: 'earn' }, _sum: { points: true },
    }))
    // décrément revenu ET points dans le même update
    expect(tx.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', tenantId: 'T1' },
      data: { totalRevenue: { decrement: 1000 }, loyaltyPoints: { decrement: 5 } },
    })
    // ligne d'historique 'reverse' négative
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'c1', saleId: 's1', points: -5, type: 'reverse' }),
    }))
  })
})
