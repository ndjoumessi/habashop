import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const prisma = new PrismaClient()

// ─── MIDDLEWARE AUTH ──────────────────
async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Non autorisé' })
  }
}

async function start() {
  const app = Fastify({ logger: true })

  // ─── PLUGINS ────────────────────────────
  await app.register(cors, {
    origin: ['http://localhost:5173', process.env.FRONTEND_URL ?? '*'],
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'habashop-secret-dev-2026',
  })

  // ─── HEALTH CHECK ─────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  }))

  // ════════════════════════════════════════
  // AUTH ROUTES
  // ════════════════════════════════════════

  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as any

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })

    if (!user.isActive) return reply.code(403).send({ error: 'Compte désactivé' })

    const token = app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '7d' }
    )

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shopName: tenant?.name ?? 'HabaShop',
      },
    }
  })

  app.post('/api/auth/register', async (request, reply) => {
    const { name, email, password, shopName, currency, country } = request.body as any

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Email déjà utilisé' })

    const passwordHash = await bcrypt.hash(password, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: shopName,
        currency: currency ?? 'XOF',
        country: country ?? 'SN',
        plan: 'starter',
      },
    })

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'ADMIN', tenantId: tenant.id },
    })

    const token = app.jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      { expiresIn: '7d' }
    )

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopName: tenant.name },
    }
  })

  app.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
    const { userId } = request.user as any
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    })
    if (!user) throw new Error('Utilisateur introuvable')
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopName: user.tenant?.name,
      currency: user.tenant?.currency,
    }
  })

  // ════════════════════════════════════════
  // PRODUCTS / STOCK ROUTES
  // ════════════════════════════════════════

  app.get('/api/products', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  })

  app.post('/api/products', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.product.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/products/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.product.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/products/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    await prisma.product.delete({ where: { id, tenantId } })
    return { success: true }
  })

  // ════════════════════════════════════════
  // SALES ROUTES
  // ════════════════════════════════════════

  app.get('/api/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { limit = 50, offset = 0 } = request.query as any
    return prisma.sale.findMany({
      where: { tenantId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    })
  })

  app.post('/api/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId, userId } = request.user as any
    const { items, paymentMode, total, discount } = request.body as any

    return prisma.$transaction(async (tx: any) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          cashierId: userId,
          total,
          paymentMode,
          discountAmount: discount?.amount ?? 0,
          discountType: discount?.type ?? null,
        },
      })

      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.price,
            total: item.price * item.qty,
          },
        })
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.qty } },
        })
      }

      return newSale
    })
  })

  // ════════════════════════════════════════
  // CUSTOMERS ROUTES
  // ════════════════════════════════════════

  app.get('/api/customers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  })

  app.post('/api/customers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.customer.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/customers/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.customer.update({ where: { id, tenantId }, data: request.body as any })
  })

  // ════════════════════════════════════════
  // SUPPLIERS ROUTES
  // ════════════════════════════════════════

  app.get('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.supplier.findMany({ where: { tenantId } })
  })

  app.post('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.supplier.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/suppliers/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.supplier.update({ where: { id, tenantId }, data: request.body as any })
  })

  // ════════════════════════════════════════
  // PURCHASE ORDERS ROUTES
  // ════════════════════════════════════════

  app.get('/api/orders', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { items: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/api/orders', { preHandler: authenticate }, async (request) => {
    const { tenantId, userId } = request.user as any
    const { supplierId, items, expectedAt, notes } = request.body as any

    const ref = `CMD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const total = (items as any[]).reduce((s: number, i: any) => s + i.qty * i.unitPrice, 0)

    return prisma.purchaseOrder.create({
      data: {
        ref, tenantId, supplierId,
        createdById: userId,
        total, expectedAt, notes,
        status: 'DRAFT',
        items: {
          create: (items as any[]).map((i: any) => ({
            productName: i.product,
            qty: i.qty,
            unitPrice: i.unitPrice,
            total: i.qty * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    })
  })

  app.patch('/api/orders/:id/status', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    const { status } = request.body as any
    return prisma.purchaseOrder.update({ where: { id, tenantId }, data: { status } })
  })

  // ════════════════════════════════════════
  // EMPLOYEES / HR ROUTES
  // ════════════════════════════════════════

  app.get('/api/employees', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.employee.findMany({ where: { tenantId } })
  })

  app.post('/api/employees', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.employee.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/employees/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.employee.update({ where: { id, tenantId }, data: request.body as any })
  })

  // ════════════════════════════════════════
  // EXPENSES ROUTES
  // ════════════════════════════════════════

  app.get('/api/expenses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } })
  })

  app.post('/api/expenses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.expense.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/expenses/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.expense.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/expenses/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    await prisma.expense.delete({ where: { id, tenantId } })
    return { success: true }
  })

  // ════════════════════════════════════════
  // DASHBOARD / REPORTS ROUTES
  // ════════════════════════════════════════

  app.get('/api/dashboard/stats', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [salesToday, salesMonth, totalProducts, activeEmployees, pendingOrders, allProducts] =
      await Promise.all([
        prisma.sale.aggregate({
          where: { tenantId, createdAt: { gte: today } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.sale.aggregate({
          where: { tenantId, createdAt: { gte: monthStart } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.product.count({ where: { tenantId, isActive: true } }),
        prisma.employee.count({ where: { tenantId, isActive: true } }),
        prisma.purchaseOrder.count({ where: { tenantId, status: 'SENT' } }),
        prisma.product.findMany({
          where: { tenantId, isActive: true },
          select: { stockQty: true, stockMin: true },
        }),
      ])

    const lowStockProducts = allProducts.filter((p: { stockQty: number; stockMin: number }) => p.stockQty <= p.stockMin).length

    return {
      salesToday: salesToday._sum.total ?? 0,
      transactionsToday: salesToday._count,
      salesMonth: salesMonth._sum.total ?? 0,
      transactionsMonth: salesMonth._count,
      totalProducts,
      lowStockProducts,
      activeEmployees,
      pendingOrders,
    }
  })

  app.get('/api/reports/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { period = '7days' } = request.query as any

    const now = new Date()
    const from = new Date()
    if (period === 'today') from.setHours(0, 0, 0, 0)
    else if (period === '7days') from.setDate(now.getDate() - 7)
    else if (period === '30days') from.setDate(now.getDate() - 30)
    else if (period === '3months') from.setMonth(now.getMonth() - 3)
    else from.setFullYear(now.getFullYear(), 0, 1)

    const sales = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: from } },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const total = sales.reduce((s: number, sale: any) => s + sale.total, 0)
    const byPayment = sales.reduce((acc: Record<string, number>, sale: any) => {
      acc[sale.paymentMode] = (acc[sale.paymentMode] ?? 0) + sale.total
      return acc
    }, {} as Record<string, number>)

    return { total, count: sales.length, byPayment, sales }
  })

  // ─── DÉMARRAGE ────────────────────────
  try {
    await prisma.$connect()
    await app.listen({
      port: Number(process.env.PORT ?? 3001),
      host: '0.0.0.0',
    })
    console.log('🚀 HabaShop API démarrée sur le port', process.env.PORT ?? 3001)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
