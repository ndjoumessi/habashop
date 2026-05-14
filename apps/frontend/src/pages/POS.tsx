import { useState } from 'react'
import { useConfig, formatCurrency, convertCurrency, useFormatAmount, t } from '@/stores/appStore'
import { Minus, Plus, Trash2, ShoppingCart, Banknote, CreditCard, Smartphone, X } from 'lucide-react'
import toast from 'react-hot-toast'

/* ─── Données démo ─── */
const PRODUCTS = [
  { id:1,  name:'Riz parfumé 5kg',       price:4500,  cat:'cereals', emoji:'🌾', stock:120 },
  { id:2,  name:'Huile palme 1L',         price:1800,  cat:'fat',     emoji:'🫙', stock:18  },
  { id:3,  name:'Sucre 1kg',              price:850,   cat:'grocery', emoji:'🍚', stock:245 },
  { id:4,  name:'Farine blé 1kg',         price:650,   cat:'cereals', emoji:'🌾', stock:89  },
  { id:5,  name:'Savon OMO 500g',         price:500,   cat:'hygiene', emoji:'🧼', stock:150 },
  { id:6,  name:'Lait poudre 400g',       price:2200,  cat:'dairy',   emoji:'🥛', stock:67  },
  { id:7,  name:'Tomate conc. 800g',      price:1400,  cat:'canned',  emoji:'🍅', stock:112 },
  { id:8,  name:'Huile végétale 5L',      price:8500,  cat:'fat',     emoji:'🫒', stock:34  },
  { id:9,  name:'Café soluble 200g',      price:2800,  cat:'grocery', emoji:'☕', stock:55  },
  { id:10, name:'Sardines 155g',          price:900,   cat:'canned',  emoji:'🐟', stock:200 },
  { id:11, name:'Savon ménage 400g',      price:350,   cat:'hygiene', emoji:'🫧', stock:180 },
  { id:12, name:'Lait concentré 397g',    price:1100,  cat:'dairy',   emoji:'🥤', stock:95  },
]

const CATS = [
  { id:'all',     label: 'Tous'       },
  { id:'cereals', label: '🌾 Céréales'  },
  { id:'canned',  label: '🫙 Conserves' },
  { id:'fat',     label: '🫒 Corps gras' },
  { id:'hygiene', label: '🧼 Hygiène'   },
  { id:'dairy',   label: '🥛 Laitiers'  },
  { id:'grocery', label: '🛒 Épicerie'  },
]

interface CartItem { id:number; name:string; price:number; qty:number; emoji:string }

/* ─── Styles inline réutilisables ─── */
const S = {
  qtyBtn: (hovered: boolean): React.CSSProperties => ({
    width: 21, height: 21,
    background: hovered ? 'var(--p)' : 'var(--bg3)',
    border: `1px solid ${hovered ? 'var(--p)' : 'var(--border)'}`,
    borderRadius: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: hovered ? '#fff' : 'var(--text)',
    transition: 'all .12s', fontFamily: 'var(--font)',
  }),
  payBtn: (active: boolean): React.CSSProperties => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: '8px 4px', borderRadius: 9, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
    background: active ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
    border: `1px solid ${active ? 'var(--p2)' : 'var(--border)'}`,
    color: active ? 'var(--p2)' : 'var(--text2)',
  }),
}

/* ─── Bouton qty avec hover ─── */
function QtyBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      style={S.qtyBtn(hov)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function POS() {
  const { currency, posDefaultPayment, posShowStockOnTile, posTaxRate, lang } = useConfig()
  void lang
  const fmt = useFormatAmount()

  const [cart, setCart]           = useState<CartItem[]>([])
  const [cat, setCat]             = useState('all')
  const [search, setSearch]       = useState('')
  const [pay, setPay]             = useState<'cash'|'card'|'mobile'>(posDefaultPayment)
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

  const total           = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const taxRate         = posTaxRate / 100
  const totalHT         = total / (1 + taxRate)
  const tva             = total - totalHT
  const totalInCurrency = convertCurrency(total, 'XOF', currency)
  const change          = cashGiven ? +cashGiven - totalInCurrency : 0

  const confirmSale = () => {
    setSessionTx(n => n + 1)
    setSessionCA(n => n + total)
    toast.success(`✅ ${fmt(total)} encaissé`)
    setCart([])
    setShowModal(false)
    setCashGiven('')
  }

  return (
    <div
      className="animate-in"
      style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, height: 'calc(100vh - 112px)' }}
    >

      {/* ══ COLONNE GAUCHE — Catalogue ══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, overflow: 'hidden' }}>

        {/* Filtres catégories + recherche */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {CATS.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              style={{
                padding: '6px 13px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
                border: 'none',
                background: cat === c.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg3)',
                color: cat === c.id ? '#fff' : 'var(--text2)',
                boxShadow: cat === c.id ? '0 4px 14px rgba(91,78,232,.3)' : 'none',
              }}
            >
              {c.id === 'all' ? t('pos_all') : c.label}
            </button>
          ))}
          <div style={{ position: 'relative', marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 10, color: 'var(--text3)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input
              className="input"
              style={{ paddingLeft: 32, paddingTop: 6, paddingBottom: 6, fontSize: 13, width: 180 }}
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Grille produits */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
            {filtered.map(p => {
              const inCart = cart.find(i => i.id === p.id)
              const lowStock = p.stock < 20
              return (
                <div
                  key={p.id}
                  className={`product-tile${inCart ? ' in-cart' : ''}`}
                  onClick={() => addItem(p)}
                >
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{p.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, color: 'var(--text)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>
                    {fmt(p.price)}
                  </div>
                  {posShowStockOnTile && (
                    <div style={{ fontSize: 10, marginTop: 3, color: lowStock ? 'var(--danger)' : 'var(--text3)' }}>
                      Stock : {p.stock}
                    </div>
                  )}
                  {inCart && (
                    <span className="badge badge-violet" style={{ marginTop: 4, fontSize: 11 }}>×{inCart.qty}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══ COLONNE DROITE — Panier ══ */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 15px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            <ShoppingCart size={16} style={{ color: 'var(--p2)' }} />
            {t('pos_cart')}
          </div>
          <span className="badge badge-violet">
            {cart.length} article{cart.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Liste items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
          {cart.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text3)',
            }}>
              <ShoppingCart size={32} style={{ opacity: 0.2 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t('pos_empty')}</span>
              <span style={{ fontSize: 11 }}>Cliquez sur un produit</span>
            </div>
          ) : cart.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--acc)', fontFamily: 'var(--mono)' }}>
                  {fmt(item.price)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <QtyBtn onClick={() => updQty(item.id, -1)}><Minus size={9} /></QtyBtn>
                <span style={{ fontSize: 12, fontWeight: 700, width: 18, textAlign: 'center', color: 'var(--text)' }}>
                  {item.qty}
                </span>
                <QtyBtn onClick={() => updQty(item.id, +1)}><Plus size={9} /></QtyBtn>
              </div>
              <div style={{
                fontSize: 12.5, fontWeight: 700, color: 'var(--acc)',
                fontFamily: 'var(--mono)', minWidth: 62, textAlign: 'right',
              }}>
                {fmt(item.price * item.qty)}
              </div>
              <button
                onClick={() => updQty(item.id, -999)}
                style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div style={{ padding: '12px 15px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
            <span>{t('pos_subtotal')}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{fmt(totalHT)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
            <span>{t('pos_vat')} {posTaxRate} %</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{fmt(tva)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 15, fontWeight: 800, color: 'var(--p2)',
            paddingTop: 8, marginTop: 6, borderTop: '1px solid var(--border)',
            fontFamily: 'var(--mono)',
          }}>
            <span>{t('pos_total')}</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        {/* Modes paiement */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 15px 8px' }}>
          {([
            { id: 'cash'   as const, label: t('pos_cash'),   icon: <Banknote size={15} />   },
            { id: 'card'   as const, label: t('pos_card'),   icon: <CreditCard size={15} /> },
            { id: 'mobile' as const, label: t('pos_mobile'), icon: <Smartphone size={15} /> },
          ]).map(m => (
            <button key={m.id} style={S.payBtn(pay === m.id)} onClick={() => setPay(m.id)}>
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Input montant reçu (espèces) */}
        {pay === 'cash' && (
          <div style={{ margin: '0 15px 8px' }}>
            <input
              className="input"
              style={{ width: '100%', fontSize: 13, padding: '8px 10px' }}
              type="number"
              placeholder={t('pos_received') + '…'}
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
            />
            {cashGiven && change >= 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 13, fontWeight: 700, color: 'var(--acc2)', marginTop: 6,
              }}>
                <span>{t('pos_change')}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{formatCurrency(change, currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* Bouton encaisser */}
        <div style={{ margin: '0 12px 12px' }}>
          <button
            style={{
              width: '100%',
              background: cart.length ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg4)',
              border: 'none', color: '#fff', borderRadius: 10, padding: 12,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font)',
              boxShadow: cart.length ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
              transition: 'opacity .2s',
            }}
            onClick={() => cart.length ? setShowModal(true) : toast.error(t('pos_empty'))}
          >
            🧾 {t('pos_pay')} {cart.length > 0 ? fmt(total) : ''}
          </button>
        </div>

        {/* Résumé session */}
        <div style={{ padding: '12px 15px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text3)', marginBottom: 8,
          }}>
            Résumé session
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{
              background: 'var(--card2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--acc2)' }}>
                {sessionTx}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                {t('pos_transactions')}
              </div>
            </div>
            <div style={{
              background: 'var(--card2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{
                fontSize: 13, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--acc)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fmt(sessionCA)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                {t('pos_session_revenue')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Modal confirmation vente ══ */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>🧾 Confirmer la vente</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              {cart.map(i => (
                <div key={i.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text2)' }}>
                    {i.emoji} {i.name} <span style={{ color: 'var(--text3)' }}>×{i.qty}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    {fmt(i.price * i.qty)}
                  </span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingTop: 12, marginTop: 4, fontSize: 16, fontWeight: 800,
                color: 'var(--acc2)', fontFamily: 'var(--mono)',
              }}>
                <span style={{ color: 'var(--text)' }}>{t('pos_total')}</span>
                <span>{fmt(total)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={confirmSale}
              >
                ✅ {t('pos_validate')}
              </button>
              <button className="btn btn-ghost" onClick={confirmSale}>
                🖨️ {t('btn_print')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
