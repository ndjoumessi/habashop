import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ⚠️ Web Push PWA (VAPID) — canal navigateur, DISTINCT du push Expo mobile.
// On verrouille : parsing d'une subscription, fail-safe si VAPID absent (feature non
// activée → aucun envoi, jamais d'exception), envoi par subscription, purge des abonnements
// morts (404/410).

const { webpush, base } = vi.hoisted(() => ({
  webpush: { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue(undefined) },
  base: { pushToken: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } },
}))
vi.mock('web-push', () => ({ default: webpush }))
vi.mock('../db', () => ({ basePrisma: base, prisma: base }))

import { sendWebPush, parseWebSubscription, getVapidPublicKey } from '../services/webPush'

const SUB = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }
const OLD_ENV = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
})
afterEach(() => { process.env = { ...OLD_ENV } })

describe('parseWebSubscription', () => {
  it('JSON de subscription valide → objet', () => {
    expect(parseWebSubscription(JSON.stringify(SUB))).toEqual(SUB)
  })
  it('token Expo (non-JSON) → null', () => {
    expect(parseWebSubscription('ExponentPushToken[xxx]')).toBeNull()
  })
  it('JSON sans endpoint/keys → null', () => {
    expect(parseWebSubscription(JSON.stringify({ foo: 1 }))).toBeNull()
  })
})

describe('getVapidPublicKey', () => {
  it('env absent → null', () => {
    expect(getVapidPublicKey()).toBeNull()
  })
  it('env présent → la clé', () => {
    process.env.VAPID_PUBLIC_KEY = 'PUBKEY'
    expect(getVapidPublicKey()).toBe('PUBKEY')
  })
})

describe('sendWebPush', () => {
  it('VAPID ABSENT → no-op (aucun envoi, feature non activée)', async () => {
    await sendWebPush([SUB], 'T', 'B', {})
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })

  it('aucune subscription → no-op', async () => {
    process.env.VAPID_PUBLIC_KEY = 'PUB'; process.env.VAPID_PRIVATE_KEY = 'PRIV'
    await sendWebPush([], 'T', 'B', {})
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })

  it('VAPID présent + subs → un envoi par subscription, payload JSON {title,body,data}', async () => {
    process.env.VAPID_PUBLIC_KEY = 'PUB'; process.env.VAPID_PRIVATE_KEY = 'PRIV'
    await sendWebPush([SUB, { ...SUB, endpoint: 'https://push.example/def' }], 'Titre', 'Corps', { type: 'low_stock' })
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2)
    const payload = JSON.parse(webpush.sendNotification.mock.calls[0][1])
    expect(payload).toEqual({ title: 'Titre', body: 'Corps', data: { type: 'low_stock' } })
  })

  it('abonnement mort (410) → purge par endpoint', async () => {
    process.env.VAPID_PUBLIC_KEY = 'PUB'; process.env.VAPID_PRIVATE_KEY = 'PRIV'
    webpush.sendNotification.mockRejectedValueOnce({ statusCode: 410 })
    base.pushToken.findMany.mockResolvedValueOnce([{ id: 'tok1', token: JSON.stringify(SUB) }])
    await sendWebPush([SUB], 'T', 'B', {})
    expect(base.pushToken.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['tok1'] } } })
  })

  it('erreur transitoire (500) → PAS de purge (abonnement conservé)', async () => {
    process.env.VAPID_PUBLIC_KEY = 'PUB'; process.env.VAPID_PRIVATE_KEY = 'PRIV'
    webpush.sendNotification.mockRejectedValueOnce({ statusCode: 500 })
    await sendWebPush([SUB], 'T', 'B', {})
    expect(base.pushToken.deleteMany).not.toHaveBeenCalled()
  })
})
