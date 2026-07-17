import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

/**
 * Item 7 — Isolation cross-tenant (defense-in-depth, preuve end-to-end).
 *
 * Un mock Prisma « tenant-aware » respecte `where.tenantId` : les ressources
 * appartiennent au tenant A ; on requête en tant que tenant B via les VRAIS
 * handlers et on prouve qu'aucune donnée d'autrui n'est lue/écrite (404, ou 403
 * pour les gardes RBAC cross-tenant), et qu'aucune mutation n'a lieu.
 *
 * Couvre : sales (refund, invoice), customers (get/put/delete/loyalty), stock
 * (products put/delete), stockTransfers (W1), payroll (cross-tenant), + un
 * contrôle positif (tenant A réussit) pour prouver que le mock ne renvoie pas
 * « 404 partout ». W2 (reçu WhatsApp sur la boutique active) est prouvé dans
 * whatsappSendTicket.test.ts.
 */

const OWNER = 'A'                 // tenant propriétaire des ressources seedées
const OTHER_DEST = 'A2'           // 2e boutique de A (destination d'un transfert)
let currentTenant = 'B'           // tenant appelant (modifiable par test)
let currentRole = 'ADMIN'

// ── Store seedé (tout appartient à OWNER) ────────────────────────────────────
const STORE: Record<string, Record<string, any>> = {
  customer:      { c1: { id: 'c1', tenantId: OWNER, name: 'Client A', loyaltyPoints: 100 } },
  product:       { p1: { id: 'p1', tenantId: OWNER, name: 'Produit A', stockQty: 10 } },
  sale:          { s1: { id: 's1', tenantId: OWNER, total: 5000, status: 'completed', customerId: null, items: [] } },
  stockTransfer: { t1: { id: 't1', fromTenantId: OWNER, toTenantId: OTHER_DEST, productId: 'p1', quantity: 5, status: 'pending', product: { id: 'p1', name: 'Produit A', sku: 'PRD-0001' } } },
  tenant:        { A: { id: 'A', name: 'Boutique A', notifEmailPayroll: false, users: [] } },
}

const p2025 = () => { const e: any = new Error('Record not found'); e.code = 'P2025'; return e }
// tenantId présent dans le where ET != propriétaire → aucun match
const scopedOut = (where: any, rec: any) =>
  !rec || (where?.tenantId !== undefined && where.tenantId !== rec.tenantId)

function model(store: Record<string, any>) {
  return {
    findFirst:  vi.fn(async ({ where }: any) => { const r = store[where.id]; return scopedOut(where, r) ? null : r }),
    // findUnique ne peut filtrer que par clé unique (pas tenantId) → renvoie le record tel quel
    findUnique: vi.fn(async ({ where }: any) => store[where.id] ?? null),
    update:     vi.fn(async ({ where }: any) => { const r = store[where.id]; if (scopedOut(where, r)) throw p2025(); return r }),
    updateMany: vi.fn(async ({ where }: any) => { const r = store[where.id]; return { count: scopedOut(where, r) ? 0 : 1 } }),
    create:     vi.fn(async () => ({ id: 'new' })),
    count:      vi.fn(async () => 0),
    findMany:   vi.fn(async () => []),
  }
}

const { db, spies } = vi.hoisted(() => ({ db: {} as any, spies: {} as any }))

vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { userId: 'uB', role: currentRole, tenantId: currentTenant }; req.tenantId = currentTenant },
}))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../services/whatsappSend', () => ({ sendSaleWhatsApp: vi.fn(), fmtMoney: (n: number) => String(n), localeOf: () => 'fr-FR' }))
vi.mock('../services/pushService', () => ({ sendTransferConfirmed: vi.fn(), sendTransferCancelled: vi.fn(), default: {} }))
vi.mock('../lib/invoicePdf', () => ({ buildInvoicePdf: vi.fn(), nextInvoiceNumber: vi.fn() }))
vi.mock('../services/payrollReport', () => ({ buildPayrollReport: vi.fn(), deliverPayrollReport: vi.fn() }))

import { saleRoutes } from '../routes/sales'
import { customerRoutes } from '../routes/customers'
import { productRoutes } from '../routes/products'
import { stockTransferRoutes } from '../routes/stockTransfers'
import { payrollRoutes } from '../routes/payroll'

async function buildApp() {
  // (Re)construit le mock db à neuf pour compter les mutations par test.
  db.customer = model(STORE.customer)
  db.product = model(STORE.product)
  db.sale = model(STORE.sale)
  db.stockTransfer = model(STORE.stockTransfer)
  db.tenant = model(STORE.tenant)
  db.loyaltyTransaction = model({})
  db.auditLog = model({})
  db.$transaction = async (fn: any) => (typeof fn === 'function' ? fn(db) : Promise.all(fn))
  spies.db = db

  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body: string, done) => done(null, body ? JSON.parse(body) : {}))
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    if (error?.code === 'P2025') return reply.code(404).send({ error: 'Ressource introuvable' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(saleRoutes)
  await app.register(customerRoutes)
  await app.register(productRoutes)
  await app.register(stockTransferRoutes)
  await app.register(payrollRoutes)
  await app.ready()
  return app
}

// Aucune écriture ne doit avoir touché un modèle donné.
function assertNoMutation(mdl: string) {
  expect(spies.db[mdl].update).not.toHaveBeenCalled()
  expect(spies.db[mdl].updateMany).not.toHaveBeenCalled()
  expect(spies.db[mdl].create).not.toHaveBeenCalled()
}

beforeEach(() => { vi.clearAllMocks(); currentTenant = 'B'; currentRole = 'ADMIN' })

describe("Isolation cross-tenant — tenant B ne peut pas atteindre les ressources de tenant A", () => {
  it('sales refund /:id → 404 (aucune mutation)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales/s1/refund', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ reason: 'test' }) })
    expect(res.statusCode).toBe(404)
    assertNoMutation('sale')
  })

  it('sales invoice /:id → 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sales/s1/invoice' })
    expect(res.statusCode).toBe(404)
  })

  it('customer GET /:id → 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1' })
    expect(res.statusCode).toBe(404)
  })

  it('customer PUT /:id → 404 (P2025, aucune mutation effective)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/customers/c1', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ name: 'Piraté' }) })
    expect(res.statusCode).toBe(404)
  })

  it('customer DELETE /:id → 404 (aucune mutation)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/customers/c1' })
    expect(res.statusCode).toBe(404)
    assertNoMutation('customer')
  })

  it('customer loyalty GET /:id/loyalty → 404', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1/loyalty' })
    expect(res.statusCode).toBe(404)
  })

  it('customer loyalty POST /:id/loyalty → 404 (aucun crédit de points)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/customers/c1/loyalty', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ points: 500 }) })
    expect(res.statusCode).toBe(404)
    assertNoMutation('customer')
  })

  it('product PUT /:id → 404 (P2025)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ sellPrice: 1 }) })
    expect(res.statusCode).toBe(404)
  })

  it('product DELETE /:id → 404 (aucune mutation)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/products/p1' })
    expect(res.statusCode).toBe(404)
    assertNoMutation('product')
  })

  it('W1 — stockTransfer confirm par un tiers → 404 uniforme (aucune mutation)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/confirm' })
    expect(res.statusCode).toBe(404)
    assertNoMutation('stockTransfer')
    assertNoMutation('product')
  })

  it('W1 — stockTransfer cancel par un tiers → 404 uniforme', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/cancel' })
    expect(res.statusCode).toBe(404)
    assertNoMutation('stockTransfer')
  })

  it('payroll — un ADMIN cible un autre tenant → 403 (garde cross-tenant)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/admin/payroll-report/run', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ tenantId: OWNER, dryRun: true }) })
    expect(res.statusCode).toBe(403)
  })
})

describe('Contrôle positif — le propriétaire (tenant A) réussit (le mock ne renvoie pas 404 partout)', () => {
  it('customer GET /:id par tenant A → 200', async () => {
    currentTenant = OWNER
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1' })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe('c1')
  })

  it('sales invoice par tenant A → dépasse le check tenant (pas 404 « Vente introuvable »)', async () => {
    currentTenant = OWNER
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/sales/s1/invoice' })
    // La vente est trouvée (scope OK) ; un éventuel 404 « Boutique introuvable » viendrait après,
    // mais tenant A existe dans le store → la génération de facture est atteinte.
    expect(res.statusCode).not.toBe(404)
  })
})
