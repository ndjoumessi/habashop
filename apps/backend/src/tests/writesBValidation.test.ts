import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

// Item 6, lot 4B : expenses (mass-assignment) + validation create employees/goals/subscriptions.
const { db } = vi.hoisted(() => ({
  db: {
    expense:  { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    // ⚠️ Les routes de ce fichier écrivent désormais un audit (`writeAudit`) : sans ce
    // mock, `prisma.auditLog.create` est `undefined` et lève AVANT que le fail-open ne
    // puisse s'appliquer — l'argument de `writeAudit` est évalué à l'appel.
    auditLog: { create: vi.fn() },
    employee: { create: vi.fn() },
    goal:     { create: vi.fn() },
    subscription: { create: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'ADMIN', tenantId: 'MINE', userId: 'u1' }; req.tenantId = 'MINE' },
}))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))

import { expenseRoutes } from '../routes/expenses'
import { employeeRoutes } from '../routes/employees'
import { goalsRoutes } from '../routes/goals'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(expenseRoutes)
  await app.register(employeeRoutes)
  await app.register(goalsRoutes)
  await app.ready()
  return app
}

beforeEach(() => vi.clearAllMocks())

describe('expenses — mass-assignment fermé', () => {
  it('PUT strip un tenantId injecté (jamais transmis à Prisma)', async () => {
    db.expense.update.mockResolvedValue({ id: 'e1' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/expenses/e1', payload: { label: 'Loyer', tenantId: 'VICTIME', id: 'x' } })
    expect(res.statusCode).toBe(200)
    const dataArg = db.expense.update.mock.calls[0][0].data
    expect(dataArg.label).toBe('Loyer')
    expect(dataArg).not.toHaveProperty('tenantId')
    expect(dataArg).not.toHaveProperty('id')
    expect(db.expense.update.mock.calls[0][0].where).toEqual({ id: 'e1', tenantId: 'MINE' })
  })

  it('POST create : label requis → 400 ; tenantId serveur imposé', async () => {
    db.expense.create.mockResolvedValue({ id: 'e2' })
    const app = await buildApp()
    const bad = await app.inject({ method: 'POST', url: '/api/expenses', payload: { amountTTC: 1000 } })
    expect(bad.statusCode).toBe(400)
    expect(JSON.parse(bad.body).code).toBe('VALIDATION')

    await app.inject({ method: 'POST', url: '/api/expenses', payload: { label: 'Achat', tenantId: 'VICTIME' } })
    expect(db.expense.create.mock.calls[0][0].data.tenantId).toBe('MINE')
    expect(db.expense.create.mock.calls[0][0].data).not.toHaveProperty('id')
  })
})

describe('employees / goals — validation create', () => {
  it('employee sans nom → passe la validation zod (nom requis reste au handler → 400)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { role: 'Vendeur' } })
    expect(res.statusCode).toBe(400) // « Nom requis » (handler)
  })

  it('employee salary non-numérique → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Awa', salary: 'beaucoup' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })

  it('goal target non-numérique → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/goals', payload: { label: 'CA', target: 'x' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })
})
