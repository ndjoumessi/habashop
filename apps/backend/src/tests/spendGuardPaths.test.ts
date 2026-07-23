import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Preuve sur les CHEMINS RÉELS de dépense — ceux qui n'ont pas de requête HTTP et que
 * les gardes de route ne pouvaient donc pas couvrir :
 *   • le reçu WhatsApp automatique déclenché par une vente ;
 *   • les crons 20h / 8h.
 *
 * ⚠️ Aucun envoi réel : `twilio` est mocké et l'assertion porte sur le fait que
 * `messages.create` n'est JAMAIS appelé. C'est la leçon d'un contrôle positif précédent
 * qui avait réellement expédié un message.
 */

const { createMock, tenantStore, redisMock } = vi.hoisted(() => ({
  createMock: vi.fn(async () => ({ sid: 'SM_test' })),
  tenantStore: { current: null as any },
  redisMock: {
    get: vi.fn(async () => null), setex: vi.fn(async () => 'OK'), del: vi.fn(async () => 1),
    incrby: vi.fn(async (_k: string, _by: number) => 1),
    decrby: vi.fn(async (_k: string, _by: number) => 0),
    expire: vi.fn(async (_k: string, _t: number) => 1),
  },
}))

vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../db', () => ({
  prisma: { tenant: { findUnique: vi.fn(async () => tenantStore.current) } },
}))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { sendSaleWhatsApp } from '../services/whatsappSend'
import { sendWhatsApp } from '../lib/spend/twilioClient'
import { DEMO_TENANT_FORBIDDEN, TRIAL_EXPIRED } from '../lib/spend/spendGuard'

const SALE = { id: 'sale-1', total: 10000, paymentMode: 'cash', createdAt: new Date('2026-07-22') }
const ITEMS = [{ qty: 1, total: 10000, product: { name: 'Riz local 25kg' } }]
const CUSTOMER = { name: 'Awa', phone: '+221771234567' }
const TENANT = { id: 'T', name: 'Boutique', currency: 'XOF', lang: 'fr', enableAutoWhatsApp: true }

/** État de la boutique renvoyé par la résolution unique du garde. */
function seedTenant(over: Partial<{ isDemo: boolean; status: string; trialEnds: Date | null }> = {}) {
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null, ...over }
}

/** `n` pilote le compteur quotidien ; la rafale reste à 1 (opérations, pas unités). */
function seedCounter(n: number) {
  redisMock.incrby.mockImplementation(async (key: string) =>
    String(key).startsWith('burst:') ? 1 : n)
}

beforeEach(() => {
  vi.clearAllMocks()
  seedTenant()
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'token_test'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
  seedCounter(1)
})

describe('Reçu automatique de vente — le plus gros poste Twilio', () => {
  it('boutique DÉMO → aucun message envoyé, messages.create jamais appelé', async () => {
    seedTenant({ isDemo: true })
    const ok = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    expect(ok).toBe(false)
    expect(createMock).not.toHaveBeenCalled() // ← la preuve : aucune dépense engagée
  })

  it('la vente RÉUSSIT quand même — le refus est non bloquant', async () => {
    seedTenant({ isDemo: true })
    // sendSaleWhatsApp ne doit jamais throw : la vente ne dépend pas de WhatsApp.
    await expect(sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)).resolves.toBe(false)
  })

  it('la décision porte bien le code DEMO_TENANT_FORBIDDEN', async () => {
    seedTenant({ isDemo: true })
    const res = await sendWhatsApp({ tenantId: 'T', to: CUSTOMER.phone, body: 'x' , owner: { kind: 'customer' }})
    expect(res).toMatchObject({ sent: 0, denied: true, code: DEMO_TENANT_FORBIDDEN })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('essai expiré → refus, toujours sans envoi', async () => {
    seedTenant({ status: 'trial', trialEnds: new Date(Date.now() - 86400000) })
    const res = await sendWhatsApp({ tenantId: 'T', to: CUSTOMER.phone, body: 'x' , owner: { kind: 'customer' }})
    expect(res.denied).toBe(true)
    expect(res.code).toBe(TRIAL_EXPIRED)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('boutique cliente saine → le message part (contrôle positif, mock)', async () => {
    const ok = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    expect(ok).toBe(true)
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

describe('Crons 20h / 8h — dépense hors requête HTTP', () => {
  it('la boucle exclut les boutiques de démo à la source', async () => {
    // Le cron interroge `findMany({ where: { isDemo: false } })` : on prouve que la
    // clause est bien présente dans le code appelé (le garde reste le filet en aval).
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', 'routes', 'whatsapp.ts'), 'utf8')
    const crons = src.split('async function send').slice(1, 3)
    expect(crons).toHaveLength(2)
    for (const body of crons) {
      expect(body.slice(0, 800)).toContain('isDemo: false')
    }
  })

  it('même si un tenant démo passait, le client refuse sans envoyer', async () => {
    seedTenant({ isDemo: true })
    const res = await sendWhatsApp({ tenantId: 'demo-tenant-001', to: '+221771234567', body: 'résumé du soir' , owner: { kind: 'customer' }})
    expect(res.denied).toBe(true)
    expect(res.code).toBe(DEMO_TENANT_FORBIDDEN)
    expect(createMock).not.toHaveBeenCalled()
  })
})

describe('Quota par MESSAGE et non par requête (campagne)', () => {
  it('une campagne de N destinataires réserve N unités', async () => {
    const phones = Array.from({ length: 40 }, (_, i) => `+2217712345${String(i).padStart(2, '0')}`)
    seedCounter(40)
    await sendWhatsApp({ tenantId: 'T', to: phones, body: 'promo' , owner: { kind: 'customer' }})
    expect(redisMock.incrby).toHaveBeenCalledWith(expect.stringContaining('quota:whatsapp:T:'), 40)
  })

  it('si le N complet ne rentre pas → refus ENTIER, réservation rendue, zéro envoi', async () => {
    const phones = Array.from({ length: 40 }, (_, i) => `+2217712345${String(i).padStart(2, '0')}`)
    seedTenant({ status: 'trial', trialEnds: new Date(Date.now() + 86400000) }) // plafond 30
    seedCounter(40) // 0 déjà utilisés + 40 demandés > 30
    const res = await sendWhatsApp({ tenantId: 'T', to: phones, body: 'promo' , owner: { kind: 'customer' }})

    expect(res.denied).toBe(true)
    expect(res.code).toBe('QUOTA_EXCEEDED')
    expect(res.message).toContain('40 requis')
    expect(res.message).toContain('30 restant')
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.stringContaining('quota:whatsapp:T:'), 40)
    expect(createMock).not.toHaveBeenCalled() // pas de campagne tronquée à mi-cible
  })

  it('les envois échoués sont rendus au compteur', async () => {
    seedCounter(3)
    createMock
      .mockResolvedValueOnce({ sid: 'SM1' } as any)
      .mockRejectedValueOnce(new Error('numéro invalide') as any)
      .mockResolvedValueOnce({ sid: 'SM3' } as any)
    const res = await sendWhatsApp({ tenantId: 'T', to: ['+221771234501', '+221771234502', '+221771234503'], body: 'x' , owner: { kind: 'customer' }})
    expect(res.sent).toBe(2)
    expect(res.failed).toBe(1)
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.stringContaining('quota:whatsapp:T:'), 1)
  })
})
