import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * HARNAIS — séparation des seaux WhatsApp (finding [2]) + exemption rafale du reçu
 * automatique (finding [4]).
 *
 * Mesuré : un seul `SpendKind 'whatsapp'`, un seul seau `quota:whatsapp:<tenant>:<jour>`
 * (30/j essai, 300/j payant) partagé par reçus, send-ticket, alertes, diffusions,
 * campagnes et crons. Une campagne de 30 en essai épuisait le jour → plus un seul
 * reçu de vente. Et `burstOk` (10/min) s'appliquait à TOUS les flux → le reçu
 * automatique perdait le 11ᵉ en heure de pointe.
 *
 * On monte le VRAI garde (`spendGuard`) avec un Redis en mémoire KEY-AWARE : les
 * seaux sont de vraies clés distinctes, la rafale un vrai compteur par minute.
 * Twilio mocké → décision observée, ZÉRO envoi réel.
 */

const { createMock, db, store } = vi.hoisted(() => ({
  createMock: vi.fn(),
  db: { tenant: { findUnique: vi.fn() } },
  store: new Map<string, number>(),
}))

vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('../redis', () => ({
  redis: {
    incrby: vi.fn(async (k: string, n: number) => { const v = (store.get(k) ?? 0) + n; store.set(k, v); return v }),
    decrby: vi.fn(async (k: string, n: number) => { const v = (store.get(k) ?? 0) - n; store.set(k, v); return v }),
    incr:   vi.fn(async (k: string) => { const v = (store.get(k) ?? 0) + 1; store.set(k, v); return v }),
    decr:   vi.fn(async (k: string) => { const v = (store.get(k) ?? 0) - 1; store.set(k, v); return v }),
    expire: vi.fn(async () => 1),
    get:    vi.fn(async (k: string) => (store.has(k) ? String(store.get(k)) : null)),
    setex:  vi.fn(async () => 'OK'),
    del:    vi.fn(async (k: string) => { store.delete(k); return 1 }),
  },
}))

import { sendWhatsApp } from '../lib/spend/twilioClient'
import { invalidateTenantSpendInfo } from '../lib/spend/spendGuard'

const TO = '+221771234501'
const TENANT = 'T'

/** Clé du seau quota du jour pour un kind donné (miroir de quotaKey, date FIXE). */
function bucketOf(kind: string): string {
  const day = new Date().toISOString().slice(0, 10)
  return `quota:${kind}:${TENANT}:${day}`
}

beforeEach(() => {
  vi.clearAllMocks()
  store.clear()
  invalidateTenantSpendInfo([TENANT])
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'token'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
  process.env.COST_BURST_PER_MIN = '10'
  // Boutique en essai (les seaux d'essai sont les plus bas → conditions les plus dures).
  db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'trial', trialEnds: new Date(Date.now() + 7 * 86400_000) })
  createMock.mockResolvedValue({ sid: 'SM1' })
})

describe('[2] Deux seaux distincts : le marketing ne coupe pas le transactionnel', () => {
  it('un seau marketing SATURÉ n’empêche pas un reçu de vente', async () => {
    // Sature le seau marketing en le montant à sa limite d'essai.
    const marketing = await sendWhatsApp({ tenantId: TENANT, to: TO, body: 'promo', owner: { kind: 'customer' }, flow: 'marketing' })
    void marketing
    store.set(bucketOf('whatsapp_marketing'), 999) // seau marketing plein à craquer
    invalidateTenantSpendInfo([TENANT])

    const receipt = await sendWhatsApp({ tenantId: TENANT, to: TO, body: 'reçu', owner: { kind: 'customer' }, flow: 'sale_receipt' })
    expect(receipt.sent, 'le reçu a été coupé par le quota MARKETING').toBe(1)
  })

  it('les deux flux écrivent dans des CLÉS différentes', async () => {
    await sendWhatsApp({ tenantId: TENANT, to: TO, body: 'reçu', owner: { kind: 'customer' }, flow: 'sale_receipt' })
    await sendWhatsApp({ tenantId: TENANT, to: TO, body: 'promo', owner: { kind: 'customer' }, flow: 'marketing' })

    expect(store.get(bucketOf('whatsapp')), 'seau transactionnel').toBe(1)
    expect(store.get(bucketOf('whatsapp_marketing')), 'seau marketing').toBe(1)
  })

  it('le seau marketing a un plafond d’essai BAS (placeholder conservateur)', async () => {
    // Rafale désactivée pour isoler le plafond JOURNALIER (sinon le 11e bute d'abord
    // sur la minute, cf. test dédié plus bas). Défaut marketing = 10 → le 11e refusé.
    process.env.COST_BURST_PER_MIN = '0'
    for (let i = 0; i < 10; i++) await sendWhatsApp({ tenantId: TENANT, to: TO, body: 'promo', owner: { kind: 'customer' }, flow: 'marketing' })
    const overflow = await sendWhatsApp({ tenantId: TENANT, to: TO, body: 'promo', owner: { kind: 'customer' }, flow: 'marketing' })
    expect(overflow.denied).toBe(true)
    expect(overflow.code).toBe('QUOTA_EXCEEDED')
  })
})

describe('[4] Rafale : seul le reçu AUTOMATIQUE est exempté', () => {
  it('le reçu auto passe au-delà de 10/min (11 ventes → 11 reçus)', async () => {
    for (let i = 0; i < 11; i++) {
      const r = await sendWhatsApp({ tenantId: TENANT, to: TO, body: `reçu ${i}`, owner: { kind: 'customer' }, flow: 'sale_receipt' })
      expect(r.sent, `le reçu ${i + 1} a été coupé par la rafale`).toBe(1)
    }
    expect(createMock).toHaveBeenCalledTimes(11)
  })

  it('send-ticket manuel (transactional) RESTE plafonné à la minute', async () => {
    let denied = 0
    for (let i = 0; i < 12; i++) {
      const r = await sendWhatsApp({ tenantId: TENANT, to: TO, body: `manuel ${i}`, owner: { kind: 'customer' }, flow: 'transactional' })
      if (r.denied && r.code === 'BURST_EXCEEDED') denied++
    }
    expect(denied, 'le flux transactionnel manuel devrait buter sur la rafale').toBeGreaterThan(0)
  })

  it('le reçu auto reste borné par le JOURNALIER (l’exemption n’est QUE la rafale)', async () => {
    process.env.COST_BURST_PER_MIN = '0' // rafale désactivée pour isoler le journalier
    store.set(bucketOf('whatsapp'), 30)  // seau transactionnel d'essai déjà plein
    invalidateTenantSpendInfo([TENANT])
    const r = await sendWhatsApp({ tenantId: TENANT, to: TO, body: 'reçu', owner: { kind: 'customer' }, flow: 'sale_receipt' })
    expect(r.denied).toBe(true)
    expect(r.code).toBe('QUOTA_EXCEEDED')
  })
})
