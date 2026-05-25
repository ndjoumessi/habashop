import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/products', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  })

  app.post('/api/products', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const {
      sku, name, category, buyPrice, sellPrice,
      stockQty, stockMin, unit, emoji, taxRate,
      description, barcode, isActive,
      wholesalePrice, semiWholesalePrice,
      hasPromotion, promotionPrice,
    } = request.body as any

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Nom requis' })
    }

    try {
      const product = await prisma.product.create({
        data: {
          tenantId,
          sku: sku || `PRD-${Date.now()}`,
          name: name.trim(),
          category: category || 'Général',
          buyPrice: buyPrice || 0,
          sellPrice: sellPrice || 0,
          stockQty: stockQty || 0,
          stockMin: stockMin || 5,
          unit: unit || 'unité',
          emoji: emoji || '📦',
          taxRate: taxRate || 18,
          description: description || '',
          barcode: barcode || '',
          isActive: isActive !== false,
          wholesalePrice: wholesalePrice || null,
          semiWholesalePrice: semiWholesalePrice || null,
          hasPromotion: hasPromotion || false,
          promotionPrice: promotionPrice || null,
        }
      })
      return product
    } catch (err: any) {
      console.error('Create product error:', err)
      return reply.code(500).send({
        error: 'Erreur création produit',
        details: err.message,
      })
    }
  })

  app.put('/api/products/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    return prisma.product.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/products/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    await prisma.product.delete({ where: { id, tenantId } })
    return { success: true }
  })

  app.get('/api/products/low-stock', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const products = await prisma.product.findMany({ where: { tenantId, isActive: true } })
    return products.filter((p: any) => p.stockQty <= p.stockMin)
  })
}
