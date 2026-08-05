import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const { db, redisMock, authMock } = vi.hoisted(() => ({
  db: {
    sale: { findMany: vi.fn(), aggregate: vi.fn() },
    tenant: { findUnique: vi.fn() },
    employee: { aggregate: vi.fn() },
    expense: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    campaign: { findMany: vi.fn(), create: vi.fn() },
    saleItem: { groupBy: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn() },
  },
  redisMock: { incr: vi.fn(), decr: vi.fn(async () => 0), expire: vi.fn(), incrby: vi.fn(), decrby: vi.fn(), get: vi.fn(), setex: vi.fn() },
  authMock: vi.fn(async (req: any) => { req.user = { role: 'ADMIN', userId: 'u1' }; req.tenantId = 'T1' }),
}))

vi.mock('../db', () => ({ prisma: db }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../middleware/authenticate', () => ({ authenticate: authMock }))
vi.mock('../lib/wsAuth', () => ({ decideWsAuth: vi.fn().mockReturnValue({ ok: false }) }))
// ⚠️ Ce mock rendait des paliers en MINUSCULES ('gold'…) alors que le vrai
// `tierForPoints` rend 'Gold'. Il décrivait donc un monde qui n'existe pas, et c'est
// précisément ce qui a laissé les segments de fidélité cibler 0 destinataire en prod
// sans qu'aucun test ne bronche. Il reflète désormais la casse RÉELLE.
vi.mock('../lib/loyalty', () => ({
  LOYALTY_TIERS: ['Bronze', 'Silver', 'Gold'] as const,
  tierForPoints: (pts: number, b: number, s: number) =>
    pts >= s ? 'Gold' : pts >= b ? 'Silver' : 'Bronze',
}))
vi.mock('twilio', () => ({
  default: () => ({ messages: { create: vi.fn().mockResolvedValue({ sid: 'SM1' }) } }),
}))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
// Le client gardé exige un expéditeur configuré (l'ancienne route envoyait avec
// `from: undefined`, ce qui échouerait contre le vrai Twilio).
process.env.TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'
process.env.TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID ?? 'AC_test'
process.env.TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN ?? 'token_test'

import { reportsRoutes } from '../routes/reports'
import { whatsappRoutes } from '../routes/whatsapp'

const BASE_TENANT = { vatRate: 20, posVatIncluded: true, currency: 'XOF' }
const BASE_SALE   = { id: 'sale01234567', createdAt: new Date('2026-06-01T10:00:00Z'), total: 12000, paymentMode: 'cash', status: 'completed', customerId: 'cust01' }
const BASE_CUST   = [{ id: 'cust01', name: 'Awa Diop' }]

async function buildReportsApp() {
  const app = Fastify()
  await app.register(reportsRoutes)
  await app.ready()
  return app
}

async function buildWaApp() {
  const app = Fastify()
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    done(null, body ? JSON.parse(body) : {})
  })
  await app.register(whatsappRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue(BASE_TENANT)
  db.employee.aggregate.mockResolvedValue({ _sum: { salary: 0 } })
  db.expense.findMany.mockResolvedValue([])
  db.sale.aggregate.mockResolvedValue({ _sum: { total: 0 }, _count: { id: 0 } })
  db.customer.findMany.mockResolvedValue(BASE_CUST)
  // authenticate par défaut → ADMIN
  authMock.mockImplementation(async (req: any) => { req.user = { role: 'ADMIN', userId: 'u1' }; req.tenantId = 'T1' })
})

// ─── ÉTAPE 1 — CSV comptable ─────────────────────────────────────────────────

describe('GET /api/reports/accounting/csv', () => {
  it('retourne text/csv avec BOM + colonnes attendues', async () => {
    db.sale.findMany.mockResolvedValue([BASE_SALE])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/accounting/csv?month=2026-06' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toContain('comptabilite-2026-06.csv')

    const text = res.body
    expect(text.startsWith('﻿')).toBe(true) // UTF-8 BOM
    expect(text).toContain('Date;Référence;Client;Mode paiement;Montant HT;TVA;Montant TTC;Statut')
    expect(text).toContain('Awa Diop')
    expect(text).toContain('cash')
    expect(text).toContain('Complété')
  })

  it('calcule HT + TVA correct quand posVatIncluded=true (taux 20 %)', async () => {
    db.sale.findMany.mockResolvedValue([{ ...BASE_SALE, total: 12000 }])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/accounting/csv?month=2026-06' })

    // 12000 TTC → HT = 12000/1.2 = 10000, TVA = 2000
    expect(res.body).toContain('10000.00')
    expect(res.body).toContain('2000.00')
    expect(res.body).toContain('12000.00')
  })

  it('calcule HT + TVA correct quand posVatIncluded=false', async () => {
    db.tenant.findUnique.mockResolvedValue({ vatRate: 18, posVatIncluded: false, currency: 'XOF' })
    db.sale.findMany.mockResolvedValue([{ ...BASE_SALE, total: 10000 }])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/accounting/csv?month=2026-06' })

    // 10000 HT → TVA = 1800, TTC = 11800
    expect(res.body).toContain('10000.00')
    expect(res.body).toContain('1800.00')
    expect(res.body).toContain('11800.00')
  })

  it('403 pour CASHIER', async () => {
    authMock.mockImplementationOnce(async (req: any) => { req.user = { role: 'CASHIER', userId: 'u1' }; req.tenantId = 'T1' })
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/accounting/csv?month=2026-06' })
    expect(res.statusCode).toBe(403)
  })
})

// ─── ÉTAPE 2 — Rapport TVA ───────────────────────────────────────────────────

describe('GET /api/reports/vat', () => {
  it('totaux cohérents : totalHT + tva = totalTTC (posVatIncluded=true)', async () => {
    db.sale.findMany.mockResolvedValue([
      { ...BASE_SALE, total: 12000 },
      { ...BASE_SALE, id: 'sale02345678', total: 6000, customer: null },
    ])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/vat?month=2026-06' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.vatRate).toBe(20)
    expect(body.totals.count).toBe(2)
    // totalHT + tva doit = totalTTC (avec précision flottante)
    expect(Math.abs(body.totals.totalHT + body.totals.tva - body.totals.totalTTC)).toBeLessThan(0.01)
    // 18000 TTC / 1.2 = 15000 HT, TVA = 3000
    expect(body.totals.totalHT).toBeCloseTo(15000, 0)
    expect(body.totals.tva).toBeCloseTo(3000, 0)
    expect(body.totals.totalTTC).toBeCloseTo(18000, 0)
  })

  it('totaux cohérents : posVatIncluded=false (ventes HT)', async () => {
    db.tenant.findUnique.mockResolvedValue({ vatRate: 18, posVatIncluded: false, currency: 'XOF' })
    db.sale.findMany.mockResolvedValue([{ ...BASE_SALE, total: 10000 }])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/vat?month=2026-06' })

    const body = res.json()
    expect(Math.abs(body.totals.totalHT + body.totals.tva - body.totals.totalTTC)).toBeLessThan(0.01)
    expect(body.totals.totalHT).toBeCloseTo(10000)
    expect(body.totals.tva).toBeCloseTo(1800)
    expect(body.totals.totalTTC).toBeCloseTo(11800)
  })

  it('aucune vente → totaux zéros, rows vide', async () => {
    db.sale.findMany.mockResolvedValue([])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/vat?month=2026-06' })
    const body = res.json()
    expect(body.totals.count).toBe(0)
    expect(body.totals.tva).toBe(0)
    expect(body.rows).toHaveLength(0)
  })
})

describe('GET /api/reports/vat/csv', () => {
  it('retourne text/csv avec ligne TOTAL', async () => {
    db.sale.findMany.mockResolvedValue([{ ...BASE_SALE, total: 12000 }])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/vat/csv?month=2026-06' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.body).toContain('TOTAL')
  })
})

describe('GET /api/reports/vat/pdf', () => {
  it('retourne application/pdf avec signature %PDF', async () => {
    db.sale.findMany.mockResolvedValue([{ ...BASE_SALE, total: 12000 }])
    const app = await buildReportsApp()
    const res = await app.inject({ method: 'GET', url: '/api/reports/vat/pdf?month=2026-06' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/pdf/)
    expect(res.rawPayload.slice(0, 4).toString()).toBe('%PDF')
  })
})

// ─── ÉTAPE 3 — Campagnes WhatsApp ───────────────────────────────────────────

describe('POST /api/marketing/whatsapp/campaign', () => {
  beforeEach(() => {
    redisMock.incr.mockResolvedValue(1) // premier envoi → autorisé
    redisMock.expire.mockResolvedValue(1)
    db.customer.findMany.mockResolvedValue([
      { phone: '+221771234567', loyaltyPoints: 0 },
      { phone: '+221779876543', loyaltyPoints: 0 },
    ])
    db.campaign.create.mockResolvedValue({ id: 'c1' })
  })

  it('envoie à tous les clients (segment=all) et enregistre la campagne', async () => {
    const app = await buildWaApp()
    const res = await app.inject({
      method: 'POST', url: '/api/marketing/whatsapp/campaign',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ message: 'Promo spéciale !', segment: 'all' }),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.recipientCount).toBe(2)
    expect(body.sent + body.failed).toBe(2)
    expect(db.campaign.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ segment: 'all', message: 'Promo spéciale !' }),
    }))
  })

  it('filtre par tier gold', async () => {
    db.tenant.findUnique.mockResolvedValue({ bronzeThreshold: 2000, silverThreshold: 5000 })
    db.customer.findMany.mockResolvedValue([
      { phone: '+221771111111', loyaltyPoints: 100 },    // bronze
      { phone: '+221772222222', loyaltyPoints: 6000 },   // gold
    ])
    const app = await buildWaApp()
    const res = await app.inject({
      method: 'POST', url: '/api/marketing/whatsapp/campaign',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ message: 'Offre Gold', segment: 'gold' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().recipientCount).toBe(1) // seul le gold
  })

  it('rate-limit → 429 au 2ème envoi', async () => {
    redisMock.incr.mockResolvedValue(2) // déjà envoyé
    const app = await buildWaApp()
    const res = await app.inject({
      method: 'POST', url: '/api/marketing/whatsapp/campaign',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ message: 'Spam ?', segment: 'all' }),
    })
    expect(res.statusCode).toBe(429)
    expect(db.campaign.create).not.toHaveBeenCalled()
  })

  it('message vide → 400', async () => {
    const app = await buildWaApp()
    const res = await app.inject({
      method: 'POST', url: '/api/marketing/whatsapp/campaign',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ message: '   ', segment: 'all' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('segment invalide → 400', async () => {
    const app = await buildWaApp()
    const res = await app.inject({
      method: 'POST', url: '/api/marketing/whatsapp/campaign',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ message: 'ok', segment: 'vip' }),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/marketing/whatsapp/campaigns', () => {
  it('retourne la liste ordonnée par date', async () => {
    db.campaign.findMany.mockResolvedValue([
      { id: 'c1', message: 'msg1', segment: 'all', recipientCount: 5, sentCount: 5, failedCount: 0, createdAt: new Date(), user: { name: 'Admin' } },
    ])
    const app = await buildWaApp()
    const res = await app.inject({ method: 'GET', url: '/api/marketing/whatsapp/campaigns' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0]).toMatchObject({ segment: 'all', sentCount: 5 })
  })
})
