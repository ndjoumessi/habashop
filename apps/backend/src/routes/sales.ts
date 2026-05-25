import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'

export async function saleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { limit = 50, offset = 0 } = request.query as any
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
    const { items, paymentMode, total, discount } = request.body as any

    if (!items?.length) {
      return reply.code(400).send({ error: 'Une vente doit contenir au moins un article' })
    }
    if (total < 0) {
      return reply.code(400).send({ error: 'Le total ne peut pas être négatif' })
    }

    const newSale = await prisma.$transaction(async (tx: any) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          cashierId: userId,
          total,
          paymentMode,
          discountAmount: discount?.amount ?? 0,
          discountType: discount?.type ?? null,
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

      return newSale
    })

    notifyTenant(tenantId, { type: 'new_sale', data: { id: newSale.id, total, paymentMode, itemCount: Array.isArray(items) ? items.length : 0 } })
    try {
      const ids = (items ?? []).map((i: any) => i.productId)
      const sold = await prisma.product.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, name: true, stockQty: true, stockMin: true },
      })
      const low = sold.filter((p: any) => p.stockQty <= p.stockMin)
      if (low.length) notifyTenant(tenantId, { type: 'low_stock', data: { products: low.map((p: any) => ({ id: p.id, name: p.name, stockQty: p.stockQty })) } })
    } catch { /* non bloquant */ }
    return newSale
  })
}
