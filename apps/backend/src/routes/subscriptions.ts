import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { getTenantId } from '../lib/tenantId'
import { ID_PARAMS, SUB_CREATE, SUB_UPDATE } from '../schemas/writesB'

const MANAGER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER']

type StartedClause = { startDate: null } | { startDate: { lt: Date } }

/**
 * Clause `OR` : « l'abonnement a commencé ».
 *
 * `startDate` NULL = pas de date de début → dû dès le prochain `dayOfWeek`
 * (comportement historique, préservé).
 *
 * La borne est le minuit UTC du LENDEMAIN, donc une date de début tombant
 * aujourd'hui compte comme démarrée quelle que soit son heure : jour calendaire
 * UTC **inclusif**, même convention que `promotionEnd` (cf. utils/pricing.ts).
 * Sans ce filtre, une date « à partir du mois prochain » serait stockée puis
 * ignorée, et l'abonnement s'afficherait « dû aujourd'hui ».
 *
 * `now` est INJECTÉ (fonction pure, pas de `new Date()` interne).
 */
export function subscriptionStartedFilter(now: Date): StartedClause[] {
  const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return [{ startDate: null }, { startDate: { lt: tomorrowUtc } }]
}

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/subscriptions — liste tenant (actifs + pausés)
  app.get('/api/subscriptions', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
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
    const tenantId = getTenantId(request)
    const now = new Date()
    return prisma.subscription.findMany({
      where: {
        tenantId,
        status: 'active',
        dayOfWeek: now.getUTCDay(),
        OR: subscriptionStartedFilter(now),
      },
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
    const tenantId = getTenantId(request)
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
    const { role } = request.user
    if (!MANAGER_ROLES.includes(role)) return reply.code(403).send({ error: 'Accès réservé aux managers' })
    const { customerId, name, dayOfWeek, startDate, note, items } = request.body as any

    if (!customerId || !name || dayOfWeek == null || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'customerId, name, dayOfWeek et items requis' })
    }
    const tenantId = getTenantId(request)
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId, deletedAt: null }, select: { id: true } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })

    const sub = await prisma.subscription.create({
      data: {
        tenantId, customerId, name,
        dayOfWeek: Number(dayOfWeek),
        startDate: startDate ?? null,
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
    const { role } = request.user
    if (!MANAGER_ROLES.includes(role)) return reply.code(403).send({ error: 'Accès réservé aux managers' })
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const { name, dayOfWeek, startDate, status, note, items } = request.body as any

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
          // `undefined` = champ absent → inchangé ; `null` = date de début effacée.
          ...(startDate !== undefined && { startDate }),
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
    const { role } = request.user
    if (!MANAGER_ROLES.includes(role)) return reply.code(403).send({ error: 'Accès réservé aux managers' })
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const existing = await prisma.subscription.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.code(404).send({ error: 'Abonnement introuvable' })
    await prisma.subscription.update({ where: { id }, data: { status: 'cancelled' } })
    return reply.code(204).send()
  })
}
