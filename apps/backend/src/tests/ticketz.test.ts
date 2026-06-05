import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { computeTicketZ } from '../lib/ticketZ'

// ── 1. Agrégat pur ──
describe('computeTicketZ', () => {
  const sales = [
    { total: 1000, status: 'completed', paymentMode: 'cash', customerId: 'c1' },
    { total: 2000, status: 'completed', paymentMode: 'wave', customerId: 'c2' },
    { total: 500, status: 'refunded', paymentMode: 'cash', customerId: 'c1' },
    { total: 1500, status: 'completed', paymentMode: 'card', customerId: null },
  ]
  const a = computeTicketZ(sales)
  it('CA = ventes non remboursées ; remboursements exclus du CA', () => {
    expect(a.caVentes).toBe(4500)
    expect(a.nbVentes).toBe(3)
    expect(a.totalRemboursements).toBe(500)
    expect(a.caNets).toBe(4000)
  })
  it('breakdown paiement (cash / mobile / card)', () => {
    expect(a.cashAmount).toBe(1000)       // remboursement cash NON compté
    expect(a.mobileMoneyAmount).toBe(2000) // wave
    expect(a.cardAmount).toBe(1500)
  })
  it('panier moyen + clients distincts (customerId non null)', () => {
    expect(a.panierMoyen).toBe(1500)      // 4500 / 3
    expect(a.nbClients).toBe(2)           // c1, c2 (carte sans client non compté)
  })
  it('journée vide → tout à 0', () => {
    const z = computeTicketZ([])
    expect(z).toMatchObject({ caVentes: 0, nbVentes: 0, caNets: 0, panierMoyen: 0, nbClients: 0 })
  })
})

// ── 2. Routes ──
const { db } = vi.hoisted(() => ({
  db: {
    sale: { findMany: vi.fn() },
    ticketZ: { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: req.headers['x-test-role'] ?? 'MANAGER', tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: 'u1' }; req.tenantId = req.user.tenantId },
}))

import { ticketZRoutes } from '../routes/ticketZ'
async function buildApp() { const app = Fastify(); await app.register(ticketZRoutes); await app.ready(); return app }

beforeEach(() => {
  vi.clearAllMocks()
  db.sale.findMany.mockResolvedValue([
    { total: 1000, status: 'completed', paymentMode: 'cash', customerId: 'c1' },
    { total: 500, status: 'refunded', paymentMode: 'cash', customerId: 'c1' },
  ])
  db.ticketZ.upsert.mockImplementation(({ create }: any) => Promise.resolve({ id: 'tz1', ...create }))
})

describe('POST /api/ticket-z/generate', () => {
  it('CASHIER → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/ticket-z/generate', headers: { 'x-test-role': 'CASHIER' } })
    expect(res.statusCode).toBe(403)
    expect(db.ticketZ.upsert).not.toHaveBeenCalled()
  })

  it('MANAGER → upsert avec agrégats (remboursement exclu du CA)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/ticket-z/generate', headers: { 'x-test-role': 'MANAGER', 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(200)
    const call = db.ticketZ.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ tenantId_date: { tenantId: 'T1', date: expect.any(Date) } })
    expect(call.create).toMatchObject({ tenantId: 'T1', caVentes: 1000, totalRemboursements: 500, caNets: 500, generatedBy: 'u1' })
    expect(call.update).toMatchObject({ caVentes: 1000, totalRemboursements: 500 })
  })

  it('idempotent : regénérable (upsert, pas de create dupliqué)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/ticket-z/generate', headers: { 'x-test-role': 'ADMIN' } })
    await app.inject({ method: 'POST', url: '/api/ticket-z/generate', headers: { 'x-test-role': 'ADMIN' } })
    expect(db.ticketZ.upsert).toHaveBeenCalledTimes(2) // upsert = pas de doublon (contrainte @@unique)
  })

  it('isolation tenant : agrège seulement les ventes du tenant', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/ticket-z/generate', headers: { 'x-test-role': 'MANAGER', 'x-test-tenant': 'TENANT_X' } })
    expect(db.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'TENANT_X' }) }))
  })
})

describe('GET /api/ticket-z/today + history + pdf', () => {
  it('today → findUnique sur (tenant, date)', async () => {
    db.ticketZ.findUnique.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/ticket-z/today', headers: { 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(200)
    expect(db.ticketZ.findUnique).toHaveBeenCalledWith({ where: { tenantId_date: { tenantId: 'T1', date: expect.any(Date) } } })
  })

  it('history → 30 derniers desc, scope tenant', async () => {
    db.ticketZ.findMany.mockResolvedValue([])
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/ticket-z/history', headers: { 'x-test-tenant': 'T1' } })
    expect(db.ticketZ.findMany).toHaveBeenCalledWith({ where: { tenantId: 'T1' }, orderBy: { date: 'desc' }, take: 30 })
  })

  it('pdf → PDF réel non vide (%PDF)', async () => {
    db.ticketZ.findFirst.mockResolvedValue({
      id: 'tz1', tenantId: 'T1', date: new Date('2026-06-05'), caVentes: 4500, nbVentes: 3,
      totalRemboursements: 500, caNets: 4000, cashAmount: 1000, mobileMoneyAmount: 2000,
      cardAmount: 1500, panierMoyen: 1500, nbClients: 2, generatedBy: 'u1', generatedAt: new Date('2026-06-05T18:00:00Z'),
    })
    db.tenant.findUnique.mockResolvedValue({ name: 'Ma Boutique', currency: 'XOF', lang: 'fr' })
    db.user.findUnique.mockResolvedValue({ name: 'Amadou' })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/ticket-z/tz1/pdf', headers: { 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.rawPayload.subarray(0, 4).toString()).toBe('%PDF')
    expect(res.rawPayload.length).toBeGreaterThan(500)
  })

  it('pdf introuvable → 404', async () => {
    db.ticketZ.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/ticket-z/x/pdf', headers: { 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(404)
  })
})
