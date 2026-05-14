import { useState } from 'react'
import { useConfig, formatCurrency, convertCurrency, useFormatAmount, t } from '@/stores/appStore'
import { Search, Minus, Plus, Trash2, ShoppingCart, Banknote, CreditCard, Smartphone, X } from 'lucide-react'
import toast from 'react-hot-toast'

const PRODUCTS = [
  { id:1,  name:'Riz parfumé 5kg',       price:4500,  cat:'cereals', emoji:'🌾', stock:120 },
  { id:2,  name:'Huile palme 1L',         price:1800,  cat:'fat',     emoji:'🫙', stock:18  },
  { id:3,  name:'Sucre 1kg',              price:850,   cat:'grocery', emoji:'🍚', stock:245 },
  { id:4,  name:'Farine blé 1kg',         price:650,   cat:'cereals', emoji:'🌾', stock:89  },
  { id:5,  name:'Savon OMO 500g',         price:500,   cat:'hygiene', emoji:'🧼', stock:5   },
  { id:6,  name:'Lait poudre 400g',       price:2200,  cat:'dairy',   emoji:'🥛', stock:67  },
  { id:7,  name:'Tomate concentrée 800g', price:1400,  cat:'canned',  emoji:'🍅', stock:112 },
  { id:8,  name:'Huile végétale 5L',      price:8500,  cat:'fat',     emoji:'🫒', stock:34  },
  { id:9,  name:'Café soluble 200g',      price:2800,  cat:'grocery', emoji:'☕', stock:55  },
  { id:10, name:'Sardines 155g',          price:900,   cat:'canned',  emoji:'🐟', stock:200 },
  { id:11, name:'Savon ménage 400g',      price:350,   cat:'hygiene', emoji:'🫧', stock:180 },
  { id:12, name:'Lait concentré 397g',    price:1100,  cat:'dairy',   emoji:'🥤', stock:95  },
]

const CATS = [
  { id:'all',     label: () => t('pos_all') },
  { id:'cereals', label: () => '🌾 Céréales'  },
  { id:'canned',  label: () => '🫙 Conserves' },
  { id:'fat',     label: () => '🫒 Corps gras' },
  { id:'hygiene', label: () => '🧼 Hygiène'   },
  { id:'dairy',   label: () => '🥛 Laitiers'  },
  { id:'grocery', label: () => '🛒 Épicerie'  },
]

interface CartItem { id:number; name:string; price:number; qty:number; emoji:string }

export default function POS() {
  const { currency, posDefaultPayment, posShowStockOnTile, posTaxRate, lang } = useConfig()
  void lang // for t() reactivity
  const fmt = useFormatAmount()

  const [cart, setCart]         = useState<CartItem[]>([])
  const [cat, setCat]           = useState('all')
  const [search, setSearch]     = useState('')
  const [pay, setPay]           = useState<'cash'|'card'|'mobile'>(posDefaultPayment)
  const [cashGiven, setCashGiven] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [sessionTx, setSessionTx] = useState(42)
  const [sessionCA, setSessionCA] = useState(842500)

  const filtered = PRODUCTS.filter(p =>
    (cat === 'all' || p.cat === cat) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const addItem = (p: typeof PRODUCTS[0]) => setCart(prev => {
    const ex = prev.find(i => i.id === p.id)
    if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
    return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji }]
  })

  const updQty = (id: number, d: number) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + d } : i).filter(i => i.qty > 0))

  const total   = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const taxRate = posTaxRate / 100
  const totalHT = total / (1 + taxRate)
  const tva     = total - totalHT
  const totalInCurrency = convertCurrency(total, 'XOF', currency)
  const change  = cashGiven ? +cashGiven - totalInCurrency : 0

  const confirmSale = () => {
    setSessionTx(n => n + 1)
    setSessionCA(n => n + total)
    toast.success(`✅ ${fmt(total)} encaissé`)
    setCart([])
    setShowModal(false)
    setCashGiven('')
  }

  const PAY_MODES = [
    { id: 'cash',   label: t('pos_cash'),   icon: <Banknote size={13} />   },
    { id: 'card',   label: t('pos_card'),   icon: <CreditCard size={13} /> },
    { id: 'mobile', label: t('pos_mobile'), icon: <Smartphone size={13} /> },
  ]

  return (
    <div className="animate-in" style={{ height: 'calc(100vh - 112px)' }}>
      <div className="pos-wrap h-full">
        {/* ── Catalogue ── */}
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            {CATS.map(c => (
              <button key={c.id}
                onClick={() => setCat(c.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: cat === c.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg3)',
                  color: cat === c.id ? '#fff' : 'var(--text2)',
                  border: 'none',
                  boxShadow: cat === c.id ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
                  fontFamily: 'inherit',
                }}>
                {c.label()}
              </button>
            ))}
            <div className="search-wrap ml-auto">
              <span className="search-icon"><Search size={13} /></span>
              <input className="input pl-8 py-1.5 text-sm w-44" placeholder="Rechercher…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Grille produits */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(p => {
                const inCart = cart.find(i => i.id === p.id)
                const lowStock = p.stock < 20
                return (
                  <div key={p.id}
                    className={`product-tile${inCart ? ' in-cart' : ''}`}
                    onClick={() => addItem(p)}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{p.emoji}</div>
                    <div className="text-xs font-semibold leading-tight mb-1" style={{ color: 'var(--text)' }}>{p.name}</div>
                    <div className="text-sm font-black" style={{ color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>
                      {fmt(p.price)}
                    </div>
                    {posShowStockOnTile && (
                      <div className="text-xs mt-1" style={{ color: lowStock ? 'var(--danger)' : 'var(--text3)' }}>
                        Stock : {p.stock}
                      </div>
                    )}
                    {inCart && (
                      <span className="badge badge-violet text-xs mt-1">×{inCart.qty}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Panier ── */}
        <div className="cart-box">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} style={{ color: 'var(--p2)' }} />
              <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>{t('pos_cart')}</span>
            </div>
            <span className="badge badge-violet">{cart.length} article{cart.length > 1 ? 's' : ''}</span>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2"
                style={{ color: 'var(--text3)' }}>
                <ShoppingCart size={28} style={{ opacity: 0.3 }} />
                <p className="text-sm">{t('pos_empty')}</p>
              </div>
            ) : cart.map(item => (
              <div key={item.id} className="cart-item">
                <span className="text-base flex-shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{item.name}</div>
                  <div className="text-xs" style={{ color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>
                    {fmt(item.price)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="qty-btn" onClick={() => updQty(item.id, -1)}><Minus size={10} /></button>
                  <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--text)' }}>{item.qty}</span>
                  <button className="qty-btn" onClick={() => updQty(item.id, +1)}><Plus size={10} /></button>
                </div>
                <div className="text-xs font-bold ml-1" style={{ color: 'var(--acc)', fontFamily: 'var(--mono)', minWidth: 60, textAlign: 'right' }}>
                  {fmt(item.price * item.qty)}
                </div>
                <button onClick={() => updQty(item.id, -999)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="px-4 py-3 space-y-1.5 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text2)' }}>
              <span>{t('pos_subtotal')}</span><span>{fmt(totalHT)}</span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text2)' }}>
              <span>{t('pos_vat')} {posTaxRate}%</span><span>{fmt(tva)}</span>
            </div>
            <div className="flex justify-between font-black text-sm pt-1" style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
              <span style={{ color: 'var(--text)' }}>{t('pos_total')}</span>
              <span style={{ color: 'var(--p2)', fontFamily: 'var(--mono)' }}>{fmt(total)}</span>
            </div>
          </div>

          {/* Mode paiement */}
          <div className="flex gap-2 px-3 pb-2 flex-shrink-0">
            {PAY_MODES.map(m => (
              <button key={m.id} className={`pay-mode${pay === m.id ? ' active' : ''}`}
                onClick={() => setPay(m.id as 'cash' | 'card' | 'mobile')}>
                {m.icon}<span>{m.label}</span>
              </button>
            ))}
          </div>

          {pay === 'cash' && (
            <div className="px-3 pb-2">
              <input className="input text-sm py-2" type="number" placeholder="Montant reçu…"
                value={cashGiven} onChange={e => setCashGiven(e.target.value)} />
              {cashGiven && change >= 0 && (
                <div className="flex justify-between text-xs font-bold mt-1.5" style={{ color: 'var(--acc2)' }}>
                  <span>{t('pos_change')}</span>
                  <span style={{ fontFamily: 'var(--mono)' }}>{formatCurrency(change, currency)}</span>
                </div>
              )}
            </div>
          )}

          <div className="px-3 pb-3 flex-shrink-0">
            <button
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
              style={{
                background: cart.length ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg4)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: cart.length ? '0 6px 20px rgba(99,102,241,0.3)' : 'none',
              }}
              onClick={() => cart.length ? setShowModal(true) : toast.error('Panier vide !')}>
              🧾 {t('pos_pay')} {cart.length > 0 ? fmt(total) : ''}
            </button>
          </div>

          {/* Session summary */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3 grid grid-cols-2 gap-2" style={{ background: 'var(--bg3)' }}>
              <div className="rounded-lg p-2.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text3)' }}>{t('pos_transactions')}</div>
                <div className="text-xl font-black" style={{ color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>{sessionTx}</div>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text3)' }}>{t('pos_session_revenue')}</div>
                <div className="text-xs font-black truncate" style={{ color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{fmt(sessionCA)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal confirmation */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>🧾 Confirmer la vente</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <div className="space-y-2 mb-5">
              {cart.map(i => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text2)' }}>{i.emoji} {i.name} ×{i.qty}</span>
                  <span className="font-bold" style={{ fontFamily: 'var(--mono)' }}>{fmt(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between font-black text-base pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span>{t('pos_total')}</span>
                <span style={{ color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>{fmt(total)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center py-3" onClick={confirmSale}>✅ Valider</button>
              <button className="btn btn-ghost" onClick={confirmSale}>🖨️ Ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
