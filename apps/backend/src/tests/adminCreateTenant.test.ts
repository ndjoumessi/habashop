import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * POST /api/admin/tenants — validation du body (bug `name` : 500 → 400).
 *
 * Avant : `Tenant.name` est requis (non-nullable sans défaut), mais la route
 * n'avait ni schéma ni garde → un POST sans `name` atteignait `prisma.tenant.create`
 * et levait un 500 Prisma. Désormais un schéma zod exige `name` → 400 VALIDATION.
 *
 * On exerce la VRAIE route avec un vrai admin plateforme (isPlatformAdmin) pour
 * franchir `authenticateAdmin` et atteindre la validation du body.
 */

const SECRET = 'test-admin-create-tenant'

const db = {
  tenant: { create: vi.fn(async () => ({ id: 'new', name: 'Boutique' })) },
  user:   { create: vi.fn(async () => ({ id: 'u' })) },
}
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hash') } }))

let app: FastifyInstance
let platformAdminToken: string

beforeAll(async () => {
  const { adminRoutes } = await import('../routes/admin')
  app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(jwt, { secret: SECRET })
  await app.register(adminRoutes)
  await app.ready()
  platformAdminToken = app.jwt.sign({ userId: 'uP', role: 'CASHIER', tenantId: 'A', isPlatformAdmin: true })
})

beforeEach(() => vi.clearAllMocks())

function post(payload: unknown) {
  return app.inject({
    method: 'POST', url: '/api/admin/tenants',
    headers: { authorization: `Bearer ${platformAdminToken}` },
    payload: payload as object,
  })
}

describe('POST /api/admin/tenants — validation de `name`', () => {
  // Le défaut corrigé : sans name, on renvoyait un 500 Prisma (name requis).
  // On assert 400 + AUCUNE création. Le mapping `{ code:'VALIDATION' }` est ajouté par
  // l'error handler GLOBAL de `server.ts` (non monté dans ce harnais bare) et couvert
  // par ses propres tests ; ici on vérifie que la validation REJETTE avant Prisma.
  it.each([
    ['name absent',      { currency: 'XOF' }],
    ['name vide',        { name: '' }],
    ['name espaces',     { name: '   ' }],
  ])('%s → 400, aucune création (plus de 500 Prisma)', async (_label, payload) => {
    const res = await post(payload)
    expect(res.statusCode).toBe(400)
    expect(db.tenant.create, 'aucune boutique ne doit être créée sur un body invalide').not.toHaveBeenCalled()
  })

  it('name valide → crée la boutique (200)', async () => {
    const res = await post({ name: 'Nouvelle Boutique' })
    expect(res.statusCode).toBe(200)
    // `name` traversé au create (trim appliqué par le schéma).
    expect(db.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Nouvelle Boutique' }) }),
    )
  })

  it('currency/country/plan restent optionnels (défauts appliqués, pas de rejet)', async () => {
    const res = await post({ name: 'Boutique', currency: 'INEXISTANTE' })
    // La devise inédite n'est PAS resserrée (comportement d'avant préservé) → pas de 400.
    expect(res.statusCode).toBe(200)
    expect(db.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency: 'INEXISTANTE' }) }),
    )
  })
})
