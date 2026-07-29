import { describe, it, expect } from 'vitest'
import { calcNet, calcBrut, payrollBreakdown, CNSS_RATE, type PayRecord } from '@/components/payroll/payrollShared'

// Calcul paie (base XOF) — brut = base+primes+heures sup ; net = brut − retenues − pénalité d'absence.
const rec = (over: Partial<PayRecord> = {}): PayRecord => ({
  id: 'pay1', employeeId: 'emp1', employee: 'X', avatar: 'X', color: '#000', role: 'Caissier',
  baseSalary: 260000, bonus: 0, overtime: 0, deductions: 0, absences: 0,
  status: 'EN ATTENTE', paidAt: null, month: 'Mai 2026', ...over,
})

describe('calcBrut', () => {
  it('= base + primes + heures sup', () => {
    expect(calcBrut(rec({ baseSalary: 260000, bonus: 40000, overtime: 10000 }))).toBe(310000)
    expect(calcBrut(rec({ baseSalary: 260000 }))).toBe(260000)
  })
})

describe('calcNet', () => {
  it('= brut − retenues (sans absence)', () => {
    expect(calcNet(rec({ baseSalary: 300000, bonus: 50000, overtime: 0, deductions: 20000 }))).toBe(330000)
  })

  it('applique la pénalité d’absence = round(absences × base / 26)', () => {
    // 2 absences sur base 260000 → 2*260000/26 = 20000
    expect(calcNet(rec({ baseSalary: 260000, absences: 2 }))).toBe(240000)
    // arrondi : 1 absence base 250000 → round(9615.38) = 9615
    expect(calcNet(rec({ baseSalary: 250000, absences: 1 }))).toBe(250000 - 9615)
  })

  it('0 absence → aucune pénalité', () => {
    expect(calcNet(rec({ baseSalary: 200000, bonus: 10000 }))).toBe(210000)
  })

  it('combine primes, heures sup, retenues et absences', () => {
    const net = calcNet(rec({ baseSalary: 260000, bonus: 40000, overtime: 10000, deductions: 15000, absences: 2 }))
    // brut 310000 − 15000 − round(2*260000/26)=20000 = 275000
    expect(net).toBe(275000)
  })
})

describe('payrollBreakdown (CNSS / IRPP) — source unique', () => {
  it('CNSS = round(base × 5,6 %)', () => {
    expect(CNSS_RATE).toBe(0.056)
    expect(payrollBreakdown(rec({ baseSalary: 260000 })).cnss).toBe(Math.round(260000 * 0.056)) // 14560
    expect(payrollBreakdown(rec({ baseSalary: 300000 })).cnss).toBe(16800)
  })

  it('IRPP = round(retenues − CNSS − pénalité absence)', () => {
    // base 260000 → cnss 14560 ; retenues 30000, 0 absence → irpp = 30000−14560−0 = 15440
    expect(payrollBreakdown(rec({ baseSalary: 260000, deductions: 30000 })).irpp).toBe(15440)
    // avec 2 absences → pénalité 20000 → irpp = 30000−14560−20000 = -4560 (résiduel, peut être négatif)
    expect(payrollBreakdown(rec({ baseSalary: 260000, deductions: 30000, absences: 2 })).irpp).toBe(-4560)
  })

  it('totalDeductions = retenues saisies + pénalité absence', () => {
    expect(payrollBreakdown(rec({ baseSalary: 260000, deductions: 15000, absences: 2 })).totalDeductions).toBe(35000)
  })

  it('cohérent avec calcNet / calcBrut (source unique)', () => {
    const r = rec({ baseSalary: 260000, bonus: 40000, overtime: 10000, deductions: 15000, absences: 2 })
    const bd = payrollBreakdown(r)
    expect(bd.brut).toBe(calcBrut(r))
    expect(bd.net).toBe(calcNet(r))
    // net = brut − retenues − pénalité (pas via cnss/irpp)
    expect(bd.net).toBe(bd.brut - r.deductions - bd.absencePenalty)
  })
})
