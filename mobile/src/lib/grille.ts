/**
 * COMPLÉTER LA DERNIÈRE RANGÉE D'UNE GRILLE — et pourquoi c'est nécessaire.
 *
 * ─── LE DÉFAUT ───────────────────────────────────────────────────────────────
 * Une `FlatList numColumns={N}` dont les tuiles portent `flex: 1` répartit la
 * largeur ENTRE LES TUILES PRÉSENTES sur chaque rangée. La dernière rangée d'une
 * liste dont l'effectif n'est pas multiple de N est donc incomplète, et ses tuiles
 * s'ÉTIRENT : un produit seul occupe toute la largeur de l'écran, avec son émoji
 * perdu au milieu d'une bannière.
 *
 * OBSERVÉ le 2026-08-13 sur émulateur, écran Caisse : 13 produits en 3 colonnes,
 * « Tomate concentrée 800g » étalé sur toute la largeur. C'est le JUMEAU NATIF du
 * défaut web du 2026-08-12 — là-bas c'était `auto-fit` qui effondrait les colonnes
 * vides, ici c'est `flex: 1` qui les redistribue. Même symptôme, deux moteurs de
 * mise en page sans un octet de code commun.
 *
 * ─── POURQUOI DES CASES VIDES, ET PAS UNE LARGEUR EN POURCENTAGE ─────────────
 * `maxWidth: '33.33%'` semble plus simple, mais les rangées portent un `gap` : la
 * largeur réelle d'une tuile est `(contenu − 2 gaps) / 3`, pas un tiers. Un
 * pourcentage fixe laisserait donc un vide au bout de CHAQUE rangée pleine —
 * on échangerait un défaut visible sur une rangée contre un défaut discret sur
 * toutes. Les cases vides, elles, ne changent RIEN aux rangées pleines.
 *
 * ⚠️ Fonction PURE et testée : la géométrie, elle, ne se prouve que sur un moteur
 * de rendu (cf. la vérification sur émulateur du 2026-08-13).
 */

/** Marqueur d'une case de remplissage — jamais un produit, jamais rendu visible. */
export type CaseVide = { id: string; vide: true }

export function estCaseVide<T extends object>(x: T | CaseVide): x is CaseVide {
  return (x as CaseVide).vide === true
}

/**
 * Complète `items` par des cases vides pour que l'effectif soit multiple de
 * `colonnes`. Une liste déjà pleine — ou vide — est rendue telle quelle : on ne
 * fabrique jamais une rangée de cases vides, qui occuperait de la hauteur pour rien.
 */
export function completerRangee<T extends object>(items: T[], colonnes: number): (T | CaseVide)[] {
  if (colonnes <= 1 || items.length === 0) return items
  const manquantes = (colonnes - (items.length % colonnes)) % colonnes
  if (manquantes === 0) return items
  return [
    ...items,
    ...Array.from({ length: manquantes }, (_, k) => ({ id: `__case_vide_${k}__`, vide: true as const })),
  ]
}

/**
 * COMBIEN DE COLONNES POUR CETTE LARGEUR — dérivé, jamais figé.
 *
 * ─── LE DÉFAUT ───────────────────────────────────────────────────────────────
 * Le kiosque figeait `numColumns={4}`. Mais sa grille ne prend pas tout l'écran :
 * elle partage la largeur avec la colonne panier (30 %). Sur un téléphone en
 * portrait, ces 4 colonnes vivent donc dans ~250 dp — 60 dp par tuile. OBSERVÉ le
 * 2026-08-13 sur émulateur : « Café soluble 200g » rendu « Café s / olubl… »,
 * coupé EN PLEIN MOT, et il n'y a pas de libellé assez court pour tenir dans 60 dp.
 *
 * ⚠️ C'est la règle du guide, appliquée telle quelle : *corriger la CONTRAINTE, pas
 * la chaîne*. Raccourcir les noms de produits aurait déplacé le problème sur le
 * commerçant, qui les saisit lui-même.
 *
 * ⚠️ LA LARGEUR DOIT ÊTRE CELLE DE LA GRILLE, PAS CELLE DE L'ÉCRAN. `useResponsive`
 * dérive ses colonnes de `useWindowDimensions`, ce qui est juste pour une grille
 * pleine largeur (la caisse) et FAUX ici — d'où une mesure par `onLayout` du
 * conteneur réel. Un helper qui accepte une largeur quelconque reste utilisable par
 * les deux.
 */
export function colonnesPourLargeur(largeur: number, miniTuile = 132, max = 6): number {
  // ⚠️ Avant la première mesure, `onLayout` n'a pas encore répondu : on rend 2, pas
  // 0 ni NaN. `numColumns={0}` fait lever la `FlatList`, et un `NaN` la vide en
  // silence — le pire des deux étant le second.
  if (!Number.isFinite(largeur) || largeur <= 0) return 2
  return Math.max(2, Math.min(max, Math.floor(largeur / miniTuile)))
}
