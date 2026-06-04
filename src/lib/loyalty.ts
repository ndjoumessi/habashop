// Fidélité v1 — helpers PURS d'AFFICHAGE (miroir du backend `apps/backend/src/lib/loyalty.ts`).
// ⚠️ La RÈGLE de gain (points crédités/retirés) vit côté SERVEUR : on ne la recalcule JAMAIS
// pour prédire un solde. Ici on ne fait que dériver le PALIER/seuil d'un solde déjà connu
// (pour l'affichage), exactement comme le web (fallback de LoyaltyCard).

export const POINTS_PER_UNIT = 1000 // 1 point par tranche de 1000 (XOF/XAF base) dépensé

export const LOYALTY_TIERS = { silver: 2000, gold: 5000 } as const

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold'

/** Palier d'un solde de points : Bronze <2000, Silver 2000–4999, Gold ≥5000. */
export function tierForPoints(points?: number | null): LoyaltyTier {
  const p = Number(points) || 0
  if (p >= LOYALTY_TIERS.gold) return 'Gold'
  if (p >= LOYALTY_TIERS.silver) return 'Silver'
  return 'Bronze'
}

/**
 * Seuil et palier suivants pour la barre de progression. `null` si déjà au max (Gold).
 * Bronze → Silver (2000) ; Silver → Gold (5000) ; Gold → null.
 */
export function nextTierFor(tier: LoyaltyTier): { threshold: number; nextTier: LoyaltyTier } | null {
  if (tier === 'Bronze') return { threshold: LOYALTY_TIERS.silver, nextTier: 'Silver' }
  if (tier === 'Silver') return { threshold: LOYALTY_TIERS.gold, nextTier: 'Gold' }
  return null
}

/** Pourcentage de progression (0–100) d'un solde vers son prochain seuil. */
export function progressToNext(points: number, threshold: number): number {
  if (threshold <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((points / threshold) * 100)))
}
