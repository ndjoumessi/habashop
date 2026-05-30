import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { getCached } from '../lib/cache'

// Rôles autorisés à lire le rapport comptable (lecture seule).
const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'])

export interface AccountingReport {
  month: string                 // 'YYYY-MM'
  currency: string
  revenue: { total: number; count: number }
  expenses: { total: number; byCategory: { category: string; amountTtc: number }[] }
  payroll: { total: number; projected: boolean }
  net: number                   // revenue.total − expenses.total (dépenses RÉELLES uniquement)
  margin: number | null         // % ; null si revenu = 0
  generatedAt: string
}

export interface MonthMeta {
  year: number
  month0: number      // 0-based
  monthStr: string    // 'YYYY-MM'
  start: Date         // inclusif
  end: Date           // exclusif (1er du mois suivant)
  isCurrentMonth: boolean
}

/**
 * Résout le mois cible. `raw` au format 'YYYY-MM' ; défaut = mois courant.
 * Bornes en heure serveur (identique au dashboard `new Date(y, m, 1)` → réconciliation).
 */
export function resolveMonth(raw: string | undefined, now: Date): MonthMeta {
  let year = now.getFullYear()
  let month0 = now.getMonth()
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number)
    if (m >= 1 && m <= 12) { year = y; month0 = m - 1 } // sinon → mois courant (défaut)
  }
  const start = new Date(year, month0, 1)
  const end = new Date(year, month0 + 1, 1)
  const monthStr = `${year}-${String(month0 + 1).padStart(2, '0')}`
  const isCurrentMonth = year === now.getFullYear() && month0 === now.getMonth()
  return { year, month0, monthStr, start, end, isCurrentMonth }
}

/**
 * Met en forme le rapport à partir des agrégats bruts (fonction pure → testable).
 * net = revenu − dépenses RÉELLES. La paie est projetée (Employee.salary) et exposée
 * à part, JAMAIS incluse dans le net (pas de catégorie dépense "Salaires" ni table Payroll).
 */
export function computeReport(input: {
  monthStr: string
  currency: string
  revenueTotal: number
  revenueCount: number
  expenses: { category: string; amountTTC: number | null }[]
  payrollTotal: number
  generatedAt: string
}): AccountingReport {
  const catMap = new Map<string, number>()
  for (const e of input.expenses) {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + (e.amountTTC ?? 0))
  }
  const byCategory = [...catMap.entries()]
    .map(([category, amountTtc]) => ({ category, amountTtc }))
    .sort((a, b) => b.amountTtc - a.amountTtc)
  const expensesTotal = byCategory.reduce((s, c) => s + c.amountTtc, 0)
  const net = input.revenueTotal - expensesTotal
  return {
    month: input.monthStr,
    currency: input.currency,
    revenue: { total: input.revenueTotal, count: input.revenueCount },
    expenses: { total: expensesTotal, byCategory },
    payroll: { total: input.payrollTotal, projected: true },
    net,
    margin: input.revenueTotal > 0 ? (net / input.revenueTotal) * 100 : null,
    generatedAt: input.generatedAt,
  }
}

/** Récupère + agrège les données du mois pour un tenant (tenantId vient TOUJOURS du JWT). */
export async function buildAccountingReport(
  db: typeof prisma,
  tenantId: string,
  meta: MonthMeta,
  now: Date,
): Promise<AccountingReport> {
  const [salesAgg, expenses, payrollAgg, tenant] = await Promise.all([
    db.sale.aggregate({
      where: { tenantId, createdAt: { gte: meta.start, lt: meta.end } },
      _sum: { total: true },
      _count: { id: true },
    }),
    db.expense.findMany({
      where: { tenantId, date: { gte: meta.start, lt: meta.end } },
      select: { category: true, amountTTC: true },
    }),
    db.employee.aggregate({
      where: { tenantId, isActive: true, deletedAt: null },
      _sum: { salary: true },
    }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } }),
  ])

  return computeReport({
    monthStr: meta.monthStr,
    currency: tenant?.currency ?? 'XOF',
    revenueTotal: salesAgg._sum.total ?? 0,
    revenueCount: salesAgg._count.id ?? 0,
    expenses,
    payrollTotal: payrollAgg._sum.salary ?? 0,
    generatedAt: now.toISOString(),
  })
}

export async function reportsRoutes(app: any) {
  // GET /api/reports/accounting?month=YYYY-MM — rapport comptable mensuel du tenant courant.
  app.get('/api/reports/accounting', { preHandler: authenticate }, async (request: any, reply: any) => {
    const role = request.user?.role as string | undefined
    if (!role || !ALLOWED_ROLES.has(role)) {
      return reply.code(403).send({ error: 'Accès refusé' })
    }
    const tenantId = request.tenantId as string
    const now = new Date()
    const meta = resolveMonth(request.query?.month as string | undefined, now)

    // TTL : mois courant court (5 min), mois passés plus long (30 min).
    const ttl = meta.isCurrentMonth ? 300 : 1800
    return getCached(
      `reports:accounting:${tenantId}:${meta.monthStr}`,
      ttl,
      () => buildAccountingReport(prisma, tenantId, meta, now),
    )
  })
}
