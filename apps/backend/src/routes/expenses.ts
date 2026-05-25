import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function expenseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/expenses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } })
  })

  app.post('/api/expenses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.expense.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/expenses/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    return prisma.expense.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/expenses/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    await prisma.expense.delete({ where: { id, tenantId } })
    return { success: true }
  })
}
