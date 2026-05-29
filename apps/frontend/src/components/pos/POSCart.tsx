import { Trash2, ShoppingCart, Lock, Tag, Banknote, CreditCard, Smartphone, BarChart3, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirm } from '@/lib/confirm'
import { type CartItem } from '@/components/pos/posShared'

interface POSCartProps {
  lang: string
  cart: CartItem[]; setCart: (v: any) => void
  cashierSessionTx: number; cashierSessionCA: number
  setShowCloseModal: (b: boolean) => void
  fmt: (n: number) => string
  discount: any; discountAmount: number
  totalHT: number; tva: number; posTaxRate: number; total: number
  PAY_MODES: any[]; payMode: string; setPayMode: (v: any) => void
  currencySymbol: string
  cashGiven: string; setCashGiven: (v: string) => void
  monnaie: number
  confirmSale: () => void
  setShowModal: (b: boolean) => void
  updateQty: (id: any, delta: number) => void
  isMobile: boolean; mobileView: string
  // Crédit client
  customers: { id: string; name: string; phone?: string; creditBalance?: number; creditLimit?: number | null }[]
  selectedCustomerId: string; setSelectedCustomerId: (v: string) => void
  selectedCustomer: { id: string; name: string; creditBalance?: number; creditLimit?: number | null } | null
  partial: boolean; setPartial: (v: boolean) => void
  partialAmount: string; setPartialAmount: (v: string) => void
  canCheckout: boolean
}

export default function POSCart({ lang, cart, setCart, cashierSessionTx, cashierSessionCA, setShowCloseModal, fmt, discount, discountAmount, totalHT, tva, posTaxRate, total, PAY_MODES, payMode, setPayMode, currencySymbol, cashGiven, setCashGiven, monnaie, confirmSale, setShowModal, updateQty, isMobile, mobileView, customers, selectedCustomerId, setSelectedCustomerId, selectedCustomer, partial, setPartial, partialAmount, setPartialAmount, canCheckout }: POSCartProps) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  return (
        <div style={{
          width: isMobile ? '100%' : 320,
          flexShrink: 0,
          display: isMobile && mobileView === 'products' ? 'none' : 'flex',
          flexDirection: 'column',
          padding: isMobile ? 0 : '12px 16px 12px 12px',
          overflow: 'hidden',
        }}>

          {/* Cart card */}
          <div style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: isMobile ? 0 : 14,
            overflow: 'hidden',
          }}>

          {/* ── HEADER PANIER UNIQUE ── */}
          <div style={{
            flexShrink: 0,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg,rgba(91,78,232,.1),rgba(124,111,240,.05))',
            display: 'flex', alignItems: 'center', gap: 8,
            position: 'sticky', top: 0, zIndex: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg,var(--p),var(--p2))',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(108,71,255,.4)',
            }}><ShoppingCart size={16} style={{ color:'#fff' }} /></div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', flex: 1 }}>
              {lang === 'fr' ? 'Panier' : lang === 'en' ? 'Cart' : lang === 'es' ? 'Carrito' : 'Carrello'}
            </span>
            {cart.length > 0 && (
              <span style={{
                background: 'var(--p)',
                color: '#fff', borderRadius: 20,
                padding: '2px 8px', fontSize: 11,
                fontWeight: 800, fontFamily: 'var(--mono)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {cart.reduce((s, i) => s + i.qty, 0)}{' '}
                {lang === 'en' ? 'items' : lang === 'es' ? 'art.' : lang === 'it' ? 'art.' : 'art.'}
              </span>
            )}
            {cashierSessionTx > 0 && (
              <span style={{
                background: 'rgba(0,208,132,.15)',
                border: '1px solid var(--c-green-border)',
                color: 'var(--acc2)', borderRadius: 20,
                padding: '3px 10px', fontSize: 11,
                fontWeight: 700, fontFamily: 'var(--mono)',
                display: 'flex', alignItems: 'center', gap: 4,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--acc2)',
                  boxShadow: '0 0 6px var(--acc2)',
                }}/>
                {cashierSessionTx} tx
              </span>
            )}
            {cart.length > 0 && (
              <button type="button"
                onClick={async () => { if (await confirm({ title: lang === 'en' ? 'Clear cart' : lang === 'es' ? 'Vaciar el carrito' : lang === 'it' ? 'Svuota il carrello' : 'Vider le panier', message: lang === 'en' ? 'All items will be removed from the cart.' : lang === 'es' ? 'Se eliminarán todos los artículos del carrito.' : lang === 'it' ? 'Tutti gli articoli del carrello saranno rimossi.' : 'Tous les articles du panier seront retirés.', danger: true })) setCart([]) }}
                title={lang === 'en' ? 'Clear cart' : lang === 'es' ? 'Vaciar el carrito' : lang === 'it' ? 'Svuota il carrello' : 'Vider le panier'}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'rgba(232,64,74,.1)', border: '1px solid rgba(232,64,74,.2)',
                  cursor: 'pointer', fontSize: 12, color: 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s', flexShrink: 0,
                }}><Trash2 size={12} /></button>
            )}
            <button type="button" onClick={() => setShowCloseModal(true)} style={{
              fontSize: 11, color: 'var(--danger)',
              background: 'rgba(232,64,74,.1)', border: '1px solid rgba(232,64,74,.2)',
              borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              fontFamily: 'var(--font)', fontWeight: 700, flexShrink: 0,
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 4,
            }}><Lock size={11} /> {lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}</button>
          </div>

          {/* ── LISTE ITEMS — ZONE SCROLLABLE ── */}
          <div style={{
            flexGrow: 1, flexShrink: 1, flexBasis: '0px',
            overflowY: 'auto', overflowX: 'hidden', minHeight: 0,
          }}>
            {cart.length === 0 ? (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', height:'100%', color:'var(--text3)',
                gap:10, padding:20,
              }}>
                <div style={{
                  width:60, height:60, borderRadius:'50%',
                  border:'2px dashed var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}><ShoppingCart size={26} style={{ color:'var(--text3)' }} /></div>
                <div style={{ fontSize:13, fontWeight:600, textAlign:'center', color:'var(--text2)' }}>
                  {lang === 'fr' ? 'Panier vide' : lang === 'en' ? 'Empty cart' : lang === 'es' ? 'Carrito vacío' : 'Carrello vuoto'}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>
                  {lang === 'fr' ? 'Cliquez sur un produit' : lang === 'en' ? 'Click on a product' : lang === 'es' ? 'Haga clic en un producto' : 'Clicca su un prodotto'}
                </div>
              </div>
            ) : (
              <div style={{ padding:'6px 8px' }}>
                {cart.map((item, idx) => (
                  <div key={item.id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'9px 10px',
                    borderBottom: idx < cart.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                    borderRadius:10, transition:'background .1s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(91,78,232,.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width:36, height:36, borderRadius:10,
                      background:'linear-gradient(135deg,rgba(91,78,232,.12),rgba(124,111,240,.08))',
                      border:'1px solid rgba(91,78,232,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18, flexShrink:0,
                    }}>{item.emoji ?? '📦'}</div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, fontWeight:700, color:'var(--text)', lineHeight:1.3,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      }}>{item.name}</div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:1, fontFamily:'var(--mono)' }}>
                        {fmt(item.price)} / unité
                      </div>
                    </div>

                    <div style={{
                      display:'flex', alignItems:'center', gap:3, flexShrink:0,
                      background:'var(--bg3)', border:'1px solid var(--border)',
                      borderRadius:8, padding:3,
                    }}>
                      <button type="button"
                        onClick={() => updateQty(item.id, -1)}
                        style={{
                          width:22, height:22, borderRadius:6,
                          background: item.qty === 1 ? 'rgba(232,64,74,.2)' : 'transparent',
                          border:'none', cursor:'pointer', fontSize:12,
                          color: item.qty === 1 ? 'var(--danger)' : 'var(--text2)',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all .1s',
                        }}>
                        {item.qty === 1 ? '×' : '−'}
                      </button>
                      <span style={{
                        fontSize:13, fontWeight:900, color:'var(--text)',
                        fontFamily:'var(--mono)', minWidth:20, textAlign:'center', lineHeight:1,
                      }}>{item.qty}</span>
                      <button type="button"
                        onClick={() => updateQty(item.id, +1)}
                        style={{
                          width:22, height:22, borderRadius:6,
                          background:'var(--p)', border:'none', cursor:'pointer',
                          fontSize:14, color:'#fff',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all .1s',
                          boxShadow:'0 2px 6px rgba(91,78,232,.3)',
                        }}>+</button>
                    </div>

                    <div style={{
                      fontSize:13, fontWeight:900, color:'var(--p2)',
                      fontFamily:'var(--mono)', minWidth:62, textAlign:'right', flexShrink:0,
                    }}>{fmt(item.price * item.qty)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TOTAUX ── */}
          {cart.length > 0 && (
            <div style={{
              flexShrink:0, padding:'10px 14px',
              borderTop:'1px solid var(--border)',
              background:'linear-gradient(180deg,var(--bg3),var(--bg4))',
            }}>
              {discount && discountAmount > 0 && (
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'4px 8px', marginBottom:6,
                  background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.15)',
                  borderRadius:8,
                }}>
                  <span style={{ fontSize:11, color:'var(--acc2)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                    <Tag size={11} /> {lang === 'en' ? 'Discount' : lang === 'es' ? 'Descuento' : lang === 'it' ? 'Sconto' : 'Remise'}{discount.type === 'percent' ? ` ${discount.value}%` : ''}
                  </span>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                    − {fmt(discountAmount)}
                  </span>
                </div>
              )}
              <div style={{
                display:'flex', justifyContent:'space-between',
                fontSize:10, color:'var(--text3)', marginBottom:6, padding:'0 2px',
              }}>
                <span>HT : <span style={{ fontFamily:'var(--mono)' }}>{fmt(Math.round(totalHT))}</span></span>
                <span>TVA {posTaxRate}% : <span style={{ fontFamily:'var(--mono)' }}>{fmt(Math.round(tva))}</span></span>
              </div>
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 10px',
                background:'rgba(91,78,232,.08)', border:'1px solid rgba(91,78,232,.15)',
                borderRadius:10,
              }}>
                <span style={{ fontSize:11, fontWeight:800, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px' }}>TOTAL TTC</span>
                <span style={{ fontSize:26, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>{fmt(total)}</span>
              </div>
            </div>
          )}

          {/* ── SÉLECTEUR CLIENT (toujours visible, obligatoire si crédit) ── */}
          <div style={{ flexShrink: 0, padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:4 }}>
              <User size={11} /> {i('Client', 'Customer', 'Cliente', 'Cliente')}
              {payMode === 'credit' && <span style={{ color:'var(--danger)' }}> *</span>}
            </label>
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              style={{
                width:'100%', padding:'7px 8px', fontSize:12,
                background:'var(--bg3)', border:`1.5px solid ${payMode === 'credit' && !selectedCustomerId ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius:8, color:'var(--text)', fontFamily:'inherit',
              }}
            >
              <option value="">{i('— Aucun client —', '— No customer —', '— Sin cliente —', '— Nessun cliente —')}</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
            {selectedCustomer && (selectedCustomer.creditBalance ?? 0) > 0 && (
              <div style={{
                marginTop:6, padding:'6px 10px', borderRadius:8,
                background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.3)',
                display:'flex', justifyContent:'space-between', alignItems:'center',
                fontSize:11, fontWeight:700, color:'#F59E0B',
              }}>
                <span>{i('Dette en cours', 'Outstanding debt', 'Deuda actual', 'Debito attuale')}</span>
                <span style={{ fontFamily:'var(--mono)', fontWeight:900 }}>{fmt(selectedCustomer.creditBalance ?? 0)}</span>
              </div>
            )}
          </div>

          {/* ── MODES PAIEMENT — 3 cols × 2 rangées ── */}
          <div style={{ flexShrink: 0, padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 6 }}>
              {PAY_MODES.map(mode => (
                <button key={mode.id} type="button" onClick={() => setPayMode(mode.id)}
                  style={{
                    padding: '6px 2px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'var(--font)',
                    background: payMode === mode.id ? `${mode.color}20` : 'var(--bg3)',
                    border: `1.5px solid ${payMode === mode.id ? mode.color : 'var(--border)'}`,
                    color: payMode === mode.id ? mode.color : 'var(--text3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'all .12s',
                  }}>
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', height:16 }}>
                    {mode.id === 'cash'   ? <Banknote size={14} />   :
                     mode.id === 'card'   ? <CreditCard size={14} /> :
                     mode.id === 'wave'   ? <span style={{ fontWeight:900, fontSize:10, lineHeight:1 }}>W</span>  :
                     mode.id === 'orange' ? <span style={{ fontWeight:900, fontSize:9, lineHeight:1 }}>OM</span>  :
                     mode.id === 'credit' ? <CreditCard size={14} /> :
                                            <Smartphone size={14} />}
                  </span>
                  {mode.label}
                </button>
              ))}
            </div>

            {payMode === 'credit' && (
              <div style={{
                marginTop:6, padding:'8px 10px',
                background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)',
                borderRadius:8,
              }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, fontWeight:600, color:'var(--text2)' }}>
                  <input type="checkbox" checked={partial} onChange={e => { setPartial(e.target.checked); if (!e.target.checked) setPartialAmount('') }} />
                  {i('Acompte versé', 'Down payment', 'Anticipo recibido', 'Acconto versato')}
                </label>
                {partial && (
                  <div style={{ position:'relative', marginTop:6 }}>
                    <input className="input" type="number"
                      placeholder={i('Montant de l\'acompte…', 'Down payment amount…', 'Importe del anticipo…', 'Importo dell\'acconto…')}
                      value={partialAmount} onChange={e => setPartialAmount(e.target.value)}
                      style={{ textAlign:'right', paddingRight:50, fontSize:13 }}
                    />
                    <span style={{
                      position:'absolute', right:12, top:'50%',
                      transform:'translateY(-50%)',
                      fontSize:11, fontWeight:700, color:'var(--text3)',
                      pointerEvents:'none',
                    }}>{currencySymbol}</span>
                  </div>
                )}
                <div style={{ marginTop:6, fontSize:10, color:'var(--text3)' }}>
                  {partial && partialAmount
                    ? <>{i('Reste dû', 'Remaining due', 'Saldo pendiente', 'Resto dovuto')} : <strong style={{ color:'#F59E0B' }}>{fmt(Math.max(0, total - (parseFloat(partialAmount)||0)))}</strong></>
                    : i('Le client paiera plus tard. La dette s\'ajoute à son solde.', 'Customer will pay later. The debt is added to their balance.', 'El cliente pagará más tarde. La deuda se añade a su saldo.', 'Il cliente pagherà dopo. Il debito è aggiunto al suo saldo.')}
                </div>
              </div>
            )}

            {payMode === 'cash' && (
              <div style={{ marginTop:6 }}>
                <div style={{ position:'relative' }}>
                  <input className="input" type="number"
                    placeholder={lang === 'en' ? 'Amount received...' : lang === 'es' ? 'Importe recibido...' : lang === 'it' ? 'Importo ricevuto...' : 'Montant reçu...'}
                    value={cashGiven} onChange={e => setCashGiven(e.target.value)}
                    style={{ textAlign:'right', paddingRight:50, fontSize:13 }}
                  />
                  <span style={{
                    position:'absolute', right:12, top:'50%',
                    transform:'translateY(-50%)',
                    fontSize:11, fontWeight:700, color:'var(--text3)',
                    pointerEvents:'none',
                  }}>{currencySymbol}</span>
                </div>
                {cashGiven && parseFloat(cashGiven) > 0 && (
                  <div style={{
                    marginTop:6, display:'flex', justifyContent:'space-between',
                    alignItems:'center', fontSize:13, padding:'8px 12px',
                    background: monnaie >= 0 ? 'rgba(0,208,132,.08)' : 'rgba(255,59,92,.08)',
                    border:`1px solid ${monnaie >= 0 ? 'rgba(0,208,132,.2)' : 'rgba(255,59,92,.2)'}`,
                    borderRadius:10,
                  }}>
                    <span style={{ color:'var(--text2)', fontWeight:600 }}>
                      {lang === 'en' ? 'Change' : lang === 'es' ? 'Cambio a devolver' : lang === 'it' ? 'Resto da dare' : 'Monnaie à rendre'}
                    </span>
                    <span style={{ fontWeight:900, fontFamily:'var(--mono)', fontSize:16, color: monnaie >= 0 ? 'var(--acc2)' : 'var(--danger)' }}>
                      {monnaie >= 0
                        ? fmt(monnaie)
                        : `− ${fmt(Math.abs(monnaie))}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(payMode === 'wave' || payMode === 'orange') && cart.length > 0 && (
              <div style={{
                marginTop:6, padding:'8px 10px',
                background: payMode === 'wave' ? 'rgba(27,154,245,.08)' : 'rgba(255,102,0,.08)',
                border:`1px solid ${payMode === 'wave' ? 'rgba(27,154,245,.25)' : 'rgba(255,102,0,.25)'}`,
                borderRadius:8, textAlign:'center',
              }}>
                <div style={{ fontSize:14, fontWeight:800, color: payMode === 'wave' ? '#1B9AF5' : '#FF6600', marginBottom:6 }}>
                  {fmt(total)}
                </div>
                <button type="button"
                  onClick={() => {
                    toast.success(lang === 'fr'
                      ? `✅ ${payMode === 'wave' ? 'Wave' : 'Orange Money'} confirmé !`
                      : `✅ ${payMode === 'wave' ? 'Wave' : 'Orange Money'} confirmed!`)
                    confirmSale()
                  }}
                  style={{
                    background: payMode === 'wave' ? '#1B9AF5' : '#FF6600',
                    border:'none', borderRadius:7, padding:'7px 16px',
                    fontSize:12, fontWeight:700, color:'#fff',
                    cursor:'pointer', fontFamily:'var(--font)',
                  }}>
                  {lang === 'en' ? 'Confirm' : lang === 'es' ? 'Confirmar' : lang === 'it' ? 'Conferma' : 'Confirmer'}
                </button>
              </div>
            )}
          </div>

          {/* ── BOUTON ENCAISSER ── */}
          <div style={{ flexShrink:0, padding:'8px 10px', borderTop:'1px solid var(--border)' }}>
            <button type="button"
              disabled={cart.length === 0 || !canCheckout}
              onClick={() => {
                if (!cart.length) { toast.error(i('Panier vide !', 'Empty cart!', '¡Carrito vacío!', 'Carrello vuoto!')); return }
                if (payMode === 'credit' && !selectedCustomerId) { toast.error(i('Sélectionnez un client pour une vente à crédit', 'Select a customer for a credit sale', 'Selecciona un cliente para una venta a crédito', 'Seleziona un cliente per una vendita a credito')); return }
                if (payMode === 'credit' && partial && !canCheckout) { toast.error(i('Acompte invalide : doit être > 0 et < total', 'Invalid down payment: must be > 0 and < total', 'Anticipo no válido: debe ser > 0 y < total', 'Acconto non valido: deve essere > 0 e < totale')); return }
                setShowModal(true)
              }}
              style={{
                width:'100%', padding:'13px',
                background: (cart.length === 0 || !canCheckout) ? 'var(--bg4)' : 'linear-gradient(135deg,var(--p),var(--p2))',
                border:'none', borderRadius:11, fontSize:14, fontWeight:800,
                color: (cart.length === 0 || !canCheckout) ? 'var(--text3)' : '#fff',
                cursor: (cart.length === 0 || !canCheckout) ? 'not-allowed' : 'pointer',
                fontFamily:'var(--font)',
                boxShadow: (cart.length === 0 || !canCheckout) ? 'none' : '0 4px 16px rgba(91,78,232,.4)',
                transition:'all .2s',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
              {cart.length === 0
                ? <><ShoppingCart size={15} /> {i('Panier vide', 'Empty cart', 'Carrito vacío', 'Carrello vuoto')}</>
                : <>{i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} — {fmt(total)}</>}
            </button>
            {cashierSessionTx > 0 && (
              <div style={{
                display:'flex', justifyContent:'space-between',
                fontSize:10, color:'var(--text3)', marginTop:5, padding:'0 4px',
              }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><BarChart3 size={10} /> {cashierSessionTx} tx</span>
                <span style={{ color:'var(--acc)', fontFamily:'var(--mono)', fontWeight:600 }}>{fmt(cashierSessionCA)}</span>
              </div>
            )}
          </div>
          </div>
        </div>
  )
}
