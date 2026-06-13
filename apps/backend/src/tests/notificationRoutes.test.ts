import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { db } = vi.hoisted(() => ({
  db: {
    pushToken: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'CASHIER', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
}))
vi.mock('../lib/userStatus', () => ({ isUserActive: vi.fn().mockResolvedValue(true) }))
vi.mock('../lib/wsAuth', () => ({
  decideWsAuth: vi.fn().mockReturnValue({ ok: false }),
}))

import { notificationRoutes } from '../routes/notifications'

async function buildApp() {
  const app = Fastify()
  await app.register(notificationRoutes)
  await app.ready()
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/notifications/token', () => {
  it('upsert réussit → 200 + id', async () => {
    db.pushToken.upsert.mockResolvedValue({ id: 'pt1', token: 'ExponentPushToken[abc]' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/notifications/token',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ token: 'ExponentPushToken[abc]', platform: 'android' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ success: true, id: 'pt1' })
  })

  it('token manquant → 400', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/notifications/token',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ platform: 'ios' }),
    })
    expect(res.statusCode).toBe(400)
    expect(db.pushToken.upsert).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/notifications/token', () => {
  it('supprime le token de cet utilisateur → 200', async () => {
    db.pushToken.deleteMany.mockResolvedValue({ count: 1 })
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: '/api/notifications/token',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ token: 'ExponentPushToken[abc]' }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ success: true })
    expect(db.pushToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'ExponentPushToken[abc]', userId: 'u1' } })
  })

  it('token manquant → 400, pas de deleteMany', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'DELETE', url: '/api/notifications/token',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    })
    expect(res.statusCode).toBe(400)
    expect(db.pushToken.deleteMany).not.toHaveBeenCalled()
  })
})
