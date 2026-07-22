import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * Robinet sur les endpoints à COÛT EXTERNE — (a) quota/tenant/jour, (b) rôle sur
 * l'IA, (c) essai expiré / boutique suspendue.
 *
 * L'inscription est ouverte et sans vérification d'e-mail : tout nouveau tenant est
 * ADMIN d'un essai et atteignait ces routes sans aucune limite par tenant. On monte
 * les VRAIS handlers avec les VRAIS gardes ; seuls db/redis/authenticate sont mockés.
 *
 * ⚠️ Aucun effet de bord externe n'est exercé ici : les contrôles positifs portent
 * sur la DÉCISION du garde (compteur incrémenté, requête laissée passer), jamais sur
 * un envoi Twilio ou un appel Anthropic réels.
 */

const { db, redisMock, authMock, state } = vi.hoisted(() => {
  const state = { role: 'ADMIN', tenantId: 'T' }
  return {
    state,
    db: {
    tenant:   { findUnique: vi.fn() },
    // Lus par les handlers IA avant l'appel Claude — mockés pour que la route
    // atteigne vraiment le point de dépense et rende son 429.
    product:  { findMany: vi.fn(async () => []) },
    sale:     { findMany: vi.fn(async () => []) },
    employee: { findMany: vi.fn(async () => []) },
    expense:  { findMany: vi.fn(async () => []) },
  },
    redisMock: { incrby: vi.fn(), decrby: vi.fn(), expire: vi.fn(), get: vi.fn(), setex: vi.fn(), del: vi.fn() },
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
// ⚠️ async : un hook Fastify qui ne renvoie PAS de thenable attend `next()` → la
// requête pend indéfiniment. Ce mock doit rendre la main comme le vrai garde.
vi.mock('../middleware/demoTenant', () => ({
  blockDemoTenant: vi.fn(async () => {}),
  DEMO_TENANT_FORBIDDEN: 'DEMO_TENANT_FORBIDDEN',
}))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: vi.fn() } }) }))
vi.mock('cron', () => ({ CronJob: class { start() {} } }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { aiRoutes } from '../routes/ai'
import { supplierRoutes } from '../routes/suppliers'
import {
  authorizeSpend, quotaLimit, tenantSpendState, quotaKey,
  QUOTA_EXCEEDED, TRIAL_EXPIRED, TENANT_INACTIVE,
} from '../lib/spend/spendGuard'

const DAY = 24 * 3600 * 1000
/** Boutique en essai valide (14 j) par défaut. */
function seedTenant(status = 'trial', trialEnds: Date | null = new Date(Date.now() + 7 * DAY), isDemo = false) {
  db.tenant.findUnique.mockResolvedValue({ isDemo, status, trialEnds })
}
/** Le compteur du jour vaut `n` APRÈS incrément (valeur renvoyée par INCR). */
function seedCounter(n: number) {
  redisMock.incrby.mockResolvedValue(n)
  redisMock.decrby.mockResolvedValue(0)
  redisMock.expire.mockResolvedValue(1)
  redisMock.get.mockResolvedValue(null) // pas de cache tenant → lecture DB à chaque test
}

async function buildApp(register: any) {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body: string, done) =>
    done(null, body ? JSON.parse(body) : {}))
  await app.register(register)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  state.role = 'ADMIN'
  state.tenantId = 'T'
  seedTenant()
  seedCounter(1)
  delete process.env.ANTHROPIC_API_KEY
  for (const k of Object.keys(process.env)) if (k.startsWith('QUOTA_')) delete process.env[k]
})

// ── (b) Garde de rôle sur l'IA ───────────────────────────────────────────────
describe('(b) Rôle requis sur /api/ai/*', () => {
  it('un caissier → 403 (l’IA appelait Opus sans aucun contrôle de rôle)', async () => {
    state.role = 'CASHIER'
    const app = await buildApp(aiRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/ai/chat', payload: { message: 'salut' } })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toMatch(/MANAGER/)
  })

  it('un caissier refusé ne consomme AUCUN quota (garde avant le compteur)', async () => {
    state.role = 'CASHIER'
    const app = await buildApp(aiRoutes)
    await app.inject({ method: 'POST', url: '/api/ai/analyze', payload: { type: 'sales' } })
    expect(redisMock.incrby).not.toHaveBeenCalled()
  })

  it('un manager passe le garde de rôle', async () => {
    state.role = 'MANAGER'
    const app = await buildApp(aiRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/ai/chat', payload: { message: 'salut' } })
    expect(res.statusCode).not.toBe(403)
  })
})

// ── (c) Essai expiré / boutique suspendue ────────────────────────────────────
describe('(c) Essai expiré et boutique suspendue', () => {
  it('essai expiré → refusé sur scan-invoice (403 TRIAL_EXPIRED)', async () => {
    seedTenant('trial', new Date(Date.now() - DAY)) // échu hier
    const app = await buildApp(supplierRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/suppliers/scan-invoice' })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(TRIAL_EXPIRED)
    expect(redisMock.incrby).not.toHaveBeenCalled()
  })

  it('boutique suspendue → 403 TENANT_INACTIVE', async () => {
    seedTenant('suspended', null)
    const app = await buildApp(supplierRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/suppliers/scan-invoice' })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(TENANT_INACTIVE)
  })

  it('essai encore valide → laissé passer (503, clé OCR absente : le handler s’exécute)', async () => {
    seedTenant('trial', new Date(Date.now() + DAY))
    const app = await buildApp(supplierRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/suppliers/scan-invoice' })
    expect(res.statusCode).toBe(503)
  })

  it('la décision est pure et datable', () => {
    const now = new Date('2026-07-22T12:00:00Z')
    expect(tenantSpendState({ isDemo: false, status: 'trial', trialEnds: new Date('2026-07-21T00:00:00Z') }, now).ok).toBe(false)
    expect(tenantSpendState({ isDemo: false, status: 'trial', trialEnds: new Date('2026-07-23T00:00:00Z') }, now).ok).toBe(true)
    expect(tenantSpendState({ isDemo: false, status: 'active', trialEnds: null }, now).ok).toBe(true)
    expect(tenantSpendState({ isDemo: false, status: 'cancelled', trialEnds: null }, now).ok).toBe(false)
    expect(tenantSpendState(null, now).ok).toBe(false)
  })
})

// ── (a) Quota par tenant et par jour ─────────────────────────────────────────
describe('(a) Quota quotidien par tenant', () => {
  it('le 21e appel IA d’un tenant à l’essai → 429 QUOTA_EXCEEDED (compte + plafond)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key' // sinon 503 AVANT le point de dépense (et sans rien consommer)
    seedCounter(21) // 20 déjà consommés → celui-ci est le 21e
    const app = await buildApp(aiRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/ai/chat', payload: { message: 'salut' } })
    expect(res.statusCode).toBe(429)
    const body = res.json()
    expect(body.code).toBe(QUOTA_EXCEEDED)
    expect(body.error).toContain('20/20') // « 20/20 utilisés aujourd'hui »
    expect(body.error).toContain('1 requis')
  })

  it('le 20e appel passe encore (la borne est inclusive)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    seedCounter(20)
    const app = await buildApp(aiRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/ai/chat', payload: { message: 'salut' } })
    expect(res.statusCode).not.toBe(429)
  })

  it('un tenant PAYANT garde une marge bien plus large (200/j)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    seedTenant('active', null)
    seedCounter(21)
    const app = await buildApp(aiRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/ai/chat', payload: { message: 'salut' } })
    expect(res.statusCode).not.toBe(429)
  })

  it('plafonds configurables par env, sans redéploiement', () => {
    expect(quotaLimit('ai', 'trial')).toBe(20)
    process.env.QUOTA_TRIAL_AI = '3'
    expect(quotaLimit('ai', 'trial')).toBe(3)      // relu à l’appel
    process.env.QUOTA_ACTIVE_OCR = '0'
    expect(quotaLimit('ocr', 'active')).toBe(0)    // 0 = coupure nette, valeur valide
    expect(quotaLimit('whatsapp', 'trial')).toBe(30)
  })

  it('un seau par tenant, par type et par jour', () => {
    const d = new Date('2026-07-22T23:30:00Z')
    expect(quotaKey('t1', 'ocr', d)).toBe('quota:ocr:t1:2026-07-22')
    expect(quotaKey('t2', 'ocr', d)).not.toBe(quotaKey('t1', 'ocr', d))
    expect(quotaKey('t1', 'ai', d)).not.toBe(quotaKey('t1', 'ocr', d))
  })

  it('contrôle positif — la DÉCISION est « autorisé » et le compteur est posé', async () => {
    seedCounter(5)
    const r = await authorizeSpend('T', 'ocr', 1)
    expect(r).toMatchObject({ ok: true, used: 5, limit: 15, degraded: false })
    expect(redisMock.incrby).toHaveBeenCalledWith(quotaKey('T', 'ocr'), 1)
  })

  it('le TTL n’est posé qu’au premier appel du jour', async () => {
    seedCounter(1)
    await authorizeSpend('T', 'ai', 1)
    expect(redisMock.expire).toHaveBeenCalled()
    vi.clearAllMocks(); seedTenant(); seedCounter(2)
    await authorizeSpend('T', 'ai', 1)
    expect(redisMock.expire).not.toHaveBeenCalled()
  })
})

// ── Fail-open tracé ──────────────────────────────────────────────────────────
describe('Fail-open (Redis KO) — autorisé mais TRACÉ', () => {
  it('laisse passer et journalise explicitement', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    redisMock.incrby.mockRejectedValue(new Error('Redis down'))
    const r = await authorizeSpend('T', 'ai', 1)
    expect(r.ok).toBe(true)
    expect(r.degraded).toBe(true)
    // La trace protège, pas la branche : sans elle, un fail-open exploité serait invisible.
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0][0])).toContain('FAIL-OPEN')
    warn.mockRestore()
  })

  it('remonte aussi dans Sentry (visible après coup)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const Sentry = await import('@sentry/node')
    redisMock.incrby.mockRejectedValue(new Error('Redis down'))
    await authorizeSpend('T', 'ocr', 1)
    expect(Sentry.captureMessage).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
