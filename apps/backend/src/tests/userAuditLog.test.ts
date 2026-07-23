import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

// ── Mocks ────────────────────────────────────────────────────────────────────
const { mockPrisma, mockCaptureException } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    userAuditLog: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    userTenant: { findMany: vi.fn().mockResolvedValue([]) },
    tenant: { findUnique: vi.fn() },
  },
  mockCaptureException: vi.fn(),
}))
vi.mock('../db', () => ({ prisma: mockPrisma, basePrisma: mockPrisma }))
vi.mock('@sentry/node', () => ({ captureException: mockCaptureException, captureMessage: vi.fn() }))
vi.mock('../services/email', () => ({ sendWelcomeEmail: vi.fn() }))

// Requête authentifiée d'un utilisateur multi-boutiques SANS boutique active —
// l'état exact de admin@/manager@ après login, et la condition du bug d'origine.
interface AuthedRequest { user: Record<string, unknown>; tenantId: string | null }
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: AuthedRequest) => {
    req.user = { userId: 'user-1', role: 'ADMIN', tenantId: null, activeTenantId: null }
    req.tenantId = null
  },
}))

import { authRoutes } from '../routes/auth'
import { accountRoutes } from '../routes/account'

async function build() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(require('@fastify/jwt'), { secret: 'test-secret' })
  await app.register(authRoutes)
  await app.register(accountRoutes)
  return app
}

const USER = {
  id: 'user-1',
  email: 'admin@habashop.com',
  name: 'Admin Démo',
  passwordHash: '$2a$10$hash',
  isActive: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.user.findUnique.mockResolvedValue(USER)
  mockPrisma.user.update.mockResolvedValue(USER)
  mockPrisma.userAuditLog.create.mockResolvedValue({ id: 'ua-1' })
})

describe('Audit d’échelle utilisateur — changement de mot de passe', () => {
  // LE CAS QUI ÉTAIT SILENCIEUSEMENT PERDU : `/api/auth/*` est exempté du garde
  // NO_ACTIVE_TENANT, donc tenantId vaut null ; l'ancienne écriture visait
  // AuditLog.tenantId (String NON nullable + FK) et échouait dans un .catch(() => {}).
  it('écrit dans UserAuditLog pour un utilisateur SANS boutique active', async () => {
    const bcrypt = await import('bcryptjs')
    vi.spyOn(bcrypt.default, 'compare').mockResolvedValue(true as never)
    vi.spyOn(bcrypt.default, 'hash').mockResolvedValue('newhash' as never)

    const app = await build()
    const res = await app.inject({
      method: 'PATCH', url: '/api/auth/password',
      payload: { currentPassword: 'oldpass', newPassword: 'nouveaumdp8' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockPrisma.userAuditLog.create).toHaveBeenCalledTimes(1)
    const data = mockPrisma.userAuditLog.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      userId: 'user-1',
      action: 'PASSWORD_CHANGE',
      userEmailSnapshot: 'admin@habashop.com',
      userNameSnapshot: 'Admin Démo',
    })
    // L'événement n'a PAS de tenantId — et ne va plus dans AuditLog.
    expect(data).not.toHaveProperty('tenantId')
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('un échec d’écriture d’audit est TRACÉ mais le mot de passe change quand même', async () => {
    const bcrypt = await import('bcryptjs')
    vi.spyOn(bcrypt.default, 'compare').mockResolvedValue(true as never)
    vi.spyOn(bcrypt.default, 'hash').mockResolvedValue('newhash' as never)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockPrisma.userAuditLog.create.mockRejectedValue(new Error('DB down'))

    const app = await build()
    const res = await app.inject({
      method: 'PATCH', url: '/api/auth/password',
      payload: { currentPassword: 'oldpass', newPassword: 'nouveaumdp8' },
    })

    // Fail-open : l'action utilisateur réussit…
    expect(res.statusCode).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalled()
    // …mais l'échec n'est PAS silencieux (c'était tout le défaut d'origine).
    expect(errSpy).toHaveBeenCalled()
    expect(errSpy.mock.calls.map(c => c.join(' ')).join('\n')).toContain('USER_PASSWORD_CHANGE')
    expect(mockCaptureException).toHaveBeenCalled()
  })
})

describe('GET /api/account/security-activity', () => {
  it('ne renvoie que les événements du userId courant', async () => {
    mockPrisma.userAuditLog.findMany.mockResolvedValue([{ id: 'ua-1', action: 'PASSWORD_CHANGE' }])
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/account/security-activity' })

    expect(res.statusCode).toBe(200)
    expect(mockPrisma.userAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
  })

  it('une erreur de lecture REMONTE — jamais un journal faussement vide', async () => {
    mockPrisma.userAuditLog.findMany.mockRejectedValue(new Error('DB down'))
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/account/security-activity' })

    expect(res.statusCode).toBe(500)
    expect(res.body).not.toBe('[]')
  })
})
