// Paiement mixte — ventilation 2 lignes en XOF base. Helpers PURS (miroir du backend
// apps/backend/src/lib/paymentSplit.ts : 3 seaux cash/mobileMoney/card, somme == total,
// ≥ 2 modes non nuls). La ligne 2 = reste calculé → la somme égale TOUJOURS le total.

export type SplitMethod = 'cash' | 'mobile' | 'card'
export interface MixedSplit { cashAmount: number; mobileMoneyAmount: number; cardAmount: number }

// Ordre d'affichage des méthodes (mappées aux 3 seaux backend).
export const SPLIT_METHODS: SplitMethod[] = ['cash', 'mobile', 'card']

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// cash → cashAmount · card → cardAmount · mobile → mobileMoneyAmount (Wave/Orange/MTN…).
function addToBucket(split: MixedSplit, method: SplitMethod, amount: number): void {
  if (method === 'cash') split.cashAmount += amount
  else if (method === 'card') split.cardAmount += amount
  else split.mobileMoneyAmount += amount
}

/**
 * Ventile un paiement mixte 2 lignes (montants en XOF base) :
 * ligne 1 = `amount1` borné [0, total], ligne 2 = reste (total − amount1).
 * → la somme des 3 seaux égale EXACTEMENT `total` (pas de dérive d'arrondi).
 */
export function buildMixedSplit(method1: SplitMethod, amount1: number, method2: SplitMethod, total: number): MixedSplit {
  const a1 = clamp(Number(amount1) || 0, 0, Math.max(0, total))
  const a2 = Math.max(0, total - a1)
  const split: MixedSplit = { cashAmount: 0, mobileMoneyAmount: 0, cardAmount: 0 }
  addToBucket(split, method1, a1)
  addToBucket(split, method2, a2)
  return split
}

/**
 * Mixte valide : 2 méthodes différentes ET les deux lignes > 0
 * (donc 0 < amount1 < total → les 2 seaux sont non nuls, comme l'exige le backend).
 */
export function isMixedValid(method1: SplitMethod, method2: SplitMethod, amount1: number, total: number): boolean {
  const a1 = Number(amount1) || 0
  return method1 !== method2 && a1 > 0 && a1 < total
}
