import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

/**
 * `GET /api/public/invoice/:token` — la page que le client ouvre en scannant le QR code.
 *
 * ⚠️ Les mocks APPLIQUENT le `where` reçu : un mock qui rendrait une liste figée resterait
 * VERT si le handler cessait d'exiger `invoiceNumber != null` ou `tenant.deletedAt = null`
 * (cf. § Tests du guide — « le mock qui ignore ses arguments »).
 */

type SaleWhere = {
  id?: string
  invoiceNumber?: { not: null } | string | null
  tenant?: { deletedAt?: null }
}
type Row = {
  id: string; invoiceNumber: string | null; deletedTenant: boolean
  total: number; discountAmount: number; paymentMode: string
  createdAt: Date; status: string; customerId: string | null
}

const PHONE_CLIENT = '+221 77 123 45 67'
const EMAIL_CLIENT = 'awa@exemple.test'

const SALES: Row[] = [
  { id: 'vente-emise',    invoiceNumber: 'FAC-2026-00001', deletedTenant: false, total: 5900, discountAmount: 0, paymentMode: 'cash', createdAt: new Date('2026-07-18T10:00:00Z'), status: 'completed', customerId: 'c1' },
  { id: 'vente-sans-num', invoiceNumber: null,             deletedTenant: false, total: 1000, discountAmount: 0, paymentMode: 'cash', createdAt: new Date('2026-07-18T10:00:00Z'), status: 'completed', customerId: 'c1' },
  { id: 'vente-boutique-fermee', invoiceNumber: 'FAC-2026-00009', deletedTenant: true, total: 1000, discountAmount: 0, paymentMode: 'cash', createdAt: new Date('2026-07-18T10:00:00Z'), status: 'completed', customerId: 'c1' },
  { id: 'vente-de-passage', invoiceNumber: 'FAC-2026-00010', deletedTenant: false, total: 2500, discountAmount: 0, paymentMode: 'cash', createdAt: new Date('2026-07-18T10:00:00Z'), status: 'completed', customerId: null },
]

const { db, saleFindFirst, customerFindUnique } = vi.hoisted(() => {
  const saleFindFirst = vi.fn()
  const customerFindUnique = vi.fn()
  return {
    saleFindFirst, customerFindUnique,
    db: {
      sale: { findFirst: saleFindFirst },
      customer: { findUnique: customerFindUnique },
      tenant: { findFirst: vi.fn() },
      product: { findMany: vi.fn() },
    },
  }
})
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))

import { publicRoutes } from '../routes/public'
import { invoiceToken } from '../lib/invoiceLink'

function build() {
  const app = Fastify()
  app.register(publicRoutes)
  return app
}

beforeEach(() => {
  process.env.JWT_SECRET = 'secret-de-session-pour-les-tests'
  delete process.env.INVOICE_LINK_SECRET
  vi.clearAllMocks()

  saleFindFirst.mockImplementation(async ({ where }: { where: SaleWhere }) => {
    const row = SALES.find(s => s.id === where.id)
    if (!row) return null
    // Le mock APPLIQUE les deux conditions du handler.
    if (where.invoiceNumber && row.invoiceNumber === null) return null
    if (where.tenant?.deletedAt === null && row.deletedTenant) return null
    return {
      invoiceNumber: row.invoiceNumber, total: row.total, discountAmount: row.discountAmount,
      paymentMode: row.paymentMode, createdAt: row.createdAt, status: row.status,
      customerId: row.customerId, cashAmount: row.total, mobileMoneyAmount: null, cardAmount: null,
      items: [{ qty: 2, unitPrice: 2950, total: 5900, product: { name: 'Bifaka' } }],
      tenant: {
        name: 'Ma Boutique', address: 'Dakar', phone: '+221 33 800 00 00', email: 'contact@boutique.test',
        currency: 'XOF', vatRate: 18, lang: 'fr', ninea: null, rccm: null, vatNumber: null,
      },
    }
  })
  // La fiche client PORTE un téléphone et un e-mail : la route doit les laisser en base.
  customerFindUnique.mockResolvedValue({ name: 'Awa Diop', phone: PHONE_CLIENT, email: EMAIL_CLIENT })
})

describe('GET /api/public/invoice/:token — accès', () => {
  it('jeton valide d’une facture émise → 200 avec la facture', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-emise')}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.invoiceNumber).toBe('FAC-2026-00001')
    expect(body.total).toBe(5900)
    expect(body.items).toEqual([{ name: 'Bifaka', qty: 2, unitPrice: 2950, total: 5900 }])
    expect(body.shop.name).toBe('Ma Boutique')
    expect(body.customerName).toBe('Awa Diop')
  })

  it('⚠️ la route SERT la décomposition HT/TVA — la page n’en calcule aucune', async () => {
    const app = build()
    const body = (await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-emise')}` })).json()
    expect(body.subtotalHT).toBeCloseTo(5000, 6)
    expect(body.vatAmount).toBeCloseTo(900, 6)
    expect(body.subtotalHT + body.vatAmount).toBeCloseTo(body.total, 9)
  })

  it('sceau falsifié → 404 (jamais 401 : aucune session à expirer ici)', async () => {
    const app = build()
    const res = await app.inject({ url: '/api/public/invoice/vente-emise~AAAAAAAAAAAAAAAA' })
    expect(res.statusCode).toBe(404)
  })

  it('identifiant nu, sans sceau → 404, et la base n’est même pas interrogée', async () => {
    const app = build()
    const res = await app.inject({ url: '/api/public/invoice/vente-emise' })
    expect(res.statusCode).toBe(404)
    expect(saleFindFirst).not.toHaveBeenCalled()
  })

  it('jeton bien signé d’une vente inexistante → 404', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-fantome')}` })
    expect(res.statusCode).toBe(404)
  })

  it('⚠️ vente sans numéro de facture → 404 : une page publique n’existe que pour une facture ÉMISE', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-sans-num')}` })
    expect(res.statusCode).toBe(404)
  })

  it('⚠️ boutique fermée (soft delete) → 404 : elle cesse de publier', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-boutique-fermee')}` })
    expect(res.statusCode).toBe(404)
  })

  it('aucun secret posé → 404, et aucune requête (fonctionnalité inerte, pas d’erreur 500)', async () => {
    delete process.env.JWT_SECRET
    const app = build()
    const res = await app.inject({ url: '/api/public/invoice/vente-emise~AAAAAAAAAAAAAAAA' })
    expect(res.statusCode).toBe(404)
    expect(saleFindFirst).not.toHaveBeenCalled()
  })
})

describe('GET /api/public/invoice/:token — ce que la page NE livre PAS', () => {
  /**
   * ⚠️ **Le verrou porte sur la CHARGE RENDUE, pas sur le `select` Prisma** — et c'est la
   * bonne maille : élargir le `select` au téléphone ne fuite rien tant que le handler ne
   * mappe que `customer.name` (sabotage exercé, resté vert à raison). Ce qui fuite, c'est
   * de renvoyer l'objet client — ou de l'étaler — et c'est ce cas-là qui rougit.
   */
  it('⚠️ aucun contact du CLIENT dans la réponse (le nom suffit à reconnaître sa facture)', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-emise')}` })
    expect(res.payload).not.toContain(PHONE_CLIENT)
    expect(res.payload).not.toContain(EMAIL_CLIENT)
    expect(res.payload).not.toContain('77 123 45 67')
  })

  it('aucun champ interne : caissier, clé d’idempotence, référence prestataire', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-emise')}` })
    for (const interdit of ['cashierId', 'idempotencyKey', 'mtnMomoReference', 'campayReference',
      'paydunyaReference', 'buyPrice', 'customerId', 'tenantId', 'priceDivergence']) {
      expect(res.payload).not.toContain(interdit)
    }
  })

  it('vente de passage : la route répond, et `customerName` est nul (pas de fiche à lire)', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-de-passage')}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().customerName).toBeNull()
    expect(customerFindUnique).not.toHaveBeenCalled()
  })

  it('une facture est personnelle → `Cache-Control: no-store`, jamais de cache CDN', async () => {
    const app = build()
    const res = await app.inject({ url: `/api/public/invoice/${invoiceToken('vente-emise')}` })
    expect(res.headers['cache-control']).toBe('no-store')
  })
})
