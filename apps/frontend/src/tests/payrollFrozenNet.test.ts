import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { payrollBreakdown } from '@/components/payroll/payrollShared'

/**
 * ⚠️ LE VERROU : `Payroll.net` (gelé en base par le serveur) == `payslip.net` (imprimé par le
 * bulletin PDF côté client).
 *
 * Les deux surfaces ont divergé, et pas d'un centime : le PDF appliquait CNSS 5,6 % du salaire
 * de BASE avec un IRPP résiduel, et ne déduisait NI l'un NI l'autre du net ; l'onglet RH
 * déduisait 8 % + 5 % du brut. Sur 150 000 XOF sans prime : 150 000 imprimé contre 130 500
 * affiché. Ce test existe pour que ça ne revienne pas en silence.
 *
 * Il exerce le MÊME fichier de cas que `apps/backend/src/tests/payrollNetShared.test.ts`, qui
 * l'applique à `utils/payroll.ts` — celui qui écrit réellement `Payroll.net`. Modifier la règle
 * d'un seul côté fait donc rougir l'autre.
 */

interface Cas {
  label: string
  entree: { baseSalary: number; bonus: number; overtime: number; deductions: number; absences: number }
  attendu: Record<string, number>
}

const CAS = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'payroll-net-cases.json'), 'utf-8',
)) as { cas: Cas[] }

describe('Payroll.net == payslip.net — la même règle des deux côtés', () => {
  it('le fichier de cas est chargé (sinon tout ce bloc serait vert pour rien)', () => {
    expect(CAS.cas.length).toBeGreaterThanOrEqual(8)
  })

  it.each(CAS.cas.map(c => [c.label, c.entree, c.attendu] as const))(
    'net identique — %s', (_label, entree, attendu) => {
      const bd = payrollBreakdown(entree)
      // `attendu` est la valeur que le SERVEUR fige dans `Payroll.net`/`cnss`/`ir` (même
      // fixture, exercée par le test backend sur `utils/payroll.ts`). Le bulletin PDF doit
      // imprimer exactement ça.
      expect(bd.net).toBe(attendu.net)
      expect(bd.cnss).toBe(attendu.cnss)
      expect(bd.ir).toBe(attendu.ir)
    },
  )

  it('les cotisations SONT dans le net — un bulletin sans retenue saisie n’imprime pas net = brut', () => {
    // Exactement le bug qu'on ferme : avant, `deductions: 0` donnait net === brut, cotisations
    // affichées à titre décoratif.
    const bd = payrollBreakdown({ baseSalary: 150000, bonus: 0, overtime: 0, deductions: 0, absences: 0 })
    expect(bd.net).not.toBe(bd.brut)
    expect(bd.net).toBe(130500)
  })

  it('le net est la somme EXACTE des lignes affichées (aucun centime orphelin)', () => {
    for (const c of CAS.cas) {
      const bd = payrollBreakdown(c.entree)
      // Le PDF imprime cnss, ir, exceptionnelles et pénalité d'absence : leur somme doit
      // expliquer INTÉGRALEMENT l'écart brut → net, sinon le bulletin ne se justifie pas.
      expect(bd.cnss + bd.ir + bd.exceptional + bd.absencePenalty).toBe(bd.totalDeductions)
      expect(bd.brut - bd.totalDeductions).toBe(bd.net)
    }
  })
})
