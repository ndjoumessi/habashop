import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { db, tx } = vi.hoisted(() => {
  const tx = { customer: { update: vi.fn() }, loyaltyTransaction: { create: vi.fn() } }
  return {
    tx,
    db: {
      customer: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      tenant: { findUnique: vi.fn() },
      loyaltyTransaction: { findMany: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: (fn: any) => fn(tx),
    },
  }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: 'ADMIN', tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: 'u1' }
    req.tenantId = req.user.tenantId
  },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))

import { customerRoutes } from '../routes/customers'

async function buildApp() {
  const app = Fastify()
  await app.register(customerRoutes)
  await app.ready()
  return app
}
const H = (tenant = 'T1') => ({ 'x-test-tenant': tenant })

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ pointsPerAmount: 1000, bronzeThreshold: 2000, silverThreshold: 5000 })
  db.loyaltyTransaction.findMany.mockResolvedValue([
    { id: 'lt1', points: 2, type: 'earn', reason: 'sale', saleId: 's1', createdAt: new Date(0) },
  ])
  tx.customer.update.mockResolvedValue({ loyaltyPoints: 150 })
  tx.loyaltyTransaction.create.mockResolvedValue({})
})

describe('GET /api/customers/:id/loyalty', () => {
  it('scope tenant strict (findFirst id+tenantId) + tier + history persistée', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'c1', tenantId: 'T1', loyaltyPoints: 2300 })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1/loyalty', headers: H('T1') })
    expect(res.statusCode).toBe(200)
    expect(db.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 'T1' } })
    const body = res.json()
    expect(body.points).toBe(2300)
    expect(body.tier).toBe('Silver')          // 2300 → Silver
    expect(body.history).toHaveLength(1)       // plus de [] codé en dur
    expect(db.loyaltyTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'c1', tenantId: 'T1' },
    }))
    // seuils du tenant renvoyés pour l'affichage front
    expect(body).toMatchObject({ pointsPerAmount: 1000, bronzeThreshold: 2000, silverThreshold: 5000 })
  })

  it('seuils CUSTOM du tenant → tier recalculé (isolation config)', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'c1', tenantId: 'T1', loyaltyPoints: 150 })
    db.tenant.findUnique.mockResolvedValue({ pointsPerAmount: 500, bronzeThreshold: 100, silverThreshold: 300 })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1/loyalty', headers: H('T1') })
    const body = res.json()
    expect(body.tier).toBe('Silver')   // 150 ≥ bronze 100 et < silver 300 → Silver (défauts auraient donné Bronze)
    expect(body).toMatchObject({ pointsPerAmount: 500, bronzeThreshold: 100, silverThreshold: 300 })
  })

  it('client d’un AUTRE tenant → 404 (isolation)', async () => {
    db.customer.findFirst.mockResolvedValue(null) // findFirst id+tenantId ne matche pas
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1/loyalty', headers: H('T2') })
    expect(res.statusCode).toBe(404)
    expect(db.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 'T2' } })
  })
})

describe('POST /api/customers/:id/loyalty (ajustement manuel)', () => {
  it('scope tenant + mute le solde + trace LoyaltyTransaction', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'c1', tenantId: 'T1', loyaltyPoints: 100 })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/customers/c1/loyalty', headers: H('T1'), payload: { points: 50, reason: 'gift' } })
    expect(res.statusCode).toBe(200)
    expect(db.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', tenantId: 'T1' } })
    expect(tx.customer.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { loyaltyPoints: { increment: 50 } } })
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'T1', customerId: 'c1', points: 50, type: 'earn', reason: 'gift' }),
    }))
  })

  it('points=0 → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/customers/c1/loyalty', headers: H('T1'), payload: { points: 0 } })
    expect(res.statusCode).toBe(400)
  })

  it('autre tenant → 404 (isolation)', async () => {
    db.customer.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/customers/c1/loyalty', headers: H('T2'), payload: { points: 50 } })
    expect(res.statusCode).toBe(404)
  })
})
