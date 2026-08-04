import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * `GET /api/customers/:id/sales` — l'endpoint qui manquait (#214) : la donnée existait
 * (`Sale.customerId`), rien ne la servait, et les tables « Historique des achats » du
 * front affichaient donc « aucun achat » à des clients qui en avaient.
 *
 * ⚠️ Le mock APPLIQUE le `where` reçu (il ne rend pas une liste figée). Un mock qui
 * ignore ses arguments resterait VERT si le handler cessait d'envoyer `customerId` ou
 * `tenantId` — il décrirait un monde qui n'existe pas (cf. § Tests du guide).
 */
/** Formes RÉELLEMENT observées par ce test — typées plutôt qu'`any` : le cliquet lint
 *  backend (`--max-warnings`) n'accepte aucun nouvel avertissement, et un `any` ici
 *  masquerait justement le `where` qu'on veut inspecter. */
type CustomerWhere = { id: string; tenantId?: string }
type SaleWhere = { customerId?: string; tenantId?: string; status?: string | { not: string } }
type SaleFindManyArgs = { where: SaleWhere; orderBy?: { createdAt?: 'asc' | 'desc' }; take?: number }
type TestRequest = { user?: { role: string; tenantId: string; userId: string }; tenantId?: string; headers: Record<string, string | undefined> }
/** Ligne renvoyée par `GET /api/customers/:id/sales`. */
type SaleRow = { id: string; total: number; createdAt: string; status: string; invoiceNumber: string | null; items: number }

const SALES = [
  { id: 's-old', tenantId: 'T1', customerId: 'c1', total: 4200, createdAt: new Date('2026-01-05T10:00:00Z'), status: 'completed', invoiceNumber: null,            _count: { items: 2 } },
  { id: 's-new', tenantId: 'T1', customerId: 'c1', total: 18750, createdAt: new Date('2026-08-02T10:00:00Z'), status: 'completed', invoiceNumber: 'FAC-2026-00042', _count: { items: 4 } },
  { id: 's-ref', tenantId: 'T1', customerId: 'c1', total: 9900, createdAt: new Date('2026-06-01T10:00:00Z'), status: 'refunded',  invoiceNumber: null,            _count: { items: 1 } },
  { id: 's-other-cust', tenantId: 'T1', customerId: 'c2', total: 500, createdAt: new Date('2026-08-03T10:00:00Z'), status: 'completed', invoiceNumber: null, _count: { items: 1 } },
  { id: 's-other-tenant', tenantId: 'T2', customerId: 'c1', total: 777, createdAt: new Date('2026-08-03T10:00:00Z'), status: 'completed', invoiceNumber: null, _count: { items: 9 } },
]
const CUSTOMERS = [
  { id: 'c1', tenantId: 'T1', name: 'Awa' },
  { id: 'c2', tenantId: 'T1', name: 'Moussa' },
  { id: 'c9', tenantId: 'T2', name: "Client d'un autre tenant" },
]

const { db, saleFindMany } = vi.hoisted(() => {
  const saleFindMany = vi.fn()
  return {
    saleFindMany,
    db: {
      customer: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      tenant: { findUnique: vi.fn() },
      loyaltyTransaction: { findMany: vi.fn() },
      auditLog: { create: vi.fn() },
      sale: { findMany: saleFindMany },
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
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))

import { customerRoutes } from '../routes/customers'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(customerRoutes)
  await app.ready()
  return app
}
const H = (tenant = 'T1') => ({ 'x-test-tenant': tenant })

beforeEach(() => {
  vi.clearAllMocks()
  // Filtres RÉELLEMENT appliqués — c'est ce qui rend les sabotages détectables.
  db.customer.findFirst.mockImplementation(({ where }: { where: CustomerWhere }) =>
    Promise.resolve(CUSTOMERS.find(c => c.id === where.id && (where.tenantId === undefined || c.tenantId === where.tenantId)) ?? null))
  saleFindMany.mockImplementation(({ where, orderBy, take }: SaleFindManyArgs) => {
    let rows = SALES.filter(s =>
      (where.customerId === undefined || s.customerId === where.customerId) &&
      (where.tenantId === undefined || s.tenantId === where.tenantId) &&
      // `status` est honoré pour que « exclure les remboursées » soit un sabotage DÉTECTABLE
      // et non un filtre que le mock avalerait en silence.
      (where.status === undefined
        || (typeof where.status === 'string' ? s.status === where.status : s.status !== where.status.not)))
    if (orderBy?.createdAt === 'desc') rows = [...rows].sort((a, b) => +b.createdAt - +a.createdAt)
    return Promise.resolve(typeof take === 'number' ? rows.slice(0, take) : rows)
  })
})

describe('GET /api/customers/:id/sales', () => {
  it('renvoie les ventes DU client, plus récentes en premier', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1/sales', headers: H('T1') })
    expect(res.statusCode).toBe(200)
    const body: SaleRow[] = res.json()
    expect(body.map((s: SaleRow) => s.id)).toEqual(['s-new', 's-ref', 's-old'])
  })

  it('expose le nombre de LIGNES (_count.items) et le numéro de facture', async () => {
    const app = await buildApp()
    const body: SaleRow[] = (await app.inject({ method: 'GET', url: '/api/customers/c1/sales', headers: H('T1') })).json()
    const newest = body.find((s: SaleRow) => s.id === 's-new')
    expect(newest).toMatchObject({ items: 4, total: 18750, invoiceNumber: 'FAC-2026-00042', status: 'completed' })
    // Facture non encore demandée → null explicite (le front retombe sur la réf courte).
    expect(body.find((s: SaleRow) => s.id === 's-old')?.invoiceNumber).toBeNull()
    // `_count` est une forme Prisma : elle ne doit PAS fuir dans la réponse.
    expect(newest).not.toHaveProperty('_count')
  })

  it("n'inclut PAS les ventes d'un AUTRE client du même tenant", async () => {
    const app = await buildApp()
    const body: SaleRow[] = (await app.inject({ method: 'GET', url: '/api/customers/c1/sales', headers: H('T1') })).json()
    expect(body.map((s: SaleRow) => s.id)).not.toContain('s-other-cust')
    expect(saleFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'c1', tenantId: 'T1' },
    }))
  })

  it('client d’un AUTRE tenant → 404, et AUCUNE requête de ventes émise', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c9/sales', headers: H('T1') })
    expect(res.statusCode).toBe(404)
    // Sans le garde, on renverrait [] — indiscernable d'« aucun achat » : un oracle muet.
    expect(saleFindMany).not.toHaveBeenCalled()
  })

  it('client inexistant → 404', async () => {
    const app = await buildApp()
    expect((await app.inject({ method: 'GET', url: '/api/customers/nope/sales', headers: H('T1') })).statusCode).toBe(404)
  })

  it('les ventes REMBOURSÉES sont RENVOYÉES, avec leur statut', async () => {
    const app = await buildApp()
    const body: SaleRow[] = (await app.inject({ method: 'GET', url: '/api/customers/c1/sales', headers: H('T1') })).json()
    const refunded = body.find((s: SaleRow) => s.id === 's-ref')
    // Décision explicite : un historique raconte ce qui s'est passé. Les faire disparaître
    // effacerait un remboursement réel de la fiche client. Le front les MARQUE.
    expect(refunded).toBeTruthy()
    expect(refunded?.status).toBe('refunded')
  })

  it('plafonne à 50 lignes (même plafond que l’historique fidélité)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/customers/c1/sales', headers: H('T1') })
    expect(saleFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })
})
