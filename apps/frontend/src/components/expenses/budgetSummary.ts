import type { Category } from './expensesShared'

/**
 * RÉSUMÉ BUDGÉTAIRE — une seule population, calculée UNE fois.
 *
 * ─── LE DÉFAUT QUE CE MODULE FERME (mesuré le 2026-08-08, en production) ─────
 * L'écran « Budget vs Réel » affichait TROIS nombres tirés de DEUX populations :
 *
 *   « Total dépensé »      1 065 000   ← Σ des catégories, SANS filtre de date
 *   « Écart »              1 350 000   ← budget − dépenses du MOIS COURANT (0)
 *   « Taux d'utilisation »        79 % ← Σ des catégories / budget mensuel
 *
 * Les trois sont sous un titre « Résumé MENSUEL ». Le total et le taux portaient
 * sur tout l'historique (mars+avril+mai 2026 = 3 × 355 000), l'écart sur août seul.
 * Ils ne pouvaient pas être vrais ensemble : 1 350 000 − 1 065 000 = 285 000, pas
 * 1 350 000.
 *
 * ⚠️ LA CONSÉQUENCE N'ÉTAIT PAS COSMÉTIQUE. Les cartes de catégorie lisaient la
 * même somme sans date : « Loyer 600 000 » contre un budget MENSUEL de 500 000
 * affichait « Dépassé de 100 000 » — alors que 600 000, c'est TROIS loyers de
 * 200 000. Ce n'est pas un dépassement, c'est une erreur d'unité, et elle
 * s'aggrave mécaniquement : au sixième mois, « dépassé de 700 000 » sur un loyer
 * payé normalement. *Une alerte qui crie toujours n'alerte plus quand elle devient
 * vraie* — c'est la leçon du bandeau « modifications non sauvegardées ».
 *
 * ⚠️ L'INVARIANT VERROUILLÉ EST `totalSpent === Σ spentByCategory`, pas « les
 * nombres se ressemblent ». C'est le même raisonnement que `categoryBreakdown` :
 * un camembert peut sommer à 100 % d'un total faux. Ici, un panneau peut afficher
 * trois nombres plausibles qui décrivent trois périodes différentes.
 */

export interface BudgetSummary {
  /** Dépenses de la période, par catégorie. */
  spentByCategory: Record<Category, number>
  /** Σ de `spentByCategory` — par CONSTRUCTION, jamais recalculé ailleurs. */
  totalSpent: number
  totalBudget: number
  /** `totalBudget − totalSpent`. Positif = il reste du budget. */
  variance: number
  /**
   * `null` quand aucun budget n'est posé — JAMAIS un nombre.
   *
   * ⚠️ L'ancien calcul était `Math.round(spent / totalBudget * 100)` : avec tous
   * les budgets à zéro il rendait `Infinity`, affiché « Infinity % ». Un commerçant
   * qui remet ses budgets à plat voyait un pourcentage impossible. Même règle que
   * `ratingSummary` : une mesure sans dénominateur ne se dessine pas, elle se DIT.
   */
  usagePct: number | null
}

/** Ce dont le résumé a besoin d'une dépense — rien de plus. */
export interface BudgetExpense {
  category: string
  amount: number
}

/**
 * ⚠️ `expensesOfPeriod` EST DÉJÀ FILTRÉ par l'appelant, et c'est délibéré : la
 * période est décidée en un seul endroit (`thisMonth` dans `Expenses.tsx`), donc
 * il est IMPOSSIBLE que le total et l'écart portent sur deux périodes — c'était
 * exactement le défaut. Ne pas ajouter de filtre de date ici : ce serait un
 * second endroit où la période se décide, donc un second endroit où elle diverge.
 */
export function buildBudgetSummary(
  expensesOfPeriod: readonly BudgetExpense[],
  budgets: Record<Category, number>,
  categories: readonly Category[],
): BudgetSummary {
  const spentByCategory = categories.reduce((acc, cat) => {
    acc[cat] = expensesOfPeriod
      .filter(e => e.category === cat)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)
    return acc
  }, {} as Record<Category, number>)

  const totalSpent = categories.reduce((s, cat) => s + spentByCategory[cat], 0)
  const totalBudget = categories.reduce((s, cat) => s + (Number(budgets[cat]) || 0), 0)

  return {
    spentByCategory,
    totalSpent,
    totalBudget,
    variance: totalBudget - totalSpent,
    usagePct: totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : null,
  }
}
