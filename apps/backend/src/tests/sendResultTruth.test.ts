import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

/**
 * HARNAIS — `SendResult` dit la vérité (findings coût [1] et [5]).
 *
 * Deux mensonges mesurés que ce fichier verrouille :
 *
 *   [1] `{ sent: 0, failed: 0 }` pour N destinataires JAMAIS contactés. Le retour
 *       `TWILIO_NOT_CONFIGURED` n'avait pas de clé `failed`, et les routes faisaient
 *       `failed: res.failed ?? 0`. Une diffusion de 20 rendait donc un compte-rendu
 *       qui n'accuse aucun échec — le commerçant croit ses messages partis.
 *
 *   [5] Le code d'erreur Twilio AVALÉ au goulot : `catch (e) { failed++ }` ne mettait
 *       jamais `e.code` dans `SendResult`. La table `TWILIO_ERRORS` (8 codes) de
 *       `send-ticket` vivait dans un `catch` MORT, `sendWhatsApp` ne throwant jamais
 *       (fire-and-forget, par design). Le caissier voyait « Envoi WhatsApp impossible »
 *       là où Twilio disait « Ce numéro n'est pas inscrit sur WhatsApp ».
 *
 * SDK Twilio mocké, décision observée, ZÉRO envoi réel.
 */

const { createMock, db, authMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  db: { tenant: { findUnique: vi.fn() }, customer: { findMany: vi.fn() } },
  authMock: vi.fn(async (req: { user?: Record<string, unknown>; tenantId?: string }) => {
    req.user = { userId: 'u1', role: 'MANAGER', tenantId: 'T' }
    req.tenantId = 'T'
  }),
}))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('cron', () => ({ CronJob: class { start() {} } }))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../redis', () => ({ redis: null }))
vi.mock('../middleware/authenticate', () => ({ authenticate: authMock }))
vi.mock('../middleware/superAdmin', () => ({ authenticateAdmin: vi.fn() }))
vi.mock('../middleware/demoTenant', () => ({ blockDemoTenant: vi.fn(async () => {}) }))
vi.mock('../middleware/costQuota', () => ({ costQuota: () => vi.fn(async () => {}) }))
vi.mock('../lib/spend/spendGuard', () => ({
  authorizeSpend: vi.fn(async () => ({ ok: true, quotaKey: 'k' })),
  releaseQuota: vi.fn(async () => {}),
}))

import { sendWhatsApp } from '../lib/spend/twilioClient'
import { whatsappRoutes } from '../routes/whatsapp'

const TROIS = ['+221771234501', '+221771234502', '+221771234503']

async function buildApp() {
  const app = Fastify()
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, b: string, done) => done(null, b ? JSON.parse(b) : {}))
  await app.register(whatsappRoutes)
  await app.ready()
  return app
}

function twilioConfigured(on: boolean) {
  if (on) {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
  } else {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_WHATSAPP_FROM
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  twilioConfigured(true)
  createMock.mockResolvedValue({ sid: 'SM1' })
  db.tenant.findUnique.mockResolvedValue({ name: 'Boutique', currency: 'XOF', lang: 'fr' })
})
afterEach(() => twilioConfigured(false))

// ── [1] Comptage exact ───────────────────────────────────────────────────────
describe('[1] Aucun destinataire n’est compté comme « ni envoyé ni échoué »', () => {
  it('Twilio NON configuré → failed = N, jamais 0', async () => {
    twilioConfigured(false)
    const res = await sendWhatsApp({ tenantId: 'T', to: TROIS, body: 'x', owner: { kind: 'customer' } })

    expect(res.sent).toBe(0)
    expect(res.failed, 'N destinataires non contactés doivent être comptés en échec').toBe(3)
    expect(res.code).toBe('TWILIO_NOT_CONFIGURED')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('l’addition boucle : sent + failed + refusés = destinataires fournis', async () => {
    createMock
      .mockResolvedValueOnce({ sid: 'SM1' })
      .mockRejectedValueOnce(Object.assign(new Error('ko'), { code: 21608 }))
      .mockResolvedValueOnce({ sid: 'SM3' })
    // 4 fournis : 3 joignables + 1 national non résolvable (écarté par le garde).
    const res = await sendWhatsApp({ tenantId: 'T', to: [...TROIS, '621234567'], body: 'x', owner: { kind: 'customer' } })

    const refusedTotal = (res.refused ?? []).reduce((n, r) => n + r.count, 0)
    expect(res.sent).toBe(2)
    expect(res.failed).toBe(1)
    expect(refusedTotal).toBe(1)
    expect(res.sent + (res.failed ?? 0) + refusedTotal, 'un destinataire s’est évaporé').toBe(4)
  })

  it('POST /api/whatsapp/broadcast — Twilio absent → failed = N dans la réponse', async () => {
    twilioConfigured(false)
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST', url: '/api/whatsapp/broadcast',
      payload: { phones: TROIS, message: 'promo', lang: 'fr' },
    })
    const body = r.json()
    expect(body.sent).toBe(0)
    expect(body.failed, 'la route rapporte failed:0 pour 3 non contactés').toBe(3)
  })
})

// ── [5] Le code Twilio remonte ───────────────────────────────────────────────
describe('[5] Le code d’erreur Twilio remonte par la VALEUR de retour', () => {
  it('sendWhatsApp expose errorCodes sans jamais throw', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('not on whatsapp'), { code: 21608 }))

    // Le fire-and-forget est un CONTRAT : les crons et le reçu de vente en dépendent.
    const res = await sendWhatsApp({ tenantId: 'T', to: TROIS[0], body: 'x', owner: { kind: 'customer' } })

    expect(res.failed).toBe(1)
    expect(res.errorCodes, 'e.code est avalé au goulot').toContain(21608)
  })

  it('POST /api/whatsapp/send-ticket — message ACTIONNABLE, pas un 503 générique', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('not on whatsapp'), { code: 21608 }))
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST', url: '/api/whatsapp/send-ticket',
      payload: { phone: '+221771234501', items: [], total: 1000, paymentMode: 'cash' },
    })

    expect(r.json().error, 'le caissier reçoit un générique au lieu du motif Twilio')
      .toContain("n'est pas inscrit sur WhatsApp")
  })

  it('un code Twilio INCONNU ne prétend pas être mappé', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('boom'), { code: 99999 }))
    const app = await buildApp()
    const r = await app.inject({
      method: 'POST', url: '/api/whatsapp/send-ticket',
      payload: { phone: '+221771234501', items: [], total: 1000, paymentMode: 'cash' },
    })
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(r.json().error).toBeTruthy()
  })
})
