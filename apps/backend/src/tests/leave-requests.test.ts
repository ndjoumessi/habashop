import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { db } = vi.hoisted(() => ({
  db: {
    leaveRequest: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    employee:     { findFirst: vi.fn() },
    shift:        { upsert: vi.fn() },
    attendance:   { upsert: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: req.headers['x-test-role'], tenantId: req.headers['x-test-tenant'], userId: req.headers['x-test-user'] ?? 'u1' }
    req.tenantId = req.headers['x-test-tenant']
  },
}))

import { leaveRequestRoutes } from '../routes/leaveRequests'

async function buildApp() { const app = Fastify(); await app.register(leaveRequestRoutes); await app.ready(); return app }
const H = (role: string, opt: { tenant?: string; user?: string } = {}) =>
  ({ 'x-test-role': role, 'x-test-tenant': opt.tenant ?? 'T1', 'x-test-user': opt.user ?? 'u1' })

beforeEach(() => {
  vi.clearAllMocks()
  db.leaveRequest.findMany.mockResolvedValue([])
  db.leaveRequest.create.mockResolvedValue({ id: 'lr1', status: 'PENDING' })
  db.leaveRequest.update.mockResolvedValue({ id: 'lr1', status: 'APPROVED' })
  db.leaveRequest.findFirst.mockResolvedValue({ id: 'lr1', employeeId: 'e1', startDate: '2026-06-01', endDate: '2026-06-03' })
  db.employee.findFirst.mockResolvedValue({ id: 'e1' })
  db.shift.upsert.mockResolvedValue({})
  db.attendance.upsert.mockResolvedValue({})
})

describe('GET /api/leave-requests', () => {
  it('filtre status + scope tenant', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/leave-requests?status=PENDING', headers: H('CASHIER') })
    expect(res.statusCode).toBe(200)
    expect(db.leaveRequest.findMany.mock.calls[0][0].where).toEqual({ tenantId: 'T1', status: 'PENDING' })
  })
  it('isolation tenant', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/leave-requests', headers: H('HR', { tenant: 'TX' }) })
    expect(db.leaveRequest.findMany.mock.calls[0][0].where.tenantId).toBe('TX')
  })
})

describe('POST /api/leave-requests', () => {
  it('membre crée pour LUI-MÊME (employeeId == userId) → 200 PENDING', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests', headers: H('CASHIER', { user: 'e1' }),
      payload: { employeeId: 'e1', startDate: '2026-06-01', endDate: '2026-06-03', leaveType: 'Congé annuel' } })
    expect(res.statusCode).toBe(200)
    expect(db.leaveRequest.create).toHaveBeenCalled()
  })
  it('CASHIER pour un AUTRE employé → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests', headers: H('CASHIER', { user: 'uX' }),
      payload: { employeeId: 'e1', startDate: '2026-06-01', endDate: '2026-06-03' } })
    expect(res.statusCode).toBe(403)
    expect(db.leaveRequest.create).not.toHaveBeenCalled()
  })
  it('HR pour un autre employé → 200 (approbateur)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests', headers: H('HR', { user: 'uHR' }),
      payload: { employeeId: 'e1', startDate: '2026-06-01', endDate: '2026-06-03' } })
    expect(res.statusCode).toBe(200)
  })
  it('endDate < startDate → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests', headers: H('HR'),
      payload: { employeeId: 'e1', startDate: '2026-06-03', endDate: '2026-06-01' } })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/leave-requests/:id/approve (transactionnel)', () => {
  it('congé 3 jours → APPROVED + approvedBy/At + 3 Shifts Congé + 3 Attendances LEAVE', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests/lr1/approve', headers: H('MANAGER', { user: 'mgr1' }) })
    expect(res.statusCode).toBe(200)
    const upd = db.leaveRequest.update.mock.calls[0][0]
    expect(upd.data.status).toBe('APPROVED')
    expect(upd.data.approvedBy).toBe('mgr1')
    expect(upd.data.approvedAt).toBeInstanceOf(Date)
    expect(db.shift.upsert).toHaveBeenCalledTimes(3)       // 01,02,03
    expect(db.attendance.upsert).toHaveBeenCalledTimes(3)
    // les shifts générés sont de type 'leave', les attendances de status 'LEAVE'
    expect(db.shift.upsert.mock.calls[0][0].create.shiftTypeKey).toBe('leave')
    expect(db.attendance.upsert.mock.calls[0][0].create.status).toBe('LEAVE')
  })
  it('CASHIER → 403 (pas d\'approbation)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests/lr1/approve', headers: H('CASHIER') })
    expect(res.statusCode).toBe(403)
    expect(db.leaveRequest.update).not.toHaveBeenCalled()
  })
  it('demande d\'un autre tenant → 404', async () => {
    db.leaveRequest.findFirst.mockResolvedValue(null)
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests/lr1/approve', headers: H('HR') })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/leave-requests/:id/refuse', () => {
  it('REFUSED', async () => {
    db.leaveRequest.update.mockResolvedValue({ id: 'lr1', status: 'REFUSED' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests/lr1/refuse', headers: H('HR') })
    expect(res.statusCode).toBe(200)
    expect(db.leaveRequest.update.mock.calls[0][0].data.status).toBe('REFUSED')
  })
  it('CASHIER → 403', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests/lr1/refuse', headers: H('CASHIER') })
    expect(res.statusCode).toBe(403)
  })
})
