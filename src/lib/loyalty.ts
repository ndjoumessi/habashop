// Fidélité — helpers PURS d'AFFICHAGE (miroir du backend `apps/backend/src/lib/loyalty.ts`).
// ⚠️ La RÈGLE de gain (points crédités/retirés) vit côté SERVEUR : on ne la recalcule JAMAIS
// pour prédire un solde. Ici on ne dérive que le PALIER/seuil d'un solde déjà connu (affichage).
//
// Config PAR TENANT (GET /api/tenant + GET /api/customers/:id/loyalty) :
//  • pointsPerAmount  : unités de devise pour 1 point  → floor(montant / pointsPerAmount)
//  • bronzeThreshold  : pts seuil Bronze → Silver       (⚠️ entrée Silver, PAS « max Bronze »)
//  • silverThreshold  : pts seuil Silver → Gold         (entrée Gold)
// Les défauts reproduisent la v1 (1000 / 2000 / 5000).

export const DEFAULT_POINTS_PER_AMOUNT = 1000
export const DEFAULT_BRONZE_THRESHOLD = 2000 // pts : Bronze → Silver
export const DEFAULT_SILVER_THRESHOLD = 5000 // pts : Silver → Gold

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold'

export interface LoyaltyConfig {
  pointsPerAmount: number
  bronzeThreshold: number // entrée Silver
  silverThreshold: number // entrée Gold
}

// Nombre fini > 0, sinon défaut (garde-fou contre null/0/NaN venus du backend).
const numOr = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Normalise une config tenant partielle en config complète (avec défauts v1). */
export function loyaltyConfig(src?: Partial<LoyaltyConfig> | null): LoyaltyConfig {
  return {
    pointsPerAmount: numOr(src?.pointsPerAmount, DEFAULT_POINTS_PER_AMOUNT),
    bronzeThreshold: numOr(src?.bronzeThreshold, DEFAULT_BRONZE_THRESHOLD),
    silverThreshold: numOr(src?.silverThreshold, DEFAULT_SILVER_THRESHOLD),
  }
}

/**
 * Palier d'un solde de points : Bronze < bronzeThreshold, Silver [bronze, silver),
 * Gold ≥ silverThreshold. Seuils configurables par tenant.
 */
export function tierForPoints(
  points?: number | null,
  bronzeThreshold: number = DEFAULT_BRONZE_THRESHOLD,
  silverThreshold: number = DEFAULT_SILVER_THRESHOLD,
): LoyaltyTier {
  const p = Number(points) || 0
  if (p >= silverThreshold) return 'Gold'
  if (p >= bronzeThreshold) return 'Silver'
  return 'Bronze'
}

/**
 * Seuil et palier suivants pour la barre de progression. `null` si déjà au max (Gold).
 * Bronze → Silver (bronzeThreshold) ; Silver → Gold (silverThreshold) ; Gold → null.
 */
export function nextTierFor(
  tier: LoyaltyTier,
  bronzeThreshold: number = DEFAULT_BRONZE_THRESHOLD,
  silverThreshold: number = DEFAULT_SILVER_THRESHOLD,
): { threshold: number; nextTier: LoyaltyTier } | null {
  if (tier === 'Bronze') return { threshold: bronzeThreshold, nextTier: 'Silver' }
  if (tier === 'Silver') return { threshold: silverThreshold, nextTier: 'Gold' }
  return null
}

/** Pourcentage de progression (0–100) d'un solde vers son prochain seuil. */
export function progressToNext(points: number, threshold: number): number {
  if (threshold <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((points / threshold) * 100)))
}
