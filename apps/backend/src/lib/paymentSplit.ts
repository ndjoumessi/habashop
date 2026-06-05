// Ventilation du paiement d'une vente par mode (espèces / mobile money / carte).
// Pur & testable. Renvoie soit { error } (somme mixte ≠ total), soit les 3 montants.

export interface PaymentParts { cashAmount?: number; mobileMoneyAmount?: number; cardAmount?: number }
export interface PaymentSplit { cashAmount: number; mobileMoneyAmount: number; cardAmount: number }

/** Tolérance d'arrondi sur la somme d'un paiement mixte (1 unité de devise base). */
export const MIXED_TOLERANCE = 1

/**
 * Résout la ventilation à STOCKER pour une vente.
 * - paymentMode 'mixed' → lit cash/mobile/card du body ; rejette si |somme - total| > 1.
 * - paiement simple → place le total dans le bon seau (les 2 autres = 0).
 *   cash → cashAmount ; card → cardAmount ; wave/orange/mtn/mobile/momo → mobileMoneyAmount.
 */
export function resolvePaymentSplit(paymentMode: string, total: number, parts?: PaymentParts): PaymentSplit | { error: string } {
  if (paymentMode === 'mixed') {
    const cashAmount = Math.max(0, Number(parts?.cashAmount) || 0)
    const mobileMoneyAmount = Math.max(0, Number(parts?.mobileMoneyAmount) || 0)
    const cardAmount = Math.max(0, Number(parts?.cardAmount) || 0)
    const sum = cashAmount + mobileMoneyAmount + cardAmount
    if (Math.abs(sum - total) > MIXED_TOLERANCE) return { error: 'MIXED_SUM_MISMATCH' }
    // Au moins 2 modes non nuls (sinon ce n'est pas un paiement « mixte »).
    const nonZero = [cashAmount, mobileMoneyAmount, cardAmount].filter(a => a > 0).length
    if (nonZero < 2) return { error: 'MIXED_NEEDS_TWO' }
    return { cashAmount, mobileMoneyAmount, cardAmount }
  }
  if (paymentMode === 'cash') return { cashAmount: total, mobileMoneyAmount: 0, cardAmount: 0 }
  if (paymentMode === 'card') return { cashAmount: 0, mobileMoneyAmount: 0, cardAmount: total }
  // wave / orange / mtn / mobile / momo → Mobile Money
  return { cashAmount: 0, mobileMoneyAmount: total, cardAmount: 0 }
}
