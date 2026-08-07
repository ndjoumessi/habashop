import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { db } = vi.hoisted(() => ({
  db: { tenant: { findUnique: vi.fn(), update: vi.fn() }, auditLog: { create: vi.fn() } },   // la route trace les changements de locale
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../services/email', () => ({ sendUserInvitationEmail: vi.fn() }))
// auth mockée : rôle + tenant injectés via headers de test
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
  app.inject({
    method: 'PATCH', url: '/api/tenant',
    headers: { 'x-test-role': role, 'x-test-tenant': 'T1', 'content-type': 'application/json' },
    payload: body,
  })

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.update.mockResolvedValue({ id: 'T1', lang: 'es', currency: 'EUR' })
})

describe('PATCH /api/tenant — lang & devise = ADMIN/SUPER_ADMIN seulement (Option C)', () => {
  for (const role of ['MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR']) {
    it(`${role} → 403 sur { lang } (et aucun update DB)`, async () => {
      const app = await buildApp()
      const res = await patch(app, role, { lang: 'es' })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe('LOCALE_ADMIN_ONLY')
      expect(db.tenant.update).not.toHaveBeenCalled()
    })
    it(`${role} → 403 sur { currency }`, async () => {
      const app = await buildApp()
      const res = await patch(app, role, { currency: 'EUR' })
      expect(res.statusCode).toBe(403)
      expect(db.tenant.update).not.toHaveBeenCalled()
    })
  }

  it('MANAGER → 200 sur un champ NON-locale (ex. name) — non bloqué', async () => {
    const app = await buildApp()
    const res = await patch(app, 'MANAGER', { name: 'Boutique X' })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledTimes(1)
  })

  it('ADMIN → 200 sur { lang, currency } (autorisé)', async () => {
    const app = await buildApp()
    const res = await patch(app, 'ADMIN', { lang: 'es', currency: 'EUR' })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledTimes(1)
  })

  it('SUPER_ADMIN → 200 sur { lang }', async () => {
    const app = await buildApp()
    const res = await patch(app, 'SUPER_ADMIN', { lang: 'it' })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.update).toHaveBeenCalledTimes(1)
  })
})
