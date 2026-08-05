import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

const { db } = vi.hoisted(() => ({
  db: {
    customer: { findMany: vi.fn(), findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
    // `purchasesPerMonth` (#215) : recherche ET détail agrègent les ventes rattachées.
    sale: { groupBy: vi.fn().mockResolvedValue([]) },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: 'CASHIER', tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: 'u1' }
    req.tenantId = req.user.tenantId
  },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))

import { customerRoutes } from '../routes/customers'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(customerRoutes)
  await app.ready()
  return app
}
const H = (tenant = 'T1') => ({ 'x-test-tenant': tenant })

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ bronzeThreshold: 2000, silverThreshold: 5000 })
})

describe('GET /api/customers?search', () => {
  it('search ≥2 chars : filtre nom/téléphone, limite 8, enrichit du palier', async () => {
    db.customer.findMany.mockResolvedValue([
      { id: 'c1', tenantId: 'T1', name: 'Awa Diop', phone: '+221770000001', loyaltyPoints: 1200 },
      { id: 'c2', tenantId: 'T1', name: 'Awa Faye', phone: '+221770000002', loyaltyPoints: 5200 },
    ])
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers?search=Awa', headers: H('T1') })
    expect(res.statusCode).toBe(200)

    const args = db.customer.findMany.mock.calls[0][0]
    expect(args.where.tenantId).toBe('T1')
    expect(args.where.deletedAt).toBe(null)
    expect(args.take).toBe(8)
    expect(args.where.OR).toEqual([
      { name:  { contains: 'Awa', mode: 'insensitive' } },
      { phone: { contains: 'Awa', mode: 'insensitive' } },
    ])

    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body[0].tier).toBe('Bronze') // 1200 < 2000
    expect(body[1].tier).toBe('Gold')   // 5200 ≥ 5000
  })

  it('search <2 chars : fallback liste complète (pas de filtre OR/take)', async () => {
    db.customer.findMany.mockResolvedValue([])
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers?search=A', headers: H('T1') })
    expect(res.statusCode).toBe(200)
    const args = db.customer.findMany.mock.calls[0][0]
    expect(args.where.OR).toBeUndefined()
    expect(args.take).toBeUndefined()
  })
})

describe('GET /api/customers/:id', () => {
  it('scope tenant strict (findFirst id+tenantId+deletedAt null)', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'c9', tenantId: 'T1', name: 'Client QR' })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c9', headers: H('T1') })
    expect(res.statusCode).toBe(200)
    expect(db.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'c9', tenantId: 'T1', deletedAt: null } })
    expect(res.json().name).toBe('Client QR')
  })

  it('404 si le client n’existe pas (ou autre tenant)', async () => {
    db.customer.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/nope', headers: H('T1') })
    expect(res.statusCode).toBe(404)
  })
})
