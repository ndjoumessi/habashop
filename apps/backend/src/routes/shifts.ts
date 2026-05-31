import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

// Clés de type de shift (miroir SHIFT_TYPES frontend). REST = 'rest' → déclenche Attendance REST.
export const SHIFT_TYPE_KEYS = ['morning', 'afternoon', 'full', 'night', 'rest', 'leave'] as const
const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'HR'] as const
const canWrite = (role: unknown) => typeof role === 'string' && (WRITE_ROLES as readonly string[]).includes(role)
const isValidDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

export function shiftMonthPrefix(raw: string | undefined, now: Date): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const m = Number(raw.split('-')[1])
    if (m >= 1 && m <= 12) return raw
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface ShiftBody {
  employeeId?: string; date?: string; shiftTypeKey?: string
  startTime?: string | null; endTime?: string | null; label?: string | null; color?: string | null
}

function requireWrite(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!canWrite(request.user?.role)) {
    reply.code(403).send({ error: 'Écriture du planning réservée à ADMIN/MANAGER/RH', code: 'SHIFT_WRITE_FORBIDDEN' })
    return false
  }
  return true
}

// REST auto : un shift 'rest' → upsert Attendance REST (best-effort, non bloquant).
async function syncRestAttendance(tenantId: string, employeeId: string, date: string, shiftTypeKey: string): Promise<void> {
  if (shiftTypeKey !== 'rest') return
  try {
    await prisma.attendance.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId, date } },
      create: { tenantId, employeeId, date, status: 'REST', arriveTime: null, departTime: null, note: null },
      update: { status: 'REST' },
    })
  } catch (err) {
    // Non bloquant : un échec de l'Attendance REST ne doit pas faire échouer l'écriture du shift.
    console.warn('[shifts] REST auto attendance upsert failed:', (err as Error)?.message ?? err)
  }
}

export async function shiftRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/shifts?month=YYYY-MM — lecture tout membre, scope tenant.
  app.get('/api/shifts', { preHandler: authenticate }, async (request) => {
    const tenantId = request.tenantId
    const { month } = request.query as { month?: string }
    const prefix = shiftMonthPrefix(month, new Date())
    return prisma.shift.findMany({
      where: { tenantId, date: { startsWith: prefix } },
      include: { employee: { select: { id: true, name: true, avatar: true, dept: true } } },
      orderBy: [{ date: 'asc' }],
    })
  })

  // POST /api/shifts — upsert (tenantId, employeeId, date) ; REST auto si 'rest'.
  app.post('/api/shifts', { preHandler: authenticate }, async (request, reply) => {
    if (!requireWrite(request, reply)) return
    const tenantId = request.tenantId!
    const b = request.body as ShiftBody
    if (!b.employeeId || !isValidDate(b.date)) return reply.code(400).send({ error: 'employeeId et date (YYYY-MM-DD) requis' })
    if (!b.shiftTypeKey || !(SHIFT_TYPE_KEYS as readonly string[]).includes(b.shiftTypeKey)) {
      return reply.code(400).send({ error: `shiftTypeKey invalide (${SHIFT_TYPE_KEYS.join('|')})` })
    }
    const emp = await prisma.employee.findFirst({ where: { id: b.employeeId, tenantId }, select: { id: true } })
    if (!emp) return reply.code(404).send({ error: 'Employé introuvable dans ce tenant' })
    const fields = { shiftTypeKey: b.shiftTypeKey, startTime: b.startTime ?? null, endTime: b.endTime ?? null, label: b.label ?? null, color: b.color ?? null }
    const shift = await prisma.shift.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId: b.employeeId, date: b.date } },
      create: { tenantId, employeeId: b.employeeId, date: b.date, ...fields },
      update: fields,
    })
    await syncRestAttendance(tenantId, b.employeeId, b.date, b.shiftTypeKey)
    return shift
  })

  // PATCH /api/shifts/:id — maj partielle (scope tenant).
  app.patch('/api/shifts/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!requireWrite(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    const b = request.body as ShiftBody
    if (b.shiftTypeKey !== undefined && !(SHIFT_TYPE_KEYS as readonly string[]).includes(b.shiftTypeKey)) {
      return reply.code(400).send({ error: `shiftTypeKey invalide (${SHIFT_TYPE_KEYS.join('|')})` })
    }
    const existing = await prisma.shift.findFirst({ where: { id, tenantId }, select: { id: true, employeeId: true, date: true } })
    if (!existing) return reply.code(404).send({ error: 'Shift introuvable' })
    const updated = await prisma.shift.update({
      where: { id },
      data: {
        ...(b.shiftTypeKey !== undefined ? { shiftTypeKey: b.shiftTypeKey } : {}),
        ...(b.startTime !== undefined ? { startTime: b.startTime } : {}),
        ...(b.endTime !== undefined ? { endTime: b.endTime } : {}),
        ...(b.label !== undefined ? { label: b.label } : {}),
        ...(b.color !== undefined ? { color: b.color } : {}),
      },
    })
    if (b.shiftTypeKey === 'rest') await syncRestAttendance(tenantId!, existing.employeeId, existing.date, 'rest')
    return updated
  })

  // DELETE /api/shifts/:id (scope tenant).
  app.delete('/api/shifts/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!requireWrite(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    const existing = await prisma.shift.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'Shift introuvable' })
    await prisma.shift.delete({ where: { id } })
    return { success: true }
  })
}
