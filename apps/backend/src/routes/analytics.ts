import type { FastifyInstance } from 'fastify'
import { prisma, basePrisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { getTenantId } from '../lib/tenantId'
import { getCached } from '../lib/cache'
import { salesWindowStart } from '../utils/salesWindow'
import { regrouperCategories } from '../lib/categoryBreakdown'

/**
 * Évolution en % (1 décimale) entre la valeur actuelle et celle de la période
 * précédente. Renvoie null si prev ≤ 0 (pas d'historique comparable → pas de badge).
 */
export function computeTrend(value: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev <= 0) return null
  return Math.round(((value - prev) / prev) * 1000) / 10
}

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard/stats', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return getCached(`analytics:${tenantId}:dashboard`, 300, async () => {
      const now = new Date()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      // Période PRÉCÉDENTE comparable = même durée écoulée (jour/mois glissant), pour des
      // tendances honnêtes (on ne compare pas un mois partiel à un mois complet).
      const elapsedToday = now.getTime() - today.getTime()
      const yesterday = new Date(today.getTime() - 86_400_000)
      const prevDayEnd = new Date(yesterday.getTime() + elapsedToday)
      const elapsedMonth = now.getTime() - monthStart.getTime()
      const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const prevMonthEnd = new Date(prevMonthStart.getTime() + elapsedMonth)

      const [salesToday, salesMonth, prevDaySales, prevMonthSales, totalProducts, activeEmployees, pendingOrders, allProducts] =
        await Promise.all([
          prisma.sale.aggregate({
            where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: today } },
            _sum: { total: true },
            _count: true,
          }),
          prisma.sale.aggregate({
            where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: monthStart } },
            _sum: { total: true },
            _count: true,
          }),
          // CA hier sur la même plage horaire écoulée (remboursées exclues — cohérent).
          prisma.sale.aggregate({
            where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: yesterday, lt: prevDayEnd } },
            _sum: { total: true },
          }),
          // CA du mois précédent sur la même durée écoulée (remboursées exclues — cohérent).
          prisma.sale.aggregate({
            where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: prevMonthStart, lt: prevMonthEnd } },
            _sum: { total: true },
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
          where: { sale: { tenantId, status: { not: 'refunded' }, createdAt: { gte: monthStart } } },
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
          where: { sale: { tenantId, status: { not: 'refunded' }, createdAt: { gte: monthStart } } },
          select: { total: true, product: { select: { category: true } } },
        }).catch(() => []),
      ])

      const topProducts = await Promise.all(topProductsRaw.map(async (it) => {
        // Item 8-B : findFirst scopé tenant (findUnique par id nu = trou d'isolation).
        const p = await prisma.product.findFirst({ where: { id: it.productId, tenantId }, select: { name: true } }).catch(() => null)
        return { name: p?.name ?? 'Produit supprimé', ca: it._sum.total ?? 0 }
      }))

      const catMap: Record<string, number> = {}
      for (const i of categoryItems) {
        const c = i.product?.category ?? 'Autre'
        catMap[c] = (catMap[c] ?? 0) + (i.total ?? 0)
      }
      // ⚠️ Le `.slice(0, 6)` nu vivait ici. Il tronquait SANS rien dire du reste, et le
      // client calculait son dénominateur sur ce qu'il recevait — donc sur un sous-ensemble
      // présenté comme le CA du mois. `regrouperCategories` rend un reliquat EXPLICITE, ce
      // qui rend l'invariant vérifiable : Σ(rendu) === Σ(toutes catégories). Cf. le module.
      const categoryBreakdown = regrouperCategories(
        Object.entries(catMap).map(([name, value]) => ({ name, value })),
        6,
      )

      return {
        salesToday: salesToday._sum.total ?? 0,
        transactionsToday: salesToday._count,
        salesMonth: salesMonth._sum.total ?? 0,
        transactionsMonth: salesMonth._count,
        // Tendances réelles vs période précédente (null = pas d'historique → pas de badge).
        salesTodayTrend: computeTrend(salesToday._sum.total ?? 0, prevDaySales._sum.total ?? 0),
        salesMonthTrend: computeTrend(salesMonth._sum.total ?? 0, prevMonthSales._sum.total ?? 0),
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
  })

  // ── Dashboard consolidé multi-boutiques ───────────────────────────────────────
  // Stats du jour pour TOUTES les boutiques de l'user (CA en XOF base → total commun).
  // Accessible sans boutique active (cf. authenticate : exempté du 400).
  app.get('/api/dashboard/consolidated', { preHandler: authenticate }, async (request) => {
    const { userId } = request.user
    const links = await prisma.userTenant.findMany({
      where: { userId, tenant: { deletedAt: null } },
      select: { tenant: { select: { id: true, name: true, currency: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const tenantsMeta = links.map(l => l.tenant).filter(Boolean) as { id: string; name: string; currency: string }[]

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const perTenant = await Promise.all(tenantsMeta.map(async (t) => {
      // Cross-tenant LÉGITIME (boutiques de l'utilisateur) → client NON étendu :
      // l'extension tenant ne doit jamais restreindre cet agrégat multi-boutiques.
      const [agg, lowStock] = await Promise.all([
        basePrisma.sale.aggregate({
          where: { tenantId: t.id, status: { not: 'refunded' }, createdAt: { gte: today } },
          _sum: { total: true },
          _count: true,
        }),
        basePrisma.product.count({ where: { tenantId: t.id, isActive: true, deletedAt: null, stockQty: { lte: basePrisma.product.fields.stockMin } } }).catch(() => 0),
      ])
      return {
        id: t.id,
        name: t.name,
        currency: t.currency,
        caToday: agg._sum.total ?? 0,            // XOF base
        transactionsToday: agg._count,
        stockAlerts: lowStock,
      }
    }))

    const totalCaToday = perTenant.reduce((s, t) => s + t.caToday, 0)
    const totalTransactions = perTenant.reduce((s, t) => s + t.transactionsToday, 0)

    return { tenants: perTenant, totalCaToday, totalTransactions }
  })

  app.get('/api/reports/sales', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    const { period = '7days' } = request.query as { period?: string }

    return getCached(`analytics:${tenantId}:reports:${period}`, 300, async () => {
      // ⚠️ Fenêtre = SOURCE UNIQUE `utils/salesWindow` — le front la reflète pour remplir à 0
      // les jours sans vente ; cas partagés `docs/shared-fixtures/sales-window-cases.json`.
      const from = salesWindowStart(period, new Date())

      const sales = await prisma.sale.findMany({
        where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: from } },
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
  })

  app.get('/api/analytics/summary', { preHandler: [authenticate] }, async (request, reply) => {
    const tenantId = request.tenantId
    return getCached(`analytics:${tenantId}:summary`, 300, async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const [salesDay, salesMonth, customers, products] = await Promise.all([
        prisma.sale.aggregate({ where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: today } }, _sum: { total: true }, _count: { id: true } }),
        prisma.sale.aggregate({ where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: thisMonth } }, _sum: { total: true }, _count: { id: true } }),
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
  })

  app.get('/api/analytics', { preHandler: [authenticate] }, async (request, reply) => {
    const tenantId = request.tenantId
    return getCached(`analytics:${tenantId}:full`, 300, async () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const last30d = new Date(now.getTime() - 30*24*60*60*1000)
      const [salesDay, salesMonth, customers, products, salesByDay, salesByPayment] = await Promise.all([
        prisma.sale.aggregate({ where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: today } }, _sum: { total: true }, _count: { id: true } }),
        prisma.sale.aggregate({ where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: thisMonth } }, _sum: { total: true }, _count: { id: true } }),
        prisma.customer.count({ where: { tenantId, deletedAt: null } }),
        prisma.product.count({ where: { tenantId, isActive: true, deletedAt: null } }),
        prisma.sale.findMany({ where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: last30d } }, select: { createdAt: true, total: true }, orderBy: { createdAt: 'asc' } }),
        prisma.sale.groupBy({ by: ['paymentMode'], where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: thisMonth } }, _sum: { total: true }, _count: { id: true } }),
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
  })

  /** Plafond de lignes du journal — la troncature est ANNONCÉE, jamais silencieuse. */
  const PLAFOND_JOURNAL = 100

  app.get('/api/audit-logs', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    // ⚠️ L'erreur REMONTE volontairement (500 via le handler global). Renvoyer []
    // sur échec faisait AFFIRMER au journal qu'il ne s'était rien passé — un
    // journal d'audit muet est pire qu'un journal indisponible, parce qu'on le croit.
    // ⚠️ LE COMPTE RÉEL VOYAGE AVEC LES LIGNES. Avant, la route rendait un tableau nu
    // plafonné à 100 et l'écran affichait `longueur` sous l'étiquette « TOTAL
    // ÉVÉNEMENTS », sous un sous-titre annonçant une traçabilité « complète ». Au 101ᵉ
    // événement, le KPI aurait dit « 100 » POUR TOUJOURS — et personne ne l'aurait vu,
    // parce que le tenant de démonstration en compte dix. C'est la répétition exacte du
    // camembert calé sur six catégories : une démonstration sous le seuil ne démontre
    // rien, elle masque. Le client ne peut pas déduire le total de ce qu'on lui envoie ;
    // il faut donc le lui DIRE.
    // ⚠️ LES COMPTEURS SONT CALCULÉS EN BASE, PAS SUR LES LIGNES RENVOYÉES.
    // L'écran les dérivait des ≤100 entrées chargées : « Alertes sécurité » ignorait
    // donc toute alerte plus ancienne que la 100ᵉ ligne — un compteur d'alertes qui
    // rate les alertes est pire que pas de compteur, on s'y fie. Même chose pour
    // « Aujourd'hui » dès qu'une journée dépasse le plafond.
    const debutJour = new Date(); debutJour.setHours(0, 0, 0, 0)
    const [total, aujourdhui, alertes, modules, items] = await Promise.all([
      prisma.auditLog.count({ where: { tenantId } }),
      prisma.auditLog.count({ where: { tenantId, createdAt: { gte: debutJour } } }),
      prisma.auditLog.count({ where: { tenantId, severity: 'danger' } }),
      prisma.auditLog.groupBy({ by: ['module'], where: { tenantId } }),
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: PLAFOND_JOURNAL,
        include: { user: { select: { name: true } } },
      }),
    ])
    return {
      items,
      total,
      limite: PLAFOND_JOURNAL,
      // `modules` compte les modules AYANT PRODUIT un événement — pas des « modules
      // actifs », ce que rien ici ne mesure. Le nom suit ce que le chiffre dit.
      stats: { aujourdhui, alertes, modules: modules.length },
    }
  })
}
