import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * UN 401 N'A PAS UN SEUL SENS — et c'est le client qui en paie le prix.
 *
 * Mesuré le 2026-10-02 : l'application mobile n'avait AUCUN traitement du 401 reçu
 * EN COURS DE SESSION. Un jeton périmé (TTL 7 j) laissait le commerçant visuellement
 * connecté pendant que tous les écrans affichaient « Erreur — toucher pour réessayer »,
 * un message qui NOMME une panne réseau et invite à un réessai qui ne peut pas aboutir.
 *
 * ⚠️ Le correctif évident — « 401 ⇒ déconnecter » — est FAUX : TROIS routes rendent 401
 * pour dire « le mot de passe que vous venez de taper est mauvais », pas « votre jeton
 * est mort ». Déconnecter sur celles-là, c'est éjecter un commerçant qui fait une faute
 * de frappe dans l'écran « Changer le mot de passe ».
 *
 * D'où un discriminant POSITIF et non une liste d'exemptions : seules les gardes de
 * jeton (`authenticate`, `authenticateAdmin`) posent `code: 'TOKEN_INVALID'`. Une liste
 * d'URL exemptées serait fausse au prochain ajout de route — personne ne pense à la
 * mettre à jour ; un code positif, lui, ne s'obtient qu'en le posant.
 */

const SECRET = 'test-secret-code-jeton'
// Anti-dérive : ce test ET son jumeau mobile/src/__tests__/sessionExpiree.test.ts lisent le
// MÊME fichier. Renommer le code d'un seul côté fait échouer l'autre.
const CODE = (JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/auth-refusal.json'), 'utf8'),
) as { tokenInvalid: string }).tokenInvalid

const { db } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    userTenant: { findMany: vi.fn(), findUnique: vi.fn() },
    tenant: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}))
const { estActif } = vi.hoisted(() => ({ estActif: vi.fn() }))
const { comparer } = vi.hoisted(() => ({ comparer: vi.fn() }))

vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../lib/userStatus', () => ({ isUserActive: estActif, invalidateUserStatus: vi.fn() }))
vi.mock('../lib/cache', () => ({ getCached: (_k: string, _t: number, fn: () => unknown) => fn() }))
vi.mock('../services/email', () => ({ sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('bcryptjs', () => ({ default: { compare: comparer, hash: vi.fn().mockResolvedValue('h') } }))
// Hors sujet ici : on mesure la FORME du refus 401, pas la garde démo.
vi.mock('../middleware/demoTenant', () => ({ blockDemoTenant: vi.fn(async () => {}) }))

import { authenticate } from '../middleware/authenticate'
import { authenticateAdmin } from '../middleware/superAdmin'
import { authRoutes } from '../routes/auth'
import { accountRoutes } from '../routes/account'

const USER = { id: 'u1', name: 'Awa', email: 'awa@shop.com', passwordHash: 'h', isActive: true, tenantId: 't1', role: 'ADMIN' }

async function appGardee() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(jwt, { secret: SECRET })
  app.get('/protege', { preHandler: authenticate }, async () => ({ ok: true }))
  app.get('/plateforme', { preHandler: authenticateAdmin }, async () => ({ ok: true }))
  await app.register(authRoutes)
  await app.register(accountRoutes)
  await app.ready()
  return app
}

/** Instance Fastify décorée par @fastify/jwt — le minimum qu'on lui demande ici. */
type AppJwt = { jwt: { sign(p: object, o: object): string } }

function jeton(app: AppJwt, claims: object, opts: object = {}): string {
  return app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: 't1', activeTenantId: 't1', ...claims }, opts)
}

beforeEach(() => {
  vi.clearAllMocks()
  estActif.mockResolvedValue(true)
  db.user.findUnique.mockResolvedValue(USER)
  db.user.update.mockResolvedValue(USER)
  db.userTenant.findMany.mockResolvedValue([{ role: 'ADMIN', tenant: { id: 't1', name: 'B', currency: 'XOF', plan: 'starter' } }])
})

// ─── Le jeton est mort : le refus doit le DIRE ───────────────────────────────
describe('gardes de jeton — le refus porte TOKEN_INVALID', () => {
  it('aucun en-tête Authorization', async () => {
    const app = await appGardee()
    const res = await app.inject({ method: 'GET', url: '/protege' })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(CODE)
  })

  it('jeton illisible', async () => {
    const app = await appGardee()
    const res = await app.inject({ method: 'GET', url: '/protege', headers: { authorization: 'Bearer nimporte.quoi.ici' } })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(CODE)
  })

  it('jeton EXPIRÉ — le cas réellement mesuré sur l’appareil (TTL 7 j dépassé)', async () => {
    const app = await appGardee()
    const perime = jeton(app, {}, { expiresIn: '-1s' })
    const res = await app.inject({ method: 'GET', url: '/protege', headers: { authorization: `Bearer ${perime}` } })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(CODE)
  })

  it('jeton valide mais compte supprimé/désactivé — même remède : se reconnecter', async () => {
    estActif.mockResolvedValue(false)
    const app = await appGardee()
    const res = await app.inject({ method: 'GET', url: '/protege', headers: { authorization: `Bearer ${jeton(app, {})}` } })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'Compte introuvable', code: CODE })
  })

  it('garde PLATEFORME (authenticateAdmin) — même code', async () => {
    const app = await appGardee()
    const res = await app.inject({ method: 'GET', url: '/plateforme', headers: { authorization: 'Bearer pas.un.jeton' } })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(CODE)
  })

  it('un jeton VALIDE passe — contrôle positif : la garde ne refuse pas tout', async () => {
    const app = await appGardee()
    const res = await app.inject({ method: 'GET', url: '/protege', headers: { authorization: `Bearer ${jeton(app, {})}` } })
    expect(res.statusCode).toBe(200)
  })
})

// ─── Le mot de passe est mauvais : surtout PAS le même code ──────────────────
describe('refus d’IDENTIFIANTS — 401 SANS code (sinon on éjecte sur une faute de frappe)', () => {
  it('POST /api/auth/login — mot de passe incorrect', async () => {
    comparer.mockResolvedValue(false)
    const app = await appGardee()
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'awa@shop.com', password: 'faux' } })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBeUndefined()
  })

  it('PATCH /api/auth/password — mot de passe ACTUEL incorrect (écran Réglages)', async () => {
    comparer.mockResolvedValue(false)
    const app = await appGardee()
    const res = await app.inject({
      method: 'PATCH', url: '/api/auth/password',
      headers: { authorization: `Bearer ${jeton(app, {})}` },
      payload: { currentPassword: 'faux', newPassword: 'nouveaumotdepasse' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBeUndefined()
  })

  it('DELETE /api/account/me — mot de passe incorrect', async () => {
    comparer.mockResolvedValue(false)
    const app = await appGardee()
    const res = await app.inject({
      method: 'DELETE', url: '/api/account/me',
      headers: { authorization: `Bearer ${jeton(app, {})}` },
      payload: { confirmation: 'SUPPRIMER', password: 'faux' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBeUndefined()
  })
})

// ─── Périmètre DÉRIVÉ : un 4ᵉ site de 401 ne peut pas entrer en douce ────────
describe('périmètre — tout 401 de src/ est classé', () => {
  // Les deux SEULS fichiers autorisés à poser le code : ils jugent le PORTEUR.
  const GARDES = ['middleware/authenticate.ts', 'middleware/superAdmin.ts']
  // Tout autre 401 refuse une PREUVE fournie dans la requête (mot de passe, signature
  // de webhook) — jamais le porteur. Chacun est nommé, avec ce qu'il refuse.
  const AUTRES: Record<string, string> = {
    'routes/auth.ts': 'identifiants de connexion / mot de passe actuel',
    'routes/account.ts': 'mot de passe de confirmation de suppression',
    'routes/paydunyaPayment.ts': 'hash IPN PayDunya',
    'routes/campayPayment.ts': 'signature webhook Campay',
  }

  function sansCommentaires(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  }

  function fichiersTs(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) { if (e !== 'tests') fichiersTs(p, acc) }
      else if (e.endsWith('.ts')) acc.push(p)
    }
    return acc
  }

  it('chaque site de 401 est soit une garde de jeton (code posé), soit nommé (code absent)', () => {
    const racine = join(__dirname, '..')
    const fichiers = fichiersTs(racine)
    expect(fichiers.length).toBeGreaterThan(100) // couverture : le walk a bien lu src/

    let sitesGardes = 0
    let sitesAutres = 0
    for (const f of fichiers) {
      const rel = f.slice(racine.length + 1)
      const src = sansCommentaires(readFileSync(f, 'utf8'))
      const envois = src.match(/code\(401\)\s*\.send\(\{[^}]*\}/g) ?? []
      if (envois.length === 0) continue
      if (GARDES.includes(rel)) {
        for (const e of envois) expect(e, `${rel} : une garde de jeton doit poser le code`).toContain(CODE)
        sitesGardes += envois.length
      } else {
        expect(Object.keys(AUTRES), `${rel} pose un 401 non classé — décider ce qu'il refuse`).toContain(rel)
        for (const e of envois) expect(e, `${rel} ne refuse pas un PORTEUR`).not.toContain(CODE)
        sitesAutres += envois.length
      }
    }
    expect(sitesGardes).toBe(3)        // 2 dans authenticate, 1 dans superAdmin
    expect(sitesAutres).toBeGreaterThanOrEqual(7)
  })
})
