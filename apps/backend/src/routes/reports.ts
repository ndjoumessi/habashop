import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/prisma'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths, startOfWeek, endOfWeek } from 'date-fns'

function periodRange(period: string): { from: Date; to: Date } {
  const now = new Date()
  switch (period) {
    case 'today':   return { from: startOfDay(now), to: endOfDay(now) }
    case 'week':    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'month':   return { from: startOfMonth(now), to: endOfMonth(now) }
    case '3months': return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) }
    default:        return { from: startOfMonth(now), to: endOfMonth(now) }
  }
}

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // GET /api/reports/summary?period=month|week|today|3months
  app.get('/summary', async (req) => {
    const { tenantId } = req.user as any
    const { period = 'month', from, to } = req.query as any

    const range = from && to
      ? { from: new Date(from), to: new Date(to) }
      : periodRange(period)

    const [current, sales] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
        _sum: { totalTTC: true, totalHT: true, vatAmount: true },
        _count: true,
        _avg: { totalTTC: true },
      }),
      prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
        include: { items: { include: { product: { select: { priceBuy: true } } } } },
      }),
    ])

    const ca = current._sum.totalTTC || 0
    const transactions = current._count
    const panierMoyen = current._avg.totalTTC || 0
    const costTotal = sales.reduce(
      (s, sale) => s + sale.items.reduce((ss, i) => ss + i.product.priceBuy * i.qty, 0),
      0
    )
    const margeGrosseTTC = ca - costTotal
    const tauxMarge = ca > 0 ? (margeGrosseTTC / ca) * 100 : 0

    return { period: range, ca, transactions, panierMoyen, margeGrosseTTC, tauxMarge }
  })

  // GET /api/reports/top-products?period=month&limit=10
  app.get('/top-products', async (req) => {
    const { tenantId } = req.user as any
    const { period = 'month', limit = 10 } = req.query as any
    const range = periodRange(period)

    const items = await prisma.saleItem.findMany({
      where: {
        sale: { tenantId, createdAt: { gte: range.from, lte: range.to } },
      },
      include: { product: { select: { name: true, category: true, sku: true } } },
    })

    const grouped: Record<string, { name: string; category: string; sku: string; qty: number; ca: number }> = {}
    for (const item of items) {
      const key = item.productId
      if (!grouped[key]) {
        grouped[key] = { name: item.product.name, category: item.product.category, sku: item.product.sku, qty: 0, ca: 0 }
      }
      grouped[key].qty += item.qty
      grouped[key].ca += item.totalPrice
    }

    return Object.values(grouped)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, Number(limit))
  })

  // GET /api/reports/by-category?period=month
  app.get('/by-category', async (req) => {
    const { tenantId } = req.user as any
    const { period = 'month' } = req.query as any
    const range = periodRange(period)

    const items = await prisma.saleItem.findMany({
      where: { sale: { tenantId, createdAt: { gte: range.from, lte: range.to } } },
      include: { product: { select: { category: true } } },
    })

    const grouped: Record<string, { category: string; ca: number; qty: number }> = {}
    for (const item of items) {
      const cat = item.product.category
      if (!grouped[cat]) grouped[cat] = { category: cat, ca: 0, qty: 0 }
      grouped[cat].ca += item.totalPrice
      grouped[cat].qty += item.qty
    }

    return Object.values(grouped).sort((a, b) => b.ca - a.ca)
  })

  // GET /api/reports/payment-methods?period=month
  app.get('/payment-methods', async (req) => {
    const { tenantId } = req.user as any
    const { period = 'month' } = req.query as any
    const range = periodRange(period)

    const sales = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
      select: { paymentMethod: true, totalTTC: true },
    })

    const grouped: Record<string, { method: string; ca: number; count: number }> = {}
    for (const sale of sales) {
      const m = sale.paymentMethod
      if (!grouped[m]) grouped[m] = { method: m, ca: 0, count: 0 }
      grouped[m].ca += sale.totalTTC
      grouped[m].count++
    }

    return Object.values(grouped).sort((a, b) => b.ca - a.ca)
  })

  // GET /api/reports/sales-trend?period=month — données quotidiennes pour le graphique
  app.get('/sales-trend', async (req) => {
    const { tenantId } = req.user as any
    const { period = 'month' } = req.query as any
    const range = periodRange(period)

    const sales = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true, totalTTC: true },
      orderBy: { createdAt: 'asc' },
    })

    const grouped: Record<string, number> = {}
    for (const sale of sales) {
      const key = sale.createdAt.toISOString().slice(0, 10)
      grouped[key] = (grouped[key] || 0) + sale.totalTTC
    }

    return Object.entries(grouped).map(([date, ca]) => ({ date, ca }))
  })
}
