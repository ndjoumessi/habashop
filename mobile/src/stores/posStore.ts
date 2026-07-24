import { create } from 'zustand'
import type { PriceTier, Product, Customer } from '@/types'

export type { PriceTier }

export type PaymentMode = 'cash' | 'wave' | 'orange' | 'card'

export interface CartItem {
  productId: string; name: string
  // `price` = prix unitaire EFFECTIF (promo / palier déjà appliqués selon la quantité).
  // Tous les consommateurs (affichage panier, ticket WhatsApp, payload vente, total) le lisent
  // directement → le total affiché correspond à ce que le backend facturera réellement.
  price: number
  quantity: number; emoji: string; stockQty: number
  // Données de résolution conservées pour recalculer `price` quand la quantité change.
  // Optionnelles : les lignes créées par le store les posent toujours ; un CartItem
  // reconstruit ailleurs (ex. renvoi de ticket d'une vente passée) peut s'en passer.
  basePrice?: number
  hasPromotion?: boolean
  promotionPrice?: number | null
  // Date de fin de promo (ISO) conservée pour ré-évaluer l'expiration au recalcul de ligne :
  // une promo peut expirer entre l'ajout et un changement de quantité.
  promotionEnd?: string | null
  priceTiers?: PriceTier[] | null
  // Libellé du palier appliqué (si un palier — et non une promo — est actif), pour l'UI.
  tierLabel?: string
}

interface PosState {
  cart: CartItem[]; discount: number
  paymentMode: PaymentMode
  /** Client lié à la vente en cours (optionnel) — fidélité/historique. */
  customer: Customer | null
  cashGiven: number; sessionTx: number; sessionCA: number
  addItem: (p: Product) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clearCart: () => void
  setCustomer: (c: Customer | null) => void
  setDiscount: (d: number) => void
  setPaymentMode: (m: PosState['paymentMode']) => void
  setCashGiven: (a: number) => void
  recordSale: (total: number) => void
  subtotal: () => number
  total: () => number
}

// Expiration d'une promo — MIROIR EXACT de apps/backend/src/utils/pricing.ts et
// apps/frontend/src/lib/pricing.ts (cas partagés docs/shared-fixtures/promotion-active-cases.json).
// Active tant que `hasPromotion` ET que le jour (UTC) n'a pas dépassé `promotionEnd` (INCLUSIF).
// Pas d'échéance ('' / null) = promo sans fin. `now` INJECTÉ → fonction pure.
function dayUTC(v: string | Date): string {
  return (typeof v === 'string' ? v : v.toISOString()).slice(0, 10)
}
export function isPromotionActive(
  hasPromotion: boolean | null | undefined,
  promotionEnd: string | Date | null | undefined,
  now: Date,
): boolean {
  if (!hasPromotion) return false
  if (promotionEnd == null || promotionEnd === '') return true
  return dayUTC(now) <= dayUTC(promotionEnd)
}

// Résout le prix unitaire selon (qty, base, paliers, promo) — MIROIR EXACT du backend
// (apps/backend/src/utils/pricing.ts → resolveTierPrice). Priorité : promo active → palier
// matchant la quantité (minQty le plus haut ≤ qty) → prix de base.
// ⚠️ `hasPromotion` reçu ici doit DÉJÀ intégrer l'expiration (cf. isPromotionActive au point
// d'appel) — cette fonction reste pure et sans notion de temps.
export function resolveLinePrice(
  basePrice: number,
  qty: number,
  tiers?: PriceTier[] | null,
  hasPromotion?: boolean,
  promotionPrice?: number | null,
): { price: number; tierLabel?: string } {
  if (hasPromotion && promotionPrice != null) return { price: promotionPrice }
  if (!tiers?.length) return { price: basePrice }
  const applied = [...tiers]
    .sort((a, b) => b.minQty - a.minQty)
    .find(t => qty >= t.minQty)
  return applied ? { price: applied.price, tierLabel: applied.label } : { price: basePrice }
}

// Ventile un total TTC en HT + TVA selon un taux (%). Les prix POS sont TTC (posVatIncluded) :
// la TVA n'est PAS stockée côté backend → calcul d'affichage/ticket, miroir du web
// (totalHT = total / (1 + taux), tva = total − totalHT). Taux ≤ 0 → pas de TVA.
export function vatBreakdown(totalTTC: number, ratePct?: number): { ht: number; tva: number; rate: number } {
  const rate = ratePct && ratePct > 0 ? ratePct : 0
  if (!rate) return { ht: totalTTC, tva: 0, rate: 0 }
  const ht = totalTTC / (1 + rate / 100)
  return { ht, tva: totalTTC - ht, rate }
}

// Plafonne une quantité au stock disponible (évite la sur-vente → stock négatif côté backend).
// stockQty ≤ 0 ou absent (ex. produit sans suivi de stock) → pas de plafond.
export function capToStock(qty: number, stockQty?: number): number {
  if (stockQty != null && stockQty > 0) return Math.min(qty, stockQty)
  return qty
}

// Recalcule les champs prix d'une ligne pour une nouvelle quantité (immutable).
function repriceLine(item: CartItem, qty: number): CartItem {
  const base = item.basePrice ?? item.price
  // Promo EFFECTIVE = non expirée (ré-évaluée à chaque recalcul, cf. isPromotionActive).
  const promoActive = isPromotionActive(item.hasPromotion, item.promotionEnd, new Date())
  const r = resolveLinePrice(base, qty, item.priceTiers, promoActive, item.promotionPrice)
  return { ...item, quantity: qty, price: r.price, tierLabel: r.tierLabel }
}

export const usePosStore = create<PosState>((set, get) => ({
  cart:[], discount:0, paymentMode:'cash',
  customer:null,
  cashGiven:0, sessionTx:0, sessionCA:0,

  addItem: (p) => {
    const cart = get().cart
    const ex = cart.find(i => i.productId === p.id)
    if (ex) {
      // Ligne existante → +1 (plafonné au stock) et recalcul du prix (un palier peut se déclencher).
      set({ cart: cart.map(i => i.productId===p.id ? repriceLine(i, capToStock(i.quantity+1, i.stockQty)) : i) })
    } else {
      const base = Number(p.sellPrice) || 0
      const tiers = Array.isArray(p.priceTiers) ? (p.priceTiers as PriceTier[]) : null
      const hasPromotion = !!p.hasPromotion
      const promotionPrice = p.promotionPrice ?? null
      const promotionEnd = p.promotionEnd ?? null
      // Prix effectif = promo appliquée SEULEMENT si non expirée (miroir backend #125).
      const promoActive = isPromotionActive(hasPromotion, promotionEnd, new Date())
      const r = resolveLinePrice(base, 1, tiers, promoActive, promotionPrice)
      set({ cart:[...cart, {
        productId:p.id, name:p.name, price:r.price,
        quantity:1, emoji:p.emoji??'📦', stockQty:p.stockQty??0,
        // On stocke hasPromotion + promotionEnd BRUTS → repriceLine ré-évalue l'expiration.
        basePrice:base, hasPromotion, promotionPrice, promotionEnd, priceTiers:tiers, tierLabel:r.tierLabel,
      }]})
    }
  },
  removeItem: (id) => set({ cart:get().cart.filter(i=>i.productId!==id) }),
  updateQty: (id, qty) => {
    if (qty<=0) { get().removeItem(id); return }
    set({ cart:get().cart.map(i=>i.productId===id ? repriceLine(i, capToStock(qty, i.stockQty)) : i) })
  },
  clearCart: () => set({ cart:[], discount:0, cashGiven:0, customer:null }),
  setCustomer: (customer) => set({ customer }),
  setDiscount: (d) => set({ discount:d }),
  setPaymentMode: (m) => set({ paymentMode:m }),
  setCashGiven: (a) => set({ cashGiven:a }),
  recordSale: (total) => set(s=>({
    sessionTx:s.sessionTx+1, sessionCA:s.sessionCA+total
  })),
  subtotal: () => get().cart.reduce((s,i)=>s+i.price*i.quantity,0),
  total: () => {
    const sub=get().subtotal(); const d=get().discount
    return sub-(sub*d/100)
  },
}))
