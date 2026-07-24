import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

// ⚠️ EXPIRATION DE PROMOTION — bout en bout dans POST /api/sales.
// Avant : `promotionEnd` n'était appliqué NULLE PART → une promo « jusqu'au 31/05 » restait
// facturée en juillet (le champ ne terminait rien). Ce test prouve que le serveur, autoritaire
// sur le prix, facture le prix NORMAL une fois la promo expirée, et honore encore le prix promo
// le dernier jour (inclusif).

const { db, tx } = vi.hoisted(() => {
  const tx = {
    sale: { create: vi.fn() }, saleItem: { create: vi.fn() },
    product: { update: vi.fn() }, customer: { update: vi.fn() }, loyaltyTransaction: { create: vi.fn() },
  }
  const db = {
    tenant: { findUnique: vi.fn() }, product: { findMany: vi.fn() },
    customer: { findFirst: vi.fn() }, sale: { findFirst: vi.fn(), findMany: vi.fn() },
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

import { saleRoutes } from '../routes/sales'

async function buildApp(routes: (app: FastifyInstance) => Promise<void>) {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(routes)
  await app.ready()
  return app
}

// Riz : prix normal 1000, promo à 800 « jusqu'au 2020-01-01 » (largement expirée).
const rizPromoExpiree = {
  id: 'p1', name: 'Riz 5kg', stockQty: 999,
  sellPrice: 1000, semiWholesalePrice: null, wholesalePrice: null,
  hasPromotion: true, promotionPrice: 800, promotionEnd: new Date('2020-01-01T00:00:00.000Z'), priceTiers: null,
  previousPricing: null, pricingChangedAt: null,
}

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

async function vendre(price: number, key: string) {
  const app = await buildApp(saleRoutes)
  const res = await app.inject({
    method: 'POST', url: '/api/sales',
    payload: { items: [{ productId: 'p1', qty: 1, price }], paymentMode: 'cash', total: price, idempotencyKey: key },
  })
  expect(res.statusCode).toBe(200)
}

describe('POST /api/sales — expiration de promotion (le champ termine enfin la promo)', () => {
  it('promo EXPIRÉE : soumettre le prix promo (800) → prix NORMAL facturé (1000) + divergence tracée', async () => {
    db.product.findMany.mockResolvedValue([rizPromoExpiree])
    await vendre(800, 'promo-expiree')
    // Le prix promo périmé n'est plus un tarif légitime → re-tarifé au prix normal.
    expect(lastItem()).toMatchObject({ unitPrice: 1000, submittedPrice: 800, catalogPrice: 1000 })
    expect(lastSale().priceDivergence).toBe(true)
  })

  it('promo expirée : soumettre le prix NORMAL (1000) → aucune divergence', async () => {
    db.product.findMany.mockResolvedValue([rizPromoExpiree])
    await vendre(1000, 'promo-expiree-normal')
    expect(lastItem().submittedPrice).toBeUndefined()
    expect(lastItem().unitPrice).toBe(1000)
  })

  it('promo NON expirée (date de fin loin dans le futur) : prix promo 800 facturé, aucune divergence', async () => {
    db.product.findMany.mockResolvedValue([{ ...rizPromoExpiree, promotionEnd: new Date('2999-12-31T00:00:00.000Z') }])
    await vendre(800, 'promo-active')
    expect(lastItem().submittedPrice).toBeUndefined()
    expect(lastItem().unitPrice).toBe(800)
  })

  it('promo SANS date de fin : prix promo 800 facturé (comportement historique préservé)', async () => {
    db.product.findMany.mockResolvedValue([{ ...rizPromoExpiree, promotionEnd: null }])
    await vendre(800, 'promo-sans-fin')
    expect(lastItem().submittedPrice).toBeUndefined()
    expect(lastItem().unitPrice).toBe(800)
  })
})
