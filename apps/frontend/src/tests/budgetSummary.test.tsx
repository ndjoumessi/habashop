import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { buildBudgetSummary } from '@/components/expenses/budgetSummary'
import { CATEGORIES, BUDGETS_INIT, monthYearLabel } from '@/components/expenses/expensesShared'
import type { Category } from '@/components/expenses/expensesShared'

/**
 * VERROUS DU PANNEAU BUDGÉTAIRE.
 *
 * Le défaut fermé ici a été MESURÉ en production le 2026-08-08 sur `demo-tenant-001` :
 * 15 dépenses, toutes en mars/avril/mai 2026 (3 × 355 000), zéro en août. L'écran
 * affichait « Total dépensé 1 065 000 » (tout l'historique) à côté d'un « Écart
 * 1 350 000 » (budget − août), sous un titre « Résumé MENSUEL ».
 *
 * ⚠️ Les chiffres des cas ci-dessous sont ceux de la MESURE, pas des valeurs inventées :
 * un cas doré construit au hasard n'aurait pas reproduit la coïncidence qui rendait le
 * défaut crédible (79 % = 1 065 000 / 1 350 000, un taux parfaitement plausible).
 */

/** Jeu de production, reproduit tel que mesuré. `amount` = `amountHT`. */
const DEPENSES_REELLES = [
  ...['2026-03', '2026-04', '2026-05'].flatMap(m => [
    { date: `${m}-05`, category: 'Loyer' as const, amount: 200_000 },
    { date: `${m}-05`, category: 'Énergie' as const, amount: 45_000 },
    { date: `${m}-05`, category: 'Transport' as const, amount: 60_000 },
    { date: `${m}-05`, category: 'Fournitures' as const, amount: 20_000 },
    { date: `${m}-05`, category: 'Marketing' as const, amount: 30_000 },
  ]),
]

const duMois = (prefixe: string) => DEPENSES_REELLES.filter(e => e.date.startsWith(prefixe))

/* ══════════════════════════════════════════════════════════════════════════════
   ① L'INVARIANT — une seule population
   ══════════════════════════════════════════════════════════════════════════════ */

describe('buildBudgetSummary — les trois nombres décrivent LA MÊME période', () => {
  it('⚠️ totalSpent est EXACTEMENT la somme des catégories', () => {
    // C'est l'invariant qui était rompu : le total venait d'un `reduce` sur une autre
    // liste que celle des cartes. Ici il ne PEUT plus diverger, il en est dérivé.
    const s = buildBudgetSummary(duMois('2026-05'), BUDGETS_INIT, CATEGORIES)
    const somme = CATEGORIES.reduce((acc, c) => acc + s.spentByCategory[c], 0)
    expect(s.totalSpent).toBe(somme)
    expect(s.totalSpent).toBe(355_000)
  })

  it('⚠️ variance = budget − total AFFICHÉ, jamais − une autre période', () => {
    const s = buildBudgetSummary(duMois('2026-05'), BUDGETS_INIT, CATEGORIES)
    expect(s.totalBudget).toBe(1_350_000)
    expect(s.variance).toBe(s.totalBudget - s.totalSpent)
    expect(s.variance).toBe(995_000)
  })

  it('⚠️ LE CAS DE PRODUCTION : mois sans dépense → tout à zéro, PAS l’historique', () => {
    // Août 2026 : aucune dépense. L'ancien calcul rendait 1 065 000 (mars+avril+mai)
    // pour le total et le taux, et 1 350 000 pour l'écart. Les trois se contredisaient.
    const s = buildBudgetSummary(duMois('2026-08'), BUDGETS_INIT, CATEGORIES)
    expect(s.totalSpent).toBe(0)
    expect(s.variance).toBe(1_350_000)
    expect(s.usagePct).toBe(0)
    for (const c of CATEGORIES) expect(s.spentByCategory[c]).toBe(0)
  })

  it('⚠️ le cumul de TROIS mois n’est jamais comparé à un budget MENSUEL', () => {
    // 600 000 de loyer, c'est 3 × 200 000 — pas un dépassement d'un budget de 500 000.
    const cumul = buildBudgetSummary(DEPENSES_REELLES, BUDGETS_INIT, CATEGORIES)
    expect(cumul.spentByCategory.Loyer, 'témoin : le cumul vaut bien 600 000').toBe(600_000)
    const unMois = buildBudgetSummary(duMois('2026-05'), BUDGETS_INIT, CATEGORIES)
    expect(unMois.spentByCategory.Loyer).toBe(200_000)
    expect(unMois.spentByCategory.Loyer, 'un loyer mensuel ne dépasse pas son budget mensuel')
      .toBeLessThanOrEqual(BUDGETS_INIT.Loyer)
  })
})

describe('buildBudgetSummary — cas limites', () => {
  it('⚠️ aucun budget → usagePct NULL, jamais Infinity', () => {
    // `1 065 000 / 0 * 100` rendait `Infinity`, affiché « Infinity % ».
    const zeros = CATEGORIES.reduce((a, c) => { a[c] = 0; return a }, {} as Record<Category, number>)
    const s = buildBudgetSummary(duMois('2026-05'), zeros, CATEGORIES)
    expect(s.usagePct).toBeNull()
    expect(Number.isFinite(s.totalSpent)).toBe(true)
  })

  it('liste vide : tout à zéro, et le taux vaut 0 (pas null — le budget existe)', () => {
    const s = buildBudgetSummary([], BUDGETS_INIT, CATEGORIES)
    expect(s.totalSpent).toBe(0)
    expect(s.usagePct).toBe(0)
  })

  it('une catégorie inconnue n’est pas silencieusement comptée', () => {
    const s = buildBudgetSummary([{ category: 'Crypto', amount: 999 }], BUDGETS_INIT, CATEGORIES)
    expect(s.totalSpent, 'une catégorie hors domaine ne gonfle aucun total').toBe(0)
  })

  it('un montant non numérique ne propage pas NaN', () => {
    const s = buildBudgetSummary(
      [{ category: 'Loyer', amount: Number.NaN }, { category: 'Loyer', amount: 200_000 }],
      BUDGETS_INIT, CATEGORIES,
    )
    expect(s.totalSpent).toBe(200_000)
  })
})

describe('monthYearLabel — source unique, now injecté', () => {
  it('rend le mois capitalisé, dans les 4 langues', () => {
    const d = new Date(2026, 7, 8)
    expect(monthYearLabel('fr', d)).toBe('Août 2026')
    expect(monthYearLabel('en', d)).toBe('August 2026')
    for (const l of ['fr', 'en', 'es', 'it']) {
      expect(monthYearLabel(l, d).length, `langue ${l}`).toBeGreaterThan(3)
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   ② CÂBLAGE — la PAGE passe-t-elle vraiment la population du mois ?
   ══════════════════════════════════════════════════════════════════════════════
   ⚠️ L'invariant pur ne dit RIEN de ce que l'appelant en fait : `buildBudgetSummary`
   resterait vert si `Expenses.tsx` lui repassait `expenses` au lieu de `thisMonth`.
   C'est la leçon du sabotage S3, et c'est exactement le défaut d'origine.
   ══════════════════════════════════════════════════════════════════════════════ */

const AUJOURDHUI = new Date(2026, 7, 8)

/**
 * Lit les trois nombres du résumé DANS LE DOM RENDU.
 *
 * ⚠️ QUATRE séparateurs de milliers coexistent dans ce dépôt — espace, U+202F
 * (`toLocaleString('fr-FR')`), U+00A0, virgule. On NORMALISE avant de chercher,
 * jamais l'inverse : un verrou qui cherche « 1 350 000 » avec une espace ordinaire
 * ne trouve rien dans une chaîne qui porte une espace fine insécable.
 */
function nombreDe(txt: string): number | null {
  const norm = txt.replace(/[\u0020\u00a0\u202f\u2009]/g, '').replace(/,/g, '')
  const m = /(-?\d+)/.exec(norm)
  return m ? Number(m[1]) : null
}

function lireResume(root: HTMLElement) {
  const ligne = (motif: RegExp): number | null => {
    for (const el of Array.from(root.querySelectorAll('div'))) {
      const enfants = Array.from(el.children)
      if (enfants.length !== 2) continue
      if (!motif.test(enfants[0].textContent ?? '')) continue
      return nombreDe(enfants[1].textContent ?? '')
    }
    return null
  }
  return {
    total:  ligne(/Total dépensé|Total spent/i),
    budget: ligne(/Budget total mensuel|Total monthly budget/i),
    ecart:  ligne(/^Écart$|^Variance$/i),
  }
}


vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/lib/api', () => ({
  expensesApi: {
    list: vi.fn(() => Promise.resolve([
      // Mêmes données qu'en production : rien dans le mois courant.
      ...['2026-03', '2026-04', '2026-05'].flatMap(m => [
        { id: `${m}-1`, date: `${m}-05T00:00:00.000Z`, label: 'Loyer boutique', category: 'Loyer', amountHT: 200_000, vat: 0, mode: 'Virement', status: 'PAYÉ', recurrent: true },
        { id: `${m}-2`, date: `${m}-05T00:00:00.000Z`, label: 'Électricité', category: 'Énergie', amountHT: 45_000, vat: 18, mode: 'Espèces', status: 'PAYÉ', recurrent: true },
      ]),
      // ⚠️ UNE dépense dans le MOIS COURANT, et c'est indispensable. Sans elle,
      // `totalSpent` vaut 0 : `budget − 0` et `budget − totalSpent` deviennent
      // indiscernables, et le sabotage « l'écart repart d'une autre base » passe
      // VERT. Un jeu d'essai calé pile sur la valeur limite ne démontre rien —
      // c'est la leçon de `demo-tenant-001` et ses exactement 6 catégories.
      // 20 000 < budget Fournitures (50 000) : aucun dépassement légitime attendu.
      { id: 'aout-1', date: '2026-08-03T00:00:00.000Z', label: 'Papeterie', category: 'Fournitures', amountHT: 20_000, vat: 18, mode: 'Espèces', status: 'PAYÉ', recurrent: false },
    ])),
    create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  },
  salesApi: { list: vi.fn(() => Promise.resolve([])) },
}))

describe('Expenses — le panneau est COHÉRENT à l’écran', () => {
  beforeEach(() => { vi.setSystemTime(AUJOURDHUI) })

  const ouvrirBudget = async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(AUJOURDHUI)
    const { default: Expenses } = await import('@/pages/Expenses')
    const vue = render(<Expenses />)
    await waitFor(() => expect(screen.queryByText(/Journal des dépenses|Expense journal/i)).not.toBeNull())
    // ⚠️ `role="tab"`, pas `button` — `TabBar` rend un vrai tablist accessible.
    fireEvent.click(screen.getByRole('tab', { name: /Budget/i }))
    return vue
  }

  it('⚠️ « Total dépensé » + « Écart » = « Budget total » — l’invariant, pas un littéral', async () => {
    // ⚠️ PREMIÈRE VERSION FAUSSE, gardée en mémoire : elle assertait l'absence du
    // littéral « 1 065 000 ». Ce nombre vient de la PRODUCTION ; le jeu de test, lui,
    // en produit un autre. L'assertion ne pouvait donc jamais échouer — le verrou
    // cherchait une forme qui n'existait pas ici. C'est l'angle mort nº3 (la FORME).
    // On juge maintenant la relation entre les trois nombres RÉELLEMENT rendus.
    const { container } = await ouvrirBudget()
    const lu = lireResume(container)
    expect(lu.total, '« Total dépensé » illisible').not.toBeNull()
    expect(lu.budget, '« Budget total » illisible').not.toBeNull()
    expect(lu.ecart, '« Écart » illisible').not.toBeNull()
    expect(lu.total! + lu.ecart!, `total ${lu.total} + écart ${lu.ecart} ≠ budget ${lu.budget}`)
      .toBe(lu.budget!)
    /**
     * ⚠️ ET LA POPULATION, séparément. La cohérence seule ne suffit PAS : depuis le
     * refactor, `total`, `écart` et `taux` dérivent tous du même résumé, donc ils
     * restent d'accord même si l'appelant lui passe la MAUVAISE liste. Mesuré : le
     * sabotage « repasser `expenses` au lieu de `thisMonth` » laissait l'invariant
     * VERT. Le mois courant du test (août 2026) ne porte aucune dépense ; les données
     * simulées valent 735 000 sur mars→mai. Le total DOIT être 0.
     */
    // 20 000 = la seule dépense d'août. L'historique (mars→mai) pèse 735 000 : le
    // total ne doit JAMAIS s'en approcher.
    expect(lu.total, 'le panneau montre l’historique au lieu du mois courant').toBe(20_000)
    expect(container.textContent).not.toMatch(/Infinity/)
    vi.useRealTimers()
  })

  it('⚠️ la période est NOMMÉE dans le titre du résumé', async () => {
    const { container } = await ouvrirBudget()
    const attendu = monthYearLabel('fr', AUJOURDHUI)
    expect(container.textContent, `le résumé doit dire « ${attendu} »`).toContain(attendu)
    vi.useRealTimers()
  })

  it('⚠️ aucun badge « Dépassé ! » sur un mois sans dépense', async () => {
    // C'est le symptôme qu'un commerçant voyait en permanence : trois mois de loyer
    // comparés à un budget mensuel. Sans dépense du mois, rien ne peut être dépassé.
    const { container } = await ouvrirBudget()
    expect(container.textContent).not.toMatch(/Dépassé !/)
    vi.useRealTimers()
  })

  it('⚠️ un mois SANS dépense le DIT, au lieu de huit cartes muettes à 0 %', async () => {
    // Avant le correctif, ces cartes montraient l'historique : les voir passer à 0
    // sans explication se lit « mes dépenses ont disparu ». L'état vide se constate,
    // il ne se félicite pas — pas de « budget respecté », pas de coche.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 10, 15))          // novembre 2026 : rien du tout
    const { default: Expenses } = await import('@/pages/Expenses')
    const { container } = render(<Expenses />)
    await waitFor(() => expect(screen.queryByText(/Journal des dépenses/i)).not.toBeNull())
    fireEvent.click(screen.getByRole('tab', { name: /Budget/i }))
    const txt = container.textContent ?? ''
    expect(txt).toMatch(/Aucune dépense enregistrée/i)
    expect(txt).toContain(monthYearLabel('fr', new Date(2026, 10, 15)))
    expect(txt, 'un état vide ne félicite pas').not.toMatch(/respecté|Dépassé !/i)
    vi.useRealTimers()
  })

  it('⚠️ « Modifier les budgets » n’annonce PAS un enregistrement', async () => {
    // Le message disait « Budgets mis à jour » alors qu'aucun modèle `Budget`
    // n'existe en base : la valeur disparaît au rechargement.
    const { default: toast } = await import('react-hot-toast')
    await ouvrirBudget()
    fireEvent.click(screen.getByRole('button', { name: /Modifier les budgets|Edit budgets/i }))
    const dialog = await screen.findByRole('dialog')
    // ⚠️ Ciblé par sa CLASSE, pas par son libellé : un test qui nomme le texte du
    // bouton devient un frein le jour où on corrige ce texte — ce qu'on vient de faire.
    const valider = dialog.querySelector('.btn-primary') as HTMLButtonElement | null
    expect(valider, 'bouton principal introuvable dans la modale').not.toBeNull()
    fireEvent.click(valider!)
    const dit = (toast.success as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)?.[0]
    expect(String(dit)).toMatch(/non enregistr|not saved/i)
    expect(String(dit), 'ne doit plus affirmer une mise à jour').not.toMatch(/^Budgets mis à jour$/)
    vi.useRealTimers()
  })
})
