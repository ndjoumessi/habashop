import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { db } = vi.hoisted(() => ({
  db: {
    attendance: { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    employee:   { findFirst: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: req.headers['x-test-role'], tenantId: req.headers['x-test-tenant'], userId: 'u1' }
    req.tenantId = req.headers['x-test-tenant']
  },
}))

import { attendanceRoutes, attendanceMonthPrefix } from '../routes/attendance'

async function buildApp() {
  const app = Fastify()
  await app.register(attendanceRoutes)
  await app.ready()
  return app
}
// Pas de content-type ici : app.inject le pose automatiquement quand un payload objet est
// présent (POST/PATCH). Le forcer sur un DELETE sans body ferait échouer le parse (400).
const H = (role: string, tenant = 'T1') => ({ 'x-test-role': role, 'x-test-tenant': tenant })

beforeEach(() => {
  vi.clearAllMocks()
  db.attendance.findMany.mockResolvedValue([])
  db.attendance.upsert.mockResolvedValue({ id: 'a1' })
  db.attendance.update.mockResolvedValue({ id: 'a1' })
  db.attendance.delete.mockResolvedValue({ id: 'a1' })
  db.attendance.findFirst.mockResolvedValue({ id: 'a1' })
  db.employee.findFirst.mockResolvedValue({ id: 'e1' })
})

describe('attendanceMonthPrefix (pur)', () => {
  const now = new Date(2026, 4, 18) // mai 2026
  it('raw valide → renvoyé', () => expect(attendanceMonthPrefix('2026-02', now)).toBe('2026-02'))
  it('raw absent/invalide → mois courant', () => {
    expect(attendanceMonthPrefix(undefined, now)).toBe('2026-05')
    expect(attendanceMonthPrefix('2026-13', now)).toBe('2026-05')
    expect(attendanceMonthPrefix('nope', now)).toBe('2026-05')
  })
})

describe('GET /api/attendance', () => {
  it('scope tenant strict + filtre mois (startsWith) ; lecture par tout membre', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/attendance?month=2026-05', headers: H('CASHIER') })
    expect(res.statusCode).toBe(200)
    expect(db.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'T1', date: { startsWith: '2026-05' } },
    }))
  })
  it('ne lit jamais un autre tenant (where.tenantId = celui du JWT)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/attendance?month=2026-05', headers: H('HR', 'TENANT_X') })
    const arg = db.attendance.findMany.mock.calls[0][0]
    expect(arg.where.tenantId).toBe('TENANT_X')
  })
})

describe('POST /api/attendance (upsert)', () => {
  it('crée/maj via upsert sur (tenantId,employeeId,date) — pas de doublon', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/attendance', headers: H('HR'),
      payload: { employeeId: 'e1', date: '2026-05-18', status: 'PRESENT', arriveTime: '08:05' } })
    expect(res.statusCode).toBe(200)
    expect(db.attendance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_employeeId_date: { tenantId: 'T1', employeeId: 'e1', date: '2026-05-18' } },
    }))
    const arg = db.attendance.upsert.mock.calls[0][0]
    expect(arg.create.status).toBe('PRESENT')
    expect(arg.update.status).toBe('PRESENT')
  })
  it('status HALF (mi-temps, feuille de présence frontend) accepté → 200', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/attendance', headers: H('MANAGER'),
      payload: { employeeId: 'e1', date: '2026-05-18', status: 'HALF' } })
    expect(res.statusCode).toBe(200)
    expect(db.attendance.upsert).toHaveBeenCalled()
  })
  it('status invalide → 400 (aucun upsert)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/attendance', headers: H('HR'),
      payload: { employeeId: 'e1', date: '2026-05-18', status: 'FOO' } })
    expect(res.statusCode).toBe(400)
    expect(db.attendance.upsert).not.toHaveBeenCalled()
  })
  it('date invalide → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/attendance', headers: H('HR'),
      payload: { employeeId: 'e1', date: '18/05/2026', status: 'PRESENT' } })
    expect(res.statusCode).toBe(400)
  })
  it('employé hors tenant → 404 (garde isolation en écriture)', async () => {
    db.employee.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/attendance', headers: H('ADMIN'),
      payload: { employeeId: 'eX', date: '2026-05-18', status: 'PRESENT' } })
    expect(res.statusCode).toBe(404)
    expect(db.attendance.upsert).not.toHaveBeenCalled()
  })
  it('CASHIER en écriture → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/attendance', headers: H('CASHIER'),
      payload: { employeeId: 'e1', date: '2026-05-18', status: 'PRESENT' } })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('ATTENDANCE_WRITE_FORBIDDEN')
    expect(db.attendance.upsert).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/attendance/:id', () => {
  it('maj partielle (champs fournis seulement), scope tenant', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/attendance/a1', headers: H('MANAGER'),
      payload: { status: 'LATE', arriveTime: '09:30' } })
    expect(res.statusCode).toBe(200)
    expect(db.attendance.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1', tenantId: 'T1' } }))
    const arg = db.attendance.update.mock.calls[0][0]
    expect(arg.data).toEqual({ status: 'LATE', arriveTime: '09:30' }) // pas de departTime/note non fournis
  })
  it('status invalide → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/attendance/a1', headers: H('HR'), payload: { status: 'X' } })
    expect(res.statusCode).toBe(400)
  })
  it('entrée d\'un autre tenant → 404 (findFirst null)', async () => {
    db.attendance.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/attendance/a1', headers: H('HR'), payload: { status: 'ABSENT' } })
    expect(res.statusCode).toBe(404)
    expect(db.attendance.update).not.toHaveBeenCalled()
  })
  it('CASHIER → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/attendance/a1', headers: H('CASHIER'), payload: { status: 'ABSENT' } })
    expect(res.statusCode).toBe(403)
  })
})

describe('DELETE /api/attendance/:id', () => {
  it('supprime (scope tenant) → success', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/attendance/a1', headers: H('ADMIN') })
    expect(res.statusCode).toBe(200)
    expect(res.json().success).toBe(true)
    expect(db.attendance.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
  })
  it('CASHIER → 403 (aucune suppression)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/attendance/a1', headers: H('CASHIER') })
    expect(res.statusCode).toBe(403)
    expect(db.attendance.delete).not.toHaveBeenCalled()
  })
})
