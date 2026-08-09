import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'

/**
 * UN DOCUMENT QUI SORT DU PRODUIT NE SE TRONQUE PAS EN SILENCE.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `GET /api/export/sales` plafonnait à 1 000 lignes sans un mot, et le rapport
 * mensuel détaillait 30 ventes sous le titre « Détail des ventes ». Les deux
 * partent chez un comptable, se recopient, et rien dans le fichier ne disait
 * qu'il était incomplet.
 *
 * ⚠️ CE N'EST PAS la famille « le total est la somme de ce qu'on montre » — le
 * balayage du 2026-08-07 a établi qu'`analytics.ts` en était le seul site, et
 * aucun total ne dérive de ces lignes. C'en est une autre, et elle est PIRE sur
 * un point : un graphique tronqué se regarde une fois, un CSV se recopie.
 *
 * ⚠️ LE MOCK APPLIQUE `take`. Un `mockResolvedValue([…])` rendrait la même liste
 * quel que soit l'argument reçu — le test resterait VERT si le code cessait de
 * plafonner, ou s'il cessait de compter. C'est le défaut du « mock qui ignore ses
 * arguments », en version silencieuse.
 */

const { mocks } = vi.hoisted(() => ({
  mocks: {
    saleFindMany: vi.fn(),
    saleCount: vi.fn(),
    tenantFindUnique: vi.fn(),
  },
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

import { exportRoutes, PLAFOND_EXPORT_VENTES, DETAIL_VENTES_RAPPORT } from '../routes/export'

async function buildApp() {
  const app = Fastify()
  await app.register(jwt, { secret: 'test-secret' })
  await app.register(rateLimit, { global: false })
  await app.register(exportRoutes)
  await app.ready()
  return app
}

/** ⚠️ Chaque vente porte `_count`, JAMAIS `items` : un retour à `v.items.length` lèverait. */
function ventes(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `vente-${String(i).padStart(7, '0')}`,
    tenantId: 't1',
    createdAt: new Date(2026, 7, 1, 0, 0, Math.min(i, 59)),
    total: 1000 + i,
    paymentMode: 'cash',
    _count: { items: 3 },
  }))
}

type ArgsPrisma = { take?: number; orderBy?: unknown; include?: Record<string, unknown> }
let dernierArgs: ArgsPrisma | null = null

function brancher(base: ReturnType<typeof ventes>) {
  mocks.saleCount.mockResolvedValue(base.length)
  mocks.saleFindMany.mockImplementation(async (args: ArgsPrisma) => {
    dernierArgs = args
    return typeof args?.take === 'number' ? base.slice(0, args.take) : base
  })
  mocks.tenantFindUnique.mockResolvedValue({ id: 't1', name: 'Boutique Test' })
}

const nomFichier = (h: Record<string, unknown>) => String(h['content-disposition'] ?? '')

beforeEach(() => {
  vi.clearAllMocks()
  dernierArgs = null
})

describe('export CSV des ventes — la troncature s’annonce', () => {
  it('sous le plafond : le nom de fichier N’annonce RIEN', async () => {
    brancher(ventes(5))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/sales' })

    expect(res.statusCode).toBe(200)
    expect(nomFichier(res.headers)).toMatch(/filename="ventes-\d{4}-\d{2}-\d{2}\.csv"/)
    expect(
      nomFichier(res.headers),
      'un export complet qui s’annonce tronqué inquiète pour rien — et une mention qui '
      + 'apparaît toujours cesse d’être lue le jour où elle est vraie',
    ).not.toContain('-sur-')
  })

  it('⚠️ au-dessus du plafond : le nom PORTE les deux nombres', async () => {
    const total = PLAFOND_EXPORT_VENTES + 5
    brancher(ventes(total))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/sales' })

    expect(res.statusCode).toBe(200)
    expect(
      nomFichier(res.headers),
      'le CSV est tronqué et ne le dit pas : c’est le défaut d’origine',
    ).toContain(`-${PLAFOND_EXPORT_VENTES}-sur-${total}.csv`)
  })

  /**
   * ⚠️ LA MENTION SE LIT DANS LE NOM, JAMAIS DANS UNE LIGNE DU CSV. Une ligne
   * « … 10 000 sur 42 130 » ajoutée au corps est une LIGNE DE DONNÉES pour le
   * tableur : elle se trie avec les autres, entre dans une somme, se recopie. Le
   * nom de fichier se lit avant l'ouverture et survit à l'envoi par e-mail.
   * C'est le cas ci-dessous qui fige ce choix — pas un titre.
   */
  it('le corps ne contient AUCUNE ligne d’annonce', async () => {
    const total = PLAFOND_EXPORT_VENTES + 5
    brancher(ventes(total))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/sales' })

    const lignes = res.body.split('\n')
    expect(res.body, 'une annonce dans le corps deviendrait une ligne de données').not.toContain('sur-')
    expect(res.body).not.toMatch(/sur \d+ au total/)
    // ⚠️ COUVERTURE : 1 en-tête + exactement le plafond de lignes. Prouve que le mock a
    // bien appliqué `take` ET que la route a rendu ce qu'elle a reçu — sans quoi tout
    // ce qui précède jugerait une liste que personne n'a tronquée.
    expect(lignes.length).toBe(PLAFOND_EXPORT_VENTES + 1)
  })

  it('⚠️ le nombre d’articles vient de `_count`, pas d’une collection chargée', async () => {
    brancher(ventes(3))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/sales' })

    // `include: { items: true }` chargeait TOUS les articles pour lire `.length`. Les
    // ventes du mock ne portent PAS `items` : un retour en arrière lèverait ici.
    expect(dernierArgs?.include).toHaveProperty('_count')
    expect(dernierArgs?.take).toBe(PLAFOND_EXPORT_VENTES)
    const premiere = res.body.split('\n')[1].split(';')
    expect(premiere[2], 'colonne Articles').toBe('3')
  })
})

describe('rapport mensuel — le détail dit ce qu’il montre', () => {
  it('⚠️ plus de 30 ventes : la mention porte LES DEUX nombres', async () => {
    const total = DETAIL_VENTES_RAPPORT + 12
    brancher(ventes(total))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/pdf/monthly' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(`Les ${DETAIL_VENTES_RAPPORT} ventes les plus récentes`)
    expect(
      res.body,
      'sans le total, le lecteur ne sait pas s’il regarde tout ou une part',
    ).toContain(`sur ${total} au total`)
  })

  it('30 ventes ou moins : AUCUNE mention', async () => {
    brancher(ventes(DETAIL_VENTES_RAPPORT))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/export/pdf/monthly' })

    expect(res.body).not.toContain('les plus récentes')
    expect(res.body, 'le KPI compte toujours le jeu complet').toContain(`>${DETAIL_VENTES_RAPPORT}<`)
  })

  it('⚠️ le TRI est demandé — « les plus récentes » doit être VRAI', async () => {
    /**
     * Sans `orderBy`, Postgres ne garantit aucun ordre : `slice(0,30)` prenait 30
     * ventes arbitraires. La légende était fausse avant même d'être écrite — poser
     * la mention sans le tri aurait remplacé un silence par une affirmation fausse.
     */
    brancher(ventes(DETAIL_VENTES_RAPPORT + 1))
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/api/export/pdf/monthly' })

    expect(dernierArgs?.orderBy).toEqual({ createdAt: 'desc' })
  })
})
