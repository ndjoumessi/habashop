import { describe, it, expect, vi, beforeEach } from 'vitest'

// prisma + email mockés (aucun vrai envoi, aucune DB)
const { db, sendSpy } = vi.hoisted(() => ({
  db: {
    tenant:        { findMany: vi.fn(), update: vi.fn() },
    employee:      { aggregate: vi.fn() },
    employeeBonus: { aggregate: vi.fn() },
  },
  sendSpy: vi.fn(),
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../services/email', () => ({ sendPayrollSummaryEmail: sendSpy }))

import { runMonthlyPayrollReports, resolveReportMonth, buildPayrollReport } from '../services/payrollReport'

const MAY_1 = new Date(2026, 4, 1) // 1 mai 2026 → récap d'avril
const tenant = (over: Record<string, any> = {}) => ({
  id: 'T1', name: 'Boutique Dakar', lang: 'fr', currency: 'XOF', status: 'active',
  lastPayrollReportMonth: null,
  users: [{ email: 'admin@t1.com', name: 'Admin', role: 'ADMIN' }],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.update.mockResolvedValue({})
  sendSpy.mockResolvedValue(true)
  db.employee.aggregate.mockResolvedValue({ _sum: { salary: 0 }, _count: { id: 0 } })
  db.employeeBonus.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
})

describe('resolveReportMonth', () => {
  it('1er mai → mois précédent avril, bornes [1 avr, 1 mai)', () => {
    const r = resolveReportMonth(MAY_1)
    expect(r.month).toBe('2026-04')
    expect(r.start.getTime()).toBe(new Date(2026, 3, 1).getTime())
    expect(r.end.getTime()).toBe(new Date(2026, 4, 1).getTime())
  })
  it('1er janvier → décembre de l’année précédente', () => {
    expect(resolveReportMonth(new Date(2026, 0, 1)).month).toBe('2025-12')
  })
})

describe('buildPayrollReport — conversion base XOF → devise tenant', () => {
  const tn = (currency: string) => ({ id: 'X', name: 'Shop', lang: 'fr', currency, users: [{ email: 'a@a.com', name: 'A' }] })

  it('tenant XOF → montants inchangés (identité)', async () => {
    db.employee.aggregate.mockResolvedValue({ _sum: { salary: 500000 }, _count: { id: 2 } })
    db.employeeBonus.aggregate.mockResolvedValue({ _sum: { amount: 30000 } })
    const r = await buildPayrollReport(db as any, tn('XOF'), MAY_1)
    expect(r.payroll).toBe(500000)
    expect(r.bonuses).toBe(30000)
    expect(r.total).toBe(530000)
  })

  it('tenant EUR → conversion au taux fixe (1 € = 655,957 XOF)', async () => {
    db.employee.aggregate.mockResolvedValue({ _sum: { salary: 2197456 }, _count: { id: 5 } })
    db.employeeBonus.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    const r = await buildPayrollReport(db as any, tn('EUR'), MAY_1)
    expect(r.currency).toBe('EUR')
    expect(r.payroll).toBe(3350) // 2 197 456 / 655,957 ≈ 3350
    expect(r.hasData).toBe(true)
  })
})

describe('runMonthlyPayrollReports', () => {
  it('opt-in + données → 1 email au bon destinataire (lang/devise) + marqueur posé', async () => {
    db.tenant.findMany.mockResolvedValue([tenant()])
    db.employee.aggregate.mockResolvedValue({ _sum: { salary: 500000 }, _count: { id: 3 } })
    db.employeeBonus.aggregate.mockResolvedValue({ _sum: { amount: 20000 } })

    const r = await runMonthlyPayrollReports(MAY_1)

    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@t1.com', lang: 'fr', currency: 'XOF', month: '2026-04',
      headcount: 3, payroll: 500000, bonuses: 20000,
    }))
    expect(db.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'T1' }, data: { lastPayrollReportMonth: '2026-04' },
    }))
    expect(r.sent).toBe(1)
  })

  it('toggle OFF → exclus au niveau requête (where notifEmailPayroll=true), aucun envoi', async () => {
    db.tenant.findMany.mockResolvedValue([]) // un tenant OFF n'est jamais retourné
    await runMonthlyPayrollReports(MAY_1)
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ notifEmailPayroll: true, status: { in: ['active', 'trial'] } }),
    }))
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('aucun employé ni prime → skip, PAS d’email vide (marqué pour ne pas re-traiter)', async () => {
    db.tenant.findMany.mockResolvedValue([tenant()])
    db.employee.aggregate.mockResolvedValue({ _sum: { salary: null }, _count: { id: 0 } })
    db.employeeBonus.aggregate.mockResolvedValue({ _sum: { amount: null } })

    const r = await runMonthlyPayrollReports(MAY_1)
    expect(sendSpy).not.toHaveBeenCalled()
    expect(db.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lastPayrollReportMonth: '2026-04' } }))
    expect(r.skipped).toBe(1)
  })

  it('rejeu → pas de double envoi : la requête exclut les tenants déjà reportés ce mois', async () => {
    db.tenant.findMany.mockResolvedValue([])
    await runMonthlyPayrollReports(MAY_1)
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ lastPayrollReportMonth: null }, { lastPayrollReportMonth: { not: '2026-04' } }],
      }),
    }))
  })

  it('isolation tenant : chaque récap part vers SON propre admin (devise/langue propres)', async () => {
    db.tenant.findMany.mockResolvedValue([
      tenant({ id: 'A', currency: 'XOF', lang: 'fr', users: [{ email: 'a@a.com', name: 'A', role: 'ADMIN' }] }),
      tenant({ id: 'B', currency: 'EUR', lang: 'en', users: [{ email: 'b@b.com', name: 'B', role: 'ADMIN' }] }),
    ])
    db.employee.aggregate.mockResolvedValue({ _sum: { salary: 100000 }, _count: { id: 1 } })

    await runMonthlyPayrollReports(MAY_1)
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@a.com', currency: 'XOF', lang: 'fr' }))
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: 'b@b.com', currency: 'EUR', lang: 'en' }))
    expect(sendSpy).toHaveBeenCalledTimes(2)
  })
})
