import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { getCached } from '../lib/cache'
import { xofToCurrency } from '../lib/currency'

// Rôles autorisés à lire le rapport comptable (lecture seule).
const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'])

export interface AccountingReport {
  month: string                       // 'YYYY-MM'
  currency: string
  revenue: { total: number; count: number }
  expenses: { total: number; byCategory: { category: string; amountTtc: number }[] }
  payroll: { total: number; projected: boolean } // masse salariale PROJETÉE (effectif actuel)
  resultBeforePayroll: number         // = revenue.total − expenses.total (dépenses RÉELLES)
  resultAfterPayrollEstimate: number  // = resultBeforePayroll − payroll.total (ESTIMATION)
  margin: number | null               // marge avant masse salariale (%) ; null si revenu = 0
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
 *
 * Montants d'entrée en base XOF → convertis en sortie vers `input.currency`
 * (même pattern que le récap paie). XOF/XAF = identité. Les totaux/résultats sont
 * dérivés des composants DÉJÀ convertis → cohérence interne (parties = total,
 * résultat = revenu − dépenses) dans la devise affichée. La marge est un ratio,
 * calculée sur les valeurs XOF (indépendante de la devise, sans dérive d'arrondi).
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
  const conv = (xof: number) => xofToCurrency(xof, input.currency)

  const catMap = new Map<string, number>()
  for (const e of input.expenses) {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + (e.amountTTC ?? 0))
  }
  // Tri sur les montants XOF (ordre identique avant/après conversion), puis conversion.
  const byCategory = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amountTtcXOF]) => ({ category, amountTtc: conv(amountTtcXOF) }))
  // Total = somme des catégories CONVERTIES → cohérent avec l'affichage des parts.
  const expensesTotal = byCategory.reduce((s, c) => s + c.amountTtc, 0)
  const revenueTotalConv = conv(input.revenueTotal)
  const payrollTotalConv = conv(input.payrollTotal)
  // Résultat AVANT masse salariale (dépenses réellement enregistrées), en devise affichée.
  const resultBeforePayroll = revenueTotalConv - expensesTotal
  // Résultat APRÈS paie = estimation (masse salariale projetée sur l'effectif actuel).
  const resultAfterPayrollEstimate = resultBeforePayroll - payrollTotalConv
  // Marge AVANT masse salariale : ratio sur valeurs XOF (devise-indépendant).
  const resultBeforePayrollXOF = input.revenueTotal - [...catMap.values()].reduce((s, v) => s + v, 0)
  return {
    month: input.monthStr,
    currency: input.currency,
    revenue: { total: revenueTotalConv, count: input.revenueCount },
    expenses: { total: expensesTotal, byCategory },
    payroll: { total: payrollTotalConv, projected: true },
    resultBeforePayroll,
    resultAfterPayrollEstimate,
    margin: input.revenueTotal > 0 ? (resultBeforePayrollXOF / input.revenueTotal) * 100 : null,
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
      // v2 : conversion devise ajoutée → invalide les entrées pré-conversion en cache.
      `reports:accounting:v2:${tenantId}:${meta.monthStr}`,
      ttl,
      () => buildAccountingReport(prisma, tenantId, meta, now),
    )
  })
}
