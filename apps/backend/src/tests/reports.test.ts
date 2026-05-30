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
    expect(r.resultBeforePayroll).toBe(0)
    expect(r.resultAfterPayrollEstimate).toBe(0)
    expect(r.margin).toBeNull()
  })

  it('aggregates expenses by category (sorted desc); resultBeforePayroll = revenue − expenses', () => {
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
    expect(r.resultBeforePayroll).toBe(650)
    expect(r.margin).toBeCloseTo(65) // marge AVANT masse salariale
  })

  it('payroll is projected, excluded from resultBeforePayroll, subtracted only in the after estimate', () => {
    const r = computeReport({
      ...base,
      payrollTotal: 400,
      revenueTotal: 1000,
      revenueCount: 2,
      expenses: [{ category: 'Loyer', amountTTC: 100 }],
    })
    expect(r.payroll).toEqual({ total: 400, projected: true })
    expect(r.resultBeforePayroll).toBe(900)         // 1000 − 100 ; paie exclue
    expect(r.resultAfterPayrollEstimate).toBe(500)  // 900 − 400 (estimation)
  })

  it('payroll = 0 → after estimate equals before (no phantom payroll)', () => {
    const r = computeReport({
      ...base,
      payrollTotal: 0,
      revenueTotal: 500,
      revenueCount: 3,
      expenses: [{ category: 'Loyer', amountTTC: 100 }],
    })
    expect(r.payroll.total).toBe(0)
    expect(r.resultBeforePayroll).toBe(400)
    expect(r.resultAfterPayrollEstimate).toBe(400) // identique → l'UI masquera la ligne
  })

  it('XOF → identité (aucune conversion sur un tenant XOF)', () => {
    const r = computeReport({
      ...base, currency: 'XOF',
      revenueTotal: 12_539_800, revenueCount: 362, payrollTotal: 1_660_000,
      expenses: [{ category: 'Loyer', amountTTC: 200_000 }, { category: 'Énergie', amountTTC: 53_100 }],
    })
    expect(r.revenue.total).toBe(12_539_800)
    expect(r.expenses.total).toBe(253_100)
    expect(r.payroll.total).toBe(1_660_000)
    expect(r.resultBeforePayroll).toBe(12_286_700)
    expect(r.resultAfterPayrollEstimate).toBe(10_626_700)
  })

  it('tenant EUR → montants convertis (base XOF / 655.957), marge inchangée', () => {
    const r = computeReport({
      ...base, currency: 'EUR',
      revenueTotal: 6_559_570,           // = 10 000 € exactement
      revenueCount: 100,
      payrollTotal: 1_311_914,           // = 2 000 €
      expenses: [{ category: 'Loyer', amountTTC: 655_957 }], // = 1 000 €
    })
    expect(r.currency).toBe('EUR')
    expect(r.revenue.total).toBe(10_000)
    expect(r.expenses.total).toBe(1_000)
    expect(r.expenses.byCategory).toEqual([{ category: 'Loyer', amountTtc: 1_000 }])
    expect(r.payroll.total).toBe(2_000)
    expect(r.resultBeforePayroll).toBe(9_000)        // 10 000 − 1 000 (en €)
    expect(r.resultAfterPayrollEstimate).toBe(7_000) // 9 000 − 2 000
    // marge = ratio XOF, identique quelle que soit la devise : (6 559 570 − 655 957) / 6 559 570
    expect(r.margin).toBeCloseTo(90)
  })
})

describe('computeReport — conversion EUR/USD : arrondis & cas limites', () => {
  const base = { monthStr: '2026-05', generatedAt: '2026-05-30T00:00:00.000Z', payrollTotal: 0, revenueCount: 0, expenses: [] as { category: string; amountTTC: number | null }[] }

  it('arrondit XOF→EUR sur un montant NON rond : round(xof / 655.957)', () => {
    const r = computeReport({ ...base, currency: 'EUR', revenueTotal: 100_000, revenueCount: 3 })
    expect(r.revenue.total).toBe(152) // 100 000 / 655.957 = 152.449 → 152
  })

  it('total dépenses = somme des catégories CONVERTIES (parts cohérentes ≠ conv(somme))', () => {
    // 2 catégories à 1000 XOF : chacune round(1.524)=2 € → total 4 € ;
    // conv(2000)=round(3.048)=3 € → prouve que le total agrège les PARTS arrondies.
    const r = computeReport({ ...base, currency: 'EUR', revenueTotal: 0, expenses: [
      { category: 'Loyer', amountTTC: 1000 }, { category: 'Énergie', amountTTC: 1000 },
    ] })
    expect(r.expenses.byCategory.map(c => c.amountTtc)).toEqual([2, 2])
    expect(r.expenses.total).toBe(4)
    // cohérence interne : Σ parts == total affiché (pas de "les parts ne tombent pas juste")
    expect(r.expenses.byCategory.reduce((s, c) => s + c.amountTtc, 0)).toBe(r.expenses.total)
  })

  it('montant ZÉRO en EUR → 0 (pas de NaN), marge null', () => {
    const r = computeReport({ ...base, currency: 'EUR', revenueTotal: 0, revenueCount: 0, expenses: [] })
    expect(r.revenue.total).toBe(0)
    expect(r.expenses.total).toBe(0)
    expect(r.resultBeforePayroll).toBe(0)
    expect(r.margin).toBeNull()
  })

  it('USD : round(xof / 602) + résultats cohérents', () => {
    const r = computeReport({ ...base, currency: 'USD', revenueTotal: 602_000, revenueCount: 10, payrollTotal: 120_400, expenses: [{ category: 'Loyer', amountTTC: 60_200 }] })
    expect(r.revenue.total).toBe(1000)
    expect(r.expenses.total).toBe(100)
    expect(r.payroll.total).toBe(200)
    expect(r.resultBeforePayroll).toBe(900)
    expect(r.resultAfterPayrollEstimate).toBe(700)
  })

  it('⚠️ devise INCONNUE (absente de TO_XOF_RATES) → taux ?? 1 → IDENTITÉ (aucune conversion)', () => {
    // Comportement défensif documenté : un tenant à devise non supportée verrait des
    // montants d'ordre XOF étiquetés dans sa devise. Voir RAPPORT (risque latent, non corrigé).
    const r = computeReport({ ...base, currency: 'JPY', revenueTotal: 5000, revenueCount: 1, expenses: [{ category: 'Loyer', amountTTC: 300 }] })
    expect(r.currency).toBe('JPY')
    expect(r.revenue.total).toBe(5000) // inchangé
    expect(r.expenses.total).toBe(300) // inchangé
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
    expect(r.resultBeforePayroll).toBe(0)
    expect(r.resultAfterPayrollEstimate).toBe(0)
  })
})
