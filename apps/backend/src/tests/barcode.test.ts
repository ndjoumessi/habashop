import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { ean13CheckDigit, isValidEAN13, normalizeBarcode } from '../lib/barcode'

// ── Helpers purs (miroir de generateEAN13 front) ─────────────────────────────
describe('barcode — helpers EAN-13', () => {
  it('ean13CheckDigit : clé GS1 correcte', () => {
    // Codes réels connus + un préfixe interne 200
    expect(ean13CheckDigit('400638133393')).toBe(1)   // 4006381333931
    expect(ean13CheckDigit('978020137962')).toBe(4)   // 9780201379624
    expect(ean13CheckDigit('200123456789')).toBe(ean13CheckDigit('200123456789'))
  })

  it('isValidEAN13 : accepte un EAN-13 valide, refuse clé fausse / mauvaise longueur / non-chiffres', () => {
    expect(isValidEAN13('4006381333931')).toBe(true)
    expect(isValidEAN13('9780201379624')).toBe(true)
    expect(isValidEAN13('4006381333930')).toBe(false)  // clé fausse
    expect(isValidEAN13('400638133393')).toBe(false)   // 12 chiffres
    expect(isValidEAN13('40063813339311')).toBe(false) // 14 chiffres
    expect(isValidEAN13('ABC6381333931')).toBe(false)  // non-chiffres
    expect(isValidEAN13('')).toBe(false)
  })

  it('generateEAN13 (algo front) produit toujours un EAN-13 valide', () => {
    // Reproduit l'algo frontend sans hasard : préfixe 200 + 9 chiffres arbitraires.
    const base = '200' + '123456789'
    const code = base + String(ean13CheckDigit(base))
    expect(isValidEAN13(code)).toBe(true)
  })

  it('normalizeBarcode : strip espaces, gère non-chaîne', () => {
    expect(normalizeBarcode(' 4006 3813 33931 ')).toBe('4006381333931')
    expect(normalizeBarcode('')).toBe('')
    expect(normalizeBarcode(null)).toBe('')
    expect(normalizeBarcode(undefined)).toBe('')
    expect(normalizeBarcode(12345)).toBe('')
  })
})

// ── Validation de route (POST/PUT /api/products) ─────────────────────────────
const { db } = vi.hoisted(() => ({
  db: {
    product: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    // ⚠️ Les routes de ce fichier écrivent désormais un audit (`writeAudit`) : sans ce
    // mock, `prisma.auditLog.create` est `undefined` et lève AVANT que le fail-open ne
    // puisse s'appliquer — l'argument de `writeAudit` est évalué à l'appel.
    auditLog: { create: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'ADMIN', tenantId: 'MINE', userId: 'u1' }; req.tenantId = 'MINE' },
}))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { productRoutes } from '../routes/products'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(productRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  db.product.count.mockResolvedValue(0)
  db.product.findFirst.mockResolvedValue(null)
  db.product.create.mockImplementation((args: any) => Promise.resolve({ id: 'p1', ...args.data }))
  db.product.update.mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data }))
})

describe('POST /api/products — validation barcode', () => {
  it('barcode vide/absent → OK, stocké ""', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/products', payload: { name: 'Riz' } })
    expect(res.statusCode).toBe(200)
    expect(db.product.create.mock.calls[0][0].data.barcode).toBe('')
    // pas de code-barres → pas de contrôle de doublon
    expect(db.product.findFirst).not.toHaveBeenCalled()
  })

  it('EAN-13 valide + libre → créé, barcode normalisé (espaces retirés)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/products', payload: { name: 'Lait', barcode: '4006 3813 33931' } })
    expect(res.statusCode).toBe(200)
    expect(db.product.create.mock.calls[0][0].data.barcode).toBe('4006381333931')
  })

  it('clé de contrôle fausse → 400 INVALID_BARCODE, pas de create', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/products', payload: { name: 'X', barcode: '4006381333930' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_BARCODE')
    expect(db.product.create).not.toHaveBeenCalled()
  })

  it('doublon dans le tenant → 409 DUPLICATE_BARCODE', async () => {
    db.product.findFirst.mockResolvedValue({ name: 'Lait déjà là' })
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/products', payload: { name: 'Lait bis', barcode: '4006381333931' } })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).code).toBe('DUPLICATE_BARCODE')
    // le contrôle de doublon est scopé au tenant + actifs
    expect(db.product.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: 'MINE', barcode: '4006381333931', deletedAt: null })
    expect(db.product.create).not.toHaveBeenCalled()
  })
})

/**
 * ⚠️ « AUCUN CONTRÔLE BARCODE » NE SE MESURE PLUS PAR « `findFirst` JAMAIS APPELÉ ».
 * Depuis le 2026-08-14, `PUT /api/products/:id` relit le produit pour construire le
 * diff d'audit — un `findFirst` légitime, qui n'a rien à voir avec l'unicité du
 * code-barres. Le test nommait « contrôle barcode » et mesurait « une lecture
 * quelconque » : le proxy a cessé d'être vrai avant la propriété qu'il désignait.
 * On juge donc la REQUÊTE, discriminante par construction — le contrôle d'unicité
 * cherche `where.barcode`, la relecture d'audit cherche `where.id` avec un `select`.
 */
const lecturesBarcode = () =>
  db.product.findFirst.mock.calls.filter(c => 'barcode' in ((c[0] as { where?: Record<string, unknown> } | undefined)?.where ?? {}))

describe('PUT /api/products/:id — validation barcode', () => {
  it('EAN-13 valide, unique (hors soi-même) → update, exclut son propre id', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { barcode: '4006381333931' } })
    expect(res.statusCode).toBe(200)
    expect(db.product.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: 'MINE', barcode: '4006381333931', deletedAt: null, id: { not: 'p1' } })
    expect(db.product.update.mock.calls[0][0].data.barcode).toBe('4006381333931')
  })

  it('barcode absent du body → aucun contrôle barcode', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { name: 'Renommé' } })
    expect(res.statusCode).toBe(200)
    expect(lecturesBarcode()).toEqual([])
  })

  it('clé fausse → 400, pas d’update', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { barcode: '1234567890123' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('INVALID_BARCODE')
    expect(db.product.update).not.toHaveBeenCalled()
  })

  it('doublon (autre produit) → 409', async () => {
    db.product.findFirst.mockResolvedValue({ name: 'Autre' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { barcode: '4006381333931' } })
    expect(res.statusCode).toBe(409)
    expect(db.product.update).not.toHaveBeenCalled()
  })

  it('barcode vidé ("") → autorisé, stocké ""', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { barcode: '' } })
    expect(res.statusCode).toBe(200)
    expect(db.product.update.mock.calls[0][0].data.barcode).toBe('')
    expect(lecturesBarcode()).toEqual([])
  })
})
