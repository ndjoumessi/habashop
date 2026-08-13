import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { ProductBody } from '../types'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { diffAudite, descriptionAudit } from '../lib/auditDiff'
import { getTenantId } from '../lib/tenantId'

/**
 * CE QU'UN CHANGEMENT DE PRODUIT CONSIGNE — liste blanche, pas le corps.
 *
 * ⚠️ SONT DEHORS, ET C'EST DÉLIBÉRÉ : `description` et `notes` (texte libre saisi par
 * le commerçant, donc susceptible de porter un nom de personne — l'audit s'en tient
 * à des codes et des nombres) ; `emoji` et `image` (cosmétique, du bruit dans un
 * journal plafonné à 100 lignes) ; `priceTiers` (un tableau d'objets, que le rendu
 * `avant → après` ne sait pas montrer — les paliers restent couverts par
 * `previousPricing`, qui est fait pour ça).
 */
const CHAMPS_AUDITES_PRODUIT = [
  'name', 'category', 'buyPrice', 'sellPrice', 'wholesalePrice', 'semiWholesalePrice',
  'stockQty', 'stockMin', 'taxRate', 'isActive', 'barcode', 'supplierId',
  'hasPromotion', 'promotionPrice', 'promotionEnd', 'unit',
] as const
import { authenticate } from '../middleware/authenticate'
import { invalidateTenantCache } from '../lib/cache'
import { validatePriceTiers, toPricingSet, samePricing, PRICING_FIELDS } from '../utils/pricing'
import { isValidBarcode, normalizeBarcode, matchesScannedCode } from '../lib/barcode'
import { blockDemoTenant } from '../middleware/demoTenant'
import { costQuota } from '../middleware/costQuota'
import { sniffImageType, productImageKey, keyFromPublicUrl, keyBelongsToTenant } from '../lib/productImageKey'
import { putProductImage, deleteProductImage, isR2Configured, publicBaseUrl, STORAGE_NOT_CONFIGURED } from '../lib/spend/r2Client'

// Valide un code-barres (EAN-13 + unicité par tenant) et renvoie sa forme
// normalisée. `excludeId` : produit à ignorer dans le contrôle de doublon (PUT).
// `error` renseigné ⇒ échec (le handler traduit en 400/409).
interface BarcodeCheck { barcode: string; error?: { code: 400 | 409; message: string } }
async function checkBarcode(
  db: typeof prisma,
  tenantId: string,
  raw: unknown,
  excludeId?: string,
): Promise<BarcodeCheck> {
  const barcode = normalizeBarcode(raw) // UPC-A (12) → EAN-13 canonique ici
  if (!barcode) return { barcode: '' } // pas de code-barres = valide
  if (!isValidBarcode(barcode)) {
    return { barcode, error: { code: 400, message: 'Code-barres invalide : EAN-13, EAN-8 ou UPC-A attendu (clé de contrôle correcte)' } }
  }
  const dup = await db.product.findFirst({
    where: { tenantId, barcode, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { name: true },
  })
  if (dup) {
    return { barcode, error: { code: 409, message: `Ce code-barres est déjà utilisé par « ${dup.name} »` } }
  }
  return { barcode }
}

// ── Schémas (item 6) ─────────────────────────────────────────────────────────
const ID_PARAMS = z.object({ id: z.string().min(1) })
// CREATE : structurel (types) ; les règles métier (nom requis, prix ≥ 0, paliers)
// restent dans le handler → messages conservés. passthrough (le handler mappe
// explicitement les champs).
const PRODUCT_CREATE = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  buyPrice: z.coerce.number().optional(),
  sellPrice: z.coerce.number().optional(),
  stockQty: z.coerce.number().optional(),
  stockMin: z.coerce.number().optional(),
  unit: z.string().optional(),
  emoji: z.string().optional(),
  taxRate: z.coerce.number().optional(),
  description: z.string().optional(),
  barcode: z.string().optional(),
  isActive: z.boolean().optional(),
  wholesalePrice: z.coerce.number().nullish(),
  semiWholesalePrice: z.coerce.number().nullish(),
  hasPromotion: z.boolean().optional(),
  promotionPrice: z.coerce.number().nullish(),
  supplierId: z.string().nullish(),
  notes: z.string().optional(),
  priceTiers: z.any().optional(),
  image: z.string().nullish(),
}).passthrough()
// UPDATE : liste blanche STRICTE (strip par défaut) → ferme le mass-assignment
// (le handler faisait `...data` dans prisma.update : un `tenantId`/`id` injecté
// aurait pu réassigner le produit). sku reste ignoré par le handler.
const PRODUCT_UPDATE = z.object({
  name: z.string().optional(),
  description: z.string().nullish(),
  category: z.string().optional(),
  unit: z.string().optional(),
  buyPrice: z.coerce.number().optional(),
  sellPrice: z.coerce.number().optional(),
  wholesalePrice: z.coerce.number().nullish(),
  semiWholesalePrice: z.coerce.number().nullish(),
  stockQty: z.coerce.number().optional(),
  stockMin: z.coerce.number().optional(),
  supplierId: z.string().nullish(),
  barcode: z.string().nullish(),
  taxRate: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
  hasPromotion: z.boolean().optional(),
  promotionPrice: z.coerce.number().nullish(),
  promotionEnd: z.any().optional(),
  emoji: z.string().optional(),
  notes: z.string().nullish(),
  priceTiers: z.any().optional(),
  // ⚠️ Sans cette ligne le champ serait STRIPPÉ : `PRODUCT_UPDATE` est une liste blanche
  // STRICTE et le handler fait `...data` — ici c'est le zod qui décide, contrairement
  // au CREATE (passthrough) où c'est la destructuration.
  image: z.string().nullish(),
  sku: z.any().optional(),
})

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/products', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.product.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } })
  })

  /**
   * Résolution CIBLÉE d'un seul code scanné (Chantier B).
   *
   * Un scan qui ne matche pas le cache local du terminal ne prouve rien : le produit
   * peut avoir été créé depuis la dernière synchro. Le POS interroge donc le serveur
   * AVANT de conclure — mais il ne peut pas rapatrier tout le catalogue pour ça
   * (mesuré : 22 Ko gz pour 500 produits, ~1,1 s en 2G, à comparer aux ~600 o d'un
   * produit). D'où cette route : UN produit, jamais la liste.
   *
   * 404 = « pas dans le catalogue de CETTE boutique », un fait vérifié côté serveur —
   * à ne pas confondre avec « ce produit n'existe pas », que le POS n'affirme jamais.
   */
  app.get('/api/products/lookup', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const raw = String((request.query as { code?: unknown })?.code ?? '').trim()
    if (!raw) return reply.code(400).send({ error: 'code requis', code: 'CODE_REQUIRED' })

    const canon = normalizeBarcode(raw)
    // Présélection étroite (indexée) sur les formes de stockage plausibles, puis
    // vérification par la RÈGLE CANONIQUE partagée — c'est elle qui tranche, pas le SQL.
    const or: Record<string, string>[] = [{ barcode: raw }, { sku: raw }]
    if (canon && canon !== raw) or.push({ barcode: canon })
    if (canon.length === 13 && canon.startsWith('0')) or.push({ barcode: canon.slice(1) })

    const candidates = await prisma.product.findMany({
      where: { tenantId, deletedAt: null, OR: or },
      take: 5,
    })
    const found = candidates.find(p => matchesScannedCode(p, raw))
    if (!found) return reply.code(404).send({ error: 'Produit absent de ce catalogue', code: 'NOT_IN_CATALOG' })
    return found
  })

  app.post('/api/products', { preHandler: authenticate, schema: { body: PRODUCT_CREATE } }, async (request, reply) => {
    const {
      name, category, buyPrice, sellPrice,
      stockQty, stockMin, unit, emoji, image, taxRate,
      description, barcode, isActive,
      wholesalePrice, semiWholesalePrice,
      hasPromotion, promotionPrice, promotionEnd,
      supplierId, notes,
      priceTiers,
    } = request.body as ProductBody

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Nom requis' })
    }
    if (sellPrice !== undefined && sellPrice < 0) {
      return reply.code(400).send({ error: 'Le prix de vente ne peut pas être négatif' })
    }
    if (buyPrice !== undefined && buyPrice < 0) {
      return reply.code(400).send({ error: "Le prix d'achat ne peut pas être négatif" })
    }
    if (stockQty !== undefined && stockQty < 0) {
      return reply.code(400).send({ error: 'Le stock ne peut pas être négatif' })
    }

    const tiersResult = validatePriceTiers(priceTiers)
    if (!tiersResult.ok) {
      return reply.code(400).send({ error: `Paliers invalides : ${(tiersResult as { error: string }).error}` })
    }
    const tiersOk = tiersResult as { ok: true; tiers: { minQty: number; price: number; label?: string }[] }

    // Après les gardes 400 : `getTenantId` peut lever, l'ordre des sorties reste identique.
    const tenantId = getTenantId(request)
    const bc = await checkBarcode(prisma, tenantId, barcode)
    if (bc.error) return reply.code(bc.error.code).send({ error: bc.error.message, code: bc.error.code === 409 ? 'DUPLICATE_BARCODE' : 'INVALID_BARCODE' })

    // SKU séquentiel par tenant (inclut soft-deleted pour éviter les collisions de réutilisation).
    const count = await prisma.product.count({ where: { tenantId } })
    const generatedSku = `PRD-${String(count + 1).padStart(4, '0')}`

    try {
      const product = await prisma.product.create({
        data: {
          tenantId,
          sku: generatedSku,
          name: name.trim(),
          category: category || 'Général',
          buyPrice: buyPrice || 0,
          sellPrice: sellPrice || 0,
          stockQty: stockQty || 0,
          stockMin: stockMin || 5,
          unit: unit || 'unité',
          emoji: emoji || '📦',
          // ⚠️ DESTRUCTURER NE SUFFIT PAS. Le zod du CREATE est en `.passthrough()` : c'est
          // cette ligne qui décide si le champ atteint la base. `avatar` l'avait appris le
          // 2026-08-11 — déclaré, envoyé, et jeté parce que le handler ne l'écrivait pas.
          image: image ?? null,
          taxRate: taxRate || 18,
          description: description || '',
          barcode: bc.barcode,
          isActive: isActive !== false,
          wholesalePrice: wholesalePrice || null,
          semiWholesalePrice: semiWholesalePrice || null,
          hasPromotion: hasPromotion || false,
          promotionPrice: promotionPrice || null,
          // Persisté à la création (le PUT le faisait déjà via la liste blanche) — sinon une
          // promo créée d'emblée n'a jamais de date de fin donc n'expire jamais.
          promotionEnd: promotionEnd ? new Date(promotionEnd) : null,
          supplierId: supplierId || null,
          notes: notes || '',
          priceTiers: tiersOk.tiers.length ? (tiersOk.tiers as any) : undefined,
        }
      })
      invalidateTenantCache(tenantId).catch(() => {})
      // ⚠️ APRÈS le `create`, jamais avant : un audit écrit d'avance affirmerait une
      // création qui peut encore échouer. `writeAudit` est fail-open TRACÉ — une panne
      // du journal ne doit pas faire échouer la création du produit.
      await writeAudit('CREATE_PRODUCT', prisma.auditLog.create({
        data: {
          tenantId, userId: request.user.userId, module: 'products', action: 'CREATE_PRODUCT',
          description: descriptionAudit(product.name, null),
        },
      }))
      return product
    } catch (err) {
      console.error('Create product error:', err)
      return reply.code(500).send({
        error: 'Erreur création produit',
        details: (err as Error).message,
      })
    }
  })

  app.put('/api/products/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: PRODUCT_UPDATE } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    // SKU est immutable (auto-généré à la création) — on retire tout sku envoyé par le client.
    const { sku: _ignored, priceTiers: rawTiers, ...data } = request.body as Record<string, unknown>
    void _ignored
    // Si priceTiers présent (même null/[]), valider et normaliser
    if (rawTiers !== undefined) {
      const r = validatePriceTiers(rawTiers)
      if (!r.ok) return reply.code(400).send({ error: `Paliers invalides : ${(r as { error: string }).error}` })
      const ok = r as { ok: true; tiers: { minQty: number; price: number; label?: string }[] }
      ;(data as any).priceTiers = ok.tiers.length ? ok.tiers : null
    }
    // Après la garde 400 des paliers : `getTenantId` peut lever, ordre des sorties inchangé.
    const tenantId = getTenantId(request)
    // Si barcode présent : EAN-13 valide + unique par tenant (hors soi-même).
    if (data.barcode !== undefined) {
      const bc = await checkBarcode(prisma, tenantId, data.barcode, id)
      if (bc.error) return reply.code(bc.error.code).send({ error: bc.error.message, code: bc.error.code === 409 ? 'DUPLICATE_BARCODE' : 'INVALID_BARCODE' })
      data.barcode = bc.barcode
    }
    // ── Instantané des tarifs PRÉCÉDENTS (audit des divergences de prix) ──
    // Si ce PUT modifie RÉELLEMENT la tarification, on mémorise le jeu de tarifs sortant +
    // la date serveur. C'est ce qui permet ensuite d'affirmer factuellement « ce prix ÉTAIT
    // le tarif catalogue jusqu'au T » face à une vente arrivée avec un catalogue en cache
    // (cf. sales.ts § QUALIFICATION). Renommer un produit ne consomme PAS l'instantané —
    // la profondeur est de 1, on ne la gaspille pas sur une écriture non tarifaire.
    // Ces deux colonnes sont hors de PRODUCT_UPDATE (liste blanche stricte) : inatteignables
    // depuis le corps de la requête, donc l'instantané ne peut pas être forgé par un client.
    // Un PUT qui ne touche aucun champ de prix ne relit RIEN (cas majoritaire : stock, code-barres,
    // renommage) → pas de requête supplémentaire sur le chemin courant.
    const touchesPricing = PRICING_FIELDS.some(f => f in (data as Record<string, unknown>))
    // ⚠️ LA MÊME LECTURE SERT AUX DEUX. L'instantané tarifaire et le diff d'audit ont
    // besoin de l'état AVANT ; deux `findFirst` séparés feraient deux requêtes pour la
    // même ligne, et surtout deux occasions de diverger sur ce qu'« avant » veut dire.
    // Le `select` est donc l'UNION des deux besoins, et la garde l'union des deux
    // déclencheurs : un `PUT` qui ne soumet aucun champ suivi ne relit toujours RIEN.
    const touchesAudit = CHAMPS_AUDITES_PRODUIT.some(f => f in (data as Record<string, unknown>))
    const before = touchesPricing || touchesAudit
      ? await prisma.product.findFirst({
          where: { id, tenantId },
          select: {
            sellPrice: true, semiWholesalePrice: true, wholesalePrice: true, hasPromotion: true, promotionPrice: true, priceTiers: true,
            name: true, category: true, buyPrice: true, stockQty: true, stockMin: true,
            taxRate: true, isActive: true, barcode: true, supplierId: true, promotionEnd: true, unit: true,
          },
        })
      : null
    const prevSet = toPricingSet(before as Record<string, unknown> | null)
    if (prevSet) {
      // Le PUT est PARTIEL : le jeu entrant = l'ancien surchargé par les seuls champs de
      // prix réellement présents dans le corps (`priceTiers` y est déjà normalisé ci-dessus).
      const merged: Record<string, unknown> = { ...(before as Record<string, unknown>) }
      for (const f of PRICING_FIELDS) {
        if (f in (data as Record<string, unknown>)) merged[f] = (data as Record<string, unknown>)[f]
      }
      const nextSet = toPricingSet(merged)
      if (nextSet && !samePricing(prevSet, nextSet)) {
        const d = data as Record<string, unknown>
        d.previousPricing = prevSet as unknown as object
        d.pricingChangedAt = new Date()
      }
    }
    const updated = await prisma.product.update({ where: { id, tenantId }, data: data as any })
    invalidateTenantCache(tenantId).catch(() => {})
    // ⚠️ ON COMPARE L'ÉTAT AVANT À L'ÉTAT APRÈS, PAS AU CORPS DE LA REQUÊTE. Les deux
    // côtés sortent alors de Prisma, du même modèle : plus de « taxRate 18 → "18" »
    // né d'une chaîne envoyée par le formulaire, et surtout on consigne ce qui a
    // RÉELLEMENT été écrit — un champ soumis mais strippé par la liste blanche zod
    // ne doit pas apparaître comme un changement (c'est le cas de `sku`).
    const diff = before ? diffAudite(before as Record<string, unknown>, updated as unknown as Record<string, unknown>, CHAMPS_AUDITES_PRODUIT) : null
    if (diff) {
      await writeAudit('UPDATE_PRODUCT', prisma.auditLog.create({
        data: {
          tenantId, userId: request.user.userId, module: 'products', action: 'UPDATE_PRODUCT',
          description: descriptionAudit(updated.name, diff),
        },
      }))
    }
    return updated
  })

  /**
   * ─── PHOTO PRODUIT : ENVOI ─────────────────────────────────────────────────
   *
   * ⚠️ L'ORDRE DES GARDES EST LOAD-BEARING, et il se lit de haut en bas :
   *   1. `blockDemoTenant` + `costQuota` en preHandler → refus AVANT de lire un
   *      fichier de plusieurs Mo. Le mot de passe démo est PUBLIC ; un envoi y
   *      coûte du stockage RÉCURRENT.
   *   2. Le produit est cherché DANS CETTE BOUTIQUE → 404 uniforme pour un tiers,
   *      jamais 403 (pas d'oracle d'existence — cf. W1 de l'audit).
   *   3. Le stockage doit être configuré → 503 nommé, pas un 500.
   *   4. Le type se lit dans les OCTETS.
   *   5. Seulement ensuite on écrit, et donc on dépense.
   *
   * ⚠️ CE QUE CETTE ROUTE NE FAIT PAS, ET QU'IL FAUT SAVOIR : elle ne
   * REDIMENSIONNE PAS. Il n'y a pas de `sharp` côté serveur (dépendance native,
   * image Docker) et `lib/imageResize.ts` vit côté FRONT. Les dimensions sont donc
   * la responsabilité de l'appelant, et le plafond ci-dessous ne borne que les
   * OCTETS — un client qui enverrait une photo de 3 Mo en 4000 px la verrait
   * servie telle quelle dans la grille de caisse. C'est une limite ASSUMÉE de ce
   * lot, pas une propriété du système.
   */
  const IMAGE_MAX_OCTETS = 3 * 1024 * 1024

  app.post('/api/products/:id/image', {
    preHandler: [authenticate, blockDemoTenant, costQuota('storage')],
    schema: { params: ID_PARAMS },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantId = getTenantId(request)

    const produit = await prisma.product.findFirst({ where: { id, tenantId }, select: { id: true, image: true } })
    if (!produit) return reply.code(404).send({ error: 'Produit introuvable.' })

    if (!isR2Configured()) {
      return reply.code(503).send({ error: 'Stockage des photos non configuré.', code: STORAGE_NOT_CONFIGURED })
    }

    const file = await request.file({ limits: { fileSize: IMAGE_MAX_OCTETS, files: 1 } })
    if (!file) return reply.code(400).send({ error: 'Aucun fichier reçu.', code: 'NO_FILE' })
    const buffer = await file.toBuffer()
    // ⚠️ `truncated` plutôt que `buffer.length` : au-delà de la limite, multipart
    // COUPE le flux et rend un buffer valide de la taille du plafond. Sans ce
    // contrôle on enregistrerait sereinement une image tronquée — un fichier dont
    // les octets d'en-tête sont corrects et qui ne s'affiche nulle part.
    if (file.file.truncated) {
      return reply.code(413).send({ error: 'Photo trop lourde (3 Mo maximum).', code: 'IMAGE_TOO_LARGE' })
    }

    const type = sniffImageType(buffer)
    if (!type) {
      return reply.code(415).send({ error: 'Format non accepté — JPEG, PNG ou WebP.', code: 'UNSUPPORTED_IMAGE' })
    }

    const key = productImageKey(tenantId, id, buffer, type.ext)
    const ecrit = await putProductImage({ tenantId, key, body: buffer, contentType: type.mime })
    if (!ecrit.ok) {
      const http = ecrit.code === STORAGE_NOT_CONFIGURED ? 503 : ecrit.code === 'STORAGE_WRITE_FAILED' ? 502 : 403
      return reply.code(http).send({ error: ecrit.error, code: ecrit.code })
    }

    await prisma.product.update({ where: { id, tenantId }, data: { image: ecrit.url } })

    // ── L'ANCIEN objet, s'il était bien à NOUS ────────────────────────────────
    // ⚠️ Trois conditions cumulatives avant de supprimer quoi que ce soit : l'URL
    // doit être sous notre base, avoir la forme de nos clés, ET porter le préfixe
    // de CE tenant. `Product.image` est une colonne texte libre — sans ces gardes,
    // une valeur forgée ou héritée ferait supprimer l'objet d'autrui.
    // Fail-open TRACÉ : un objet orphelin est du gaspillage, pas une perte.
    const ancienne = keyFromPublicUrl(produit.image, publicBaseUrl() ?? '')
    if (ancienne && ancienne !== key && keyBelongsToTenant(ancienne, tenantId)) {
      void deleteProductImage(ancienne)
    }

    invalidateTenantCache(tenantId).catch(() => {})
    await writeAudit('PRODUCT_IMAGE_SET', prisma.auditLog.create({
      data: { tenantId, userId: request.user.userId, module: 'products', action: 'PRODUCT_IMAGE_SET', description: JSON.stringify({ id, key }) },
    }))
    return { image: ecrit.url }
  })

  /**
   * ─── PHOTO PRODUIT : RETRAIT ───────────────────────────────────────────────
   *
   * ⚠️ PAS de `blockDemoTenant` ici, et c'est délibéré : supprimer REND de
   * l'espace. Une garde de dépense qui empêche de ranger fait grossir la facture
   * au lieu de la contenir — même raisonnement que dans `r2Client`.
   *
   * ⚠️ La colonne est effacée MÊME si l'objet n'est pas à nous (URL héritée,
   * importée, forgée) : on retire alors la référence sans rien supprimer côté R2.
   * Refuser laisserait le commerçant avec une photo qu'il ne peut pas enlever.
   */
  app.delete('/api/products/:id/image', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const tenantId = getTenantId(request)

    const produit = await prisma.product.findFirst({ where: { id, tenantId }, select: { id: true, image: true } })
    if (!produit) return reply.code(404).send({ error: 'Produit introuvable.' })
    if (!produit.image) return { image: null }

    const cle = keyFromPublicUrl(produit.image, publicBaseUrl() ?? '')
    await prisma.product.update({ where: { id, tenantId }, data: { image: null } })
    if (cle && keyBelongsToTenant(cle, tenantId)) void deleteProductImage(cle)

    invalidateTenantCache(tenantId).catch(() => {})
    await writeAudit('PRODUCT_IMAGE_CLEARED', prisma.auditLog.create({
      data: { tenantId, userId: request.user.userId, module: 'products', action: 'PRODUCT_IMAGE_CLEARED', description: JSON.stringify({ id, key: cle }) },
    }))
    return { image: null }
  })

  app.delete('/api/products/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { userId } = request.user
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const product = await prisma.product.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!product) return reply.code(404).send({ error: 'Produit introuvable' })
    await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete
    invalidateTenantCache(tenantId).catch(() => {})
    await writeAudit('DELETE_PRODUCT', prisma.auditLog.create({
      data: { tenantId, userId, module: 'products', action: 'DELETE_PRODUCT', description: JSON.stringify({ id, name: product.name }) },
    }))
    return { success: true }
  })

  // Restaurer un produit soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/products/:id/restore', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const product = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!product) return reply.code(404).send({ error: 'Produit introuvable' })
    const restored = await prisma.product.update({ where: { id }, data: { deletedAt: null } })
    invalidateTenantCache(tenantId).catch(() => {})
    await writeAudit('RESTORE_PRODUCT', prisma.auditLog.create({
      data: { tenantId, userId, module: 'products', action: 'RESTORE_PRODUCT', description: JSON.stringify({ id, name: product.name }) },
    }))
    return restored
  })

  app.get('/api/products/low-stock', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    const products = await prisma.product.findMany({ where: { tenantId, isActive: true, deletedAt: null } })
    return products.filter((p) => p.stockQty <= p.stockMin)
  })
}
