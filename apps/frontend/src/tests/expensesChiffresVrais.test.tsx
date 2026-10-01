import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ExpensesBudget from '@/components/expenses/ExpensesBudget'
import ExpensesKpis from '@/components/expenses/ExpensesKpis'
import { buildBudgetSummary } from '@/components/expenses/budgetSummary'
import {
  enAttenteTTC, BUDGETS_INIT, CATEGORIES, type Expense, type Category,
} from '@/components/expenses/expensesShared'

/**
 * LES CHIFFRES TRONQUÉS DE L'ÉCRAN DÉPENSES.
 *
 * ⚠️ MESURÉ en production le 2026-10-01, sur une démo qui dépassait enfin un budget — le défaut
 * était INATTEIGNABLE avant, puisque aucun budget n'existait. Deux nombres affichés étaient des
 * valeurs BORNÉES, l'information réelle ne vivant que dans la couleur :
 *
 *   « Loyer · Dépassé ! · 100 % »       ← `Math.min(100, …)`, la vérité est 103 %
 *   « Budget restant · 0 FCFA » (rouge) ← `Math.max(0, budgetLeft)`, la vérité est −150 000
 *
 * ⚠️ UNE BARRE SE PLAFONNE, UN NOMBRE NON. La largeur d'une barre ne peut pas dépasser sa
 * piste ; l'étiquette à côté, si. Les faire partager une seule valeur bornée, c'est la
 * structure du camembert dont la géométrie et le libellé tiraient du même dénominateur.
 *
 * ⚠️ « 0 » N'EST PAS UN NOMBRE FAUX, C'EST UN NOMBRE PLAUSIBLE : « budget restant 0 » se lit
 * « j'ai tout consommé », pas « je suis 150 000 au-dessus ». La couleur rouge ne porte aucune
 * magnitude. Même famille que `rating ?? 0` et que la pastille qui ne peut pas rougir.
 *
 * ⚠️ LE « TAUX D'UTILISATION » DU RÉSUMÉ, LUI, ÉTAIT DÉJÀ JUSTE (`usagePct` n'est pas borné).
 * C'est ce qui a fait passer VERT le premier état de ce test : `getByText('900 %')` trouvait le
 * taux du résumé, pas la carte de catégorie. D'où la poignée `data-categorie`, qui borne
 * l'assertion à la carte visée — un test de rendu doit nommer l'élément qu'il juge.
 */

/**
 * ⚠️ QUATRE SÉPARATEURS DE MILLIERS COEXISTENT DANS CE DÉPÔT — U+0020, U+202F (celui que rend
 * `toLocaleString('fr-FR')`), U+00A0 et la virgule. On NORMALISE avant de chercher, jamais
 * l'inverse : comparer à un espace ordinaire ferait échouer ce test pour une raison qui n'a
 * rien à voir avec le défaut qu'il garde.
 */
const norm = (t: string | null | undefined) => (t ?? '').replace(/[\s\u00a0\u202f]+/g, ' ')

const carteCat = (container: HTMLElement, cat: Category): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-categorie="${cat}"]`)
  if (!el) throw new Error(`carte de catégorie « ${cat} » introuvable`)
  return el
}

/** La carte de KPI dont l'étiquette parle du budget — les autres KPI portent aussi des montants. */
const carteBudget = (): HTMLElement => {
  const cartes = [...document.querySelectorAll<HTMLElement>('.kpi-card')]
  const c = cartes.find(k => /budget/i.test(k.querySelector('.kpi-label')?.textContent ?? ''))
  if (!c) throw new Error(`aucune carte de budget parmi ${cartes.length} KPI`)
  return c
}

const rendreBudget = (budgetLoyer: number, depense: number) => {
  const budgets = { ...BUDGETS_INIT, Loyer: budgetLoyer }
  const summary = buildBudgetSummary([{ category: 'Loyer', amount: depense }], budgets, CATEGORIES)
  const r = render(
    <ExpensesBudget budgets={budgets} summary={summary} monthLabel="Octobre 2026" onEditBudgets={vi.fn()} />,
  )
  return { ...r, summary }
}

describe('écran Dépenses — aucun chiffre tronqué', () => {
  it('⚠️ le pourcentage AFFICHÉ sur la carte dit la vérité au-delà de 100 %', () => {
    const { container } = rendreBudget(145_000, 150_000)
    const carte = carteCat(container, 'Loyer')
    // 150 000 / 145 000 = 103,4 % → 103 %. « 100 % » sous un badge « Dépassé ! » se contredit.
    expect(norm(carte.textContent)).toContain('103 %')
    expect(norm(carte.textContent)).not.toContain('100 %')
  })

  it('⚠️ mais la BARRE reste plafonnée — une largeur ne dépasse pas sa piste', () => {
    const { container } = rendreBudget(10_000, 90_000)
    const carte = carteCat(container, 'Loyer')
    expect(norm(carte.textContent), 'le taux réel est annoncé').toContain('900 %')

    const largeurs = [...carte.querySelectorAll<HTMLElement>('div[style*="width"]')]
      .map(d => d.style.width).filter(w => w.endsWith('%'))
    expect(largeurs.length, 'la barre doit être trouvée dans la carte').toBeGreaterThan(0)
    for (const w of largeurs) expect(parseFloat(w), `largeur ${w}`).toBeLessThanOrEqual(100)
  })

  it('⚠️ budget DÉPASSÉ : la carte de KPI annonce le montant, jamais « 0 »', () => {
    const summary = buildBudgetSummary(
      [{ category: 'Loyer', amount: 300_000 }], { ...BUDGETS_INIT, Loyer: 145_000 }, CATEGORIES,
    )
    expect(summary.variance, 'le cas doit bien être un dépassement').toBeLessThan(0)
    render(<ExpensesKpis totalThisMonth={300_000} totalPending={0} pendingCount={0}
      recurrentCount={0} summary={summary} />)

    const c = carteBudget()
    expect(norm(c.textContent), 'le dépassement doit être nommé').toMatch(/dépassé/i)
    expect(norm(c.querySelector('.kpi-value')?.textContent), 'et chiffré').toContain('155 000')
  })

  it('⚠️ AUCUN budget posé n’est PAS un dépassement — état neutre et muet', () => {
    const summary = buildBudgetSummary([{ category: 'Loyer', amount: 150_000 }], BUDGETS_INIT, CATEGORIES)
    expect(summary.usagePct, 'sans budget, usagePct est null').toBeNull()
    render(<ExpensesKpis totalThisMonth={150_000} totalPending={0} pendingCount={0}
      recurrentCount={0} summary={summary} />)

    const c = carteBudget()
    // Ni « restant », ni « dépassé » : on ne qualifie rien par rapport à un budget absent.
    expect(norm(c.textContent), 'aucun dépassement sans budget').not.toMatch(/dépassé/i)
    expect(norm(c.textContent), 'aucun restant sans budget').not.toMatch(/restant/i)
    expect(norm(c.querySelector('.kpi-value')?.textContent), 'la dépense ne tient pas lieu de budget')
      .not.toContain('150 000')
  })

  it('⚠️ budget SOUS plafond : le restant est annoncé tel quel', () => {
    const summary = buildBudgetSummary(
      [{ category: 'Loyer', amount: 100_000 }], { ...BUDGETS_INIT, Loyer: 145_000 }, CATEGORIES,
    )
    render(<ExpensesKpis totalThisMonth={100_000} totalPending={0} pendingCount={0}
      recurrentCount={0} summary={summary} />)

    const c = carteBudget()
    expect(norm(c.textContent)).toMatch(/restant/i)
    expect(norm(c.querySelector('.kpi-value')?.textContent)).toContain('45 000')
  })
})

/**
 * « EN ATTENTE » : UNE grandeur, UNE base.
 *
 * ⚠️ MESURÉ : l'écran sommait les charges en attente en **HT** (150 000) et le PDF imprimait la
 * MÊME grandeur en **TTC** (177 000). Chaque surface était cohérente CHEZ ELLE, et aucune ne
 * disait sa base — un commerçant lisait deux nombres pour une seule chose. C'est la famille des
 * deux totaux d'une même grandeur sur deux populations, ici sur deux BASES.
 *
 * ⚠️ LA BASE RETENUE EST LE TTC, parce que le libellé dit « en attente de PAIEMENT » : ce qui
 * doit encore sortir de la caisse est le TTC. Une seule fonction le calcule et les DEUX surfaces
 * l'appellent — un second calcul redeviendrait un second résultat.
 */
describe('charges en attente — une seule base', () => {
  const dep = (o: Partial<Expense> & { category: Category }): Expense => ({
    id: 1, date: '2026-10-01', label: 'x', amount: 1000, vat: 18,
    mode: 'cash', status: 'EN ATTENTE', recurrent: false, ...o,
  })
  const liste: Expense[] = [
    dep({ id: 1, category: 'Loyer',     amount: 150_000, vat: 18, status: 'EN ATTENTE' }),
    dep({ id: 2, category: 'Autre',     amount: 8_000,   vat: 18, status: 'PAYÉ' }),
    dep({ id: 3, category: 'Transport', amount: 25_000,  vat: 0,  status: 'EN ATTENTE' }),
  ]

  it('⚠️ somme le TTC des SEULES charges en attente', () => {
    // 150 000 × 1,18 = 177 000 ; 25 000 à 0 % = 25 000 ; la payée est exclue.
    expect(enAttenteTTC(liste)).toBe(202_000)
  })

  it('⚠️ INVARIANT : en attente == total TTC − payé TTC, la base du PDF', () => {
    const ttc = (e: Expense) => Math.round(e.amount * (1 + e.vat / 100))
    const total = liste.reduce((s, e) => s + ttc(e), 0)
    const paye = liste.filter(e => e.status === 'PAYÉ').reduce((s, e) => s + ttc(e), 0)
    expect(enAttenteTTC(liste)).toBe(total - paye)
  })

  it('⚠️ liste vide : 0, et non NaN', () => {
    expect(enAttenteTTC([])).toBe(0)
  })
})
