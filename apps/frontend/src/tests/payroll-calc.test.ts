import { describe, it, expect } from 'vitest'
import { calcNet, calcBrut, payrollBreakdown, CNSS_RATE, IR_RATE, WORKING_DAYS, type PayRecord } from '@/components/payroll/payrollShared'

/**
 * Calcul de paie (base XOF), RÈGLE COURANTE :
 *   brut = base + primes + heures sup
 *   CNSS = round(brut × 8 %)   ← DÉDUITE
 *   IR   = round(brut × 5 %)   ← DÉDUIT
 *   pénalité absence = round(absences × base / 26)
 *   retenues exceptionnelles = `deductions` (avance, casse…), s'AJOUTENT aux cotisations
 *   net  = brut − (CNSS + IR + exceptionnelles + pénalité)
 *
 * ⚠️ Ce fichier figeait l'ANCIENNE règle : CNSS 5,6 % du salaire de BASE, IRPP RÉSIDUEL, et
 * un net qui ne déduisait NI l'un NI l'autre (`net = brut − deductions − pénalité`). Autrement
 * dit un bulletin sans retenue saisie imprimait net = brut, cotisations affichées à titre
 * décoratif. Pendant ce temps l'onglet RH déduisait 8 % + 5 %. Le test verrouillait donc la
 * divergence au lieu de la détecter.
 */
const rec = (over: Partial<PayRecord> = {}): PayRecord => ({
  id: 'pay1', employeeId: 'emp1', employee: 'X', avatar: 'X', color: '#000', role: 'Caissier',
  baseSalary: 260000, bonus: 0, overtime: 0, deductions: 0, absences: 0,
  status: 'EN ATTENTE', paidAt: null, month: 'Mai 2026', ...over,
})

describe('taux — les constantes sont la seule source', () => {
  it('CNSS 8 %, IR 5 %, mois de 26 jours ouvrés', () => {
    expect(CNSS_RATE).toBe(0.08)
    expect(IR_RATE).toBe(0.05)
    expect(WORKING_DAYS).toBe(26)
  })
})

describe('calcBrut', () => {
  it('= base + primes + heures sup (les cotisations ne touchent pas le brut)', () => {
    expect(calcBrut(rec({ baseSalary: 260000, bonus: 40000, overtime: 10000 }))).toBe(310000)
    expect(calcBrut(rec({ baseSalary: 260000 }))).toBe(260000)
  })
})

describe('calcNet — les cotisations sont RÉELLEMENT déduites', () => {
  it('salaire nu : net = brut − CNSS − IR (et non net = brut)', () => {
    // 260000 → cnss 20800, ir 13000 → net 226200
    expect(calcNet(rec({ baseSalary: 260000 }))).toBe(226200)
  })

  it('primes et heures sup élargissent l’ASSIETTE des cotisations', () => {
    // brut 310000 → cnss 24800, ir 15500 → net 269700
    expect(calcNet(rec({ baseSalary: 260000, bonus: 40000, overtime: 10000 }))).toBe(269700)
  })

  it('la retenue exceptionnelle s’AJOUTE aux cotisations', () => {
    // brut 260000 → cnss 20800, ir 13000, exceptionnelle 30000 → net 196200
    expect(calcNet(rec({ baseSalary: 260000, deductions: 30000 }))).toBe(196200)
  })

  it('pénalité d’absence = round(absences × base / 26), cumulée aux cotisations', () => {
    // 2 absences sur base 260000 → 20000 ; net = 260000 − 20800 − 13000 − 20000
    expect(calcNet(rec({ baseSalary: 260000, absences: 2 }))).toBe(206200)
    // arrondi : 1 absence base 250000 → round(9615.38) = 9615
    expect(calcNet(rec({ baseSalary: 250000, absences: 1 })))
      .toBe(250000 - Math.round(250000 * 0.08) - Math.round(250000 * 0.05) - 9615)
  })

  it('combine tout', () => {
    const net = calcNet(rec({ baseSalary: 260000, bonus: 40000, overtime: 10000, deductions: 15000, absences: 2 }))
    // brut 310000 − cnss 24800 − ir 15500 − exc 15000 − absence 20000 = 234700
    expect(net).toBe(234700)
  })
})

describe('payrollBreakdown — décomposition', () => {
  it('CNSS et IR sont assis sur le BRUT, pas sur le salaire de base', () => {
    const bd = payrollBreakdown(rec({ baseSalary: 200000, bonus: 100000 }))
    expect(bd.brut).toBe(300000)
    expect(bd.cnss).toBe(24000) // 8 % de 300000, PAS de 200000 (= 16000)
    expect(bd.ir).toBe(15000)   // 5 % de 300000
  })

  it('`exceptional` reflète la saisie, distincte des cotisations', () => {
    const bd = payrollBreakdown(rec({ baseSalary: 260000, deductions: 30000 }))
    expect(bd.exceptional).toBe(30000)
    expect(bd.cnss).toBe(20800)
    // Sous l'ancienne règle, l'IRPP « résiduel » valait 30000 − cnss − 0. Plus maintenant :
    // l'IR ne dépend PAS de ce que le gérant a saisi.
    expect(bd.ir).toBe(13000)
  })

  it('totalDeductions = CNSS + IR + exceptionnelles + pénalité absence', () => {
    const bd = payrollBreakdown(rec({ baseSalary: 260000, deductions: 15000, absences: 2 }))
    expect(bd.totalDeductions).toBe(bd.cnss + bd.ir + bd.exceptional + bd.absencePenalty)
    expect(bd.totalDeductions).toBe(20800 + 13000 + 15000 + 20000)
  })

  it('net = brut − totalDeductions, et concorde avec calcNet/calcBrut', () => {
    const r = rec({ baseSalary: 260000, bonus: 40000, overtime: 10000, deductions: 15000, absences: 2 })
    const bd = payrollBreakdown(r)
    expect(bd.brut).toBe(calcBrut(r))
    expect(bd.net).toBe(calcNet(r))
    expect(bd.net).toBe(bd.brut - bd.totalDeductions)
  })

  it('salaire à zéro — aucun NaN', () => {
    const bd = payrollBreakdown(rec({ baseSalary: 0 }))
    expect(bd.net).toBe(0)
    expect(Number.isNaN(bd.cnss)).toBe(false)
  })
})
