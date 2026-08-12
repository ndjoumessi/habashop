import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * PHOTO PRODUIT — le CÂBLAGE des routes d'envoi et de retrait.
 *
 * `productImageKey.test.ts` prouve les RÈGLES (type réel, forme de clé, chemin
 * retour) ; il ne peut RIEN dire de ce que les routes en demandent. C'est la
 * leçon du sabotage S3 de la zone franc : un invariant pur reste vert pendant que
 * le chemin qui devait l'appeler ne l'appelle plus.
 *
 * ⚠️ SEUL LE SDK EST SIMULÉ. `r2Client` — donc la garde de dépense, la lecture de
 * configuration et le fail-open de suppression — tourne POUR DE VRAI. Simuler
 * `r2Client` aurait rendu ce fichier incapable de voir qu'un envoi contourne
 * `authorizeSpend`, c'est-à-dire précisément ce qu'il existe pour garder.
 *
 * ⚠️ Le faux SDK ENREGISTRE ce qu'on lui demande (bucket, clé, type, en-tête de
 * cache). Un `mockResolvedValue({})` qui ignore ses arguments resterait vert même
 * si la route écrivait dans le mauvais bucket ou sous la clé d'un autre tenant.
 */

// ── Le SDK, remplacé — et il note tout ───────────────────────────────────────
const { envois, suppressions, echouer } = vi.hoisted(() => ({
  envois: [] as Record<string, unknown>[],
  suppressions: [] as Record<string, unknown>[],
  echouer: { put: false },
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    async send(cmd: { __type: string; input: Record<string, unknown> }) {
      if (cmd.__type === 'put') {
        if (echouer.put) throw new Error('R2 indisponible')
        envois.push(cmd.input)
      } else {
        suppressions.push(cmd.input)
      }
      return {}
    }
  },
  PutObjectCommand: class { __type = 'put'; constructor(public input: Record<string, unknown>) {} },
  DeleteObjectCommand: class { __type = 'del'; constructor(public input: Record<string, unknown>) {} },
}))

const { db } = vi.hoisted(() => ({
  db: {
    product: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    tenant: { findUnique: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/tenantId', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getTenantId: () => 'T1',
}))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
  },
}))

// ⚠️ La garde de dépense est exercée pour de vrai, mais sans Redis : on la laisse
// décider, on ne la remplace pas. `blockDemoTenant` lit le tenant en base.
const { demoSpy } = vi.hoisted(() => ({ demoSpy: { estDemo: false } }))
vi.mock('../middleware/demoTenant', () => ({
  blockDemoTenant: async (_req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    if (demoSpy.estDemo) return reply.code(403).send({ error: 'Démo', code: 'DEMO_TENANT_FORBIDDEN' })
  },
}))

import { productRoutes } from '../routes/products'
import { productImageKey, publicUrlFor } from '../lib/productImageKey'
import { putProductImage, estBasePubliqueValide, isR2Configured } from '../lib/spend/r2Client'

const BASE = 'https://img.habashop.test'
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(256, 3)])

function configurer(on: boolean) {
  const v = on ? 'x' : ''
  process.env.R2_ACCOUNT_ID = v
  process.env.R2_ACCESS_KEY_ID = v
  process.env.R2_SECRET_ACCESS_KEY = v
  process.env.R2_BUCKET = on ? 'habashop-images' : ''
  process.env.R2_PUBLIC_BASE_URL = on ? BASE : ''
}

async function monter() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
  await app.register(productRoutes)
  return app
}

/** Corps multipart minimal — construit à la main, aucune dépendance de test ajoutée. */
function corpsMultipart(buf: Buffer, nom = 'photo.jpg', mimeDeclare = 'image/jpeg') {
  const b = '----habashoptest'
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${b}` },
    payload: Buffer.concat([
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image"; filename="${nom}"\r\nContent-Type: ${mimeDeclare}\r\n\r\n`),
      buf,
      Buffer.from(`\r\n--${b}--\r\n`),
    ]),
  }
}

const APRES = { ...process.env }
beforeEach(() => {
  envois.length = 0
  suppressions.length = 0
  echouer.put = false
  demoSpy.estDemo = false
  vi.clearAllMocks()
  db.auditLog.create.mockResolvedValue({})
  // ⚠️ La garde de dépense lit RÉELLEMENT le tenant (isDemo/status/trialEnds).
  // Sans cette ligne elle refuse tout en 403 — et c'est un bon signe : elle est
  // bien sur le chemin, elle n'est pas décorative.
  db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'active', trialEnds: null })
  db.product.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'p1', ...data }))
  configurer(true)
})
afterEach(() => { process.env = { ...APRES } })

describe('POST /api/products/:id/image', () => {
  it('envoi nominal — objet écrit, colonne mise à jour, URL rendue', async () => {
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: null })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(200)
    const attendue = publicUrlFor(productImageKey('T1', 'p1', JPEG, 'jpg'), BASE)
    expect(r.json().image).toBe(attendue)

    // ⚠️ On vérifie CE QUI A ÉTÉ DEMANDÉ au SDK, pas seulement qu'il a été appelé.
    expect(envois).toHaveLength(1)
    expect(envois[0].Bucket).toBe('habashop-images')
    expect(envois[0].Key).toBe(productImageKey('T1', 'p1', JPEG, 'jpg'))
    expect(envois[0].ContentType).toBe('image/jpeg')
    // L'en-tête immuable n'est sûre QUE parce que la clé porte l'empreinte.
    expect(String(envois[0].CacheControl)).toContain('immutable')

    expect(db.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', tenantId: 'T1' }, data: { image: attendue } }),
    )
  })

  it('⚠️ un fichier NON-IMAGE est refusé en 415 — et le SDK n’est JAMAIS appelé', async () => {
    // Le `Content-Type` déclaré ment : on annonce du JPEG, on envoie du HTML.
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: null })
    const app = await monter()
    const html = Buffer.from('<!doctype html><script>alert(1)</script>')
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(html, 'x.jpg', 'image/jpeg') })

    expect(r.statusCode).toBe(415)
    expect(r.json().code).toBe('UNSUPPORTED_IMAGE')
    expect(envois, 'rien ne doit avoir été écrit').toHaveLength(0)
  })

  it('⚠️ stockage NON configuré → 503 nommé, aucune écriture, aucun 500', async () => {
    configurer(false)
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: null })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(503)
    expect(r.json().code).toBe('STORAGE_NOT_CONFIGURED')
    expect(envois).toHaveLength(0)
  })

  it('⚠️ tenant de DÉMONSTRATION → 403 AVANT toute lecture de fichier', async () => {
    // Le mot de passe démo est PUBLIC et le stockage se paie au Go·MOIS.
    demoSpy.estDemo = true
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: null })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(403)
    expect(envois).toHaveLength(0)
    expect(db.product.findFirst, 'refusé avant même de chercher le produit').not.toHaveBeenCalled()
  })

  it('⚠️ boutique SUSPENDUE → la garde de DÉPENSE refuse, rien n’est écrit', async () => {
    /**
     * LE CAS QUI PROUVE QUE `authorizeSpend` EST SUR LE CHEMIN. Sans lui, tout le
     * reste du fichier resterait vert avec un `putProductImage` qui écrit
     * directement — le stockage est le seul poste dont le coût est RÉCURRENT, une
     * boutique qui ne paie plus ne doit pas continuer d'accumuler des Go.
     *
     * ⚠️ Le refus vient de la garde RÉELLE (`r2Client` n'est pas simulé), pas d'un
     * mock qui dirait oui : c'est le statut en base qui décide.
     */
    db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'suspended', trialEnds: null })
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: null })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).not.toBe(200)
    expect(envois, 'aucun octet ne doit partir vers R2').toHaveLength(0)
    expect(db.product.update, 'aucune URL ne doit être enregistrée').not.toHaveBeenCalled()
  })

  it('⚠️ produit d’une AUTRE boutique → 404 uniforme, pas 403 (aucun oracle)', async () => {
    // `findFirst({ id, tenantId })` ne trouve rien : indiscernable d'un id inexistant.
    db.product.findFirst.mockResolvedValue(null)
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/pX/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(404)
    expect(envois).toHaveLength(0)
  })

  it('un échec R2 rend 502 et NE touche PAS la colonne', async () => {
    echouer.put = true
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: null })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(502)
    expect(db.product.update, 'aucune URL ne doit être enregistrée sans objet').not.toHaveBeenCalled()
  })

  it('⚠️ remplacement — l’ANCIEN objet est supprimé, le NOUVEAU écrit', async () => {
    const ancienne = productImageKey('T1', 'p1', Buffer.from('ancienne'.repeat(9)), 'png')
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: publicUrlFor(ancienne, BASE) })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(200)
    expect(envois).toHaveLength(1)
    expect(suppressions, 'l’ancien objet doit être retiré').toHaveLength(1)
    expect(suppressions[0].Key).toBe(ancienne)
  })

  it('⚠️ une ancienne URL ÉTRANGÈRE n’est PAS supprimée', async () => {
    /**
     * `Product.image` est une colonne texte libre. Une valeur héritée, importée ou
     * forgée ne doit JAMAIS déclencher une suppression : on remplace la référence
     * sans toucher à un objet qu'on n'a pas écrit.
     */
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: 'https://ailleurs.test/photo-de-quelqu-un.jpg' })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(200)
    expect(envois, 'la nouvelle photo est bien écrite').toHaveLength(1)
    expect(suppressions, 'rien d’étranger ne doit être supprimé').toHaveLength(0)
  })

  it('⚠️ une ancienne clé d’un AUTRE tenant n’est PAS supprimée', async () => {
    // Bonne base, bonne forme… mais le préfixe désigne une autre boutique.
    const cleAutrui = productImageKey('T2', 'p1', Buffer.from('autrui'.repeat(9)), 'jpg')
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: publicUrlFor(cleAutrui, BASE) })
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/products/p1/image', ...corpsMultipart(JPEG) })

    expect(r.statusCode).toBe(200)
    expect(suppressions, 'le préfixe de tenant est la dernière barrière').toHaveLength(0)
  })
})

describe('⚠️ putProductImage — la garde au POINT DE DÉPENSE, isolée de la route', () => {
  /**
   * CE BLOC EXISTE PARCE QU'UN SABOTAGE EST PASSÉ VERT (2026-08-12).
   *
   * Retirer `authorizeSpend` de `r2Client` ne faisait rougir AUCUN test : le cas
   * « boutique suspendue » de la route était déjà satisfait par le refus de
   * `costQuota` en preHandler, EN AMONT. Le test prouvait donc la route, pas le
   * point de dépense — exactement la JUSTESSE EMPRUNTÉE que `spendGuardStatusOrder`
   * documente ailleurs : une propriété qui n'est vraie que grâce à un invariant
   * distant, et que rien n'enregistre.
   *
   * ⚠️ CE N'EST PAS THÉORIQUE. `costQuota` est un preHandler HTTP : il n'existe pas
   * pour ce qui dépense HORS d'une requête — un import en masse, un cron, une
   * synchronisation mobile. C'est la raison d'être de la règle « la garde vit au
   * POINT DE DÉPENSE, jamais sur la route ». On appelle donc le client DIRECTEMENT,
   * sans passer par Fastify.
   */
  it('refuse une boutique SUSPENDUE sans qu’aucun preHandler n’intervienne', async () => {
    db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'suspended', trialEnds: null })
    const r = await putProductImage({ tenantId: 'T1', key: 'tenants/T1/products/p1/' + 'a'.repeat(32) + '.jpg', body: JPEG, contentType: 'image/jpeg' })

    expect(r.ok, 'la garde doit refuser').toBe(false)
    expect(envois, 'aucun octet ne doit partir vers R2').toHaveLength(0)
  })

  it('refuse un tenant de DÉMONSTRATION appelé hors requête HTTP', async () => {
    db.tenant.findUnique.mockResolvedValue({ isDemo: true, status: 'active', trialEnds: null })
    const r = await putProductImage({ tenantId: 'T1', key: 'tenants/T1/products/p1/' + 'b'.repeat(32) + '.jpg', body: JPEG, contentType: 'image/jpeg' })

    expect(r.ok).toBe(false)
    expect(envois).toHaveLength(0)
  })

  it('témoin POSITIF — une boutique active écrit bien', async () => {
    // Sans ce sens, une garde qui refuse TOUT passerait les deux cas ci-dessus.
    db.tenant.findUnique.mockResolvedValue({ isDemo: false, status: 'active', trialEnds: null })
    const r = await putProductImage({ tenantId: 'T1', key: 'tenants/T1/products/p1/' + 'c'.repeat(32) + '.jpg', body: JPEG, contentType: 'image/jpeg' })

    expect(r.ok).toBe(true)
    expect(envois).toHaveLength(1)
  })
})

describe('⚠️ R2_PUBLIC_BASE_URL — le piège du schéma manquant', () => {
  /**
   * Le moment où ce garde sert est le CHANGEMENT DE DOMAINE : c'est là qu'on
   * retape la valeur, et c'est là qu'on oublie le `https://`. Sans lui, une base
   * non parsable passait pour « configurée » et cassait deux choses en silence —
   * des URL relatives en base, et plus aucune suppression de l'ancien objet.
   */
  it('accepte une base https, avec ou sans barre finale', () => {
    expect(estBasePubliqueValide('https://img.exemple.com')).toBe(true)
    expect(estBasePubliqueValide('https://img.exemple.com/')).toBe(true)
    expect(estBasePubliqueValide('https://pub-abc.r2.dev')).toBe(true)
  })

  it('⚠️ refuse tout ce qui ne peut pas former une URL absolue', () => {
    for (const mauvaise of ['img.exemple.com', 'pub-abc.r2.dev', '', '   ', 'pas une url', '//img.exemple.com']) {
      expect(estBasePubliqueValide(mauvaise)).toBe(false)
    }
  })

  it('⚠️ refuse http — le contenu mixte serait bloqué par le navigateur', () => {
    // Une photo en clair servie dans une page HTTPS ne s'affiche pas, sans erreur
    // visible côté serveur : encore un échec silencieux.
    expect(estBasePubliqueValide('http://img.exemple.com')).toBe(false)
  })

  it('⚠️ une base sans schéma rend le stockage INERTE, pas à moitié fonctionnel', () => {
    // Contrôle de bout en bout : c'est `isR2Configured` qui décide, donc la route
    // répondra 503 au lieu d'écrire des URL relatives en base.
    configurer(true)
    expect(isR2Configured()).toBe(true)          // témoin positif
    process.env.R2_PUBLIC_BASE_URL = 'img.habashop.test'
    expect(isR2Configured()).toBe(false)
  })
})

describe('DELETE /api/products/:id/image', () => {
  it('retire la colonne ET l’objet', async () => {
    const cle = productImageKey('T1', 'p1', Buffer.from('photo'.repeat(9)), 'jpg')
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: publicUrlFor(cle, BASE) })
    const app = await monter()
    const r = await app.inject({ method: 'DELETE', url: '/api/products/p1/image' })

    expect(r.statusCode).toBe(200)
    expect(r.json().image).toBeNull()
    expect(db.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', tenantId: 'T1' }, data: { image: null } }),
    )
    expect(suppressions[0].Key).toBe(cle)
  })

  it('⚠️ une URL étrangère : la colonne est EFFACÉE, l’objet PAS supprimé', async () => {
    // Refuser laisserait le commerçant avec une photo qu'il ne peut pas enlever.
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: 'https://ailleurs.test/x.jpg' })
    const app = await monter()
    const r = await app.inject({ method: 'DELETE', url: '/api/products/p1/image' })

    expect(r.statusCode).toBe(200)
    expect(db.product.update).toHaveBeenCalled()
    expect(suppressions).toHaveLength(0)
  })

  it('produit sans photo : rien à faire, aucune suppression', async () => {
    db.product.findFirst.mockResolvedValue({ id: 'p1', image: null })
    const app = await monter()
    const r = await app.inject({ method: 'DELETE', url: '/api/products/p1/image' })

    expect(r.statusCode).toBe(200)
    expect(db.product.update).not.toHaveBeenCalled()
    expect(suppressions).toHaveLength(0)
  })

  it('produit d’une autre boutique → 404', async () => {
    db.product.findFirst.mockResolvedValue(null)
    const app = await monter()
    const r = await app.inject({ method: 'DELETE', url: '/api/products/pX/image' })
    expect(r.statusCode).toBe(404)
  })
})
