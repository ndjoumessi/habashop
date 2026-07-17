import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { ID_PARAMS, SUB_CREATE, SUB_UPDATE } from '../schemas/writesB'

const MANAGER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER']

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/subscriptions — liste tenant (actifs + pausés)
  app.get('/api/subscriptions', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.subscription.findMany({
      where: { tenantId, status: { not: 'cancelled' } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sellPrice: true, emoji: true, stockQty: true } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { dayOfWeek: 'asc' }, { createdAt: 'desc' }],
    })
  })

  // GET /api/subscriptions/due — abonnements dont le jour = aujourd'hui (UTC)
  app.get('/api/subscriptions/due', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const dow = new Date().getUTCDay()
    return prisma.subscription.findMany({
      where: { tenantId, status: 'active', dayOfWeek: dow },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sellPrice: true, emoji: true, stockQty: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // GET /api/subscriptions/customer/:customerId — abonnements d'un client
  app.get('/api/subscriptions/customer/:customerId', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { customerId } = request.params as { customerId: string }
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, deletedAt: null }, select: { id: true } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    return prisma.subscription.findMany({
      where: { tenantId, customerId, status: { not: 'cancelled' } },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sellPrice: true, emoji: true, stockQty: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // POST /api/subscriptions — créer (MANAGER+)
  app.post('/api/subscriptions', { preHandler: authenticate, schema: { body: SUB_CREATE } }, async (request, reply) => {
    const { tenantId, role } = request.user
    if (!MANAGER_ROLES.includes(role)) return reply.code(403).send({ error: 'Accès réservé aux managers' })
    const { customerId, name, dayOfWeek, note, items } = request.body as any

    if (!customerId || !name || dayOfWeek == null || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'customerId, name, dayOfWeek et items requis' })
    }
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, deletedAt: null }, select: { id: true } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })

    const sub = await prisma.subscription.create({
      data: {
        tenantId, customerId, name,
        dayOfWeek: Number(dayOfWeek),
        note: note ?? null,
        items: {
          create: (items as any[]).map((it) => ({
            productId: it.productId,
            quantity: Number(it.quantity) || 1,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sellPrice: true, emoji: true, stockQty: true } },
          },
        },
      },
    })
    return reply.code(201).send(sub)
  })

  // PUT /api/subscriptions/:id — mettre à jour (MANAGER+)
  app.put('/api/subscriptions/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: SUB_UPDATE } }, async (request, reply) => {
    const { tenantId, role } = request.user
    if (!MANAGER_ROLES.includes(role)) return reply.code(403).send({ error: 'Accès réservé aux managers' })
    const { id } = request.params as { id: string }
    const { name, dayOfWeek, status, note, items } = request.body as any

    const existing = await prisma.subscription.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.code(404).send({ error: 'Abonnement introuvable' })

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(items)) {
        await tx.subscriptionItem.deleteMany({ where: { subscriptionId: id } })
        if (items.length > 0) {
          await tx.subscriptionItem.createMany({
            data: items.map((it: any) => ({
              subscriptionId: id,
              productId: it.productId,
              quantity: Number(it.quantity) || 1,
            })),
          })
        }
      }
      await tx.subscription.update({
        where: { id },
        data: {
          ...(name != null && { name }),
          ...(dayOfWeek != null && { dayOfWeek: Number(dayOfWeek) }),
          ...(status != null && { status }),
          ...(note !== undefined && { note }),
        },
      })
    })

    return prisma.subscription.findFirst({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sellPrice: true, emoji: true, stockQty: true } },
          },
        },
      },
    })
  })

  // DELETE /api/subscriptions/:id — annuler (soft: status=cancelled)
  app.delete('/api/subscriptions/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { tenantId, role } = request.user
    if (!MANAGER_ROLES.includes(role)) return reply.code(403).send({ error: 'Accès réservé aux managers' })
    const { id } = request.params as { id: string }
    const existing = await prisma.subscription.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.code(404).send({ error: 'Abonnement introuvable' })
    await prisma.subscription.update({ where: { id }, data: { status: 'cancelled' } })
    return reply.code(204).send()
  })
}
