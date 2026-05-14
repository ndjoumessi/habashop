import { useState } from 'react'
import { useConfig, formatCurrency, convertCurrency, useFormatAmount, t } from '@/stores/appStore'
import { X } from 'lucide-react'
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
  { id:'all',     label: 'Tous'        },
  { id:'cereals', label: '🌾 Céréales'  },
  { id:'canned',  label: '🫙 Conserves' },
  { id:'fat',     label: '🫒 Corps gras' },
  { id:'hygiene', label: '🧼 Hygiène'   },
  { id:'dairy',   label: '🥛 Laitiers'  },
  { id:'grocery', label: '🛒 Épicerie'  },
]

interface CartItem { id:number; name:string; price:number; qty:number; emoji:string }

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

  const PAY_MODES = [
    { id: 'cash'   as const, label: t('pos_cash'),   icon: '💵' },
    { id: 'card'   as const, label: t('pos_card'),   icon: '💳' },
    { id: 'mobile' as const, label: t('pos_mobile'), icon: '📲' },
  ]

  return (
    <div
      className="animate-in"
      style={{ display: 'flex', gap: 12, height: 'calc(100vh - 112px)' }}
    >

      {/* ══ COLONNE GAUCHE — Catalogue ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, overflow: 'hidden' }}>

        {/* Filtres catégories + recherche */}
        <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
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

        {/* Grille produits — flex:1 + overflow pour scroll */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {filtered.map(p => {
              const inCart   = cart.find(i => i.id === p.id)
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
        width: 320, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        height: '100%',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>

        {/* 1. HEADER — hauteur fixe */}
        <div style={{
          flexShrink: 0,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(91,78,232,.12), rgba(124,111,240,.06))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🛒</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{t('pos_cart')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Caisse 1</span>
            <div style={{
              background: cart.length ? 'var(--p)' : 'var(--bg4)',
              color: cart.length ? '#fff' : 'var(--text3)',
              borderRadius: '50%', width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
            }}>{cart.length}</div>
          </div>
        </div>

        {/* 2. LISTE ITEMS — flex:1 + overflow:auto — CRITIQUE */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: cart.length ? '4px 0' : 0,
        }}>
          {cart.length === 0 ? (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, padding: '30px 20px',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(91,78,232,.08)',
                border: '2px dashed rgba(91,78,232,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>🛒</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>{t('pos_empty')}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
                Cliquez sur un produit pour l'ajouter
              </div>
            </div>
          ) : cart.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 14px',
                borderBottom: '1px solid var(--border)',
                transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              {/* Emoji */}
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>{item.emoji}</div>

              {/* Nom + prix unitaire */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{item.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                  {fmt(item.price)} / unité
                </div>
              </div>

              {/* Contrôles quantité */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <button
                  onClick={() => updQty(item.id, -1)}
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    color: 'var(--text2)', cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit', transition: 'all .12s',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--p)'; el.style.color = '#fff'; el.style.borderColor = 'var(--p)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--bg3)'; el.style.color = 'var(--text2)'; el.style.borderColor = 'var(--border)' }}
                >−</button>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: 'var(--text)',
                  minWidth: 18, textAlign: 'center', fontFamily: 'var(--mono)',
                }}>{item.qty}</span>
                <button
                  onClick={() => updQty(item.id, +1)}
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    color: 'var(--text2)', cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'inherit', transition: 'all .12s',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--p)'; el.style.color = '#fff'; el.style.borderColor = 'var(--p)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--bg3)'; el.style.color = 'var(--text2)'; el.style.borderColor = 'var(--border)' }}
                >+</button>
              </div>

              {/* Total + supprimer */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                <span style={{
                  fontSize: 13, fontWeight: 800, color: 'var(--p2)',
                  fontFamily: 'var(--mono)', minWidth: 65, textAlign: 'right',
                }}>{fmt(item.price * item.qty)}</span>
                <button
                  onClick={() => updQty(item.id, -999)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: 10, padding: 0,
                    fontFamily: 'inherit', transition: 'color .12s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--danger)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text3)'}
                >✕ Retirer</button>
              </div>
            </div>
          ))}
        </div>

        {/* 3. TOTAUX — hauteur fixe */}
        <div style={{
          flexShrink: 0,
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'rgba(255,255,255,.02)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>
            <span>{t('pos_subtotal')}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{fmt(totalHT)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
            <span>{t('pos_vat')} ({posTaxRate} %)</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{fmt(tva)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 8, borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.5px' }}>
              {t('pos_total')}
            </span>
            <span style={{
              fontSize: 22, fontWeight: 900, color: 'var(--p2)',
              fontFamily: 'var(--mono)', letterSpacing: '-1px',
            }}>{fmt(total)}</span>
          </div>
        </div>

        {/* 4. MODES PAIEMENT — hauteur fixe */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 7, padding: '10px 14px 8px' }}>
          {PAY_MODES.map(m => (
            <button key={m.id} onClick={() => setPay(m.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '9px 4px',
              borderRadius: 10, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s',
              background: pay === m.id ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
              border: pay === m.id ? '1.5px solid var(--p2)' : '1px solid var(--border)',
              color: pay === m.id ? 'var(--p2)' : 'var(--text2)',
              boxShadow: pay === m.id ? '0 4px 14px rgba(91,78,232,.2)' : 'none',
            }}>
              <span style={{ fontSize: 17 }}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* 5. INPUT ESPÈCES — hauteur fixe */}
        {pay === 'cash' && (
          <div style={{ flexShrink: 0, padding: '0 14px 10px' }}>
            <input
              className="input"
              type="number"
              placeholder={t('pos_received') + '…'}
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
              style={{ fontSize: 13 }}
            />
            {cashGiven && change >= 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 7, padding: '8px 12px',
                background: 'rgba(14,196,126,.08)',
                border: '1px solid rgba(14,196,126,.2)',
                borderRadius: 9,
              }}>
                <span style={{ fontSize: 11, color: 'var(--acc2)', fontWeight: 600 }}>
                  💚 {t('pos_change')}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 900,
                  color: 'var(--acc2)', fontFamily: 'var(--mono)',
                }}>{formatCurrency(change, currency)}</span>
              </div>
            )}
          </div>
        )}

        {/* 6. BOUTON ENCAISSER — hauteur fixe */}
        <div style={{ flexShrink: 0, padding: '4px 12px 12px' }}>
          <button
            onClick={() => cart.length ? setShowModal(true) : toast.error(t('pos_empty'))}
            style={{
              width: '100%',
              background: cart.length ? 'linear-gradient(135deg, var(--p), var(--p2))' : 'var(--bg4)',
              border: 'none', borderRadius: 11, padding: '13px',
              fontSize: 14, fontWeight: 800,
              color: cart.length ? '#fff' : 'var(--text3)',
              cursor: cart.length ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: cart.length ? '0 6px 20px rgba(91,78,232,.38)' : 'none',
              transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            🧾 {cart.length ? `${t('pos_pay')} ${fmt(total)}` : t('pos_empty')}
          </button>
        </div>

        {/* 7. RÉSUMÉ SESSION — hauteur fixe */}
        <div style={{ flexShrink: 0, padding: '10px 14px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
          }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1px', color: 'var(--text3)',
            }}>📊 Résumé session</span>
            <span style={{
              background: 'rgba(91,78,232,.1)', color: 'var(--p2)',
              borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 700,
            }}>{new Date().toLocaleDateString('fr-FR')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[
              { label: t('pos_transactions'),    value: String(sessionTx), color: 'var(--acc2)', icon: '🧾', big: true  },
              { label: t('pos_session_revenue'), value: fmt(sessionCA),    color: 'var(--acc)',  icon: '💰', big: false },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '9px 11px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <span style={{ fontSize: 12 }}>{s.icon}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.5px', color: 'var(--text3)',
                  }}>{s.label}</span>
                </div>
                <div style={{
                  fontSize: s.big ? 22 : 12,
                  fontWeight: 900, color: s.color,
                  fontFamily: 'var(--mono)', letterSpacing: '-1px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Modal confirmation vente ══ */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">

            {/* Header modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(14,196,126,.15)',
                  border: '1.5px solid rgba(14,196,126,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>✅</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Confirmer la vente</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{fmt(total)}</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>

            {/* Liste items */}
            <div style={{ marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
              {cart.map(i => (
                <div key={i.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text2)' }}>
                    {i.emoji} {i.name} <span style={{ color: 'var(--text3)' }}>×{i.qty}</span>
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    {fmt(i.price * i.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Mode de paiement sélectionné */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 18 }}>{PAY_MODES.find(m => m.id === pay)?.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                {PAY_MODES.find(m => m.id === pay)?.label}
              </span>
            </div>

            {/* TOTAL TTC */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px',
              background: 'rgba(14,196,126,.08)',
              border: '1px solid rgba(14,196,126,.2)',
              borderRadius: 12, marginBottom: 20,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {t('pos_total')}
              </span>
              <span style={{
                fontSize: 22, fontWeight: 900,
                color: 'var(--acc2)', fontFamily: 'var(--mono)', letterSpacing: '-1px',
              }}>{fmt(total)}</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{
                  flex: 1, justifyContent: 'center', padding: '12px',
                  background: 'linear-gradient(135deg, #0EC47E, #059669)',
                  boxShadow: '0 4px 18px rgba(14,196,126,.35)',
                }}
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
