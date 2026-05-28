import type { FastifyInstance } from 'fastify'
import type { ProductBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { invalidateTenantCache } from '../lib/cache'

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/products', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.product.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } })
  })

  app.post('/api/products', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const {
      name, category, buyPrice, sellPrice,
      stockQty, stockMin, unit, emoji, taxRate,
      description, barcode, isActive,
      wholesalePrice, semiWholesalePrice,
      hasPromotion, promotionPrice,
      supplierId,
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

    // SKU séquentiel par tenant (inclut soft-deleted pour éviter les collisions de réutilisation).
    const count = await prisma.product.count({ where: { tenantId } })
    const generatedSku = `PRD-${String(count + 1).padStart(4, '0')}`

    try {
      const product = await prisma.product.create({
        data: {
          tenantId,
          sku: generatedSku,
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
          supplierId: supplierId || null,
        }
      })
      invalidateTenantCache(tenantId).catch(() => {})
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
    // SKU est immutable (auto-généré à la création) — on retire tout sku envoyé par le client.
    const { sku: _ignored, ...data } = request.body as Record<string, unknown>
    void _ignored
    const updated = await prisma.product.update({ where: { id, tenantId }, data: data as any })
    invalidateTenantCache(tenantId).catch(() => {})
    return updated
  })

  app.delete('/api/products/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as { id: string }
    const product = await prisma.product.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!product) return reply.code(404).send({ error: 'Produit introuvable' })
    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete
    invalidateTenantCache(tenantId).catch(() => {})
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
    invalidateTenantCache(tenantId).catch(() => {})
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
