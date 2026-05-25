import type { FastifyInstance } from 'fastify'
import type { ProductBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/products', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.product.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } })
  })

  app.post('/api/products', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const {
      sku, name, category, buyPrice, sellPrice,
      stockQty, stockMin, unit, emoji, taxRate,
      description, barcode, isActive,
      wholesalePrice, semiWholesalePrice,
      hasPromotion, promotionPrice,
    } = request.body as ProductBody

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Nom requis' })
    }
    if (sellPrice !== undefined && sellPrice < 0) {
      return reply.code(400).send({ error: 'Le prix de vente ne peut pas être négatif' })
    }
    if (buyPrice !== undefined && buyPrice < 0) {
      return reply.code(400).send({ error: "Le prix d'achat ne peut pas être négatif" })
    }
    if (stockQty !== undefined && stockQty < 0) {
      return reply.code(400).send({ error: 'Le stock ne peut pas être négatif' })
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
    } catch (err) {
      console.error('Create product error:', err)
      return reply.code(500).send({
        error: 'Erreur création produit',
        details: err.message,
      })
    }
  })

  app.put('/api/products/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    return prisma.product.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/products/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as { id: string }
    const product = await prisma.product.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!product) return reply.code(404).send({ error: 'Produit introuvable' })
    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'products', action: 'DELETE_PRODUCT', description: JSON.stringify({ id, name: product.name }) },
    }).catch(() => {})
    return { success: true }
  })

  // Restaurer un produit soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/products/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const { id } = request.params as { id: string }
    const product = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!product) return reply.code(404).send({ error: 'Produit introuvable' })
    const restored = await prisma.product.update({ where: { id }, data: { deletedAt: null } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'products', action: 'RESTORE_PRODUCT', description: JSON.stringify({ id, name: product.name }) },
    }).catch(() => {})
    return restored
  })

  app.get('/api/products/low-stock', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const products = await prisma.product.findMany({ where: { tenantId, isActive: true, deletedAt: null } })
    return products.filter((p) => p.stockQty <= p.stockMin)
  })
}
