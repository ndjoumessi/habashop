import type { FastifyInstance } from 'fastify'
import type { SaleBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'
import { invalidateTenantCache } from '../lib/cache'
import { resolveTierPrice, type PriceTier } from '../utils/pricing'

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
    const { items, paymentMode, total, discount, customerId } = request.body as SaleBody

    if (!items?.length) {
      return reply.code(400).send({ error: 'Une vente doit contenir au moins un article' })
    }
    if (total == null || total < 0) {
      return reply.code(400).send({ error: 'Le total ne peut pas être négatif' })
    }

    // Pré-fetch des produits pour recalculer prix unitaire côté backend (sécurité tier/promo)
    const productIds = items.map((i: any) => i.productId)
    const productsList = await prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, sellPrice: true, hasPromotion: true, promotionPrice: true, priceTiers: true },
    })
    const productMap = new Map(productsList.map(p => [p.id, p]))

    const newSale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          cashierId: userId,
          total,
          paymentMode,
          discountAmount: discount?.amount ?? 0,
          discountType: discount?.type ?? null,
          customerId: customerId ?? null,
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
        await tx.customer.update({
          where: { id: customerId },
          data: { totalRevenue: { increment: total } },
        })
      }

      return newSale
    })

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

        // Symétrie avec la création de vente : on retire le revenu du client lié.
        if (sale.customerId) {
          await tx.customer.updateMany({
            where: { id: sale.customerId, tenantId },
            data: { totalRevenue: { decrement: sale.total } },
          })
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
}
