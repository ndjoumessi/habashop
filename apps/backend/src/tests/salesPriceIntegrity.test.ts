import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

// ⚠️ TICKET INTÉGRITÉ PRIX — ce test rejoue EXACTEMENT la requête forgée du probe manuel
// (price:1 sur un produit à 1300) et prouve que le trou est fermé : la vente enregistrée
// porte le PRIX SERVEUR (1300) + une TRACE de l'écart (submittedPrice/catalogPrice + flag).
// Miroir offline : un horodatage ancien honore le montant encaissé (1) MAIS trace aussi.

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
    product: { findMany: vi.fn() },
    customer: { findFirst: vi.fn() },
    sale: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: (fn: any) => fn(tx),
  }
  return { db, tx }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'CASHIER', tenantId: 'T1', userId: 'caissier-fraudeur' }; req.tenantId = 'T1' },
}))
vi.mock('../routes/notifications', () => ({ notifyTenant: vi.fn() }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { saleRoutes } from '../routes/sales'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(saleRoutes)
  await app.ready()
  return app
}

// « Café moulu 250g » à 1300 (le produit du probe manuel), pas de promo ni palier.
const COFFEE = { id: 'p1', name: 'Café moulu 250g', sellPrice: 1300, semiWholesalePrice: null, wholesalePrice: null, hasPromotion: false, promotionPrice: null, priceTiers: null, stockQty: 999 }

beforeEach(() => {
  vi.clearAllMocks()
  db.product.findMany.mockResolvedValue([COFFEE])
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false, posVatIncluded: true, vatRate: 18 })
  db.sale.findFirst.mockResolvedValue(null)
  tx.sale.create.mockResolvedValue({ id: 's1' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
})

const lastSaleItem = () => tx.saleItem.create.mock.calls.at(-1)![0].data
const lastSale = () => tx.sale.create.mock.calls.at(-1)![0].data

describe('POST /api/sales — intégrité prix (trou de fraude fermé)', () => {
  it('EN LIGNE : requête forgée price:1 (produit 1300) → FACTURE 1300 + trace de l’écart', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/sales',
      payload: { items: [{ productId: 'p1', qty: 1, price: 1 }], paymentMode: 'cash', total: 1, idempotencyKey: 'forge-1' },
    })
    expect(res.statusCode).toBe(200)
    // Prix SERVEUR facturé, pas le prix forgé.
    expect(lastSaleItem()).toMatchObject({ unitPrice: 1300, total: 1300, submittedPrice: 1, catalogPrice: 1300 })
    // Total entête serveur (D) = 1300, pas le total forgé (1).
    expect(lastSale().total).toBe(1300)
    // Flag d’audit posé.
    expect(lastSale().priceDivergence).toBe(true)
  })

  it('OFFLINE (horodatage ancien) : honore le montant encaissé (1) MAIS trace l’écart', async () => {
    const app = await buildApp()
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min → au-delà du seuil de rejeu
    const res = await app.inject({
      method: 'POST', url: '/api/sales',
      payload: { items: [{ productId: 'p1', qty: 1, price: 1 }], paymentMode: 'cash', total: 1, idempotencyKey: 'forge-2', clientCreatedAt: old },
    })
    expect(res.statusCode).toBe(200)
    // Montant réellement encaissé honoré (précision 1 : pas de re-tarification au rejeu)…
    expect(lastSaleItem()).toMatchObject({ unitPrice: 1, submittedPrice: 1, catalogPrice: 1300 })
    expect(lastSale().total).toBe(1)
    // … mais l’écart reste TRACÉ (c’est la trace qui protège, pas la branche).
    expect(lastSale().priceDivergence).toBe(true)
  })

  it('prix LÉGITIME (= sellPrice) → aucune divergence, aucune trace', async () => {
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/api/sales',
      payload: { items: [{ productId: 'p1', qty: 1, price: 1300 }], paymentMode: 'cash', total: 1300, idempotencyKey: 'legit-1' },
    })
    expect(lastSaleItem()).toMatchObject({ unitPrice: 1300, total: 1300 })
    expect(lastSaleItem().submittedPrice).toBeUndefined()
    expect(lastSaleItem().catalogPrice).toBeUndefined()
    expect(lastSale().priceDivergence).toBe(false)
  })

  it('prix de gros LÉGITIME (= wholesalePrice) DÉCLARÉ → accepté sans divergence', async () => {
    db.product.findMany.mockResolvedValue([{ ...COFFEE, wholesalePrice: 1000 }])
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/api/sales',
      payload: { items: [{ productId: 'p1', qty: 1, price: 1000, clientType: 'wholesale' }], paymentMode: 'cash', total: 1000, idempotencyKey: 'legit-2' },
    })
    expect(lastSaleItem()).toMatchObject({ unitPrice: 1000, total: 1000 })
    expect(lastSale().priceDivergence).toBe(false)
  })

  it('MÊME prix de gros mais ligne DÉTAIL → divergence, facturé au détail', async () => {
    // Le trou d'origine : le prix était accepté parce qu'il appartenait à UN tarif, sans
    // égard au tarif vendu. Un catalogue périmé dont l'ancien détail vaut le gros actuel
    // facturait donc le tarif de gros à un client détail, sans divergence ni trace.
    db.product.findMany.mockResolvedValue([{ ...COFFEE, wholesalePrice: 1000 }])
    const app = await buildApp()
    await app.inject({
      method: 'POST', url: '/api/sales',
      payload: { items: [{ productId: 'p1', qty: 1, price: 1000, clientType: 'retail' }], paymentMode: 'cash', total: 1000, idempotencyKey: 'legit-3' },
    })
    expect(lastSaleItem()).toMatchObject({ unitPrice: 1300, submittedPrice: 1000, catalogPrice: 1300 })
    expect(lastSale().priceDivergence).toBe(true)
  })
})
