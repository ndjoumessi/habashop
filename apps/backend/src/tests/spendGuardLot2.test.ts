import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * Lot 2 de la revue : évasion par création de boutique (#5), jumelle DELETE non gardée
 * (#6), rôle ACCOUNTANT sur l'IA (#10) et rafale PAR TENANT et non par IP (#9).
 */

const { db, redisMock, authMock, state } = vi.hoisted(() => {
  const state = { role: 'ADMIN', tenantId: 'T' }
  return {
    state,
    db: {
      tenant:     { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
      user:       { findFirst: vi.fn(), count: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
      userTenant: { create: vi.fn(), findUnique: vi.fn() },
      auditLog:   { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (fn: any) => fn({
        tenant: { create: vi.fn(async ({ data }: any) => ({ id: 'NEW', ...data })) },
        userTenant: { create: vi.fn(async () => ({})) },
      })),
    },
    redisMock: {
      get:    vi.fn(async (_k: string) => null as string | null),
      setex:  vi.fn(async (_k: string, _t: number, _v: string) => 'OK'),
      del:    vi.fn(async (..._k: string[]) => 1),
      incrby: vi.fn(async (_k: string, _by: number) => 1),
      decrby: vi.fn(async (_k: string, _by: number) => 0),
      expire: vi.fn(async (_k: string, _t: number) => 1),
    },
    authMock: vi.fn(async (req: any) => {
      req.user = { userId: 'u1', role: state.role, tenantId: state.tenantId }
      req.tenantId = state.tenantId
    }),
  }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../middleware/authenticate', () => ({ authenticate: authMock }))
vi.mock('../middleware/superAdmin', () => ({ authenticateAdmin: vi.fn() }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('../services/email', () => ({ sendUserInvitationEmail: vi.fn(async () => {}) }))

import { tenantRoutes } from '../routes/tenant'
import { AI_ROLES } from '../routes/ai'
import { authorizeSpend, BURST_EXCEEDED, invalidateTenantSpendInfo, resolveTenantSpendInfo } from '../lib/spend/spendGuard'

const DAY = 24 * 3600 * 1000

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body: string, done) =>
    done(null, body ? JSON.parse(body) : {}))
  await app.register(tenantRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  state.role = 'ADMIN'
  state.tenantId = 'T'
  redisMock.get.mockResolvedValue(null)
  redisMock.incrby.mockResolvedValue(1)
  db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'active', trialEnds: null, plan: 'starter' })
  delete process.env.COST_BURST_PER_MIN
})

// ── #5 ────────────────────────────────────────────────────────────────────────
describe('#5 — la boutique créée n’ouvre pas un plafond neuf', () => {
  it('un créateur à l’essai produit une boutique À L’ESSAI, même échéance', async () => {
    const trialEnds = new Date(Date.now() + 3 * DAY)
    db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'trial', trialEnds, plan: 'starter' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/tenants', payload: { name: 'Deuxième' } })

    expect(res.statusCode).toBe(201)
    expect(res.json().tenant).toMatchObject({ status: 'trial' })
    expect(new Date(res.json().tenant.trialEnds).getTime()).toBe(trialEnds.getTime())
  })

  it('un essai EXPIRÉ ne se remet pas à neuf (l’échéance échue est héritée)', async () => {
    const expired = new Date(Date.now() - DAY)
    db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'trial', trialEnds: expired, plan: 'starter' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/tenants', payload: { name: 'Évasion' } })

    const t = res.json().tenant
    expect(t.status).toBe('trial')
    expect(new Date(t.trialEnds).getTime()).toBe(expired.getTime()) // toujours expiré
  })

  it('un créateur PAYANT produit bien une boutique active sans échéance', async () => {
    db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'active', trialEnds: null, plan: 'business' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/tenants', payload: { name: 'Succursale' } })
    expect(res.json().tenant).toMatchObject({ status: 'active', trialEnds: null, plan: 'business' })
  })
})

// ── #6 ────────────────────────────────────────────────────────────────────────
describe('#6 — suppression d’utilisateur gardée sur une boutique de démo', () => {
  it('DELETE /api/tenant/users/:id → 403 sur une démo, aucune mutation', async () => {
    db.tenant.findUnique.mockResolvedValue({ isDemo: true, status: 'active', trialEnds: null })
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/tenant/users/u2' })

    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('DEMO_TENANT_FORBIDDEN')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('boutique cliente → le garde laisse passer (404 : utilisateur inexistant)', async () => {
    db.user.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/tenant/users/u2' })
    expect(res.statusCode).toBe(404)
  })
})

// ── #10 ───────────────────────────────────────────────────────────────────────
describe('#10 — ACCOUNTANT garde l’accès à Prévisions', () => {
  it('ACCOUNTANT fait partie des rôles autorisés sur l’IA', () => {
    expect(AI_ROLES).toContain('ACCOUNTANT')
  })

  it('CASHIER et HR restent exclus (aucun écran IA pour eux)', () => {
    expect(AI_ROLES).not.toContain('CASHIER')
    expect(AI_ROLES).not.toContain('HR')
  })
})

// ── #9 ────────────────────────────────────────────────────────────────────────
describe('#9 — rafale par TENANT, jamais par IP', () => {
  it('la clé de rafale porte le tenant (deux boutiques ne se gênent pas)', async () => {
    await authorizeSpend('boutique-A', 'whatsapp', 1)
    await authorizeSpend('boutique-B', 'whatsapp', 1)
    const keys = redisMock.incrby.mock.calls.map(c => String(c[0])).filter(k => k.startsWith('burst:'))
    expect(keys.some(k => k.includes('boutique-A'))).toBe(true)
    expect(keys.some(k => k.includes('boutique-B'))).toBe(true)
  })

  it('la rafale compte des OPÉRATIONS : une campagne de 250 passe en une fois', async () => {
    // Compter les unités ici bloquerait tout envoi groupé au-delà du plafond minute.
    redisMock.incrby.mockImplementation(async (key: string, by: number) =>
      String(key).startsWith('burst:') ? 1 : by)
    const d = await authorizeSpend('T', 'whatsapp', 250) // < plafond payant 300/j
    const burstCall = redisMock.incrby.mock.calls.find(c => String(c[0]).startsWith('burst:'))
    expect(burstCall?.[1]).toBe(1)  // 1 opération…
    const quotaCall = redisMock.incrby.mock.calls.find(c => String(c[0]).startsWith('quota:'))
    expect(quotaCall?.[1]).toBe(250) // …mais 250 messages au quota
    expect(d.ok).toBe(true)
  })

  it('au-delà du plafond minute → BURST_EXCEEDED, et la réservation est rendue', async () => {
    process.env.COST_BURST_PER_MIN = '3'
    redisMock.incrby.mockImplementation(async (key: string) =>
      String(key).startsWith('burst:') ? 4 : 1)
    const d = await authorizeSpend('T', 'ai', 1)
    expect(d.ok).toBe(false)
    expect(d.code).toBe(BURST_EXCEEDED)
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.stringContaining('burst:ai:T:'), 1)
  })

  it('Redis KO → la rafale laisse passer (borner le coût ne coupe pas un payant)', async () => {
    redisMock.incrby.mockRejectedValue(new Error('Redis down'))
    const d = await authorizeSpend('T', 'ai', 1)
    expect(d.ok).toBe(true)
  })
})

// ── Cache de statut : la fenetre de 60 s doit etre refermable ─────────────────
describe('Invalidation du cache de statut', () => {
  it('un statut cache est relu depuis le cache (sans toucher la DB)', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ d: false, s: 'active', t: null }))
    const info = await resolveTenantSpendInfo('T')
    expect(info).toMatchObject({ isDemo: false, status: 'active' })
    expect(db.tenant.findUnique).not.toHaveBeenCalled()
  })

  it('invalidateTenantSpendInfo supprime la cle puis la DB est relue', async () => {
    await invalidateTenantSpendInfo(['T'])
    expect(redisMock.del).toHaveBeenCalledWith('tenant:spend:T')

    redisMock.get.mockResolvedValue(null) // cle supprimee
    db.tenant.findUnique.mockResolvedValue({ isDemo: true, status: 'active', trialEnds: null })
    const info = await resolveTenantSpendInfo('T')
    expect(info).toMatchObject({ isDemo: true }) // bascule vue tout de suite
  })

  it('sans invalidation la bascule ne serait vue qu a l expiration (raison du cablage)', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ d: false, s: 'active', t: null }))
    db.tenant.findUnique.mockResolvedValue({ isDemo: true, status: 'active', trialEnds: null })
    const info = await resolveTenantSpendInfo('T')
    expect(info.isDemo).toBe(false) // valeur perimee servie -> d ou les appels d invalidation
  })

  it('liste vide : aucun appel Redis', async () => {
    await invalidateTenantSpendInfo([])
    expect(redisMock.del).not.toHaveBeenCalled()
  })
})
