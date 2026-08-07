import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * LES QUATRE CHEMINS D'ÉCRITURE DE TENANT, EXERCÉS PAR INJECTION.
 *
 * ─── LE DÉFAUT DE MÉTHODE QUE CE FICHIER RÉPARE ──────────────────────────────
 * Le garde de zone franc CFA a été posé sur QUATRE routes et vérifié sur UNE.
 * Les trois autres ont été déclarées gardées sans jamais être injectées, et une revue
 * a trouvé dans les deux non testées deux régressions livrées en production :
 *   · `POST /api/tenants`   — refusait TOUTE boutique XOF (le formulaire n'a pas de
 *                             champ pays, donc le pays défautait à CM/CEMAC) ;
 *   · `POST /api/admin/tenants` — même chose depuis la console plateforme ;
 *   · `POST /api/tenants`   — seul des quatre à ne pas appeler `normalizeCountry`,
 *                             donc aveugle aux libellés hérités (`'Sénégal'`).
 * *Le sabotage S3 avait déjà enseigné qu'un invariant pur ne dit rien du câblage ;
 * la leçon n'avait été appliquée qu'à la route qu'on regardait.*
 */

const { db } = vi.hoisted(() => ({
  db: {
    tenant: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    user: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    userTenant: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../lib/tenantId', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getActiveTenantId: () => 'T1',
}))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
  },
  authenticateAdmin: async (req: Record<string, unknown>) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1', isPlatformAdmin: true }
    req.tenantId = 'T1'
  },
}))
vi.mock('../middleware/demoTenant', () => ({ blockDemoTenant: async () => {} }))
vi.mock('../middleware/superAdmin', () => ({
  authenticateAdmin: async (req: Record<string, unknown>) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1', isPlatformAdmin: true }
    req.tenantId = 'T1'
  },
}))
vi.mock('../lib/writeAudit', () => ({ writeAudit: async (_l: string, w: Promise<unknown>) => { await w } }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
// ⚠️ Les mocks d'e-mail rendent une PROMESSE : les handlers chaînent `.catch(...)` dessus.
// Un `vi.fn()` nu rend `undefined` → 500 « reading 'catch' », et l'assertion de zone
// serait rouge pour une raison qui n'a rien à voir avec la zone.
vi.mock('../services/email', () => ({
  sendUserInvitationEmail: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPlatformEmail: vi.fn().mockResolvedValue(undefined),
  sendTenantEmail: vi.fn().mockResolvedValue(undefined),
}))

import { tenantRoutes } from '../routes/tenant'
import { authRoutes } from '../routes/auth'
import { adminRoutes } from '../routes/admin'

/** Le dernier `tenant.create` reçu — c'est la DONNÉE ÉCRITE qu'on juge, pas le code HTTP. */
const dernierCreate = () => db.tenant.create.mock.calls.at(-1)?.[0]?.data as Record<string, unknown> | undefined

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'T2', ...a.data }))
  db.tenant.update.mockImplementation(async (a: { data: Record<string, unknown> }) => ({
    id: 'T1', country: 'SN', currency: 'XOF', lang: 'fr', vatRate: 18,
    ...Object.fromEntries(Object.entries(a.data).filter(([, v]) => v !== undefined)),
  }))
  db.tenant.findUnique.mockResolvedValue({ id: 'T1', country: 'SN', currency: 'XOF', lang: 'fr', vatRate: 18, status: 'active', trialEnds: null, plan: 'starter' })
  db.user.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'u2', ...a.data }))
  db.user.findUnique.mockResolvedValue(null)
  db.user.findFirst.mockResolvedValue(null)
  db.userTenant.create.mockResolvedValue({})
  db.userTenant.findMany.mockResolvedValue([])
  db.auditLog.create.mockResolvedValue({ id: 'a1' })
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    typeof fn === 'function' ? fn(db) : Promise.all(fn as unknown as Promise<unknown>[]))
})

async function serveur(routes: (app: never) => Promise<void>) {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  // `register` signe un JWT : sans ce décorateur la route rend 500 (« reading 'sign' »)
  // et l'assertion de zone serait verte pour la mauvaise raison.
  app.decorate('jwt', { sign: () => 'jeton-de-test' } as never)
  await app.register(routes as never)
  await app.ready()
  return app
}
const post = async (routes: never, url: string, payload: Record<string, unknown>) =>
  await (await serveur(routes)).inject({ method: 'POST', url, payload })
const patch = async (payload: Record<string, unknown>) =>
  await (await serveur(tenantRoutes as never)).inject({ method: 'PATCH', url: '/api/tenant', payload })

// ── 1. POST /api/tenants — création d'une 2ᵉ boutique ────────────────────────
describe('CHEMIN 1 — POST /api/tenants', () => {
  it('SANS pays : le pays HÉRITE de la boutique d’origine, et XOF passe', async () => {
    // Le formulaire n'a pas de champ pays. Avant, le pays retombait sur CM (marché par
    // défaut) et le couple CM+XOF était REFUSÉ : XOF devenait incréable depuis le produit.
    const r = await post(tenantRoutes as never, '/api/tenants', { name: 'Dakar 2', currency: 'XOF', lang: 'fr' })
    expect(r.statusCode).toBe(201)
    expect(dernierCreate()?.country).toBe('SN')    // la boutique d'origine est à Dakar
    expect(dernierCreate()?.currency).toBe('XOF')  // le choix de l'utilisateur est SERVI
  })

  it('SANS pays ni devise : la devise se DÉRIVE du pays hérité', async () => {
    const r = await post(tenantRoutes as never, '/api/tenants', { name: 'Dakar 4' })
    expect(r.statusCode).toBe(201)
    expect(dernierCreate()?.country).toBe('SN')
    expect(dernierCreate()?.currency).toBe('XOF')
  })

  it('sans boutique d’origine lisible, on retombe sur le marché par défaut', async () => {
    db.tenant.findUnique.mockResolvedValue(null)
    const r = await post(tenantRoutes as never, '/api/tenants', { name: 'Neuve' })
    expect(r.statusCode).toBe(201)
    expect(dernierCreate()?.country).toBe('CM')
    expect(dernierCreate()?.currency).toBe('XAF')
  })

  it('un LIBELLÉ hérité est NORMALISÉ, et la devise en découle', async () => {
    const r = await post(tenantRoutes as never, '/api/tenants', { name: 'Dakar 3', country: 'Sénégal' })
    expect(r.statusCode).toBe(201)
    expect(dernierCreate()?.country).toBe('SN')    // plus jamais 'Sénégal' en base
    expect(dernierCreate()?.currency).toBe('XOF')  // plus jamais XAF sur une boutique SN
    expect(dernierCreate()?.vatRate).toBe(18)      // et le taux suit, au lieu de 0
  })

  it('pays EXPLICITE + devise en conflit → 400, aucune écriture', async () => {
    const r = await post(tenantRoutes as never, '/api/tenants', { name: 'X', country: 'SN', currency: 'XAF' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('CURRENCY_ZONE_MISMATCH')
    expect(db.tenant.create).not.toHaveBeenCalled()
  })
})

// ── 2. POST /api/admin/tenants — console plateforme ──────────────────────────
describe('CHEMIN 2 — POST /api/admin/tenants', () => {
  const corps = { name: 'Client', adminEmail: 'a@b.com', adminPassword: 'Motdepasse-1' }

  it('avec le pays (le formulaire l’expose depuis le 2026-08-08), XOF est créable', async () => {
    const r = await post(adminRoutes as never, '/api/admin/tenants', { ...corps, country: 'SN', currency: 'XOF' })
    expect(r.statusCode).toBeLessThan(400)
    expect(dernierCreate()?.country).toBe('SN')
    expect(dernierCreate()?.currency).toBe('XOF')
  })

  it('sans devise, elle se DÉRIVE du pays', async () => {
    const r = await post(adminRoutes as never, '/api/admin/tenants', { ...corps, country: 'SN' })
    expect(r.statusCode).toBeLessThan(400)
    expect(dernierCreate()?.currency).toBe('XOF')
  })

  it('pays EXPLICITE + devise en conflit → 400', async () => {
    const r = await post(adminRoutes as never, '/api/admin/tenants', { ...corps, country: 'CM', currency: 'XOF' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('CURRENCY_ZONE_MISMATCH')
    expect(db.tenant.create).not.toHaveBeenCalled()
  })
})

// ── 3. POST /api/auth/register — inscription ─────────────────────────────────
describe('CHEMIN 3 — POST /api/auth/register', () => {
  const corps = { name: 'Awa', email: 'awa@exemple.com', password: 'Motdepasse-1', shopName: 'Chez Awa' }

  it('SN + XAF explicites → 400, aucun tenant créé', async () => {
    const r = await post(authRoutes as never, '/api/auth/register', { ...corps, country: 'SN', currency: 'XAF' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('CURRENCY_ZONE_MISMATCH')
    expect(db.tenant.create).not.toHaveBeenCalled()
  })

  it('⚠️ une devise avec ESPACE ne contourne plus le garde', async () => {
    const r = await post(authRoutes as never, '/api/auth/register', { ...corps, country: 'SN', currency: 'XAF ' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('CURRENCY_ZONE_MISMATCH')
  })

  it('⚠️ un LIBELLÉ hérité ne contourne plus le garde non plus', async () => {
    const r = await post(authRoutes as never, '/api/auth/register', { ...corps, country: 'Sénégal', currency: 'XAF' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('CURRENCY_ZONE_MISMATCH')
  })

  it('SN + XOF passe', async () => {
    const r = await post(authRoutes as never, '/api/auth/register', { ...corps, country: 'SN', currency: 'XOF' })
    expect(r.statusCode).toBeLessThan(400)
  })
})

// ── 4. PATCH /api/tenant — l'asymétrie ───────────────────────────────────────
describe('CHEMIN 4 — PATCH /api/tenant', () => {
  it('la DEVISE seule, en conflit → 400 (l’utilisateur l’a choisie)', async () => {
    const r = await patch({ currency: 'XAF' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('CURRENCY_ZONE_MISMATCH')
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it('le PAYS seul, changement de zone → la devise se DÉRIVE, pas de 400', async () => {
    const r = await patch({ country: 'CM' })
    expect(r.statusCode).toBe(200)
    const data = db.tenant.update.mock.calls.at(-1)![0].data as Record<string, unknown>
    expect(data.country).toBe('CM')
    expect(data.currency).toBe('XAF')   // dérivée : le commerçant a déménagé, pas choisi un franc
  })

  it('et la devise DÉRIVÉE est bien JOURNALISÉE — sinon elle passait sous le radar', async () => {
    await patch({ country: 'CM' })
    const d = JSON.parse(db.auditLog.create.mock.calls[0][0].data.description as string)
    expect(d.country).toEqual({ avant: 'SN', apres: 'CM' })
    expect(d.currency).toEqual({ avant: 'XOF', apres: 'XAF' })
  })

  it('un LIBELLÉ hérité DÉJÀ EN BASE ne désarme plus le garde', async () => {
    db.tenant.findUnique.mockResolvedValue({ id: 'T1', country: 'Sénégal', currency: 'XOF', lang: 'fr', vatRate: 18 })
    const r = await patch({ currency: 'XAF' })
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('CURRENCY_ZONE_MISMATCH')
  })
})

// ── ⑥ Autorisation : country et vatRate sont des réglages ADMIN ──────────────
describe('country et vatRate sont sous le contrôle de rôle', () => {
  const patchRole = async (role: string, payload: Record<string, unknown>) => {
    vi.doMock('../middleware/authenticate', () => ({
      authenticate: async (req: Record<string, unknown>) => { req.user = { role, tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
    }))
    vi.resetModules()
    const { tenantRoutes: routes } = await import('../routes/tenant')
    const app = Fastify()
    app.decorate('jwt', { sign: () => 'jeton-de-test' } as never)
    await app.register(routes as never)
    await app.ready()
    return await app.inject({ method: 'PATCH', url: '/api/tenant', payload })
  }

  it('un CASHIER ne peut plus mettre la TVA à 0', async () => {
    const r = await patchRole('CASHIER', { vatRate: 0 })
    expect(r.statusCode).toBe(403)
    expect(r.json().code).toBe('LOCALE_ADMIN_ONLY')
  })

  it('un CASHIER ne peut plus changer le pays', async () => {
    const r = await patchRole('CASHIER', { country: 'GB' })
    expect(r.statusCode).toBe(403)
  })

  it('un ADMIN, lui, le peut toujours', async () => {
    const r = await patchRole('ADMIN', { vatRate: 20 })
    expect(r.statusCode).toBe(200)
  })
})
