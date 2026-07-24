import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * INTÉGRITÉ PRIX — l'INTENTION TARIFAIRE fait foi (cases 2 & 3 du constat Chantier B).
 *
 * Le trou mesuré : `legitimatePrices` renvoyait l'ENSEMBLE des tarifs courants (détail /
 * demi-gros / gros) et acceptait le prix soumis s'il appartenait à N'IMPORTE LEQUEL —
 * volontairement « pas besoin du clientType ». Conséquence : un catalogue POS périmé dont
 * l'ancien prix DÉTAIL coïncide avec le prix de GROS actuel était facturé tel quel, sans
 * divergence, sans trace, et sans alerte de réconciliation (serverTotal == netTotal).
 * Un client détail payait le tarif de gros — montant faux, encaissé, silencieux, EN LIGNE.
 *
 * Le correctif : chaque ligne DÉCLARE le tarif depuis lequel son prix a été calculé, et le
 * serveur n'accepte que CE tarif-là.
 *
 * ⚠️ L'intention est portée par la LIGNE, pas par la vente : `applyPriceDrift` est une
 * action EXPLICITE du caissier (POS.tsx:362) — un panier constitué en Détail puis basculé
 * en Grossiste garde ses prix détail tant que le bouton n'est pas pressé. Un `clientType`
 * au niveau VENTE re-tariferait ces lignes légitimes vers le bas : on remplacerait un trou
 * par un autre. Le cas « DÉRIVE » ci-dessous verrouille ça.
 */

const { db, tx } = vi.hoisted(() => {
  const tx = {
    sale: { create: vi.fn() }, saleItem: { create: vi.fn() }, product: { update: vi.fn() },
    customer: { update: vi.fn() }, loyaltyTransaction: { create: vi.fn() },
  }
  const db = {
    tenant: { findUnique: vi.fn() }, product: { findMany: vi.fn() }, customer: { findFirst: vi.fn() },
    sale: { findFirst: vi.fn(), findMany: vi.fn() }, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  }
  return { db, tx }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: { user?: unknown; tenantId?: string }) => {
    req.user = { role: 'CASHIER', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1'
  },
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

/** Produit serveur : détail 1300, gros 1000 → l'ancien détail (1000) COÏNCIDE avec le gros actuel. */
const PROD = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Riz 5kg', sellPrice: 1300, semiWholesalePrice: null, wholesalePrice: 1000,
  hasPromotion: false, promotionPrice: null, promotionEnd: null, priceTiers: null,
  stockQty: 999, previousPricing: null, pricingChangedAt: null, ...over,
})

type Line = { productId: string; qty: number; price: number; clientType?: string; tierLabel?: string | null }
const post = async (items: Line[]) => {
  const app = await buildApp()
  return app.inject({
    method: 'POST', url: '/api/sales',
    payload: { items, paymentMode: 'cash', total: items.reduce((s, i) => s + i.price * i.qty, 0) },
  })
}
const item = () => tx.saleItem.create.mock.calls.at(-1)![0].data
const sale = () => tx.sale.create.mock.calls.at(-1)![0].data

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false, posVatIncluded: true, vatRate: 0 })
  db.sale.findFirst.mockResolvedValue(null)
  db.product.findMany.mockResolvedValue([PROD()])
  tx.sale.create.mockResolvedValue({ id: 's1' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
})

describe('CAS 1 — prix périmé hors de TOUT tarif (déjà correct, ne pas régresser)', () => {
  it('facture le prix serveur du tarif déclaré + trace', async () => {
    db.product.findMany.mockResolvedValue([PROD({ wholesalePrice: null })])
    await post([{ productId: 'p1', qty: 1, price: 1000, clientType: 'retail' }])
    expect(item().unitPrice).toBe(1300)
    expect(item().submittedPrice).toBe(1000)
    expect(item().catalogPrice).toBe(1300)
    expect(sale().priceDivergence).toBe(true)
  })
})

describe('CAS 2 — prix périmé qui COÏNCIDE avec un AUTRE tarif (le trou)', () => {
  it('client DÉTAIL soumettant 1000 (= gros actuel) → facturé 1300 + divergence + trace', async () => {
    await post([{ productId: 'p1', qty: 1, price: 1000, clientType: 'retail' }])
    expect(item().unitPrice).toBe(1300)
    expect(item().submittedPrice).toBe(1000)
    expect(sale().priceDivergence).toBe(true)
    expect(sale().total).toBe(1300)
  })

  it('TÉMOIN — une vraie vente de GROS à 1000 reste propre (pas de faux positif)', async () => {
    await post([{ productId: 'p1', qty: 1, price: 1000, clientType: 'wholesale' }])
    expect(item().unitPrice).toBe(1000)
    expect(item().submittedPrice).toBeUndefined()
    expect(sale().priceDivergence).toBeFalsy()
  })
})

describe('CAS 3 — produit hors catalogue serveur', () => {
  it('rejette 400 UNKNOWN_PRODUCT — jamais facturé au prix client', async () => {
    db.product.findMany.mockResolvedValue([])
    const res = await post([{ productId: 'fantome', qty: 1, price: 7, clientType: 'retail' }])
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('UNKNOWN_PRODUCT')
    expect(tx.sale.create).not.toHaveBeenCalled()
  })
})

describe('Rétro-compatibilité — aucun client existant ne doit casser', () => {
  it('clientType ABSENT (mobile, détail uniquement) + prix détail → accepté sans divergence', async () => {
    await post([{ productId: 'p1', qty: 1, price: 1300 }])
    expect(item().unitPrice).toBe(1300)
    expect(sale().priceDivergence).toBeFalsy()
  })

  it('clientType absent + prix de GROS → divergence (le défaut détail ne blanchit rien)', async () => {
    await post([{ productId: 'p1', qty: 1, price: 1000 }])
    expect(item().unitPrice).toBe(1300)
    expect(sale().priceDivergence).toBe(true)
  })
})

describe('Miroir exact du client — sinon on fabrique de faux positifs', () => {
  it('gros déclaré mais wholesalePrice NULL → le détail fait foi (repli `?? sellPrice` du POS)', async () => {
    db.product.findMany.mockResolvedValue([PROD({ wholesalePrice: null })])
    await post([{ productId: 'p1', qty: 1, price: 1300, clientType: 'wholesale' }])
    expect(item().unitPrice).toBe(1300)
    expect(sale().priceDivergence).toBeFalsy()
  })

  it('promo active → le prix promo prime sur le tarif déclaré', async () => {
    db.product.findMany.mockResolvedValue([PROD({ hasPromotion: true, promotionPrice: 900 })])
    await post([{ productId: 'p1', qty: 1, price: 900, clientType: 'wholesale' }])
    expect(item().unitPrice).toBe(900)
    expect(sale().priceDivergence).toBeFalsy()
  })

  it('palier de quantité → résolu sur la base du tarif déclaré', async () => {
    db.product.findMany.mockResolvedValue([PROD({ priceTiers: [{ minQty: 10, price: 800, label: 'x10' }] })])
    await post([{ productId: 'p1', qty: 12, price: 800, clientType: 'retail' }])
    expect(item().unitPrice).toBe(800)
    expect(sale().priceDivergence).toBeFalsy()
  })
})

describe('DÉRIVE — le piège que l\'intention au niveau VENTE aurait créé', () => {
  it('ligne figée en DÉTAIL dans un panier passé en gros → pas de re-tarification à la baisse', async () => {
    // Le caissier a basculé le sélecteur sur Grossiste sans presser « appliquer » :
    // la ligne garde son prix détail ET son intention détail.
    await post([{ productId: 'p1', qty: 1, price: 1300, clientType: 'retail' }])
    expect(item().unitPrice).toBe(1300)          // pas ramené à 1000
    expect(sale().priceDivergence).toBeFalsy()
  })
})

describe('Qualification « tarif précédent » — toujours opérante après le correctif', () => {
  it('ancien prix détail légitime + changement récent → staleCatalogAt renseigné', async () => {
    db.product.findMany.mockResolvedValue([PROD({
      wholesalePrice: null,
      pricingChangedAt: new Date(Date.now() - 3600_000),
      previousPricing: { sellPrice: 1000, semiWholesalePrice: null, wholesalePrice: null, hasPromotion: false, promotionPrice: null, priceTiers: null },
    })])
    await post([{ productId: 'p1', qty: 1, price: 1000, clientType: 'retail' }])
    expect(item().unitPrice).toBe(1300)
    expect(item().staleCatalogAt).toBeInstanceOf(Date)
  })
})
