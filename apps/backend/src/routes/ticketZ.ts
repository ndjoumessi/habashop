import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { computeTicketZ, buildTicketZPdf } from '../lib/ticketZ'

// Clôture journalière réservée MANAGER + ADMIN (+ SUPER_ADMIN superset).
export const TICKET_Z_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const
export const canTicketZ = (role?: string): boolean => TICKET_Z_ROLES.includes(role as never)

/** Bornes UTC [00:00, 24:00) du jour courant. dayStart = clé `date` du TicketZ. */
function todayRangeUTC(now = new Date()): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  return { dayStart, dayEnd }
}

export async function ticketZRoutes(app: FastifyInstance): Promise<void> {
  // ── Générer / regénérer la clôture du jour (idempotent = upsert) ──
  app.post('/api/ticket-z/generate', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (!canTicketZ(role)) return reply.code(403).send({ error: 'Accès réservé MANAGER/ADMIN' })

    const { dayStart, dayEnd } = todayRangeUTC()
    const sales = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
      select: { total: true, status: true, paymentMode: true, customerId: true, cashAmount: true, mobileMoneyAmount: true, cardAmount: true },
    })
    const agg = computeTicketZ(sales)

    const tz = await prisma.ticketZ.upsert({
      where: { tenantId_date: { tenantId, date: dayStart } },
      create: { tenantId, date: dayStart, ...agg, generatedBy: userId },
      update: { ...agg, generatedBy: userId, generatedAt: new Date() },
    })
    return tz
  })

  // ── Clôture du jour (null si pas encore générée) ──
  app.get('/api/ticket-z/today', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { dayStart } = todayRangeUTC()
    return prisma.ticketZ.findUnique({ where: { tenantId_date: { tenantId, date: dayStart } } })
  })

  // ── 30 dernières clôtures (desc) ──
  app.get('/api/ticket-z/history', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.ticketZ.findMany({ where: { tenantId }, orderBy: { date: 'desc' }, take: 30 })
  })

  // ── PDF d'un Ticket Z ──
  app.get('/api/ticket-z/:id/pdf', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    const tz = await prisma.ticketZ.findFirst({ where: { id, tenantId } })
    if (!tz) return reply.code(404).send({ error: 'Ticket Z introuvable' })

    const [tenant, user] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, currency: true, lang: true } }),
      prisma.user.findUnique({ where: { id: tz.generatedBy }, select: { name: true } }).catch(() => null),
    ])
    if (!tenant) return reply.code(404).send({ error: 'Boutique introuvable' })

    const pdf = await buildTicketZPdf(tz, tenant, user?.name ?? undefined)
    const dateKey = new Date(tz.date).toISOString().slice(0, 10)
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="ticket-z-${dateKey}.pdf"`)
      .send(pdf)
  })
}
