import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/prisma'

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(['RETAIL', 'WHOLESALE', 'SEMI_WHOLESALE']).default('RETAIL'),
  loyalty: z.number().int().min(0).default(0),
  balance: z.number().default(0),
})

export async function customersRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /api/customers
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    const { search, type } = req.query as any
    return prisma.customer.findMany({
      where: {
        tenantId,
        active: true,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
        ...(type ? { type } : {}),
      },
      include: {
        _count: { select: { sales: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // GET /api/customers/:id
  app.get('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: { include: { product: { select: { name: true } } } } },
        },
      },
    })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    return customer
  })

  // POST /api/customers
  app.post('/', async (req, reply) => {
    const { tenantId } = req.user as any
    const data = customerSchema.parse(req.body)
    const customer = await prisma.customer.create({ data: { ...data, tenantId } })
    return reply.code(201).send(customer)
  })

  // PUT /api/customers/:id
  app.put('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    const data = customerSchema.partial().parse(req.body)
    const count = await prisma.customer.updateMany({ where: { id, tenantId }, data })
    if (count.count === 0) return reply.code(404).send({ error: 'Client introuvable' })
    return prisma.customer.findFirst({ where: { id, tenantId } })
  })

  // DELETE /api/customers/:id (soft delete)
  app.delete('/:id', async (req, reply) => {
    const { tenantId } = req.user as any
    const { id } = req.params as any
    await prisma.customer.updateMany({ where: { id, tenantId }, data: { active: false } })
    return reply.code(204).send()
  })
}
