import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function supplierRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.supplier.findMany({ where: { tenantId } })
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
    const { tenantId } = request.user
    const { id } = request.params as any
    try {
      await prisma.supplier.delete({ where: { id, tenantId } })
      return reply.code(204).send()
    } catch (err: any) {
      if (err?.code === 'P2003') return reply.code(409).send({ error: 'Impossible de supprimer : le fournisseur a des commandes liées' })
      throw err // P2025 → 404 (handler global)
    }
  })
}
