/**
 * VIGNETTES DE DÉMONSTRATION — semées CÔTÉ SERVEUR, jamais par la route.
 *
 * ─── POURQUOI CE SCRIPT ──────────────────────────────────────────────────────
 * `POST /api/products/:id/image` est gardé par `blockDemoTenant` : le mot de passe
 * démo est PUBLIC, et R2 se facture au Go·MOIS — laisser envoyer depuis une démo,
 * c'est laisser n'importe qui déposer des objets durables sur notre stockage. Cette
 * garde ne bouge pas.
 *
 * Mais une démo sans images se présente mal à un prospect. On écrit donc
 * DIRECTEMENT (S3 + Prisma), sans passer par la route : la démo AFFICHE des
 * vignettes, et personne ne peut en envoyer. C'est l'inverse exact du contournement
 * — la garde reste entière, c'est l'administrateur du service qui sème.
 *
 * ⚠️ CE NE SONT PAS DES PHOTOGRAPHIES, et il ne faut pas le laisser croire. Ce sont
 * des vignettes GÉNÉRÉES : dégradé teinté par catégorie + émoji du produit, rendues
 * par Chromium. Aucune image tierce n'est téléchargée (licence, source non
 * maîtrisée). Le jour où de vraies photos existent, elles remplacent celles-ci par
 * le chemin normal de l'application.
 *
 * ⚠️ LA CLÉ EST CELLE DE L'APPLICATION (`productImageKey`), et c'est load-bearing :
 * `keyFromPublicUrl` + `keyBelongsToTenant` ne reconnaissent QUE cette forme. Une
 * clé maison rendrait ces objets invisibles au chemin de suppression — des
 * orphelins facturés que plus rien ne saurait retrouver.
 *
 *   CONFIRM=1 VERIFY_DATABASE_URL=… railway run npx tsx prisma/seed-demo-photos.ts
 *   RETIRER=1 CONFIRM=1 …                                    (défait tout)
 */
import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { chromium } from 'playwright'
import { productImageKey, publicUrlFor, keyFromPublicUrl, keyBelongsToTenant } from '../src/lib/productImageKey'

const prisma = new PrismaClient({ datasourceUrl: process.env.VERIFY_DATABASE_URL || process.env.DATABASE_URL })

/**
 * Teinte DÉRIVÉE du nom de catégorie, jamais une table codée en dur : une liste
 * `{'Céréales': 45, …}` serait fausse au premier produit d'une catégorie nouvelle,
 * et muette à ce sujet. Ici toute catégorie reçoit une couleur stable et distincte.
 */
function teinte(categorie: string): number {
  let h = 0
  for (const c of categorie) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

/**
 * La carte, en HTML — Chromium sait rendre les émojis, aucune police à embarquer.
 *
 * ⚠️ FOND CLAIR, ET C'EST UNE DÉCISION, pas un goût. Le premier jet était un dégradé
 * sombre très saturé : il jurait avec le THÈME CLAIR de l'application, et il se lisait
 * comme une icône d'application plutôt que comme un produit. Un fond neutre lumineux
 * avec une ombre portée au sol imite la convention d'une prise de vue en studio — ce
 * à quoi ressemblera le catalogue le jour où de vraies photos remplaceront celles-ci.
 * La teinte de catégorie reste, mais DISCRÈTE : elle situe, elle ne crie pas.
 */
function carte(emoji: string, categorie: string): string {
  const t = teinte(categorie)
  return `<!doctype html><html><body style="margin:0">
  <div style="width:512px;height:512px;position:relative;overflow:hidden;
              background:radial-gradient(circle at 50% 36%,
                hsl(${t} 38% 98%) 0%, hsl(${t} 30% 94%) 52%, hsl(${(t + 16) % 360} 28% 87%) 100%);">
    <!-- Ombre au sol : elle POSE l'objet. Sans elle il flotte, et l'œil lit une icône. -->
    <div style="position:absolute;left:50%;top:63%;transform:translateX(-50%);
                width:268px;height:52px;border-radius:50%;
                background:radial-gradient(ellipse at center, rgba(30,20,10,.20) 0%, rgba(30,20,10,.07) 52%, rgba(0,0,0,0) 72%)"></div>
    <!-- Halo haut : simule une source de lumière unique, comme en studio. -->
    <div style="position:absolute;inset:0;
                background:radial-gradient(ellipse at 50% 8%, rgba(255,255,255,.75) 0%, rgba(255,255,255,0) 58%)"></div>
    <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-56%);
                text-align:center;font-size:250px;line-height:1;
                filter:drop-shadow(0 10px 14px rgba(40,25,10,.22))">${emoji}</div>
  </div></body></html>`
}

function s3(): { client: S3Client; bucket: string; base: string } {
  const bucket = (process.env.R2_BUCKET ?? '').trim()
  const base = (process.env.R2_PUBLIC_BASE_URL ?? '').trim()
  if (!bucket || !base) throw new Error('R2 non configuré — lancer via `railway run`.')
  return {
    bucket, base,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
    }),
  }
}

async function main() {
  if (process.env.CONFIRM !== '1') {
    console.log('Refus : ce script écrit dans R2 et en base de PRODUCTION (tenants de démonstration).')
    console.log('  CONFIRM=1 …            sème les vignettes')
    console.log('  RETIRER=1 CONFIRM=1 …  les retire')
    process.exit(1)
  }
  const { client, bucket, base } = s3()

  // ⚠️ PÉRIMÈTRE : `isDemo` UNIQUEMENT. Une erreur ici écrirait sur une vraie
  // boutique — et une image semée sur un catalogue client serait bien pire qu'une
  // absence d'image.
  const demos = await prisma.tenant.findMany({ where: { isDemo: true }, select: { id: true, name: true } })
  if (demos.length === 0) { console.log('Aucun tenant de démonstration — rien à faire.'); return }
  console.log(`· ${demos.length} boutique(s) de démonstration : ${demos.map(d => d.id).join(', ')}`)

  // ── RETRAIT ───────────────────────────────────────────────────────────────
  if (process.env.RETIRER === '1') {
    let retirés = 0
    for (const t of demos) {
      const prods = await prisma.product.findMany({ where: { tenantId: t.id, image: { not: null } }, select: { id: true, image: true } })
      for (const p of prods) {
        // Mêmes trois conditions que l'application : sous notre base, forme de clé
        // valide, préfixe du bon tenant. On ne supprime pas ce qu'on n'a pas écrit.
        const cle = keyFromPublicUrl(p.image, base)
        if (cle && keyBelongsToTenant(cle, t.id)) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: cle }))
        }
        await prisma.product.update({ where: { id: p.id }, data: { image: null } })
        retirés++
      }
    }
    console.log(`✅ ${retirés} vignette(s) retirée(s).`)
    return
  }

  // ── SEMIS ─────────────────────────────────────────────────────────────────
  const navigateur = await chromium.launch()
  const page = await navigateur.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
  let semées = 0, ignorées = 0
  try {
    for (const t of demos) {
      const prods = await prisma.product.findMany({
        where: { tenantId: t.id, deletedAt: null },
        select: { id: true, name: true, emoji: true, category: true, image: true },
      })
      for (const p of prods) {
        // ⚠️ On n'ÉCRASE PAS une image existante : une vraie photo posée par le
        // commerçant vaut mieux que la vignette générée, toujours.
        if (p.image) { ignorées++; continue }

        await page.setContent(carte(p.emoji || '📦', p.category || 'Divers'))
        // ⚠️ JPEG, PAS PNG — MESURÉ le 2026-08-12 : un dégradé compresse très mal en
        // PNG (210 à 245 Ko la vignette, soit 5,4 Mo pour les 25). En JPEG à la MÊME
        // qualité que l'application (0,82, cf. `PRODUIT_QUALITE`), la même image tombe
        // autour de 30 Ko. Servir 6× trop lourd à une grille de caisse contredirait
        // exactement le réseau lent pour lequel tout ce chemin est conçu.
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 82 })
        const cle = productImageKey(t.id, p.id, jpeg, 'jpg')
        await client.send(new PutObjectCommand({
          Bucket: bucket, Key: cle, Body: jpeg, ContentType: 'image/jpeg',
          // Sûr UNIQUEMENT parce que la clé porte l'empreinte du contenu.
          CacheControl: 'public, max-age=31536000, immutable',
        }))
        await prisma.product.update({ where: { id: p.id }, data: { image: publicUrlFor(cle, base) } })
        semées++
        console.log(`  ${p.emoji ?? '?'}  ${p.name.padEnd(26)} ${(jpeg.length / 1024).toFixed(0)} Ko`)
      }
    }
  } finally {
    await navigateur.close()
  }
  console.log(`\n✅ ${semées} vignette(s) semée(s)${ignorées ? `, ${ignorées} produit(s) déjà pourvu(s) — non écrasé(s)` : ''}.`)
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
