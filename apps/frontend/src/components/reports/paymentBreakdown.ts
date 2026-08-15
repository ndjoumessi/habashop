import {
  SALE_PAYMENT_MODES, MODE_ABSENT, salePaymentLabel, salePaymentColor,
} from '@/lib/salePaymentModes'

/**
 * RÉPARTITION DES PAIEMENTS — une seule série, donc un seul dénominateur.
 *
 * ─── LE DÉFAUT, MESURÉ le 2026-08-07 ─────────────────────────────────────────
 * L'écran portait **deux** séries de pourcentages sur le même camembert :
 *
 *   légende / infobulle : `Math.round(counts[m] / TOUTES_LES_VENTES * 100)`
 *   donut / part active : un `percent` recalculé par la bibliothèque = `value / Σ(values RENDUES)`
 *
 * Tant que rien n'est avalé les deux coïncident. Dès qu'un mode manque à la liste en
 * dur, ils divergent : sur `demo-tenant-001`, légende **96 %** et donut **101 %**, pour
 * le même camembert et les mêmes ventes — `cash` s'y lisait 36 % à gauche et 38 % au
 * survol. Ce n'était pas une erreur d'arrondi : c'étaient deux questions différentes
 * posées au même dessin.
 *
 * ─── LE DÉNOMINATEUR RETENU, ET POURQUOI ─────────────────────────────────────
 * **Le nombre TOTAL de ventes de la période** — pas « celui qui donne 100 ». C'est le
 * seul que le commerçant puisse recouper : le sous-titre du panneau affiche déjà
 * « N transactions », et une part se lit « sur mes N ventes ». Le dénominateur du donut
 * (Σ des parts dessinées) n'est pas un choix, c'est une conséquence de la géométrie —
 * il ne devient honnête que si les parts couvrent TOUT. C'est donc l'exhaustivité qui
 * rend les deux dénominateurs égaux, et l'égalité est ici **par construction** : une
 * seule série d'entiers est calculée, et c'est elle que le graphique reçoit en `dataKey`.
 *
 * ─── L'ARRONDI EST DISTRIBUÉ, PAS SUBI ───────────────────────────────────────
 * Quatre pourcentages arrondis ne somment pas nécessairement à 100. On applique la
 * méthode des plus forts restes (Hamilton) : parts entières, puis le reliquat va aux
 * plus fortes décimales. Σ vaut **exactement 100** par construction, sans qu'aucune
 * part ne s'écarte de plus d'un point de sa valeur exacte. Un camembert dont les parts
 * ne somment pas n'a pas besoin d'être faux pour paraître faux.
 *
 * ⚠️ Le filtre est sur le COMPTE, jamais sur le pourcentage. `filter(d => d.value > 0)`
 * ré-avalait une part réelle mais minuscule (1 vente sur 500 → 0 %), c'est-à-dire
 * exactement le défaut qu'on ferme, sous une autre forme. Une part sous 0,5 % est
 * annoncée « < 1 % » : négligeable se dit, ça ne se supprime pas.
 */
export interface PaymentSlice {
  /** Clé brute du mode (`cash`, `mtn`, `__absent__`, ou une valeur inconnue telle quelle). */
  key: string
  /** Libellé affiché, traduit ou marque. */
  name: string
  /** Nombre de ventes — la grandeur mesurée. */
  count: number
  /** Montant encaissé sur ce mode. */
  amount: number
  /** Pourcentage ENTIER. Σ des `pct` == 100 exactement (cf. Hamilton ci-dessus). */
  pct: number
  color: string
}

type VenteLue = { paymentMode?: string | null; total?: number | null }

/** Clé de regroupement : le mode tel quel, ou la catégorie « absent » — jamais `'cash'`. */
function cle(v: VenteLue): string {
  const m = v.paymentMode
  return typeof m === 'string' && m.trim() !== '' ? m : MODE_ABSENT
}

/**
 * Plus forts restes. Rend des entiers de même longueur que `comptes`, sommant à 100.
 * Départage : plus forte décimale, puis plus gros compte, puis ordre d'apparition —
 * déterministe, pour qu'un même jeu de ventes rende toujours le même dessin.
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

/**
 * ⚠️ AUCUN REPLI FABRIQUÉ. Zéro vente rend un tableau VIDE, et l'appelant montre un état
 * vide. L'ancien code rendait `62/22/16/8/5` — cinq parts inventées sommant à **113 %** —
 * pour que le dessin ne soit pas nu. C'est la troisième fois de la semaine qu'on retire
 * ce motif (console Ops, barre des services, notes RH) ; la première où le cas vide était
 * traité par de la donnée fausse plutôt que par du silence.
 */
export function buildPaymentBreakdown(sales: VenteLue[], lang: string): PaymentSlice[] {
  if (!sales.length) return []

  const counts = new Map<string, number>()
  const amounts = new Map<string, number>()
  for (const v of sales) {
    const k = cle(v)
    counts.set(k, (counts.get(k) ?? 0) + 1)
    amounts.set(k, (amounts.get(k) ?? 0) + (v.total ?? 0))
  }

  // Ordre : catalogue d'abord (lecture stable d'une période à l'autre), puis ce que le
  // catalogue ne connaît pas, puis l'absence. ⚠️ Les clés inconnues sont DÉRIVÉES des
  // données, jamais listées : un mode nouveau apparaît SEUL, il ne disparaît jamais.
  const connues = SALE_PAYMENT_MODES.filter(m => (counts.get(m) ?? 0) > 0) as readonly string[]
  const inconnues = [...counts.keys()]
    .filter(k => k !== MODE_ABSENT && !(SALE_PAYMENT_MODES as readonly string[]).includes(k))
    .sort()
  const absentes = counts.has(MODE_ABSENT) ? [MODE_ABSENT] : []
  const cles = [...connues, ...inconnues, ...absentes]

  const pcts = pourcentagesEntiers(cles.map(k => counts.get(k) ?? 0))
  return cles.map((k, i) => ({
    key: k,
    name: salePaymentLabel(k, lang),
    count: counts.get(k) ?? 0,
    amount: amounts.get(k) ?? 0,
    pct: pcts[i],
    color: salePaymentColor(k),
  }))
}

/** « 12 % », ou « < 1 % » pour une part réelle mais arrondie à zéro. Jamais « 0 % ». */
export function pctLabel(s: { count: number; pct: number }): string {
  return s.pct === 0 && s.count > 0 ? '< 1 %' : `${s.pct} %`
}
