import type { FastifyInstance } from 'fastify'
import type { SaleBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'
import { invalidateTenantCache } from '../lib/cache'

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
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.price,
            total: item.price * item.qty,
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
}
