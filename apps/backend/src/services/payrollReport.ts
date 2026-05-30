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

/**
 * Cron mensuel — récap paie. N'envoie QU'aux tenants opt-in (`notifEmailPayroll = true`),
 * une seule fois par mois (marqueur `lastPayrollReportMonth`), au destinataire ADMIN,
 * dans la langue + devise du tenant. Skip propre si aucune donnée (pas d'email vide).
 *
 * Données : `Employee.salary` (effectif actif) = masse salariale PROJETÉE (pas de modèle
 * Payroll historique) + `EmployeeBonus` du mois clos (réel).
 */
export async function runMonthlyPayrollReports(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
  const { month, start, end } = resolveReportMonth(now)

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
    const admin = tenant.users[0]
    if (!admin?.email) { skipped++; continue }

    const [salaryAgg, bonusAgg] = await Promise.all([
      prisma.employee.aggregate({
        where: { tenantId: tenant.id, isActive: true, deletedAt: null },
        _sum: { salary: true }, _count: { id: true },
      }),
      prisma.employeeBonus.aggregate({
        where: { tenantId: tenant.id, date: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
    ])
    const headcount = salaryAgg._count.id ?? 0
    const payroll   = salaryAgg._sum.salary ?? 0
    const bonuses   = bonusAgg._sum.amount ?? 0

    // Pas d'email vide : aucun employé actif ET aucune prime → skip (on marque pour ne pas re-traiter).
    if (headcount === 0 && bonuses === 0) {
      await prisma.tenant.update({ where: { id: tenant.id }, data: { lastPayrollReportMonth: month } }).catch(() => {})
      skipped++
      continue
    }

    await sendPayrollSummaryEmail({
      to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name,
      lang: tenant.lang, currency: tenant.currency, month, headcount, payroll, bonuses,
    }).catch(() => {})

    // Marqueur d'idempotence APRÈS envoi → un rejeu du cron n'enverra pas deux fois.
    await prisma.tenant.update({ where: { id: tenant.id }, data: { lastPayrollReportMonth: month } }).catch(() => {})
    sent++
  }

  if (sent > 0 || skipped > 0) console.log(`📧 Cron récap paie (${month}): ${sent} envoyé(s), ${skipped} ignoré(s)`)
  return { sent, skipped }
}
