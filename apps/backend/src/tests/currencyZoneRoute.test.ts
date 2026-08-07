import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

/**
 * ZONE FRANC CFA — le CÂBLAGE de la route, pas l'invariant pur.
 *
 * `currencyZone.test.ts` prouve la RÈGLE ; il ne peut RIEN dire de ce que la route en
 * demande. Le sabotage S3 du 2026-08-07 l'a montré : couper le couple EFFECTIF dans
 * `PATCH /api/tenant` (juger le corps reçu au lieu du pays déjà en base) laissait TOUTE la
 * suite verte — le chemin n'était exercé par personne.
 *
 * ⚠️ C'est le cas qui compte, et c'est celui qui manquait : un PATCH qui ne porte QUE
 * `currency` doit être jugé contre le pays DÉJÀ EN BASE. C'est par cette route qu'un `XAF`
 * est arrivé sur `demo-tenant-001` (`country = 'SN'`), sans audit, le 2026-08-07 à 13:50:57Z.
 */

const { db } = vi.hoisted(() => ({
  db: {
    tenant: { update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
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
}))
const { auditSpy } = vi.hoisted(() => ({ auditSpy: vi.fn() }))
// ⚠️ On ne REMPLACE pas `writeAudit`, on l'ESPIONNE : le mock délègue à l'implémentation
// réelle. Un mock qui ignorerait la promesse resterait vert même si `auditLog.create`
// n'était jamais appelé (la pastille qui ne peut pas rougir) ; et un mock qui l'attendrait
// SANS l'attraper prouverait le mock, pas le fail-open du vrai module.
vi.mock('../lib/writeAudit', async (orig) => {
  const reel = await orig<typeof import('../lib/writeAudit')>()
  return { writeAudit: (label: string, write: Promise<unknown>) => { auditSpy(label); return reel.writeAudit(label, write) } }
})
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { tenantRoutes } from '../routes/tenant'

/** ⚠️ Le mock APPLIQUE l'état demandé : un `findUnique` qui rend toujours la même chose
 *  resterait vert même si la route cessait de lire le pays en base. */
/** ⚠️ L'état « avant » doit être COMPLET : la trace compare toute la liste blanche
 *  (`currency/country/lang/vatRate`). Un mock partiel faisait apparaître `lang` et
 *  `vatRate` comme modifiés — un faux positif du test, pas du code. */
const enBase = (country: string, currency = 'XOF') =>
  db.tenant.findUnique.mockImplementation(async () => ({ id: 'T1', country, currency, lang: 'fr', vatRate: 18 }))

beforeEach(() => {
  vi.clearAllMocks()
  // ⚠️ `update` rend l'état APRÈS : la trace compare avant/après, un retour figé la viderait.
  db.tenant.update.mockImplementation(async (a: { data: Record<string, unknown> }) => ({
    id: 'T1', country: 'SN', currency: 'XOF', lang: 'fr', vatRate: 18,
    ...Object.fromEntries(Object.entries(a.data).filter(([, v]) => v !== undefined)),
  }))
  db.auditLog.create.mockResolvedValue({ id: 'a1' })
  enBase('SN', 'XOF')
})

const patch = async (body: Record<string, unknown>) => {
  const app = Fastify()
  await app.register(tenantRoutes)
  await app.ready()
  return app.inject({ method: 'PATCH', url: '/api/tenant', payload: body })
}

describe('PATCH /api/tenant — zone franc CFA sur le couple EFFECTIF', () => {
  it('REFUSE `currency: XAF` seul sur un tenant SN — le défaut réellement survenu', async () => {
    const res = await patch({ currency: 'XAF' })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CURRENCY_ZONE_MISMATCH')
    expect(db.tenant.update).not.toHaveBeenCalled()   // aucune écriture, pas seulement un code
  })

  it('le PAYS seul qui change de zone DÉRIVE la devise — décision du 2026-08-08', async () => {
    // ⚠️ Ce test affirmait l'inverse (400) jusqu'au 2026-08-08. Refuser les deux sens
    // verrouillait la boutique sur son couple : `country` et `currency` s'éditent sur deux
    // écrans qui n'envoient chacun que leur moitié, donc AUCUNE interface ne pouvait en
    // sortir. Le commerçant qui déménage n'a pas choisi un franc — on dérive.
    enBase('CM', 'XAF')
    const res = await patch({ country: 'SN' })
    expect(res.statusCode).toBe(200)
    const data = db.tenant.update.mock.calls.at(-1)![0].data as Record<string, unknown>
    expect(data.country).toBe('SN')
    expect(data.currency).toBe('XOF')
  })

  it('ACCEPTE le couple corrigé envoyé ensemble — la migration reste possible', async () => {
    const res = await patch({ country: 'CM', currency: 'XAF' })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.update.mock.calls.at(-1)![0].data.currency).toBe('XAF')
  })

  it('ACCEPTE `currency: XOF` sur un tenant SN — la correction elle-même passe', async () => {
    const res = await patch({ currency: 'XOF' })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.update.mock.calls.at(-1)![0].data.currency).toBe('XOF')
  })

  it('ACCEPTE EUR sur un tenant SN — e2e-tenant, SANS exemption nommée', async () => {
    const res = await patch({ currency: 'EUR' })
    expect(res.statusCode).toBe(200)
  })

  it('ne lit la base QUE si le couple est en jeu — pas de requête sur un PATCH de nom', async () => {
    const res = await patch({ name: 'Boutique' })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.findUnique).not.toHaveBeenCalled()
  })

  it('CONTRÔLE DISCRIMINANT — rougit sur SN/XAF et PAS sur CM/XAF', async () => {
    enBase('CM', 'XAF')
    expect((await patch({ currency: 'XAF' })).statusCode).toBe(200)
    enBase('SN', 'XOF')
    expect((await patch({ currency: 'XAF' })).statusCode).toBe(400)
  })
})


describe('PATCH /api/tenant — la TRACE, exercée et non déclarée', () => {
  it('un changement de devise ACCEPTÉ écrit un audit qui porte AVANT et APRÈS', async () => {
    const res = await patch({ currency: 'EUR' })
    expect(res.statusCode).toBe(200)
    expect(auditSpy).toHaveBeenCalledWith('TENANT_LOCALE_CHANGE')
    expect(db.auditLog.create).toHaveBeenCalledTimes(1)   // la promesse a bien été exécutée
    const d = db.auditLog.create.mock.calls[0][0].data
    expect(d.action).toBe('TENANT_LOCALE_CHANGE')
    expect(d.module).toBe('SETTINGS')
    expect(JSON.parse(d.description)).toEqual({ currency: { avant: 'XOF', apres: 'EUR' } })
  })

  it('⚠️ AUCUNE donnée personnelle dans la trace, même si le corps en porte', async () => {
    const res = await patch({
      currency: 'EUR', country: 'CI', lang: 'en', vatRate: 20,
      phone: '+221771234567', email: 'client@exemple.com', address: '12 rue Réelle', name: 'Chez Awa',
      ownerPhone: '+237699887766',
    })
    expect(res.statusCode).toBe(200)
    const brut = db.auditLog.create.mock.calls[0][0].data.description as string
    for (const fuite of ['221771234567', '237699887766', 'client@exemple.com', 'rue Réelle', 'Chez Awa']) {
      expect(brut).not.toContain(fuite)
    }
    expect(Object.keys(JSON.parse(brut)).sort()).toEqual(['country', 'currency', 'lang', 'vatRate'])
  })

  it('un PATCH qui ne CHANGE rien n’écrit pas de trace — un journal de bruit n’est pas un journal', async () => {
    const res = await patch({ currency: 'XOF' })   // déjà XOF en base
    expect(res.statusCode).toBe(200)
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })

  it('un PATCH REFUSÉ n’écrit ni la valeur ni la trace', async () => {
    const res = await patch({ currency: 'XAF' })
    expect(res.statusCode).toBe(400)
    expect(db.tenant.update).not.toHaveBeenCalled()
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })

  it('un PATCH hors périmètre audité (le nom seul) n’écrit pas de trace', async () => {
    const res = await patch({ name: 'Boutique' })
    expect(res.statusCode).toBe(200)
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('la trace est FAIL-OPEN, mais tracée', () => {
  it('un audit qui échoue ne fait pas échouer la sauvegarde du commerçant', async () => {
    // ⚠️ `writeAudit` est fail-open PAR CONCEPTION : l'action a réussi, un 500 parce que la
    // LIGNE D'AUDIT n'a pas pu s'écrire serait mensonger. Ce cas l'exerce — trois suites
    // existantes ont rendu 500 avant que leur mock ne porte `auditLog`, ce qui prouve que
    // l'argument de `writeAudit` est évalué AVANT lui : un throw synchrone le contourne.
    db.auditLog.create.mockImplementation(() => Promise.reject(new Error('redis/pg down')))
    const res = await patch({ currency: 'EUR' })
    expect(res.statusCode).toBe(200)
    expect(auditSpy).toHaveBeenCalledWith('TENANT_LOCALE_CHANGE')
  })
})
