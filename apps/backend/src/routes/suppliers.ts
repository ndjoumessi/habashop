import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { analyzeInvoice, ALLOWED_INVOICE_TYPES } from '../services/invoiceOcr'

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
  rating:     z.coerce.number().optional(),
  status:     z.string().optional(),
  notes:      z.string().nullish(),
}
const SUPPLIER_CREATE = z.object({ ...SUPPLIER_FIELDS, name: z.string().min(1) })
const SUPPLIER_UPDATE = z.object(SUPPLIER_FIELDS)

export async function supplierRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.supplier.findMany({ where: { tenantId, deletedAt: null } })
  })

  app.post('/api/suppliers', { preHandler: authenticate, schema: { body: SUPPLIER_CREATE } }, async (request) => {
    const { tenantId } = request.user
    return prisma.supplier.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/suppliers/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: SUPPLIER_UPDATE } }, async (request) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    return prisma.supplier.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/suppliers/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as { id: string }
    // Soft delete : la ligne reste (FK des commandes liées intacte) → plus de P2003/409
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'suppliers', action: 'DELETE_SUPPLIER', description: JSON.stringify({ id, name: supplier.name }) },
    }).catch(() => {})
    return reply.code(204).send()
  })

  // OCR facture fournisseur — extrait les articles via Claude Vision (MANAGER+)
  app.post('/api/suppliers/scan-invoice', { preHandler: authenticate }, async (request, reply) => {
    const { role } = request.user
    if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return reply.code(403).send({ error: 'Manager ou admin requis' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
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

    try {
      const result = await analyzeInvoice(buffer, file.mimetype)
      return result
    } catch (err: any) {
      request.log.error({ err, step: 'invoiceOcr' }, 'Erreur OCR facture')
      return reply.code(422).send({ error: err?.message ?? 'Erreur lors de l\'analyse de la facture' })
    }
  })

  // Restaurer un fournisseur soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/suppliers/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const { id } = request.params as { id: string }
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    const restored = await prisma.supplier.update({ where: { id }, data: { deletedAt: null } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'suppliers', action: 'RESTORE_SUPPLIER', description: JSON.stringify({ id, name: supplier.name }) },
    }).catch(() => {})
    return restored
  })
}
