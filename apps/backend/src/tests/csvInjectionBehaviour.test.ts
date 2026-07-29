import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'

/**
 * ⚠️ INJECTION CSV — preuve COMPORTEMENTALE sur la route d'export (#173).
 *
 * `csvInjection.test.ts` est un méta-test : il vérifie que chaque producteur de CSV
 * MENTIONNE `sanitizeCsv`. Ça ne suffit pas — mesuré : en retirant l'appel du helper frontend
 * tout en gardant l'import, la suite restait VERTE. Le méta-test prouve la SOURCE, pas
 * l'APPLICATION ; il faut donc exercer le CSV réellement produit.
 *
 * Ici on injecte `GET /api/export/suppliers` avec un fournisseur dont le nom est une formule,
 * et on regarde les octets rendus.
 */

const { mocks } = vi.hoisted(() => ({
  mocks: { supplierFindMany: vi.fn() },
}))

vi.mock('../db', () => ({ prisma: {
  supplier: { findMany: mocks.supplierFindMany },
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

const ATTAQUE = "=cmd|'/c calc'!A1"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.supplierFindMany.mockResolvedValue([
    {
      id: 's1', tenantId: 't1', name: ATTAQUE,
      categories: '+41766778899', phone: '@SUM(A1:A9)', email: 'a@b.c',
      rating: 4, leadTime: 3, notes: null, status: 'Actif',
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    },
  ])
})

describe('GET /api/export/:resource — le CSV rendu est neutralisé', () => {
  it('un nom de fournisseur en FORMULE sort préfixé d’une apostrophe', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/suppliers' })
    expect(res.statusCode).toBe(200)

    // La cellule contient `;` ? non — mais elle contient `'` en tête : c'est ce qui compte.
    expect(res.body).toContain(`'${ATTAQUE}`)
    // …et la formule ne doit JAMAIS apparaître en début de cellule, non préfixée.
    expect(res.body).not.toMatch(/(^|;|\n)=cmd/)
  })

  it('les autres déclencheurs sont neutralisés eux aussi', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/suppliers' })
    expect(res.body).toContain("'+41766778899")   // `categories`
    expect(res.body).toContain("'@SUM(A1:A9)")    // `phone`
  })

  it('une valeur ORDINAIRE traverse intacte — le garde n’abîme pas les données', async () => {
    mocks.supplierFindMany.mockResolvedValue([
      {
        id: 's2', tenantId: 't1', name: 'Grossiste Dakar',
        categories: 'Riz, Huile', phone: '+221771234567', email: 'g@d.sn',
        rating: 5, leadTime: 2, notes: null, status: 'Actif',
        createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      },
    ])
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/suppliers' })
    expect(res.body).toContain('Grossiste Dakar')
    expect(res.body).not.toContain("'Grossiste")
    // ⚠️ `+221771234567` commence par `+` : il EST préfixé, et c'est voulu — un numéro
    // international déclenche l'interprétation en formule comme n'importe quelle autre valeur.
    expect(res.body).toContain("'+221771234567")
  })

  it('l’en-tête n’est pas altéré (ce sont nos libellés, pas des données utilisateur)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/suppliers' })
    expect(res.body.split('\n')[0]).toContain('Nom;Catégorie;Téléphone')
  })
})
