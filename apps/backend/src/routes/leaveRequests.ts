import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { eachDateInclusive } from '../lib/dates'

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REFUSED'] as const
const APPROVER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'HR'] as const
const canApprove = (role: unknown) => typeof role === 'string' && (APPROVER_ROLES as readonly string[]).includes(role)
const isValidDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

interface LeaveBody {
  employeeId?: string; startDate?: string; endDate?: string; leaveType?: string; reason?: string | null
}

function requireApprover(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!canApprove(request.user?.role)) {
    reply.code(403).send({ error: 'Action réservée à ADMIN/MANAGER/RH', code: 'LEAVE_APPROVE_FORBIDDEN' })
    return false
  }
  return true
}

// À l'approbation : génère Shift "Congé" (leave) + Attendance LEAVE pour chaque jour couvert.
// Best-effort (un échec ne doit pas annuler l'approbation déjà persistée).
async function applyApprovedLeaveSideEffects(tenantId: string, employeeId: string, startDate: string, endDate: string): Promise<void> {
  for (const date of eachDateInclusive(startDate, endDate)) {
    try {
      await prisma.shift.upsert({
        where: { tenantId_employeeId_date_shiftTypeKey: { tenantId, employeeId, date, shiftTypeKey: 'leave' } },
        create: { tenantId, employeeId, date, shiftTypeKey: 'leave', startTime: null, endTime: null, label: null, color: null },
        update: { shiftTypeKey: 'leave' },
      })
    } catch (err) { console.warn('[leave-requests] shift upsert failed:', (err as Error)?.message ?? err) }
    try {
      await prisma.attendance.upsert({
        where: { tenantId_employeeId_date: { tenantId, employeeId, date } },
        create: { tenantId, employeeId, date, status: 'LEAVE', arriveTime: null, departTime: null, note: null },
        update: { status: 'LEAVE' },
      })
    } catch (err) { console.warn('[leave-requests] attendance upsert failed:', (err as Error)?.message ?? err) }
  }
}

export async function leaveRequestRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/leave-requests?status=PENDING — lecture tout membre, scope tenant.
  app.get('/api/leave-requests', { preHandler: authenticate }, async (request) => {
    const tenantId = request.tenantId
    const { status } = request.query as { status?: string }
    const where: any = { tenantId }
    if (status && (LEAVE_STATUSES as readonly string[]).includes(status)) where.status = status
    return prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { id: true, name: true, avatar: true, dept: true } } },
      orderBy: [{ createdAt: 'desc' }],
    })
  })

  // POST /api/leave-requests — créer une demande (PENDING). Tout membre pour lui-même ;
  // ADMIN/MANAGER/HR pour n'importe quel employé du tenant.
  app.post('/api/leave-requests', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = request.tenantId!
    const b = request.body as LeaveBody
    if (!b.employeeId || !isValidDate(b.startDate) || !isValidDate(b.endDate)) {
      return reply.code(400).send({ error: 'employeeId, startDate, endDate (YYYY-MM-DD) requis' })
    }
    if (b.endDate < b.startDate) return reply.code(400).send({ error: 'endDate doit être ≥ startDate' })
    const emp = await prisma.employee.findFirst({ where: { id: b.employeeId, tenantId }, select: { id: true } })
    if (!emp) return reply.code(404).send({ error: 'Employé introuvable dans ce tenant' })
    // Un non-approbateur ne peut soumettre QUE pour lui-même (employeeId == son userId lié).
    if (!canApprove(request.user?.role) && b.employeeId !== request.user?.userId) {
      return reply.code(403).send({ error: 'Vous ne pouvez soumettre une demande que pour vous-même', code: 'LEAVE_SELF_ONLY' })
    }
    return prisma.leaveRequest.create({
      data: {
        tenantId, employeeId: b.employeeId, startDate: b.startDate, endDate: b.endDate,
        leaveType: b.leaveType ?? 'Congé', status: 'PENDING', reason: b.reason ?? null,
      },
    })
  })

  // PATCH /api/leave-requests/:id — maj partielle HORS status (dates/type/reason). Approbateur.
  app.patch('/api/leave-requests/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!requireApprover(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    const b = request.body as LeaveBody
    if (b.startDate !== undefined && !isValidDate(b.startDate)) return reply.code(400).send({ error: 'startDate invalide' })
    if (b.endDate !== undefined && !isValidDate(b.endDate)) return reply.code(400).send({ error: 'endDate invalide' })
    const existing = await prisma.leaveRequest.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'Demande introuvable' })
    return prisma.leaveRequest.update({
      where: { id },
      data: {
        ...(b.startDate !== undefined ? { startDate: b.startDate } : {}),
        ...(b.endDate !== undefined ? { endDate: b.endDate } : {}),
        ...(b.leaveType !== undefined ? { leaveType: b.leaveType } : {}),
        ...(b.reason !== undefined ? { reason: b.reason } : {}),
      },
    })
  })

  // POST /api/leave-requests/:id/approve — APPROVED + approvedBy/At + Shifts Congé + Attendance LEAVE.
  app.post('/api/leave-requests/:id/approve', { preHandler: authenticate }, async (request, reply) => {
    if (!requireApprover(request, reply)) return
    const tenantId = request.tenantId!
    const { id } = request.params as { id: string }
    const lr = await prisma.leaveRequest.findFirst({ where: { id, tenantId } })
    if (!lr) return reply.code(404).send({ error: 'Demande introuvable' })
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: request.user?.userId ?? null, approvedAt: new Date() },
    })
    // Effets best-effort APRÈS l'approbation (ne l'annulent pas s'ils échouent).
    await applyApprovedLeaveSideEffects(tenantId, lr.employeeId, lr.startDate, lr.endDate)
    return updated
  })

  // POST /api/leave-requests/:id/refuse — REFUSED.
  app.post('/api/leave-requests/:id/refuse', { preHandler: authenticate }, async (request, reply) => {
    if (!requireApprover(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    const existing = await prisma.leaveRequest.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'Demande introuvable' })
    return prisma.leaveRequest.update({ where: { id }, data: { status: 'REFUSED' } })
  })
}
