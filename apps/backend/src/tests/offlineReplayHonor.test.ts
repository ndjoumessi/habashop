import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

// ⚠️ REJEU HORS-LIGNE HONORÉ (option A, voie 1) — `docs/handoff/2026-07-25-rejeu-mobile-option-a-design.md`.
//
// Ce que ce fichier verrouille, et pourquoi chaque cas existe :
//
// Avant l'option A, `sales.ts` portait une branche DORMANTE (`honorClientPrice`) adossée à
// `clientCreatedAt`, un horodatage CLIENT. Personne ne l'émettait — mais réveillée, elle
// honorait N'IMPORTE QUEL prix soumis : 1 F pour un produit à 1300, sur un simple antidatage.
// Aucune borne, aucune appartenance à un tarif, rien.
//
// L'option A ne « ouvre » donc pas une porte : elle remplace une porte grande ouverte et non
// gardée par une porte ÉTROITE et SURVEILLÉE. L'honneur exige DEUX conditions cumulatives :
//   · `offlineReplay` — déclaré par le client, donc FALSIFIABLE (assumé) ;
//   · `staleCatalogAt` — fait SERVEUR : le montant soumis était réellement le prix du tarif
//     DÉCLARÉ il y a moins de 48 h. Le client ne peut pas le fabriquer.
// Ce que la falsifiabilité du drapeau permet réellement se réduit donc au delta d'un vrai
// changement de prix récent, sur les seuls produits concernés — tracé et auditable.
//
// L'ORDRE du bloc est load-bearing : la qualification doit être calculée AVANT la décision de
// facturation, sinon la décision retombe sur le seul drapeau. Le cas « HONORÉ » ci-dessous
// devient rouge si on ré-inverse l'ordre (sabotage vérifié).

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
  authenticate: async (req: Record<string, unknown>) => { req.user = { role: 'CASHIER', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/writeAudit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes, STALE_CATALOG_WINDOW_MS } from '../routes/sales'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(saleRoutes)
  await app.ready()
  return app
}

// Le prix DÉTAIL vient de passer de 1000 → 1200 il y a 6 h ; le tarif GROS est à 800 (inchangé).
const HIER = new Date(Date.now() - 6 * 60 * 60 * 1000)
const VIEUX = new Date(Date.now() - STALE_CATALOG_WINDOW_MS - 60_000)

const produit = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Café moulu 250g', stockQty: 999,
  sellPrice: 1200, semiWholesalePrice: null, wholesalePrice: 800,
  hasPromotion: false, promotionPrice: null, priceTiers: null,
  previousPricing: { sellPrice: 1000, semiWholesalePrice: null, wholesalePrice: 800, hasPromotion: false, promotionPrice: null, priceTiers: null },
  pricingChangedAt: HIER,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false, posVatIncluded: true, vatRate: 0 })
  db.sale.findFirst.mockResolvedValue(null)
  tx.sale.create.mockResolvedValue({ id: 's1' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
})

const lastItem = () => tx.saleItem.create.mock.calls.at(-1)![0].data
const lastSale = () => tx.sale.create.mock.calls.at(-1)![0].data

async function vendre(opts: {
  price: number; key: string
  clientType?: 'retail' | 'semi' | 'wholesale'
  offlineReplay?: boolean
}) {
  const app = await buildApp()
  const res = await app.inject({
    method: 'POST', url: '/api/sales',
    payload: {
      items: [{ productId: 'p1', qty: 1, price: opts.price, clientType: opts.clientType ?? 'retail' }],
      paymentMode: 'cash', total: opts.price, idempotencyKey: opts.key,
      ...(opts.offlineReplay === undefined ? {} : { offlineReplay: opts.offlineReplay }),
    },
  })
  expect(res.statusCode).toBe(200)
  return lastItem()
}

describe('POST /api/sales — rejeu hors-ligne : honorer, mais SEULEMENT dans le cadre', () => {
  // ── Le cas nominal : les deux conditions réunies ────────────────────────────
  it('HONORÉ : rejeu + prix = tarif DÉTAIL d’il y a 6 h → montant encaissé facturé, ligne marquée', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 1000, key: 'honor-1', offlineReplay: true })
    // L'argent suit ce qui a été encaissé au comptoir…
    expect(item).toMatchObject({ unitPrice: 1000, total: 1000, submittedPrice: 1000, catalogPrice: 1200 })
    expect(item.staleCatalogAt).toEqual(HIER)
    // … et la ligne le DIT : sans ce marqueur, l'audit ne distingue pas honoré de re-tarifé.
    expect(item.pricingHonored).toBe(true)
    // La trace de vente reste posée : honorer n'est pas absoudre.
    expect(lastSale().priceDivergence).toBe(true)
    expect(lastSale().total).toBe(1000)
  })

  // ── SABOTAGE 1 — honorer sans le drapeau ───────────────────────────────────
  // Si l'honneur ne dépendait plus de `offlineReplay`, ce cas (en ligne direct) serait honoré
  // et #145 tomberait : le serveur cesserait d'être autoritaire sur le prix EN LIGNE, et
  // `reconcileSaleTotal` n'aurait plus rien à signaler au caissier pendant que le client est là.
  it('EN LIGNE (sans drapeau) : même prix qualifié → RE-TARIFÉ, rien d’honoré (#145 intact)', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 1000, key: 'online-1' })
    expect(item).toMatchObject({ unitPrice: 1200, submittedPrice: 1000, catalogPrice: 1200, pricingHonored: false })
    expect(item.staleCatalogAt).toEqual(HIER) // qualifié quand même : la trace est indépendante
  })

  it('drapeau explicitement FALSE : re-tarifé', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 1000, key: 'online-2', offlineReplay: false })
    expect(item).toMatchObject({ unitPrice: 1200, pricingHonored: false })
  })

  // ── SABOTAGE 2 — honorer avec staleCatalogAt null ──────────────────────────
  // C'est LE garde-fou : sans lui, le drapeau (falsifiable) suffirait à facturer n'importe quoi.
  it('PRIX FORGÉ + rejeu : 1 F pour un produit à 1200 → NON qualifié → prix serveur facturé', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 1, key: 'forge-1', offlineReplay: true })
    expect(item.staleCatalogAt).toBeNull()
    expect(item).toMatchObject({ unitPrice: 1200, submittedPrice: 1, pricingHonored: false })
    expect(lastSale().total).toBe(1200)
  })

  it('HORS FENÊTRE (> 48 h) + rejeu : ancien tarif réel mais trop vieux → prix serveur facturé', async () => {
    db.product.findMany.mockResolvedValue([produit({ pricingChangedAt: VIEUX })])
    const item = await vendre({ price: 1000, key: 'vieux-1', offlineReplay: true })
    expect(item.staleCatalogAt).toBeNull()
    expect(item).toMatchObject({ unitPrice: 1200, pricingHonored: false })
  })

  it('AUCUN instantané de tarif précédent + rejeu : rien à qualifier → prix serveur facturé', async () => {
    db.product.findMany.mockResolvedValue([produit({ previousPricing: null, pricingChangedAt: null })])
    const item = await vendre({ price: 1000, key: 'noprev-1', offlineReplay: true })
    expect(item.staleCatalogAt).toBeNull()
    expect(item).toMatchObject({ unitPrice: 1200, pricingHonored: false })
  })

  // ── SABOTAGE 3 — honorer sur un AUTRE tarif ────────────────────────────────
  // L'invariant anti-coïncidence de #145 : l'ancien prix DÉTAIL (1000) soumis sur une ligne
  // GROSSISTE ne doit RIEN honorer. Sinon un caissier ferait payer le tarif de gros au détail,
  // ou l'inverse, en s'abritant derrière un vrai changement de prix.
  it('AUTRE TARIF : ancien prix DÉTAIL soumis sur une ligne GROSSISTE + rejeu → prix gros facturé', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 1000, key: 'cross-1', clientType: 'wholesale', offlineReplay: true })
    expect(item.staleCatalogAt).toBeNull()   // 1000 n'a jamais été le tarif GROS (800, inchangé)
    expect(item).toMatchObject({ unitPrice: 800, submittedPrice: 1000, catalogPrice: 800, pricingHonored: false })
  })

  it('AUTRE TARIF, sens inverse : prix GROS soumis sur une ligne DÉTAIL + rejeu → prix détail facturé', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 800, key: 'cross-2', clientType: 'retail', offlineReplay: true })
    expect(item.staleCatalogAt).toBeNull()
    expect(item).toMatchObject({ unitPrice: 1200, submittedPrice: 800, pricingHonored: false })
  })

  // ── SABOTAGE 6 — ligne honorée non tracée / non marquée ────────────────────
  it('une ligne HONORÉE reste intégralement TRACÉE (les deux prix + la date + le marqueur)', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 1000, key: 'trace-1', offlineReplay: true })
    expect(item.submittedPrice).toBe(1000)   // ce qui a été encaissé
    expect(item.catalogPrice).toBe(1200)     // ce que le serveur aurait facturé
    expect(item.staleCatalogAt).toEqual(HIER)
    expect(item.pricingHonored).toBe(true)
    expect(lastSale().priceDivergence).toBe(true)
  })

  it('une ligne SANS divergence ne porte aucun marqueur (pricingHonored absent, pas de trace)', async () => {
    db.product.findMany.mockResolvedValue([produit()])
    const item = await vendre({ price: 1200, key: 'clean-1', offlineReplay: true })
    expect(item.submittedPrice).toBeUndefined()
    expect(item.pricingHonored).toBeUndefined()
    expect(lastSale().priceDivergence).toBe(false)
  })

  // ── Vente MIXTE : le total diverge, donc le mobile devra avertir (cf. useOfflineSync) ──
  it('MIXTE : une ligne qualifiée + une forgée → seule la qualifiée est honorée', async () => {
    db.product.findMany.mockResolvedValue([
      produit(),
      produit({ id: 'p2', name: 'Sucre 1kg', sellPrice: 500, wholesalePrice: null, previousPricing: null, pricingChangedAt: null }),
    ])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/sales',
      payload: {
        items: [
          { productId: 'p1', qty: 1, price: 1000, clientType: 'retail' },
          { productId: 'p2', qty: 1, price: 50, clientType: 'retail' },
        ],
        paymentMode: 'cash', total: 1050, idempotencyKey: 'mix-1', offlineReplay: true,
      },
    })
    expect(res.statusCode).toBe(200)
    const rows = tx.saleItem.create.mock.calls.map(c => c[0].data)
    expect(rows[0]).toMatchObject({ unitPrice: 1000, pricingHonored: true })
    expect(rows[1]).toMatchObject({ unitPrice: 500, submittedPrice: 50, pricingHonored: false })
    // Total serveur = 1000 + 500 ≠ 1050 encaissé → le mobile doit écrire une entrée `repriced`.
    expect(lastSale().total).toBe(1500)
  })
})
