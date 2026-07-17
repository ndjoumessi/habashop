import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

const { db, sendSpy } = vi.hoisted(() => ({
  db: {
    tenant:        { findUnique: vi.fn(), update: vi.fn() },
    employee:      { aggregate: vi.fn() },
    employeeBonus: { aggregate: vi.fn() },
  },
  sendSpy: vi.fn(),
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../services/email', () => ({ sendPayrollSummaryEmail: sendSpy }))
// auth mockée : rôle + tenant de l'appelant injectés via headers de test
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: req.headers['x-test-role'], tenantId: req.headers['x-test-tenant'], userId: 'u1' }
    req.tenantId = req.headers['x-test-tenant']
  },
}))

import { payrollRoutes } from '../routes/payroll'

const tenantRec = (over: Record<string, any> = {}) => ({
  id: 'T1', name: 'Boutique Dakar', lang: 'fr', currency: 'XOF', notifEmailPayroll: true,
  users: [{ email: 'admin@t1.com', name: 'Admin', role: 'ADMIN' }],
  ...over,
})

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(payrollRoutes)
  await app.ready()
  return app
}

const inject = (app: any, o: { role: string; tenant?: string; payload?: any }) =>
  app.inject({
    method: 'POST', url: '/api/admin/payroll-report/run',
    headers: { 'x-test-role': o.role, 'x-test-tenant': o.tenant ?? 'T1', 'content-type': 'application/json' },
    payload: o.payload ?? {},
  })

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.update.mockResolvedValue({})
  sendSpy.mockResolvedValue(true)
  db.employee.aggregate.mockResolvedValue({ _sum: { salary: 500000 }, _count: { id: 3 } })
  db.employeeBonus.aggregate.mockResolvedValue({ _sum: { amount: 20000 } })
  db.tenant.findUnique.mockResolvedValue(tenantRec())
})

describe('POST /api/admin/payroll-report/run', () => {
  it('non-admin → 403, aucun email', async () => {
    const app = await buildApp()
    const res = await inject(app, { role: 'CASHIER' })
    expect(res.statusCode).toBe(403)
    expect(sendSpy).not.toHaveBeenCalled()
    await app.close()
  })

  it('admin dryRun (défaut) → renvoie le récap, 0 email, marqueur NON posé', async () => {
    const app = await buildApp()
    const res = await inject(app, { role: 'ADMIN', payload: {} })
    expect(res.statusCode).toBe(200)
    const j = res.json()
    expect(j.dryRun).toBe(true)
    expect(j.emailSent).toBe(false)
    expect(j.markerSet).toBe(false)
    expect(j.recipient).toBe('admin@t1.com')
    expect(j.report).toMatchObject({ headcount: 3, payroll: 500000, bonuses: 20000, currency: 'XOF', lang: 'fr', hasData: true })
    expect(sendSpy).not.toHaveBeenCalled()
    expect(db.tenant.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('admin dryRun=false → 1 email au bon admin (langue/devise), marqueur posé', async () => {
    const app = await buildApp()
    const res = await inject(app, { role: 'ADMIN', payload: { dryRun: false } })
    expect(res.statusCode).toBe(200)
    const j = res.json()
    expect(j.emailSent).toBe(true)
    expect(j.markerSet).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@t1.com', lang: 'fr', currency: 'XOF' }))
    expect(db.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lastPayrollReportMonth: expect.any(String) } }))
    await app.close()
  })

  it('email fourni par le client IGNORÉ — destinataire = admin serveur', async () => {
    const app = await buildApp()
    const res = await inject(app, { role: 'ADMIN', payload: { dryRun: false, email: 'attacker@evil.com', to: 'attacker@evil.com' } })
    const j = res.json()
    expect(j.recipient).toBe('admin@t1.com')
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@t1.com' }))
    expect(sendSpy).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'attacker@evil.com' }))
    await app.close()
  })

  it('ADMIN ne peut pas cibler un autre tenant → 403', async () => {
    const app = await buildApp()
    const res = await inject(app, { role: 'ADMIN', tenant: 'T1', payload: { tenantId: 'OTHER' } })
    expect(res.statusCode).toBe(403)
    expect(sendSpy).not.toHaveBeenCalled()
    await app.close()
  })

  it('toggle OFF + dryRun=false sans force → pas d’envoi (reason toggle_off)', async () => {
    db.tenant.findUnique.mockResolvedValue(tenantRec({ notifEmailPayroll: false }))
    const app = await buildApp()
    const res = await inject(app, { role: 'ADMIN', payload: { dryRun: false } })
    const j = res.json()
    expect(j.emailSent).toBe(false)
    expect(j.reason).toBe('toggle_off')
    expect(sendSpy).not.toHaveBeenCalled()
    await app.close()
  })
})
