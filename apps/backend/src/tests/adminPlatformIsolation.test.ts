import { describe, it, expect, vi, beforeAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import { CLIENT_TENANTS_WHERE, FIXTURE_TENANTS_WHERE } from '../lib/fixtureTenant'

/**
 * P0 — Isolation du panneau PLATEFORME (/api/admin/*).
 *
 * La faille : `authenticateAdmin` gardait sur le rôle TENANT `SUPER_ADMIN`, or
 * ce rôle est interne à une boutique → tout propriétaire de boutique lisait les
 * données de TOUS les tenants (CA cumulé, MRR, liste des boutiques…).
 *
 * Le correctif gate sur `isPlatformAdmin` (propriété per-user signée serveur).
 * On exerce le VRAI middleware (pas de mock) avec de vrais JWT :
 *  - SUPER_ADMIN de tenant → 403 sur chaque route /api/admin/*
 *  - ancien JWT sans le claim → 403 (fail-closed)
 *  - isPlatformAdmin:true → 200 (contrôle positif : le mock ne renvoie pas 403 partout)
 */

const SECRET = 'test-secret-platform-isolation'

// Prisma mocké : les handlers ne doivent jamais être atteints par un non-admin
// plateforme (le gate coupe avant). Le contrôle positif renvoie des données neutres.
const db = {
  tenant:  { findMany: vi.fn(async () => [{ id: 'A', name: 'Boutique A', _count: { users: 1, products: 2, sales: 3 } }]), count: vi.fn(async () => 3), create: vi.fn(async () => ({ id: 'new' })), groupBy: vi.fn(async () => [{ plan: 'business', _count: { id: 2 } }]) },
  user:    { create: vi.fn(async () => ({ id: 'u' })) },
  planRequest: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), update: vi.fn() },
}
// basePrisma : agrégats cross-tenant (Sale/Product/User via relation tenant.isPlatform).
const baseDb = {
  user:    { count: vi.fn(async () => 5) },
  sale:    { aggregate: vi.fn(async () => ({ _sum: { total: 999 }, _count: 3 })), groupBy: vi.fn(async () => [{ tenantId: 'A', _sum: { total: 5000 }, _max: { createdAt: '2026-07-10T00:00:00.000Z' } }]) },
  product: { count: vi.fn(async () => 2) },
}
vi.mock('../db', () => ({ prisma: db, basePrisma: baseDb }))

/**
 * ⚠️ PÉRIMÈTRE DÉRIVÉ DE LA TABLE DE ROUTES — il était ÉCRIT À LA MAIN, et c'est le
 * défaut que ce fichier corrige le 2026-08-15.
 *
 * `ADMIN_GET_ROUTES` était la liste en dur `['/api/admin/tenants', '/api/admin/stats',
 * '/api/admin/plan-requests']`. Elle était juste le jour où on l'a tapée. Quand
 * `/api/admin/integrations/resend` est apparu, la garde P0 a cessé d'être vérifiée sur
 * lui — sans qu'aucun test ne rougisse, puisque les trois autres passaient toujours.
 *
 * C'est EXACTEMENT le motif documenté dans CLAUDE.md § Zone franc CFA : « le garde avait
 * été posé sur quatre routes et vérifié sur UNE ; une revue a trouvé dans les non testées
 * deux régressions livrées en prod. » On ne liste plus : on demande à Fastify.
 *
 * ⚠️ Et il faut enregistrer TOUS les plugins qui portent des routes `/api/admin/*`, sinon
 * la dérivation est vraie mais son univers est incomplet — un périmètre dérivé de la
 * mauvaise propriété rend un zéro qui a l'air d'une preuve.
 */
const routesAdmin: { method: string; url: string }[] = []

/** `/api/admin/plan-requests/:id` → `/api/admin/plan-requests/x` (injectable). */
const injectable = (url: string) => url.replace(/:[^/]+/g, 'x')

let app: FastifyInstance
let tenantSuperAdminToken: string  // SUPER_ADMIN d'un tenant, PAS admin plateforme
let legacyToken: string            // ancien JWT sans le claim isPlatformAdmin
let platformAdminToken: string     // vrai admin plateforme

beforeAll(async () => {
  const { adminRoutes } = await import('../routes/admin')
  const { integrationStatusRoutes } = await import('../routes/integrationStatus')
  const { validatorCompiler } = await import('fastify-type-provider-zod')
  app = Fastify()
  app.setValidatorCompiler(validatorCompiler) // POST /api/admin/tenants a un schéma zod
  // ⚠️ Le hook doit être posé AVANT les `register` : `onRoute` ne rejoue pas le passé.
  app.addHook('onRoute', r => {
    if (!r.url.startsWith('/api/admin/')) return
    for (const m of (Array.isArray(r.method) ? r.method : [r.method])) routesAdmin.push({ method: m, url: r.url })
  })
  await app.register(jwt, { secret: SECRET })
  await app.register(adminRoutes)
  await app.register(integrationStatusRoutes)
  await app.ready()

  tenantSuperAdminToken = app.jwt.sign({ userId: 'uA', role: 'SUPER_ADMIN', tenantId: 'A', activeTenantId: 'A', isPlatformAdmin: false })
  legacyToken           = app.jwt.sign({ userId: 'uA', role: 'SUPER_ADMIN', tenantId: 'A', activeTenantId: 'A' }) // pas de claim
  platformAdminToken    = app.jwt.sign({ userId: 'uP', role: 'CASHIER', tenantId: 'A', activeTenantId: 'A', isPlatformAdmin: true })
})

describe('P0 — /api/admin/* gate sur isPlatformAdmin, jamais sur le rôle tenant', () => {
  it('COUVERTURE — la table de routes a bien été lue, et elle contient la NOUVELLE', () => {
    // Sans ce cas, un hook mal placé rendrait une liste VIDE et la boucle ci-dessous
    // passerait sur le néant : la vérité vacante, `.every()` sur zéro élément.
    expect(routesAdmin.length).toBeGreaterThanOrEqual(4)
    const urls = routesAdmin.map(r => r.url)
    expect(urls).toContain('/api/admin/stats')
    // ⚠️ Le témoin qui aurait manqué : la route ajoutée le 2026-08-15.
    expect(urls).toContain('/api/admin/integrations/resend')
  })

  it('⚠️ SUPER_ADMIN de tenant → 403 sur CHAQUE route /api/admin/* en LECTURE', async () => {
    // Périmètre DÉRIVÉ : toute route admin ajoutée demain entre ici sans que personne
    // n'y pense — c'est le seul moyen qu'une garde posée sur N routes soit vérifiée sur N.
    const lectures = routesAdmin.filter(r => r.method === 'GET' || r.method === 'HEAD')
    expect(lectures.length, 'aucune lecture admin dérivée — le hook n’a rien capté').toBeGreaterThanOrEqual(4)
    const passantes: string[] = []
    for (const r of lectures) {
      const res = await app.inject({
        method: r.method as 'GET', url: injectable(r.url),
        headers: { authorization: `Bearer ${tenantSuperAdminToken}` },
      })
      if (res.statusCode !== 403) passantes.push(`${r.method} ${r.url} → ${res.statusCode}`)
    }
    expect(passantes, 'Une lecture /api/admin/* ne refuse PAS un SUPER_ADMIN de tenant — fuite inter-tenants (P0).').toEqual([])
  })

  it('⚠️ …et AUCUNE écriture /api/admin/* ne sert un 2xx à un SUPER_ADMIN de tenant', async () => {
    /**
     * ⚠️ POURQUOI CE CAS EST PLUS FAIBLE QUE CELUI DES LECTURES, ET POURQUOI ON L'ÉCRIT
     * QUAND MÊME PLUTÔT QUE DE PRÉTENDRE LE CONTRAIRE.
     *
     * MESURÉ ici : `POST /api/admin/tenants` avec un corps vide rend **400, pas 403**.
     * Ce n'est pas un trou — dans Fastify la validation de schéma s'exécute AVANT le
     * `preHandler`, donc le corps est rejeté avant même que la garde soit consultée, et
     * aucun handler ne tourne. Mais un corps générique ne peut pas franchir la validation
     * de toutes les routes, donc on ne peut pas exiger un 403 EXACT ici sans écrire un
     * corps valide par route — c'est-à-dire sans revenir à une liste écrite à la main.
     *
     * On assert donc l'invariant qui compte vraiment — **aucune donnée servie** — et les
     * deux écritures connues gardent leur cas NOMMÉ ci-dessous, avec un corps VALIDE qui
     * atteint réellement la garde et prouve le 403. Dire cette limite vaut mieux que de
     * laisser croire la couverture égale à celle des lectures.
     */
    const ecritures = routesAdmin.filter(r => r.method !== 'GET' && r.method !== 'HEAD')
    const servies: string[] = []
    for (const r of ecritures) {
      const res = await app.inject({
        method: r.method as 'POST', url: injectable(r.url),
        headers: { authorization: `Bearer ${tenantSuperAdminToken}` }, payload: {},
      })
      if (res.statusCode < 400) servies.push(`${r.method} ${r.url} → ${res.statusCode}`)
    }
    expect(servies, 'Une écriture /api/admin/* a répondu 2xx à un SUPER_ADMIN de tenant.').toEqual([])
  })

  it('SUPER_ADMIN de tenant → 403 sur les écritures (create tenant, review plan)', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/admin/tenants', headers: { authorization: `Bearer ${tenantSuperAdminToken}` }, payload: { name: 'X' } })
    expect(create.statusCode).toBe(403)
    const review = await app.inject({ method: 'PATCH', url: '/api/admin/plan-requests/abc', headers: { authorization: `Bearer ${tenantSuperAdminToken}` }, payload: { action: 'approve' } })
    expect(review.statusCode).toBe(403)
    expect(db.tenant.create).not.toHaveBeenCalled()
    expect(db.planRequest.update).not.toHaveBeenCalled()
  })

  it('ancien JWT sans le claim isPlatformAdmin → 403 (fail-closed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${legacyToken}` } })
    expect(res.statusCode).toBe(403)
  })

  it('aucun token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats' })
    expect(res.statusCode).toBe(401)
  })

  it('contrôle positif : isPlatformAdmin:true → 200 et données servies', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${platformAdminToken}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ totalTenants: 3, totalUsers: 5 })
  })

  it('/api/admin/tenants (admin plateforme) enrichit chaque boutique de CA + dernière activité', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/tenants', headers: { authorization: `Bearer ${platformAdminToken}` } })
    expect(res.statusCode).toBe(200)
    const rows = res.json()
    expect(rows[0]).toMatchObject({ id: 'A', revenue: 5000, lastActivityAt: '2026-07-10T00:00:00.000Z' })
  })

  /**
   * ⚠️ CE TEST FIGEAIT UN FILTRE INCOMPLET. Il exigeait `where: { isPlatform: false }` —
   * exactement la clause qui faisait annoncer « 3 boutiques inscrites » alors que les
   * trois étaient deux démos et un tenant E2E. Il aurait donc BLOQUÉ la correction : il
   * assertait la forme du filtre au lieu de la propriété qu'il doit garantir.
   * Il porte désormais sur `CLIENT_TENANTS_WHERE`, qui exclut les TROIS familles.
   */
  it('exclut les fixtures — interne plateforme, démo ET E2E — des listings et des totaux', async () => {
    await app.inject({ method: 'GET', url: '/api/admin/tenants', headers: { authorization: `Bearer ${platformAdminToken}` } })
    // La LISTE garde les fixtures (un opérateur doit pouvoir ouvrir la démo) mais les MARQUE.
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isPlatform: false } }))

    await app.inject({ method: 'GET', url: '/api/admin/stats', headers: { authorization: `Bearer ${platformAdminToken}` } })
    // Les AGRÉGATS, eux, ne comptent que les clients.
    expect(db.tenant.count).toHaveBeenCalledWith({ where: CLIENT_TENANTS_WHERE })
    expect(baseDb.user.count).toHaveBeenCalledWith({ where: { tenant: CLIENT_TENANTS_WHERE } })
    expect(baseDb.sale.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant: CLIENT_TENANTS_WHERE }) }))
    // …et les fixtures sont COMPTÉES à part, pour être dites à l'écran.
    expect(db.tenant.count).toHaveBeenCalledWith({ where: FIXTURE_TENANTS_WHERE })
  })
})
