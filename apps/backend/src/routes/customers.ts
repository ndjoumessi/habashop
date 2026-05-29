import type { FastifyInstance } from 'fastify'
import type { CustomerBody, CustomerPaymentBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'
import { invalidateTenantCache } from '../lib/cache'

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
          ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit } : {}),
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
    const { id } = request.params as { id: string }
    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
      const points = (customer as any).loyaltyPoints ?? 0
      const tier = points >= 5000 ? 'Gold' : points >= 2000 ? 'Silver' : 'Bronze'
      return { points, tier, history: [] }
    } catch {
      return { points: 0, tier: 'Bronze', history: [] }
    }
  })

  app.post('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { points } = request.body as { points: number; reason: string }
    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
      const current = (customer as any).loyaltyPoints ?? 0
      const updated = await prisma.customer.update({
        where: { id },
        data: { loyaltyPoints: current + points } as any,
      })
      return { points: (updated as any).loyaltyPoints ?? current + points }
    } catch {
      return { points: points }
    }
  })

  // ─── DETAIL CLIENT ────────────────────
  app.get('/api/customers/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const [nbSales, nbPayments, lastSale] = await Promise.all([
      prisma.sale.count({ where: { tenantId, customerId: id } }),
      prisma.customerPayment.count({ where: { tenantId, customerId: id } }),
      prisma.sale.findFirst({ where: { tenantId, customerId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ])
    return { ...customer, stats: { nbSales, nbPayments, lastSaleAt: lastSale?.createdAt ?? null } }
  })

  // ─── TIMELINE TRANSACTIONS ────────────
  app.get('/api/customers/:id/transactions', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as { id: string }
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }

    const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })

    const [sales, payments] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, customerId: id },
        orderBy: { createdAt: 'desc' },
        take: Number(limit) + Number(offset),
        include: { items: { include: { product: true } } },
      }),
      prisma.customerPayment.findMany({
        where: { tenantId, customerId: id },
        orderBy: { createdAt: 'desc' },
        take: Number(limit) + Number(offset),
      }),
    ])

    const unified = [
      ...sales.map((s) => ({
        type: 'sale' as const,
        id: s.id,
        date: s.createdAt,
        amount: s.total,
        amountPaid: s.amountPaid,
        due: s.total - s.amountPaid,
        paymentStatus: s.paymentStatus,
        paymentMode: s.paymentMode,
        items: s.items.map((it) => ({ name: it.product?.name, qty: it.qty, total: it.total })),
      })),
      ...payments.map((p) => ({
        type: 'payment' as const,
        id: p.id,
        date: p.createdAt,
        amount: p.amount,
        paymentMode: p.paymentMode,
        saleId: p.saleId,
        note: p.note,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(Number(offset), Number(offset) + Number(limit))

    return unified
  })

  // ─── ENREGISTRER UN PAIEMENT ──────────
  app.post('/api/customers/:id/payments', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { id } = request.params as { id: string }
    const { amount, paymentMode, saleId, note } = request.body as CustomerPaymentBody

    if (amount == null || amount <= 0) {
      return reply.code(400).send({ error: 'Montant invalide' })
    }
    if (!paymentMode) {
      return reply.code(400).send({ error: 'Mode de paiement requis' })
    }

    const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })

    if (saleId) {
      const sale = await prisma.sale.findFirst({ where: { id: saleId, tenantId, customerId: id } })
      if (!sale) return reply.code(404).send({ error: 'Vente introuvable ou ne correspond pas à ce client' })
    }

    const payment = await prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.create({
        data: {
          tenantId,
          customerId: id,
          amount,
          paymentMode,
          saleId: saleId ?? null,
          note: note ?? null,
          recordedBy: userId,
        },
      })
      await tx.customer.update({
        where: { id },
        data: { creditBalance: { decrement: amount } },
      })
      // Si paiement ciblé sur une vente, on ajuste amountPaid + paymentStatus de cette vente
      if (saleId) {
        const sale = await tx.sale.findUnique({ where: { id: saleId } })
        if (sale) {
          const newPaid = Math.min(sale.total, sale.amountPaid + amount)
          const newStatus = newPaid >= sale.total ? 'paid' : newPaid > 0 ? 'partial' : sale.paymentStatus
          await tx.sale.update({ where: { id: saleId }, data: { amountPaid: newPaid, paymentStatus: newStatus } })
        }
      }
      return payment
    })

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'customers',
        action: 'CUSTOMER_PAYMENT',
        description: JSON.stringify({ paymentId: payment.id, customerId: id, customerName: customer.name, amount, paymentMode, saleId: saleId ?? null }),
      },
    }).catch(() => {})

    invalidateTenantCache(tenantId).catch(() => {})
    notifyTenant(tenantId, { type: 'customer_payment', data: { customerId: id, amount, paymentMode } })

    return payment
  })
}
