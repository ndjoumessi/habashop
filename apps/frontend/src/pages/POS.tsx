import { useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, Printer, X } from 'lucide-react'
import { useAppStore, formatCurrency } from '@/stores/appStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Product {
  id: number; name: string; price: number; category: string; stock: number; sku: string
}

interface CartItem extends Product { qty: number }

const PRODUCTS: Product[] = [
  { id: 1, name: 'Huile Palme 5L', price: 8500, category: 'Corps gras', stock: 45, sku: 'HU-PAL-5L' },
  { id: 2, name: 'Riz Parfumé 25kg', price: 24500, category: 'Céréales', stock: 120, sku: 'RI-PAR-25' },
  { id: 3, name: 'Sucre 50kg', price: 32000, category: 'Épicerie', stock: 80, sku: 'SU-BLC-50' },
  { id: 4, name: 'Lait Poudre 2.5kg', price: 18500, category: 'Laitiers', stock: 32, sku: 'LA-POU-25' },
  { id: 5, name: 'Savon OMO 1kg', price: 2800, category: 'Hygiène', stock: 200, sku: 'SA-OMO-1K' },
  { id: 6, name: 'Tomate Concentrée 850g', price: 1200, category: 'Conserves', stock: 150, sku: 'TO-CON-85' },
  { id: 7, name: 'Farine de blé 50kg', price: 28000, category: 'Céréales', stock: 60, sku: 'FA-BLE-50' },
  { id: 8, name: 'Savon de ménage 400g', price: 650, category: 'Hygiène', stock: 400, sku: 'SA-MEN-40' },
  { id: 9, name: 'Sardines 155g x12', price: 7200, category: 'Conserves', stock: 96, sku: 'SA-CON-12' },
  { id: 10, name: 'Beurre de Karité 1kg', price: 4500, category: 'Corps gras', stock: 70, sku: 'BK-KAR-1K' },
  { id: 11, name: 'Café Soluble 500g', price: 6800, category: 'Épicerie', stock: 42, sku: 'CA-SOL-50' },
  { id: 12, name: 'Lait Concentré 397g x24', price: 14400, category: 'Laitiers', stock: 48, sku: 'LC-CON-24' },
]

const CATEGORIES = ['Tous', 'Céréales', 'Corps gras', 'Épicerie', 'Laitiers', 'Hygiène', 'Conserves']

export default function POS() {
  const { currency } = useAppStore()
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Tous')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash')
  const [showReceipt, setShowReceipt] = useState(false)
  const [cashGiven, setCashGiven] = useState('')

  const filtered = PRODUCTS.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'Tous' || p.category === activeCategory
    return matchSearch && matchCat
  })

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  const removeItem = (id: number) => setCart(prev => prev.filter(i => i.id !== id))

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const vatRate = 0.18
  const totalHT = total / (1 + vatRate)
  const tva = total - totalHT
  const monnaie = cashGiven ? parseInt(cashGiven) - total : 0

  const validateSale = () => {
    if (cart.length === 0) { toast.error('Panier vide !'); return }
    setShowReceipt(true)
  }

  const confirmSale = () => {
    toast.success(`Vente validée — ${formatCurrency(total, currency)}`)
    setCart([])
    setShowReceipt(false)
    setCashGiven('')
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)] animate-fade-in">
      {/* Catalogue */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Recherche + filtres */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
            <input
              className="input pl-9 w-full"
              placeholder="Rechercher un produit ou scanner SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border',
                  activeCategory === cat ? 'text-white border-transparent' : 'border-current'
                )}
                style={{
                  background: activeCategory === cat ? 'linear-gradient(135deg, var(--p), var(--p2))' : 'var(--bg3)',
                  color: activeCategory === cat ? '#fff' : 'var(--text2)',
                  boxShadow: activeCategory === cat ? '0 4px 14px rgba(91,78,232,0.35)' : 'none',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grille produits */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="card text-left transition-all hover:-translate-y-0.5 hover:border-purple-500 active:scale-95"
                style={{ borderColor: cart.find(i => i.id === p.id) ? 'var(--p)' : 'var(--border)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-2"
                  style={{ background: 'var(--bg3)' }}
                >
                  📦
                </div>
                <p className="text-xs font-bold leading-tight mb-1" style={{ color: 'var(--text)' }}>{p.name}</p>
                <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>{p.sku}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black" style={{ color: 'var(--p2)' }}>
                    {formatCurrency(p.price, currency)}
                  </p>
                  <span className={clsx('badge text-xs', p.stock < 10 ? 'badge-red' : 'badge-green')}>
                    {p.stock}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Panier */}
      <div
        className="w-80 flex-shrink-0 flex flex-col rounded-xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <ShoppingCart size={18} style={{ color: 'var(--p)' }} />
          <span className="font-bold" style={{ color: 'var(--text)' }}>Panier</span>
          <span className="ml-auto badge badge-purple">{cart.length} article{cart.length > 1 ? 's' : ''}</span>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text3)' }}>
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Panier vide</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'var(--bg3)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{item.name}</p>
                <p className="text-xs" style={{ color: 'var(--p2)' }}>{formatCurrency(item.price * item.qty, currency)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)', color: 'var(--text2)' }}>
                  <Minus size={11} />
                </button>
                <span className="w-6 text-center text-xs font-bold" style={{ color: 'var(--text)' }}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)', color: 'var(--text2)' }}>
                  <Plus size={11} />
                </button>
              </div>
              <button onClick={() => removeItem(item.id)} style={{ color: 'var(--danger)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Totaux + Paiement */}
        <div className="p-3 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          <div className="space-y-1.5 text-xs" style={{ color: 'var(--text2)' }}>
            <div className="flex justify-between">
              <span>Sous-total HT</span>
              <span>{formatCurrency(totalHT, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>TVA (18%)</span>
              <span>{formatCurrency(tva, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-black pt-1" style={{ color: 'var(--text)' }}>
              <span>TOTAL TTC</span>
              <span style={{ color: 'var(--p)' }}>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {/* Mode de paiement */}
          <div className="flex gap-2">
            {[
              { id: 'cash', icon: <Banknote size={14} />, label: 'Espèces' },
              { id: 'card', icon: <CreditCard size={14} />, label: 'Carte' },
              { id: 'mobile', icon: <Smartphone size={14} />, label: 'Mobile' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id as any)}
                className={clsx('flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all border')}
                style={{
                  background: paymentMethod === m.id ? 'rgba(91,78,232,0.15)' : 'var(--bg3)',
                  borderColor: paymentMethod === m.id ? 'var(--p)' : 'transparent',
                  color: paymentMethod === m.id ? 'var(--p2)' : 'var(--text2)',
                }}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <input
              className="input text-sm"
              placeholder="Montant reçu..."
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
              type="number"
            />
          )}
          {cashGiven && monnaie >= 0 && (
            <div className="flex justify-between text-sm font-bold" style={{ color: 'var(--acc2)' }}>
              <span>Monnaie à rendre</span>
              <span>{formatCurrency(monnaie, currency)}</span>
            </div>
          )}

          <button
            onClick={validateSale}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm"
          >
            <ShoppingCart size={16} />
            Encaisser {cart.length > 0 ? formatCurrency(total, currency) : ''}
          </button>
        </div>
      </div>

      {/* Modal ticket */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card w-80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold" style={{ color: 'var(--text)' }}>Confirmer la vente</h3>
              <button onClick={() => setShowReceipt(false)} style={{ color: 'var(--text3)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-sm" style={{ color: 'var(--text2)' }}>
              {cart.map(i => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.name} x{i.qty}</span>
                  <span>{formatCurrency(i.price * i.qty, currency)}</span>
                </div>
              ))}
              <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between font-black text-base" style={{ color: 'var(--text)' }}>
                  <span>Total TTC</span>
                  <span style={{ color: 'var(--p)' }}>{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmSale} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
                <ShoppingCart size={15} /> Valider
              </button>
              <button onClick={confirmSale} className="btn-ghost flex items-center gap-1 px-3 py-2.5 text-sm">
                <Printer size={15} /> Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
