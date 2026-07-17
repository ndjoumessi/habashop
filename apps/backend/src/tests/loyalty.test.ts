import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { pointsForAmount, tierForPoints } from '../lib/loyalty'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Helpers purs (règle + paliers)
// ─────────────────────────────────────────────────────────────────────────────
describe('loyalty — règle de gain (floor 1pt/1000)', () => {
  it('floor(montant/1000)', () => {
    expect(pointsForAmount(999)).toBe(0)
    expect(pointsForAmount(1000)).toBe(1)
    expect(pointsForAmount(2500)).toBe(2)   // 2,5 → floor 2
    expect(pointsForAmount(5000)).toBe(5)
  })
  it('montants invalides/négatifs → 0', () => {
    expect(pointsForAmount(0)).toBe(0)
    expect(pointsForAmount(-100)).toBe(0)
    expect(pointsForAmount(NaN)).toBe(0)
  })
  it('taux CONFIGURABLE par tenant (pointsPerUnit)', () => {
    expect(pointsForAmount(2500, 500)).toBe(5)    // 1 pt / 500 → 5 pts
    expect(pointsForAmount(2500, 2000)).toBe(1)   // 1 pt / 2000 → 1 pt
    expect(pointsForAmount(2500, 1)).toBe(2500)   // 1 pt / 1
    expect(pointsForAmount(1000, 0)).toBe(0)      // unité invalide (<1) → 0
  })
})
describe('loyalty — paliers configurables', () => {
  it('défauts 2000/5000 (rétro-compat)', () => {
    expect(tierForPoints(1999)).toBe('Bronze')
    expect(tierForPoints(2000)).toBe('Silver')
    expect(tierForPoints(5000)).toBe('Gold')
  })
  it('seuils CUSTOM par tenant', () => {
    // bronze=100, silver=300
    expect(tierForPoints(99, 100, 300)).toBe('Bronze')
    expect(tierForPoints(100, 100, 300)).toBe('Silver')
    expect(tierForPoints(299, 100, 300)).toBe('Silver')
    expect(tierForPoints(300, 100, 300)).toBe('Gold')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Créditage à la vente (POST /api/sales)
// ─────────────────────────────────────────────────────────────────────────────
const { db, tx } = vi.hoisted(() => {
  const tx = {
    sale: { create: vi.fn() },
    saleItem: { create: vi.fn() },
    product: { update: vi.fn() },
    customer: { update: vi.fn() },
    loyaltyTransaction: { create: vi.fn() },
  }
  return {
    tx,
    db: {
      sale: { findMany: vi.fn(), findFirst: vi.fn() },
      product: { findMany: vi.fn() },
      tenant: { findUnique: vi.fn() },
      customer: { findFirst: vi.fn() },
      $transaction: (fn: any) => fn(tx),
    },
  }
})
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: 'CASHIER', tenantId: req.headers['x-test-tenant'] ?? 'T1', userId: 'u1' }
    req.tenantId = req.user.tenantId
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
const PRODUCT = { id: 'p1', sellPrice: 2500, hasPromotion: false, promotionPrice: null, priceTiers: null, name: 'P1', stockQty: 10, stockMin: 2 }
const saleBody = (over: any = {}) => ({ items: [{ productId: 'p1', qty: 1, price: 2500 }], paymentMode: 'cash', total: 2500, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  db.product.findMany.mockResolvedValue([PRODUCT])
  // Tenant : inclut les champs loyalty v1 + v2 attendus par la route.
  db.tenant.findUnique.mockResolvedValue({
    enableLoyalty: true, pointsPerAmount: 1000,
    bronzeThreshold: 2000, silverThreshold: 5000,
    bronzeDiscount: 0, silverDiscount: 0, goldDiscount: 0, // v2 désactivé par défaut dans les tests
    name: 'TestShop', currency: 'XOF', lang: 'fr', enableAutoWhatsApp: false,
  })
  // Customer : pas de points → tier Bronze, remise v2 = 0 (activée séparément si besoin).
  db.customer.findFirst.mockResolvedValue({ loyaltyPoints: 0 })
  db.sale.findFirst.mockResolvedValue(null) // idempotency : pas de doublon
  tx.sale.create.mockResolvedValue({ id: 's1' })
  tx.saleItem.create.mockResolvedValue({})
  tx.product.update.mockResolvedValue({})
  tx.customer.update.mockResolvedValue({})
  tx.loyaltyTransaction.create.mockResolvedValue({})
})

describe('POST /api/sales — créditage fidélité', () => {
  it('client lié + loyalty ON → floor(total/1000) crédité + LoyaltyTransaction earn', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1' }) })
    expect(res.statusCode).toBe(200)
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c1' },
      data: expect.objectContaining({ totalRevenue: { increment: 2500 }, loyaltyPoints: { increment: 2 } }),
    }))
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 'T1', customerId: 'c1', saleId: 's1', points: 2, type: 'earn' }),
    }))
  })

  it('après remise : crédite sur le total PAYÉ (floor)', async () => {
    const app = await buildApp()
    // total payé = 3990 → floor(3990/1000) = 3 points
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1', total: 3990, items: [{ productId: 'p1', qty: 2, price: 2500 }] }) })
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ points: 3 }) }))
  })

  it('taux CONFIGURABLE du tenant : pointsPerAmount=500 → floor(2500/500)=5 pts', async () => {
    // Remises v2 à 0 → points calculés sur le total plein (isole le créditage du discount).
    db.tenant.findUnique.mockResolvedValue({ enableLoyalty: true, pointsPerAmount: 500, bronzeDiscount: 0, silverDiscount: 0, goldDiscount: 0 })
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1' }) })
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ loyaltyPoints: { increment: 5 } }),
    }))
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ points: 5 }) }))
  })

  it('loyalty OFF → aucun point, aucune LoyaltyTransaction', async () => {
    db.tenant.findUnique.mockResolvedValue({ enableLoyalty: false })
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1' }) })
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({ data: { totalRevenue: { increment: 2500 } } }))
  })

  it('pas de client lié → aucun créditage', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody() })
    expect(tx.customer.update).not.toHaveBeenCalled()
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
  })

  it('total < 1000 → 0 point, pas de ligne fidélité (mais revenu crédité)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/sales', payload: saleBody({ customerId: 'c1', total: 800, items: [{ productId: 'p1', qty: 1, price: 800 }] }) })
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled()
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({ data: { totalRevenue: { increment: 800 } } }))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Loyalty v2 — remises par palier (helpers purs)
// ─────────────────────────────────────────────────────────────────────────────
import {
  discountForTier, computeLoyaltyDiscount,
  DEFAULT_BRONZE_DISCOUNT, DEFAULT_SILVER_DISCOUNT, DEFAULT_GOLD_DISCOUNT,
  MAX_TOTAL_DISCOUNT_PCT,
} from '../lib/loyalty'

describe('discountForTier', () => {
  it('défauts 5/10/15 %', () => {
    expect(discountForTier('Bronze')).toBe(DEFAULT_BRONZE_DISCOUNT)
    expect(discountForTier('Silver')).toBe(DEFAULT_SILVER_DISCOUNT)
    expect(discountForTier('Gold')).toBe(DEFAULT_GOLD_DISCOUNT)
  })
  it('valeurs custom par tenant', () => {
    expect(discountForTier('Bronze', 3, 7, 12)).toBe(3)
    expect(discountForTier('Silver', 3, 7, 12)).toBe(7)
    expect(discountForTier('Gold',   3, 7, 12)).toBe(12)
  })
  it('0 si remise désactivée (valeur ≤ 0)', () => {
    expect(discountForTier('Bronze', 0, 10, 15)).toBe(0)
  })
})

describe('computeLoyaltyDiscount', () => {
  it('calcul standard', () => {
    expect(computeLoyaltyDiscount(10000, 10, 0)).toBe(1000)
    expect(computeLoyaltyDiscount(10000,  5, 0)).toBe(500)
  })
  it('retourne 0 si pas de remise fidélité', () => {
    expect(computeLoyaltyDiscount(10000, 0, 0)).toBe(0)
  })
  it(`plafond ${MAX_TOTAL_DISCOUNT_PCT}% : remise manuelle + fidélité ≤ 50%`, () => {
    // 40% manuel + 15% fidélité → fidélité plafonnée à 10% (total 50%)
    expect(computeLoyaltyDiscount(10000, 15, 4000)).toBe(1000)
  })
  it('sans client (discountPct=0) → 0', () => {
    expect(computeLoyaltyDiscount(10000, 0, 0)).toBe(0)
  })
})
