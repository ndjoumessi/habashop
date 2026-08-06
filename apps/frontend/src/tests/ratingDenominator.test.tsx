import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { summarizeRatings, ratingValue, ratingCaption } from '@/lib/ratingSummary'

/**
 * VERROU — une moyenne ne se rend jamais sans son effectif, et une valeur par défaut de
 * schéma n'atteint jamais un écran.
 *
 * ─── LE DÉFAUT QU'ON FERME ───────────────────────────────────────────────────
 * `Employee.perf` et `Supplier.rating` étaient `Int NOT NULL DEFAULT 3`. Une boutique neuve
 * affichait « Performance moy. 3,0/5 » — un chiffre que personne n'avait saisi — et une
 * fois la valeur posée, un 3 saisi et un 3 par défaut sont INDISCERNABLES : aucun signal
 * (audit RH inexistant, `updatedAt` pollué par les scripts en masse) ne les sépare. Colonnes
 * rendues nullables le 2026-08-06 (`20260806170000_perf_rating_nullable`).
 *
 * ─── LA RÈGLE A ÉTÉ EXÉCUTÉE CONTRE SON CAS DÉCLENCHEUR ──────────────────────
 * ⚠️ Le verrou précédent de ce dépôt (« une constante à une seule valeur ») ratait PayDunya,
 * donc ratait le défaut qui l'avait motivé. Un critère qui laisse passer son propre
 * déclencheur est faux, pas prudent. Celui-ci est donc vérifié dans l'autre sens AVANT
 * d'être gardé : le bloc « CAS DÉCLENCHEUR » ci-dessous rejoue les DEUX formules d'origine
 * — copiées depuis `fixtures/rating-average.avant.txt`, extrait par `git show`, jamais
 * retapées — et prouve qu'elles produisent bien l'écran faux :
 *
 *   RH, aucun employé            → « 0.0/5 »   (vérité vacante : 0 sur l'ensemble vide)
 *   RH, 3 employés 0 évalué      → « 0.0/5 »
 *   Fournisseurs, 1 noté 5 sur 3 → « 1.7 »     ← pire : les non-évalués comptent pour ZÉRO,
 *                                                donc le numérateur est faux, pas seulement
 *                                                le dénominateur
 *
 * ─── CE QUE LE VERROU EXIGE ──────────────────────────────────────────────────
 *  1. aucun évalué  ⇒ « — », JAMAIS « 0,0/5 » ni « —/5 »
 *  2. partiellement ⇒ la légende PORTE l'effectif évalué
 *  3. aucun `?? 3` / `|| 3` sur `perf`/`rating` nulle part dans `src/`
 */

const RACINE = join(__dirname, '..')

// ─────────────────────────────────────────────────────────────────────────────
// CAS DÉCLENCHEUR — les formules d'ORIGINE, et ce qu'elles rendaient.
// ─────────────────────────────────────────────────────────────────────────────
/** Copie littérale de `HRStatsBar.tsx:24` avant correctif (fixture git). */
const ancienRH = (employees: { perf: number | null }[]) =>
  `${((employees ?? []).filter(e => e.perf).reduce((s, e) => s + (e.perf ?? 0), 0) / ((employees ?? []).filter(e => e.perf).length || 1)).toFixed(1)}/5`
/** Copie littérale de `Suppliers.tsx:84-86` avant correctif (fixture git). */
const ancienFournisseur = (suppliers: { rating: number | null }[]) =>
  suppliers.length > 0
    ? (suppliers.reduce((s, sup) => s + (Number(sup.rating) || 0), 0) / suppliers.length).toFixed(1)
    : null

describe('CAS DÉCLENCHEUR — la règle voit-elle le défaut qui l’a motivée ?', () => {
  it('la fixture d’origine est bien celle du dépôt, pas une reconstitution', () => {
    // ⚠️ Angle mort n°3 (FORME) : un sabotage retapé de mémoire hérite des hypothèses du
    // détecteur et tombe avec lui. On relit l'extrait produit par `git show`.
    const avant = readFileSync(join(__dirname, 'fixtures/rating-average.avant.txt'), 'utf8')
    expect(avant).toContain('.filter(e => e.perf)')
    expect(avant).toContain('Number(sup.rating) || 0')
    expect(avant).toContain('/ suppliers.length')
  })

  it('RH — l’ancienne formule rend « 0.0/5 » sur l’ensemble VIDE (vérité vacante)', () => {
    expect(ancienRH([])).toBe('0.0/5')
    // …et la nouvelle refuse d'inventer une moyenne.
    expect(ratingValue(summarizeRatings([]))).toBe('—')
  })

  it('RH — l’ancienne formule rend « 0.0/5 » quand PERSONNE n’est évalué', () => {
    const aucun = [{ perf: null }, { perf: null }, { perf: null }]
    expect(ancienRH(aucun)).toBe('0.0/5')
    expect(ratingValue(summarizeRatings(aucun.map(e => e.perf)))).toBe('—')
  })

  it('FOURNISSEURS — l’ancienne formule fausse le NUMÉRATEUR, pas seulement le dénominateur', () => {
    const un = [{ rating: 5 }, { rating: null }, { rating: null }]
    // Les non-évalués comptaient pour 0 → 5/3 = 1.7 pour un fournisseur noté 5.
    expect(ancienFournisseur(un)).toBe('1.7')
    const s = summarizeRatings(un.map(x => x.rating))
    expect(s.average).toBe(5)
    expect(s.rated).toBe(1)
    expect(s.total).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LES TROIS ÉTATS — dont celui À ZÉRO ÉVALUÉ, qui est celui qui produit l'écran faux.
// ─────────────────────────────────────────────────────────────────────────────
describe('summarizeRatings — trois états, jamais deux', () => {
  it('AUCUN évalué → `average === null`, jamais 0', () => {
    for (const jeu of [[], [null, null], [null, undefined, 'x']]) {
      const s = summarizeRatings(jeu)
      expect(s.average).toBeNull()
      expect(s.rated).toBe(0)
      expect(ratingValue(s)).toBe('—')
      // ⚠️ Ni « 0,0/5 » ni « —/5 » : un dénominateur suggère qu'une note existe.
      expect(ratingValue(s)).not.toMatch(/\/5/)
    }
  })

  it('PARTIELLEMENT évalué → moyenne des SEULS évalués, effectif dit', () => {
    const s = summarizeRatings([5, null, null, 3])
    expect(s.average).toBe(4)      // (5+3)/2, pas (5+3)/4
    expect(s.rated).toBe(2)
    expect(s.total).toBe(4)
    expect(ratingCaption(s, 'fr', 'employes')).toMatch(/2.*\/.*4/)
  })

  it('TOUS évalués → l’effectif est dit sans mise en garde', () => {
    const s = summarizeRatings([4, 5])
    expect(s.average).toBe(4.5)
    expect(ratingCaption(s, 'fr', 'employes')).not.toMatch(/\//)
  })

  it('la légende de l’état vide DIT POURQUOI il est vide', () => {
    expect(ratingCaption(summarizeRatings([]), 'fr', 'employes')).toMatch(/Aucun employé/)
    expect(ratingCaption(summarizeRatings([null, null]), 'fr', 'employes')).toMatch(/Aucune évaluation/)
    expect(ratingCaption(summarizeRatings([null]), 'fr', 'fournisseurs')).toMatch(/Aucune évaluation/)
  })

  it('les 4 langues répondent — jamais un binaire FR/EN', () => {
    for (const lang of ['fr', 'en', 'es', 'it']) {
      const c = ratingCaption(summarizeRatings([null, null]), lang, 'employes')
      expect(c.length).toBeGreaterThan(3)
    }
    const rendus = ['fr', 'en', 'es', 'it'].map(l => ratingCaption(summarizeRatings([null, null]), l, 'employes'))
    expect(new Set(rendus).size).toBe(4)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUR LE DOM RENDU — un helper juste ne prouve pas que l'écran l'utilise.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, t: (k: string) => k, useAppStore: Object.assign(() => ({ lang: 'fr' }), { getState: () => ({ lang: 'fr' }) }) }
})

const HRStatsBar = (await import('@/components/hr/HRStatsBar')).default
const SuppliersKpis = (await import('@/components/suppliers/SuppliersKpis')).default

const emp = (perf: number | null) => ({ perf, name: 'X' })

describe('les TROIS états RH, rendus', () => {
  const monter = (employees: ReturnType<typeof emp>[]) =>
    render(<HRStatsBar employees={employees} activeCount={employees.length} totalPayroll={0} pendingLeaves={0} fmt={(n: number) => String(n)} lang="fr" />)

  it('① AUCUN évalué → « — », aucune moyenne, et la raison est dite', () => {
    const { container } = monter([emp(null), emp(null)])
    expect(container.textContent).not.toMatch(/0[.,]0\/5/)
    expect(container.textContent).toMatch(/Aucune évaluation saisie/)
    // ⚠️ Le sous-titre était « Top équipe » — une félicitation constante, y compris à zéro.
    expect(container.textContent).not.toMatch(/Top équipe/)
  })

  it('② PARTIELLEMENT évalué → la moyenne PORTE son effectif', () => {
    const { container } = monter([emp(5), emp(null), emp(null)])
    expect(container.textContent).toMatch(/5[.,]0\/5/)
    expect(container.textContent).toMatch(/1.*\/.*3/)   // « Sur 1 employé évalué / 3 »
  })

  it('③ TOUS évalués → moyenne des évalués, effectif sans mise en garde', () => {
    const { container } = monter([emp(4), emp(5)])
    expect(container.textContent).toMatch(/4[.,]5\/5/)
    expect(container.textContent).not.toMatch(/Aucune évaluation/)
  })

  it('aucun employé du tout → « — », pas « 0,0/5 »', () => {
    const { container } = monter([])
    expect(container.textContent).not.toMatch(/0[.,]0\/5/)
    expect(container.textContent).toMatch(/Aucun employé/)
  })
})

describe('les TROIS états FOURNISSEURS, rendus — le JUMEAU', () => {
  const monter = (notes: (number | null)[]) =>
    render(<SuppliersKpis total={notes.length} actifs={notes.length} enCours={0} ratingSummary={summarizeRatings(notes)} lang="fr" />)

  it('① aucun évalué → « — »', () => {
    const { container } = monter([null, null])
    expect(container.textContent).not.toMatch(/0[.,]0/)
    expect(container.textContent).toMatch(/Aucune évaluation saisie/)
  })

  it('② un seul noté 5 sur 3 → « 5,0/5 » ET l’effectif — plus jamais « 1,7 »', () => {
    const { container } = monter([5, null, null])
    expect(container.textContent).toMatch(/5[.,]0\/5/)
    expect(container.textContent).not.toMatch(/1[.,]7/)
    expect(container.textContent).toMatch(/1.*\/.*3/)
  })

  it('③ tous évalués', () => {
    const { container } = monter([4, 5])
    expect(container.textContent).toMatch(/4[.,]5\/5/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTUREL — la valeur par défaut du schéma ne doit pas revenir par l'écran.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ COMMENTAIRES RETIRÉS avant de conclure — convention du dépôt (cf. `csvInjection.test.ts`).
 *
 * Les deux règles ci-dessous ont rougi au PREMIER tir en désignant… mes propres commentaires :
 * ceux qui CITENT la forme fautive pour expliquer pourquoi elle est interdite. Un scanner
 * qui lit les commentaires interdit d'expliquer ce qu'il interdit — et pousse à réécrire la
 * documentation en périphrases, ce qui la rend inutilisable.
 */
function codeSeul(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // blocs
    .replace(/^\s*\/\/.*$/gm, '')       // lignes entières
    .replace(/\s\/\/[^\n]*$/gm, '')     // fins de ligne
}

/** Périmètre DÉRIVÉ de l'arborescence, jamais une liste écrite à la main. */
function fichiers(): string[] {
  const out: string[] = []
  const marche = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { if (e !== 'tests') marche(p); continue }
      if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
    }
  }
  marche(RACINE)
  return out
}

describe('aucune valeur par défaut de schéma ne rejoint un écran', () => {
  const liste = fichiers()

  it('COUVERTURE — le balayage lit réellement l’arborescence', () => {
    expect(liste.length).toBeGreaterThan(200)
    expect(liste.some(f => f.endsWith('components/hr/HRStatsBar.tsx'))).toBe(true)
    expect(liste.some(f => f.endsWith('pages/Suppliers.tsx'))).toBe(true)
  })

  it('aucun repli `?? 3` / `|| 3` sur `perf` ou `rating`', () => {
    // ⚠️ Vise la FORME, pas un fichier : le défaut est revenu deux fois par des chemins
    // différents (mapping API, état de formulaire, création serveur).
    const motif = /\b(perf|rating)\s*(\?\?|\|\|)\s*\d/g
    const fautes: string[] = []
    for (const f of liste) {
      const src = codeSeul(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(motif)) {
        fautes.push(`${relative(RACINE, f).replace(/\\/g, '/')}:${src.slice(0, m.index).split('\n').length} — ${m[0]}`)
      }
    }
    expect(fautes, 'Une note absente redevient une note par défaut :\n' + fautes.join('\n')).toEqual([])
  })

  it('aucun filtre par VÉRACITÉ sur une note — il n’écarte que 0, valeur impossible', () => {
    // `.filter(e => e.perf)` avait l'air de filtrer et ne filtrait rien : les notes vont de
    // 1 à 5, donc aucune n'est falsy. Il faut comparer à `null`.
    const motif = /\.filter\(\s*\w+\s*=>\s*\w+\.(perf|rating)\s*\)/g
    const fautes: string[] = []
    for (const f of liste) {
      const src = codeSeul(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(motif)) fautes.push(`${relative(RACINE, f).replace(/\\/g, '/')} — ${m[0]}`)
    }
    expect(fautes, fautes.join('\n')).toEqual([])
  })
})
