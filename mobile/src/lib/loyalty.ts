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
// Loyalty v2 : remises par palier (0 = désactivé / non configuré par le tenant)
export const DEFAULT_BRONZE_DISCOUNT = 0
export const DEFAULT_SILVER_DISCOUNT = 0
export const DEFAULT_GOLD_DISCOUNT   = 0

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

/**
 * % de remise du palier actuel (affichage uniquement — le CALCUL réel est serveur).
 * Retourne 0 si la remise est ≤ 0 (non configurée par le tenant).
 */
export function discountForTierDisplay(
  tier: LoyaltyTier,
  bronzeDiscount: number = DEFAULT_BRONZE_DISCOUNT,
  silverDiscount: number = DEFAULT_SILVER_DISCOUNT,
  goldDiscount:   number = DEFAULT_GOLD_DISCOUNT,
): number {
  const pct = tier === 'Gold' ? goldDiscount : tier === 'Silver' ? silverDiscount : bronzeDiscount
  const n = Number(pct)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Pourcentage de progression (0–100) d'un solde vers son prochain seuil. */
export function progressToNext(points: number, threshold: number): number {
  if (threshold <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((points / threshold) * 100)))
}

// Plafond anti-abus : remise totale (fidélité + manuelle) ≤ 50 % du total.
export const MAX_TOTAL_DISCOUNT_PCT = 50

/**
 * Remise fidélité (XOF) — MIROIR EXACT du backend `apps/backend/src/lib/loyalty.ts`
 * `computeLoyaltyDiscount`. Le POS doit calculer le NET hors-ligne (affichage + split),
 * mais le backend reste AUTORITAIRE (on envoie le brut + customerId, il redérive le net).
 *
 * ⚠️ ANTI-DÉRIVE : toute modification de cette règle (arrondi Math.round, plafond 50 %,
 * interaction remise manuelle) DOIT être répercutée côté backend, et inversement. Les cas
 * partagés `docs/shared-fixtures/loyalty-discount-cases.json` (testés des DEUX côtés) font
 * échouer le test si une implémentation dérive. Ne pas changer l'une sans l'autre.
 */
export function computeLoyaltyDiscount(total: number, discountPct: number, manualDiscountAmt: number): number {
  if (discountPct <= 0) return 0
  const raw = Math.round(total * discountPct / 100)
  const maxAllowed = Math.round(total * MAX_TOTAL_DISCOUNT_PCT / 100)
  return Math.max(0, Math.min(raw, maxAllowed - manualDiscountAmt))
}

// Remise fidélité (XOF) pour un client lié — dérive le palier + % puis applique
// computeLoyaltyDiscount. UNE seule source de vérité côté mobile (panier ET garde
// espèces de l'écran POS l'appellent → pas de dérive interne). 0 si pas de client
// ou fidélité désactivée. Le backend reste autoritaire (envoi brut + customerId).
export function loyaltyDiscountFor(
  customer: { loyaltyPoints?: number | null } | null | undefined,
  tenant: {
    enableLoyalty?: boolean | null
    bronzeThreshold?: number | null; silverThreshold?: number | null
    bronzeDiscount?: number | null; silverDiscount?: number | null; goldDiscount?: number | null
  } | null | undefined,
  total: number,
  manualDiscountAmt: number,
): number {
  if (!customer || !tenant?.enableLoyalty) return 0
  const cfg = loyaltyConfig({ bronzeThreshold: tenant.bronzeThreshold ?? undefined, silverThreshold: tenant.silverThreshold ?? undefined })
  const tier = tierForPoints(customer.loyaltyPoints ?? 0, cfg.bronzeThreshold, cfg.silverThreshold)
  const pct = discountForTierDisplay(tier, tenant.bronzeDiscount ?? 0, tenant.silverDiscount ?? 0, tenant.goldDiscount ?? 0)
  return computeLoyaltyDiscount(total, pct, manualDiscountAmt)
}
