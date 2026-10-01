import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * DÉMO JETABLE EN LIBRE-SERVICE — on monte le VRAI handler ; seuls `db`, le quota et le
 * signeur sont mockés. On juge la DONNÉE ÉCRITE, pas le code HTTP.
 *
 * ⚠️ Le harnais monte Fastify SANS @fastify/jwt : `app.jwt` n'existe pas. Le handler passe
 * par `signActiveToken(app, …)`, qui est mocké — c'est pour cela que la forme du payload
 * est un MODULE et non une closure d'`authRoutes`.
 */
const { db, quota, signer, dataset } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    tenant: { create: vi.fn() },
    user: { create: vi.fn() },
    userTenant: { create: vi.fn() },
  },
  quota: {
    reserveDemoSlot: vi.fn(), releaseDemoSlot: vi.fn(),
    DEMO_QUOTA_EXCEEDED: 'DEMO_QUOTA_EXCEEDED', DEMO_QUOTA_UNAVAILABLE: 'DEMO_QUOTA_UNAVAILABLE',
  },
  // ⚠️ Paramètres TYPÉS : un `vi.fn(() => …)` sans paramètres donne un `mock.calls` de
  // type tuple VIDE, et `calls[0][1]` ne compile pas sous le `strict: true` du dépôt —
  // vitest, lui, passerait au vert. Test vert, CI rouge.
  signer: { signActiveToken: vi.fn((_app: unknown, _claims: Record<string, unknown>) => 'JETON-DEMO') },
  dataset: { buildDemoDataset: vi.fn(), DEMO_CATEGORIES: [] as string[] },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../lib/demoQuota', () => quota)
vi.mock('../lib/authToken', () => signer)
vi.mock('../lib/demoDataset', () => dataset)
vi.mock('../services/email', () => ({ sendWelcomeEmail: vi.fn() }))
/**
 * ⚠️ Espion qui DÉLÈGUE au module réel. Attester la seule VALEUR ne prouve rien : 18 est la
 * bonne valeur pour SN, donc un `vatRate: 18` en dur satisfaisait l'assertion — le sabotage
 * est réellement passé VERT au premier tir. Ce qui prouve la dérivation, c'est que la
 * fonction ait été APPELÉE avec le pays écrit.
 */
vi.mock('../lib/vatRate', async (orig) => {
  const reel = await orig() as { vatRateOrZero: (c: unknown) => number }
  return { vatRateOrZero: vi.fn(reel.vatRateOrZero) }
})

import { demoRoutes } from '../routes/demo'
import { sendWelcomeEmail } from '../services/email'
import { DEMO_ID_PREFIX } from '../lib/demoLifetime'
import { vatRateOrZero } from '../lib/vatRate'
import { isCurrencyZoneConflict } from '../lib/currencyZone'

/** Le `data` du dernier `tenant.create` — c'est la donnée écrite qu'on juge. */
function dernierTenant(): Record<string, unknown> {
  const appel = db.tenant.create.mock.calls.at(-1)
  if (!appel) throw new Error('aucun tenant.create — le handler n’a rien écrit')
  return (appel[0] as { data: Record<string, unknown> }).data
}

async function app() {
  const a = Fastify()
  a.setValidatorCompiler(validatorCompiler)
  a.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, b, d) =>
    d(null, b ? JSON.parse(String(b)) : {}))
  await a.register(demoRoutes)
  await a.ready()
  return a
}

beforeEach(() => {
  vi.clearAllMocks()
  quota.reserveDemoSlot.mockResolvedValue({ ok: true, failClosed: false })
  signer.signActiveToken.mockReturnValue('JETON-DEMO')
  dataset.buildDemoDataset.mockResolvedValue(undefined)
  // La transaction exécute réellement le callback avec le client mocké.
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(db))
  db.tenant.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }))
  db.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'u-demo', ...data }))
  db.userTenant.create.mockResolvedValue({})
})

describe('POST /api/demo/start', () => {
  it('crée un tenant isDemo, préfixé, avec une échéance', async () => {
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBe(201)
    const t = dernierTenant()
    expect(t.isDemo).toBe(true)
    expect(String(t.id).startsWith(DEMO_ID_PREFIX)).toBe(true)
    expect(t.demoExpiresAt).toBeInstanceOf(Date)
  })

  it('⚠️ le taux de TVA est DÉRIVÉ du pays, jamais un littéral', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const t = dernierTenant()
    // (a) la dérivation a EU LIEU, avec le pays réellement écrit — un littéral en dur, même
    //     juste, ne passe pas ici.
    expect(vatRateOrZero).toHaveBeenCalledWith(t.country)
    // (b) et la valeur écrite est bien celle que la règle rend.
    expect(t.vatRate).toBe(vatRateOrZero(String(t.country)))
  })

  it('⚠️ le couple pays/devise respecte la zone franc CFA', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const t = dernierTenant()
    expect(isCurrencyZoneConflict(String(t.country), String(t.currency))).toBe(false)
  })

  it('⚠️ les démos restent OUEST-africaines — pas le marché par défaut camerounais', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(dernierTenant().currency).toBe('XOF')
  })

  it('⚠️ AUCUN e-mail n’est émis — le compte n’a pas d’adresse réelle', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('l’e-mail du compte éphémère n’est pas routable, et le mot de passe est haché', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const appel = db.user.create.mock.calls.at(-1)
    const u = (appel![0] as { data: Record<string, unknown> }).data
    expect(String(u.email)).toMatch(/@demo\.local$/)
    expect(String(u.passwordHash).length).toBeGreaterThan(20)
  })

  it('renvoie la forme de /api/auth/register : token + user + tenant', async () => {
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const c = r.json()
    expect(Object.keys(c).sort()).toEqual(['tenant', 'token', 'user'])
    expect(c.token).toBe('JETON-DEMO')
    expect(c.tenant.demoExpiresAt).toBeTruthy() // le front affiche l'échéance SERVEUR
  })

  it('le jeu de données est écrit DANS la transaction, avec le cashier créé', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(dataset.buildDemoDataset).toHaveBeenCalledTimes(1)
    expect(dataset.buildDemoDataset.mock.calls[0][1]).toMatchObject({ cashierId: 'u-demo' })
  })

  it('⚠️ un échec du jeu de données fait ÉCHOUER la requête — pas de tenant à moitié peuplé', async () => {
    dataset.buildDemoDataset.mockRejectedValueOnce(new Error('disque plein'))
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(r.statusCode).not.toBe(201)
  })

  it('plafond atteint → 429 avec un code explicite, jamais un 500', async () => {
    quota.reserveDemoSlot.mockResolvedValue({ ok: false, failClosed: false })
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBe(429)
    expect(r.json().code).toBe('DEMO_QUOTA_EXCEEDED')
    expect(db.tenant.create).not.toHaveBeenCalled()
  })

  /**
   * ⚠️ Redis indisponible → REFUS, et un refus DISTINCT du plafond atteint.
   *
   * La première version passait (fail-open), sur le raisonnement « le plafond par IP borne
   * toujours ». Faux : `trustProxy: true` rend la clé de rate-limit contrôlable par
   * l'appelant. Sans Redis, rien ne bornait la création de tenants en production.
   *
   * ⚠️ Et le code de refus est DIFFÉRENT : « le compteur est indisponible » n'est pas « trop
   * de démos aujourd'hui ». Les fondre dirait au visiteur une chose fausse, et priverait
   * l'exploitant du signal qui distingue un incident d'un afflux.
   */
  it('⚠️ Redis KO → 503 DEMO_QUOTA_UNAVAILABLE, distinct du 429, et rien n’est écrit', async () => {
    quota.reserveDemoSlot.mockResolvedValue({ ok: false, failClosed: true })
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBe(503)
    expect(r.json().code).toBe('DEMO_QUOTA_UNAVAILABLE')
    expect(db.tenant.create).not.toHaveBeenCalled()
  })

  it('⚠️ une création qui ÉCHOUE rend son créneau — sinon le compteur mesure les tentatives', async () => {
    dataset.buildDemoDataset.mockRejectedValueOnce(new Error('disque plein'))
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(quota.releaseDemoSlot).toHaveBeenCalledTimes(1)
  })

  it('une création RÉUSSIE ne rend pas son créneau', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(quota.releaseDemoSlot).not.toHaveBeenCalled()
  })

  it('⚠️ le jeton est signé pour LE tenant créé — pas pour un autre', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const t = dernierTenant()
    expect(signer.signActiveToken.mock.calls[0][1]).toMatchObject({ userId: 'u-demo', tenantId: t.id })
  })
})
