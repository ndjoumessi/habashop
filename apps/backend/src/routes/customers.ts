import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/customers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    try {
      return await prisma.customer.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
    } catch (err: any) {
      console.error('Get customers error:', err)
      return []
    }
  })

  app.post('/api/customers', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const {
      name, type, phone, email, address,
      loyaltyPoints, totalRevenue,
    } = request.body as any

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Le nom est requis' })
    }

    try {
      const customer = await prisma.customer.create({
        data: {
          tenantId,
          name:          name?.trim() ?? '',
          type:          type          ?? 'retail',
          phone:         phone         ?? '',
          email:         email         ?? '',
          address:       address       ?? '',
          loyaltyPoints: loyaltyPoints ?? 0,
          totalRevenue:  totalRevenue  ?? 0,
        }
      })
      notifyTenant(tenantId, { type: 'new_customer', data: { id: customer.id, name: customer.name } })
      return customer
    } catch (err: any) {
      console.error('Create customer error:', err)
      return reply.code(500).send({
        error: 'Erreur création client',
        details: err.message,
      })
    }
  })

  app.put('/api/customers/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    const data = request.body as any
    try {
      return await prisma.customer.update({
        where: { id, tenantId },
        data: {
          name: data.name,
          type: data.type,
          phone: data.phone,
          email: data.email,
          address: data.address,
        }
      })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  app.delete('/api/customers/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as any
    const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'customers', action: 'DELETE_CUSTOMER', description: JSON.stringify({ id, name: customer.name }) },
    }).catch(() => {})
    return reply.code(204).send()
  })

  // Restaurer un client soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/customers/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const { id } = request.params as any
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const restored = await prisma.customer.update({ where: { id }, data: { deletedAt: null } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'customers', action: 'RESTORE_CUSTOMER', description: JSON.stringify({ id, name: customer.name }) },
    }).catch(() => {})
    return restored
  })

  // ─── LOYALTY ──────────────────────────
  app.get('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
      const points = (customer as any).loyaltyPoints ?? 0
      const tier = points >= 5000 ? 'Gold' : points >= 2000 ? 'Silver' : 'Bronze'
      return { points, tier, history: [] }
    } catch {
      return { points: 0, tier: 'Bronze', history: [] }
    }
  })

  app.post('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { points } = request.body as { points: number; reason: string }
    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
      const current = (customer as any).loyaltyPoints ?? 0
      const updated = await prisma.customer.update({
        where: { id },
        data: { loyaltyPoints: current + points } as any,
      })
      return { points: (updated as any).loyaltyPoints ?? current + points }
    } catch {
      return { points: points }
    }
  })
}
