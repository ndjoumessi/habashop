import { create } from 'zustand'
import type { PriceTier, Product } from '@/types'

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
  priceTiers?: PriceTier[] | null
  // Libellé du palier appliqué (si un palier — et non une promo — est actif), pour l'UI.
  tierLabel?: string
}

interface PosState {
  cart: CartItem[]; discount: number
  paymentMode: PaymentMode
  cashGiven: number; sessionTx: number; sessionCA: number
  addItem: (p: Product) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clearCart: () => void
  setDiscount: (d: number) => void
  setPaymentMode: (m: PosState['paymentMode']) => void
  setCashGiven: (a: number) => void
  recordSale: (total: number) => void
  subtotal: () => number
  total: () => number
}

// Résout le prix unitaire selon (qty, base, paliers, promo) — MIROIR EXACT du backend
// (apps/backend/src/utils/pricing.ts → resolveTierPrice). Priorité : promo active → palier
// matchant la quantité (minQty le plus haut ≤ qty) → prix de base.
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

// Recalcule les champs prix d'une ligne pour une nouvelle quantité (immutable).
function repriceLine(item: CartItem, qty: number): CartItem {
  const base = item.basePrice ?? item.price
  const r = resolveLinePrice(base, qty, item.priceTiers, item.hasPromotion, item.promotionPrice)
  return { ...item, quantity: qty, price: r.price, tierLabel: r.tierLabel }
}

export const usePosStore = create<PosState>((set, get) => ({
  cart:[], discount:0, paymentMode:'cash',
  cashGiven:0, sessionTx:0, sessionCA:0,

  addItem: (p) => {
    const cart = get().cart
    const ex = cart.find(i => i.productId === p.id)
    if (ex) {
      // Ligne existante → +1 et recalcul du prix (un palier peut se déclencher).
      set({ cart: cart.map(i => i.productId===p.id ? repriceLine(i, i.quantity+1) : i) })
    } else {
      const base = Number(p.sellPrice) || 0
      const tiers = Array.isArray(p.priceTiers) ? (p.priceTiers as PriceTier[]) : null
      const hasPromotion = !!p.hasPromotion
      const promotionPrice = p.promotionPrice ?? null
      const r = resolveLinePrice(base, 1, tiers, hasPromotion, promotionPrice)
      set({ cart:[...cart, {
        productId:p.id, name:p.name, price:r.price,
        quantity:1, emoji:p.emoji??'📦', stockQty:p.stockQty??0,
        basePrice:base, hasPromotion, promotionPrice, priceTiers:tiers, tierLabel:r.tierLabel,
      }]})
    }
  },
  removeItem: (id) => set({ cart:get().cart.filter(i=>i.productId!==id) }),
  updateQty: (id, qty) => {
    if (qty<=0) { get().removeItem(id); return }
    set({ cart:get().cart.map(i=>i.productId===id ? repriceLine(i, qty) : i) })
  },
  clearCart: () => set({ cart:[], discount:0, cashGiven:0 }),
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
