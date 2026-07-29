import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { payrollBreakdown, payrollNet, isValidMonthKey } from '../utils/payroll'

/**
 * ⚠️ CALCUL DE PAIE — moitié BACKEND d'un test JUMEAU.
 *
 * Le front AFFICHE ce calcul (aperçu du mois courant), le back le FIGE en base au moment de
 * la génération (`model Payroll` = instantané gelé). Deux exécutions de la même règle ⇒ dérive
 * possible. `apps/frontend/src/tests/payrollNetShared.test.ts` lit le MÊME fichier de cas :
 * modifier une règle d'un seul côté fait rougir l'autre.
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
    // Contre-preuve : le jeu contient bien des cas NON triviaux (arrondis, net négatif),
    // pas seulement des zéros qui passeraient avec n'importe quelle formule.
    expect(CAS.cas.some(c => c.attendu.net < 0)).toBe(true)
    expect(CAS.cas.some(c => c.attendu.absencePenalty > 0)).toBe(true)
  })

  it.each(CAS.cas.map(c => [c.label, c.entree, c.attendu] as const))(
    '%s', (_label, entree, attendu) => {
      expect(payrollBreakdown(entree)).toMatchObject(attendu)
    },
  )

  it('`payrollNet` rend exactement le `net` du détail (pas un second calcul)', () => {
    for (const c of CAS.cas) expect(payrollNet(c.entree)).toBe(c.attendu.net)
  })
})

describe('clé de mois — le libellé d’affichage n’atteint JAMAIS la base', () => {
  it.each([['2026-01'], ['2026-07'], ['2026-12'], ['1999-10']])('accepte %s', (v) => {
    expect(isValidMonthKey(v)).toBe(true)
  })

  it.each([
    ['Juillet 2026', 'libellé FR — la clé dépendrait de la langue d’affichage'],
    ['July 2026',    'libellé EN — deux tenants en langues différentes écriraient des mois incompatibles'],
    ['2026-13',      'mois 13'],
    ['2026-00',      'mois 0'],
    ['2026-7',       'mois non zéro-paddé — trierait mal et casserait l’unicité'],
    ['2026',         'année seule'],
    ['',             'vide'],
  ])('refuse %s (%s)', (v) => {
    expect(isValidMonthKey(v)).toBe(false)
  })
})
