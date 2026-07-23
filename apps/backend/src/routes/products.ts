import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { ProductBody } from '../types'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { getTenantId } from '../lib/tenantId'
import { authenticate } from '../middleware/authenticate'
import { invalidateTenantCache } from '../lib/cache'
import { validatePriceTiers } from '../utils/pricing'
import { isValidBarcode, normalizeBarcode } from '../lib/barcode'

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
  sku: z.any().optional(),
})

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/products', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.product.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: 'asc' } })
  })

  app.post('/api/products', { preHandler: authenticate, schema: { body: PRODUCT_CREATE } }, async (request, reply) => {
    const {
      name, category, buyPrice, sellPrice,
      stockQty, stockMin, unit, emoji, taxRate,
      description, barcode, isActive,
      wholesalePrice, semiWholesalePrice,
      hasPromotion, promotionPrice,
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
          taxRate: taxRate || 18,
          description: description || '',
          barcode: bc.barcode,
          isActive: isActive !== false,
          wholesalePrice: wholesalePrice || null,
          semiWholesalePrice: semiWholesalePrice || null,
          hasPromotion: hasPromotion || false,
          promotionPrice: promotionPrice || null,
          supplierId: supplierId || null,
          notes: notes || '',
          priceTiers: tiersOk.tiers.length ? (tiersOk.tiers as any) : undefined,
        }
      })
      invalidateTenantCache(tenantId).catch(() => {})
      return product
    } catch (err) {
      console.error('Create product error:', err)
      return reply.code(500).send({
        error: 'Erreur création produit',
        details: err.message,
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
    const updated = await prisma.product.update({ where: { id, tenantId }, data: data as any })
    invalidateTenantCache(tenantId).catch(() => {})
    return updated
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
