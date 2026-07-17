import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { ID_PARAMS, EXPENSE_CREATE, EXPENSE_UPDATE } from '../schemas/writesB'
import { invalidateTenantCache } from '../lib/cache'

export async function expenseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/expenses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } })
  })

  app.post('/api/expenses', { preHandler: authenticate, schema: { body: EXPENSE_CREATE } }, async (request) => {
    const { tenantId } = request.user
    const expense = await prisma.expense.create({ data: { ...(request.body as any), tenantId } })
    invalidateTenantCache(tenantId).catch(() => {})
    return expense
  })

  app.put('/api/expenses/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: EXPENSE_UPDATE } }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    const expense = await prisma.expense.update({ where: { id, tenantId }, data: request.body as any })
    invalidateTenantCache(tenantId).catch(() => {})
    return expense
  })

  app.delete('/api/expenses/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    await prisma.expense.delete({ where: { id, tenantId } })
    invalidateTenantCache(tenantId).catch(() => {})
    return { success: true }
  })
}
