import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/prisma'

const productSchema = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  unit: z.string().default('unité'),
  priceBuy: z.number().positive(),
  priceSell: z.number().positive(),
  stock: z.number().int().min(0).default(0),
  threshold: z.number().int().min(0).default(5),
  supplierId: z.string().optional(),
})

export async function productsRoutes(app: FastifyInstance) {
  // Middleware auth
  app.addHook('onRequest', app.authenticate)

  // GET /api/products
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    const { search, category, lowStock } = req.query as any

    const products = await prisma.product.findMany({
      where: {
        tenantId,
        active: true,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(category ? { category } : {}),
        ...(lowStock === 'true' ? { stock: { lte: prisma.product.fields.threshold } } : {}),
      },
      include: { supplier: { select: { name: true } } },
      orderBy: { name: 'asc' }
    })
    return products
  })

  // GET /api/products/:id
  app.get('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const product = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!product) return reply.code(404).send({ error: 'Produit introuvable' })
    return product
  })

  // POST /api/products
  app.post('/', async (req, reply) => {
    const { tenantId } = req.user as any
    const data = productSchema.parse(req.body)
    const product = await prisma.product.create({ data: { ...data, tenantId } })
    return reply.code(201).send(product)
  })

  // PUT /api/products/:id
  app.put('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const data = productSchema.partial().parse(req.body)
    const product = await prisma.product.updateMany({ where: { id, tenantId }, data })
    return product
  })

  // DELETE /api/products/:id (soft delete)
  app.delete('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    await prisma.product.updateMany({ where: { id, tenantId }, data: { active: false } })
    return reply.code(204).send()
  })

  // GET /api/products/search — pour le POS
  app.get('/search', async (req) => {
    const { tenantId } = req.user as any
    const { q } = req.query as any
    return prisma.product.findMany({
      where: {
        tenantId, active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ]
      },
      take: 20
    })
  })
}
