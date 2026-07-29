import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { payrollBreakdown, payrollDisplay } from '@/components/payroll/payrollShared'

/**
 * ⚠️ COHÉRENCE ARITHMÉTIQUE DU BULLETIN dans la devise d'AFFICHAGE.
 *
 * Le calcul vit en XOF ; l'affichage peut être en EUR/USD/… à 2 décimales. Convertir chaque
 * ligne PUIS le total séparément donne un document qui ne s'additionne pas — l'employé qui
 * additionne les lignes n'obtient pas le total imprimé.
 *
 * Règle imposée : total = SOMME des lignes arrondies · net = brut − total.
 */

interface Cas {
  label: string
  entree: { baseSalary: number; bonus: number; overtime: number; deductions: number; absences: number }
  attendu: Record<string, number>
}
const CAS = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'payroll-net-cases.json'), 'utf-8',
)) as { cas: Cas[] }

describe('CAS DORÉ — 350 000 XOF affichés en EUR', () => {
  const d = payrollDisplay({ baseSalary: 350000, bonus: 0, overtime: 0, deductions: 0, absences: 0 }, 'EUR')

  it('brut 533,57 · CNSS 42,69 · IR 26,68 · total 69,37 · net 464,20', () => {
    expect(d.brut).toBe(533.57)
    expect(d.cnss).toBe(42.69)
    expect(d.ir).toBe(26.68)
    expect(d.totalDeductions).toBe(69.37)
    expect(d.net).toBe(464.20)
  })

  it('le total est la SOMME DES LIGNES, pas la conversion du total XOF', () => {
    expect(d.cnss + d.ir).toBe(69.37)
    // ⚠️ Contre-preuve : convertir le total XOF (45 500) donnerait 69,36 — l'ancienne voie.
    // Le test échouerait donc si on revenait à une conversion du total.
    expect(d.totalDeductions).not.toBe(69.36)
  })

  it('le net se déduit du total AFFICHÉ, pas de la conversion du net XOF', () => {
    expect(d.net).toBe(Math.round((d.brut - d.totalDeductions) * 100) / 100)
    // Convertir le net XOF (304 500) donnerait 464,21 : à un centime, mais incohérent.
    expect(d.net).not.toBe(464.21)
  })
})

describe('cohérence sur TOUT le fixture, dans chaque devise', () => {
  const DEVISES = ['XOF', 'XAF', 'EUR', 'USD', 'CAD', 'GBP']

  it.each(DEVISES)('%s : somme(lignes) == total affiché, et net == brut − total', (cur) => {
    for (const c of CAS.cas) {
      const d = payrollDisplay(c.entree, cur)
      const dec = cur === 'XOF' || cur === 'XAF' ? 0 : 2
      const f = 10 ** dec
      const somme = Math.round((d.cnss + d.ir + d.absencePenalty + d.exceptional) * f) / f
      expect(d.totalDeductions).toBe(somme)
      expect(d.net).toBe(Math.round((d.brut - d.totalDeductions) * f) / f)
    }
  })

  it('les GAINS s’additionnent aussi : base + primes + heures sup == brut affiché', () => {
    for (const cur of DEVISES) {
      const dec = cur === 'XOF' || cur === 'XAF' ? 0 : 2
      const f = 10 ** dec
      for (const c of CAS.cas) {
        const d = payrollDisplay(c.entree, cur)
        expect(d.brut).toBe(Math.round((d.baseSalary + d.bonus + d.overtime) * f) / f)
      }
    }
  })

  it('XOF : neutre — les valeurs restent celles du calcul (aucune conversion, 0 décimale)', () => {
    for (const c of CAS.cas) {
      const bd = payrollBreakdown(c.entree)
      const d = payrollDisplay(c.entree, 'XOF')
      expect(d.brut).toBe(bd.brut)
      expect(d.cnss).toBe(bd.cnss)
      expect(d.ir).toBe(bd.ir)
      expect(d.net).toBe(bd.net)
    }
  })

  it('les montants affichés n’ont JAMAIS plus de décimales que la devise', () => {
    for (const cur of DEVISES) {
      const dec = cur === 'XOF' || cur === 'XAF' ? 0 : 2
      for (const c of CAS.cas) {
        const d = payrollDisplay(c.entree, cur)
        for (const [k, v] of Object.entries(d)) {
          const decimales = (String(v).split('.')[1] ?? '').length
          expect(decimales, `${cur} ${k}=${v}`).toBeLessThanOrEqual(dec)
        }
      }
    }
  })
})
