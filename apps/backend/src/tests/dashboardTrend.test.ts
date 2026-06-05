import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { computeTrend } from '../routes/analytics'

// ── 1. Helper pur ──
describe('computeTrend', () => {
  it('calcule l’évolution % (1 décimale)', () => {
    expect(computeTrend(1200, 1000)).toBe(20)
    expect(computeTrend(5000, 4000)).toBe(25)
    expect(computeTrend(900, 1000)).toBe(-10)
    expect(computeTrend(1333, 1000)).toBe(33.3)   // arrondi 1 décimale
  })
  it('null si pas d’historique (prev ≤ 0)', () => {
    expect(computeTrend(500, 0)).toBeNull()
    expect(computeTrend(500, -10)).toBeNull()
    expect(computeTrend(0, 0)).toBeNull()
  })
})

// ── 2. Route /api/dashboard/stats ──
const { db } = vi.hoisted(() => ({
  db: {
    sale: { aggregate: vi.fn(), findMany: vi.fn() },
    product: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), fields: { stockMin: {} } },
    employee: { count: vi.fn() },
    purchaseOrder: { count: vi.fn() },
    saleItem: { groupBy: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../lib/cache', () => ({ getCached: (_k: string, _t: number, fn: any) => fn() }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { tenantId: req.headers['x-test-tenant'] ?? 'T1' }; req.tenantId = req.user.tenantId },
}))

import { analyticsRoutes } from '../routes/analytics'

async function buildApp() {
  const app = Fastify()
  await app.register(analyticsRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  db.product.count.mockResolvedValue(50)
  db.employee.count.mockResolvedValue(5)
  db.purchaseOrder.count.mockResolvedValue(2)
  db.product.findMany.mockResolvedValue([])
  db.saleItem.groupBy.mockResolvedValue([])
  db.saleItem.findMany.mockResolvedValue([])
  db.sale.findMany.mockResolvedValue([])
})

describe('GET /api/dashboard/stats — tendances réelles', () => {
  it('renvoie salesTodayTrend / salesMonthTrend calculés vs période précédente', async () => {
    db.sale.aggregate
      .mockResolvedValueOnce({ _sum: { total: 1200 }, _count: 3 })  // today
      .mockResolvedValueOnce({ _sum: { total: 5000 }, _count: 10 }) // month
      .mockResolvedValueOnce({ _sum: { total: 1000 } })            // prev day
      .mockResolvedValueOnce({ _sum: { total: 4000 } })            // prev month
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats', headers: { 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(200)
    const b = res.json()
    expect(b.salesTodayTrend).toBe(20)   // (1200-1000)/1000
    expect(b.salesMonthTrend).toBe(25)   // (5000-4000)/4000
  })

  it('trend null si pas d’historique (prev = 0)', async () => {
    db.sale.aggregate
      .mockResolvedValueOnce({ _sum: { total: 1200 }, _count: 3 })
      .mockResolvedValueOnce({ _sum: { total: 5000 }, _count: 10 })
      .mockResolvedValueOnce({ _sum: { total: 0 } })   // pas de vente hier
      .mockResolvedValueOnce({ _sum: { total: null } }) // pas de mois précédent
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats', headers: { 'x-test-tenant': 'T1' } })
    const b = res.json()
    expect(b.salesTodayTrend).toBeNull()
    expect(b.salesMonthTrend).toBeNull()
  })

  it('isolation tenant : les agrégats période précédente sont scopés au tenant', async () => {
    db.sale.aggregate
      .mockResolvedValueOnce({ _sum: { total: 1 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { total: 1 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { total: 1 } })
      .mockResolvedValueOnce({ _sum: { total: 1 } })
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/dashboard/stats', headers: { 'x-test-tenant': 'TENANT_X' } })
    // les 4 agrégats sale doivent tous porter tenantId: 'TENANT_X'
    for (const call of db.sale.aggregate.mock.calls) {
      expect(call[0].where).toMatchObject({ tenantId: 'TENANT_X', status: { not: 'refunded' } })
    }
  })
})
