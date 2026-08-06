import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * VERROU — `lastLoginAt` est ÉCRIT à la connexion.
 *
 * ─── LE DÉFAUT QU'ON FERME ───────────────────────────────────────────────────
 * MESURÉ le 2026-08-06 : la colonne `lastLoginAt` est déclarée depuis toujours
 * (`schema.prisma:158`) et n'était écrite NULLE PART dans `apps/backend/src`. En
 * production : **0 des 8 comptes** renseigné. L'écran Utilisateurs affichait donc
 * « Connexion : Jamais » pour tout le monde, y compris pour celui qui venait de se
 * connecter, et `isOnlineNow()` — qui alimentait la pastille verte, son halo, la bordure
 * de carte et le libellé « En ligne » — ne pouvait STRUCTURELLEMENT jamais rendre `true`.
 *
 * ⚠️ POURQUOI CE TEST EXISTE À CÔTÉ DE `measuredNotDeclared.test.ts` (front) : ce
 * défaut-là est INVISIBLE pour un scanner de source. Rien n'est faux dans le code — le
 * champ est bien déclaré, bien lu, bien rendu. Ce qui manque est une ÉCRITURE, c'est-à-dire
 * une absence, et une absence n'a pas de forme à détecter. Seul un test qui exerce la
 * route peut l'affirmer. Même famille que le smoke de version : un test unitaire ne voit
 * pas une régression d'environnement, un scanner ne voit pas un fait manquant.
 *
 * On exerce la VRAIE route `POST /api/auth/login` avec Prisma mocké et on assert sur
 * l'APPEL RÉELLEMENT ÉMIS — pas sur la présence du mot `lastLoginAt` dans le source, qui
 * resterait vert si le bloc devenait inatteignable.
 */

const SECRET = 'test-last-login'
const HASH = 'hash-valide'

const utilisateur = {
  id: 'u1', name: 'Awa', email: 'awa@x.com', passwordHash: HASH,
  role: 'ADMIN', tenantId: 'A', isActive: true, isPlatformAdmin: false,
}

const db = {
  user: {
    findUnique: vi.fn(async () => utilisateur),
    update: vi.fn(async () => utilisateur),
    findMany: vi.fn(async () => []),
  },
  // ⚠️ `findFirst` ET `findUnique` : `accessibleTenants` appelle `tenant.findFirst`.
  // Un mock incomplet fait échouer pour la MAUVAISE raison — ici un 500 « findFirst is
  // not a function » qui ressemblait à un refus de la route. Vu au premier tir.
  tenant: {
    findUnique: vi.fn(async () => ({ id: 'A', name: 'Boutique A' })),
    findFirst:  vi.fn(async () => ({ id: 'A', name: 'Boutique A' })),
  },
  userTenant: { findMany: vi.fn(async () => []) },
}
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))

// ⚠️ Le mock APPLIQUE SES DEUX arguments — dont le MOT DE PASSE EN CLAIR.
// Première version écrite : `(_clair, hash) => hash === HASH`. Elle rendait `true` quel
// que soit le mot de passe, donc le cas « mot de passe faux » ne testait rien du tout. Un
// mock qui ignore l'argument sur lequel porte l'assertion décrit un monde qui n'existe
// pas (§ Mock qui ignore ses arguments) — ici il aurait certifié qu'on n'écrit pas sur un
// échec, en n'ayant jamais produit d'échec.
const MOT_DE_PASSE = 'motdepasse'
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(async (clair: string, hash: string) => hash === HASH && clair === MOT_DE_PASSE) },
}))

let app: FastifyInstance

beforeAll(async () => {
  const { authRoutes } = await import('../routes/auth')
  app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(jwt, { secret: SECRET })
  await app.register(authRoutes)
  await app.ready()
})

beforeEach(() => {
  vi.clearAllMocks()
  db.user.findUnique.mockResolvedValue(utilisateur)
  db.user.update.mockResolvedValue(utilisateur)
  db.tenant.findUnique.mockResolvedValue({ id: 'A', name: 'Boutique A' })
  db.tenant.findFirst.mockResolvedValue({ id: 'A', name: 'Boutique A' })
  db.userTenant.findMany.mockResolvedValue([])
})

const login = (email = 'awa@x.com', password = MOT_DE_PASSE) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })

describe('la connexion laisse une trace', () => {
  it('une connexion RÉUSSIE écrit lastLoginAt sur le bon compte', async () => {
    const res = await login()
    expect(res.statusCode).toBe(200)

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      }),
    )
  })

  it('la date écrite est CELLE DU MOMENT, pas une valeur arbitraire', async () => {
    const avant = Date.now()
    await login()
    const apres = Date.now()

    // ⚠️ Passage par `unknown` : `vi.fn(async () => …)` n'a pas de paramètres typés, donc
    // `mock.calls` est un tuple VIDE pour TS et un `as` direct est refusé (TS2352/TS2493).
    // Les tests étaient VERTS et `tsc` ROUGE — or c'est `tsc` qui décide du déploiement.
    const appel = (db.user.update.mock.calls as unknown as [{ data: { lastLoginAt: Date } }][])[0][0]
    const t = appel.data.lastLoginAt.getTime()
    // Bornes larges : on prouve que c'est un instant courant, pas qu'on connaît l'horloge.
    expect(t).toBeGreaterThanOrEqual(avant)
    expect(t).toBeLessThanOrEqual(apres)
  })

  it('un MOT DE PASSE FAUX n’écrit rien — une tentative n’est pas une connexion', async () => {
    const res = await login('awa@x.com', 'mauvais')
    // ⚠️ Le mock de bcrypt applique son argument : c'est la route qui décide, pas le mock.
    expect(res.statusCode).toBe(401)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('un COMPTE DÉSACTIVÉ n’écrit rien', async () => {
    db.user.findUnique.mockResolvedValue({ ...utilisateur, isActive: false })
    const res = await login()
    expect(res.statusCode).toBe(403)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('un EMAIL INCONNU n’écrit rien', async () => {
    db.user.findUnique.mockResolvedValue(null as never)
    const res = await login('personne@x.com')
    expect(res.statusCode).toBe(401)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('FAIL-OPEN : une écriture qui échoue ne refuse PAS l’authentification', async () => {
    // ⚠️ Choix délibéré : un incident sur une colonne d'AFFICHAGE ne doit pas empêcher un
    // commerçant d'ouvrir sa caisse. Le refus appartient aux gardes (mot de passe, compte
    // actif), jamais à une statistique. Le test fige ce choix pour qu'il ne dérive pas
    // vers un fail-closed « par prudence » qui coûterait une journée de vente.
    db.user.update.mockRejectedValue(new Error('base indisponible') as never)
    const res = await login()
    expect(res.statusCode).toBe(200)
  })
})
