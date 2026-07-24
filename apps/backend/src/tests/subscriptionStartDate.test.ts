import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

/**
 * Abonnements — date de début FONCTIONNELLE.
 *
 * Une date stockée mais ignorée par `GET /api/subscriptions/due` serait un faux
 * « prêt aujourd'hui » : le gérant verrait dans sa liste du jour un panier qui ne
 * démarre que le mois prochain. Ce fichier prouve que la colonne pilote vraiment
 * la liste — pas seulement qu'elle est écrite.
 *
 * Le mock Prisma APPLIQUE réellement le `where` (tenant, statut, jour, et la clause
 * `OR` de démarrage) sur un petit magasin : on assertionne donc sur le RÉSULTAT de la
 * route, pas sur la forme de l'objet passé à Prisma. Un filtre absent ferait remonter
 * l'abonnement futur et le test échouerait.
 */

const { db } = vi.hoisted(() => ({
  db: { subscription: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() }, customer: { findFirst: vi.fn() }, $transaction: vi.fn() },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: { user?: unknown; tenantId?: string }) => {
    req.user = { role: 'ADMIN', tenantId: 'MINE', userId: 'u1' }
    req.tenantId = 'MINE'
  },
}))

import { subscriptionRoutes, subscriptionStartedFilter } from '../routes/subscriptions'

// Mardi 2026-07-28, 10 h UTC → getUTCDay() === 2
const NOW = new Date('2026-07-28T10:00:00.000Z')

type Row = { id: string; tenantId: string; status: string; dayOfWeek: number; startDate: Date | null }

const ROWS: Row[] = [
  { id: 'no-date',   tenantId: 'MINE', status: 'active', dayOfWeek: 2, startDate: null },
  { id: 'past',      tenantId: 'MINE', status: 'active', dayOfWeek: 2, startDate: new Date('2026-06-01T00:00:00.000Z') },
  // Démarre AUJOURD'HUI à 23 h UTC : plus tard que `now`, mais le même jour calendaire
  // → doit être dû (borne inclusive au jour, pas à l'instant).
  { id: 'today-late', tenantId: 'MINE', status: 'active', dayOfWeek: 2, startDate: new Date('2026-07-28T23:00:00.000Z') },
  { id: 'future',    tenantId: 'MINE', status: 'active', dayOfWeek: 2, startDate: new Date('2026-08-25T00:00:00.000Z') },
  { id: 'other-day', tenantId: 'MINE', status: 'active', dayOfWeek: 5, startDate: null },
  { id: 'paused',    tenantId: 'MINE', status: 'paused', dayOfWeek: 2, startDate: null },
  { id: 'other-ten', tenantId: 'AUTRE', status: 'active', dayOfWeek: 2, startDate: null },
]

type StartClause = { startDate: null } | { startDate: { lt: Date } }
type DueWhere = { tenantId?: string; status?: string; dayOfWeek?: number; OR?: StartClause[] }

/** Applique le `where` de la route (y compris la clause OR de démarrage). */
function applyWhere(where: DueWhere, rows: Row[]): Row[] {
  return rows.filter((r) => {
    if (where.tenantId !== undefined && r.tenantId !== where.tenantId) return false
    if (where.status !== undefined && r.status !== where.status) return false
    if (where.dayOfWeek !== undefined && r.dayOfWeek !== where.dayOfWeek) return false
    if (Array.isArray(where.OR)) {
      const ok = where.OR.some((c) => {
        if (c.startDate === null) return r.startDate === null
        return r.startDate !== null && r.startDate.getTime() < c.startDate.lt.getTime()
      })
      if (!ok) return false
    }
    return true
  })
}

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    const e = error as { statusCode?: number; message?: string }
    return reply.code(e.statusCode ?? 500).send({ error: e.message ?? 'Erreur serveur' })
  })
  await app.register(subscriptionRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  db.subscription.findMany.mockImplementation(async ({ where }: { where: DueWhere }) => applyWhere(where, ROWS))
})

describe('GET /api/subscriptions/due — la date de début pilote la liste du jour', () => {
  // Horloge figée UNIQUEMENT ici : la route lit `new Date()` en interne. Les tests
  // d'écriture plus bas gardent l'horloge réelle (les faux timers gèlent `app.inject`).
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(NOW) })
  afterEach(() => vi.useRealTimers())

  it("un abonnement à date de début FUTURE n'est PAS dû aujourd'hui", async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/subscriptions/due' })
    expect(res.statusCode).toBe(200)
    const ids = (JSON.parse(res.body) as Row[]).map((r) => r.id)
    expect(ids).not.toContain('future')
  })

  it('sans date de début (historique) et date passée → dus', async () => {
    const app = await buildApp()
    const ids = (JSON.parse((await app.inject({ method: 'GET', url: '/api/subscriptions/due' })).body) as Row[]).map((r) => r.id)
    expect(ids).toContain('no-date')
    expect(ids).toContain('past')
  })

  it('démarrage le jour même, plus tard dans la journée → dû (jour calendaire UTC inclusif)', async () => {
    const app = await buildApp()
    const ids = (JSON.parse((await app.inject({ method: 'GET', url: '/api/subscriptions/due' })).body) as Row[]).map((r) => r.id)
    expect(ids).toContain('today-late')
  })

  it('les autres filtres restent intacts (jour, statut, tenant)', async () => {
    const app = await buildApp()
    const ids = (JSON.parse((await app.inject({ method: 'GET', url: '/api/subscriptions/due' })).body) as Row[]).map((r) => r.id)
    expect(ids.sort()).toEqual(['no-date', 'past', 'today-late'])
  })
})

describe('subscriptionStartedFilter — fonction pure', () => {
  it('la borne est minuit UTC du lendemain (inclusif au jour calendaire)', () => {
    const clause = subscriptionStartedFilter(NOW)
    expect(clause[0]).toEqual({ startDate: null })
    const lt = (clause[1] as { startDate: { lt: Date } }).startDate.lt
    expect(lt.toISOString()).toBe('2026-07-29T00:00:00.000Z')
  })

  it("n'appelle pas d'horloge interne (now injecté)", () => {
    const lt = (subscriptionStartedFilter(new Date('2026-01-31T22:00:00.000Z'))[1] as { startDate: { lt: Date } }).startDate.lt
    expect(lt.toISOString()).toBe('2026-02-01T00:00:00.000Z') // franchit le mois
  })

  /**
   * SABOTAGE VÉRIFIÉ (les deux sens) — un filtre naïf `startDate <= now` déclarerait
   * l'abonnement démarrant aujourd'hui à 23 h « pas encore commencé » et le retirerait
   * de la liste du jour. Le test prouve que notre borne, elle, l'inclut.
   */
  it('un filtre `<= now` (naïf) écarterait à tort un démarrage plus tard le même jour', () => {
    const startsToday = new Date('2026-07-28T23:00:00.000Z')
    expect(startsToday.getTime() <= NOW.getTime()).toBe(false)                    // le naïf échoue
    const lt = (subscriptionStartedFilter(NOW)[1] as { startDate: { lt: Date } }).startDate.lt
    expect(startsToday.getTime() < lt.getTime()).toBe(true)                       // le nôtre passe
  })
})

describe('écriture de startDate', () => {
  it('POST persiste la date ; absente → null (comportement historique)', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'c1' })
    db.subscription.create.mockResolvedValue({ id: 's1' })
    const app = await buildApp()

    const withDate = await app.inject({
      method: 'POST', url: '/api/subscriptions',
      payload: { customerId: 'c1', name: 'Panier hebdo', dayOfWeek: 2, startDate: '2026-08-04', items: [{ productId: 'p1', quantity: 2 }] },
    })
    expect(withDate.statusCode).toBe(201)
    expect(db.subscription.create.mock.calls[0][0].data.startDate).toEqual(new Date('2026-08-04'))

    await app.inject({
      method: 'POST', url: '/api/subscriptions',
      payload: { customerId: 'c1', name: 'Sans date', dayOfWeek: 2, items: [{ productId: 'p1', quantity: 1 }] },
    })
    expect(db.subscription.create.mock.calls[1][0].data.startDate).toBeNull()
  })

  it('PUT : champ absent → inchangé ; null explicite → effacé', async () => {
    db.subscription.findFirst.mockResolvedValue({ id: 's1', tenantId: 'MINE' })
    const update = vi.fn().mockResolvedValue({ id: 's1' })
    type TxStub = { subscription: { update: typeof update }; subscriptionItem: { deleteMany: () => void; createMany: () => void } }
    db.$transaction.mockImplementation(async (fn: (tx: TxStub) => Promise<unknown>) =>
      fn({ subscription: { update }, subscriptionItem: { deleteMany: vi.fn(), createMany: vi.fn() } }))
    const app = await buildApp()

    await app.inject({ method: 'PUT', url: '/api/subscriptions/s1', payload: { status: 'paused' } })
    expect(update.mock.calls[0][0].data).not.toHaveProperty('startDate')

    await app.inject({ method: 'PUT', url: '/api/subscriptions/s1', payload: { startDate: null } })
    expect(update.mock.calls[1][0].data.startDate).toBeNull()
  })
})
