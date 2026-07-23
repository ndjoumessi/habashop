import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { getTenantId } from '../lib/tenantId'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'

// ── Schémas (item 6) ─────────────────────────────────────────────────────────
const ID_PARAMS = z.object({ id: z.string().min(1) })
// items requis (le handler .reduce/.map → crasherait sinon) ; supplierId requis (FK).
const ORDER_CREATE = z.object({
  supplierId: z.string().min(1),
  items: z.array(z.object({
    product:   z.string(),
    qty:       z.coerce.number(),
    unitPrice: z.coerce.number(),
  }).passthrough()).min(1),
  expectedAt: z.any().nullish(),
  notes:      z.string().nullish(),
}).passthrough()
const ORDER_STATUS = z.object({ status: z.string().min(1) })

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/orders', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.purchaseOrder.findMany({
      where: { tenantId, deletedAt: null },
      include: { items: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/api/orders', { preHandler: authenticate, schema: { body: ORDER_CREATE } }, async (request) => {
    const { userId } = request.user
    const tenantId = getTenantId(request)
    // Type dérivé du schéma zod (ORDER_CREATE) → supplierId est `string` (garanti par
    // `z.string().min(1)`, rejet 400 avant le handler), pas `string | undefined` comme le
    // laissait croire le cast précédent. Aligne le type sur la garantie de validation.
    const { supplierId, items, expectedAt, notes } = request.body as z.infer<typeof ORDER_CREATE>

    const ref = `CMD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const total = (items as any[]).reduce((s: number, i) => s + i.qty * i.unitPrice, 0)

    const order = await prisma.purchaseOrder.create({
      data: {
        ref, tenantId, supplierId,
        createdById: userId,
        total, expectedAt, notes,
        status: 'DRAFT',
        items: {
          create: (items as any[]).map((i) => ({
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

  app.patch('/api/orders/:id/status', { preHandler: authenticate, schema: { params: ID_PARAMS, body: ORDER_STATUS } }, async (request) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const { status } = request.body as { status?: string }
    return prisma.purchaseOrder.update({ where: { id, tenantId }, data: { status } })
  })

  app.delete('/api/orders/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Admin requis pour supprimer une commande' })
    }
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const order = await prisma.purchaseOrder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true, ref: true } })
    if (!order) return reply.code(404).send({ error: 'Commande introuvable' })
    await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete (lignes conservées)
    await writeAudit('DELETE_ORDER', prisma.auditLog.create({
      data: { tenantId, userId, module: 'orders', action: 'DELETE_ORDER', description: JSON.stringify({ id, ref: order.ref }) },
    }))
    return reply.code(204).send()
  })

  // Restaurer une commande soft-supprimée (ADMIN / SUPER_ADMIN)
  app.patch('/api/orders/:id/restore', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const order = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, select: { id: true, ref: true } })
    if (!order) return reply.code(404).send({ error: 'Commande introuvable' })
    const restored = await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: null } })
    await writeAudit('RESTORE_ORDER', prisma.auditLog.create({
      data: { tenantId, userId, module: 'orders', action: 'RESTORE_ORDER', description: JSON.stringify({ id, ref: order.ref }) },
    }))
    return restored
  })
}
