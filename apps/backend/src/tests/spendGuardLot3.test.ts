import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Revue lots 1-2 — correctifs #3 (reçu de vente hors rafale), #7 (seaux séparés),
 * #4 (créneau de campagne rendu quand rien ne part), + empreinte de build.
 *
 * Chaque test asserte un RÉSULTAT observable, pas l'absence d'exception.
 */

const { createMock, tenantStore, redisMock } = vi.hoisted(() => ({
  createMock: vi.fn(async () => ({ sid: 'SM1' })),
  tenantStore: { current: null as { isDemo: boolean; status: string; trialEnds: Date | null } | null },
  redisMock: {
    get:    vi.fn(async (_k: string) => null as string | null),
    setex:  vi.fn(async (_k: string, _t: number, _v: string) => 'OK'),
    del:    vi.fn(async (..._k: string[]) => 1),
    incrby: vi.fn(async (_k: string, _by: number) => 1),
    decrby: vi.fn(async (_k: string, _by: number) => 0),
    expire: vi.fn(async (_k: string, _t: number) => 1),
  },
}))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../db', () => ({ prisma: { tenant: { findUnique: vi.fn(async () => tenantStore.current) } } }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { sendWhatsApp } from '../lib/spend/twilioClient'
import { quotaKey, BURST_EXCEEDED } from '../lib/spend/spendGuard'
import { sendSaleWhatsApp } from '../services/whatsappSend'
import { getBuildId } from '../lib/version'

const SALE = { id: 's1', total: 10000, paymentMode: 'cash', createdAt: new Date('2026-07-22') }
const ITEMS = [{ qty: 1, total: 10000, product: { name: 'Riz' } }]
const CUSTOMER = { name: 'Awa', phone: '+221771234567' }
const TENANT = { id: 'T', country: 'SN', name: 'B', currency: 'XOF', lang: 'fr', enableAutoWhatsApp: true }

beforeEach(() => {
  vi.clearAllMocks()
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null }
  redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 1 : 1))
  createMock.mockResolvedValue({ sid: 'SM1' })
  process.env.TWILIO_ACCOUNT_SID = 'AC'
  process.env.TWILIO_AUTH_TOKEN = 'tok'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
  delete process.env.COST_BURST_PER_MIN
})

// ── #3 ────────────────────────────────────────────────────────────────────────
describe('#3 — le reçu de vente n’est PAS soumis au plafond minute', () => {
  it('la 11e vente de la minute envoie quand même son reçu', async () => {
    // Compteur de rafale déjà au-dessus du plafond : un envoi marketing serait refusé.
    redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 99 : 1))
    const ok = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    expect(ok).toBe(true)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('le reçu ne touche même pas le compteur de rafale', async () => {
    await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    const burstCalls = redisMock.incrby.mock.calls.filter(c => String(c[0]).startsWith('burst:'))
    expect(burstCalls).toHaveLength(0)
  })

  it('mais le quota quotidien continue de le borner', async () => {
    redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 1 : 999))
    const ok = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    expect(ok).toBe(false)          // plafond journalier dépassé → refusé
    expect(createMock).not.toHaveBeenCalled()
  })

  it('un envoi marketing, lui, reste soumis à la rafale', async () => {
    redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 99 : 1))
    const res = await sendWhatsApp({ tenantId: 'T', to: '+221771234567', body: 'x', kind: 'marketing' })
    expect(res.denied).toBe(true)
    expect(res.code).toBe(BURST_EXCEEDED)
  })
})

// ── #7 ────────────────────────────────────────────────────────────────────────
describe('#7 — campagnes et reçus ne partagent plus le même seau', () => {
  it('une campagne consomme le compteur « marketing », pas « whatsapp »', async () => {
    await sendWhatsApp({ tenantId: 'T', to: ['+221771234567'], body: 'promo', kind: 'marketing' })
    const keys = redisMock.incrby.mock.calls.map(c => String(c[0])).filter(k => k.startsWith('quota:'))
    expect(keys.some(k => k.startsWith('quota:marketing:T:'))).toBe(true)
    expect(keys.some(k => k.startsWith('quota:whatsapp:T:'))).toBe(false)
  })

  it('un reçu consomme « whatsapp », pas « marketing »', async () => {
    await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    const keys = redisMock.incrby.mock.calls.map(c => String(c[0])).filter(k => k.startsWith('quota:'))
    expect(keys.some(k => k.startsWith('quota:whatsapp:T:'))).toBe(true)
    expect(keys.some(k => k.startsWith('quota:marketing:T:'))).toBe(false)
  })

  it('un seau marketing ÉPUISÉ ne bloque pas les reçus clients', async () => {
    // Le scénario du finding : une campagne de 300 vidait le quota du jour et coupait
    // silencieusement tous les reçus jusqu'au lendemain.
    redisMock.incrby.mockImplementation(async (k: string) => {
      if (String(k).startsWith('burst:')) return 1
      return String(k).startsWith('quota:marketing:') ? 9999 : 1
    })
    const campagne = await sendWhatsApp({ tenantId: 'T', to: ['+221770000001'], body: 'promo', kind: 'marketing' })
    expect(campagne.denied).toBe(true)                 // marketing épuisé

    const recu = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    expect(recu).toBe(true)                            // le reçu passe toujours
  })

  it('les deux seaux ont des clés distinctes', () => {
    expect(quotaKey('T', 'marketing')).not.toBe(quotaKey('T', 'whatsapp'))
  })
})

// ── #4 ────────────────────────────────────────────────────────────────────────
describe('#4 — le créneau horaire n’est pas brûlé quand rien n’est envoyé', () => {
  it('la route rend le créneau sur refus de quota et sur envoi nul', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', 'routes', 'whatsapp.ts'), 'utf8')
    expect(src).toContain('releaseCampaignSlot')
    // rendu sur refus (quota/démo) …
    expect(src).toMatch(/if \(res\.denied\) \{\s*\n\s*await releaseCampaignSlot\(\)/)
    // … et quand aucun message n'est parti (Twilio non configuré, numéros inexploitables)
    expect(src).toMatch(/if \(res\.sent === 0\) \{\s*\n\s*await releaseCampaignSlot\(\)/)
  })

  it('le refus remonte les unités restantes, pour que le commerçant ajuste sa cible', async () => {
    redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 1 : 400))
    const res = await sendWhatsApp({ tenantId: 'T', to: ['+221770000001'], body: 'x', kind: 'marketing' })
    expect(res.denied).toBe(true)
    expect(typeof res.remaining).toBe('number')
  })
})

// ── Empreinte de build ────────────────────────────────────────────────────────
describe('Empreinte de build — savoir QUEL binaire tourne', () => {
  it('getBuildId renvoie une empreinte horodatée, pas « unknown »', () => {
    // La version seule ne suffit pas : deux correctifs successifs partagent le même
    // semver, et `railway up` n'expose aucune variable git.
    expect(getBuildId()).toMatch(/^\d{8}T\d{6}Z-[0-9a-f]+$|^bootstrap$/)
    expect(getBuildId()).not.toBe('unknown')
  })

  it('/health expose le champ build', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', 'server.ts'), 'utf8')
    expect(src).toContain('build: getBuildId()')
  })
})
