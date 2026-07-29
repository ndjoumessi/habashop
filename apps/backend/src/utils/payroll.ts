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
 * ⚠️ IL Y AVAIT DEUX RÈGLES INCOMPATIBLES DANS LE DÉPÔT (mesuré 2026-07-30) : ce fichier et
 * `payrollShared.tsx` appliquaient CNSS **5,6 % du salaire de BASE** avec un IRPP **résiduel**,
 * et ni l'un ni l'autre ne réduisait le net (simple ventilation d'affichage de `deductions`) ;
 * `PayrollGrid.tsx` / `PayrollPayslips.tsx` appliquaient **8 % + 5 % du brut, réellement
 * déduits**. Sur 150 000 XOF sans prime : 150 000 imprimé par le PDF, 130 500 affiché par
 * l'onglet RH. Deux nets pour le même salaire, sur des documents remis à l'employé.
 *
 * RÈGLE RETENUE (arbitrage produit) : 8 % + 5 % du BRUT, calculés et DÉDUITS.
 *
 * Base XOF, arrondis à l'unité — c'est la devise de stockage (cf. § Règles devise).
 */

/** Cotisation salariale CNSS, assise sur le BRUT. */
export const CNSS_RATE = 0.08

/** Impôt sur salaire, assis sur le BRUT. */
export const IR_RATE = 0.05

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
  cnss: number            // round(brut × 8 %) — DÉDUITE
  ir: number              // round(brut × 5 %) — DÉDUIT
  absencePenalty: number  // round(absences × base / 26)
  exceptional: number     // retenues EXCEPTIONNELLES saisies (avance, casse, saisie sur salaire)
  totalDeductions: number // cnss + ir + exceptionnelles + pénalité absence
  net: number             // brut − totalDeductions
}

/**
 * ⚠️ `deductions` = retenues EXCEPTIONNELLES : elles s'AJOUTENT aux cotisations, elles n'en
 * sont plus la ventilation. Une avance sur salaire et la CNSS sont deux choses distinctes ;
 * les confondre faisait qu'une avance de 0 annulait aussi les cotisations.
 */
export function payrollBreakdown(r: PayrollInput): PayrollBreakdown {
  const brut = r.baseSalary + r.bonus + r.overtime
  const cnss = Math.round(brut * CNSS_RATE)
  const ir   = Math.round(brut * IR_RATE)
  const absencePenalty = Math.round(r.absences * r.baseSalary / WORKING_DAYS)
  const exceptional = r.deductions
  const totalDeductions = cnss + ir + exceptional + absencePenalty
  return { brut, cnss, ir, absencePenalty, exceptional, totalDeductions, net: brut - totalDeductions }
}

/** Net à payer — le chiffre FIGÉ en base, avec `cnss` et `ir`. */
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
