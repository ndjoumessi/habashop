import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * ⚠️ LES DÉMOS JETABLES NE NOIENT PAS LA CONSOLE OPS.
 *
 * Défaut trouvé en revue. `GET /api/admin/tenants` n'est ni paginé ni borné, et
 * `AdminDashboard` rend chaque ligne. En régime établi — 200 démos/jour × 7 jours de
 * rétention — la table principale afficherait jusqu'à 1400 lignes TOUTES nommées « Boutique
 * de démonstration », au-dessus des quelques clients réels, et le tri par date de création
 * les mettrait en tête. La recherche par nom ne les distingue pas.
 *
 * Les démos PERMANENTES (`demo-tenant-001/002`) restent visibles : un opérateur doit pouvoir
 * ouvrir la démonstration. C'est l'éphémère — reconnaissable à `demoExpiresAt` non nul — qui
 * sort, parce qu'elle ne survivra pas à la semaine et qu'aucune décision ne se prend sur elle.
 */
const { db, base, auth } = vi.hoisted(() => ({
  db: { tenant: { findMany: vi.fn(async (_a?: unknown): Promise<unknown[]> => []) } },
  base: {
    sale: { groupBy: vi.fn(async (_a?: unknown): Promise<unknown[]> => []) },
    tenant: { findMany: vi.fn(async (_a?: unknown): Promise<unknown[]> => []) },
  },
  auth: vi.fn(async () => {}),
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: base }))
vi.mock('../middleware/superAdmin', () => ({ authenticateAdmin: auth }))
vi.mock('../middleware/authenticate', () => ({ authenticate: vi.fn(async () => {}) }))

import { adminRoutes } from '../routes/admin'

beforeEach(() => { vi.clearAllMocks(); db.tenant.findMany.mockResolvedValue([]) })

/** Routes portant un `schema` zod → `validatorCompiler` AVANT `register` (sinon Ajv casse). */
async function monter() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(adminRoutes)
  await app.ready()
  return app
}

describe('GET /api/admin/tenants', () => {
  it('⚠️ EXCLUT les démos jetables — `demoExpiresAt` doit être nul', async () => {
    const app = await monter()
    await app.inject({ method: 'GET', url: '/api/admin/tenants' })
    const appel = db.tenant.findMany.mock.calls[0]
    const where = (appel[0] as { where: Record<string, unknown> }).where
    expect(where.demoExpiresAt, `le filtre doit exiger une échéance nulle : ${JSON.stringify(where)}`).toBe(null)
  })

  it('les tenants INTERNES plateforme restent exclus — on ne remplace pas une garde par l’autre', async () => {
    const app = await monter()
    await app.inject({ method: 'GET', url: '/api/admin/tenants' })
    const where = (db.tenant.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where
    expect(where.isPlatform).toBe(false)
  })
})
