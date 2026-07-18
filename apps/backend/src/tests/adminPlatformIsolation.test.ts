import { describe, it, expect, vi, beforeAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'

/**
 * P0 — Isolation du panneau PLATEFORME (/api/admin/*).
 *
 * La faille : `authenticateAdmin` gardait sur le rôle TENANT `SUPER_ADMIN`, or
 * ce rôle est interne à une boutique → tout propriétaire de boutique lisait les
 * données de TOUS les tenants (CA cumulé, MRR, liste des boutiques…).
 *
 * Le correctif gate sur `isPlatformAdmin` (propriété per-user signée serveur).
 * On exerce le VRAI middleware (pas de mock) avec de vrais JWT :
 *  - SUPER_ADMIN de tenant → 403 sur chaque route /api/admin/*
 *  - ancien JWT sans le claim → 403 (fail-closed)
 *  - isPlatformAdmin:true → 200 (contrôle positif : le mock ne renvoie pas 403 partout)
 */

const SECRET = 'test-secret-platform-isolation'

// Prisma mocké : les handlers ne doivent jamais être atteints par un non-admin
// plateforme (le gate coupe avant). Le contrôle positif renvoie des données neutres.
const db = {
  tenant:  { findMany: vi.fn(async () => [{ id: 'A', name: 'Boutique A', _count: { users: 1, products: 2, sales: 3 } }]), count: vi.fn(async () => 3), create: vi.fn(async () => ({ id: 'new' })) },
  user:    { create: vi.fn(async () => ({ id: 'u' })) },
  planRequest: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), update: vi.fn() },
}
// basePrisma : agrégats cross-tenant (Sale/Product/User via relation tenant.isPlatform).
const baseDb = {
  user:    { count: vi.fn(async () => 5) },
  sale:    { aggregate: vi.fn(async () => ({ _sum: { total: 999 }, _count: 3 })), groupBy: vi.fn(async () => [{ tenantId: 'A', _sum: { total: 5000 }, _max: { createdAt: '2026-07-10T00:00:00.000Z' } }]) },
  product: { count: vi.fn(async () => 2) },
}
vi.mock('../db', () => ({ prisma: db, basePrisma: baseDb }))

// Les GET admin exposent ces routes ; on les liste pour la garde 403 systématique.
const ADMIN_GET_ROUTES = ['/api/admin/tenants', '/api/admin/stats', '/api/admin/plan-requests']

let app: FastifyInstance
let tenantSuperAdminToken: string  // SUPER_ADMIN d'un tenant, PAS admin plateforme
let legacyToken: string            // ancien JWT sans le claim isPlatformAdmin
let platformAdminToken: string     // vrai admin plateforme

beforeAll(async () => {
  const { adminRoutes } = await import('../routes/admin')
  app = Fastify()
  await app.register(jwt, { secret: SECRET })
  await app.register(adminRoutes)
  await app.ready()

  tenantSuperAdminToken = app.jwt.sign({ userId: 'uA', role: 'SUPER_ADMIN', tenantId: 'A', activeTenantId: 'A', isPlatformAdmin: false })
  legacyToken           = app.jwt.sign({ userId: 'uA', role: 'SUPER_ADMIN', tenantId: 'A', activeTenantId: 'A' }) // pas de claim
  platformAdminToken    = app.jwt.sign({ userId: 'uP', role: 'CASHIER', tenantId: 'A', activeTenantId: 'A', isPlatformAdmin: true })
})

describe('P0 — /api/admin/* gate sur isPlatformAdmin, jamais sur le rôle tenant', () => {
  it('SUPER_ADMIN de tenant → 403 sur chaque route admin', async () => {
    for (const url of ADMIN_GET_ROUTES) {
      const res = await app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${tenantSuperAdminToken}` } })
      expect(res.statusCode, `${url} doit refuser un SUPER_ADMIN tenant`).toBe(403)
    }
  })

  it('SUPER_ADMIN de tenant → 403 sur les écritures (create tenant, review plan)', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/admin/tenants', headers: { authorization: `Bearer ${tenantSuperAdminToken}` }, payload: { name: 'X' } })
    expect(create.statusCode).toBe(403)
    const review = await app.inject({ method: 'PATCH', url: '/api/admin/plan-requests/abc', headers: { authorization: `Bearer ${tenantSuperAdminToken}` }, payload: { action: 'approve' } })
    expect(review.statusCode).toBe(403)
    expect(db.tenant.create).not.toHaveBeenCalled()
    expect(db.planRequest.update).not.toHaveBeenCalled()
  })

  it('ancien JWT sans le claim isPlatformAdmin → 403 (fail-closed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${legacyToken}` } })
    expect(res.statusCode).toBe(403)
  })

  it('aucun token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats' })
    expect(res.statusCode).toBe(401)
  })

  it('contrôle positif : isPlatformAdmin:true → 200 et données servies', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${platformAdminToken}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ totalTenants: 3, totalUsers: 5 })
  })

  it('/api/admin/tenants (admin plateforme) enrichit chaque boutique de CA + dernière activité', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/tenants', headers: { authorization: `Bearer ${platformAdminToken}` } })
    expect(res.statusCode).toBe(200)
    const rows = res.json()
    expect(rows[0]).toMatchObject({ id: 'A', revenue: 5000, lastActivityAt: '2026-07-10T00:00:00.000Z' })
  })

  it('exclut les tenants INTERNES plateforme (isPlatform) des listings ET des totaux', async () => {
    await app.inject({ method: 'GET', url: '/api/admin/tenants', headers: { authorization: `Bearer ${platformAdminToken}` } })
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isPlatform: false } }))
    await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${platformAdminToken}` } })
    expect(db.tenant.count).toHaveBeenCalledWith({ where: { isPlatform: false } })
    expect(baseDb.user.count).toHaveBeenCalledWith({ where: { tenant: { isPlatform: false } } })
    expect(baseDb.sale.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant: { isPlatform: false } }) }))
  })
})
