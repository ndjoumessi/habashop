import { Trash2, ShoppingCart, Lock, Tag, Banknote, CreditCard, Smartphone, BarChart3, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirm } from '@/lib/confirm'
import { type CartItem } from '@/components/pos/posShared'
import POSCustomerSelector, { type LinkedCustomer } from '@/components/pos/POSCustomerSelector'

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
  // Paiement mixte (split)
  mixedOn: boolean; setMixedOn: (b: boolean) => void
  mixedM1: 'cash'|'mobile'|'card'; setMixedM1: (m: 'cash'|'mobile'|'card') => void
  mixedM2: 'cash'|'mobile'|'card'; setMixedM2: (m: 'cash'|'mobile'|'card') => void
  mixedAmt1: string; setMixedAmt1: (v: string) => void
  mixedAmt2XOF: number; mixedValid: boolean
  // Fidélité v2 : remise auto du client lié
  loyaltyDiscount?: number; loyaltyPct?: number; loyaltyCustomerName?: string | null
  // Sélecteur client inline (recherche + scan QR carte fidélité)
  linkedCustomer?: LinkedCustomer | null; setLinkedCustomer?: (c: LinkedCustomer | null) => void
  enableLoyalty?: boolean; loyaltyTier?: string
  // PayDunya (Wave / Orange Money Sénégal & UEMOA) : si configuré, Wave/OM passent par PayDunya.
  paydunyaOk?: boolean; onPaydunyaStart?: () => void
  // Stock dispo par produit — désactive le + quand qty = max (anti-survente UI)
  getStock?: (id: number | string) => number
}

export default function POSCart({ lang, cart, setCart, cashierSessionTx, cashierSessionCA, setShowCloseModal, fmt, discount, discountAmount, totalHT, tva, posTaxRate, total, PAY_MODES, payMode, setPayMode, currencySymbol, cashGiven, setCashGiven, monnaie, confirmSale, setShowModal, updateQty, isMobile, mobileView, mixedOn, setMixedOn, mixedM1, setMixedM1, mixedM2, setMixedM2, mixedAmt1, setMixedAmt1, mixedAmt2XOF, mixedValid, loyaltyDiscount = 0, loyaltyPct = 0, loyaltyCustomerName = null, linkedCustomer = null, setLinkedCustomer, enableLoyalty = false, loyaltyTier = '', paydunyaOk = false, onPaydunyaStart, getStock }: POSCartProps) {
  // PayDunya actif pour Wave / Orange Money quand le backend est configuré → bouton unique dédié.
  const isPaydunyaMode = paydunyaOk && !mixedOn && (payMode === 'wave' || payMode === 'orange')
  // Montant reçu : jamais négatif. Vide → '' (traité comme 0 en aval). Négatif (collé/contournement) → 0.
  const onCashChange = (raw: string) => {
    if (raw === '') { setCashGiven(''); return }
    const n = parseFloat(raw)
    setCashGiven(!Number.isFinite(n) || n < 0 ? '0' : raw)
  }
  // États du champ cash : a-t-on une saisie ? est-elle suffisante (monnaie = reçu − total ≥ 0) ?
  const cashEntered      = payMode === 'cash' && !mixedOn && cashGiven.trim() !== '' && (parseFloat(cashGiven) || 0) > 0
  const cashSufficient   = cashEntered && monnaie >= 0
  const cashInsufficient = cashEntered && monnaie < 0
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
            <span style={{ fontSize: 14, fontWeight: 'var(--fw-bold)', color: 'var(--text)', flex: 1, minWidth: 0 }}>
              {lang === 'fr' ? 'Panier' : lang === 'en' ? 'Cart' : lang === 'es' ? 'Carrito' : 'Carrello'}
            </span>
            {cashierSessionTx > 0 && (
              <span style={{
                background: 'rgba(0,208,132,.15)',
                border: '1px solid var(--c-green-border)',
                color: 'var(--acc2)', borderRadius: 20,
                padding: '3px 10px', fontSize: 11,
                fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)',
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
                aria-label={lang === 'en' ? 'Clear cart' : lang === 'es' ? 'Vaciar el carrito' : lang === 'it' ? 'Svuota il carrello' : 'Vider le panier'}
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
              fontFamily: 'var(--font)', fontWeight: 'var(--fw-semibold)', flexShrink: 0,
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
                <div style={{ fontSize:13, fontWeight:'var(--fw-regular)', textAlign:'center', color:'var(--text2)' }}>
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
                    display:'flex', alignItems:'center', gap:8, padding:'12px 10px',
                    borderBottom: idx < cart.length - 1 ? '1px solid color-mix(in srgb, var(--border) 55%, transparent)' : 'none',
                    borderRadius:10, transition:'background .1s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(91,78,232,.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width:32, height:32, borderRadius:9,
                      background:'color-mix(in srgb, var(--p) 10%, transparent)',
                      border:'1px solid color-mix(in srgb, var(--p) 16%, transparent)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:16, flexShrink:0,
                    }}>{item.emoji ?? '📦'}</div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--text)', lineHeight:1.3,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      }}>{item.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:1, fontFamily:'var(--mono)' }}>
                        {fmt(item.price)} / unité
                      </div>
                      {item.tierLabel && (
                        <span style={{
                          display: 'inline-block',
                          background: 'rgba(0,184,255,.12)',
                          color: 'var(--acc3)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 'var(--fw-semibold)',
                          marginTop: 3,
                          letterSpacing: '.2px',
                        }}>📊 {item.tierLabel}</span>
                      )}
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                      <button type="button"
                        onClick={() => updateQty(item.id, -1)}
                        aria-label={item.qty === 1
                          ? (lang === 'en' ? `Remove ${item.name}` : lang === 'es' ? `Quitar ${item.name}` : lang === 'it' ? `Rimuovi ${item.name}` : `Retirer ${item.name}`)
                          : (lang === 'en' ? 'Decrease quantity' : lang === 'es' ? 'Disminuir cantidad' : lang === 'it' ? 'Riduci quantità' : 'Diminuer la quantité')}
                        style={{
                          width:32, height:32, borderRadius:8,
                          background: item.qty === 1 ? 'var(--c-red-bg)' : 'var(--bg3)',
                          border:`1px solid ${item.qty === 1 ? 'var(--c-red-border)' : 'var(--border)'}`,
                          cursor:'pointer', fontSize:14,
                          color: item.qty === 1 ? 'var(--danger)' : 'var(--text2)',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
                        }}>
                        {item.qty === 1 ? '×' : '−'}
                      </button>
                      <span style={{
                        fontSize:14, fontWeight:'var(--fw-bold)', color:'var(--text)',
                        fontFamily:'var(--mono)', minWidth:22, textAlign:'center', lineHeight:1,
                      }}>{item.qty}</span>
                      {(() => {
                        const stock = getStock ? getStock(item.id) : 0
                        const atMax = stock > 0 && item.qty >= stock
                        return (
                          <button type="button"
                            onClick={() => { if (!atMax) updateQty(item.id, +1) }}
                            disabled={atMax}
                            aria-label={lang === 'en' ? 'Increase quantity' : lang === 'es' ? 'Aumentar cantidad' : lang === 'it' ? 'Aumenta quantità' : 'Augmenter la quantité'}
                            style={{
                              width:32, height:32, borderRadius:8,
                              background:'var(--bg3)', border:'1px solid var(--border)',
                              cursor: atMax ? 'not-allowed' : 'pointer', fontSize:15,
                              color: atMax ? 'var(--text3)' : 'var(--p2)',
                              fontWeight:'var(--fw-bold)', opacity: atMax ? 0.4 : 1,
                              display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
                            }}>+</button>
                        )
                      })()}
                    </div>

                    <div style={{
                      fontSize:13, fontWeight:'var(--fw-bold)', color:'var(--p2)',
                      fontFamily:'var(--mono)', minWidth:56, textAlign:'right', flexShrink:0,
                    }}>{fmt(item.price * item.qty)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SÉLECTEUR CLIENT (recherche + scan QR carte fidélité) ── */}
          {setLinkedCustomer && (
            <POSCustomerSelector
              lang={lang}
              linkedCustomer={linkedCustomer}
              setLinkedCustomer={setLinkedCustomer}
              enableLoyalty={enableLoyalty}
              loyaltyPct={loyaltyPct}
              loyaltyTier={loyaltyTier}
            />
          )}

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
                  <span style={{ fontSize:11, color:'var(--acc2)', fontWeight:'var(--fw-regular)', display:'flex', alignItems:'center', gap:4 }}>
                    <Tag size={11} /> {lang === 'en' ? 'Discount' : lang === 'es' ? 'Descuento' : lang === 'it' ? 'Sconto' : 'Remise'}{discount.type === 'percent' ? ` ${discount.value}%` : ''}
                  </span>
                  <span style={{ fontSize:11, fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                    − {fmt(discountAmount)}
                  </span>
                </div>
              )}
              <div style={{
                display:'flex', justifyContent:'space-between',
                fontSize:11, color:'var(--text3)', marginBottom:6, padding:'0 2px',
              }}>
                <span>HT : <span style={{ fontFamily:'var(--mono)' }}>{fmt(Math.round(totalHT))}</span></span>
                <span>TVA {posTaxRate}% : <span style={{ fontFamily:'var(--mono)' }}>{fmt(Math.round(tva))}</span></span>
              </div>
              {/* Fidélité v2 : badge remise auto du client lié (−X%) */}
              {loyaltyDiscount > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, padding:'6px 10px', background:'var(--c-green-bg)', border:'1px solid var(--c-green-border)', borderRadius:8, fontSize:12 }}>
                  <span style={{ color:'var(--acc2)', fontWeight:'var(--fw-semibold)', display:'flex', alignItems:'center', gap:5 }}>
                    ⭐ {lang === 'en' ? 'Loyalty discount' : lang === 'es' ? 'Descuento fidelidad' : lang === 'it' ? 'Sconto fedeltà' : 'Remise fidélité'}{loyaltyCustomerName ? ` · ${loyaltyCustomerName}` : ''} −{loyaltyPct}%
                  </span>
                  <span style={{ fontFamily:'var(--mono)', fontWeight:'var(--fw-bold)', color:'var(--acc2)' }}>− {fmt(loyaltyDiscount)}</span>
                </div>
              )}
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'10px 12px',
                background:'var(--bg2)', border:'1px solid var(--border)',
                borderRadius:8,
              }}>
                <span style={{ fontSize:11, fontWeight:'var(--fw-bold)', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px' }}>TOTAL TTC</span>
                <span style={{ fontSize:24, fontWeight:'var(--fw-regular)', color:'var(--p2)', fontFamily:'var(--mono)', letterSpacing:'-.5px' }}>{fmt(total)}</span>
              </div>
            </div>
          )}

          {/* ── MODES PAIEMENT — 5 colonnes ── */}
          <div style={{ flexShrink: 0, padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginBottom: 6 }}>
              {PAY_MODES.map(mode => (
                <button key={mode.id} type="button" onClick={() => setPayMode(mode.id)}
                  aria-pressed={payMode === mode.id}
                  style={{
                    padding: '7px 2px', borderRadius: 8, fontSize: 11, fontWeight: 'var(--fw-semibold)',
                    cursor: 'pointer', fontFamily: 'var(--font)',
                    background: payMode === mode.id ? 'var(--p)' : 'var(--bg3)',
                    border: `1.5px solid ${payMode === mode.id ? 'var(--p)' : 'var(--border)'}`,
                    color: payMode === mode.id ? '#fff' : 'var(--text2)',
                    boxShadow: payMode === mode.id ? 'var(--sh-xs)' : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'all .12s',
                  }}>
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', height:16 }}>
                    {mode.id === 'cash'   ? <Banknote size={14} />   :
                     mode.id === 'card'   ? <CreditCard size={14} /> :
                     mode.id === 'wave'   ? <span style={{ fontWeight:'var(--fw-semibold)', fontSize:11, lineHeight:1 }}>W</span>   :
                     mode.id === 'orange' ? <span style={{ fontWeight:'var(--fw-semibold)', fontSize:11, lineHeight:1 }}>OM</span>  :
                     mode.id === 'mtn'    ? <span style={{ fontWeight:'var(--fw-semibold)', fontSize:11, lineHeight:1 }}>M</span>   :
                                            <Smartphone size={14} />}
                  </span>
                  {mode.label}
                </button>
              ))}
            </div>

            {/* ── Toggle Paiement mixte (split, 2 méthodes) ── */}
            <button type="button" role="switch" aria-checked={mixedOn} onClick={() => setMixedOn(!mixedOn)}
              style={{ width:'100%', marginTop:6, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                padding:'8px 10px', background: mixedOn ? 'rgba(91,78,232,.08)' : 'var(--bg3)',
                border:`1.5px solid ${mixedOn ? 'var(--p2)' : 'var(--border)'}`, borderRadius:8, cursor:'pointer', fontFamily:'var(--font)' }}>
              <span style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color: mixedOn ? 'var(--p2)' : 'var(--text2)' }}>
                {lang==='en'?'Split payment':lang==='es'?'Pago mixto':lang==='it'?'Pagamento misto':'Paiement mixte'}
              </span>
              <span style={{ position:'relative', display:'block', width:38, height:22, borderRadius:99, flexShrink:0, boxSizing:'border-box', background: mixedOn ? 'var(--p)' : 'var(--bg5)', border:'1px solid var(--border)', transition:'background .2s' }}>
                <span style={{ position:'absolute', top:2, width:16, height:16, left: mixedOn ? 18 : 2, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }} />
              </span>
            </button>

            {/* Paiement mixte ON → 2 lignes (montant reçu/monnaie masqués) */}
            {mixedOn && (
              <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <MethodPicker value={mixedM1} lang={lang} onChange={m => { setMixedM1(m); if (m === mixedM2) setMixedM2((['cash','mobile','card'] as const).find(x => x !== m)!) }} />
                  <input type="number" inputMode="decimal" min={0} value={mixedAmt1} onChange={e => setMixedAmt1(e.target.value)}
                    placeholder="0" aria-label={lang==='en'?'Amount 1':lang==='es'?'Importe 1':lang==='it'?'Importo 1':'Montant 1'}
                    style={{ flex:1, minWidth:0, height:36, padding:'0 8px', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13, fontFamily:'var(--mono)', textAlign:'right', boxSizing:'border-box' }} />
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <MethodPicker value={mixedM2} exclude={mixedM1} lang={lang} onChange={setMixedM2} />
                  <div style={{ flex:1, minWidth:0, height:36, padding:'0 8px', display:'flex', alignItems:'center', justifyContent:'flex-end', background:'var(--bg3)', border:'1px dashed var(--border)', borderRadius:8, color:'var(--text2)', fontSize:13, fontFamily:'var(--mono)' }}>
                    {fmt(mixedAmt2XOF)}
                  </div>
                </div>
                {!mixedValid && (
                  <div style={{ fontSize:11, color:'var(--danger)', fontWeight:'var(--fw-regular)' }}>
                    {lang==='en'?'Amount 1 must be between 0 and the total':lang==='es'?'El monto 1 debe estar entre 0 y el total':lang==='it'?"L'importo 1 deve essere tra 0 e il totale":'Le montant 1 doit être entre 0 et le total'}
                  </div>
                )}
              </div>
            )}

            {!mixedOn && payMode === 'cash' && (
              <div style={{ marginTop:8 }}>
                {/* Label explicite */}
                <label htmlFor="pos-cash-given" style={{
                  display:'block', marginBottom:5, fontSize:11, fontWeight:'var(--fw-semibold)',
                  color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.4px',
                }}>
                  {lang === 'en' ? 'Amount received from customer' : lang === 'es' ? 'Importe recibido del cliente' : lang === 'it' ? 'Importo ricevuto dal cliente' : 'Montant reçu du client'}
                </label>
                <div style={{ position:'relative' }}>
                  <input id="pos-cash-given" className="input" type="number" min={0} step="any" inputMode="decimal"
                    placeholder={lang === 'en' ? 'Amount received...' : lang === 'es' ? 'Importe recibido...' : lang === 'it' ? 'Importo ricevuto...' : 'Montant reçu...'}
                    value={cashGiven}
                    onKeyDown={e => { if (e.key === '-') e.preventDefault() }}
                    onChange={e => onCashChange(e.target.value)}
                    style={{
                      textAlign:'right', paddingRight:50, fontSize:13,
                      borderColor: cashInsufficient ? 'var(--danger)' : cashSufficient ? 'var(--acc2)' : undefined,
                      boxShadow: cashInsufficient ? '0 0 0 1px var(--danger)' : cashSufficient ? '0 0 0 1px var(--acc2)' : undefined,
                      transition:'border-color .2s ease, box-shadow .2s ease',
                    }}
                  />
                  <span style={{
                    position:'absolute', right:12, top:'50%',
                    transform:'translateY(-50%)',
                    fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text3)',
                    pointerEvents:'none',
                  }}>{currencySymbol}</span>
                </div>

                {/* Montant insuffisant → message rouge */}
                {cashInsufficient && (
                  <div role="status" style={{
                    marginTop:6, display:'flex', alignItems:'center', gap:5,
                    fontSize:12, fontWeight:'var(--fw-regular)', color:'var(--danger)', transition:'opacity .2s ease',
                  }}>
                    <AlertCircle size={13} style={{ flexShrink:0 }} />
                    {lang === 'en' ? 'Insufficient amount' : lang === 'es' ? 'Importe insuficiente' : lang === 'it' ? 'Importo insufficiente' : 'Montant insuffisant'}
                  </div>
                )}

                {/* Montant suffisant → monnaie à rendre, fond vert visible */}
                {cashSufficient && (
                  <div style={{
                    marginTop:6, display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 12px', background:'var(--c-green-bg)', border:'1px solid var(--c-green-border)',
                    borderRadius:10, transition:'all .2s ease',
                  }}>
                    <span style={{ color:'var(--text2)', fontWeight:'var(--fw-regular)', fontSize:13 }}>
                      {lang === 'en' ? 'Change to return' : lang === 'es' ? 'Cambio a devolver' : lang === 'it' ? 'Resto da dare' : 'Monnaie à rendre'}
                    </span>
                    <span style={{ fontWeight:'var(--fw-semibold)', fontFamily:'var(--mono)', fontSize:18, color:'var(--acc2)' }}>
                      {fmt(monnaie)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!mixedOn && payMode === 'wave' && !isPaydunyaMode && cart.length > 0 && (
              <div style={{
                marginTop:6, padding:'8px 10px',
                background: payMode === 'wave' ? 'rgba(27,154,245,.08)' : 'rgba(255,102,0,.08)',
                border:`1px solid ${payMode === 'wave' ? 'rgba(27,154,245,.25)' : 'rgba(255,102,0,.25)'}`,
                borderRadius:8, textAlign:'center',
              }}>
                <div style={{ fontSize:14, fontWeight:'var(--fw-bold)', color: payMode === 'wave' ? '#1B9AF5' : '#FF6600', marginBottom:6 }}>
                  {fmt(total)}
                </div>
                <button type="button"
                  onClick={() => {
                    toast.success(lang === 'fr'
                      ? `${payMode === 'wave' ? 'Wave' : 'Orange Money'} confirmé !`
                      : `${payMode === 'wave' ? 'Wave' : 'Orange Money'} confirmed!`)
                    confirmSale()
                  }}
                  style={{
                    background: payMode === 'wave' ? '#1B9AF5' : '#FF6600',
                    border:'none', borderRadius:7, padding:'7px 16px',
                    fontSize:12, fontWeight:'var(--fw-semibold)', color:'#fff',
                    cursor:'pointer', fontFamily:'var(--font)',
                  }}>
                  {lang === 'en' ? 'Confirm' : lang === 'es' ? 'Confirmar' : lang === 'it' ? 'Conferma' : 'Confirmer'}
                </button>
              </div>
            )}
          </div>

          {/* ── BOUTON PRINCIPAL : PayDunya (Wave/OM) OU Encaisser — jamais les deux ── */}
          <div style={{ flexShrink:0, padding:'10px 10px 0', borderTop:'1px solid var(--border)' }}>
            {isPaydunyaMode ? (
              <button type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  if (!cart.length) return toast.error(lang === 'en' ? 'Empty cart!' : lang === 'es' ? '¡Carrito vacío!' : lang === 'it' ? 'Carrello vuoto!' : 'Panier vide !')
                  onPaydunyaStart?.()
                }}
                style={{
                  width:'100%', minHeight:52, padding:'13px',
                  background: cart.length === 0 ? 'var(--bg4)' : (payMode === 'wave' ? '#1B9AF5' : '#FF6600'),
                  border:'none', borderRadius:10, fontSize:15, fontWeight:'var(--fw-bold)',
                  color: cart.length === 0 ? 'var(--text3)' : '#fff',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  fontFamily:'var(--font)', boxShadow: cart.length === 0 ? 'none' : 'var(--sh-md)',
                  transition:'all .2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                }}>
                {cart.length === 0
                  ? <><ShoppingCart size={15} /> {lang === 'en' ? 'Empty cart' : lang === 'es' ? 'Carrito vacío' : lang === 'it' ? 'Carrello vuoto' : 'Panier vide'}</>
                  : <>{lang === 'fr' ? 'Confirmer' : lang === 'en' ? 'Confirm' : lang === 'es' ? 'Confirmar' : 'Conferma'} — {fmt(total)}</>}
              </button>
            ) : (
            <button type="button"
              disabled={cart.length === 0 || (mixedOn && !mixedValid)}
              onClick={() => {
                if (!cart.length) return toast.error(lang === 'en' ? 'Empty cart!' : lang === 'es' ? '¡Carrito vacío!' : lang === 'it' ? 'Carrello vuoto!' : 'Panier vide !')
                if (mixedOn && !mixedValid) return toast.error(lang==='en'?'Split amounts must sum to the total':lang==='es'?'La suma de los pagos debe igualar el total':lang==='it'?'La somma dei pagamenti deve uguagliare il totale':'La somme des paiements doit égaler le total')
                setShowModal(true)
              }}
              style={{
                width:'100%', minHeight:52, padding:'13px',
                background: (cart.length === 0 || (mixedOn && !mixedValid)) ? 'var(--bg4)' : 'linear-gradient(135deg,var(--p),var(--p2))',
                border:'none', borderRadius:10, fontSize:15, fontWeight:'var(--fw-bold)',
                color: (cart.length === 0 || (mixedOn && !mixedValid)) ? 'var(--text3)' : '#fff',
                cursor: (cart.length === 0 || (mixedOn && !mixedValid)) ? 'not-allowed' : 'pointer',
                fontFamily:'var(--font)',
                boxShadow: (cart.length === 0 || (mixedOn && !mixedValid)) ? 'none' : 'var(--sh-md)',
                transition:'all .2s',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
              {cart.length === 0
                ? <><ShoppingCart size={15} /> {lang === 'en' ? 'Empty cart' : lang === 'es' ? 'Carrito vacío' : lang === 'it' ? 'Carrello vuoto' : 'Panier vide'}</>
                : <>{lang === 'fr' ? 'Encaisser' : lang === 'en' ? 'Checkout' : lang === 'es' ? 'Cobrar' : 'Incassare'} — {fmt(total)}</>}
            </button>
            )}
            {cashierSessionTx > 0 && (
              <div style={{
                display:'flex', justifyContent:'space-between',
                fontSize:11, color:'var(--text3)',
                borderTop:'0.5px solid var(--border)',
                marginTop:8, padding:'8px 4px',
              }}>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}><BarChart3 size={10} /> {cashierSessionTx} tx</span>
                <span style={{ color:'var(--acc)', fontFamily:'var(--mono)', fontWeight:'var(--fw-regular)' }}>{fmt(cashierSessionCA)}</span>
              </div>
            )}
          </div>
          </div>
        </div>
  )
}

// Sélecteur de méthode de paiement (paiement mixte).
function methodLabel(m: 'cash'|'mobile'|'card', lang: string): string {
  if (m === 'cash') return lang === 'en' ? 'Cash' : lang === 'es' ? 'Efectivo' : lang === 'it' ? 'Contanti' : 'Espèces'
  if (m === 'card') return lang === 'en' ? 'Card' : lang === 'es' ? 'Tarjeta' : lang === 'it' ? 'Carta' : 'Carte'
  return 'Mobile'
}
function MethodPicker({ value, onChange, exclude, lang }: {
  value: 'cash'|'mobile'|'card'; onChange: (m: 'cash'|'mobile'|'card') => void
  exclude?: 'cash'|'mobile'|'card'; lang: string
}) {
  const methods = (['cash', 'mobile', 'card'] as const).filter(m => m !== exclude)
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {methods.map(m => (
        <button key={m} type="button" onClick={() => onChange(m)}
          style={{ padding: '0 7px', height: 36, borderRadius: 7, fontSize: 11, fontWeight: 'var(--fw-regular)', cursor: 'pointer', fontFamily: 'var(--font)',
            background: value === m ? 'var(--p)' : 'var(--bg4)', color: value === m ? '#fff' : 'var(--text2)',
            border: `1px solid ${value === m ? 'var(--p)' : 'var(--border)'}` }}>
          {methodLabel(m, lang)}
        </button>
      ))}
    </div>
  )
}
