import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * HARNAIS — le créneau 1/h d'une campagne (finding coût [3]).
 *
 * Mesuré : `redis.incr(rl:campaign:<tenant>)` consommait le créneau AVANT la
 * résolution du segment et l'envoi, et aucun `decr` n'existait. Donc quota dépassé,
 * Twilio absent, segment vide ou tous les numéros non résolvables → le commerçant
 * perdait son unique créneau horaire sans qu'un seul message ne parte.
 *
 * INVARIANT : le créneau n'est consommé QUE si la campagne envoie réellement ≥ 1
 * message. Une campagne qui n'envoie rien laisse le créneau DISPONIBLE.
 *
 * Redis + Twilio mockés, décision observée, ZÉRO envoi réel.
 */

const { createMock, db, authMock, redisStore } = vi.hoisted(() => {
  const redisStore = new Map<string, number>()
  return {
    createMock: vi.fn(),
    db: { tenant: { findUnique: vi.fn() }, customer: { findMany: vi.fn() }, campaign: { create: vi.fn() } },
    authMock: vi.fn(async (req: { user?: Record<string, unknown>; tenantId?: string }) => {
      req.user = { userId: 'u1', role: 'MANAGER', tenantId: 'T' }
      req.tenantId = 'T'
    }),
    redisStore,
  }
})

// Redis en mémoire, KEY-AWARE : incr/decr/expire réels sur un seul store partagé,
// pour observer si le créneau reste disponible d'une campagne à l'autre.
vi.mock('../redis', () => ({
  redis: {
    incr: vi.fn(async (k: string) => { const n = (redisStore.get(k) ?? 0) + 1; redisStore.set(k, n); return n }),
    decr: vi.fn(async (k: string) => { const n = (redisStore.get(k) ?? 0) - 1; redisStore.set(k, n); return n }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async (k: string) => { redisStore.delete(k); return 1 }),
  },
}))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('cron', () => ({ CronJob: class { start() {} } }))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../middleware/authenticate', () => ({ authenticate: authMock }))
vi.mock('../middleware/superAdmin', () => ({ authenticateAdmin: vi.fn() }))
vi.mock('../middleware/demoTenant', () => ({ blockDemoTenant: vi.fn(async () => {}) }))
vi.mock('../middleware/costQuota', () => ({ costQuota: () => vi.fn(async () => {}) }))

type SpendRet = { ok: boolean; quotaKey?: string; code?: string; message?: string }
const authorizeSpend = vi.fn<() => Promise<SpendRet>>(async () => ({ ok: true, quotaKey: 'k' }))
vi.mock('../lib/spend/spendGuard', () => ({
  authorizeSpend: () => authorizeSpend(),
  releaseQuota: vi.fn(async () => {}),
}))

import { whatsappRoutes } from '../routes/whatsapp'

const SLOT = 'rl:campaign:T'

async function buildApp() {
  const app = Fastify()
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, b: string, done) => done(null, b ? JSON.parse(b) : {}))
  await app.register(whatsappRoutes)
  await app.ready()
  return app
}

function campaign(app: FastifyInstance, segment = 'all') {
  return app.inject({ method: 'POST', url: '/api/marketing/whatsapp/campaign', payload: { message: 'promo', segment } })
}

/** Un client dont le numéro est un E.164 valide → joignable. */
const JOIGNABLE = [{ phone: '+221771234501', loyaltyPoints: 0 }]

beforeEach(() => {
  vi.clearAllMocks()
  redisStore.clear()
  authorizeSpend.mockResolvedValue({ ok: true, quotaKey: 'k' })
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'token'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
  createMock.mockResolvedValue({ sid: 'SM1' })
  db.tenant.findUnique.mockResolvedValue({ bronzeThreshold: 2000, silverThreshold: 5000 })
  db.campaign.create.mockResolvedValue({})
})

describe('[3] Le créneau n’est PAS consommé quand rien ne part', () => {
  it('segment VIDE → 2e campagne dans l’heure passe encore', async () => {
    db.customer.findMany.mockResolvedValue([]) // aucun client
    const app = await buildApp()

    const r1 = await campaign(app)
    expect(r1.json().sent).toBe(0)
    // Créneau libre : la 2e n’est pas bloquée.
    const r2 = await campaign(app)
    expect(r2.statusCode).not.toBe(429)
  })

  it('tous les numéros NON RÉSOLVABLES → créneau préservé', async () => {
    // Nationaux sans pays → écartés par le garde téléphone (0 envoi).
    db.customer.findMany.mockResolvedValue([{ phone: '621234567', loyaltyPoints: 0 }])
    const app = await buildApp()

    const r1 = await campaign(app)
    expect(r1.json().sent).toBe(0)
    expect(createMock).not.toHaveBeenCalled()
    const r2 = await campaign(app)
    expect(r2.statusCode).not.toBe(429)
  })

  it('Twilio ABSENT → créneau préservé', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_WHATSAPP_FROM
    db.customer.findMany.mockResolvedValue(JOIGNABLE)
    const app = await buildApp()

    const r1 = await campaign(app)
    expect(r1.json().sent).toBe(0)
    const r2 = await campaign(app)
    expect(r2.statusCode).not.toBe(429)
  })

  it('QUOTA déjà dépassé → créneau préservé', async () => {
    authorizeSpend.mockResolvedValue({ ok: false, code: 'QUOTA_EXCEEDED', message: 'plein' })
    db.customer.findMany.mockResolvedValue(JOIGNABLE)
    const app = await buildApp()

    const r1 = await campaign(app)
    expect(r1.statusCode).toBe(429) // refus quota…
    authorizeSpend.mockResolvedValue({ ok: true, quotaKey: 'k' }) // …quota se libère
    const r2 = await campaign(app)
    expect(r2.statusCode).not.toBe(429) // …et le créneau n’a PAS été brûlé par le refus
  })
})

describe('[3] Le créneau EST consommé quand la campagne envoie', () => {
  it('≥ 1 envoyé → 2e campagne dans l’heure → 429', async () => {
    db.customer.findMany.mockResolvedValue(JOIGNABLE)
    const app = await buildApp()

    const r1 = await campaign(app)
    expect(r1.json().sent).toBe(1)
    const r2 = await campaign(app)
    expect(r2.statusCode).toBe(429)
  })

  it('le compteur du créneau retombe à 0 après une campagne qui n’envoie rien', async () => {
    db.customer.findMany.mockResolvedValue([])
    const app = await buildApp()
    await campaign(app)
    // Ni fuite ni valeur résiduelle > 0 : le prochain incr repartira d’une fenêtre saine.
    expect(redisStore.get(SLOT) ?? 0).toBe(0)
  })
})
