import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * GET /api/products/lookup — résolution CIBLÉE d'un code scanné (Chantier B).
 *
 * Sert le cas « le scan ne matche pas le cache local » : le POS demande au serveur
 * AVANT de conclure. Un produit, jamais la liste — la liste complète coûte ~1,1 s en 2G.
 */
const { db } = vi.hoisted(() => ({ db: { product: { findMany: vi.fn() } } }))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: { user?: unknown; tenantId?: string }) => {
    req.user = { role: 'CASHIER', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1'
  },
}))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/writeAudit', () => ({ writeAudit: vi.fn() }))

import { productRoutes } from '../routes/products'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler) // routes à schéma zod (cf. CLAUDE.md § Sécurité)
  await app.register(productRoutes)
  await app.ready()
  return app
}
const get = async (code: string) => (await buildApp()).inject({ method: 'GET', url: `/api/products/lookup?code=${encodeURIComponent(code)}` })

beforeEach(() => vi.clearAllMocks())

describe('résolution', () => {
  it('code-barres exact → le produit', async () => {
    db.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Riz', barcode: '4006381333931', sku: 'PRD-0001' }])
    const res = await get('4006381333931')
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).id).toBe('p1')
  })

  it('UPC-A scanné (12) → produit stocké en EAN-13 (13)', async () => {
    db.product.findMany.mockResolvedValue([{ id: 'p2', name: 'Lait', barcode: '0036000291452', sku: 'PRD-0002' }])
    const res = await get('036000291452')
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).id).toBe('p2')
  })

  it('SKU exact (étiquette CODE128) → le produit', async () => {
    db.product.findMany.mockResolvedValue([{ id: 'p3', name: 'Savon', barcode: '', sku: 'PRD-0009' }])
    expect((await get('PRD-0009')).statusCode).toBe(200)
  })

  it('la règle canonique TRANCHE — un candidat SQL non conforme est écarté', async () => {
    // Le SQL présélectionne large ; c'est matchesScannedCode qui décide. Ici le candidat
    // remonté ne correspond ni par code-barres ni par SKU exact → 404, pas un faux positif.
    db.product.findMany.mockResolvedValue([{ id: 'px', name: 'Autre', barcode: '9999999999999', sku: 'PRD-9999' }])
    expect((await get('4006381333931')).statusCode).toBe(404)
  })
})

describe('absence et bornes', () => {
  it('aucun produit → 404 NOT_IN_CATALOG (jamais « n’existe pas »)', async () => {
    db.product.findMany.mockResolvedValue([])
    const res = await get('4006381333931')
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body).code).toBe('NOT_IN_CATALOG')
    // Le message parle du CATALOGUE, pas de l'existence du produit dans le monde.
    expect(JSON.parse(res.body).error).toMatch(/catalogue/i)
  })

  it('code vide → 400', async () => {
    expect((await get('')).statusCode).toBe(400)
  })

  it('scopé au tenant et hors soft-deleted', async () => {
    db.product.findMany.mockResolvedValue([])
    await get('4006381333931')
    const where = db.product.findMany.mock.calls[0][0].where
    expect(where.tenantId).toBe('T1')
    expect(where.deletedAt).toBeNull()
  })

  it('ne rapatrie JAMAIS le catalogue entier (take borné)', async () => {
    db.product.findMany.mockResolvedValue([])
    await get('4006381333931')
    expect(db.product.findMany.mock.calls[0][0].take).toBeLessThanOrEqual(5)
  })
})
