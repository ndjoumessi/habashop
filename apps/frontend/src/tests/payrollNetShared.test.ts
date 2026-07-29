import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { payrollBreakdown, calcNet, calcBrut } from '@/components/payroll/payrollShared'

/**
 * ⚠️ CALCUL DE PAIE — moitié FRONTEND d'un test JUMEAU.
 *
 * Le front AFFICHE ce calcul (aperçu du mois courant), le back le FIGE en base au moment de
 * la génération (`model Payroll` = instantané gelé). Deux exécutions de la même règle ⇒ dérive
 * possible. `apps/backend/src/tests/payrollNetShared.test.ts` lit le MÊME fichier de cas :
 * modifier une règle d'un seul côté fait rougir l'autre.
 *
 * ⚠️ Distinct de `payroll-calc.test.ts`, qui verrouille le détail du bulletin (CNSS/IRPP
 * affichés). Ici on garde l'ÉGALITÉ avec le serveur, pas le rendu.
 */

interface Cas {
  label: string
  entree: { baseSalary: number; bonus: number; overtime: number; deductions: number; absences: number }
  attendu: Record<string, number>
}

const CAS = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'payroll-net-cases.json'), 'utf-8',
)) as { cas: Cas[] }

describe('payrollBreakdown — cas partagés front↔back', () => {
  it('le fichier de cas est chargé (sinon les `it.each` seraient vides et VERTS)', () => {
    expect(CAS.cas.length).toBeGreaterThanOrEqual(8)
    expect(CAS.cas.some(c => c.attendu.net < 0)).toBe(true)
    expect(CAS.cas.some(c => c.attendu.absencePenalty > 0)).toBe(true)
  })

  it.each(CAS.cas.map(c => [c.label, c.entree, c.attendu] as const))(
    '%s', (_label, entree, attendu) => {
      expect(payrollBreakdown(entree)).toMatchObject(attendu)
    },
  )

  it('`calcNet`/`calcBrut` rendent le `net`/`brut` du détail (pas un second calcul)', () => {
    for (const c of CAS.cas) {
      // `calcNet`/`calcBrut` prennent un PayRecord complet ; seuls les champs de calcul comptent.
      const r = { ...c.entree } as Parameters<typeof calcNet>[0]
      expect(calcNet(r)).toBe(c.attendu.net)
      expect(calcBrut(r)).toBe(c.attendu.brut)
    }
  })
})
