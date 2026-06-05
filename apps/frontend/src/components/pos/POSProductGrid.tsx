import { Search, ShoppingCart, X, Camera, User, Factory, Package, Tag, CreditCard, ClipboardList, AlertTriangle, History, RotateCcw, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { t } from '@/stores/appStore'
import { salesApi } from '@/lib/api'
import { CATS, catLabel, payModeLabel, type PosProduct, type CartItem } from '@/components/pos/posShared'

interface POSProductGridProps {
  posTab: 'pos' | 'history'; setPosTab: (v: any) => void; fetchHistory: () => void
  lang: string
  activeCat: string; setActiveCat: (v: string) => void
  search: string; setSearch: (v: string) => void
  posEnableScanner: boolean; setShowScanner: (b: boolean) => void
  clientType: 'retail' | 'wholesale' | 'semi'; setClientType: (v: any) => void
  setShowDiscountModal: (b: boolean) => void
  discount: any; setDiscount: (v: any) => void
  fmt: (n: number) => string
  filtered: PosProduct[]
  cart: CartItem[]
  addItem: (p: any) => void
  getPrice: (p: any) => number
  posShowStockOnTile: boolean
  loadingHistory: boolean
  salesHistory: any[]
  canRefund: boolean
  onRefundClick: (sale: any) => void
  canCloseDay?: boolean; onCloseDay?: () => void
  isMobile: boolean; mobileView: string
  totalProducts: number; loadingProducts: boolean
  navigate: (path: string, opts?: any) => void
}

export default function POSProductGrid({ posTab, setPosTab, fetchHistory, lang, activeCat, setActiveCat, search, setSearch, posEnableScanner, setShowScanner, clientType, setClientType, setShowDiscountModal, discount, setDiscount, fmt, filtered, cart, addItem, getPrice, posShowStockOnTile, loadingHistory, salesHistory, canRefund, onRefundClick, canCloseDay, onCloseDay, isMobile, mobileView, totalProducts, loadingProducts, navigate }: POSProductGridProps) {
  return (
        <div style={{
          flex: 1,
          minWidth: 0,
          display: isMobile && mobileView === 'cart' ? 'none' : 'flex',
          flexDirection: 'column',
          padding: '12px 12px 12px 16px',
          gap: 10,
          overflow: 'hidden',
        }}>

          {/* Onglets Caisse / Historique */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12, padding: 5,
            flexShrink: 0,
          }}>
            {([
              { id:'pos',     label: lang === 'fr' ? 'Caisse'     : lang === 'en' ? 'Register'  : lang === 'es' ? 'Caja'      : 'Cassa'   },
              { id:'history', label: lang === 'fr' ? 'Historique' : lang === 'en' ? 'History'   : lang === 'es' ? 'Historial' : 'Storico' },
            ] as const).map(tab => (
              <button key={tab.id} type="button"
                onClick={() => { setPosTab(tab.id); if (tab.id === 'history') fetchHistory() }}
                style={{
                  flex:1, padding:'8px', borderRadius:8,
                  fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'var(--font)',
                  background: posTab === tab.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'transparent',
                  color: posTab === tab.id ? '#fff' : 'var(--text2)',
                  border:'none', transition:'all .15s',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}
              >
                {tab.id === 'pos' ? <ShoppingCart size={13} /> : <History size={13} />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtres catégories */}
          {posTab === 'pos' && (
            <div style={{
              flexShrink: 0,
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              flexWrap: 'nowrap',
              paddingBottom: 2,
            }}>
              {CATS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    transition: 'all .15s',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    background: activeCat === c.id
                      ? 'linear-gradient(135deg, var(--p), var(--p2))'
                      : 'var(--bg3)',
                    color: activeCat === c.id ? '#fff' : 'var(--text2)',
                    boxShadow: activeCat === c.id ? '0 4px 14px rgba(91,78,232,.35)' : 'none',
                  }}
                >{catLabel(c.id, lang)}</button>
              ))}
            </div>
          )}

          {/* Recherche + Scan */}
          {posTab === 'pos' && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10,
                  top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text3)', pointerEvents: 'none',
                }} />
                <input
                  className="input"
                  style={{ paddingLeft: 34, width: '100%', fontSize: 13, boxSizing: 'border-box' }}
                  aria-label="Rechercher" placeholder={t('pos_search')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {posEnableScanner && (
                <button
                  onClick={() => setShowScanner(true)}
                  title="Scanner un code-barres"
                  style={{
                    width: 40, height: 40, borderRadius: 10, fontSize: 18,
                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                ><Camera size={18} /></button>
              )}
            </div>
          )}

          {/* Barre type client + remise */}
          {posTab === 'pos' && <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {([
              { id:'retail',    label: lang === 'en' ? 'Retail'         : lang === 'es' ? 'Minorista'      : lang === 'it' ? 'Dettaglio'      : 'Détail'    },
              { id:'wholesale', label: lang === 'en' ? 'Wholesaler'     : lang === 'es' ? 'Mayorista'      : lang === 'it' ? 'Grossista'      : 'Grossiste' },
              { id:'semi',      label: lang === 'en' ? 'Semi-wholesale' : lang === 'es' ? 'Semi-mayorista' : lang === 'it' ? 'Semi-ingrosso' : 'Demi-gros' },
            ] as { id:'retail'|'wholesale'|'semi'; label:string }[]).map(ct => (
              <button key={ct.id} onClick={() => setClientType(ct.id)} style={{
                padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                background: clientType === ct.id ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                border:`1px solid ${clientType === ct.id ? 'var(--p2)' : 'var(--border)'}`,
                color: clientType === ct.id ? 'var(--p2)' : 'var(--text2)',
                display:'flex', alignItems:'center', gap:5,
              }}>
                {ct.id === 'retail' ? <User size={12} /> : ct.id === 'wholesale' ? <Factory size={12} /> : <Package size={12} />}
                {ct.label}
              </button>
            ))}
            <div style={{ width:1, height:20, background:'var(--border)', margin:'0 4px' }} />
            <button onClick={() => setShowDiscountModal(true)} style={{
              padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
              background: discount ? 'rgba(14,196,126,.15)' : 'var(--bg3)',
              border:`1px solid ${discount ? 'rgba(14,196,126,.3)' : 'var(--border)'}`,
              color: discount ? 'var(--acc2)' : 'var(--text2)',
              display:'flex', alignItems:'center', gap:6,
            }}>
              <Tag size={12} /> {discount
                ? `${lang === 'en' ? 'Discount' : lang === 'es' ? 'Descuento' : lang === 'it' ? 'Sconto' : 'Remise'}: ${discount.type === 'percent' ? discount.value + ' %' : fmt(discount.value)}`
                : (lang === 'en' ? 'Apply discount' : lang === 'es' ? 'Aplicar descuento' : lang === 'it' ? 'Applica sconto' : 'Appliquer une remise')}
            </button>
            {discount && (
              <button onClick={() => setDiscount(null)} style={{
                padding:'6px 8px', borderRadius:8, fontSize:11,
                background:'rgba(232,64,74,.1)', border:'1px solid rgba(232,64,74,.2)',
                color:'var(--danger)', cursor:'pointer', fontFamily:'var(--font)',
                display:'flex', alignItems:'center', gap:4,
              }}><X size={11} /> {lang === 'en' ? 'Clear discount' : lang === 'es' ? 'Quitar descuento' : lang === 'it' ? 'Rimuovi sconto' : 'Annuler remise'}</button>
            )}
            <div style={{ marginLeft:'auto', fontSize:11, color:'var(--acc)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              <Tag size={11} /> {filtered.filter(p => p.promotion).length} {lang === 'en' ? 'active promotions' : lang === 'es' ? 'promociones activas' : lang === 'it' ? 'promozioni attive' : 'promotions actives'}
            </div>
          </div>}

          {/* Grille produits — SCROLL ICI */}
          {posTab === 'pos' && <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingTop: 8,
          }}>
            <ResponsiveGrid min={160} gap={10} style={{ paddingBottom: 8 }}>
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
                    {/* Badge promo */}
                    {p.promotion && clientType === 'retail' && (
                      <div style={{
                        position:'absolute', top:6, left:6,
                        background:'var(--danger)', color:'#fff',
                        borderRadius:6, padding:'2px 6px',
                        fontSize:11, fontWeight:'var(--fw-bold)',
                      }}>PROMO</div>
                    )}
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
                        fontSize: 11, fontWeight: 'var(--fw-bold)',
                        border: '2px solid var(--bg)',
                      }}>×{inCart.qty}</div>
                    )}

                    {/* Emoji dans cercle */}
                    <div style={{
                      width: 56, height: 56,
                      borderRadius: '50%',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}>{p.emoji}</div>

                    {/* Nom */}
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                      lineHeight: 1.3,
                    }}>{p.name}</div>

                    {/* Prix */}
                    {clientType !== 'retail' && (
                      <div style={{ fontSize:11, color:'var(--text3)', textDecoration:'line-through', fontFamily:'var(--mono)' }}>
                        {fmt(p.price)}
                      </div>
                    )}
                    {p.promotion && clientType === 'retail' && (
                      <div style={{ fontSize:11, color:'var(--text3)', textDecoration:'line-through', fontFamily:'var(--mono)' }}>
                        {fmt(p.price)}
                      </div>
                    )}
                    <div style={{
                      fontSize: 14,
                      fontWeight: 'var(--fw-bold)',
                      color: p.promotion && clientType === 'retail' ? 'var(--danger)' : 'var(--acc)',
                      fontFamily: 'var(--mono)',
                    }}>{fmt(getPrice(p))}</div>

                    {/* Stock */}
                    {posShowStockOnTile && (
                      <div style={{
                        fontSize: 11,
                        color: isLowStock ? 'var(--danger)' : 'var(--text3)',
                        fontWeight: isLowStock ? 600 : 400,
                      }}>
                        {isLowStock && <AlertTriangle size={10} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />}Stock : {p.stock}
                      </div>
                    )}
                  </div>
                )
              })}

              {filtered.length === 0 && (
                totalProducts === 0 && !loadingProducts ? (
                  <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                    <div style={{ fontSize: 14, fontWeight: 'var(--fw-semibold)', color: 'var(--text2)', marginBottom: 6 }}>
                      {lang === 'fr' ? 'Aucun produit en stock' : lang === 'es' ? 'Sin productos en stock' : lang === 'it' ? 'Nessun prodotto in stock' : 'No products in stock'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, maxWidth: 280 }}>
                      {lang === 'fr' ? 'Ajoutez vos produits dans Stock pour commencer à vendre.' : lang === 'es' ? 'Agregue productos en Stock para comenzar a vender.' : lang === 'it' ? 'Aggiungi prodotti in Stock per iniziare a vendere.' : 'Add products in Stock to start selling.'}
                    </div>
                    <button type="button" onClick={() => navigate('/app/stock')} className="topbar-btn" style={{ fontSize: 13 }}>
                      {lang === 'fr' ? '+ Ajouter des produits' : lang === 'es' ? '+ Agregar productos' : lang === 'it' ? '+ Aggiungi prodotti' : '+ Add products'}
                    </button>
                  </div>
                ) : (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text3)', fontSize: 14 }}>
                    {t('pos_not_found')}
                  </div>
                )
              )}
            </ResponsiveGrid>
          </div>}

          {/* ── Onglet Historique ── */}
          {posTab === 'history' && (
            <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
              {/* Clôture journalière (Ticket Z) — MANAGER/ADMIN */}
              {canCloseDay && (
                <button type="button" onClick={onCloseDay}
                  style={{ width:'100%', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    background:'linear-gradient(135deg, var(--p), var(--p2))', border:'none', color:'#fff',
                    borderRadius:'var(--r-md)', padding:'12px', minHeight:44, fontSize:13, fontWeight:'var(--fw-semibold)',
                    fontFamily:'var(--font)', cursor:'pointer' }}>
                  <ClipboardList size={15} /> {lang === 'en' ? 'Close the day (Z ticket)' : lang === 'es' ? 'Cerrar el día (ticket Z)' : lang === 'it' ? 'Chiudi la giornata (ticket Z)' : 'Clôturer la journée (Ticket Z)'}
                </button>
              )}
              {loadingHistory ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
                  ⏳ {lang === 'en' ? 'Loading...' : lang === 'es' ? 'Cargando...' : lang === 'it' ? 'Caricamento...' : 'Chargement...'}
                </div>
              ) : salesHistory.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
                  <ClipboardList size={32} style={{ marginBottom:12, color:'var(--text3)' }} />
                  <div>{lang === 'fr' ? 'Aucune vente enregistrée' : lang === 'en' ? 'No sales recorded' : lang === 'es' ? 'Sin ventas registradas' : 'Nessuna vendita registrata'}</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'0 4px' }}>
                  {salesHistory.slice(0, 50).map((sale: any, i: number) => {
                    const date = new Date(sale.createdAt)
                    const timeAgo = Math.round((Date.now() - date.getTime()) / 60000)
                    const timeLabel = timeAgo < 60 ? `${timeAgo} min` : `${Math.round(timeAgo / 60)}h`
                    const refunded = sale.status === 'refunded'
                    return (
                      <div key={sale.id ?? i} style={{
                        background:'var(--bg3)', border:`1px solid ${refunded ? 'var(--c-red-border)' : 'var(--border)'}`, borderRadius:12, padding:'12px 14px',
                        opacity: refunded ? .82 : 1,
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text)', marginBottom:2, display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                              <CreditCard size={13} /> {lang === 'fr' ? 'Vente' : lang === 'en' ? 'Sale' : lang === 'es' ? 'Venta' : 'Vendita'} #{String(sale.id).slice(-6).toUpperCase()}
                              {refunded && (
                                <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.4px', borderRadius:'var(--r-full)', padding:'2px 7px', background:'var(--c-red-bg)', color:'var(--danger)', border:'1px solid var(--c-red-border)' }}>
                                  <RotateCcw size={10} /> {lang === 'en' ? 'Refunded' : lang === 'es' ? 'Reembolsada' : lang === 'it' ? 'Rimborsata' : 'Remboursé'}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize:11, color:'var(--text3)' }}>
                              {date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'it-IT')}
                              {' · '}{date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                              {' · '}{timeLabel}
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:15, fontWeight:900, color: refunded ? 'var(--text4)' : 'var(--p2)', fontFamily:'var(--mono)', textDecoration: refunded ? 'line-through' : 'none' }}>{fmt(sale.total)}</div>
                            <span style={{
                              fontSize:11, fontWeight:'var(--fw-semibold)', borderRadius:20, padding:'2px 8px',
                              background: sale.paymentMode === 'cash' ? 'rgba(14,196,126,.12)' : sale.paymentMode === 'card' ? 'rgba(91,78,232,.12)' : 'rgba(240,165,0,.12)',
                              color: sale.paymentMode === 'cash' ? 'var(--acc2)' : sale.paymentMode === 'card' ? 'var(--p2)' : 'var(--acc)',
                            }}>
                              {payModeLabel(sale.paymentMode, lang)}
                            </span>
                          </div>
                        </div>
                        {sale.items?.slice(0, 3).map((item: any, j: number) => (
                          <div key={j} style={{
                            fontSize:11, color:'var(--text2)',
                            display:'flex', justifyContent:'space-between',
                            padding: j === 0 ? '8px 0 3px' : '3px 0',
                            borderTop: j === 0 ? '1px solid var(--border)' : 'none',
                            marginTop: j === 0 ? 6 : 0,
                          }}>
                            <span>×{item.qty} {item.product?.name ?? 'Produit'}</span>
                            <span style={{ fontFamily:'var(--mono)' }}>{fmt(item.total ?? item.qty * item.unitPrice)}</span>
                          </div>
                        ))}
                        {sale.items?.length > 3 && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                            +{sale.items.length - 3} {lang === 'en' ? 'more items' : lang === 'es' ? 'otros artículos' : lang === 'it' ? 'altri articoli' : 'autres articles'}
                          </div>
                        )}
                        {/* Facture PDF — tous rôles, ouvre le PDF serveur dans un nouvel onglet */}
                        <button type="button"
                          onClick={() => salesApi.openInvoice(sale.id).catch(() => toast.error(lang === 'en' ? 'Invoice error' : lang === 'es' ? 'Error de factura' : lang === 'it' ? 'Errore fattura' : 'Erreur facture'))}
                          style={{ marginTop:10, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                            background:'transparent', border:'1px solid var(--border)', color:'var(--text2)',
                            borderRadius:'var(--r-md)', padding:'7px 12px', fontSize:12, fontWeight:'var(--fw-semibold)',
                            fontFamily:'var(--font)', cursor:'pointer' }}>
                          <FileText size={13} /> {lang === 'en' ? 'PDF Invoice' : lang === 'es' ? 'Factura PDF' : lang === 'it' ? 'Fattura PDF' : 'Facture PDF'}
                        </button>
                        {/* Action remboursement — manager/admin uniquement, ventes non remboursées */}
                        {canRefund && !refunded && (
                          <button type="button" onClick={() => onRefundClick(sale)}
                            style={{ marginTop:8, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                              background:'transparent', border:'1px solid var(--c-red-border)', color:'var(--danger)',
                              borderRadius:'var(--r-md)', padding:'7px 12px', fontSize:12, fontWeight:'var(--fw-semibold)',
                              fontFamily:'var(--font)', cursor:'pointer' }}>
                            <RotateCcw size={13} /> {lang === 'en' ? 'Refund' : lang === 'es' ? 'Reembolsar' : lang === 'it' ? 'Rimborsa' : 'Rembourser'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
  )
}
