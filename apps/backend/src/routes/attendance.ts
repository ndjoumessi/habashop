import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

// Statuts de présence — convention String du projet (pas d'enum Prisma) ; validés ici.
// HALF = mi-temps (utilisé par la feuille de présence frontend) ; LEAVE/REST réservés
// (congé/repos, ex. report planning). Tous acceptés par l'API.
export const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'HALF', 'LEAVE', 'REST'] as const
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number]

// Écriture (POST/PATCH/DELETE) : ADMIN/SUPER_ADMIN/MANAGER/HR. Lecture : tout membre.
const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'HR'] as const
const canWrite = (role: unknown) => typeof role === 'string' && (WRITE_ROLES as readonly string[]).includes(role)

// "YYYY-MM" du mois demandé (défaut = mois courant). Pur → testable.
export function attendanceMonthPrefix(raw: string | undefined, now: Date): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const m = Number(raw.split('-')[1])
    if (m >= 1 && m <= 12) return raw
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const isValidDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
const isValidStatus = (s: unknown): s is AttendanceStatus =>
  typeof s === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(s)

interface AttendanceBody {
  employeeId?: string
  date?: string
  status?: string
  arriveTime?: string | null
  departTime?: string | null
  note?: string | null
}

function requireWrite(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!canWrite(request.user?.role)) {
    reply.code(403).send({ error: 'Écriture des présences réservée à ADMIN/MANAGER/RH', code: 'ATTENDANCE_WRITE_FORBIDDEN' })
    return false
  }
  return true
}

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/attendance?month=YYYY-MM — lecture : tout membre du tenant. Scope tenant strict.
  app.get('/api/attendance', { preHandler: authenticate }, async (request) => {
    const tenantId = request.tenantId
    const { month } = request.query as { month?: string }
    const prefix = attendanceMonthPrefix(month, new Date())
    return prisma.attendance.findMany({
      where: { tenantId, date: { startsWith: prefix } },
      include: { employee: { select: { id: true, name: true, avatar: true, dept: true } } },
      orderBy: [{ date: 'asc' }],
    })
  })

  // POST /api/attendance — upsert sur (tenantId, employeeId, date) → 1 entrée/employé/jour.
  app.post('/api/attendance', { preHandler: authenticate }, async (request, reply) => {
    if (!requireWrite(request, reply)) return
    const tenantId = request.tenantId
    const b = request.body as AttendanceBody
    if (!b.employeeId || !isValidDate(b.date)) {
      return reply.code(400).send({ error: 'employeeId et date (YYYY-MM-DD) requis' })
    }
    if (!isValidStatus(b.status)) {
      return reply.code(400).send({ error: `status invalide (${ATTENDANCE_STATUSES.join('|')})` })
    }
    // Garde tenant : l'employé ciblé doit appartenir au tenant de l'appelant.
    const emp = await prisma.employee.findFirst({ where: { id: b.employeeId, tenantId }, select: { id: true } })
    if (!emp) return reply.code(404).send({ error: 'Employé introuvable dans ce tenant' })
    const fields = { status: b.status, arriveTime: b.arriveTime ?? null, departTime: b.departTime ?? null, note: b.note ?? null }
    return prisma.attendance.upsert({
      where: { tenantId_employeeId_date: { tenantId: tenantId!, employeeId: b.employeeId, date: b.date } },
      create: { tenantId: tenantId!, employeeId: b.employeeId, date: b.date, ...fields },
      update: fields,
    })
  })

  // PATCH /api/attendance/:id — maj partielle d'une entrée existante (scope tenant).
  app.patch('/api/attendance/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!requireWrite(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    const b = request.body as AttendanceBody
    if (b.status !== undefined && !isValidStatus(b.status)) {
      return reply.code(400).send({ error: `status invalide (${ATTENDANCE_STATUSES.join('|')})` })
    }
    const existing = await prisma.attendance.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'Présence introuvable' })
    return prisma.attendance.update({
      where: { id },
      data: {
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.arriveTime !== undefined ? { arriveTime: b.arriveTime } : {}),
        ...(b.departTime !== undefined ? { departTime: b.departTime } : {}),
        ...(b.note !== undefined ? { note: b.note } : {}),
      },
    })
  })

  // DELETE /api/attendance/:id (scope tenant).
  app.delete('/api/attendance/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!requireWrite(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    const existing = await prisma.attendance.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return reply.code(404).send({ error: 'Présence introuvable' })
    await prisma.attendance.delete({ where: { id } })
    return { success: true }
  })
}
