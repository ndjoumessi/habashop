import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ─── Mocks ───────────────────────────────────────────────────────────────────
const { db, authMock } = vi.hoisted(() => ({
  db: {
    userTenant: { findUnique: vi.fn() },
    product: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    stockTransfer: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    tenant: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  authMock: vi.fn(async (req: any) => { req.user = { userId: 'u1', role: 'MANAGER' }; req.tenantId = 'SRC' }),
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({ authenticate: authMock }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../services/pushService', () => ({
  sendTransferConfirmed: vi.fn().mockResolvedValue(undefined),
  sendTransferCancelled: vi.fn().mockResolvedValue(undefined),
}))

import { stockTransferRoutes } from '../routes/stockTransfers'

async function buildApp() {
  const app = Fastify()
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body: string, done) => done(null, body ? JSON.parse(body) : {}))
  await app.register(stockTransferRoutes)
  await app.ready()
  return app
}

// Helper : exécute le callback de transaction avec un tx = db (mocks partagés).
const runTx = async (fn: any) => fn(db)

const PRODUCT = { id: 'p1', tenantId: 'SRC', sku: 'PRD-0001', name: 'Riz 5kg', category: 'Épicerie', unit: 'sac', buyPrice: 3000, sellPrice: 4000, wholesalePrice: null, semiWholesalePrice: null, stockQty: 50, stockMin: 5, barcode: '123', taxRate: 18, emoji: '🍚', description: '' }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockImplementation(async (req: any) => { req.user = { userId: 'u1', role: 'MANAGER' }; req.tenantId = 'SRC' })
  db.$transaction.mockImplementation(runTx)
})

// ─── POST création ─────────────────────────────────────────────────────────────
describe('POST /api/stock/transfers', () => {
  beforeEach(() => {
    db.userTenant.findUnique.mockResolvedValue({ id: 'ut1' })       // user a accès à DEST
    db.product.findFirst.mockResolvedValue(PRODUCT)                 // produit source OK
    db.product.updateMany.mockResolvedValue({ count: 1 })          // décrément gardé OK
    db.stockTransfer.create.mockResolvedValue({ id: 't1', status: 'pending', quantity: 10 })
  })

  it('stock suffisant → 201 pending + stock source décrémenté', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/stock/transfers', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ toTenantId: 'DEST', productId: 'p1', quantity: 10 }) })
    expect(res.statusCode).toBe(201)
    expect(res.json().status).toBe('pending')
    expect(db.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'p1', tenantId: 'SRC', stockQty: { gte: 10 } }),
      data: { stockQty: { decrement: 10 } },
    }))
    expect(db.stockTransfer.create).toHaveBeenCalled()
  })

  it('stock insuffisant → 400 INSUFFICIENT_STOCK', async () => {
    db.product.findFirst.mockResolvedValue({ ...PRODUCT, stockQty: 3 })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/stock/transfers', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ toTenantId: 'DEST', productId: 'p1', quantity: 10 }) })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('INSUFFICIENT_STOCK')
    expect(db.stockTransfer.create).not.toHaveBeenCalled()
  })

  it('transfert vers soi-même → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/stock/transfers', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ toTenantId: 'SRC', productId: 'p1', quantity: 10 }) })
    expect(res.statusCode).toBe(400)
  })

  it('boutique destination non autorisée → 403', async () => {
    db.userTenant.findUnique.mockResolvedValue(null) // pas d'accès à DEST
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/stock/transfers', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ toTenantId: 'DEST', productId: 'p1', quantity: 10 }) })
    expect(res.statusCode).toBe(403)
  })

  it('rôle CASHIER → 403', async () => {
    authMock.mockImplementationOnce(async (req: any) => { req.user = { userId: 'u1', role: 'CASHIER' }; req.tenantId = 'SRC' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/stock/transfers', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ toTenantId: 'DEST', productId: 'p1', quantity: 10 }) })
    expect(res.statusCode).toBe(403)
  })
})

// ─── PATCH confirm ─────────────────────────────────────────────────────────────
describe('PATCH /api/stock/transfers/:id/confirm', () => {
  const TRANSFER = { id: 't1', fromTenantId: 'SRC', toTenantId: 'DEST', productId: 'p1', quantity: 10, status: 'pending', product: PRODUCT }

  it('boutique destination → completed + stock dest incrémenté (produit existant)', async () => {
    authMock.mockImplementation(async (req: any) => { req.user = { userId: 'u2', role: 'MANAGER' }; req.tenantId = 'DEST' })
    db.stockTransfer.findUnique.mockResolvedValue(TRANSFER)
    db.product.findFirst.mockResolvedValue({ id: 'pDest', tenantId: 'DEST', sku: 'PRD-0001' }) // existe à dest
    db.tenant.findUnique.mockResolvedValue({ name: 'Boutique DEST' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/confirm' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('completed')
    expect(db.stockTransfer.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed', confirmedBy: 'u2' }) }))
    expect(db.product.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pDest' }, data: expect.objectContaining({ stockQty: { increment: 10 } }) }))
    expect(db.product.create).not.toHaveBeenCalled()
  })

  it('produit absent à destination → création (copie source)', async () => {
    authMock.mockImplementation(async (req: any) => { req.user = { userId: 'u2', role: 'MANAGER' }; req.tenantId = 'DEST' })
    db.stockTransfer.findUnique.mockResolvedValue(TRANSFER)
    db.product.findFirst.mockResolvedValue(null) // ni SKU ni barcode
    db.tenant.findUnique.mockResolvedValue({ name: 'Boutique DEST' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/confirm' })
    expect(res.statusCode).toBe(200)
    expect(db.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'DEST', sku: 'PRD-0001', stockQty: 10 }) }))
  })

  it('mauvaise boutique (source confirme) → 403', async () => {
    authMock.mockImplementation(async (req: any) => { req.user = { userId: 'u1', role: 'MANAGER' }; req.tenantId = 'SRC' })
    db.stockTransfer.findUnique.mockResolvedValue(TRANSFER)
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/confirm' })
    expect(res.statusCode).toBe(403)
  })

  it('transfert déjà traité → 400', async () => {
    authMock.mockImplementation(async (req: any) => { req.user = { userId: 'u2', role: 'MANAGER' }; req.tenantId = 'DEST' })
    db.stockTransfer.findUnique.mockResolvedValue({ ...TRANSFER, status: 'completed' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/confirm' })
    expect(res.statusCode).toBe(400)
  })
})

// ─── PATCH cancel ──────────────────────────────────────────────────────────────
describe('PATCH /api/stock/transfers/:id/cancel', () => {
  const TRANSFER = { id: 't1', fromTenantId: 'SRC', toTenantId: 'DEST', productId: 'p1', quantity: 10, status: 'pending', product: { name: 'Riz 5kg' } }

  it('annulation par la source → cancelled + stock source restitué', async () => {
    db.stockTransfer.findUnique.mockResolvedValue(TRANSFER)
    db.tenant.findUnique.mockResolvedValue({ name: 'Boutique SRC' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/cancel' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('cancelled')
    expect(db.product.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1' }, data: { stockQty: { increment: 10 } } }))
  })

  it('annulation par une boutique tierce → 403', async () => {
    authMock.mockImplementation(async (req: any) => { req.user = { userId: 'u9', role: 'MANAGER' }; req.tenantId = 'OTHER' })
    db.stockTransfer.findUnique.mockResolvedValue(TRANSFER)
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/stock/transfers/t1/cancel' })
    expect(res.statusCode).toBe(403)
    expect(db.product.update).not.toHaveBeenCalled()
  })
})
