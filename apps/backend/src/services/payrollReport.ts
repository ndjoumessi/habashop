import { prisma } from '../db'
import { sendPayrollSummaryEmail } from './email'

/**
 * Mois à reporter = mois PRÉCÉDENT (qui vient de se clôturer le 1er).
 * Retourne le libellé 'YYYY-MM' + les bornes [start, end) du mois (heure serveur).
 */
export function resolveReportMonth(now: Date): { month: string; start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end   = new Date(now.getFullYear(), now.getMonth(), 1) // exclusif = 1er du mois courant
  const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  return { month, start, end }
}

export interface PayrollReport {
  tenantId: string
  shopName: string
  ownerName: string
  recipient: string | null   // email ADMIN dérivé SERVEUR (jamais du client) ; null = pas d'admin
  month: string
  lang: string
  currency: string
  headcount: number          // effectif actif (réel)
  payroll: number            // masse salariale PROJETÉE (Employee.salary)
  bonuses: number            // primes du mois clos (réel)
  total: number
  hasData: boolean           // false → skip (pas d'email vide)
}

type TenantWithAdmin = {
  id: string; name: string; lang: string; currency: string
  users: { email: string | null; name: string | null }[]
}

/**
 * Cœur de calcul du récap pour UN tenant (partagé cron + route admin).
 * Le destinataire est TOUJOURS l'admin du tenant (`users[0]`), dérivé serveur.
 */
export async function buildPayrollReport(
  db: typeof prisma,
  tenant: TenantWithAdmin,
  now: Date = new Date(),
): Promise<PayrollReport> {
  const { month, start, end } = resolveReportMonth(now)
  const [salaryAgg, bonusAgg] = await Promise.all([
    db.employee.aggregate({
      where: { tenantId: tenant.id, isActive: true, deletedAt: null },
      _sum: { salary: true }, _count: { id: true },
    }),
    db.employeeBonus.aggregate({
      where: { tenantId: tenant.id, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ])
  const headcount = salaryAgg._count.id ?? 0
  const payroll   = salaryAgg._sum.salary ?? 0
  const bonuses   = bonusAgg._sum.amount ?? 0
  const admin     = tenant.users[0]
  return {
    tenantId: tenant.id, shopName: tenant.name, ownerName: admin?.name ?? tenant.name,
    recipient: admin?.email ?? null, month, lang: tenant.lang, currency: tenant.currency,
    headcount, payroll, bonuses, total: payroll + bonuses,
    hasData: headcount > 0 || bonuses > 0,
  }
}

/**
 * Envoi du récap pour UN tenant (partagé cron + route admin).
 * Skip propre : pas de destinataire OU pas de donnée → aucun email.
 * `mark` : pose le marqueur d'idempotence (uniquement sur envoi réel, pas en dry-run).
 */
export async function deliverPayrollReport(
  db: typeof prisma,
  report: PayrollReport,
  opts: { mark: boolean },
): Promise<{ sent: boolean; reason: string }> {
  if (!report.recipient) return { sent: false, reason: 'no_recipient' }
  if (!report.hasData)   return { sent: false, reason: 'no_data' }

  await sendPayrollSummaryEmail({
    to: report.recipient, shopName: report.shopName, ownerName: report.ownerName,
    lang: report.lang, currency: report.currency, month: report.month,
    headcount: report.headcount, payroll: report.payroll, bonuses: report.bonuses,
  })
  if (opts.mark) {
    await db.tenant.update({ where: { id: report.tenantId }, data: { lastPayrollReportMonth: report.month } }).catch(() => {})
  }
  return { sent: true, reason: 'ok' }
}

/**
 * Cron mensuel — n'envoie QU'aux tenants opt-in (`notifEmailPayroll = true`),
 * une seule fois par mois (marqueur `lastPayrollReportMonth`). Réutilise le cœur ci-dessus.
 */
export async function runMonthlyPayrollReports(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
  const { month } = resolveReportMonth(now)

  const tenants = await prisma.tenant.findMany({
    where: {
      notifEmailPayroll: true,                         // opt-in strict
      status: { in: ['active', 'trial'] },
      OR: [                                            // idempotence : jamais re-traiter ce mois
        { lastPayrollReportMonth: null },
        { lastPayrollReportMonth: { not: month } },
      ],
    },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })

  let sent = 0
  let skipped = 0
  for (const tenant of tenants) {
    const report = await buildPayrollReport(prisma, tenant, now)
    if (!report.recipient || !report.hasData) {
      // marque pour ne pas re-traiter dans la journée (pas d'email vide)
      await prisma.tenant.update({ where: { id: tenant.id }, data: { lastPayrollReportMonth: month } }).catch(() => {})
      skipped++
      continue
    }
    await deliverPayrollReport(prisma, report, { mark: true }).catch(() => {})
    sent++
  }

  if (sent > 0 || skipped > 0) console.log(`📧 Cron récap paie (${month}): ${sent} envoyé(s), ${skipped} ignoré(s)`)
  return { sent, skipped }
}
