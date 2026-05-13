import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/prisma'

const supplierSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  rating: z.number().int().min(1).max(5).default(3),
})

export async function suppliersRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /api/suppliers
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    const { search, country } = req.query as any
    return prisma.supplier.findMany({
      where: {
        tenantId,
        active: true,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(country ? { country } : {}),
      },
      include: {
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // GET /api/suppliers/:id
  app.get('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        products: { where: { active: true }, select: { id: true, name: true, sku: true, stock: true } },
        orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!supplier) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    return supplier
  })

  // POST /api/suppliers
  app.post('/', async (req, reply) => {
    const { tenantId } = req.user as any
    const data = supplierSchema.parse(req.body)
    const supplier = await prisma.supplier.create({ data: { ...data, tenantId } })
    return reply.code(201).send(supplier)
  })

  // PUT /api/suppliers/:id
  app.put('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const data = supplierSchema.partial().parse(req.body)
    const count = await prisma.supplier.updateMany({ where: { id, tenantId }, data })
    if (count.count === 0) return reply.code(404).send({ error: 'Fournisseur introuvable' })
    return prisma.supplier.findFirst({ where: { id, tenantId } })
  })

  // DELETE /api/suppliers/:id (soft delete)
  app.delete('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    await prisma.supplier.updateMany({ where: { id, tenantId }, data: { active: false } })
    return reply.code(204).send()
  })
}
