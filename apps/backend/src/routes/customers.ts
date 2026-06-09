import type { FastifyInstance } from 'fastify'
import type { CustomerBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'
import { tierForPoints } from '../lib/loyalty'

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/customers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    try {
      return await prisma.customer.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
    } catch (err) {
      console.error('Get customers error:', err)
      return []
    }
  })

  app.post('/api/customers', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const {
      name, type, phone, email, address,
      loyaltyPoints, totalRevenue,
    } = request.body as CustomerBody

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Le nom est requis' })
    }

    try {
      const customer = await prisma.customer.create({
        data: {
          tenantId,
          name:          name?.trim() ?? '',
          type:          type          ?? 'retail',
          phone:         phone         ?? '',
          email:         email         ?? '',
          address:       address       ?? '',
          loyaltyPoints: loyaltyPoints ?? 0,
          totalRevenue:  totalRevenue  ?? 0,
        }
      })
      notifyTenant(tenantId, { type: 'new_customer', data: { id: customer.id, name: customer.name } })
      return customer
    } catch (err) {
      console.error('Create customer error:', err)
      return reply.code(500).send({
        error: 'Erreur création client',
        details: err.message,
      })
    }
  })

  app.put('/api/customers/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    const data = request.body as CustomerBody
    try {
      return await prisma.customer.update({
        where: { id, tenantId },
        data: {
          name: data.name,
          type: data.type,
          phone: data.phone,
          email: data.email,
          address: data.address,
        }
      })
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  app.delete('/api/customers/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'customers', action: 'DELETE_CUSTOMER', description: JSON.stringify({ id, name: customer.name }) },
    }).catch(() => {})
    return reply.code(204).send()
  })

  // Restaurer un client soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/customers/:id/restore', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const restored = await prisma.customer.update({ where: { id }, data: { deletedAt: null } })
    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'customers', action: 'RESTORE_CUSTOMER', description: JSON.stringify({ id, name: customer.name }) },
    }).catch(() => {})
    return restored
  })

  // ─── LOYALTY ──────────────────────────
  app.get('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    // Scope tenant STRICT (fini le findUnique global = faille d'isolation).
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const points = customer.loyaltyPoints ?? 0
    // Seuils de palier CONFIGURABLES par tenant (pour le calcul + l'affichage front).
    const cfg = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        pointsPerAmount: true, bronzeThreshold: true, silverThreshold: true,
        bronzeDiscount: true, silverDiscount: true, goldDiscount: true,
        enableLoyalty: true, name: true, currency: true,
      },
    })
    const bronzeThreshold = cfg?.bronzeThreshold ?? 2000
    const silverThreshold = cfg?.silverThreshold ?? 5000
    const history = await prisma.loyaltyTransaction.findMany({
      where: { customerId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, points: true, type: true, reason: true, saleId: true, createdAt: true },
    }).catch(() => [])
    const tier = tierForPoints(points, bronzeThreshold, silverThreshold)
    return {
      points,
      tier,
      history,
      // Renvoyés pour que le front/mobile affiche progression/seuils/remises avec les valeurs du tenant.
      pointsPerAmount: cfg?.pointsPerAmount ?? 1000,
      bronzeThreshold,
      silverThreshold,
      // Loyalty v2 : remises par palier (0 = désactivé / non configuré).
      bronzeDiscount: cfg?.bronzeDiscount ?? 0,
      silverDiscount: cfg?.silverDiscount ?? 0,
      goldDiscount:   cfg?.goldDiscount   ?? 0,
    }
  })

  // ── Carte fidélité numérique (scope tenant strict, tout rôle authentifié) ──
  app.get('/api/customers/:id/loyalty-card', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true, name: true, loyaltyPoints: true, totalRevenue: true } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const cfg = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true, currency: true, enableLoyalty: true, bronzeThreshold: true, silverThreshold: true,
        pointsPerAmount: true, bronzeDiscount: true, silverDiscount: true, goldDiscount: true,
      },
    })
    const points = customer.loyaltyPoints ?? 0
    const bronzeThreshold = cfg?.bronzeThreshold ?? 2000
    const silverThreshold = cfg?.silverThreshold ?? 5000
    const tier = tierForPoints(points, bronzeThreshold, silverThreshold)
    const nextTier = tier === 'Gold' ? null : tier === 'Silver' ? 'Gold' : 'Silver'
    const nextThreshold = tier === 'Bronze' ? bronzeThreshold : tier === 'Silver' ? silverThreshold : null
    return {
      customerId: customer.id,
      customerName: customer.name,
      tier,
      points,
      bronzeThreshold,
      silverThreshold,
      nextTier,
      pointsToNext: nextThreshold ? Math.max(0, nextThreshold - points) : 0,
      shopName: cfg?.name ?? 'HabaShop',
      currency: cfg?.currency ?? 'XOF',
      enableLoyalty: !!cfg?.enableLoyalty,
      // totalRevenue = base XOF (convertir côté client) ; pointsPerAmount = devise tenant (PAS de conversion).
      totalRevenue: customer.totalRevenue ?? 0,
      pointsPerAmount: cfg?.pointsPerAmount ?? 1000,
      bronzeDiscount: cfg?.bronzeDiscount ?? 5,
      silverDiscount: cfg?.silverDiscount ?? 10,
      goldDiscount: cfg?.goldDiscount ?? 15,
    }
  })

  app.post('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    const { points, reason } = request.body as { points: number; reason?: string }
    if (typeof points !== 'number' || !Number.isFinite(points) || points === 0) {
      return reply.code(400).send({ error: 'points doit être un entier non nul' })
    }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    // Ajustement manuel : mute le solde + trace dans l'historique (même source de vérité).
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.customer.update({ where: { id }, data: { loyaltyPoints: { increment: points } } })
      await tx.loyaltyTransaction.create({
        data: { tenantId, customerId: id, points, type: points >= 0 ? 'earn' : 'reverse', reason: reason ?? 'manual' },
      })
      return u
    })
    return { points: updated.loyaltyPoints, tier: tierForPoints(updated.loyaltyPoints) }
  })
}
