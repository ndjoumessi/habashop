import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { db } = vi.hoisted(() => ({
  db: { tenant: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../services/email', () => ({ sendUserInvitationEmail: vi.fn() }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: req.headers['x-test-role'], tenantId: req.headers['x-test-tenant'], userId: 'u1' }
    req.tenantId = req.headers['x-test-tenant']
  },
}))

import { tenantRoutes } from '../routes/tenant'

async function buildApp() {
  const app = Fastify()
  await app.register(tenantRoutes)
  await app.ready()
  return app
}
const patch = (app: any, role: string, body: any) =>
  app.inject({ method: 'PATCH', url: '/api/tenant', headers: { 'x-test-role': role, 'x-test-tenant': 'T1', 'content-type': 'application/json' }, payload: body })

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ bronzeThreshold: 2000, silverThreshold: 5000 })
  db.tenant.update.mockResolvedValue({ id: 'T1' })
})

describe('PATCH /api/tenant — config fidélité', () => {
  it('ADMIN met à jour les 3 champs (valides) → 200 + update DB', async () => {
    const app = await buildApp()
    const res = await patch(app, 'ADMIN', { pointsPerAmount: 500, bronzeThreshold: 100, silverThreshold: 300 })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'T1' },
      data: expect.objectContaining({ pointsPerAmount: 500, bronzeThreshold: 100, silverThreshold: 300 }),
    }))
  })

  it('SUPER_ADMIN autorisé aussi', async () => {
    const app = await buildApp()
    const res = await patch(app, 'SUPER_ADMIN', { pointsPerAmount: 1000 })
    expect(res.statusCode).toBe(200)
  })

  for (const role of ['MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR']) {
    it(`${role} → 403 (config réservée admin), aucun update`, async () => {
      const app = await buildApp()
      const res = await patch(app, role, { pointsPerAmount: 500 })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe('LOYALTY_ADMIN_ONLY')
      expect(db.tenant.update).not.toHaveBeenCalled()
    })
  }

  it('pointsPerAmount < 1 → 400', async () => {
    const app = await buildApp()
    const res = await patch(app, 'ADMIN', { pointsPerAmount: 0 })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('LOYALTY_INVALID')
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it('valeur non entière → 400', async () => {
    const app = await buildApp()
    const res = await patch(app, 'ADMIN', { bronzeThreshold: 12.5 })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('LOYALTY_INVALID')
  })

  it('bronze ≥ silver → 400 (seuils incohérents)', async () => {
    const app = await buildApp()
    const res = await patch(app, 'ADMIN', { bronzeThreshold: 5000, silverThreshold: 2000 })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('LOYALTY_THRESHOLDS')
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it('update PARTIEL (silver seul) validé contre l’existant (merge bronze courant)', async () => {
    db.tenant.findUnique.mockResolvedValue({ bronzeThreshold: 2000, silverThreshold: 5000 })
    const app = await buildApp()
    // silver=1500 < bronze courant 2000 → incohérent → 400
    const res = await patch(app, 'ADMIN', { silverThreshold: 1500 })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('LOYALTY_THRESHOLDS')
  })
})
