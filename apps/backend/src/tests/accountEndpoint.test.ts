import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'

const { mocks } = vi.hoisted(() => ({
  mocks: { findUnique: vi.fn(), compare: vi.fn(), deleteAccount: vi.fn(), tenantFindUnique: vi.fn() },
}))

// `tenant.findUnique` alimente le garde boutique-démo (fail-closed) : sans lui, la
// suppression de compte est refusée en 403 — cf. demoTenant.test.ts.
vi.mock('../db', () => ({ prisma: {
  user:   { findUnique: mocks.findUnique },
  tenant: { findUnique: mocks.tenantFindUnique },
} }))
vi.mock('../redis', () => ({ redis: null }))
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare } }))
vi.mock('../lib/userStatus', () => ({ isUserActive: vi.fn().mockResolvedValue(true) }))
vi.mock('../services/accountDeletion', () => ({
  deleteAccount: mocks.deleteAccount,
  AccountDeletionError: class AccountDeletionError extends Error {
    constructor(public code: string) { super(code) }
  },
}))

import { accountRoutes } from '../routes/account'

async function buildApp() {
  const app = Fastify()
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(rateLimit, { global: false })
  await app.register(accountRoutes)
  await app.ready()
  return app
}
const authHeader = (app: any) => ({
  authorization: `Bearer ${app.jwt.sign({ userId: 'u1', tenantId: 't1', role: 'CASHIER' })}`,
})
const del = (app: any, payload: any) =>
  app.inject({ method: 'DELETE', url: '/api/account/me', headers: authHeader(app), payload })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash' })
  mocks.tenantFindUnique.mockResolvedValue({ isDemo: false }) // boutique cliente par défaut
  mocks.compare.mockResolvedValue(true)
  mocks.deleteAccount.mockResolvedValue({ scope: 'user' })
})

describe('DELETE /api/account/me', () => {
  it('200 { deleted, scope } quand password + confirmation OK', async () => {
    const app = await buildApp()
    const res = await del(app, { password: 'pw', confirmation: 'SUPPRIMER' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ deleted: true, scope: 'user' })
    expect(mocks.deleteAccount).toHaveBeenCalledWith('u1')
    await app.close()
  })

  it('403 DEMO_TENANT_FORBIDDEN sur une boutique de démo (destructif, deleteAccount non appelé)', async () => {
    // admin@ démo est SUPER_ADMIN → deleteAccount supprimerait TOUTE la boutique.
    // Mot de passe et texte de confirmation sont publics : seul le garde serveur protège.
    mocks.tenantFindUnique.mockResolvedValue({ isDemo: true })
    const app = await buildApp()
    const res = await del(app, { password: 'pw', confirmation: 'SUPPRIMER' })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('DEMO_TENANT_FORBIDDEN')
    expect(mocks.deleteAccount).not.toHaveBeenCalled()
    await app.close()
  })

  it('401 si mot de passe incorrect (deleteAccount non appelé)', async () => {
    mocks.compare.mockResolvedValue(false)
    const app = await buildApp()
    const res = await del(app, { password: 'bad', confirmation: 'SUPPRIMER' })
    expect(res.statusCode).toBe(401)
    expect(mocks.deleteAccount).not.toHaveBeenCalled()
    await app.close()
  })

  it('400 si confirmation incorrecte (deleteAccount non appelé)', async () => {
    const app = await buildApp()
    const res = await del(app, { password: 'pw', confirmation: 'oops' })
    expect(res.statusCode).toBe(400)
    expect(mocks.deleteAccount).not.toHaveBeenCalled()
    await app.close()
  })

  it('429 après 3 tentatives / IP', async () => {
    const app = await buildApp()
    const codes: number[] = []
    for (let i = 0; i < 4; i++) {
      const res = await del(app, { password: 'pw', confirmation: 'SUPPRIMER' })
      codes.push(res.statusCode)
    }
    expect(codes.slice(0, 3)).toEqual([200, 200, 200])
    expect(codes[3]).toBe(429)
    await app.close()
  })
})
