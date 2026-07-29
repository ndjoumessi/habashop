/**
 * Calcul de paie — MIROIR EXACT du frontend (`components/payroll/payrollShared.tsx`).
 *
 * ⚠️ Pourquoi un miroir plutôt qu'un seul calcul : le `net` d'un bulletin est FIGÉ en base au
 * moment de la génération (cf. `model Payroll`), donc le serveur doit savoir le calculer. Le
 * front, lui, l'affiche avant génération (aperçu du mois en cours). Deux besoins, deux
 * exécutions — d'où le risque de dérive.
 *
 * ⚠️ Les deux côtés sont exercés sur `docs/shared-fixtures/payroll-net-cases.json` : modifier
 * une règle d'un seul côté fait rougir l'autre. Même convention anti-dérive que
 * `loyalty-discount-cases`, `barcode-cases` et `csv-injection-cases`.
 *
 * Base XOF, arrondis à l'unité — c'est la devise de stockage (cf. § Règles devise).
 */

/** Taux de cotisation CNSS appliqué au salaire de base. */
export const CNSS_RATE = 0.056

/** Un mois de paie compte 26 jours ouvrés — base de la retenue pour absence. */
export const WORKING_DAYS = 26

export interface PayrollInput {
  baseSalary: number
  bonus: number
  overtime: number
  deductions: number
  absences: number
}

export interface PayrollBreakdown {
  brut: number            // base + primes + heures sup
  absencePenalty: number  // retenue absences = round(absences × base / 26)
  cnss: number            // cotisation CNSS = round(base × 5,6 %)
  irpp: number            // impôt résiduel = round(retenues − CNSS − pénalité absence)
  totalDeductions: number // retenues affichées = retenues saisies + pénalité absence
  net: number             // net à payer = brut − retenues saisies − pénalité absence
}

export function payrollBreakdown(r: PayrollInput): PayrollBreakdown {
  const brut = r.baseSalary + r.bonus + r.overtime
  const absencePenalty = Math.round(r.absences * r.baseSalary / WORKING_DAYS)
  const cnss = Math.round(r.baseSalary * CNSS_RATE)
  const irpp = Math.round(r.deductions - cnss - absencePenalty)
  return {
    brut,
    absencePenalty,
    cnss,
    irpp,
    totalDeductions: r.deductions + absencePenalty,
    net: brut - r.deductions - absencePenalty,
  }
}

/** Net à payer — le seul chiffre FIGÉ en base parmi les dérivés. */
export function payrollNet(r: PayrollInput): number {
  return payrollBreakdown(r).net
}

/**
 * Clé de mois acceptée en base : "YYYY-MM" strict.
 *
 * ⚠️ Le front manipule un LIBELLÉ français (« Juillet 2026 ») ; il ne doit jamais atteindre la
 * base — une clé qui dépend de la langue d'affichage rend les données illisibles dès qu'on
 * change de locale, et deux tenants en langues différentes écriraient des mois incompatibles.
 * La conversion vit côté front (`monthKey`), le serveur REFUSE tout le reste.
 */
export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidMonthKey(v: string): boolean {
  return MONTH_KEY.test(v)
}
