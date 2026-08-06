/**
 * MOYENNE D'UNE NOTE — le dénominateur fait partie de l'information.
 *
 * ─── LE DÉFAUT QU'ON FERME ───────────────────────────────────────────────────
 * `Employee.perf` et `Supplier.rating` étaient `Int NOT NULL DEFAULT 3`. Un employé jamais
 * évalué valait donc 3, INDISCERNABLE d'un employé réellement noté 3, et la barre RH en
 * faisait la moyenne : une boutique neuve affichait « Performance moy. **3,0/5** », un
 * chiffre que personne n'avait saisi. Les colonnes sont nullables depuis le 2026-08-06
 * (migration `20260806170000_perf_rating_nullable`) — ce module est ce qui empêche le
 * défaut de revenir par l'affichage.
 *
 * ⚠️ Le filtre d'origine était `.filter(e => e.perf)`. Il n'écartait que `0`, valeur qui
 * ne peut PAS exister (les notes vont de 1 à 5) : il ne filtrait donc rien du tout, tout en
 * ayant l'air de filtrer. Il faut écarter `null`.
 *
 * ─── TROIS ÉTATS, JAMAIS DEUX ────────────────────────────────────────────────
 *
 *   aucun évalué          → `average === null`. La moyenne N'EXISTE PAS.
 *   partiellement évalué  → moyenne des évalués, et l'effectif DOIT être dit
 *   tous évalués          → moyenne, effectif redondant donc omis
 *
 * ⚠️ Sur l'ensemble vide, `reduce` rend 0 et `/ (n || 1)` rend `0.0` : l'écran affichait
 * « 0,0/5 », une contre-performance parfaite là où il n'y a simplement rien. C'est la
 * TROISIÈME occurrence de la vérité vacante ce mois-ci (console Ops, barre des services,
 * ici) ; celle-ci est prévue avant d'être rencontrée, pas après.
 *
 * ⚠️ Et « 4,2/5 » sur trois évalués parmi cinq n'est PAS « 4,2/5 » : sans son effectif, le
 * nombre se lit comme portant sur toute l'équipe. Le dénominateur n'est pas un détail de
 * présentation, c'est une partie de la mesure — d'où `ratingCaption`, et le verrou qui
 * échoue si une moyenne est rendue sans lui.
 */

export interface RatingSummary {
  /** Effectif TOTAL de la liste (évalués ou non). */
  total: number
  /** Effectif ÉVALUÉ — le dénominateur réel de la moyenne. */
  rated: number
  /** Moyenne des seuls évalués. `null` si aucun — JAMAIS `0`. */
  average: number | null
}

/**
 * ⚠️ `unknown[]` en entrée : ces valeurs traversent une frontière API et un store persisté.
 * Les typer `number|null` serait une AFFIRMATION, pas une garantie — même raisonnement que
 * `dialCodeFor(country: unknown)`. Une valeur non numérique compte comme NON évaluée.
 */
export function summarizeRatings(valeurs: readonly unknown[]): RatingSummary {
  const notes = valeurs.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return {
    total: valeurs.length,
    rated: notes.length,
    average: notes.length === 0 ? null : notes.reduce((s, n) => s + n, 0) / notes.length,
  }
}

export type Lang = string

/**
 * La VALEUR affichée. `null` (aucun évalué) → « — », jamais « 0,0/5 » ni « —/5 » :
 * un tiret barré d'un dénominateur suggère encore qu'une note existe.
 */
export function ratingValue(s: RatingSummary): string {
  return s.average === null ? '—' : `${s.average.toFixed(1)}/5`
}

/**
 * La LÉGENDE, qui porte l'effectif. C'est elle qui rend le nombre interprétable, et le
 * verrou `ratingDenominator.test.tsx` échoue si une moyenne est rendue sans elle.
 *
 * ⚠️ L'état vide DIT POURQUOI il est vide au lieu de se taire : « aucune évaluation
 * saisie » se lit comme un fait sur nos données, pas comme un jugement sur l'équipe.
 */
export function ratingCaption(s: RatingSummary, lang: Lang, sujet: 'employes' | 'fournisseurs'): string {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  if (s.total === 0) {
    return sujet === 'employes'
      ? i('Aucun employé', 'No staff', 'Sin empleados', 'Nessun dipendente')
      : i('Aucun fournisseur', 'No suppliers', 'Sin proveedores', 'Nessun fornitore')
  }
  if (s.rated === 0) {
    return i('Aucune évaluation saisie', 'No rating entered yet', 'Ninguna valoración registrada', 'Nessuna valutazione inserita')
  }
  if (s.rated < s.total) {
    return sujet === 'employes'
      ? i(`Sur ${s.rated} employé${s.rated > 1 ? 's' : ''} évalué${s.rated > 1 ? 's' : ''} / ${s.total}`,
          `Across ${s.rated} of ${s.total} rated`,
          `Sobre ${s.rated} de ${s.total} evaluados`,
          `Su ${s.rated} di ${s.total} valutati`)
      : i(`Sur ${s.rated} fournisseur${s.rated > 1 ? 's' : ''} évalué${s.rated > 1 ? 's' : ''} / ${s.total}`,
          `Across ${s.rated} of ${s.total} rated`,
          `Sobre ${s.rated} de ${s.total} evaluados`,
          `Su ${s.rated} di ${s.total} valutati`)
  }
  // Tous évalués : le dénominateur est redondant, on dit l'effectif sans le mettre en garde.
  return sujet === 'employes'
    ? i(`${s.total} employé${s.total > 1 ? 's' : ''} évalué${s.total > 1 ? 's' : ''}`, `All ${s.total} rated`, `Los ${s.total} evaluados`, `Tutti i ${s.total} valutati`)
    : i(`${s.total} fournisseur${s.total > 1 ? 's' : ''} évalué${s.total > 1 ? 's' : ''}`, `All ${s.total} rated`, `Los ${s.total} evaluados`, `Tutti i ${s.total} valutati`)
}
