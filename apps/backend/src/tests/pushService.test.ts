import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted) ──────────────────────────────────────────────────────────
const { db } = vi.hoisted(() => ({
  db: {
    tenant:    { findUnique: vi.fn() },
    pushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))

const { sendMock, chunkMock } = vi.hoisted(() => ({ sendMock: vi.fn(), chunkMock: vi.fn() }))
vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken(t: unknown) { return typeof t === 'string' && t.startsWith('ExponentPushToken') }
    chunkPushNotifications(messages: any[]) { return chunkMock(messages) }
    sendPushNotificationsAsync(chunk: any[]) { return sendMock(chunk) }
  }
  return { Expo }
})

import { sendStockAlert, sendPaymentReceived, sendLeavePending, sendTrialExpiring, sendStockAlertBatch } from '../services/pushService'

const TOKEN = 'ExponentPushToken[abc]'

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.findUnique.mockResolvedValue({ notifPushAll: true })
  db.pushToken.findMany.mockResolvedValue([{ token: TOKEN }])
  db.pushToken.deleteMany.mockResolvedValue({ count: 0 })
  chunkMock.mockImplementation((m: any[]) => [m])         // 1 chunk
  sendMock.mockResolvedValue([{ status: 'ok' }])
})

describe('pushService — ciblage par rôle', () => {
  it('sendStockAlert vise MANAGER + ADMIN + SUPER_ADMIN', async () => {
    await sendStockAlert('T1', 'Coca', 2)
    expect(db.pushToken.findMany.mock.calls[0][0].where).toEqual({
      tenantId: 'T1', user: { role: { in: ['MANAGER', 'ADMIN', 'SUPER_ADMIN'] } },
    })
    expect(sendMock).toHaveBeenCalledTimes(1)
    const msg = sendMock.mock.calls[0][0][0]
    expect(msg).toMatchObject({ to: TOKEN, title: '⚠️ Rupture de stock', data: { type: 'low_stock' } })
  })

  it('sendPaymentReceived + sendLeavePending visent ADMIN + SUPER_ADMIN (pas MANAGER)', async () => {
    await sendPaymentReceived('T1', 5000, 'wave')
    await sendLeavePending('T1', 'Awa')
    expect(db.pushToken.findMany.mock.calls[0][0].where.user.role.in).toEqual(['ADMIN', 'SUPER_ADMIN'])
    expect(db.pushToken.findMany.mock.calls[1][0].where.user.role.in).toEqual(['ADMIN', 'SUPER_ADMIN'])
  })
})

describe('pushService — opt-in & robustesse', () => {
  it('notifPushAll=false → aucun token requêté, aucun envoi', async () => {
    db.tenant.findUnique.mockResolvedValue({ notifPushAll: false })
    await sendStockAlert('T1', 'Coca', 0)
    expect(db.pushToken.findMany).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('token invalide (non-Expo) filtré → aucun envoi', async () => {
    db.pushToken.findMany.mockResolvedValue([{ token: 'not-a-real-token' }])
    await sendStockAlert('T1', 'Coca', 1)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('ticket DeviceNotRegistered → purge du token mort en base', async () => {
    sendMock.mockResolvedValue([{ status: 'error', details: { error: 'DeviceNotRegistered' } }])
    await sendStockAlert('T1', 'Coca', 1)
    expect(db.pushToken.deleteMany).toHaveBeenCalledWith({ where: { token: { in: [TOKEN] } } })
  })

  it('fail-silent : une erreur DB ne lève jamais (fire-and-forget)', async () => {
    db.tenant.findUnique.mockRejectedValue(new Error('db down'))
    await expect(sendPaymentReceived('T1', 1000, 'orange')).resolves.toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })
})

describe('pushService — nouvelles fonctions cron', () => {
  it('sendTrialExpiring envoie vers ADMIN + SUPER_ADMIN avec daysLeft', async () => {
    await sendTrialExpiring('T1', 3)
    expect(db.pushToken.findMany.mock.calls[0][0].where.user.role.in).toEqual(['ADMIN', 'SUPER_ADMIN'])
    const msg = sendMock.mock.calls[0][0][0]
    expect(msg.title).toBe('⏰ Essai expire bientôt')
    expect(msg.body).toContain('3 jour')
    expect(msg.data).toMatchObject({ type: 'trial_expiring', daysLeft: 3 })
  })

  it('sendStockAlertBatch — 1 produit → titre singulier', async () => {
    await sendStockAlertBatch('T1', [{ name: 'Coca', stockQty: 0 }])
    const msg = sendMock.mock.calls[0][0][0]
    expect(msg.title).toBe('⚠️ 1 produit en rupture')
    expect(msg.body).toContain('Coca')
  })

  it('sendStockAlertBatch — N produits → résumé avec pire produit', async () => {
    await sendStockAlertBatch('T1', [
      { name: 'Coca', stockQty: 0 },
      { name: 'Fanta', stockQty: 1 },
      { name: 'Sprite', stockQty: 2 },
    ])
    const msg = sendMock.mock.calls[0][0][0]
    expect(msg.title).toBe('⚠️ 3 produits en rupture')
    expect(msg.body).toMatch(/Coca.*2 autres/)
    expect(msg.data).toMatchObject({ type: 'low_stock', productName: 'Coca' })
  })

  it('sendStockAlertBatch — liste vide → aucun envoi', async () => {
    await sendStockAlertBatch('T1', [])
    expect(sendMock).not.toHaveBeenCalled()
  })
})
