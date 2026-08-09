import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'

/**
 * RAPPORT MENSUEL — preuve COMPORTEMENTALE de l'échappement.
 *
 * ─── POURQUOI CE FICHIER, EN PLUS DU MÉTA-TEST ───────────────────────────────
 * `htmlEscapeConvention.test.ts` (front) prouve qu'aucun fichier ne RÉÉCRIT la
 * règle. Ça ne dit rien de qui l'APPELLE — et c'est précisément ce qui manquait :
 * `routes/export.ts` n'échappait RIEN tout en étant, lui, parfaitement conforme au
 * méta-test, puisqu'il ne réécrivait aucune règle. Un fichier qui n'échappe pas ne
 * ressemble à rien ; il est simplement absent de tous les scans.
 *
 * Même leçon que #173 : le méta-test `csvInjection` prouvait la SOURCE, il a fallu
 * `csvInjectionBehaviour` pour capturer les octets réellement écrits.
 *
 * Ici on injecte un nom de boutique hostile et on regarde le HTML rendu.
 */

const { mocks } = vi.hoisted(() => ({
  mocks: { saleFindMany: vi.fn(), saleCount: vi.fn(), tenantFindUnique: vi.fn() },
}))

vi.mock('../db', () => ({ prisma: {
  sale: { findMany: mocks.saleFindMany, count: mocks.saleCount },
  tenant: { findUnique: mocks.tenantFindUnique },
} }))
vi.mock('../redis', () => ({ redis: null }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (request: { user?: unknown; tenantId?: string }) => {
    request.user = { userId: 'u1', tenantId: 't1', role: 'ADMIN' }
    request.tenantId = 't1'
  },
}))

import { exportRoutes } from '../routes/export'

async function buildApp() {
  const app = Fastify()
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(rateLimit, { global: false })
  await app.register(exportRoutes)
  await app.ready()
  return app
}

const NOM_HOSTILE = '<script>alert(1)</script>'
/** ⚠️ Guillemets SIMPLES : c'est le caractère que la copie divergente ne couvrait pas. */
const MODE_HOSTILE = "cash' onload='alert(2)"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenantFindUnique.mockResolvedValue({ id: 't1', name: NOM_HOSTILE })
  mocks.saleCount.mockResolvedValue(1)
  mocks.saleFindMany.mockResolvedValue([{
    id: 'vente-0000001', tenantId: 't1',
    createdAt: new Date(2026, 7, 3), total: 1900,
    paymentMode: MODE_HOSTILE, _count: { items: 2 },
  }])
})

describe('GET /api/export/pdf/monthly — le HTML rendu est échappé', () => {
  it('⚠️ le nom de boutique hostile ne ressort PAS en balise exécutable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/pdf/monthly' })

    expect(res.statusCode).toBe(200)
    expect(res.body, 'la balise script est passée telle quelle').not.toContain('<script>alert(1)')
    expect(res.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('⚠️ le mode de paiement — guillemet SIMPLE compris', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/pdf/monthly' })

    // C'est l'apostrophe qui manquait à la copie divergente de `CustomerMap.tsx`.
    expect(res.body).not.toContain("onload='alert(2)")
    expect(res.body).toContain('&#39;')
  })

  it('⚠️ CONTRÔLE POSITIF — le document est bien produit et non vide', async () => {
    /**
     * Sans lui, une route qui rendrait une chaîne vide ferait passer les deux cas
     * ci-dessus au vert en ne prouvant rien : « ne contient pas <script> » est vrai
     * du vide. Vérité vacante, sur un test.
     */
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/pdf/monthly' })

    expect(res.body.length).toBeGreaterThan(500)
    expect(res.body).toContain('Détail des ventes')
    expect(res.body).toContain('<!DOCTYPE html>')
    expect(String(res.headers['content-type'])).toContain('text/html')
  })

  it('un nom de boutique ordinaire traverse INTACT', async () => {
    // Un échappement qui abîmerait le texte normal serait un autre défaut : le
    // commerçant lirait son propre nom encodé dans son rapport.
    mocks.tenantFindUnique.mockResolvedValue({ id: 't1', name: 'Alimentation Koné' })
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/pdf/monthly' })

    expect(res.body).toContain('Alimentation Koné')
    expect(res.body).not.toContain('Alimentation Kon&')
  })
})
