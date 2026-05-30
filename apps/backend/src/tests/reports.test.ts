import { describe, it, expect, vi } from 'vitest'
import { resolveMonth, computeReport, buildAccountingReport } from '../routes/reports'

describe('resolveMonth', () => {
  const now = new Date(2026, 4, 30) // 30 mai 2026 (mois 0-based = 4)

  it('defaults to current month when raw is missing/invalid', () => {
    for (const raw of [undefined, '', 'nope', '2026-13', '202605']) {
      const m = resolveMonth(raw as any, now)
      expect(m.monthStr).toBe('2026-05')
      expect(m.isCurrentMonth).toBe(true)
    }
  })

  it('parses YYYY-MM and builds exclusive month bounds', () => {
    const m = resolveMonth('2026-01', now)
    expect(m.monthStr).toBe('2026-01')
    expect(m.isCurrentMonth).toBe(false)
    expect(m.start.getTime()).toBe(new Date(2026, 0, 1).getTime())
    expect(m.end.getTime()).toBe(new Date(2026, 1, 1).getTime()) // exclusif = 1er févr.
  })
})

describe('computeReport', () => {
  const base = { monthStr: '2026-05', currency: 'XOF', generatedAt: '2026-05-30T00:00:00.000Z', payrollTotal: 0 }

  it('empty month → all zeros, margin null', () => {
    const r = computeReport({ ...base, revenueTotal: 0, revenueCount: 0, expenses: [] })
    expect(r.revenue).toEqual({ total: 0, count: 0 })
    expect(r.expenses.total).toBe(0)
    expect(r.expenses.byCategory).toEqual([])
    expect(r.net).toBe(0)
    expect(r.margin).toBeNull()
  })

  it('aggregates expenses by category (sorted desc) and computes net = revenue − expenses', () => {
    const r = computeReport({
      ...base,
      revenueTotal: 1000,
      revenueCount: 5,
      expenses: [
        { category: 'Loyer', amountTTC: 200 },
        { category: 'Énergie', amountTTC: 100 },
        { category: 'Loyer', amountTTC: 50 },
      ],
    })
    expect(r.expenses.total).toBe(350)
    expect(r.expenses.byCategory).toEqual([
      { category: 'Loyer', amountTtc: 250 },
      { category: 'Énergie', amountTtc: 100 },
    ])
    expect(r.net).toBe(650)
    expect(r.margin).toBeCloseTo(65)
  })

  it('payroll is surfaced separately and NOT subtracted from net (no double count)', () => {
    const r = computeReport({
      ...base,
      payrollTotal: 400,
      revenueTotal: 1000,
      revenueCount: 2,
      expenses: [{ category: 'Loyer', amountTTC: 100 }],
    })
    expect(r.payroll).toEqual({ total: 400, projected: true })
    expect(r.net).toBe(900) // 1000 − 100 only ; payroll excluded
  })
})

describe('buildAccountingReport — tenant isolation', () => {
  it('always scopes queries by the tenantId passed (from JWT), never the query', async () => {
    const db: any = {
      sale: { aggregate: vi.fn().mockResolvedValue({ _sum: { total: 0 }, _count: { id: 0 } }) },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      employee: { aggregate: vi.fn().mockResolvedValue({ _sum: { salary: 0 } }) },
      tenant: { findUnique: vi.fn().mockResolvedValue({ currency: 'EUR' }) },
    }
    const now = new Date(2026, 4, 30)
    const meta = resolveMonth('2026-05', now)
    const r = await buildAccountingReport(db, 'TENANT_1', meta, now)

    expect(db.sale.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'TENANT_1' }),
    }))
    expect(db.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'TENANT_1' }),
    }))
    expect(db.employee.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'TENANT_1', isActive: true, deletedAt: null }),
    }))
    expect(r.currency).toBe('EUR')
    expect(r.net).toBe(0)
  })
})
