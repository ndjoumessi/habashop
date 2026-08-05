import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * `purchasesPerMonth` — fréquence d'achat dérivée des ventes rattachées (#215).
 *
 * Le front l'écrivait `0` en dur : la fiche d'un grossiste annonçait « 0 commandes »
 * au-dessus de ses 19 achats. Ce verrou garde la propriété qui compte — le nombre vient
 * des VENTES, il n'est ni inventé ni figé.
 *
 * ⚠️ Le mock APPLIQUE le `where` du groupBy (fenêtre, statut, tenant, liste d'ids) : un
 * mock qui rendrait un agrégat figé resterait vert si le handler cessait de fenêtrer.
 */
type SaleRow = { tenantId: string; customerId: string | null; createdAt: Date; status: string }
type GroupByArgs = {
  where: {
    tenantId?: string
    customerId?: { in: string[] }
    createdAt?: { gte: Date }
    status?: { not: string }
  }
}
type TestRequest = { user?: { role: string; tenantId: string; userId: string }; tenantId?: string; headers: Record<string, string | undefined> }
type CustomerOut = { id: string; name: string; purchasesPerMonth: number }

const DAY = 86_400_000
const now = Date.now()
/** 3 clients : un régulier (12 ventes dans la fenêtre), un dont tout est HORS fenêtre,
 *  un sans aucune vente. Plus une vente remboursée et une d'un autre tenant. */
const SALES: SaleRow[] = [
  ...Array.from({ length: 12 }, (_, k) => ({ tenantId: 'T1', customerId: 'c1', createdAt: new Date(now - (k + 1) * 5 * DAY), status: 'completed' })),
  { tenantId: 'T1', customerId: 'c1', createdAt: new Date(now - 2 * DAY), status: 'refunded' },   // ne compte pas
  ...Array.from({ length: 30 }, (_, k) => ({ tenantId: 'T1', customerId: 'c2', createdAt: new Date(now - (200 + k) * DAY), status: 'completed' })), // hors fenêtre
  { tenantId: 'T2', customerId: 'c1', createdAt: new Date(now - DAY), status: 'completed' },      // autre tenant
]
const CUSTOMERS = [
  { id: 'c1', tenantId: 'T1', name: 'Régulier', deletedAt: null, loyaltyPoints: 0, totalRevenue: 0, createdAt: new Date(0), updatedAt: new Date(0) },
  { id: 'c2', tenantId: 'T1', name: 'Parti', deletedAt: null, loyaltyPoints: 0, totalRevenue: 0, createdAt: new Date(0), updatedAt: new Date(0) },
  { id: 'c3', tenantId: 'T1', name: 'Jamais venu', deletedAt: null, loyaltyPoints: 0, totalRevenue: 0, createdAt: new Date(0), updatedAt: new Date(0) },
]

const { db, groupBy } = vi.hoisted(() => {
  const groupBy = vi.fn()
  return {
    groupBy,
    db: {
      customer: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      tenant: { findUnique: vi.fn() },
      loyaltyTransaction: { findMany: vi.fn() },
      auditLog: { create: vi.fn() },
      sale: { findMany: vi.fn(), groupBy },
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
  db.customer.findMany.mockImplementation(({ where }: { where: { tenantId?: string } }) =>
    Promise.resolve(CUSTOMERS.filter(c => where.tenantId === undefined || c.tenantId === where.tenantId)))
  db.customer.findFirst.mockImplementation(({ where }: { where: { id: string; tenantId?: string } }) =>
    Promise.resolve(CUSTOMERS.find(c => c.id === where.id && (where.tenantId === undefined || c.tenantId === where.tenantId)) ?? null))
  groupBy.mockImplementation(({ where }: GroupByArgs) => {
    const rows = SALES.filter(s =>
      (where.tenantId === undefined || s.tenantId === where.tenantId) &&
      (where.customerId?.in === undefined || (s.customerId !== null && where.customerId.in.includes(s.customerId))) &&
      (where.createdAt?.gte === undefined || s.createdAt >= where.createdAt.gte) &&
      (where.status?.not === undefined || s.status !== where.status.not))
    const byCust = new Map<string, number>()
    for (const s of rows) if (s.customerId) byCust.set(s.customerId, (byCust.get(s.customerId) ?? 0) + 1)
    return Promise.resolve([...byCust].map(([customerId, n]) => ({ customerId, _count: { _all: n } })))
  })
})

const list = async (tenant = 'T1'): Promise<CustomerOut[]> => {
  const app = await buildApp()
  return (await app.inject({ method: 'GET', url: '/api/customers', headers: H(tenant) })).json()
}

describe('GET /api/customers — purchasesPerMonth', () => {
  it('dérive la fréquence des VENTES, jamais un 0 par défaut', async () => {
    const byId = Object.fromEntries((await list()).map(c => [c.id, c.purchasesPerMonth]))
    // 12 ventes sur une fenêtre de 90 j = 3 mois → 4,0 par mois.
    expect(byId.c1).toBe(4)
  })

  it('client SANS vente → 0, mais un zéro CONSTATÉ', async () => {
    const byId = Object.fromEntries((await list()).map(c => [c.id, c.purchasesPerMonth]))
    expect(byId.c3).toBe(0)
  })

  it('⚠️ le taux DÉCROÎT : un client parti retombe à 0 malgré 30 achats passés', async () => {
    const byId = Object.fromEntries((await list()).map(c => [c.id, c.purchasesPerMonth]))
    // C'est ce qui donne son sens au KPI « Rétention » : une moyenne de vie afficherait
    // encore ~10/mois pour quelqu'un qui n'est pas revenu depuis 7 mois.
    expect(byId.c2).toBe(0)
  })

  it('fenêtre GLISSANTE de 90 jours, et ventes remboursées exclues', async () => {
    await list()
    const arg = groupBy.mock.calls[0][0] as GroupByArgs
    const ageJours = (Date.now() - arg.where.createdAt!.gte.getTime()) / DAY
    expect(Math.round(ageJours)).toBe(90)
    expect(arg.where.status).toEqual({ not: 'refunded' })
    // Une vente remboursée de c1 existe dans la fixture : sans l'exclusion, c1 vaudrait 4,3.
    const byId = Object.fromEntries((await list()).map(c => [c.id, c.purchasesPerMonth]))
    expect(byId.c1).toBe(4)
  })

  it('scope tenant : les ventes d’un autre tenant ne gonflent pas la fréquence', async () => {
    await list()
    expect((groupBy.mock.calls[0][0] as GroupByArgs).where.tenantId).toBe('T1')
  })

  it('une DÉCIMALE est conservée (0,7 ≠ 1 pour un grossiste trimestriel)', async () => {
    // 2 ventes / 3 mois = 0,666… → 0,7 (et surtout pas 1, qui gonflerait de 43 %).
    groupBy.mockResolvedValueOnce([{ customerId: 'c1', _count: { _all: 2 } }])
    const byId = Object.fromEntries((await list()).map(c => [c.id, c.purchasesPerMonth]))
    expect(byId.c1).toBe(0.7)
  })

  it('le détail d’un client porte aussi la fréquence (pas de 0 par cette porte)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/customers/c1', headers: H('T1') })
    expect(res.statusCode).toBe(200)
    expect(res.json().purchasesPerMonth).toBe(4)
  })

  it('aucune requête d’agrégat si le tenant n’a aucun client', async () => {
    db.customer.findMany.mockResolvedValueOnce([])
    const app = await buildApp()
    expect((await app.inject({ method: 'GET', url: '/api/customers', headers: H('T1') })).json()).toEqual([])
    expect(groupBy).not.toHaveBeenCalled()
  })
})
