import { usePosStore } from '@/stores/posStore'
import type { Product, Customer } from '@/types'

function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: 'p1', name: 'Riz', category: 'cereals', sellPrice: 1000,
    stockQty: 99, stockMin: 5, emoji: '🌾', isActive: true, ...over,
  }
}

const store = () => usePosStore.getState()

beforeEach(() => { store().clearCart() })

describe('posStore — panier', () => {
  it('addItem ajoute une ligne au prix de vente', () => {
    store().addItem(makeProduct())
    expect(store().cart).toHaveLength(1)
    expect(store().subtotal()).toBe(1000)
    expect(store().total()).toBe(1000)
  })

  it('addItem deux fois incrémente la quantité', () => {
    const p = makeProduct()
    store().addItem(p); store().addItem(p)
    expect(store().cart[0].quantity).toBe(2)
    expect(store().subtotal()).toBe(2000)
  })

  it('plafonne au stock (addItem ne dépasse pas stockQty)', () => {
    const p = makeProduct({ stockQty: 2 })
    store().addItem(p); store().addItem(p); store().addItem(p)
    expect(store().cart[0].quantity).toBe(2)
  })

  it('updateQty plafonne aussi au stock', () => {
    const p = makeProduct({ stockQty: 2 })
    store().addItem(p)
    store().updateQty('p1', 10)
    expect(store().cart[0].quantity).toBe(2)
  })

  it('updateQty à 0 retire la ligne', () => {
    store().addItem(makeProduct())
    store().updateQty('p1', 0)
    expect(store().cart).toHaveLength(0)
  })

  it('applique la promotion (prix promo au panier)', () => {
    store().addItem(makeProduct({ hasPromotion: true, promotionPrice: 800 }))
    expect(store().cart[0].price).toBe(800)
    expect(store().subtotal()).toBe(800)
  })

  it('applique le palier au franchissement de quantité', () => {
    const p = makeProduct({ stockQty: 99, priceTiers: [{ minQty: 3, price: 800, label: '3+' }] })
    store().addItem(p)
    expect(store().cart[0].price).toBe(1000) // qty 1 : prix de base
    store().updateQty('p1', 3)
    expect(store().cart[0].price).toBe(800)  // qty 3 : palier
    expect(store().cart[0].tierLabel).toBe('3+')
    expect(store().subtotal()).toBe(2400)
  })

  it('total applique la remise en pourcentage', () => {
    store().addItem(makeProduct())
    store().setDiscount(10)
    expect(store().total()).toBe(900)
  })

  it('clearCart réinitialise panier, remise et client', () => {
    const customer: Customer = { id: 'c1', name: 'Aminata', loyaltyPoints: 5 }
    store().addItem(makeProduct())
    store().setDiscount(15)
    store().setCustomer(customer)
    store().clearCart()
    expect(store().cart).toHaveLength(0)
    expect(store().discount).toBe(0)
    expect(store().customer).toBeNull()
  })
})
