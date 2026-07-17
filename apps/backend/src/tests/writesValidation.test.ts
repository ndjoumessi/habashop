import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

// Valide la couche zod des routes d'écriture (item 6, lot 4A) : fermeture du
// mass-assignment (strip des clés hors liste blanche) + validation create.
const { db } = vi.hoisted(() => ({
  db: {
    product:  { update: vi.fn(), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    supplier: { create: vi.fn() },
    purchaseOrder: { create: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'ADMIN', tenantId: 'MINE', userId: 'u1' }; req.tenantId = 'MINE' },
}))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../services/invoiceOcr', () => ({ analyzeInvoice: vi.fn(), ALLOWED_INVOICE_TYPES: [] }))

import { productRoutes } from '../routes/products'
import { supplierRoutes } from '../routes/suppliers'
import { orderRoutes } from '../routes/orders'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(productRoutes)
  await app.register(supplierRoutes)
  await app.register(orderRoutes)
  await app.ready()
  return app
}

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/products/:id — fermeture du mass-assignment', () => {
  it('un tenantId injecté dans le body est STRIP (jamais transmis à Prisma)', async () => {
    db.product.update.mockResolvedValue({ id: 'p1' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT', url: '/api/products/p1',
      payload: { name: 'Nouveau nom', tenantId: 'VICTIME', id: 'autre', createdAt: '2020-01-01' },
    })
    expect(res.statusCode).toBe(200)
    const dataArg = db.product.update.mock.calls[0][0].data
    // Champ légitime conservé…
    expect(dataArg.name).toBe('Nouveau nom')
    // …clés dangereuses supprimées par le schéma liste-blanche.
    expect(dataArg).not.toHaveProperty('tenantId')
    expect(dataArg).not.toHaveProperty('id')
    expect(dataArg).not.toHaveProperty('createdAt')
    // Le where reste scopé sur le tenant de l'appelant.
    expect(db.product.update.mock.calls[0][0].where).toEqual({ id: 'p1', tenantId: 'MINE' })
  })
})

describe('POST /api/suppliers — validation create', () => {
  it('nom manquant → 400 VALIDATION (avant Prisma)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/suppliers', payload: { phone: '77' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
    expect(db.supplier.create).not.toHaveBeenCalled()
  })

  it('tenantId injecté est strip, tenantId serveur imposé', async () => {
    db.supplier.create.mockResolvedValue({ id: 's1' })
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/suppliers', payload: { name: 'ACME', tenantId: 'VICTIME' } })
    const dataArg = db.supplier.create.mock.calls[0][0].data
    expect(dataArg.tenantId).toBe('MINE')          // imposé serveur
    expect(dataArg.name).toBe('ACME')
  })
})

describe('POST /api/orders — validation create', () => {
  it('items manquant → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/orders', payload: { supplierId: 's1' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('VALIDATION')
    expect(db.purchaseOrder.create).not.toHaveBeenCalled()
  })

  it('supplierId manquant → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/orders', payload: { items: [{ product: 'x', qty: 1, unitPrice: 100 }] } })
    expect(res.statusCode).toBe(400)
  })
})
