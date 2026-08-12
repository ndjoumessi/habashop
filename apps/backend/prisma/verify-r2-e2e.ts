/**
 * PREUVE DE BOUT EN BOUT DU STOCKAGE PHOTO — forme (c) : TENANT JETABLE.
 *
 * ─── POURQUOI CE SCRIPT EXISTE ───────────────────────────────────────────────
 * `/api/health-extended` annonce `storage: configured` dès que les cinq variables
 * sont NON VIDES. C'est une CONFIGURATION DÉCLARÉE, pas une mesure : un secret
 * erroné, un bucket mal nommé ou une URL publique sans schéma affichent la même
 * chose. Et les 25 tests du dépôt simulent tous le SDK — aucun octet n'a jamais
 * traversé la chaîne réelle.
 *
 * Ce script la traverse : multipart → route déployée → garde de dépense → R2 →
 * URL publique → retrait. Il n'y a pas d'autre façon de le savoir.
 *
 * ─── CE QU'IL NE FAIT PAS ────────────────────────────────────────────────────
 * ⚠️ Il ne touche AUCUN tenant existant. Il crée le sien, l'exerce, le détruit, et
 * VÉRIFIE l'état final — jamais un `PATCH` exploratoire sur une boutique réelle.
 * ⚠️ Le nettoyage est en `finally` : un échec au milieu ne laisse pas de tenant
 * ni d'objet derrière lui. Un ménage « best-effort » a déjà échoué une journée
 * entière sans que rien ne le dise.
 * ⚠️ Aucun e-mail, aucun SMS, aucun appel facturé autre que l'écriture R2 elle-même
 * — quelques centaines d'octets, supprimés dans la foulée.
 *
 * ─── À RELANCER ──────────────────────────────────────────────────────────────
 * Après TOUT changement de `R2_PUBLIC_BASE_URL` (bascule vers un domaine propre) :
 * c'est la seule chose qui prouve que le nouveau domaine sert réellement les objets.
 *
 *   CONFIRM=1 railway run npx tsx prisma/verify-r2-e2e.ts
 */
import { PrismaClient } from '@prisma/client'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createHmac } from 'node:crypto'

const API = process.env.VERIFY_API ?? 'https://habashop-production.up.railway.app'
const ID = 'verif-r2-tmp'

/** JPEG 1×1 valide — signature FF D8 FF, ce que le serveur renifle réellement. */
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8Aqn//2Q==',
  'base64',
)

/** HS256 à la main — `jsonwebtoken` n'est pas une dépendance, et n'a pas à le devenir. */
function signerJwt(charge: Record<string, unknown>, secret: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const tete = b64({ alg: 'HS256', typ: 'JWT' })
  const corps = b64({ ...charge, iat: Math.floor(Date.now() / 1000) })
  const sig = createHmac('sha256', secret).update(`${tete}.${corps}`).digest('base64url')
  return `${tete}.${corps}.${sig}`
}

/**
 * ⚠️ DEUX SOURCES D'ENVIRONNEMENT, ET ELLES NE SE RECOUVRENT PAS.
 * `railway run` injecte les variables de PRODUCTION — dont un `DATABASE_URL` qui
 * pointe sur `postgres.railway.internal`, l'hôte du réseau PRIVÉ Railway :
 * injoignable depuis une machine de développement. Le `.env` local, lui, porte
 * l'hôte PUBLIC de la même base.
 *
 * On a besoin des DEUX : les secrets R2 et JWT viennent de Railway, l'adresse
 * joignable de la base vient d'ici. D'où `VERIFY_DATABASE_URL`, passé en tête de
 * commande — `railway run` ne l'écrase pas puisqu'il ne la définit pas.
 */
const urlBase = process.env.VERIFY_DATABASE_URL?.trim() || process.env.DATABASE_URL
const prisma = new PrismaClient({ datasourceUrl: urlBase })
let ok = true
const dire = (bon: boolean, texte: string) => { if (!bon) ok = false; console.log(`  ${bon ? '✅' : '❌'} ${texte}`) }

async function main() {
  if (process.env.CONFIRM !== '1') {
    console.log('Refus : ce script ÉCRIT en base de production (tenant jetable) et écrit un objet R2.')
    console.log('Relancer avec CONFIRM=1 si c’est bien l’intention.')
    process.exit(1)
  }
  const secret = process.env.JWT_SECRET
  const bucket = (process.env.R2_BUCKET ?? '').trim()
  const base = (process.env.R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!secret || !bucket || !base) {
    console.log('❌ JWT_SECRET / R2_BUCKET / R2_PUBLIC_BASE_URL absents de cet environnement.')
    console.log('   Lancer via `railway run` pour disposer des variables de production.')
    process.exit(1)
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  })
  const objetsDuTenant = async () =>
    (await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `tenants/${ID}/` }))).Contents ?? []

  // ── INSTANTANÉ ────────────────────────────────────────────────────────────
  const tenantsAvant = await prisma.tenant.count()
  console.log(`· instantané : ${tenantsAvant} tenant(s), ${(await objetsDuTenant()).length} objet(s) sous le préfixe jetable`)
  console.log(`· domaine public sondé : ${new URL(base).host}`)

  if (process.env.NETTOYAGE_SEUL === '1') {
    console.log('· mode NETTOYAGE SEUL — aucune création, aucun envoi')
  }

  let produitId = ''
  try {
    if (process.env.NETTOYAGE_SEUL === '1') return
    // ── MISE EN PLACE (écriture DIRECTE : aucune route, donc aucun e-mail) ───
    await prisma.tenant.create({
      data: { id: ID, name: 'Vérification R2 (jetable)', status: 'active', isDemo: false, country: 'CM', currency: 'XAF', vatRate: 19.25 },
    })
    const user = await prisma.user.create({
      data: { tenantId: ID, name: 'Vérif R2', email: `${ID}@habashop.invalid`, passwordHash: 'non-utilisable', role: 'ADMIN' },
    })
    const produit = await prisma.product.create({
      data: { tenantId: ID, sku: 'VERIF-R2-001', name: 'Produit de vérification', category: 'Test', buyPrice: 0, sellPrice: 100 },
    })
    produitId = produit.id
    const jeton = signerJwt({ userId: user.id, tenantId: ID, activeTenantId: ID, role: 'ADMIN' }, secret)
    console.log('· tenant, utilisateur et produit jetables créés\n')

    // ── 1. ENVOI RÉEL, par la route DÉPLOYÉE, en multipart ───────────────────
    const fd = new FormData()
    fd.append('image', new Blob([JPEG_1x1], { type: 'image/jpeg' }), 'verif.jpg')
    const envoi = await fetch(`${API}/api/products/${produitId}/image`, {
      method: 'POST', headers: { Authorization: `Bearer ${jeton}` }, body: fd,
    })
    const corps = await envoi.json().catch(() => ({})) as { image?: string; error?: string; code?: string }
    dire(envoi.status === 200, `envoi accepté (${envoi.status}${corps.code ? ' ' + corps.code : ''}${corps.error ? ' — ' + corps.error : ''})`)
    const url = corps.image ?? ''
    dire(url.startsWith(`${base}/tenants/${ID}/products/${produitId}/`), 'URL rendue sous notre base, cloisonnée par tenant et produit')

    // ── 2. L'OBJET EXISTE VRAIMENT DANS LE BUCKET ────────────────────────────
    const objets = await objetsDuTenant()
    dire(objets.length === 1, `1 objet présent dans R2 (vu : ${objets.length})`)

    // ── 3. LE DOMAINE PUBLIC LE SERT ─────────────────────────────────────────
    // ⚠️ C'est CE contrôle qui juge `R2_PUBLIC_BASE_URL` : les identifiants
    // peuvent être bons et le domaine public non branché — deux réglages distincts.
    const lecture = await fetch(url)
    const octets = Buffer.from(await lecture.arrayBuffer())
    dire(lecture.status === 200, `le domaine public sert l’objet (${lecture.status})`)
    dire(octets.length === JPEG_1x1.length && octets[0] === 0xff && octets[1] === 0xd8,
         `les octets rendus sont bien le JPEG envoyé (${octets.length} o)`)
    dire((lecture.headers.get('cache-control') ?? '').includes('immutable'),
         'l’en-tête de cache immuable est servie (sûre car la clé porte l’empreinte)')

    // ── 4. LA BASE PORTE LA MÊME URL ─────────────────────────────────────────
    const enBase = await prisma.product.findUnique({ where: { id: produitId }, select: { image: true } })
    dire(enBase?.image === url, 'Product.image en base == URL rendue')

    // ── 5. LE RETRAIT NETTOIE VRAIMENT ───────────────────────────────────────
    const retrait = await fetch(`${API}/api/products/${produitId}/image`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${jeton}` },
    })
    dire(retrait.status === 200, `retrait accepté (${retrait.status})`)
    /**
     * ⚠️ LA LISTE R2 N'EST PAS IMMÉDIATEMENT COHÉRENTE APRÈS UNE SUPPRESSION.
     * MESURÉ le 2026-08-12 : `ListObjectsV2` renvoyait encore l'objet juste après un
     * `DELETE` réussi, puis plus rien quelques secondes plus tard. Conclure « la
     * suppression n'a pas eu lieu » sur une seule lecture est un FAUX NÉGATIF — et il
     * accuse un code correct. On laisse le temps de converger, borné.
     */
    let restants = (await objetsDuTenant()).length
    for (let essai = 0; restants > 0 && essai < 10; essai++) {
      await new Promise(r => setTimeout(r, 1000))
      restants = (await objetsDuTenant()).length
    }
    dire(restants === 0, `l’objet a DISPARU du bucket (${restants} restant)`)
    const apres = await prisma.product.findUnique({ where: { id: produitId }, select: { image: true } })
    dire(apres?.image === null, 'Product.image remis à null')
  } finally {
    // ── MÉNAGE — TOUJOURS, même en cas d'échec au milieu ─────────────────────
    console.log('\n· nettoyage')
    for (const o of await objetsDuTenant()) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key as string }))
      console.log(`  · objet résiduel supprimé : ${o.Key}`)
    }
    // ⚠️ L'AUDIT D'ABORD. `AuditLog.userId` est une FK en RESTRICT : la route d'envoi
    // écrit `PRODUCT_IMAGE_SET` et le retrait `PRODUCT_IMAGE_CLEARED`, tous deux liés à
    // l'utilisateur jetable. Supprimer l'utilisateur avant fait échouer le ménage —
    // MESURÉ le 2026-08-12, tenant et utilisateur laissés en production. L'ordre n'est
    // pas cosmétique, et c'est le propre code de ce lot qui crée la contrainte.
    await prisma.auditLog.deleteMany({ where: { tenantId: ID } })
    await prisma.product.deleteMany({ where: { tenantId: ID } })
    await prisma.user.deleteMany({ where: { tenantId: ID } })
    await prisma.tenant.deleteMany({ where: { id: ID } })

    // ── ÉTAT FINAL VÉRIFIÉ, jamais supposé ───────────────────────────────────
    /**
     * ⚠️ L'ASSERTION PORTE SUR L'ABSENCE DE RÉSIDU, pas sur « le compte n'a pas bougé ».
     * En mode NETTOYAGE_SEUL l'instantané CONTIENT déjà le résidu à retirer : exiger
     * « après == avant » y crie à l'échec sur un ménage réussi. C'est arrivé — un
     * critère juste pour un mode et faux pour l'autre est un critère faux.
     */
    const restes = {
      tenants:  await prisma.tenant.count({ where: { id: ID } }),
      users:    await prisma.user.count({ where: { tenantId: ID } }),
      produits: await prisma.product.count({ where: { tenantId: ID } }),
      audits:   await prisma.auditLog.count({ where: { tenantId: ID } }),
      objets:   (await objetsDuTenant()).length,
    }
    for (const [quoi, n] of Object.entries(restes)) dire(n === 0, `aucun résidu — ${quoi} : ${n}`)
    if (process.env.NETTOYAGE_SEUL !== '1') {
      const tenantsApres = await prisma.tenant.count()
      dire(tenantsApres === tenantsAvant, `nombre de tenants revenu à ${tenantsAvant} (vu : ${tenantsApres})`)
    }
    await prisma.$disconnect()
    console.log(ok ? '\n✅ CHAÎNE COMPLÈTE PROUVÉE — et rien n’a été laissé derrière.'
                   : '\n❌ Au moins un contrôle a échoué (voir ci-dessus).')
    process.exit(ok ? 0 : 1)
  }
}

main()
