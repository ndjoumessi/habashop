import { create } from 'zustand'

export interface CartItem {
  productId: string; name: string; price: number
  quantity: number; emoji: string; stockQty: number
}

interface PosState {
  cart: CartItem[]; discount: number
  paymentMode: 'cash'|'wave'|'orange'|'card'
  cashGiven: number; sessionTx: number; sessionCA: number
  addItem: (p: any) => void
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

export const usePosStore = create<PosState>((set, get) => ({
  cart:[], discount:0, paymentMode:'cash',
  cashGiven:0, sessionTx:0, sessionCA:0,

  addItem: (p) => {
    const cart = get().cart
    const ex = cart.find(i => i.productId === p.id)
    if (ex) {
      set({ cart: cart.map(i =>
        i.productId===p.id ? {...i,quantity:i.quantity+1} : i) })
    } else {
      set({ cart:[...cart,{
        productId:p.id, name:p.name, price:p.sellPrice,
        quantity:1, emoji:p.emoji??'📦', stockQty:p.stockQty??0
      }]})
    }
  },
  removeItem: (id) => set({ cart:get().cart.filter(i=>i.productId!==id) }),
  updateQty: (id, qty) => {
    if (qty<=0) { get().removeItem(id); return }
    set({ cart:get().cart.map(i=>i.productId===id?{...i,quantity:qty}:i) })
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
