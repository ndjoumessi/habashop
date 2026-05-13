import { useState } from 'react'
import { useAppStore, formatCurrency } from '@/stores/appStore'
import toast from 'react-hot-toast'

const PRODUCTS = [
  { id: 1, name: 'Riz parfumé 5kg', price: 4500, category: 'cereals', emoji: '🌾', stock: 120 },
  { id: 2, name: 'Huile palme 1L', price: 1800, category: 'fat', emoji: '🫙', stock: 18 },
  { id: 3, name: 'Sucre 1kg', price: 850, category: 'grocery', emoji: '🍚', stock: 245 },
  { id: 4, name: 'Farine blé 1kg', price: 650, category: 'cereals', emoji: '🌾', stock: 89 },
  { id: 5, name: 'Savon OMO 500g', price: 500, category: 'hygiene', emoji: '🧼', stock: 150 },
  { id: 6, name: 'Lait poudre 400g', price: 2200, category: 'dairy', emoji: '🥛', stock: 67 },
  { id: 7, name: 'Tomate concentrée 800g', price: 1400, category: 'canned', emoji: '🍅', stock: 112 },
  { id: 8, name: 'Huile végétale 5L', price: 8500, category: 'fat', emoji: '🫒', stock: 34 },
  { id: 9, name: 'Café soluble 200g', price: 2800, category: 'grocery', emoji: '☕', stock: 55 },
  { id: 10, name: 'Sardines 155g', price: 900, category: 'canned', emoji: '🐟', stock: 200 },
  { id: 11, name: 'Savon de ménage 400g', price: 350, category: 'hygiene', emoji: '🫧', stock: 180 },
  { id: 12, name: 'Lait concentré 397g', price: 1100, category: 'dairy', emoji: '🥤', stock: 95 },
]

const CATS = [
  { id: 'all', label: 'Tous' },
  { id: 'cereals', label: '🌾 Céréales' },
  { id: 'canned', label: '🫙 Conserves' },
  { id: 'fat', label: '🫒 Corps gras' },
  { id: 'hygiene', label: '🧼 Hygiène' },
  { id: 'dairy', label: '🥛 Laitiers' },
  { id: 'grocery', label: '🛒 Épicerie' },
]

interface CartItem { id: number; name: string; price: number; qty: number; emoji: string }

export default function POS() {
  const { currency } = useAppStore()
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [payMode, setPayMode] = useState<'cash' | 'card' | 'mobile'>('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [sessionTx, setSessionTx] = useState(42)
  const [sessionCA, setSessionCA] = useState(842500)

  const filtered = PRODUCTS.filter(p => {
    const matchCat = activeCat === 'all' || p.category === activeCat
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const addToCart = (p: typeof PRODUCTS[0]) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji }]
    })
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const totalHT = total / 1.18
  const tva = total - totalHT
  const monnaie = cashGiven ? parseInt(cashGiven) - total : 0

  const validateSale = () => {
    if (!cart.length) { toast.error('Panier vide !'); return }
    setShowModal(true)
  }

  const confirmSale = () => {
    setSessionTx(t => t + 1)
    setSessionCA(c => c + total)
    toast.success(`✅ Vente encaissée — ${formatCurrency(total, currency)}`)
    setCart([])
    setShowModal(false)
    setCashGiven('')
  }

  return (
    <div className="page active" id="page-pos">
      <div className="pos-wrap">
        {/* Catalogue */}
        <div className="pos-items">
          <div className="pos-filters" id="posFilters">
            {CATS.map(c => (
              <button
                key={c.id}
                className={`pos-filter-btn${activeCat === c.id ? ' active' : ''}`}
                onClick={() => setActiveCat(c.id)}
              >{c.label}</button>
            ))}
            <input
              className="form-input"
              style={{ marginLeft: 'auto', width: 180, fontSize: 12 }}
              placeholder="🔍 Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="product-grid">
            {filtered.map(p => (
              <div
                key={p.id}
                className={`product-tile${cart.find(i => i.id === p.id) ? ' selected' : ''}`}
                onClick={() => addToCart(p)}
              >
                <div className="pt-emoji">{p.emoji}</div>
                <div className="pt-name">{p.name}</div>
                <div className="pt-price">{formatCurrency(p.price, currency)}</div>
                <div className="pt-stock" style={{ color: p.stock < 20 ? 'var(--danger)' : 'var(--text3)' }}>
                  Stock: {p.stock}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panier */}
        <div className="cart-panel">
          <div className="cart-h">
            <div className="cart-title">🛒 Panier</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{cart.length} article{cart.length > 1 ? 's' : ''}</div>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                <div style={{ fontSize: 13 }}>Panier vide</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Cliquez sur un produit pour l'ajouter</div>
              </div>
            ) : cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="ci-emoji">{item.emoji}</div>
                <div className="ci-info">
                  <div className="ci-name">{item.name}</div>
                  <div className="ci-price">{formatCurrency(item.price, currency)}</div>
                </div>
                <div className="ci-qty">
                  <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                  <span className="qty-val">{item.qty}</span>
                  <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                </div>
                <div className="ci-total">{formatCurrency(item.price * item.qty, currency)}</div>
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="cart-summary">
            <div className="summary-row"><span>Sous-total HT</span><span>{formatCurrency(totalHT, currency)}</span></div>
            <div className="summary-row"><span>TVA (18%)</span><span>{formatCurrency(tva, currency)}</span></div>
            <div className="summary-total"><span>TOTAL TTC</span><span>{formatCurrency(total, currency)}</span></div>
          </div>

          {/* Mode de paiement */}
          <div className="pay-modes">
            {[
              { id: 'cash', label: '💵 Espèces' },
              { id: 'card', label: '💳 Carte' },
              { id: 'mobile', label: '📲 Mobile' },
            ].map(m => (
              <button
                key={m.id}
                className={`pay-mode-btn${payMode === m.id ? ' active' : ''}`}
                onClick={() => setPayMode(m.id as any)}
              >{m.label}</button>
            ))}
          </div>

          {payMode === 'cash' && (
            <input
              className="form-input"
              type="number"
              placeholder="Montant reçu (F CFA)…"
              style={{ marginBottom: 8 }}
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
            />
          )}
          {cashGiven && monnaie >= 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--acc2)' }}>
              <span>Monnaie à rendre</span>
              <span>{formatCurrency(monnaie, currency)}</span>
            </div>
          )}

          <button className="pay-btn" onClick={validateSale}>
            🧾 Encaisser {cart.length > 0 ? formatCurrency(total, currency) : ''}
          </button>

          {/* Résumé session */}
          <div className="session-summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text2)', letterSpacing: '.6px' }}>📊 Résumé session</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--p2)', background: 'rgba(91,78,232,.12)', padding: '3px 8px', borderRadius: 20 }}>
                {new Date().toLocaleDateString('fr')}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(14,196,126,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🧾</div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Transactions</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--acc2)', lineHeight: 1 }}>{sessionTx}</div>
              </div>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(240,165,0,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>💰</div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>CA encaissé</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--acc)', lineHeight: 1, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatCurrency(sessionCA, currency)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal confirmation */}
      {showModal && (
        <div className="modal-overlay show">
          <div className="modal">
            <div className="modal-h">
              <div className="modal-t">🧾 Confirmer la vente</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              {cart.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>{i.emoji} {i.name} × {i.qty}</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(i.price * i.qty, currency)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800 }}>
                <span>Total TTC</span>
                <span style={{ color: 'var(--acc2)' }}>{formatCurrency(total, currency)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="topbar-btn" style={{ flex: 1 }} onClick={confirmSale}>✅ Valider & Encaisser</button>
              <button className="topbar-btn" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={confirmSale}>🖨️ Imprimer ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
