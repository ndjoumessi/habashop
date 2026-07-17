import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { ID_PARAMS, GOAL_CREATE, GOAL_UPDATE } from '../schemas/writesB'

interface GoalBody {
  label?:        string
  target?:       number
  current?:      number
  unit?:         string
  period?:       string
  color?:        string
  icon?:         string
  category?:     string
  linkedMetric?: string | null
}

export async function goalsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/goals', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.goal.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
  })

  app.post('/api/goals', { preHandler: authenticate, schema: { body: GOAL_CREATE } }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const b = request.body as GoalBody
    if (!b.label?.trim() || b.target === undefined || b.target === null) {
      return reply.code(400).send({ error: 'label et target requis' })
    }
    const goal = await prisma.goal.create({
      data: {
        tenantId,
        label:        b.label.trim(),
        target:       Number(b.target),
        current:      Number(b.current ?? 0),
        unit:         b.unit ?? '',
        period:       b.period ?? 'month',
        color:        b.color ?? '#6C47FF',
        icon:         b.icon ?? '🎯',
        category:     b.category ?? 'revenue',
        linkedMetric: b.linkedMetric ?? null,
      },
    })
    await prisma.auditLog.create({
      data: {
        tenantId, userId, module: 'GOALS', action: 'CREATE_GOAL',
        description: JSON.stringify({ goalId: goal.id, label: goal.label }),
        severity: 'info',
      },
    }).catch(() => {})
    return reply.code(201).send(goal)
  })

  app.put('/api/goals/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: GOAL_UPDATE } }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as { id: string }
    const existing = await prisma.goal.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Objectif introuvable' })
    const b = request.body as GoalBody
    const updated = await prisma.goal.update({
      where: { id },
      data: {
        label:        b.label?.trim() ?? undefined,
        target:       b.target !== undefined ? Number(b.target) : undefined,
        current:      b.current !== undefined ? Number(b.current) : undefined,
        unit:         b.unit ?? undefined,
        period:       b.period ?? undefined,
        color:        b.color ?? undefined,
        icon:         b.icon ?? undefined,
        category:     b.category ?? undefined,
        linkedMetric: b.linkedMetric === null ? null : (b.linkedMetric ?? undefined),
      },
    })
    await prisma.auditLog.create({
      data: {
        tenantId, userId, module: 'GOALS', action: 'UPDATE_GOAL',
        description: JSON.stringify({ goalId: id }),
        severity: 'info',
      },
    }).catch(() => {})
    return updated
  })

  app.delete('/api/goals/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as { id: string }
    const existing = await prisma.goal.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Objectif introuvable' })
    await prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } })
    await prisma.auditLog.create({
      data: {
        tenantId, userId, module: 'GOALS', action: 'DELETE_GOAL',
        description: JSON.stringify({ goalId: id, label: existing.label }),
        severity: 'info',
      },
    }).catch(() => {})
    return { success: true }
  })
}
