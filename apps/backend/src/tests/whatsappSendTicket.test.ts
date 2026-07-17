import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Twilio : capture messages.create. Cron : no-op (pas de planification en test).
const { createMock, db, authMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  db: { tenant: { findUnique: vi.fn() } },
  // req.user.tenantId = boutique PRINCIPALE du JWT ; req.tenantId = boutique ACTIVE.
  // Les deux diffèrent → prouve que la route utilise bien l'ACTIVE (W2).
  authMock: vi.fn(async (req: any) => {
    req.user = { userId: 'u1', role: 'MANAGER', tenantId: 'PRINCIPAL' }
    req.tenantId = 'ACTIVE'
  }),
}))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('cron', () => ({ CronJob: class { start() {} } }))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../redis', () => ({ redis: null }))
vi.mock('../middleware/authenticate', () => ({ authenticate: authMock }))
vi.mock('../middleware/superAdmin', () => ({ authenticateAdmin: vi.fn() }))

import { whatsappRoutes } from '../routes/whatsapp'

async function buildApp() {
  const app = Fastify()
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body: string, done) => done(null, body ? JSON.parse(body) : {}))
  await app.register(whatsappRoutes)
  await app.ready()
  return app
}

describe('POST /api/whatsapp/send-ticket — W2 boutique active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TWILIO_ACCOUNT_SID  = 'ACxxxx'
    process.env.TWILIO_AUTH_TOKEN   = 'tokxxxx'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
    createMock.mockResolvedValue({ sid: 'SMxxxx' })
    // Le nom retourné dépend de l'id demandé : révèle quelle boutique la route a résolue.
    db.tenant.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'ACTIVE'
        ? { name: 'Boutique ACTIVE', currency: 'XOF', lang: 'fr' }
        : { name: 'Boutique PRINCIPALE', currency: 'XOF', lang: 'fr' },
    )
  })
  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_WHATSAPP_FROM
  })

  it('résout le tenant via request.tenantId (boutique ACTIVE), pas request.user.tenantId', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/send-ticket',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ phone: '+221770000000', items: [{ name: 'Riz', qty: 1, price: 4000 }], total: 4000, paymentMode: 'cash' }),
    })
    expect(res.statusCode).toBe(200)
    // La route interroge la boutique ACTIVE…
    expect(db.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'ACTIVE' } })
    expect(db.tenant.findUnique).not.toHaveBeenCalledWith({ where: { id: 'PRINCIPAL' } })
    // …et le reçu envoyé est brandé avec son nom, jamais celui du tenant principal.
    const body = createMock.mock.calls[0][0].body as string
    expect(body).toContain('Boutique ACTIVE')
    expect(body).not.toContain('Boutique PRINCIPALE')
  })
})
