import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { authenticate } from '../middleware/authenticate'
import { getTenantId, getActiveTenantId } from '../lib/tenantId'
import { blockDemoTenant } from '../middleware/demoTenant'
import { costQuota } from '../middleware/costQuota'
import { analyzeInvoice, ALLOWED_INVOICE_TYPES } from '../services/invoiceOcr'
import { SpendDeniedError, isAnthropicConfigured } from '../lib/spend/anthropicClient'

// ── Schémas (item 6) — liste blanche STRICTE (strip) : ferme le mass-assignment
// (create/update faisaient `...body`/`data: body` dans Prisma → tenantId injectable). ──
const ID_PARAMS = z.object({ id: z.string().min(1) })
const SUPPLIER_FIELDS = {
  name:       z.string().optional(),
  categories: z.string().nullish(),
  phone:      z.string().nullish(),
  email:      z.string().nullish(),
  address:    z.string().nullish(),
  leadTime:   z.coerce.number().optional(),
  // ⚠️ `.nullable()` AVANT toute coercition, et jamais `z.coerce.number()` seul :
  // `Number(null)` vaut **0**, une note impossible (l'échelle est 1..5) qui se serait
  // affichée « 0/5 » — un jugement là où il n'y a pas d'évaluation. `ZodNullable`
  // intercepte `null` sans appeler le schéma interne.
  rating:     z.coerce.number().nullable().optional(),
  status:     z.string().optional(),
  notes:      z.string().nullish(),
}
const SUPPLIER_CREATE = z.object({ ...SUPPLIER_FIELDS, name: z.string().min(1) })
const SUPPLIER_UPDATE = z.object(SUPPLIER_FIELDS)

export async function supplierRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.supplier.findMany({ where: { tenantId, deletedAt: null } })
  })

  app.post('/api/suppliers', { preHandler: authenticate, schema: { body: SUPPLIER_CREATE } }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.supplier.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/suppliers/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: SUPPLIER_UPDATE } }, async (request) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    return prisma.supplier.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/suppliers/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { userId } = request.user
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    // Soft delete : la ligne reste (FK des commandes liées intacte) → plus de P2003/409
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } })
    await writeAudit('DELETE_SUPPLIER', prisma.auditLog.create({
      data: { tenantId, userId, module: 'suppliers', action: 'DELETE_SUPPLIER', description: JSON.stringify({ id, name: supplier.name }) },
    }))
    return reply.code(204).send()
  })

  // OCR facture fournisseur — extrait les articles via Claude Vision (MANAGER+)
  app.post('/api/suppliers/scan-invoice', { preHandler: [authenticate, blockDemoTenant, costQuota('ocr')] }, async (request, reply) => {
    const { role } = request.user
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return reply.code(403).send({ error: 'Manager ou admin requis' })
    }

    if (!isAnthropicConfigured()) {
      return reply.code(503).send({ error: 'Service OCR non configuré (ANTHROPIC_API_KEY manquante)' })
    }

    let file: any
    try {
      file = await request.file()
    } catch {
      return reply.code(400).send({ error: 'Fichier manquant' })
    }
    if (!file) return reply.code(400).send({ error: 'Fichier manquant' })

    if (!ALLOWED_INVOICE_TYPES.includes(file.mimetype)) {
      return reply.code(415).send({ error: 'Format non supporté. Utilisez JPEG, PNG ou PDF.' })
    }

    const buffer = await file.toBuffer()
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.code(413).send({ error: 'Fichier trop volumineux (max 10 Mo)' })
    }

    // Boutique ACTIVE (W2) — extraite AVANT le try : sa levée (théorique, route gardée)
    // doit rester un 500 franc, pas être transformée en 422 par le catch OCR.
    const tenantId = getActiveTenantId(request)
    try {
      const result = await analyzeInvoice(tenantId, buffer, file.mimetype)
      return result
    } catch (err: any) {
      // Refus de dépense (démo / essai échu / quota) → code explicite, pas un 422 opaque.
      if (err instanceof SpendDeniedError) {
        return reply.code(err.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({ error: err.message, code: err.code })
      }
      request.log.error({ err, step: 'invoiceOcr' }, 'Erreur OCR facture')
      return reply.code(422).send({ error: err?.message ?? 'Erreur lors de l\'analyse de la facture' })
    }
  })

  // Restaurer un fournisseur soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/suppliers/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    const restored = await prisma.supplier.update({ where: { id }, data: { deletedAt: null } })
    await writeAudit('RESTORE_SUPPLIER', prisma.auditLog.create({
      data: { tenantId, userId, module: 'suppliers', action: 'RESTORE_SUPPLIER', description: JSON.stringify({ id, name: supplier.name }) },
    }))
    return restored
  })

  // ─── HISTORIQUE DES COMMANDES (#214, miroir de GET /api/customers/:id/sales) ──────
  app.get('/api/suppliers/:id/orders', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    // Scope tenant STRICT sur le FOURNISSEUR d'abord : sans lui, un id d'un autre tenant
    // renverrait [] — indiscernable d'« aucune commande », donc un oracle silencieux.
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    const orders = await prisma.purchaseOrder.findMany({
      // `tenantId` REDONDANT avec le scope fournisseur ci-dessus, et c'est voulu (defense-in-depth).
      // ⚠️ `deletedAt: null` — DIFFÉRENCE avec l'historique client : PurchaseOrder est en SOFT
      // DELETE (cf. routes/orders.ts:28), une commande supprimée ne doit pas ressurgir ici.
      where: { supplierId: id, tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50, // même plafond que l'historique client
      select: {
        id: true, ref: true, total: true, status: true, createdAt: true, expectedAt: true,
        // Nombre de LIGNES, cohérent avec la colonne « Articles » du reste de l'app.
        _count: { select: { items: true } },
      },
    })
    return orders.map(o => ({
      id: o.id,
      ref: o.ref,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
      expectedAt: o.expectedAt,
      items: o._count.items,
    }))
  })
}
