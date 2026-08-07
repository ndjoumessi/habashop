/**
 * RÉPARTITION EN POURCENTAGES ENTIERS — source unique.
 *
 * ⚠️ Écrit d'abord pour « Répartition paiements » (`components/reports/paymentBreakdown.ts`),
 * déplacé ici quand le camembert du Dashboard en a eu besoin. **Ne pas en écrire une
 * troisième** : deux écrans, deux arrondis, et ils divergent au premier cas limite — c'est
 * exactement ce qui produit deux vérités sur le même chiffre.
 *
 * ─── POURQUOI PAS `100 − Σ` SUR LE DERNIER ───────────────────────────────────
 * Le Dashboard corrigeait le DERNIER secteur à `100 − Σ(les autres)`. La somme valait bien
 * 100, mais toute l'erreur d'arrondi était déversée sur une seule part — la dernière, donc
 * la PLUS PETITE, celle où un point pèse le plus. C'est ainsi qu'est né le défaut « le
 * dernier secteur diverge de ±1 » que l'assertion F1 de `dashboard-donut.spec.ts` a attrapé.
 *
 * MESURÉ sur la distribution réelle de `demo-tenant-002` (mars 2026, 7 catégories) :
 *
 *     exact      28.56  23.33  17.85  14.76   8.09   5.57   1.83
 *     100 − Σ       29     23     18     15      8      6      1    ← écart max 0,83 pt
 *     Hamilton      28     23     18     15      8      6      2    ← écart max 0,56 pt
 *
 * La dernière part passe de 1 à 2 : sur une valeur de 1,83 %, `100 − Σ` se trompait de 45 %
 * en relatif. Les plus forts restes bornent l'écart de CHAQUE part à moins d'un point.
 */

/**
 * Plus forts restes (Hamilton). Rend des entiers de même longueur que `comptes`, sommant à
 * **exactement 100**, aucun ne s'écartant de plus d'un point de sa valeur exacte.
 *
 * Départage : plus forte décimale, puis plus gros compte, puis ordre d'apparition — pour
 * qu'un même jeu de données rende toujours le même dessin.
 *
 * ⚠️ Total nul ⇒ que des zéros, jamais une répartition inventée pour arriver à 100.
 */
export function pourcentagesEntiers(comptes: number[]): number[] {
  const total = comptes.reduce((s, n) => s + n, 0)
  if (total <= 0) return comptes.map(() => 0)
  const exacts = comptes.map(n => (n * 100) / total)
  const bas = exacts.map(Math.floor)
  let reste = 100 - bas.reduce((s, n) => s + n, 0)
  const ordre = exacts
    .map((e, i) => ({ i, frac: e - Math.floor(e), n: comptes[i] }))
    .sort((a, b) => (b.frac - a.frac) || (b.n - a.n) || (a.i - b.i))
  for (const { i } of ordre) {
    if (reste <= 0) break
    bas[i] += 1
    reste -= 1
  }
  return bas
}
