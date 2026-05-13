import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/prisma'

export async function ordersRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    return prisma.order.findMany({
      where: { tenantId },
      include: { supplier: { select: { name: true } }, items: true },
      orderBy: { createdAt: 'desc' }
    })
  })
}

export async function customersRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    return prisma.customer.findMany({ where: { tenantId, active: true }, orderBy: { name: 'asc' } })
  })
  app.post('/', async (req, reply) => {
    const { tenantId } = req.user as any
    const data = req.body as any
    return reply.code(201).send(await prisma.customer.create({ data: { ...data, tenantId } }))
  })
}

export async function suppliersRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)
  app.get('/', async (req) => {
    const { tenantId } = req.user as any
    return prisma.supplier.findMany({ where: { tenantId, active: true }, orderBy: { name: 'asc' } })
  })
  app.post('/', async (req, reply) => {
    const { tenantId } = req.user as any
    const data = req.body as any
    return reply.code(201).send(await prisma.supplier.create({ data: { ...data, tenantId } }))
  })
}

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)
  app.get('/sales', async (req) => {
    const { tenantId } = req.user as any
    const { from, to } = req.query as any
    return prisma.sale.findMany({
      where: {
        tenantId,
        ...(from && to ? { createdAt: { gte: new Date(from), lte: new Date(to) } } : {})
      },
      include: { items: { include: { product: { select: { name: true, category: true } } } } }
    })
  })
}
