import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

/**
 * Segment de campagne WhatsApp (#215) — ce qui est RÉELLEMENT ciblé.
 *
 * ⚠️ Le danger n'est pas « 0 destinataire », c'est la branche `else` : elle sélectionne
 * TOUS les clients. Un segment qui franchit la validation d'entrée sans être traité plus
 * bas n'envoie donc pas rien — il arrose toute la base, sur un canal FACTURÉ.
 *
 * C'est arrivé en écrivant ce correctif : lier `typeSegments` à `CLIENT_TYPES` a sorti
 * `'semi'` des types reconnus, mais `VALID_SEGMENTS` (troisième liste, tenue à la main) le
 * gardait — donc `'semi'` passait la porte et tombait dans le `else`. Le défaut est passé
 * de « 0 destinataire en silence » à « toute la base en silence ».
 */
type TestRequest = { user?: { role: string; tenantId: string; userId: string }; tenantId?: string }

const CUSTOMERS = [
  { id: 'c1', tenantId: 'T1', phone: '+221770000001', loyaltyPoints: 100, type: 'wholesale', deletedAt: null },
  { id: 'c2', tenantId: 'T1', phone: '+221770000002', loyaltyPoints: 200, type: 'retail', deletedAt: null },
  { id: 'c3', tenantId: 'T1', phone: '+221770000003', loyaltyPoints: 300, type: 'semi-wholesale', deletedAt: null },
  { id: 'c4', tenantId: 'T1', phone: '+221770000004', loyaltyPoints: 400, type: 'retail', deletedAt: null },
  { id: 'c5', tenantId: 'T1', phone: '+221770000005', loyaltyPoints: 6000, type: 'retail', deletedAt: null }, // Gold
]

const { db, sendWhatsApp } = vi.hoisted(() => ({
  sendWhatsApp: vi.fn(async ({ to }: { to: string[] }) => ({ sent: to.length, failed: 0, denied: false })),
  db: {
    customer: {
      findMany: vi.fn(async ({ where }: { where: { type?: string } }) =>
        CUSTOMERS.filter(c => where.type === undefined || c.type === where.type)),
    },
    tenant: { findUnique: vi.fn(async () => ({ bronzeThreshold: 2000, silverThreshold: 5000 })) },
    campaign: { create: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
  },
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../redis', () => ({ redis: null }))
// ⚠️ `sendWhatsApp` vient de `lib/spend/twilioClient`, PAS de `services/whatsappSend` :
// mocker le mauvais module laissait passer l'appel au vrai client (qui ne partait que
// faute de configuration Twilio) et rendait le test vert-pour-rien sur les refus.
vi.mock('../lib/spend/twilioClient', () => ({ sendWhatsApp, isTwilioConfigured: () => true, twilioVersion: () => 'test' }))
vi.mock('../services/whatsappSend', () => ({ fmtMoney: (n: number) => String(n), localeOf: () => 'fr-FR' }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: TestRequest) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
  },
}))
vi.mock('../middleware/demoTenant', () => ({ blockDemoTenant: async () => {} }))
vi.mock('../middleware/costQuota', () => ({ costQuota: () => async () => {} }))
vi.mock('../middleware/superAdmin', () => ({ authenticateAdmin: async () => {} }))

import { whatsappRoutes } from '../routes/whatsapp'

async function buildApp() {
  const app = Fastify()
  await app.register(whatsappRoutes)
  await app.ready()
  return app
}
const campaign = async (segment?: string) => {
  const app = await buildApp()
  return app.inject({ method: 'POST', url: '/api/marketing/whatsapp/campaign', payload: { message: 'Promo', ...(segment !== undefined ? { segment } : {}) } })
}
/** Numéros RÉELLEMENT passés au dispatcher — la seule mesure qui compte. */
const targeted = (): string[] => (sendWhatsApp.mock.calls[0]?.[0] as { to: string[] } | undefined)?.to ?? []

beforeEach(() => vi.clearAllMocks())

describe('POST /api/marketing/whatsapp/campaign — résolution du segment', () => {
  it('un segment de TYPE canonique ne cible que ce palier', async () => {
    const res = await campaign('wholesale')
    expect(res.statusCode).toBe(200)
    expect(targeted()).toEqual(['+221770000001'])
  })

  it('`semi-wholesale` (canonique) cible bien le semi-gros', async () => {
    await campaign('semi-wholesale')
    expect(targeted()).toEqual(['+221770000003'])
  })

  it('⚠️ `semi` est REFUSÉ — et surtout, n’arrose pas toute la base', async () => {
    const res = await campaign('semi')
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('INVALID_SEGMENT')
    // Le cœur du verrou : aucun envoi. Avant, ce segment tombait dans le `else` = TOUS.
    expect(sendWhatsApp).not.toHaveBeenCalled()
  })

  it('un segment inconnu est refusé, aucun envoi', async () => {
    const res = await campaign('grossiste')   // libellé français : pas un segment
    expect(res.statusCode).toBe(400)
    expect(sendWhatsApp).not.toHaveBeenCalled()
  })

  it('« tous » doit être DEMANDÉ explicitement', async () => {
    await campaign('all')
    expect(targeted()).toHaveLength(CUSTOMERS.length)
  })

  it('segment absent → défaut `all` (comportement historique préservé)', async () => {
    await campaign(undefined)
    expect(targeted()).toHaveLength(CUSTOMERS.length)
  })

  it('⚠️ les segments de PALIER ciblent enfin quelqu’un — ils rendaient 0 depuis toujours', async () => {
    // `tierForPoints` rend 'Bronze' (capitalisé), le segment vaut 'bronze' : la comparaison
    // échouait TOUJOURS. Les trois segments de fidélité partaient vers 0 destinataire, en
    // silence. Ce cas l'a découvert ; il le garde fermé.
    await campaign('bronze')
    expect(targeted()).toEqual(['+221770000001', '+221770000002', '+221770000003', '+221770000004'])
  })

  it('le palier DISCRIMINE : Gold ne reçoit pas la campagne Bronze', async () => {
    // Sans ce cas, un filtre qui laisserait tout passer resterait vert.
    await campaign('gold')
    expect(targeted()).toEqual(['+221770000005'])
  })

  it('⚠️ AUCUN segment valide ne peut cibler tout le monde sans être `all`', async () => {
    // Propriété générale, pas un cas particulier : c'est elle qui empêche la prochaine
    // divergence entre la liste d'entrée et les branches de résolution.
    for (const seg of ['wholesale', 'retail', 'semi-wholesale', 'loyal']) {
      vi.clearAllMocks()
      const res = await campaign(seg)
      expect(res.statusCode).toBe(200)
      expect(targeted().length).toBeLessThan(CUSTOMERS.length)
    }
  })
})
