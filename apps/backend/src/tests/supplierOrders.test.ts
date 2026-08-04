import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * `GET /api/suppliers/:id/orders` — miroir fournisseur de l'historique client (#214) :
 * la donnée existait (`PurchaseOrder.supplierId`), rien ne la servait, et la table
 * « Historique commandes » lisait un `orders: []` codé en dur.
 *
 * ⚠️ Le mock APPLIQUE le `where` reçu. Un mock qui rend une liste figée resterait VERT
 * si le handler cessait d'envoyer `supplierId`, `tenantId` ou `deletedAt` — il décrirait
 * un monde qui n'existe pas.
 *
 * ⚠️ DIFFÉRENCE assumée avec le côté client : `PurchaseOrder` est en SOFT DELETE, donc
 * `deletedAt: null` est obligatoire ici. `Sale` ne l'est pas — le miroir n'est pas exact,
 * et c'est le modèle qui commande, pas la symétrie.
 */
type SupplierWhere = { id: string; tenantId?: string }
type OrderWhere = { supplierId?: string; tenantId?: string; deletedAt?: null | Date; status?: string }
type OrderFindManyArgs = { where: OrderWhere; orderBy?: { createdAt?: 'asc' | 'desc' }; take?: number }
type TestRequest = { user?: { role: string; tenantId: string; userId: string }; tenantId?: string; headers: Record<string, string | undefined> }
/** Ligne renvoyée par la route. */
type OrderRow = { id: string; ref: string; total: number; status: string; createdAt: string; expectedAt: string | null; items: number }

const ORDERS = [
  { id: 'o-old', tenantId: 'T1', supplierId: 'f1', ref: 'BC-2026-001', total: 42000, status: 'RECEIVED',   createdAt: new Date('2026-01-05T10:00:00Z'), expectedAt: new Date('2026-01-12T00:00:00Z'), deletedAt: null,             _count: { items: 3 } },
  { id: 'o-new', tenantId: 'T1', supplierId: 'f1', ref: 'BC-2026-014', total: 128500, status: 'IN_TRANSIT', createdAt: new Date('2026-08-02T10:00:00Z'), expectedAt: null,                              deletedAt: null,             _count: { items: 5 } },
  { id: 'o-del', tenantId: 'T1', supplierId: 'f1', ref: 'BC-2026-009', total: 9900, status: 'DRAFT',       createdAt: new Date('2026-06-01T10:00:00Z'), expectedAt: null, deletedAt: new Date('2026-06-02T00:00:00Z'), _count: { items: 1 } },
  { id: 'o-other-sup', tenantId: 'T1', supplierId: 'f2', ref: 'BC-X', total: 500, status: 'SENT', createdAt: new Date('2026-08-03T10:00:00Z'), expectedAt: null, deletedAt: null, _count: { items: 1 } },
  { id: 'o-other-tenant', tenantId: 'T2', supplierId: 'f1', ref: 'BC-Y', total: 777, status: 'SENT', createdAt: new Date('2026-08-03T10:00:00Z'), expectedAt: null, deletedAt: null, _count: { items: 9 } },
]
const SUPPLIERS = [
  { id: 'f1', tenantId: 'T1', name: 'SONACO' },
  { id: 'f2', tenantId: 'T1', name: 'Patisen' },
  { id: 'f9', tenantId: 'T2', name: "Fournisseur d'un autre tenant" },
]

const { db, orderFindMany } = vi.hoisted(() => {
  const orderFindMany = vi.fn()
  return {
    orderFindMany,
    db: {
      supplier: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      purchaseOrder: { findMany: orderFindMany },
      auditLog: { create: vi.fn() },
      $transaction: (fn: (tx: Record<string, unknown>) => unknown) => fn({}),
    },
  }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: TestRequest) => {
    req.user = { role: 'ADMIN', tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: 'u1' }
    req.tenantId = req.user.tenantId
  },
}))
vi.mock('../middleware/demoTenant', () => ({ blockDemoTenant: async () => {} }))
vi.mock('../middleware/costQuota', () => ({ costQuota: () => async () => {} }))

import { supplierRoutes } from '../routes/suppliers'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(supplierRoutes)
  await app.ready()
  return app
}
const H = (tenant = 'T1') => ({ 'x-test-tenant': tenant })

beforeEach(() => {
  vi.clearAllMocks()
  db.supplier.findFirst.mockImplementation(({ where }: { where: SupplierWhere }) =>
    Promise.resolve(SUPPLIERS.find(s => s.id === where.id && (where.tenantId === undefined || s.tenantId === where.tenantId)) ?? null))
  orderFindMany.mockImplementation(({ where, orderBy, take }: OrderFindManyArgs) => {
    let rows = ORDERS.filter(o =>
      (where.supplierId === undefined || o.supplierId === where.supplierId) &&
      (where.tenantId === undefined || o.tenantId === where.tenantId) &&
      // `deletedAt` honoré : sans ça, retirer le filtre du handler serait INVISIBLE.
      (where.deletedAt === undefined || o.deletedAt === where.deletedAt))
    if (orderBy?.createdAt === 'desc') rows = [...rows].sort((a, b) => +b.createdAt - +a.createdAt)
    return Promise.resolve(typeof take === 'number' ? rows.slice(0, take) : rows)
  })
})

describe('GET /api/suppliers/:id/orders', () => {
  it('renvoie les commandes DU fournisseur, plus récentes en premier', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/suppliers/f1/orders', headers: H('T1') })
    expect(res.statusCode).toBe(200)
    const body: OrderRow[] = res.json()
    expect(body.map((o: OrderRow) => o.id)).toEqual(['o-new', 'o-old'])
  })

  it('expose ref, statut BRUT du fil, nombre de LIGNES et échéance', async () => {
    const app = await buildApp()
    const body: OrderRow[] = (await app.inject({ method: 'GET', url: '/api/suppliers/f1/orders', headers: H('T1') })).json()
    const newest = body.find((o: OrderRow) => o.id === 'o-new')
    // Le statut part en ANGLAIS : c'est le front qui traduit (API_TO_LOCAL_STATUS,
    // source unique). Traduire ici créerait une 2ᵉ table qui divergerait.
    expect(newest).toMatchObject({ ref: 'BC-2026-014', status: 'IN_TRANSIT', items: 5, total: 128500 })
    expect(newest?.expectedAt).toBeNull()
    expect(newest).not.toHaveProperty('_count')
  })

  it('⚠️ EXCLUT les commandes soft-supprimées (PurchaseOrder.deletedAt)', async () => {
    const app = await buildApp()
    const body: OrderRow[] = (await app.inject({ method: 'GET', url: '/api/suppliers/f1/orders', headers: H('T1') })).json()
    // Une commande supprimée ne doit pas ressusciter dans l'historique.
    expect(body.map((o: OrderRow) => o.id)).not.toContain('o-del')
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { supplierId: 'f1', tenantId: 'T1', deletedAt: null },
    }))
  })

  it("n'inclut PAS les commandes d'un AUTRE fournisseur du même tenant", async () => {
    const app = await buildApp()
    const body: OrderRow[] = (await app.inject({ method: 'GET', url: '/api/suppliers/f1/orders', headers: H('T1') })).json()
    expect(body.map((o: OrderRow) => o.id)).not.toContain('o-other-sup')
  })

  it('fournisseur d’un AUTRE tenant → 404, et AUCUNE requête de commandes émise', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/suppliers/f9/orders', headers: H('T1') })
    expect(res.statusCode).toBe(404)
    // Sans le garde, on renverrait [] — indiscernable d'« aucune commande ».
    expect(orderFindMany).not.toHaveBeenCalled()
  })

  it('fournisseur inexistant → 404', async () => {
    const app = await buildApp()
    expect((await app.inject({ method: 'GET', url: '/api/suppliers/nope/orders', headers: H('T1') })).statusCode).toBe(404)
  })

  it('plafonne à 50 lignes (même plafond que l’historique client)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/suppliers/f1/orders', headers: H('T1') })
    expect(orderFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })
})
