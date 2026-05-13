import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/prisma'

const orderItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

const orderSchema = z.object({
  supplierId: z.string(),
  items: z.array(orderItemSchema).min(1),
  expectedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  vatRate: z.number().default(0.18),
})

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']),
})

function generateRef() {
  return `CMD${Date.now().toString().slice(-6)}`
}

export async function ordersRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /api/orders
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    const { status, supplierId, page = 1, limit = 20 } = req.query as any
    return prisma.order.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })
  })

  // GET /api/orders/:id
  app.get('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const order = await prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    })
    if (!order) return reply.code(404).send({ error: 'Commande introuvable' })
    return order
  })

  // POST /api/orders
  app.post('/', async (req, reply) => {
    const { tenantId } = req.user as any
    const { supplierId, items, expectedAt, notes, vatRate } = orderSchema.parse(req.body)

    const totalHT = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
    const totalTTC = totalHT * (1 + vatRate)

    const order = await prisma.order.create({
      data: {
        tenantId,
        supplierId,
        reference: generateRef(),
        status: 'DRAFT',
        totalHT,
        totalTTC,
        expectedAt: expectedAt ? new Date(expectedAt) : undefined,
        notes,
        items: {
          create: items.map(i => ({
            productId: i.productId,
            qty: i.qty,
            unitPrice: i.unitPrice,
            totalPrice: i.unitPrice * i.qty,
          })),
        },
      },
      include: {
        supplier: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    })

    await prisma.auditLog.create({
      data: {
        tenantId,
        module: 'orders',
        action: 'CREATE',
        description: `Commande ${order.reference} créée — fournisseur ${order.supplier.name}`,
      },
    })

    return reply.code(201).send(order)
  })

  // PUT /api/orders/:id/status
  app.put('/:id/status', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const { status } = statusSchema.parse(req.body)
    const count = await prisma.order.updateMany({ where: { id, tenantId }, data: { status } })
    if (count.count === 0) return reply.code(404).send({ error: 'Commande introuvable' })
    return prisma.order.findFirst({ where: { id, tenantId } })
  })

  // POST /api/orders/:id/receive — réceptionner une commande et incrémenter le stock
  app.post('/:id/receive', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })
    if (!order) return reply.code(404).send({ error: 'Commande introuvable' })
    if (order.status === 'RECEIVED') return reply.code(400).send({ error: 'Commande déjà réceptionnée' })

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.updateMany({
          where: { id: item.productId, tenantId },
          data: { stock: { increment: item.qty } },
        })
      }
      await tx.order.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      })
    })

    await prisma.auditLog.create({
      data: {
        tenantId,
        module: 'orders',
        action: 'RECEIVE',
        description: `Commande ${order.reference} réceptionnée`,
      },
    })

    return { success: true }
  })
}
