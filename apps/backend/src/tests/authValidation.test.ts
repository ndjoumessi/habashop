import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

// Valide la couche zod des routes auth (item 6, lot 3). DB/bcrypt mockés :
// un body invalide est rejeté AVANT toute logique (findUnique/bcrypt).
vi.mock('../db', () => ({ prisma: { user: { findUnique: vi.fn() }, userTenant: { findUnique: vi.fn() } } }))
vi.mock('../lib/userStatus', () => ({ isUserActive: vi.fn().mockResolvedValue(true) }))
vi.mock('../services/email', () => ({ sendWelcomeEmail: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }))

import { authRoutes } from '../routes/auth'

const SECRET = 'test-secret-auth-val'
async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(jwt, { secret: SECRET })
  await app.register(authRoutes)
  await app.ready()
  return app
}
const authFor = (app: any) => ({ Authorization: `Bearer ${app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: null, activeTenantId: null })}` })

describe('auth — validation zod', () => {
  it('login sans password → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.com' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })

  it('register mot de passe < 8 → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: 'a@b.com', password: 'court' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })

  it('switch-tenant sans tenantId → 400 (validation, avant l’accès DB)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/switch-tenant', headers: authFor(app), payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('password change avec newPassword non-string → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/auth/password', headers: authFor(app), payload: { currentPassword: 'x', newPassword: 12345678 } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
  })
})
