import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function supplierRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.supplier.findMany({ where: { tenantId, deletedAt: null } })
  })

  app.post('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.supplier.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/suppliers/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    return prisma.supplier.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/suppliers/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as any
    // Soft delete : la ligne reste (FK des commandes liées intacte) → plus de P2003/409
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'suppliers', action: 'DELETE_SUPPLIER', description: JSON.stringify({ id, name: supplier.name }) },
    }).catch(() => {})
    return reply.code(204).send()
  })

  // Restaurer un fournisseur soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/suppliers/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const { id } = request.params as any
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    const restored = await prisma.supplier.update({ where: { id }, data: { deletedAt: null } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'suppliers', action: 'RESTORE_SUPPLIER', description: JSON.stringify({ id, name: supplier.name }) },
    }).catch(() => {})
    return restored
  })
}
