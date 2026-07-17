import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { invalidateTenantCache } from '../lib/cache'
import { sendTransferConfirmed, sendTransferCancelled } from '../services/pushService'
import { ID_PARAMS, TRANSFER_CREATE } from '../schemas/writesB'

const MANAGER_ROLES = ['MANAGER', 'ADMIN', 'SUPER_ADMIN']
const isManagerPlus = (role: unknown) => typeof role === 'string' && MANAGER_ROLES.includes(role.toUpperCase())

// Garde MANAGER+ (renvoie true si autorisé, sinon envoie 403 et renvoie false).
function requireManager(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!isManagerPlus(request.user?.role)) {
    reply.code(403).send({ error: 'Accès réservé aux gérants et administrateurs' })
    return false
  }
  return true
}

// L'user courant a-t-il accès à ce tenant via UserTenant ?
async function userHasTenant(userId: string, tenantId: string): Promise<boolean> {
  const link = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true },
  })
  return !!link
}

export async function stockTransferRoutes(app: FastifyInstance): Promise<void> {

  // ── 2.1 Créer un transfert (boutique SOURCE) ──────────────────────────────────
  app.post('/api/stock/transfers', { preHandler: authenticate, schema: { body: TRANSFER_CREATE } }, async (request, reply) => {
    if (!requireManager(request, reply)) return
    const fromTenantId = request.tenantId as string
    const { userId } = request.user
    const { toTenantId, productId, quantity, note } = (request.body ?? {}) as { toTenantId?: string; productId?: string; quantity?: number; note?: string }

    if (!toTenantId || !productId) return reply.code(400).send({ error: 'toTenantId et productId requis' })
    if (toTenantId === fromTenantId) return reply.code(400).send({ error: 'Transfert vers la même boutique impossible' })
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) return reply.code(400).send({ error: 'Quantité invalide' })

    // L'user doit avoir accès aux DEUX boutiques (source = active, destination = cible).
    if (!(await userHasTenant(userId, toTenantId))) {
      return reply.code(403).send({ error: 'Accès refusé à la boutique destination' })
    }

    // Produit appartenant à la boutique source.
    const product = await prisma.product.findFirst({ where: { id: productId, tenantId: fromTenantId, deletedAt: null } })
    if (!product) return reply.code(404).send({ error: 'Produit introuvable dans la boutique source' })
    if (product.stockQty < qty) {
      return reply.code(400).send({ error: `Stock insuffisant — disponible : ${product.stockQty}, demandé : ${qty}`, code: 'INSUFFICIENT_STOCK', available: product.stockQty })
    }

    // Transaction atomique : créer le transfert (pending) + réserver le stock source.
    const transfer = await prisma.$transaction(async (tx) => {
      // Décrément gardé : évite la survente en cas de concurrence.
      const dec = await tx.product.updateMany({
        where: { id: productId, tenantId: fromTenantId, stockQty: { gte: qty } },
        data: { stockQty: { decrement: qty } },
      })
      if (dec.count === 0) throw Object.assign(new Error('INSUFFICIENT_STOCK'), { code: 'INSUFFICIENT_STOCK' })
      return tx.stockTransfer.create({
        data: { fromTenantId, toTenantId, productId, quantity: qty, note: note?.trim() || null, createdBy: userId, status: 'pending' },
      })
    }).catch((e: any) => {
      if (e?.code === 'INSUFFICIENT_STOCK') return null
      throw e
    })
    if (!transfer) return reply.code(400).send({ error: 'Stock insuffisant', code: 'INSUFFICIENT_STOCK' })

    invalidateTenantCache(fromTenantId).catch(() => {})
    return reply.code(201).send(transfer)
  })

  // ── 2.2 Lister les transferts (source OU destination = boutique active) ────────
  app.get('/api/stock/transfers', { preHandler: authenticate }, async (request, reply) => {
    if (!requireManager(request, reply)) return
    const tenantId = request.tenantId as string
    const { status } = request.query as { status?: string }

    const where: any = { OR: [{ fromTenantId: tenantId }, { toTenantId: tenantId }] }
    if (status && ['pending', 'completed', 'cancelled'].includes(status)) where.status = status

    return prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product:    { select: { id: true, name: true, sku: true, emoji: true } },
        fromTenant: { select: { id: true, name: true } },
        toTenant:   { select: { id: true, name: true } },
      },
    })
  })

  // ── 2.3 Confirmer la réception (boutique DESTINATION) ──────────────────────────
  app.patch('/api/stock/transfers/:id/confirm', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    if (!requireManager(request, reply)) return
    const tenantId = request.tenantId as string
    const { userId } = request.user
    const { id } = request.params as { id: string }

    // Item 8-B : plus de findUnique par id nu — le fetch est scopé aux 2 parties
    // (source OU destination) dès la requête. Un tiers ne récupère RIEN.
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, OR: [{ fromTenantId: tenantId }, { toTenantId: tenantId }] },
      include: { product: true },
    })
    // W1 — scope tenant AVANT toute divulgation : un tiers (ni source ni destination)
    // reçoit un 404 uniforme, identique à « n'existe pas ». On ne révèle jamais l'existence
    // ni le statut d'un transfert d'autrui (pas d'oracle 403 vs 400 vs 404).
    // Le statut (400 « déjà traité ») et le rôle (403 « destination seule ») ne sont exposés
    // qu'aux deux boutiques réellement parties au transfert. La vérif manuelle ci-dessous
    // est désormais redondante avec le findFirst scopé — conservée (ceinture-bretelles, Q3).
    if (!transfer || (transfer.fromTenantId !== tenantId && transfer.toTenantId !== tenantId)) {
      return reply.code(404).send({ error: 'Transfert introuvable' })
    }
    if (transfer.status !== 'pending') return reply.code(400).send({ error: 'Transfert déjà traité' })
    if (transfer.toTenantId !== tenantId) return reply.code(403).send({ error: 'Seule la boutique destination peut confirmer' })

    const src = transfer.product

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({ where: { id }, data: { status: 'completed', confirmedBy: userId } })

      // Produit destination : SKU → code-barres → création (copie source).
      let dest = await tx.product.findFirst({ where: { tenantId, sku: src.sku } })
      if (!dest && src.barcode) {
        dest = await tx.product.findFirst({ where: { tenantId, barcode: src.barcode, deletedAt: null } })
      }
      if (dest) {
        // Incrément ; restaure le produit s'il était soft-deleted/inactif.
        await tx.product.update({
          where: { id: dest.id },
          data: { stockQty: { increment: transfer.quantity }, deletedAt: null, isActive: true },
        })
      } else {
        await tx.product.create({
          data: {
            tenantId,
            sku: src.sku,
            name: src.name,
            category: src.category,
            unit: src.unit,
            buyPrice: src.buyPrice,
            sellPrice: src.sellPrice,
            wholesalePrice: src.wholesalePrice,
            semiWholesalePrice: src.semiWholesalePrice,
            stockQty: transfer.quantity,
            stockMin: src.stockMin,
            barcode: src.barcode,
            taxRate: src.taxRate,
            emoji: src.emoji,
            description: src.description,
            isActive: true,
          },
        })
      }
    })

    invalidateTenantCache(tenantId).catch(() => {})
    // Push vers la boutique source (fire-and-forget).
    const destTenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    void sendTransferConfirmed(transfer.fromTenantId, destTenant?.name ?? 'La boutique', src.name, transfer.quantity)

    return { id, status: 'completed' }
  })

  // ── 2.4 Annuler (boutique SOURCE ou DESTINATION) — restitue le stock source ────
  app.patch('/api/stock/transfers/:id/cancel', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    if (!requireManager(request, reply)) return
    const tenantId = request.tenantId as string
    const { id } = request.params as { id: string }

    // Item 8-B : fetch scopé aux 2 parties dès la requête (cf. /confirm).
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, OR: [{ fromTenantId: tenantId }, { toTenantId: tenantId }] },
      include: { product: { select: { name: true } } },
    })
    // W1 — même garde uniforme que pour /confirm : un tiers (ni source ni destination)
    // reçoit un 404 identique à « n'existe pas », sans oracle d'existence/statut.
    // Vérif manuelle redondante avec le findFirst scopé — conservée (ceinture-bretelles).
    if (!transfer || (transfer.fromTenantId !== tenantId && transfer.toTenantId !== tenantId)) {
      return reply.code(404).send({ error: 'Transfert introuvable' })
    }
    if (transfer.status !== 'pending') return reply.code(400).send({ error: 'Transfert déjà traité' })

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({ where: { id }, data: { status: 'cancelled' } })
      // Restitution du stock réservé à la boutique source.
      await tx.product.update({ where: { id: transfer.productId }, data: { stockQty: { increment: transfer.quantity } } })
    })

    invalidateTenantCache(transfer.fromTenantId).catch(() => {})
    // Push vers les 2 boutiques (fire-and-forget).
    const cancellerTenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    const byName = cancellerTenant?.name ?? 'Une boutique'
    void sendTransferCancelled(transfer.fromTenantId, byName, transfer.product.name)
    void sendTransferCancelled(transfer.toTenantId, byName, transfer.product.name)

    return { id, status: 'cancelled' }
  })
}
