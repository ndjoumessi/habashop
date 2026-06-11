import type { FastifyInstance } from 'fastify'
import type { SaleBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'
import { invalidateTenantCache } from '../lib/cache'
import { resolveTierPrice, type PriceTier } from '../utils/pricing'
import { pointsForAmount, tierForPoints, discountForTier, computeLoyaltyDiscount } from '../lib/loyalty'
import { buildInvoicePdf, nextInvoiceNumber } from '../lib/invoicePdf'
import { resolvePaymentSplit } from '../lib/paymentSplit'
import { sendSaleWhatsApp } from '../services/whatsappSend'

// Remboursement réservé MANAGER + ADMIN (+ SUPER_ADMIN superset) — anti-fraude :
// le caissier ne peut PAS rembourser. Helper pur exporté pour les tests.
export const REFUND_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const
export const canRefund = (role?: string): boolean => REFUND_ROLES.includes(role as never)

// Erreur interne pour aborter la transaction quand la course d'idempotence est perdue.
class RefundConflict extends Error {}

export async function saleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }
    return prisma.sale.findMany({
      where: { tenantId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    })
  })

  app.post('/api/sales', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { items, paymentMode, total, discount, customerId, mtnMomoReference } = request.body as SaleBody

    if (!items?.length) {
      return reply.code(400).send({ error: 'Une vente doit contenir au moins un article' })
    }
    if (total == null || total < 0) {
      return reply.code(400).send({ error: 'Le total ne peut pas être négatif' })
    }

    const body = request.body as SaleBody
    const manualDiscount = Number(discount?.amount) || 0

    // ── Config tenant (fidélité + remises paliers, + WhatsApp/devise pour l'après-vente) ──
    const tCfg = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        enableLoyalty: true, pointsPerAmount: true, bronzeThreshold: true, silverThreshold: true,
        bronzeDiscount: true, silverDiscount: true, goldDiscount: true,
        name: true, currency: true, lang: true, enableAutoWhatsApp: true,
      },
    })
    const loyaltyOn = !!tCfg?.enableLoyalty

    // ── Loyalty v2 : remise auto selon le palier du client lié (plafonnée 50%) ──
    let loyaltyDiscount = 0
    if (customerId && loyaltyOn) {
      const cust = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { loyaltyPoints: true } })
      const tier = tierForPoints(cust?.loyaltyPoints ?? 0, tCfg?.bronzeThreshold ?? undefined, tCfg?.silverThreshold ?? undefined)
      const pct = discountForTier(tier, tCfg?.bronzeDiscount ?? undefined, tCfg?.silverDiscount ?? undefined, tCfg?.goldDiscount ?? undefined)
      loyaltyDiscount = computeLoyaltyDiscount(total, pct, manualDiscount)
    }
    const finalTotal = Math.max(0, total - loyaltyDiscount)

    // ── Ventilation paiement (sur le total NET après remise fidélité) ──
    const split = resolvePaymentSplit(paymentMode ?? 'cash', finalTotal, body)
    if ('error' in split) {
      const msg = split.error === 'MIXED_NEEDS_TWO'
        ? 'Un paiement mixte requiert au moins 2 modes'
        : 'La somme des paiements doit égaler le total'
      return reply.code(400).send({ error: msg, code: split.error })
    }

    // ── Idempotence : clé envoyée par le client (body ou header Idempotency-Key) ──
    // Pas de clé → comportement historique inchangé (rétro-compat).
    const idempotencyKey =
      String((request.body as SaleBody)?.idempotencyKey ?? request.headers['idempotency-key'] ?? '').trim() || null

    // Renvoi en double (retry/resync) : la vente existe déjà → on la renvoie SANS
    // re-créer (pas de re-décrément stock ni re-créditage fidélité).
    if (idempotencyKey) {
      const existing = await prisma.sale.findFirst({ where: { tenantId, idempotencyKey } })
      if (existing) return existing
    }

    // Pré-fetch des produits pour recalculer prix unitaire côté backend (sécurité tier/promo)
    const productIds = items.map((i: any) => i.productId)
    const productsList = await prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, sellPrice: true, hasPromotion: true, promotionPrice: true, priceTiers: true },
    })
    const productMap = new Map(productsList.map(p => [p.id, p]))

    let newSale
    try {
      newSale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          cashierId: userId,
          total: finalTotal,             // NET = total − remise fidélité (Modèle A)
          paymentMode,
          discountAmount: discount?.amount ?? 0,
          discountType: discount?.type ?? null,
          customerId: customerId ?? null,
          idempotencyKey,
          loyaltyDiscount: loyaltyDiscount,
          cashAmount: split.cashAmount,
          mobileMoneyAmount: split.mobileMoneyAmount,
          cardAmount: split.cardAmount,
          mtnMomoReference: mtnMomoReference ?? null,
        },
      })

      for (const item of items) {
        const product = productMap.get(item.productId)
        // basePrice = ce que le frontend a calculé (inclut le tarif client retail/semi/wholesale)
        // Si le produit existe, on applique tier + promo par-dessus (sécurité backend).
        const frontendBasePrice = Number(item.price) || 0
        let unitPrice = frontendBasePrice
        let tierLabel: string | undefined = undefined

        if (product) {
          const rawTiers = product.priceTiers as unknown
          const tiers = Array.isArray(rawTiers) ? (rawTiers as PriceTier[]) : null
          const promotion = { active: !!product.hasPromotion, price: product.promotionPrice }
          const r = resolveTierPrice(item.qty, frontendBasePrice, tiers, promotion)
          unitPrice = r.price
          tierLabel = r.tierLabel
          if (unitPrice !== frontendBasePrice) {
            // Le backend a calculé un prix différent (palier matché ou promo). Comportement normal.
            // On logge en debug si l'écart est inattendu (frontend devrait être aligné).
            const frontendTierLabel = item.tierLabel ?? null
            if (frontendTierLabel !== (tierLabel ?? null) || Number(item.price) !== unitPrice) {
              console.warn(`[sales] prix ajusté pour ${product.id}: frontend=${frontendBasePrice}/${frontendTierLabel} → backend=${unitPrice}/${tierLabel ?? '—'}`)
            }
          }
        }

        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            qty: item.qty,
            unitPrice,
            total: unitPrice * item.qty,
            tierLabel: tierLabel ?? null,
          },
        })
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.qty } },
        })
      }

      if (customerId) {
        // Points fidélité = floor(NET payé TTC après remises / pointsPerAmount tenant).
        const pts = loyaltyOn ? pointsForAmount(finalTotal, tCfg?.pointsPerAmount ?? undefined) : 0
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalRevenue: { increment: finalTotal },
            ...(pts > 0 ? { loyaltyPoints: { increment: pts } } : {}),
          },
        })
        if (pts > 0) {
          await tx.loyaltyTransaction.create({
            data: { tenantId, customerId, saleId: newSale.id, points: pts, type: 'earn', reason: 'sale' },
          })
        }
      }

      return newSale
      })
    } catch (e: any) {
      // Course concurrente : même clé insérée en parallèle → violation d'unicité (P2002).
      // L'appel perdant récupère et renvoie la vente gagnante → 1 SEULE vente créée.
      if (idempotencyKey && e?.code === 'P2002') {
        const existing = await prisma.sale.findFirst({ where: { tenantId, idempotencyKey } })
        if (existing) return existing
      }
      throw e
    }

    // Les agrégats analytics dépendent des ventes → on purge le cache du tenant.
    invalidateTenantCache(tenantId).catch(() => {})

    notifyTenant(tenantId, { type: 'new_sale', data: { id: newSale.id, total, paymentMode, itemCount: Array.isArray(items) ? items.length : 0 } })
    try {
      const ids = (items ?? []).map((i) => i.productId)
      const sold = await prisma.product.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, name: true, stockQty: true, stockMin: true },
      })
      const low = sold.filter((p) => p.stockQty <= p.stockMin)
      if (low.length) notifyTenant(tenantId, { type: 'low_stock', data: { products: low.map((p) => ({ id: p.id, name: p.name, stockQty: p.stockQty })) } })
    } catch { /* non bloquant */ }

    // ── WhatsApp auto (reçu après vente) — async NON BLOQUANT : n'échoue jamais la vente ──
    if (tCfg?.enableAutoWhatsApp && customerId) {
      void (async () => {
        try {
          const [cust, saleItems] = await Promise.all([
            prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { name: true, phone: true } }),
            prisma.saleItem.findMany({ where: { saleId: newSale.id }, select: { qty: true, total: true, product: { select: { name: true } } } }),
          ])
          if (cust?.phone) {
            await sendSaleWhatsApp(
              { id: newSale.id, total: finalTotal, paymentMode: paymentMode ?? 'cash', createdAt: newSale.createdAt },
              saleItems, cust,
              { name: tCfg.name, currency: tCfg.currency, lang: tCfg.lang, enableLoyalty: tCfg.enableLoyalty, pointsPerAmount: tCfg.pointsPerAmount, enableAutoWhatsApp: tCfg.enableAutoWhatsApp },
            )
          }
        } catch { /* fail silent — déjà géré dans le service */ }
      })()
    }

    return newSale
  })

  // ── Remboursement TOTAL d'une vente ──
  // RBAC manager/admin · motif requis · idempotent (409 si déjà remboursé) ·
  // restock optionnel (pré-coché côté UI) · entrée d'audit · vente CONSERVÉE
  // (status='refunded' → exclue du CA). Wave/Orange = suivi only (mouvement réel externe).
  app.post('/api/sales/:id/refund', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (!canRefund(role)) {
      return reply.code(403).send({ error: 'Seuls un manager ou un administrateur peuvent rembourser une vente' })
    }
    const { id } = request.params as { id: string }
    const { reason, restock } = (request.body ?? {}) as { reason?: string; restock?: boolean }

    const cleanReason = (reason ?? '').trim()
    if (!cleanReason) {
      return reply.code(400).send({ error: 'Le motif du remboursement est obligatoire' })
    }
    const doRestock = restock !== false // défaut ON (case pré-cochée)

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })
    if (!sale) return reply.code(404).send({ error: 'Vente introuvable' })
    if (sale.status === 'refunded') {
      return reply.code(409).send({ error: 'Cette vente a déjà été remboursée' })
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Garde d'idempotence ATOMIQUE : seul l'appel qui passe status completed→refunded
        // gagne (count=1) ; un appel concurrent voit count=0 → 409.
        const upd = await tx.sale.updateMany({
          where: { id, tenantId, status: { not: 'refunded' } },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            refundedBy: userId,
            refundReason: cleanReason,
            restocked: doRestock,
          },
        })
        if (upd.count === 0) throw new RefundConflict()

        if (doRestock) {
          for (const it of sale.items) {
            // updateMany = pas d'exception si le produit a été supprimé entre-temps
            await tx.product.updateMany({
              where: { id: it.productId, tenantId },
              data: { stockQty: { increment: it.qty } },
            })
          }
        }

        // Symétrie avec la création de vente : retire le revenu + les points fidélité
        // gagnés sur cette vente (somme des 'earn' liés au saleId) dans la même transaction.
        if (sale.customerId) {
          const earned = await tx.loyaltyTransaction.aggregate({
            where: { saleId: sale.id, tenantId, type: 'earn' },
            _sum: { points: true },
          })
          const pts = earned._sum.points ?? 0
          await tx.customer.updateMany({
            where: { id: sale.customerId, tenantId },
            data: {
              totalRevenue: { decrement: sale.total },
              ...(pts > 0 ? { loyaltyPoints: { decrement: pts } } : {}),
            },
          })
          if (pts > 0) {
            await tx.loyaltyTransaction.create({
              data: { tenantId, customerId: sale.customerId, saleId: sale.id, points: -pts, type: 'reverse', reason: 'refund' },
            })
          }
        }

        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            module: 'sales',
            action: 'REFUND_SALE',
            severity: 'warning',
            description: JSON.stringify({
              saleId: sale.id,
              total: sale.total,
              paymentMode: sale.paymentMode,
              reason: cleanReason,
              restock: doRestock,
            }),
          },
        })
      })
    } catch (e) {
      if (e instanceof RefundConflict) {
        return reply.code(409).send({ error: 'Cette vente a déjà été remboursée' })
      }
      throw e
    }

    // CA / agrégats dépendent des ventes (status) → purge cache tenant.
    invalidateTenantCache(tenantId).catch(() => {})
    notifyTenant(tenantId, { type: 'sale_refunded', data: { id: sale.id, total: sale.total, restock: doRestock } })

    return { ok: true, id: sale.id, status: 'refunded', restocked: doRestock }
  })

  // ── Facture PDF d'une vente (à la demande, non stockée ; numéro figé en DB) ──
  // RBAC : tout rôle authentifié. Scope tenant strict.
  app.get('/api/sales/:id/invoice', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: { include: { product: { select: { name: true } } } } },
    })
    if (!sale) return reply.code(404).send({ error: 'Vente introuvable' })

    const [tenant, customer] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, phone: true, email: true, currency: true, vatRate: true, lang: true } }),
      sale.customerId ? prisma.customer.findFirst({ where: { id: sale.customerId, tenantId }, select: { name: true, phone: true } }) : Promise.resolve(null),
    ])
    if (!tenant) return reply.code(404).send({ error: 'Boutique introuvable' })

    // Numéro : attribué à la 1ʳᵉ demande puis figé (idempotent). Séquence = COUNT non-null + 1.
    let invoiceNumber = sale.invoiceNumber
    if (!invoiceNumber) {
      const year = new Date(sale.createdAt).getFullYear()
      const assign = async (): Promise<string> => {
        const count = await prisma.sale.count({ where: { tenantId, invoiceNumber: { not: null } } })
        const num = nextInvoiceNumber(count, year)
        await prisma.sale.update({ where: { id: sale.id }, data: { invoiceNumber: num } })
        return num
      }
      try {
        invoiceNumber = await assign()
      } catch (e: any) {
        if (e?.code === 'P2002') {
          // Course concurrente : soit cette vente a déjà reçu un numéro, soit le numéro
          // calculé a été pris par une autre vente → on relit / réessaie une fois.
          const fresh = await prisma.sale.findFirst({ where: { id: sale.id, tenantId }, select: { invoiceNumber: true } })
          invoiceNumber = fresh?.invoiceNumber ?? (await assign())
        } else throw e
      }
    }

    const pdf = await buildInvoicePdf({ ...sale, invoiceNumber }, tenant, customer)
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="facture-${invoiceNumber}.pdf"`)
      .send(pdf)
  })
}
