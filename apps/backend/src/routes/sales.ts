import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/prisma'

const saleItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  unitPrice: z.number().positive(),
})

const saleSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'CREDIT']).default('CASH'),
  notes: z.string().optional(),
  vatRate: z.number().default(0.18),
})

function generateRef(prefix: string) {
  return `${prefix}${Date.now().toString().slice(-6)}`
}

export async function salesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // POST /api/sales — Créer une vente (transaction atomique)
  app.post('/', async (req, reply) => {
    const { tenantId, userId } = req.user as any
    const { customerId, items, paymentMethod, notes, vatRate } = saleSchema.parse(req.body)

    const sale = await prisma.$transaction(async (tx) => {
      // Vérifier et décrémenter le stock
      for (const item of items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId, active: true }
        })
        if (!product) throw new Error(`Produit ${item.productId} introuvable`)
        if (product.stock < item.qty) throw new Error(`Stock insuffisant pour ${product.name}`)

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } }
        })
      }

      const totalHT = items.reduce((s, i) => s + i.unitPrice * i.qty, 0) / (1 + vatRate)
      const vatAmount = items.reduce((s, i) => s + i.unitPrice * i.qty, 0) - totalHT
      const totalTTC = totalHT + vatAmount

      return tx.sale.create({
        data: {
          tenantId, userId,
          customerId: customerId || null,
          reference: generateRef('V'),
          totalHT, vatAmount, totalTTC,
          paymentMethod: paymentMethod as any,
          notes,
          items: {
            create: items.map(i => ({
              productId: i.productId,
              qty: i.qty,
              unitPrice: i.unitPrice,
              totalPrice: i.unitPrice * i.qty,
            }))
          }
        },
        include: { items: { include: { product: true } } }
      })
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        tenantId, userId,
        module: 'sales', action: 'CREATE',
        description: `Vente ${sale.reference} — ${sale.totalTTC} créée`
      }
    })

    return reply.code(201).send(sale)
  })

  // GET /api/sales
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    const { from, to, page = 1, limit = 20 } = req.query as any

    return prisma.sale.findMany({
      where: {
        tenantId,
        ...(from || to ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          }
        } : {})
      },
      include: {
        user: { select: { name: true } },
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })
  })

  // GET /api/sales/:id
  app.get('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { name: true } },
        customer: true,
        items: { include: { product: true } }
      }
    })
    if (!sale) return reply.code(404).send({ error: 'Vente introuvable' })
    return sale
  })
}
