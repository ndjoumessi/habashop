import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/prisma'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/kpis', async (req) => {
    const { tenantId } = req.user as any
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const prevMonthStart = startOfMonth(subMonths(now, 1))
    const prevMonthEnd = endOfMonth(subMonths(now, 1))

    const [currentSales, prevSales, totalProducts, lowStockCount, activeCustomers] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: monthStart, lte: monthEnd } },
        _sum: { totalTTC: true },
        _count: true,
        _avg: { totalTTC: true },
      }),
      prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { totalTTC: true },
        _count: true,
      }),
      prisma.product.count({ where: { tenantId, active: true } }),
      prisma.product.count({ where: { tenantId, active: true, stock: { lte: 5 } } }),
      prisma.customer.count({ where: { tenantId, active: true } }),
    ])

    const caCurrentMonth = currentSales._sum.totalTTC || 0
    const caPrevMonth = prevSales._sum.totalTTC || 0
    const caEvolution = caPrevMonth > 0 ? ((caCurrentMonth - caPrevMonth) / caPrevMonth) * 100 : 0

    return {
      ca: { value: caCurrentMonth, evolution: caEvolution },
      transactions: { value: currentSales._count, prevValue: prevSales._count },
      panierMoyen: { value: currentSales._avg.totalTTC || 0 },
      totalProducts,
      lowStockCount,
      activeCustomers,
    }
  })

  app.get('/recent-activity', async (req) => {
    const { tenantId } = req.user as any
    return prisma.auditLog.findMany({
      where: { tenantId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  })

  app.get('/sales-chart', async (req) => {
    const { tenantId } = req.user as any
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const result = await prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: startOfMonth(d), lte: endOfMonth(d) } },
        _sum: { totalTTC: true, vatAmount: true },
      })
      months.push({
        month: d.toLocaleString('fr', { month: 'short' }),
        ca: result._sum.totalTTC || 0,
        marge: (result._sum.totalTTC || 0) * 0.22, // approximation
      })
    }
    return months
  })
}
