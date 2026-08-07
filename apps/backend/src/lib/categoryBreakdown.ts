/**
 * RÉPARTITION DU CA PAR CATÉGORIE — le tout, ou rien.
 *
 * ─── LE DÉFAUT, MESURÉ le 2026-08-07 ─────────────────────────────────────────
 * `analytics.ts` rendait `Object.entries(catMap).sort(...).slice(0, 6)` — les six premières
 * catégories, sans rien dire des autres. Le camembert du Dashboard calcule ensuite son
 * dénominateur avec `catData.reduce(...)`, c'est-à-dire sur ce qu'il a REÇU. Il répartissait
 * donc 100 % d'un sous-ensemble en le présentant comme le CA du mois.
 *
 * TROISIÈME instance de la même famille en deux jours : « Répartition paiements » (deux
 * dénominateurs, Σ = 96 %) puis le tableau PDF (11 535 XOF absents d'un total imprimé).
 * Toujours la même forme — **un total calculé sur ce qui est AFFICHÉ plutôt que sur ce qui
 * EXISTE**.
 *
 * ⚠️ POURQUOI PERSONNE NE L'AVAIT VU. `demo-tenant-001`, la boutique de démonstration de
 * référence, a **exactement 6 catégories** — au catalogue comme dans ses ventes. Elle est
 * pile sur la valeur limite : `perdu = 0`, toujours. Une septième l'aurait montré au premier
 * jour. `demo-tenant-002` en a **sept**, et le défaut y était bien réel :
 *
 *     2026-03   7 cat · CA 4 200 950 · dénominateur affiché 4 123 950 → 77 000 XOF (1,8 %)
 *     2026-04   7 cat · CA 4 578 550 · dénominateur affiché 4 551 050 → 27 500 XOF (0,6 %)
 *     2026-05   7 cat · CA 4 803 850 · dénominateur affiché 4 738 250 → 65 600 XOF (1,4 %)
 *
 * Trois mois consécutifs, en silence. Ce n'est pas un cas théorique qu'on ferme par principe.
 *
 * ─── LE RELIQUAT EST CALCULÉ ICI, PAS CHEZ LE CLIENT ─────────────────────────
 * Le client ne PEUT PAS le calculer : il ne reçoit que les lignes qu'on lui envoie. Laisser
 * la troncature au serveur et le total au client, c'est garantir qu'ils divergent. Le serveur
 * envoie donc les catégories nommées **plus** une ligne « Autres » explicite, et l'invariant
 * qui en découle est vérifiable : `Σ(valeurs rendues) === Σ(toutes les catégories)`.
 */

export interface CategorieCA {
  name: string
  value: number
  /** Nombre de catégories agrégées. 1 pour une catégorie nommée. */
  count: number
  /** `true` UNIQUEMENT pour la ligne de reliquat. */
  other?: true
}

/**
 * ⚠️ DRAPEAU EXPLICITE, PAS UN NOM SENTINELLE. `analytics.ts` range déjà les produits sans
 * catégorie sous le nom **« Autre »** : reconnaître le reliquat par son libellé le
 * confondrait avec une catégorie réelle, et rien ne l'empêcherait de s'appeler « Autres ».
 * C'est la leçon du `?? 'cash'` — on ne distingue pas une chose par le nom qu'elle partage.
 */
export const NOM_RELIQUAT = 'Autres'

/**
 * Rend au plus `max` lignes : les plus grosses catégories, plus un reliquat si nécessaire.
 *
 * ⚠️ Le reliquat agrège **au moins DEUX** catégories. Avec 7 catégories, « les 6 premières
 * + Autres » cacherait UNE catégorie parfaitement nommable derrière un libellé anonyme —
 * strictement moins informatif que de la nommer. On garde donc `max − 1` nommées dès qu'il
 * y a débordement. Corollaire voulu : à `max` catégories exactement, **aucune** tranche
 * « Autres ». Un secteur à 0 % se lit comme un graphique cassé, pas comme une absence.
 *
 * ⚠️ L'ENTRÉE N'EST PAS SUPPOSÉE TRIÉE — on trie ici. Se reposer sur le tri de l'appelant
 * ferait dépendre l'exactitude d'un invariant distant que rien n'enregistre (§ justesse
 * empruntée) : un jour quelqu'un réordonne, et « les plus grosses » deviennent « les
 * premières venues », sans qu'aucun test ne rougisse.
 */
export function regrouperCategories(cats: { name: string; value: number }[], max: number): CategorieCA[] {
  const tri = [...cats].sort((a, b) => b.value - a.value)
  if (tri.length <= max) return tri.map(c => ({ name: c.name, value: c.value, count: 1 }))

  const nommees = tri.slice(0, max - 1).map(c => ({ name: c.name, value: c.value, count: 1 }))
  const reste = tri.slice(max - 1)
  return [
    ...nommees,
    {
      name: NOM_RELIQUAT,
      value: reste.reduce((s, c) => s + c.value, 0),
      count: reste.length,
      other: true as const,
    },
  ]
}
