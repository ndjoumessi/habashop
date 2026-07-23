import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

/**
 * COMPORTEMENT de `GET /api/audit-logs` — complément indispensable au méta-test
 * `auditWriteConvention.test.ts`, qui ne fait que grep le source (il passerait au
 * rouge sur un reformatage et resterait vert si le bloc devenait inatteignable).
 * Ici on exerce la route et on assert sur la RÉPONSE.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { auditLog: { findMany: vi.fn() } },
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
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/audit-logs' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    )
  })

  // LE DÉFAUT CORRIGÉ : la route renvoyait [] sur erreur. Un journal d'audit qui
  // affiche « rien » AFFIRME qu'il ne s'est rien passé — le lecteur ne peut pas
  // distinguer « aucun événement » de « base injoignable ».
  it('REMONTE l’erreur au lieu de renvoyer une liste vide', async () => {
    mockPrisma.auditLog.findMany.mockRejectedValue(new Error('DB down'))
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/audit-logs' })

    expect(res.statusCode).toBe(500)
    expect(res.body).not.toBe('[]')
    expect(res.json()).not.toEqual([])
  })
})
