import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * Écriture du palier client (#215) — ce que la BASE reçoit réellement.
 *
 * Le zod disait `type: z.string()`, donc les deux formulaires du front rangeaient le
 * LIBELLÉ français (« Grossiste ») dans une colonne dont le défaut est `'retail'`.
 * Ce verrou porte sur le `data` passé à Prisma : c'est là que la divergence se jouait,
 * pas dans le code de retour.
 */
type TestRequest = { user?: { role: string; tenantId: string; userId: string }; tenantId?: string; headers: Record<string, string | undefined> }

const { db } = vi.hoisted(() => ({
  db: {
    customer: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c-new', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data })),
    },
    tenant: { findUnique: vi.fn() },
    loyaltyTransaction: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    sale: { findMany: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
    $transaction: (fn: (tx: Record<string, unknown>) => unknown) => fn({}),
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: TestRequest) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
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
const typeWritten = (spy: { mock: { calls: { 0: { data: Record<string, unknown> } }[] } }) => spy.mock.calls[0][0].data.type

beforeEach(() => vi.clearAllMocks())

describe('POST /api/customers — palier normalisé', () => {
  it('le LIBELLÉ français est converti en enum avant d’atteindre la base', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/customers', payload: { name: 'Teranga', type: 'Grossiste' } })
    expect(res.statusCode).toBe(200)
    // Sans conversion, la base recevait « Grossiste » et le lecteur affichait « Détail ».
    expect(typeWritten(db.customer.create)).toBe('wholesale')
  })

  it('l’enum canonique passe inchangé', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/customers', payload: { name: 'X', type: 'semi-wholesale' } })
    expect(typeWritten(db.customer.create)).toBe('semi-wholesale')
  })

  it('type ABSENT → `retail` (défaut de colonne, rétro-compatible)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/customers', payload: { name: 'X' } })
    expect(typeWritten(db.customer.create)).toBe('retail')
  })

  it('⚠️ type IRRÉSOLVABLE → 400, et RIEN n’est écrit', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/customers', payload: { name: 'X', type: 'wholesaler' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('INVALID_CLIENT_TYPE')
    // Un repli silencieux sur `retail` rangerait un grossiste au détail, sans bruit.
    expect(db.customer.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/customers/:id — palier normalisé', () => {
  it('le libellé français est converti', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/customers/c1', payload: { name: 'X', type: 'Semi-gros' } })
    expect(res.statusCode).toBe(200)
    expect(typeWritten(db.customer.update)).toBe('semi-wholesale')
  })

  it('⚠️ type ABSENT reste `undefined` : modifier un téléphone ne réécrit pas le palier', async () => {
    const app = await buildApp()
    await app.inject({ method: 'PUT', url: '/api/customers/c1', payload: { phone: '+221770000000' } })
    // `undefined` ⇒ Prisma ne touche pas la colonne. Un repli `retail` ici DÉGRADERAIT
    // silencieusement tous les grossistes à chaque édition de fiche.
    expect(typeWritten(db.customer.update)).toBeUndefined()
  })

  it('type irrésolvable → 400, aucune écriture', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/customers/c1', payload: { type: 'Client VIP' } })
    expect(res.statusCode).toBe(400)
    expect(db.customer.update).not.toHaveBeenCalled()
  })
})
