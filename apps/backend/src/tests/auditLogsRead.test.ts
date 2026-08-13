import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

/**
 * COMPORTEMENT de `GET /api/audit-logs` — complément indispensable au méta-test
 * `auditWriteConvention.test.ts`, qui ne fait que grep le source (il passerait au
 * rouge sur un reformatage et resterait vert si le bloc devenait inatteignable).
 * Ici on exerce la route et on assert sur la RÉPONSE.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { auditLog: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() } },
}))
vi.mock('../db', () => ({ prisma: mockPrisma, basePrisma: mockPrisma }))
vi.mock('../lib/cache', () => ({ getCached: vi.fn(async (_k: string, f: () => unknown) => f()), invalidateTenantCache: vi.fn() }))

interface AuthedRequest { user: Record<string, unknown>; tenantId: string | null }
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: AuthedRequest) => {
    req.user = { userId: 'user-1', role: 'ADMIN', tenantId: 'tenant-1', activeTenantId: 'tenant-1' }
    req.tenantId = 'tenant-1'
  },
}))

import { analyticsRoutes } from '../routes/analytics'

async function build() {
  const app = Fastify()
  await app.register(analyticsRoutes)
  return app
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/audit-logs', () => {
  it('renvoie les entrées de la boutique en fonctionnement nominal', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1', action: 'DELETE_PRODUCT' }])
    mockPrisma.auditLog.count.mockResolvedValue(1)
    mockPrisma.auditLog.groupBy.mockResolvedValue([{ module: 'SETTINGS' }])
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/audit-logs' })

    expect(res.statusCode).toBe(200)
    expect(res.json().items).toHaveLength(1)
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    )
  })

  /**
   * ⚠️ LE COMPTE EST CELUI DE LA BASE, PAS CELUI DES LIGNES RENVOYÉES — c'est toute la
   * raison d'être de l'enveloppe. L'écran affichait `items.length` sous l'étiquette
   * « Total événements » : au-delà du plafond il aurait dit « 100 » pour toujours, et
   * le tenant de démonstration (dix événements) ne l'aurait jamais montré.
   */
  it('le TOTAL vient du `count`, pas de la longueur des lignes', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue(Array.from({ length: 100 }, (_, k) => ({ id: `a${k}` })))
    mockPrisma.auditLog.count.mockResolvedValue(1342)
    mockPrisma.auditLog.groupBy.mockResolvedValue([{ module: 'SETTINGS' }, { module: 'POS' }])
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/audit-logs' })

    const body = res.json()
    expect(body.items).toHaveLength(100)
    expect(body.total).toBe(1342)          // ≠ 100 : la troncature est DISABLE côté écran
    expect(body.limite).toBe(100)
    // Le compte porte sur la MÊME boutique que les lignes — sinon on annoncerait le
    // total d'un autre tenant, ce qu'aucune assertion de forme ne rattraperait.
    expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
  })

  /**
   * ⚠️ LES COMPTEURS SONT CALCULÉS EN BASE, pas sur les lignes renvoyées. L'écran les
   * dérivait des ≤100 entrées reçues : « Alertes sécurité » ratait toute alerte plus
   * ancienne que la 100ᵉ ligne. Un compteur d'alertes qui rate les alertes est PIRE
   * que pas de compteur — on s'y fie.
   * ⚠️ Le mock rend des comptes DIFFÉRENTS de la longueur des lignes : sinon le test
   * passerait aussi bien sur une dérivation, et ne distinguerait rien.
   */
  it('les compteurs viennent de la BASE, et portent sur la bonne boutique', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }])
    mockPrisma.auditLog.count
      .mockResolvedValueOnce(1342)   // total
      .mockResolvedValueOnce(7)      // aujourd'hui
      .mockResolvedValueOnce(3)      // alertes
    mockPrisma.auditLog.groupBy.mockResolvedValue([{ module: 'SETTINGS' }, { module: 'POS' }, { module: 'RH' }])
    const app = await build()
    const body = (await app.inject({ method: 'GET', url: '/api/audit-logs' })).json()

    expect(body.items).toHaveLength(1)
    expect(body.stats).toEqual({ aujourdhui: 7, alertes: 3, modules: 3 })
    for (const appel of mockPrisma.auditLog.count.mock.calls) {
      expect(appel[0].where.tenantId).toBe('tenant-1')
    }
    expect(mockPrisma.auditLog.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    )
  })

  // LE DÉFAUT CORRIGÉ : la route renvoyait [] sur erreur. Un journal d'audit qui
  // affiche « rien » AFFIRME qu'il ne s'est rien passé — le lecteur ne peut pas
  // distinguer « aucun événement » de « base injoignable ».
  it('REMONTE l’erreur au lieu de renvoyer une liste vide', async () => {
    mockPrisma.auditLog.findMany.mockRejectedValue(new Error('DB down'))
    mockPrisma.auditLog.count.mockResolvedValue(0)
    mockPrisma.auditLog.groupBy.mockResolvedValue([])
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/audit-logs' })

    expect(res.statusCode).toBe(500)
    expect(res.body).not.toBe('[]')
    expect(res.json()).not.toEqual([])
  })
})
