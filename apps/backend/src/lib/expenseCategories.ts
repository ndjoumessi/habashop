/**
 * CATÉGORIES DE DÉPENSE — jumeau backend de `CATEGORIES` (`components/expenses/expensesShared.tsx`).
 *
 * ⚠️ La valeur EST la clé : « Loyer », « Énergie »… voyagent telles quelles dans l'API et
 * servent de clé unique dans `ExpenseBudget`. Elles ne sont jamais traduites — seul
 * l'affichage l'est, côté front. Traduire la clé rendrait les budgets d'une boutique
 * illisibles au changement de langue, exactement le défaut que `month` en paie a fermé
 * (clé ISO `YYYY-MM`, jamais le libellé d'écran).
 *
 * ⚠️ POURQUOI UNE LISTE ICI PLUTÔT QU'UN IMPORT DE LA FIXTURE. Le contexte Docker du
 * backend est `apps/backend` SEUL : `docs/` n'y est pas. Un `import … from '…/docs/…'`
 * compilerait en local puis casserait le déploiement en TS2307. La fixture partagée est
 * lue par les TESTS des deux côtés (`expense-categories.json`) : modifier une liste sans
 * l'autre fait rougir le jumeau d'en face.
 */
export const EXPENSE_CATEGORIES = [
  'Loyer', 'Énergie', 'Transport', 'Maintenance',
  'Fournitures', 'Marketing', 'Formation', 'Autre',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

const SET = new Set<string>(EXPENSE_CATEGORIES)

/**
 * Une chaîne quelconque est-elle une catégorie connue ?
 *
 * ⚠️ Liste blanche, PAS une regex de forme. Le même raisonnement que `normalizeCountry` :
 * une regex accepterait « Crypto » et remplacerait une valeur invalide BRUYANTE par une
 * valeur invalide SILENCIEUSE, écrite en base et invisible à l'écran (aucune carte ne la
 * rend, puisque l'UI itère sur la liste connue).
 */
export function isExpenseCategory(v: unknown): v is ExpenseCategory {
  return typeof v === 'string' && SET.has(v)
}
