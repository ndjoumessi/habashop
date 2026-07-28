import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

// ⚠️ FILTRE SERVEUR « écarts honorés » — `GET /api/sales?pricingHonored=true`.
//
// Pourquoi il ne peut PAS rester côté client : l'historique POS charge 50 ventes. Un écart
// honoré vieux de quelques jours sort de cette fenêtre et devient INTROUVABLE. Or l'option A
// ne se défend que par sa contrepartie — l'écart est borné ET consultable. Une trace qu'on ne
// peut pas retrouver ne protège personne ; elle donne seulement l'illusion d'une surveillance.
//
// Ce fichier vérifie donc le filtre DANS LES DEUX SENS : la vente honorée hors fenêtre doit
// ressortir, et le filtre ignoré (sabotage) doit rendre le test rouge.

const { db } = vi.hoisted(() => ({
  db: {
    sale: { findMany: vi.fn() },
    tenant: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), findFirst: vi.fn() },
    customer: { findFirst: vi.fn() },
    $transaction: (fn: (t: unknown) => unknown) => fn({}),
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => { req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/writeAudit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes } from '../routes/sales'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(saleRoutes)
  await app.ready()
  return app
}

// Base simulée : 60 ventes ordinaires (plus récentes) + 1 vente HONORÉE ancienne, donc
// au-delà de la page de 50 que charge l'historique POS.
const VENTE_HONOREE = {
  id: 'vieille-honoree', total: 1000, priceDivergence: true,
  items: [{ unitPrice: 1000, submittedPrice: 1000, catalogPrice: 1200, pricingHonored: true }],
}
const ORDINAIRES = Array.from({ length: 60 }, (_, i) => ({
  id: `v${i}`, total: 500, priceDivergence: false,
  items: [{ unitPrice: 500, pricingHonored: false }],
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Le mock JOUE le rôle de la base : il applique réellement le `where` reçu. Un handler qui
  // n'enverrait pas le filtre récupérerait donc les 50 premières ventes ordinaires — c'est ce
  // qui rend le sabotage détectable, là où un mock renvoyant une liste figée resterait vert.
  type FindArgs = { take?: number; where?: { priceDivergence?: boolean; items?: { some?: { pricingHonored?: boolean } } } }
  db.sale.findMany.mockImplementation((args: FindArgs) => {
    const rows = [...ORDINAIRES, VENTE_HONOREE]
    const filtered = rows.filter(r => {
      if (args?.where?.priceDivergence === true && !r.priceDivergence) return false
      if (args?.where?.items?.some?.pricingHonored === true && !r.items.some(i => i.pricingHonored)) return false
      return true
    })
    return Promise.resolve(filtered.slice(0, Number(args?.take) || 50))
  })
})

const get = async (qs: string) => {
  const app = await buildApp()
  const res = await app.inject({ method: 'GET', url: `/api/sales${qs}` })
  expect(res.statusCode).toBe(200)
  return res.json() as Array<{ id: string }>
}

describe('GET /api/sales?pricingHonored=true', () => {
  it('LE cas : une vente honorée HORS de la fenêtre de 50 ressort quand même', async () => {
    // Sans filtre serveur, elle est noyée : la page ne contient que des ventes ordinaires.
    const sansFiltre = await get('')
    expect(sansFiltre.some(s => s.id === 'vieille-honoree')).toBe(false)
    // Avec le filtre, la base ne renvoie QUE les ventes honorées → elle est retrouvée.
    const avecFiltre = await get('?pricingHonored=true')
    expect(avecFiltre.map(s => s.id)).toContain('vieille-honoree')
  })

  it('transmet bien un filtre relationnel `items.some.pricingHonored` à la base', async () => {
    await get('?pricingHonored=true')
    expect(db.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'T1', items: { some: { pricingHonored: true } } }) }),
    )
  })

  it('accepte `1` comme `true` (même tolérance que priceDivergence)', async () => {
    expect((await get('?pricingHonored=1')).map(s => s.id)).toContain('vieille-honoree')
  })

  it('absent ou `false` → AUCUN filtre honoré (comportement historique inchangé)', async () => {
    for (const qs of ['', '?pricingHonored=false', '?pricingHonored=nope']) {
      await get(qs)
      const where = db.sale.findMany.mock.calls.at(-1)![0].where
      expect(where.items).toBeUndefined()
    }
  })

  it('cumulable avec priceDivergence — les deux filtres coexistent', async () => {
    await get('?priceDivergence=true&pricingHonored=true')
    const where = db.sale.findMany.mock.calls.at(-1)![0].where
    expect(where).toMatchObject({ priceDivergence: true, items: { some: { pricingHonored: true } } })
  })

  it('reste SCOPÉ au tenant : le filtre n’élargit jamais la portée', async () => {
    await get('?pricingHonored=true')
    expect(db.sale.findMany.mock.calls.at(-1)![0].where.tenantId).toBe('T1')
  })
})
