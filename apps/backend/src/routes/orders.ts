import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/orders', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.purchaseOrder.findMany({
      where: { tenantId, deletedAt: null },
      include: { items: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/api/orders', { preHandler: authenticate }, async (request) => {
    const { tenantId, userId } = request.user
    const { supplierId, items, expectedAt, notes } = request.body as any

    const ref = `CMD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const total = (items as any[]).reduce((s: number, i: any) => s + i.qty * i.unitPrice, 0)

    const order = await prisma.purchaseOrder.create({
      data: {
        ref, tenantId, supplierId,
        createdById: userId,
        total, expectedAt, notes,
        status: 'DRAFT',
        items: {
          create: (items as any[]).map((i: any) => ({
            productName: i.product,
            qty: i.qty,
            unitPrice: i.unitPrice,
            total: i.qty * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    })
    notifyTenant(tenantId, { type: 'new_order', data: { id: order.id, ref: order.ref, total } })
    return order
  })

  app.patch('/api/orders/:id/status', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    const { status } = request.body as any
    return prisma.purchaseOrder.update({ where: { id, tenantId }, data: { status } })
  })

  app.delete('/api/orders/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Admin requis pour supprimer une commande' })
    }
    const { id } = request.params as any
    const order = await prisma.purchaseOrder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true, ref: true } })
    if (!order) return reply.code(404).send({ error: 'Commande introuvable' })
    await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete (lignes conservées)
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'orders', action: 'DELETE_ORDER', description: JSON.stringify({ id, ref: order.ref }) },
    }).catch(() => {})
    return reply.code(204).send()
  })

  // Restaurer une commande soft-supprimée (ADMIN / SUPER_ADMIN)
  app.patch('/api/orders/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const { id } = request.params as any
    const order = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, select: { id: true, ref: true } })
    if (!order) return reply.code(404).send({ error: 'Commande introuvable' })
    const restored = await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: null } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'orders', action: 'RESTORE_ORDER', description: JSON.stringify({ id, ref: order.ref }) },
    }).catch(() => {})
    return restored
  })
}
