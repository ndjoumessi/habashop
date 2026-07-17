import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { validatorCompiler } from 'fastify-type-provider-zod'

// ─── Mocks ───────────────────────────────────────────────────────────────────
const { db } = vi.hoisted(() => ({
  db: {
    user:       { findUnique: vi.fn() },
    userTenant: { findMany: vi.fn(), findUnique: vi.fn() },
    tenant:     { findUnique: vi.fn(), findFirst: vi.fn() },
    sale:       { aggregate: vi.fn() },
    product:    { count: vi.fn(), fields: { stockMin: {} } },
  },
}))
// `basePrisma` = même mock (le dashboard consolidé l'utilise pour l'agrégat cross-tenant).
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../lib/userStatus', () => ({ isUserActive: vi.fn().mockResolvedValue(true) }))
vi.mock('../lib/cache', () => ({ getCached: (_k: string, _t: number, fn: any) => fn() }))
vi.mock('../services/email', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn().mockResolvedValue('hashed') } }))

import { authRoutes } from '../routes/auth'
import { analyticsRoutes } from '../routes/analytics'

const SECRET = 'test-secret-multi-tenant'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(jwt, { secret: SECRET })
  await app.register(authRoutes)
  await app.register(analyticsRoutes)
  await app.ready()
  return app
}

const USER = { id: 'u1', name: 'Awa', email: 'awa@shop.com', passwordHash: 'h', isActive: true, tenantId: 't1', role: 'ADMIN' }
const T1 = { id: 't1', name: 'Boutique A', currency: 'XOF', plan: 'starter', logo: null, address: null }
const T2 = { id: 't2', name: 'Boutique B', currency: 'EUR', plan: 'pro', logo: null, address: null }

beforeEach(() => {
  vi.clearAllMocks()
  db.user.findUnique.mockResolvedValue(USER)
})

// ─── Login ───────────────────────────────────────────────────────────────────
describe('POST /api/auth/login — multi-boutiques', () => {
  it('1 boutique → activeTenantId renseigné dans le JWT', async () => {
    db.userTenant.findMany.mockResolvedValue([{ role: 'ADMIN', tenant: T1 }])
    db.tenant.findUnique.mockResolvedValue({ ...T1 })
    const app = await buildApp()

    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'awa@shop.com', password: 'x' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.activeTenantId).toBe('t1')
    expect(body.tenants).toHaveLength(1)
    const decoded = app.jwt.decode(body.token) as any
    expect(decoded.activeTenantId).toBe('t1')
    expect(decoded.tenantId).toBe('t1')
  })

  it('2 boutiques → activeTenantId null + tenants[]', async () => {
    db.userTenant.findMany.mockResolvedValue([{ role: 'ADMIN', tenant: T1 }, { role: 'MANAGER', tenant: T2 }])
    const app = await buildApp()

    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'awa@shop.com', password: 'x' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.activeTenantId).toBeNull()
    expect(body.tenant).toBeNull()
    expect(body.tenants).toHaveLength(2)
    expect(body.tenants[1]).toMatchObject({ id: 't2', currency: 'EUR', role: 'MANAGER' })
    const decoded = app.jwt.decode(body.token) as any
    expect(decoded.activeTenantId).toBeNull()
  })
})

// ─── switch-tenant ─────────────────────────────────────────────────────────────
describe('POST /api/auth/switch-tenant', () => {
  const tokenNoTenant = () =>
    // jeton multi-boutiques sans boutique active
    ({ Authorization: `Bearer ${signNoTenant()}` })
  let appRef: any
  function signNoTenant() { return appRef.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: null, activeTenantId: null }) }

  beforeEach(async () => { appRef = await buildApp() })

  it('boutique non autorisée → 403', async () => {
    db.userTenant.findUnique.mockResolvedValue(null)
    const res = await appRef.inject({ method: 'POST', url: '/api/auth/switch-tenant', headers: tokenNoTenant(), payload: { tenantId: 't2' } })
    expect(res.statusCode).toBe(403)
  })

  it('boutique autorisée → nouveau JWT valide avec activeTenantId', async () => {
    db.userTenant.findUnique.mockResolvedValue({ role: 'MANAGER', tenant: { ...T2, deletedAt: null } })
    db.tenant.findUnique.mockResolvedValue({ ...T2 })
    const res = await appRef.inject({ method: 'POST', url: '/api/auth/switch-tenant', headers: tokenNoTenant(), payload: { tenantId: 't2' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.activeTenantId).toBe('t2')
    expect(body.role).toBe('MANAGER')
    const decoded = appRef.jwt.decode(body.token) as any
    expect(decoded.activeTenantId).toBe('t2')
    expect(decoded.role).toBe('MANAGER')
  })

  it('boutique supprimée → 403', async () => {
    db.userTenant.findUnique.mockResolvedValue({ role: 'ADMIN', tenant: { ...T2, deletedAt: new Date() } })
    const res = await appRef.inject({ method: 'POST', url: '/api/auth/switch-tenant', headers: tokenNoTenant(), payload: { tenantId: 't2' } })
    expect(res.statusCode).toBe(403)
  })

  it('tenantId manquant → 400', async () => {
    const res = await appRef.inject({ method: 'POST', url: '/api/auth/switch-tenant', headers: tokenNoTenant(), payload: {} })
    expect(res.statusCode).toBe(400)
  })
})

// ─── GET /api/auth/tenants ───────────────────────────────────────────────────
describe('GET /api/auth/tenants', () => {
  it('retourne les boutiques accessibles', async () => {
    db.userTenant.findMany.mockResolvedValue([{ role: 'ADMIN', tenant: T1 }, { role: 'MANAGER', tenant: T2 }])
    const app = await buildApp()
    const token = app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: 't1', activeTenantId: 't1' })
    const res = await app.inject({ method: 'GET', url: '/api/auth/tenants', headers: { Authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
  })
})

// ─── Dashboard consolidé ───────────────────────────────────────────────────────
describe('GET /api/dashboard/consolidated', () => {
  it('totaux corrects sur toutes les boutiques (CA XOF)', async () => {
    db.userTenant.findMany.mockResolvedValue([
      { tenant: { id: 't1', name: 'A', currency: 'XOF' } },
      { tenant: { id: 't2', name: 'B', currency: 'EUR' } },
    ])
    db.sale.aggregate
      .mockResolvedValueOnce({ _sum: { total: 30000 }, _count: 5 })
      .mockResolvedValueOnce({ _sum: { total: 12000 }, _count: 3 })
    db.product.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0)

    const app = await buildApp()
    const token = app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: null, activeTenantId: null })
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/consolidated', headers: { Authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tenants).toHaveLength(2)
    expect(body.totalCaToday).toBe(42000)
    expect(body.totalTransactions).toBe(8)
    expect(body.tenants[0]).toMatchObject({ id: 't1', caToday: 30000, transactionsToday: 5, stockAlerts: 2 })
  })

  // Exigence C (item 8) : `basePrisma` ≠ « aucun filtre ». Le consolidé doit rester
  // borné aux boutiques UserTenant de l'utilisateur AUTHENTIFIÉ, même sans extension.
  it('exigence C — n\'agrège QUE les boutiques liées à l\'utilisateur (dérivées de UserTenant.userId)', async () => {
    db.userTenant.findMany.mockResolvedValue([{ tenant: { id: 't1', name: 'A', currency: 'XOF' } }])
    db.sale.aggregate.mockResolvedValue({ _sum: { total: 1000 }, _count: 1 })
    db.product.count.mockResolvedValue(0)

    const app = await buildApp()
    const token = app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: null, activeTenantId: null })
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/consolidated', headers: { Authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)

    // La liste des boutiques est dérivée de UserTenant filtré par l'userId du JWT…
    expect(db.userTenant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'u1' }),
    }))
    // …et CHAQUE agrégat basePrisma est explicitement scopé à un tenant de cette liste.
    expect(db.sale.aggregate).toHaveBeenCalledTimes(1)
    expect(db.sale.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 't1' }),
    }))
    expect(db.product.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 't1' }),
    }))
    expect(res.json().tenants.map((t: any) => t.id)).toEqual(['t1'])
  })

  it('accessible sans boutique active (pas de 400)', async () => {
    db.userTenant.findMany.mockResolvedValue([])
    const app = await buildApp()
    const token = app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: null, activeTenantId: null })
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/consolidated', headers: { Authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().totalCaToday).toBe(0)
  })
})
