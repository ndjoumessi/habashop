import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { nextInvoiceNumber, fmtMoney } from '../lib/invoicePdf'

// ── 1. Helpers purs ──
describe('nextInvoiceNumber', () => {
  it('FAC-{YYYY}-{NNNNN} séquentiel (count+1, padding 5)', () => {
    expect(nextInvoiceNumber(0, 2026)).toBe('FAC-2026-00001')
    expect(nextInvoiceNumber(41, 2026)).toBe('FAC-2026-00042')
    expect(nextInvoiceNumber(99999, 2027)).toBe('FAC-2027-100000')
  })
})
describe('fmtMoney', () => {
  it('XOF entier + FCFA ; EUR converti 2 décimales', () => {
    expect(fmtMoney(5900, 'XOF')).toBe('5 900 FCFA') // espace fine insécable fr-FR
    expect(fmtMoney(655.957, 'EUR')).toBe('1,00 €')
  })
})

// ── 2. Route GET /api/sales/:id/invoice ──
const { db } = vi.hoisted(() => ({
  db: {
    sale: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
    tenant: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: req.headers['x-test-role'] ?? 'CASHIER', tenantId: req.headers['x-test-tenant'] ?? 'T1' }; req.tenantId = req.user.tenantId },
}))
vi.mock('./notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes } from '../routes/sales'

async function buildApp() { const app = Fastify(); app.setValidatorCompiler(validatorCompiler); await app.register(saleRoutes); await app.ready(); return app }
const SALE = {
  id: 's1', tenantId: 'T1', total: 5900, paymentMode: 'cash', discountAmount: 0,
  createdAt: new Date('2026-06-05T10:00:00Z'), invoiceNumber: null, customerId: null,
  items: [{ qty: 2, unitPrice: 2950, total: 5900, product: { name: 'Bifaka' } }],
}
const TENANT = { name: 'Ma Boutique', address: 'Dakar', phone: '+221 77', email: null, currency: 'XOF', vatRate: 18, lang: 'fr' }

beforeEach(() => {
  vi.clearAllMocks()
  db.sale.findFirst.mockResolvedValue({ ...SALE })
  db.tenant.findUnique.mockResolvedValue({ ...TENANT })
  db.sale.count.mockResolvedValue(0)
  db.sale.update.mockResolvedValue({})
})

describe('GET /api/sales/:id/invoice', () => {
  it('1ʳᵉ demande → génère le numéro (FAC-2026-00001) + PDF non vide', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sales/s1/invoice', headers: { 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toContain('facture-FAC-2026-00001.pdf')
    // numéro sauvegardé en DB (séquence count 0 + 1, année de la vente)
    expect(db.sale.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { invoiceNumber: 'FAC-2026-00001' } })
    // PDF réel (signature %PDF), non vide
    expect(res.rawPayload.length).toBeGreaterThan(500)
    expect(res.rawPayload.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('demandes suivantes → MÊME numéro figé (pas de ré-attribution)', async () => {
    db.sale.findFirst.mockResolvedValue({ ...SALE, invoiceNumber: 'FAC-2026-00007' })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sales/s1/invoice', headers: { 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toContain('facture-FAC-2026-00007.pdf')
    expect(db.sale.update).not.toHaveBeenCalled()
    expect(db.sale.count).not.toHaveBeenCalled()
  })

  it('numérotation séquentielle (count=41 → 00042)', async () => {
    db.sale.count.mockResolvedValue(41)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sales/s1/invoice', headers: { 'x-test-tenant': 'T1' } })
    expect(db.sale.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { invoiceNumber: 'FAC-2026-00042' } })
    expect(res.headers['content-disposition']).toContain('FAC-2026-00042')
  })

  it('scope tenant strict (findFirst id + tenantId)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/sales/s1/invoice', headers: { 'x-test-tenant': 'TENANT_X' } })
    expect(db.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1', tenantId: 'TENANT_X' } }))
  })

  it('tout rôle authentifié (CASHIER OK)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sales/s1/invoice', headers: { 'x-test-tenant': 'T1', 'x-test-role': 'CASHIER' } })
    expect(res.statusCode).toBe(200)
  })

  it('vente introuvable → 404', async () => {
    db.sale.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sales/sX/invoice', headers: { 'x-test-tenant': 'T1' } })
    expect(res.statusCode).toBe(404)
  })
})
