/**
 * MODES DE PAIEMENT D'UNE VENTE — catalogue web, jumeau de `mobile/src/lib/paymentLabel.ts`.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `Reports.tsx` réénumérait le domaine à la main, en dur, dans le calcul du camembert :
 * `cash · mobile · wave · orange · card`. Deux erreurs SYMÉTRIQUES, toutes deux mesurées
 * le 2026-08-07 sur les 1 908 ventes de production :
 *
 *   `mobile` était RENDU alors que le serveur ne l'écrit JAMAIS  → 0 occurrence
 *   `mtn` et `mixed` étaient ÉCRITS mais absents du graphique     → avalés en silence
 *
 * Sur `demo-tenant-001`, 2 des 50 ventes de la page disparaissaient donc du camembert —
 * d'où une légende qui sommait à **96 %**. C'est la CINQUIÈME instance de ce domaine
 * réénuméré (cf. `docs/shared-fixtures/sale-payment-modes.json`).
 *
 * ⚠️ Le domaine est tenu DISTINCT de deux voisins qui lui ressemblent :
 *   – `payment-methods.json` = moyens de paiement d'un ABONNEMENT (`orange_money`,
 *     `virement`…), pas d'une vente ;
 *   – `POS_PAY_MODES` (appStore) = tuiles offertes comme DÉFAUT de caisse ; il ne
 *     contient pas `mixed`, qu'on ne peut pas choisir par défaut.
 * Les fondre ferait d'un goulot un entonnoir (§ Refactor transverse).
 *
 * ⚠️ `Sale.paymentMode` est `String @default("cash")` en base — donc typé `string` côté
 * API. Le compilateur n'aide pas : c'est le `Record` exhaustif qui porte l'exhaustivité,
 * et le repli qui porte l'honnêteté. Une valeur inconnue est rendue TELLE QUELLE, jamais
 * assimilée à un mode connu — même règle que le reçu mobile.
 */

/** Ordre canonique — miroir de `PAYMENT_MODES` (mobile) et de la fixture partagée. */
export const SALE_PAYMENT_MODES = ['cash', 'wave', 'orange', 'mtn', 'card', 'mixed'] as const
export type SalePaymentMode = typeof SALE_PAYMENT_MODES[number]

type Quad = Readonly<Record<string, string>>

/**
 * ⚠️ `Record<SalePaymentMode, …>` : `tsc` échoue si un mode entre dans la liste sans être
 * décrit ici. C'est ce que le ternaire ne pouvait pas faire — son `else` avalait.
 * Les marques ne se traduisent pas ; les quatre formes sont écrites quand même pour qu'un
 * test lisant une seule langue ne rate pas une traduction ajoutée à tort.
 */
const LABELS: Record<SalePaymentMode, Quad> = {
  cash:   { fr: 'Espèces',      en: 'Cash',         es: 'Efectivo',     it: 'Contanti' },
  wave:   { fr: 'Wave',         en: 'Wave',         es: 'Wave',         it: 'Wave' },
  orange: { fr: 'Orange Money', en: 'Orange Money', es: 'Orange Money', it: 'Orange Money' },
  mtn:    { fr: 'MTN MoMo',     en: 'MTN MoMo',     es: 'MTN MoMo',     it: 'MTN MoMo' },
  card:   { fr: 'Carte',        en: 'Card',         es: 'Tarjeta',      it: 'Carta' },
  mixed:  { fr: 'Mixte',        en: 'Split',        es: 'Mixto',        it: 'Misto' },
}

/**
 * Couleurs du camembert. Reprises à l'identique de l'ancien bloc pour que la lecture
 * habituelle du commerçant ne change pas — sauf `mtn`, qui n'avait pas de part, et
 * `mixed`, qui hérite du violet libéré par la disparition du fantôme `mobile`.
 */
const COLORS: Record<SalePaymentMode, string> = {
  cash:   '#00D084',
  wave:   '#00B8FF',
  orange: '#FF3B5C',
  mtn:    '#FFCC00',
  card:   '#FF9500',
  mixed:  '#8B6FFF',
}

/**
 * Clé de la catégorie « mode absent ou vide ».
 *
 * ⚠️ Elle existe même si elle ne se déclenche jamais aujourd'hui : la colonne est
 * `String @default("cash")` NOT NULL, et la production porte **0** ligne sans mode.
 * Ce n'est donc pas une fuite qu'on répare, c'est un `?? 'cash'` qu'on retire — il
 * attribuait à ESPÈCES ce qu'il ne savait pas lire, exactement comme `rating ?? 0`
 * notait un employé jamais évalué. Le jour où un `select` partiel ou une colonne
 * rendue nullable ouvrirait le chemin, la vente apparaîtra sous son propre nom au
 * lieu de gonfler la caisse.
 */
export const MODE_ABSENT = '__absent__'

/** Couleur neutre — un mode qu'on ne connaît pas ne prend la couleur d'aucun mode connu. */
export const COULEUR_INCONNU = '#8A8F98'

export function isSalePaymentMode(v: unknown): v is SalePaymentMode {
  return typeof v === 'string' && (SALE_PAYMENT_MODES as readonly string[]).includes(v)
}

/**
 * Libellé d'un mode. Un mode inconnu est rendu tel quel, première lettre en capitale :
 * un « Paypal » visible vaut mieux qu'une part fausse ou qu'une part disparue.
 */
export function salePaymentLabel(mode: string, lang: string): string {
  if (mode === MODE_ABSENT) {
    return lang === 'en' ? 'Not recorded' : lang === 'es' ? 'Sin registrar'
      : lang === 'it' ? 'Non indicato' : 'Non renseigné'
  }
  if (!isSalePaymentMode(mode)) return mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '—'
  const q = LABELS[mode]
  return q[lang] ?? q.fr
}

export function salePaymentColor(mode: string): string {
  return isSalePaymentMode(mode) ? COLORS[mode] : COULEUR_INCONNU
}
