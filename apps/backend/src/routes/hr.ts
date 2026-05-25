import type { FastifyInstance } from 'fastify'
import type { BonusBody, SalaryHistoryBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function hrRoutes(app: FastifyInstance): Promise<void> {
  // ─── EMPLOYEE BONUSES ─────────────────
  app.get('/api/bonuses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.employeeBonus.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
    })
  })

  app.get('/api/bonuses/employee/:employeeId', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { employeeId } = request.params as { employeeId: string }
    return prisma.employeeBonus.findMany({
      where: { tenantId, employeeId },
      orderBy: { date: 'desc' },
    })
  })

  app.post('/api/bonuses', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { employeeId, amount, reason, date } = request.body as BonusBody
    if (!employeeId || !amount) return reply.code(400).send({ error: 'employeeId et amount requis' })
    try {
      const bonus = await prisma.employeeBonus.create({
        data: {
          tenantId,
          employeeId,
          amount: Number(amount),
          reason: reason ?? 'Prime',
          date: date ? new Date(date) : new Date(),
        }
      })
      return bonus
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  app.delete('/api/bonuses/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    try {
      await prisma.employeeBonus.delete({ where: { id, tenantId } })
      return { success: true }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // ─── SALARY HISTORY ───────────────────
  app.get('/api/salary-history', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.salaryHistory.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
    })
  })

  app.get('/api/salary-history/employee/:employeeId', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { employeeId } = request.params as { employeeId: string }
    return prisma.salaryHistory.findMany({
      where: { tenantId, employeeId },
      orderBy: { date: 'desc' },
    })
  })

  app.post('/api/salary-history', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { employeeId, oldSalary, newSalary, reason, date } = request.body as SalaryHistoryBody
    if (!employeeId || newSalary === undefined) return reply.code(400).send({ error: 'employeeId et newSalary requis' })
    try {
      const entry = await prisma.salaryHistory.create({
        data: {
          tenantId,
          employeeId,
          oldSalary: Number(oldSalary ?? 0),
          newSalary: Number(newSalary),
          reason: reason ?? '',
          date: date ? new Date(date) : new Date(),
        }
      })
      return entry
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })
}
