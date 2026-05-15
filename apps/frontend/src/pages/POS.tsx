import { useState } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { Search, Minus, Plus, Trash2, ShoppingCart, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── DONNÉES ───────────────────────────────
const CATS = [
  { id: 'all',     label: 'Tous' },
  { id: 'cereals', label: 'Céréales' },
  { id: 'fat',     label: 'Corps gras' },
  { id: 'grocery', label: 'Épicerie' },
  { id: 'hygiene', label: 'Hygiène' },
  { id: 'dairy',   label: 'Laitiers' },
  { id: 'canned',  label: 'Conserves' },
]

const PRODUCTS = [
  { id:1,  name:'Riz parfumé 5kg',       price:4500,  cat:'cereals', emoji:'🌾', stock:120 },
  { id:2,  name:'Huile palme 1L',         price:1800,  cat:'fat',     emoji:'🫙', stock:18  },
  { id:3,  name:'Sucre 1kg',              price:850,   cat:'grocery', emoji:'🍚', stock:245 },
  { id:4,  name:'Farine blé 1kg',         price:650,   cat:'cereals', emoji:'🌾', stock:89  },
  { id:5,  name:'Savon OMO 500g',         price:500,   cat:'hygiene', emoji:'🧼', stock:150 },
  { id:6,  name:'Lait poudre 400g',       price:2200,  cat:'dairy',   emoji:'🥛', stock:67  },
  { id:7,  name:'Tomate concentrée 800g', price:1400,  cat:'canned',  emoji:'🍅', stock:112 },
  { id:8,  name:'Huile végétale 5L',      price:8500,  cat:'fat',     emoji:'🫒', stock:34  },
  { id:9,  name:'Café soluble 200g',      price:2800,  cat:'grocery', emoji:'☕', stock:55  },
  { id:10, name:'Sardines 155g',          price:900,   cat:'canned',  emoji:'🐟', stock:200 },
  { id:11, name:'Savon ménage 400g',      price:350,   cat:'hygiene', emoji:'🫧', stock:180 },
  { id:12, name:'Lait concentré 397g',    price:1100,  cat:'dairy',   emoji:'🥤', stock:95  },
]

interface CartItem {
  id: number
  name: string
  price: number
  qty: number
  emoji: string
}

// ─── COMPOSANT ─────────────────────────────
export default function POS() {
  const { lang } = useAppStore()
  void lang
  const fmt = useFormatAmount()

  const [cart, setCart]           = useState<CartItem[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch]       = useState('')
  const [payMode, setPayMode]     = useState<'cash'|'card'|'mobile'>('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [sessionTx, setSessionTx] = useState(42)
  const [sessionCA, setSessionCA] = useState(842500)

  // Filtrage produits
  const filtered = PRODUCTS.filter(p =>
    (activeCat === 'all' || p.cat === activeCat) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Actions panier
  const addItem = (p: typeof PRODUCTS[0]) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, emoji: p.emoji }]
    })
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i)
          .filter(i => i.qty > 0)
    )
  }

  const removeItem = (id: number) => setCart(prev => prev.filter(i => i.id !== id))

  // Calculs
  const VAT_RATE = 0.18
  const total    = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const totalHT  = total / (1 + VAT_RATE)
  const tva      = total - totalHT
  const monnaie  = cashGiven ? parseFloat(cashGiven) * (total > 100 ? 1 : 655.957) - total : 0

  const printTicket = () => {
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    const now = new Date()
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ticket de caisse</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Courier New',monospace; font-size:12px; color:#000; padding:10px; max-width:300px; margin:0 auto; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .big { font-size:16px; font-weight:900; }
    .divider { border-top:1px dashed #000; margin:8px 0; }
    .row { display:flex; justify-content:space-between; margin:4px 0; }
    .total { font-size:15px; font-weight:900; }
    .footer { margin-top:12px; font-size:10px; }
    @media print { @page { size:80mm auto; margin:0; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="big">HabaShop</div>
    <div style="font-size:10px;color:#555;">Logiciel de gestion commerciale</div>
    <div style="font-size:10px;margin-top:4px;">Dakar, Sénégal</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span>Date:</span><span>${now.toLocaleDateString('fr-FR')}</span></div>
  <div class="row"><span>Heure:</span><span>${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="row"><span>Caisse:</span><span>Caisse 1</span></div>
  <div class="row"><span>N° ticket:</span><span>#V${Date.now().toString().slice(-6)}</span></div>
  <div class="divider"></div>
  <div class="bold" style="margin-bottom:6px;">ARTICLES</div>
  ${cart.map(item => `
    <div class="row">
      <span style="flex:1;">${item.name}</span>
      <span style="margin:0 8px;">x${item.qty}</span>
      <span>${(item.price * item.qty).toLocaleString('fr-FR')} F</span>
    </div>
  `).join('')}
  <div class="divider"></div>
  <div class="row"><span>Sous-total HT:</span><span>${Math.round(totalHT).toLocaleString('fr-FR')} FCFA</span></div>
  <div class="row"><span>TVA (18 %):</span><span>${Math.round(tva).toLocaleString('fr-FR')} FCFA</span></div>
  <div class="divider"></div>
  <div class="row total"><span>TOTAL TTC:</span><span>${total.toLocaleString('fr-FR')} FCFA</span></div>
  <div class="row" style="margin-top:6px;"><span>Mode paiement:</span><span>${payMode === 'cash' ? 'Espèces' : payMode === 'card' ? 'Carte' : 'Mobile'}</span></div>
  ${cashGiven ? `
    <div class="row"><span>Reçu:</span><span>${parseFloat(cashGiven).toLocaleString('fr-FR')} FCFA</span></div>
    <div class="row bold"><span>Monnaie rendue:</span><span>${monnaie.toLocaleString('fr-FR')} FCFA</span></div>
  ` : ''}
  <div class="divider"></div>
  <div class="center footer">
    <div>Merci de votre achat !</div>
    <div style="margin-top:4px;">Conservez ce ticket</div>
    <div style="margin-top:8px;font-size:9px;">HabaShop — ${now.toLocaleDateString('fr-FR')}</div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);}<\/script>
</body>
</html>`
    win.document.write(html)
    win.document.close()
  }

  const confirmSale = () => {
    setSessionTx(n => n + 1)
    setSessionCA(n => n + total)
    toast.success('✅ Vente encaissée !')
    setCart([])
    setShowModal(false)
    setCashGiven('')
  }

  // ─── RENDER ──────────────────────────────
  return (
    <>
      {/* PAGE WRAPPER */}
      <div style={{
        display: 'flex',
        gap: 14,
        height: 'calc(100vh - 112px)',
        overflow: 'hidden',
      }}>

        {/* ════════════════════════════════
            COLONNE GAUCHE — CATALOGUE
        ════════════════════════════════ */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflow: 'hidden',
        }}>

          {/* Filtres catégories + Recherche */}
          <div style={{
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 7,
            alignItems: 'center',
          }}>
            {CATS.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                style={{
                  padding: '7px 15px',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  transition: 'all .15s',
                  border: 'none',
                  background: activeCat === c.id
                    ? 'linear-gradient(135deg, var(--p), var(--p2))'
                    : 'var(--bg3)',
                  color: activeCat === c.id ? '#fff' : 'var(--text2)',
                  boxShadow: activeCat === c.id
                    ? '0 4px 14px rgba(91,78,232,.35)'
                    : 'none',
                }}
              >{c.label}</button>
            ))}

            {/* Recherche */}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={14} style={{
                position: 'absolute', left: 10,
                top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', pointerEvents: 'none',
              }} />
              <input
                className="input"
                style={{ paddingLeft: 34, width: 200, fontSize: 13 }}
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Grille produits — SCROLL ICI */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10,
              paddingBottom: 8,
            }}>
              {filtered.map(p => {
                const inCart     = cart.find(i => i.id === p.id)
                const isLowStock = p.stock < 20
                return (
                  <div
                    key={p.id}
                    onClick={() => addItem(p)}
                    style={{
                      background: inCart
                        ? 'linear-gradient(135deg, rgba(91,78,232,.15), rgba(124,111,240,.08))'
                        : 'var(--card)',
                      border: inCart
                        ? '1.5px solid var(--p2)'
                        : '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '16px 12px 14px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all .18s',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onMouseEnter={e => {
                      if (!inCart) {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = 'var(--p2)'
                        el.style.transform = 'translateY(-2px)'
                        el.style.boxShadow = '0 8px 24px rgba(91,78,232,.18)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!inCart) {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = 'var(--border)'
                        el.style.transform = 'none'
                        el.style.boxShadow = 'none'
                      }
                    }}
                  >
                    {/* Badge quantité si dans panier */}
                    {inCart && (
                      <div style={{
                        position: 'absolute',
                        top: -8, right: -8,
                        background: 'var(--p)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 22, height: 22,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                        border: '2px solid var(--bg)',
                      }}>×{inCart.qty}</div>
                    )}

                    {/* Emoji dans cercle */}
                    <div style={{
                      width: 52, height: 52,
                      borderRadius: '50%',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                    }}>{p.emoji}</div>

                    {/* Nom */}
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                      lineHeight: 1.3,
                    }}>{p.name}</div>

                    {/* Prix */}
                    <div style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--acc)',
                      fontFamily: 'var(--mono)',
                    }}>{fmt(p.price)}</div>

                    {/* Stock */}
                    <div style={{
                      fontSize: 10.5,
                      color: isLowStock ? 'var(--danger)' : 'var(--text3)',
                      fontWeight: isLowStock ? 600 : 400,
                    }}>
                      {isLowStock ? '⚠️ ' : ''}Stock : {p.stock}
                    </div>
                  </div>
                )
              })}

              {filtered.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: 'var(--text3)',
                  fontSize: 14,
                }}>
                  Aucun produit trouvé
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════
            COLONNE DROITE — PANIER
        ════════════════════════════════ */}
        <div style={{
          width: 320,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>

          {/* Header panier */}
          <div style={{
            flexShrink: 0,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(91,78,232,.12), rgba(124,111,240,.06))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} style={{ color: 'var(--p2)' }} />
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                Panier
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Caisse 1</span>
              <div style={{
                background: cart.length ? 'var(--p)' : 'var(--bg4)',
                color: cart.length ? '#fff' : 'var(--text3)',
                borderRadius: '50%',
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
              }}>{cart.length}</div>
            </div>
          </div>

          {/* Liste articles — ZONE SCROLLABLE */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}>
            {cart.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '40px 20px',
              }}>
                <div style={{
                  width: 64, height: 64,
                  borderRadius: '50%',
                  background: 'rgba(91,78,232,.08)',
                  border: '2px dashed rgba(91,78,232,.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                }}>🛒</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
                  Panier vide
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
                  Cliquez sur un produit<br />pour l'ajouter
                </div>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background .12s',
                  }}
                  onMouseEnter={e =>
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'
                  }
                  onMouseLeave={e =>
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }
                >
                  {/* Emoji */}
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 9,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}>{item.emoji}</div>

                  {/* Nom + prix unitaire */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>{item.name}</div>
                    <div style={{
                      fontSize: 10.5,
                      color: 'var(--text3)',
                      marginTop: 2,
                      fontFamily: 'var(--mono)',
                    }}>{fmt(item.price)} / u</div>
                  </div>

                  {/* Contrôles quantité */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      style={{
                        width: 22, height: 22,
                        borderRadius: 5,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'inherit',
                        transition: 'all .12s',
                        padding: 0,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'var(--p)'
                        el.style.color = '#fff'
                        el.style.borderColor = 'var(--p)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'var(--bg3)'
                        el.style.color = 'var(--text2)'
                        el.style.borderColor = 'var(--border)'
                      }}
                    ><Minus size={11} /></button>

                    <span style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--text)',
                      minWidth: 20,
                      textAlign: 'center',
                      fontFamily: 'var(--mono)',
                    }}>{item.qty}</span>

                    <button
                      onClick={() => updateQty(item.id, +1)}
                      style={{
                        width: 22, height: 22,
                        borderRadius: 5,
                        background: 'var(--bg3)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'inherit',
                        transition: 'all .12s',
                        padding: 0,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'var(--p)'
                        el.style.color = '#fff'
                        el.style.borderColor = 'var(--p)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'var(--bg3)'
                        el.style.color = 'var(--text2)'
                        el.style.borderColor = 'var(--border)'
                      }}
                    ><Plus size={11} /></button>
                  </div>

                  {/* Total + Supprimer */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                    flexShrink: 0,
                  }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--p2)',
                      fontFamily: 'var(--mono)',
                      minWidth: 65,
                      textAlign: 'right',
                    }}>{fmt(item.price * item.qty)}</span>
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text3)',
                        fontSize: 10,
                        padding: 0,
                        fontFamily: 'inherit',
                        transition: 'color .12s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      onMouseEnter={e =>
                        (e.currentTarget as HTMLElement).style.color = 'var(--danger)'
                      }
                      onMouseLeave={e =>
                        (e.currentTarget as HTMLElement).style.color = 'var(--text3)'
                      }
                    >
                      <Trash2 size={10} /> Retirer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totaux */}
          <div style={{
            flexShrink: 0,
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            background: 'rgba(255,255,255,.02)',
          }}>
            {[
              { label: 'Sous-total HT', value: fmt(totalHT) },
              { label: 'TVA (18 %)',    value: fmt(tva) },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--text2)',
                marginBottom: 5,
              }}>
                <span>{row.label}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{row.value}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text2)',
                letterSpacing: '.5px',
              }}>TOTAL TTC</span>
              <span style={{
                fontSize: 22,
                fontWeight: 900,
                color: 'var(--p2)',
                fontFamily: 'var(--mono)',
                letterSpacing: '-1px',
              }}>{fmt(total)}</span>
            </div>
          </div>

          {/* Modes de paiement */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 7, padding: '10px 14px 8px' }}>
            {[
              { id: 'cash',   label: 'Espèces', icon: '💵' },
              { id: 'card',   label: 'Carte',   icon: '💳' },
              { id: 'mobile', label: 'Mobile',  icon: '📲' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setPayMode(m.id as 'cash' | 'card' | 'mobile')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '9px 6px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all .18s',
                  background: payMode === m.id ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                  border: payMode === m.id ? '1.5px solid var(--p2)' : '1px solid var(--border)',
                  color: payMode === m.id ? 'var(--p2)' : 'var(--text2)',
                  boxShadow: payMode === m.id ? '0 4px 14px rgba(91,78,232,.2)' : 'none',
                }}
              >
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Input espèces */}
          {payMode === 'cash' && (
            <div style={{ flexShrink: 0, padding: '0 14px 10px' }}>
              <input
                className="input"
                type="number"
                placeholder="Montant reçu..."
                value={cashGiven}
                onChange={e => setCashGiven(e.target.value)}
                style={{ fontSize: 13 }}
              />
              {cashGiven && parseFloat(cashGiven) > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 7,
                  padding: '8px 12px',
                  background: 'rgba(14,196,126,.08)',
                  border: '1px solid rgba(14,196,126,.2)',
                  borderRadius: 9,
                }}>
                  <span style={{ fontSize: 11, color: 'var(--acc2)', fontWeight: 600 }}>
                    💚 Monnaie à rendre
                  </span>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: 'var(--acc2)',
                    fontFamily: 'var(--mono)',
                  }}>{fmt(monnaie)}</span>
                </div>
              )}
            </div>
          )}

          {/* Bouton Encaisser */}
          <div style={{ flexShrink: 0, padding: '4px 12px 12px' }}>
            <button
              onClick={() => cart.length ? setShowModal(true) : toast.error('Panier vide !')}
              style={{
                width: '100%',
                background: cart.length
                  ? 'linear-gradient(135deg, var(--p), var(--p2))'
                  : 'var(--bg4)',
                border: 'none',
                borderRadius: 11,
                padding: '13px',
                fontSize: 14,
                fontWeight: 800,
                color: cart.length ? '#fff' : 'var(--text3)',
                cursor: cart.length ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: cart.length ? '0 6px 20px rgba(91,78,232,.38)' : 'none',
                transition: 'all .2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              🧾 {cart.length ? `Encaisser ${fmt(total)}` : 'Panier vide'}
            </button>
          </div>

          {/* Résumé session */}
          <div style={{ flexShrink: 0, padding: '10px 14px 14px', borderTop: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 9.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--text3)',
              }}>📊 Résumé session</span>
              <span style={{
                background: 'rgba(91,78,232,.1)',
                color: 'var(--p2)',
                borderRadius: 20,
                padding: '2px 8px',
                fontSize: 9,
                fontWeight: 700,
              }}>{new Date().toLocaleDateString('fr-FR')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {[
                { label: 'Transactions', value: sessionTx,      color: 'var(--acc2)', icon: '🧾', isNumber: true  },
                { label: 'CA session',   value: fmt(sessionCA), color: 'var(--acc)',  icon: '💰', isNumber: false },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '9px 11px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <span style={{ fontSize: 12 }}>{s.icon}</span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.5px',
                      color: 'var(--text3)',
                    }}>{s.label}</span>
                  </div>
                  <div style={{
                    fontSize: s.isNumber ? 22 : 12,
                    fontWeight: 900,
                    color: s.color,
                    fontFamily: 'var(--mono)',
                    letterSpacing: '-1px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          MODAL CONFIRMATION
      ════════════════════════════════ */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal-box">
            {/* Header modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40,
                  borderRadius: '50%',
                  background: 'rgba(14,196,126,.15)',
                  border: '1px solid rgba(14,196,126,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>✅</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    Confirmer la vente
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {cart.length} article{cart.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button className="mini-btn" onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>

            {/* Liste items */}
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
              {cart.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text2)' }}>
                    {item.emoji} {item.name} ×{item.qty}
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    {fmt(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              background: 'rgba(14,196,126,.08)',
              border: '1px solid rgba(14,196,126,.2)',
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>TOTAL TTC</span>
              <span style={{
                fontSize: 20,
                fontWeight: 900,
                color: 'var(--acc2)',
                fontFamily: 'var(--mono)',
              }}>{fmt(total)}</span>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmSale}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, var(--acc2), #059669)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 16px rgba(14,196,126,.35)',
                }}
              >✅ Valider & Encaisser</button>
              <button
                onClick={() => { printTicket(); confirmSale() }}
                className="mini-btn"
                style={{ padding: '12px 16px', fontSize: 13 }}
              >🖨️ Ticket</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
