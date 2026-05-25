import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard/stats', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
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
        prisma.product.count({ where: { tenantId, isActive: true, deletedAt: null } }),
        prisma.employee.count({ where: { tenantId, isActive: true } }),
        prisma.purchaseOrder.count({ where: { tenantId, status: 'SENT' } }),
        prisma.product.findMany({
          where: { tenantId, isActive: true, deletedAt: null },
          select: { stockQty: true, stockMin: true },
        }),
      ])

    const lowStockProducts = allProducts.filter((p: { stockQty: number; stockMin: number }) => p.stockQty <= p.stockMin).length

    // Données détaillées du dashboard (réelles, scopées au tenant)
    const [topProductsRaw, stockAlertsRaw, recentActivity, categoryItems] = await Promise.all([
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { tenantId, createdAt: { gte: monthStart } } },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }).catch(() => [] as { productId: string; _sum: { total: number | null } }[]),
      prisma.product.findMany({
        where: { tenantId, isActive: true, deletedAt: null, stockQty: { lte: prisma.product.fields.stockMin } },
        select: { name: true, stockQty: true, stockMin: true },
        orderBy: { stockQty: 'asc' },
        take: 5,
      }).catch(() => []),
      prisma.sale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, total: true, paymentMode: true, createdAt: true },
      }).catch(() => []),
      prisma.saleItem.findMany({
        where: { sale: { tenantId, createdAt: { gte: monthStart } } },
        select: { total: true, product: { select: { category: true } } },
      }).catch(() => []),
    ])

    const topProducts = await Promise.all(topProductsRaw.map(async (it) => {
      const p = await prisma.product.findUnique({ where: { id: it.productId }, select: { name: true } }).catch(() => null)
      return { name: p?.name ?? 'Produit supprimé', ca: it._sum.total ?? 0 }
    }))

    const catMap: Record<string, number> = {}
    for (const i of categoryItems) {
      const c = i.product?.category ?? 'Autre'
      catMap[c] = (catMap[c] ?? 0) + (i.total ?? 0)
    }
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    return {
      salesToday: salesToday._sum.total ?? 0,
      transactionsToday: salesToday._count,
      salesMonth: salesMonth._sum.total ?? 0,
      transactionsMonth: salesMonth._count,
      totalProducts,
      lowStockProducts,
      activeEmployees,
      pendingOrders,
      topProducts,
      stockAlerts: stockAlertsRaw,
      recentActivity,
      categoryBreakdown,
    }
  })

  app.get('/api/reports/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    const { period = '7days' } = request.query as { period?: string }

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

    const total = sales.reduce((s: number, sale) => s + sale.total, 0)
    const byPayment = sales.reduce((acc: Record<string, number>, sale) => {
      acc[sale.paymentMode] = (acc[sale.paymentMode] ?? 0) + sale.total
      return acc
    }, {} as Record<string, number>)

    return { total, count: sales.length, byPayment, sales }
  })

  app.get('/api/analytics/summary', { preHandler: [authenticate] }, async (request, reply) => {
    const tenantId = request.tenantId
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const [salesDay, salesMonth, customers, products] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId, createdAt: { gte: today } }, _sum: { total: true }, _count: { id: true } }),
      prisma.sale.aggregate({ where: { tenantId, createdAt: { gte: thisMonth } }, _sum: { total: true }, _count: { id: true } }),
      prisma.customer.count({ where: { tenantId, deletedAt: null } }),
      prisma.product.count({ where: { tenantId, isActive: true, deletedAt: null } }),
    ])
    return {
      caToday:  salesDay._sum.total   ?? 0,
      txToday:  salesDay._count.id    ?? 0,
      caMonth:  salesMonth._sum.total ?? 0,
      txMonth:  salesMonth._count.id  ?? 0,
      customers, products,
    }
  })

  app.get('/api/analytics', { preHandler: [authenticate] }, async (request, reply) => {
    const tenantId = request.tenantId
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const last30d = new Date(now.getTime() - 30*24*60*60*1000)
    const [salesDay, salesMonth, customers, products, salesByDay, salesByPayment] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId, createdAt: { gte: today } }, _sum: { total: true }, _count: { id: true } }),
      prisma.sale.aggregate({ where: { tenantId, createdAt: { gte: thisMonth } }, _sum: { total: true }, _count: { id: true } }),
      prisma.customer.count({ where: { tenantId, deletedAt: null } }),
      prisma.product.count({ where: { tenantId, isActive: true, deletedAt: null } }),
      prisma.sale.findMany({ where: { tenantId, createdAt: { gte: last30d } }, select: { createdAt: true, total: true }, orderBy: { createdAt: 'asc' } }),
      prisma.sale.groupBy({ by: ['paymentMode'], where: { tenantId, createdAt: { gte: thisMonth } }, _sum: { total: true }, _count: { id: true } }),
    ])
    const dayMap = new Map<string, { ca: number; count: number }>()
    salesByDay.forEach((s) => {
      const day = new Date(s.createdAt).toISOString().slice(0, 10)
      const curr = dayMap.get(day) ?? { ca: 0, count: 0 }
      dayMap.set(day, { ca: curr.ca + s.total, count: curr.count + 1 })
    })
    const salesChartData = Array.from(dayMap.entries()).map(([day, v]) => ({
      day: new Date(day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      ca: v.ca, count: v.count,
    }))
    return {
      kpis: {
        caToday: salesDay._sum.total ?? 0,
        txToday: salesDay._count.id ?? 0,
        caMonth: salesMonth._sum.total ?? 0,
        txMonth: salesMonth._count.id ?? 0,
        avgBasket: (salesMonth._count.id ?? 0) > 0 ? Math.round((salesMonth._sum.total ?? 0) / (salesMonth._count.id ?? 1)) : 0,
        customers, products,
      },
      charts: {
        salesByDay: salesChartData,
        salesByPayment: salesByPayment.map((p) => ({ mode: p.paymentMode ?? 'Autre', total: p._sum.total ?? 0, count: p._count.id ?? 0 })),
      },
      generatedAt: new Date().toISOString(),
    }
  })
}
