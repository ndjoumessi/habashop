import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// READ-ONLY : état financier des tenants démo (effectif, masse salariale, ventes/dépenses par mois).
async function run() {
  for (const tenantId of ['demo-tenant-001', 'demo-tenant-002']) {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!t) { console.log(`\n=== ${tenantId} : ABSENT ===`); continue }
    console.log(`\n=== ${tenantId} — ${t.name} (${t.currency}) ===`)

    const emps = await prisma.employee.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      select: { id: true, name: true, salary: true },
      orderBy: { salary: 'desc' },
    })
    const payroll = emps.reduce((s, e) => s + (e.salary ?? 0), 0)
    console.log(`Employés actifs: ${emps.length} | masse salariale projetée: ${payroll.toLocaleString('fr-FR')} XOF`)
    for (const e of emps) console.log(`   - ${e.id.padEnd(22)} ${(e.name ?? '').padEnd(22)} ${(e.salary ?? 0).toLocaleString('fr-FR')}`)

    const sales = await prisma.sale.findMany({ where: { tenantId }, select: { total: true, createdAt: true } })
    const byMonth: Record<string, { n: number; sum: number }> = {}
    for (const s of sales) {
      const k = s.createdAt.toISOString().slice(0, 7)
      byMonth[k] = byMonth[k] || { n: 0, sum: 0 }
      byMonth[k].n++; byMonth[k].sum += s.total
    }
    console.log(`Ventes: ${sales.length} total`)
    for (const k of Object.keys(byMonth).sort()) {
      console.log(`   ${k}: ${byMonth[k].n} ventes, CA ${byMonth[k].sum.toLocaleString('fr-FR')} XOF`)
    }

    const exps = await prisma.expense.findMany({ where: { tenantId }, select: { amountHT: true, label: true, date: true } })
    const expByMonth: Record<string, number> = {}
    for (const e of exps) {
      const k = (e.date ?? new Date()).toISOString().slice(0, 7)
      expByMonth[k] = (expByMonth[k] || 0) + (e.amountHT ?? 0)
    }
    console.log(`Dépenses: ${exps.length} total`)
    for (const k of Object.keys(expByMonth).sort()) console.log(`   ${k}: dépenses HT ${expByMonth[k].toLocaleString('fr-FR')} XOF`)
  }
}

run().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
