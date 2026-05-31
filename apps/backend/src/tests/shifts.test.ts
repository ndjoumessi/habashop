import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { db } = vi.hoisted(() => ({
  db: {
    shift:      { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    employee:   { findFirst: vi.fn() },
    attendance: { upsert: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: req.headers['x-test-role'], tenantId: req.headers['x-test-tenant'], userId: req.headers['x-test-user'] ?? 'u1' }
    req.tenantId = req.headers['x-test-tenant']
  },
}))

import { shiftRoutes, shiftMonthPrefix } from '../routes/shifts'

async function buildApp() { const app = Fastify(); await app.register(shiftRoutes); await app.ready(); return app }
const H = (role: string, tenant = 'T1') => ({ 'x-test-role': role, 'x-test-tenant': tenant })

beforeEach(() => {
  vi.clearAllMocks()
  db.shift.findMany.mockResolvedValue([])
  db.shift.upsert.mockResolvedValue({ id: 's1' })
  db.shift.update.mockResolvedValue({ id: 's1' })
  db.shift.delete.mockResolvedValue({ id: 's1' })
  db.shift.findFirst.mockResolvedValue({ id: 's1', employeeId: 'e1', date: '2026-06-02' })
  db.employee.findFirst.mockResolvedValue({ id: 'e1' })
  db.attendance.upsert.mockResolvedValue({ id: 'a1' })
})

describe('shiftMonthPrefix', () => {
  const now = new Date(2026, 5, 2)
  it('raw valide / défaut mois courant', () => {
    expect(shiftMonthPrefix('2026-02', now)).toBe('2026-02')
    expect(shiftMonthPrefix(undefined, now)).toBe('2026-06')
    expect(shiftMonthPrefix('2026-13', now)).toBe('2026-06')
  })
})

describe('GET /api/shifts', () => {
  it('scope tenant + filtre mois ; lecture tout membre', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/shifts?month=2026-06', headers: H('CASHIER') })
    expect(res.statusCode).toBe(200)
    expect(db.shift.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'T1', date: { startsWith: '2026-06' } } }))
  })
  it('isolation tenant (where.tenantId du JWT)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/shifts', headers: H('HR', 'TENANT_X') })
    expect(db.shift.findMany.mock.calls[0][0].where.tenantId).toBe('TENANT_X')
  })
})

describe('POST /api/shifts', () => {
  it('upsert (tenantId,employeeId,date,shiftTypeKey)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/shifts', headers: H('MANAGER'),
      payload: { employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'morning' } })
    expect(res.statusCode).toBe(200)
    expect(db.shift.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_employeeId_date_shiftTypeKey: { tenantId: 'T1', employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'morning' } },
    }))
    expect(db.attendance.upsert).not.toHaveBeenCalled() // pas REST → pas d'Attendance auto
  })
  it('multi-shift : deux types différents le même jour → 2 upserts ciblant des clés composites distinctes', async () => {
    const app = await buildApp()
    // 1ᵉʳ shift : matin
    await app.inject({ method: 'POST', url: '/api/shifts', headers: H('MANAGER'),
      payload: { employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'morning' } })
    // 2ᵉ shift le MÊME jour : soir (night) → ne doit PAS écraser le matin (clé composite différente)
    await app.inject({ method: 'POST', url: '/api/shifts', headers: H('MANAGER'),
      payload: { employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'night' } })
    expect(db.shift.upsert).toHaveBeenCalledTimes(2)
    expect(db.shift.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { tenantId_employeeId_date_shiftTypeKey: { tenantId: 'T1', employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'morning' } },
    }))
    expect(db.shift.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { tenantId_employeeId_date_shiftTypeKey: { tenantId: 'T1', employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'night' } },
    }))
  })
  it('shift REST → Attendance REST auto (best-effort)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/shifts', headers: H('HR'),
      payload: { employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'rest' } })
    expect(res.statusCode).toBe(200)
    expect(db.attendance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'REST', date: '2026-06-02', employeeId: 'e1' }),
    }))
  })
  it('shiftTypeKey invalide → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/shifts', headers: H('HR'), payload: { employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'foo' } })
    expect(res.statusCode).toBe(400)
  })
  it('employé hors tenant → 404', async () => {
    db.employee.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/shifts', headers: H('ADMIN'), payload: { employeeId: 'eX', date: '2026-06-02', shiftTypeKey: 'full' } })
    expect(res.statusCode).toBe(404)
  })
  it('CASHIER écriture → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/shifts', headers: H('CASHIER'), payload: { employeeId: 'e1', date: '2026-06-02', shiftTypeKey: 'full' } })
    expect(res.statusCode).toBe(403)
    expect(db.shift.upsert).not.toHaveBeenCalled()
  })
})

describe('PATCH/DELETE /api/shifts/:id', () => {
  it('PATCH maj partielle (scope tenant)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/shifts/s1', headers: H('MANAGER'), payload: { shiftTypeKey: 'night' } })
    expect(res.statusCode).toBe(200)
    expect(db.shift.update).toHaveBeenCalled()
  })
  it('DELETE → success', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/shifts/s1', headers: H('ADMIN') })
    expect(res.statusCode).toBe(200)
    expect(db.shift.delete).toHaveBeenCalledWith({ where: { id: 's1' } })
  })
  it('DELETE CASHIER → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/shifts/s1', headers: H('CASHIER') })
    expect(res.statusCode).toBe(403)
  })
})
