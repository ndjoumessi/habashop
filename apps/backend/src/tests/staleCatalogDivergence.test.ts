import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

// ⚠️ QUALIFICATION D'UNE DIVERGENCE DE PRIX — Chantier B (fraîcheur du cache POS).
//
// Mesuré en phase 0 (docs/handoff/2026-07-24-chantier-b-cache-pos.md) : quand un prix change,
// un terminal encore sur un catalogue en cache soumet l'ANCIEN prix. Le serveur re-tarife (donc
// l'argent est juste) mais pose `priceDivergence=true` → la vente remontait dans l'écran d'audit
// ADMIN exactement comme un prix FORGÉ. Un cache périmé accusait un caissier honnête.
//
// Ce test verrouille la distinction, et surtout sa BORNE : appartenir aux tarifs précédents ne
// suffit pas, il faut que le changement soit assez récent pour qu'un cache l'explique. Sans cette
// borne, un prix arbitrairement ancien se ferait qualifier et l'audit exonérerait une vraie fraude.

const { db, tx } = vi.hoisted(() => {
  const tx = {
    sale: { create: vi.fn() },
    saleItem: { create: vi.fn() },
    product: { update: vi.fn() },
    customer: { update: vi.fn() },
    loyaltyTransaction: { create: vi.fn() },
  }
  const db = {
    tenant: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    customer: { findFirst: vi.fn() },
    sale: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  }
  return { db, tx }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => { req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/writeAudit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes, STALE_CATALOG_WINDOW_MS } from '../routes/sales'
import { productRoutes } from '../routes/products'

async function buildApp(routes: (app: FastifyInstance) => Promise<void>) {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(routes)
  await app.ready()
  return app
}

// Produit dont le prix détail vient de passer de 1000 → 1200.
const HIER = new Date(Date.now() - 6 * 60 * 60 * 1000)          // dans la fenêtre (6 h)
const VIEUX = new Date(Date.now() - STALE_CATALOG_WINDOW_MS - 60_000) // hors fenêtre

const produit = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Café moulu 250g', stockQty: 999,
  sellPrice: 1200, semiWholesalePrice: null, wholesalePrice: null,
  hasPromotion: false, promotionPrice: null, priceTiers: null,
  previousPricing: { sellPrice: 1000, semiWholesalePrice: null, wholesalePrice: null, hasPromotion: false, promotionPrice: null, priceTiers: null },
  pricingChangedAt: HIER,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false, posVatIncluded: true, vatRate: 18 })
  db.sale.findFirst.mockResolvedValue(null)
  tx.sale.create.mockResolvedValue({ id: 's1' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
})

const lastSaleItem = () => tx.saleItem.create.mock.calls.at(-1)![0].data

async function vendre(price: number, key: string, clientType: 'retail' | 'semi' | 'wholesale' = 'retail') {
  const app = await buildApp(saleRoutes)
  const res = await app.inject({
    method: 'POST', url: '/api/sales',
    payload: { items: [{ productId: 'p1', qty: 1, price, clientType }], paymentMode: 'cash', total: price, idempotencyKey: key },
  })
  expect(res.statusCode).toBe(200)
  return lastSaleItem()
}

describe('POST /api/sales — qualification « tarif précédent » vs divergence non qualifiée', () => {
  it('CACHE PÉRIMÉ : prix soumis = tarif catalogue précédent, changé récemment → QUALIFIÉ (et facturation inchangée)', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre(1000, 'stale-1')
    // La qualification porte la DATE du changement — un fait à présenter, pas un verdict.
    expect(item.staleCatalogAt).toEqual(HIER)
    // ⚠️ L'argent ne bouge PAS : le serveur facture toujours son prix courant.
    expect(item).toMatchObject({ unitPrice: 1200, submittedPrice: 1000, catalogPrice: 1200 })
  })

  it('PRIX FORGÉ : prix soumis n’a jamais été un tarif (ni courant, ni précédent) → NON qualifié', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre(1, 'forge-1')
    expect(item.staleCatalogAt).toBeNull()
    expect(item).toMatchObject({ unitPrice: 1200, submittedPrice: 1 })
  })

  // LE cas qui compte : sans la borne temporelle, ce prix serait qualifié et l'écran
  // d'audit présenterait une vraie fraude comme un simple cache périmé.
  it('ANTI-EXONÉRATION : prix = tarif précédent mais changement HORS fenêtre → NON qualifié', async () => {
    db.product.findMany.mockResolvedValue([produit({ pricingChangedAt: VIEUX })])
    const item = await vendre(1000, 'vieux-1')
    expect(item.staleCatalogAt).toBeNull()
  })

  it('produit sans instantané (jamais re-tarifé) → NON qualifié, aucun plantage', async () => {
    db.product.findMany.mockResolvedValue([produit({ previousPricing: null, pricingChangedAt: null })])
    const item = await vendre(1000, 'sans-snap')
    expect(item.staleCatalogAt).toBeNull()
  })

  it('AUCUNE divergence (prix courant) → aucune trace ni qualification', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre(1200, 'ok-1')
    expect(item.submittedPrice).toBeUndefined()
    expect(item.catalogPrice).toBeUndefined()
    expect(item.staleCatalogAt).toBeUndefined()
  })

  it('le tarif précédent du MÊME point de tarif (gros déclaré) est qualifié', async () => {
    db.product.findMany.mockResolvedValue([produit({
      previousPricing: { sellPrice: 1000, semiWholesalePrice: null, wholesalePrice: 800, hasPromotion: false, promotionPrice: null, priceTiers: null },
    })])
    const item = await vendre(800, 'gros-1', 'wholesale')
    expect(item.staleCatalogAt).toEqual(HIER)
  })

  it('ancien prix de GROS soumis sur une ligne DÉTAIL → NON qualifié', async () => {
    // La qualification suit le tarif DÉCLARÉ. Accepter « un ancien tarif quelconque »
    // rouvrirait côté audit le trou fermé côté facturation : un écart inexpliqué serait
    // blanchi par un prix qui n'a jamais été celui de ce tarif-là.
    db.product.findMany.mockResolvedValue([produit({
      previousPricing: { sellPrice: 1000, semiWholesalePrice: null, wholesalePrice: 800, hasPromotion: false, promotionPrice: null, priceTiers: null },
    })])
    const item = await vendre(800, 'gros-2', 'retail')
    expect(item.staleCatalogAt).toBeNull()
  })
})

describe('PUT /api/products/:id — instantané des tarifs précédents', () => {
  const existant = { sellPrice: 1000, semiWholesalePrice: null, wholesalePrice: null, hasPromotion: false, promotionPrice: null, priceTiers: null }

  const put = async (payload: Record<string, unknown>) => {
    const app = await buildApp(productRoutes)
    db.product.findFirst.mockResolvedValue(existant)
    db.product.update.mockResolvedValue({ id: 'p1' })
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', payload })
    expect(res.statusCode).toBe(200)
    return db.product.update.mock.calls.at(-1)![0].data
  }

  it('changement de prix → instantané du jeu SORTANT + date serveur', async () => {
    const data = await put({ sellPrice: 1200 })
    expect(data.previousPricing).toMatchObject({ sellPrice: 1000 })
    expect(data.pricingChangedAt).toBeInstanceOf(Date)
  })

  it('écriture NON tarifaire (renommage) → instantané NON consommé', async () => {
    const data = await put({ name: 'Café moulu 250 g' })
    expect(data.previousPricing).toBeUndefined()
    expect(data.pricingChangedAt).toBeUndefined()
  })

  it('PUT qui renvoie le MÊME prix → instantané non consommé', async () => {
    const data = await put({ sellPrice: 1000 })
    expect(data.previousPricing).toBeUndefined()
  })

  it('un client ne peut PAS forger l’instantané (hors liste blanche)', async () => {
    const data = await put({ name: 'X', previousPricing: { sellPrice: 1 }, pricingChangedAt: new Date().toISOString() })
    expect(data.previousPricing).toBeUndefined()
    expect(data.pricingChangedAt).toBeUndefined()
  })
})

/**
 * PROFONDEUR 1 — la limite qui décide si l'ARGENT peut s'y adosser.
 *
 * L'instantané ne retient QUE le jeu de tarifs sortant du DERNIER changement. Après deux
 * changements rapprochés, le prix d'avant-avant n'est plus reconnaissable : le mécanisme
 * répond « non concluant », ce qui doit dégrader vers la re-tarification (comportement
 * historique, sûr) et JAMAIS vers une exonération par défaut.
 *
 * On rejoue ici la CHAÎNE réelle : deux PUT successifs, puis des ventes aux trois prix.
 */
describe('PROFONDEUR 1 — deux changements successifs', () => {
  const put = async (existant: Record<string, unknown>, payload: Record<string, unknown>) => {
    const app = await buildApp(productRoutes)
    db.product.findFirst.mockResolvedValue(existant)
    db.product.update.mockResolvedValue({ id: 'p1' })
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', payload })
    expect(res.statusCode).toBe(200)
    return db.product.update.mock.calls.at(-1)![0].data
  }
  const nu = (sellPrice: number) => ({ sellPrice, semiWholesalePrice: null, wholesalePrice: null, hasPromotion: false, promotionPrice: null, priceTiers: null })

  it('le 2e changement ÉCRASE l’instantané : il retient 1200, pas 1000', async () => {
    const apres1 = await put(nu(1000), { sellPrice: 1200 })
    expect(apres1.previousPricing).toMatchObject({ sellPrice: 1000 })
    const apres2 = await put(nu(1200), { sellPrice: 1400 })
    expect(apres2.previousPricing).toMatchObject({ sellPrice: 1200 })
    expect(apres2.previousPricing).not.toMatchObject({ sellPrice: 1000 })
  })

  it('vente au prix IMMÉDIATEMENT précédent (1200) → qualifiée', async () => {
    db.product.findMany.mockResolvedValue([produit({ sellPrice: 1400, previousPricing: nu(1200), pricingChangedAt: HIER })])
    const item = await vendre(1200, 'prof-1')
    expect(item.unitPrice).toBe(1400)          // facturation INCHANGÉE : prix serveur
    expect(item.staleCatalogAt).toEqual(HIER)  // mais l'écart est EXPLIQUÉ
  })

  it('vente au prix d’AVANT-AVANT (1000) → NON qualifiée : dégrade vers re-tarifer', async () => {
    db.product.findMany.mockResolvedValue([produit({ sellPrice: 1400, previousPricing: nu(1200), pricingChangedAt: HIER })])
    const item = await vendre(1000, 'prof-2')
    expect(item.unitPrice).toBe(1400)
    expect(item.staleCatalogAt).toBeNull()     // non concluant ⇒ jamais une innocence
    expect(item.submittedPrice).toBe(1000)     // la trace subsiste pour l'audit
  })

  it('⚠️ un terminal resté 3 jours hors-ligne retombe donc sur « non qualifié »', async () => {
    // Deux effets se cumulent : la fenêtre de 48 h ET la profondeur 1. C'est la borne
    // de ce mécanisme — toute décision de facturation qui s'y adosse hérite d'elle.
    db.product.findMany.mockResolvedValue([produit({ sellPrice: 1400, previousPricing: nu(1200), pricingChangedAt: VIEUX })])
    const item = await vendre(1200, 'prof-3')
    expect(item.staleCatalogAt).toBeNull()
  })
})
