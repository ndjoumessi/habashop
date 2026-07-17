import { Trash2, ShoppingCart, Tag, ArrowRight } from 'lucide-react'
import { confirm } from '@/lib/confirm'
import { type CartItem } from '@/components/pos/posShared'
import POSCustomerSelector, { type LinkedCustomer } from '@/components/pos/POSCustomerSelector'

/**
 * Panier POS — fidèle à la maquette 01-pos-principal.view.html (item 11) :
 * « Panier · N » + Vider → puce client → lignes (nom / prix × qté / steppers)
 * → remise (action secondaire) → totaux (Sous-total → remises → HT/TVA discrets
 * → Total héros or) → CTA « Encaisser → ».
 * Les MODES DE PAIEMENT vivent dans la feuille d'encaissement (POSModals),
 * plus dans le panier.
 */
interface POSCartProps {
  lang: string
  cart: CartItem[]; setCart: (v: any) => void
  fmt: (n: number) => string
  discount: any; discountAmount: number
  setShowDiscountModal?: (b: boolean) => void; setDiscount?: (v: any) => void
  totalHT: number; tva: number; posTaxRate: number; total: number
  setShowModal: (b: boolean) => void
  updateQty: (id: any, delta: number) => void
  isMobile: boolean; mobileView: string
  // Fidélité v2 : remise auto du client lié
  loyaltyDiscount?: number; loyaltyPct?: number; loyaltyCustomerName?: string | null
  linkedCustomer?: LinkedCustomer | null; setLinkedCustomer?: (c: LinkedCustomer | null) => void
  enableLoyalty?: boolean; loyaltyTier?: string; loyaltyPoints?: number | null
  // Stock dispo par produit — désactive le + quand qty = max (anti-survente UI)
  getStock?: (id: number | string) => number
}

export default function POSCart({ lang, cart, setCart, fmt, discount, discountAmount, setShowDiscountModal, setDiscount, totalHT, tva, posTaxRate, total, setShowModal, updateQty, isMobile, mobileView, loyaltyDiscount = 0, loyaltyPct = 0, loyaltyCustomerName = null, linkedCustomer = null, setLinkedCustomer, enableLoyalty = false, loyaltyTier = '', loyaltyPoints = null, getStock }: POSCartProps) {
  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  // Cibles tactiles ≥ 44px en usage réel (spec) ; densité maquette (24px) au desktop souris.
  const tapSize = isMobile ? 44 : 26

  return (
    <div style={{
      // Colonne pilotée par la grid du parent (~1fr min 270px). Pas de carte englobante
      // (maquette : contenu directement sur le fond, séparé par la bordure du catalogue).
      width: '100%', minWidth: 0,
      display: isMobile && mobileView === 'products' ? 'none' : 'flex',
      flexDirection: 'column',
      padding: '14px 16px',
      overflow: isMobile ? 'auto' : 'hidden',
    }}>

      {/* ── « Panier · N » + Vider ── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        {/* 2 nœuds texte séparés : l'E2E matche ^Panier$|^Cart$ sur le 1er */}
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
            {lang === 'fr' ? 'Panier' : lang === 'en' ? 'Cart' : lang === 'es' ? 'Carrito' : 'Carrello'}
          </span>
          {cart.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>· {cart.length}</span>
          )}
        </span>
        {cart.length > 0 && (
          <button type="button"
            onClick={async () => { if (await confirm({ title: lang === 'en' ? 'Clear cart' : lang === 'es' ? 'Vaciar el carrito' : lang === 'it' ? 'Svuota il carrello' : 'Vider le panier', message: lang === 'en' ? 'All items will be removed from the cart.' : lang === 'es' ? 'Se eliminarán todos los artículos del carrito.' : lang === 'it' ? 'Tutti gli articoli del carrello saranno rimossi.' : 'Tous les articles du panier seront retirés.', danger: true })) setCart([]) }}
            aria-label={lang === 'en' ? 'Clear cart' : lang === 'es' ? 'Vaciar el carrito' : lang === 'it' ? 'Svuota il carrello' : 'Vider le panier'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: 'transparent', border: 'none', padding: '4px 2px',
              minHeight: isMobile ? 44 : undefined,
              cursor: 'pointer', fontFamily: 'var(--font)',
              fontSize: 12, color: 'var(--text3)', transition: 'color .15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--danger)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text3)')}
          ><Trash2 size={13} /> {lang === 'en' ? 'Clear' : lang === 'es' ? 'Vaciar' : lang === 'it' ? 'Svuota' : 'Vider'}</button>
        )}
      </div>

      {/* ── Puce client fidélité (au-dessus des lignes, comme la maquette) ── */}
      {setLinkedCustomer && (
        <POSCustomerSelector
          lang={lang}
          linkedCustomer={linkedCustomer}
          setLinkedCustomer={setLinkedCustomer}
          enableLoyalty={enableLoyalty}
          loyaltyPct={loyaltyPct}
          loyaltyTier={loyaltyTier}
          loyaltyPoints={loyaltyPoints}
        />
      )}

      {/* ── Lignes du panier ── */}
      <div style={{
        flexGrow: 1, flexShrink: 1, flexBasis: 'auto',
        // Mobile : la FEUILLE scrolle (overflow interdit ici — un overflow-x:hidden
        // recalculerait overflow-y en auto → liste écrasée à 0). Desktop : liste scrollable.
        ...(isMobile ? {} : { flexBasis: '0px', overflowY: 'auto' as const, overflowX: 'hidden' as const, minHeight: 0 }),
      }}>
        {cart.length === 0 ? (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', height:'100%', minHeight: 140, color:'var(--text3)',
            gap:10, padding:20,
          }}>
            <div style={{
              width:56, height:56, borderRadius:'50%',
              border:'2px dashed var(--border)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}><ShoppingCart size={24} style={{ color:'var(--text3)' }} /></div>
            <div style={{ fontSize:13, textAlign:'center', color:'var(--text2)' }}>
              {lang === 'fr' ? 'Panier vide' : lang === 'en' ? 'Empty cart' : lang === 'es' ? 'Carrito vacío' : 'Carrello vuoto'}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>
              {lang === 'fr' ? 'Cliquez sur un produit' : lang === 'en' ? 'Click on a product' : lang === 'es' ? 'Haga clic en un producto' : 'Clicca su un prodotto'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cart.map((item, idx) => {
              const stock = getStock ? getStock(item.id) : 0
              const atMax = stock > 0 && item.qty >= stock
              return (
                <div key={item.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'var(--mono)', marginTop: 1 }}>
                        {fmt(item.price)} × {item.qty}
                        {item.tierLabel && (
                          <span style={{ fontFamily: 'var(--font)', color: 'var(--acc3)', marginLeft: 6 }}>· {item.tierLabel}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button type="button"
                        onClick={() => updateQty(item.id, -1)}
                        aria-label={item.qty === 1
                          ? (lang === 'en' ? `Remove ${item.name}` : lang === 'es' ? `Quitar ${item.name}` : lang === 'it' ? `Rimuovi ${item.name}` : `Retirer ${item.name}`)
                          : (lang === 'en' ? 'Decrease quantity' : lang === 'es' ? 'Disminuir cantidad' : lang === 'it' ? 'Riduci quantità' : 'Diminuer la quantité')}
                        style={{
                          width: tapSize, height: tapSize, borderRadius: 7,
                          background: item.qty === 1 ? 'var(--c-red-bg)' : 'var(--card2)',
                          border: item.qty === 1 ? '1px solid var(--c-red-border)' : '1px solid transparent',
                          cursor: 'pointer', fontSize: 13,
                          color: item.qty === 1 ? 'var(--danger)' : 'var(--text2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                        }}>{item.qty === 1 ? '×' : '−'}</button>
                      <span style={{
                        fontSize: 13, color: 'var(--text)', fontFamily: 'var(--mono)',
                        minWidth: 14, textAlign: 'center', lineHeight: 1,
                      }}>{item.qty}</span>
                      <button type="button"
                        onClick={() => { if (!atMax) updateQty(item.id, +1) }}
                        disabled={atMax}
                        aria-label={lang === 'en' ? 'Increase quantity' : lang === 'es' ? 'Aumentar cantidad' : lang === 'it' ? 'Aumenta quantità' : 'Augmenter la quantité'}
                        style={{
                          width: tapSize, height: tapSize, borderRadius: 7,
                          background: 'var(--card2)', border: '1px solid transparent',
                          cursor: atMax ? 'not-allowed' : 'pointer', fontSize: 13,
                          color: atMax ? 'var(--text3)' : 'var(--text2)', opacity: atMax ? 0.4 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
                        }}>+</button>
                    </div>
                  </div>
                  {idx < cart.length - 1 && (
                    <div aria-hidden="true" style={{ height: 1, background: 'color-mix(in srgb, var(--border) 55%, transparent)', marginTop: 8 }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Remise manuelle — action secondaire discrète ── */}
      {setShowDiscountModal && (
        <div style={{ flexShrink: 0, marginTop: 10 }}>
          {!discount ? (
            <button type="button" onClick={() => setShowDiscountModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', padding: '4px 0',
                minHeight: isMobile ? 44 : undefined,
                cursor: 'pointer', fontFamily: 'var(--font)',
                fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--text3)',
              }}>
              <Tag size={12} />
              {lang === 'en' ? 'Apply discount' : lang === 'es' ? 'Aplicar descuento' : lang === 'it' ? 'Applica sconto' : 'Appliquer une remise'}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--acc2)', fontWeight: 'var(--fw-semibold)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Tag size={12} />
                {lang === 'en' ? 'Discount' : lang === 'es' ? 'Descuento' : lang === 'it' ? 'Sconto' : 'Remise'} : {discount.type === 'percent' ? `${discount.value} %` : fmt(discount.value)}
              </span>
              {setDiscount && (
                <button type="button" onClick={() => setDiscount(null)}
                  aria-label={lang === 'en' ? 'Clear discount' : lang === 'es' ? 'Quitar descuento' : lang === 'it' ? 'Rimuovi sconto' : 'Annuler remise'}
                  title={lang === 'en' ? 'Clear discount' : lang === 'es' ? 'Quitar descuento' : lang === 'it' ? 'Rimuovi sconto' : 'Annuler remise'}
                  style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    background: 'var(--c-red-bg)', border: '1px solid var(--c-red-border)',
                    color: 'var(--danger)', cursor: 'pointer', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Totaux : Sous-total → remises (vert) → HT/TVA discrets → Total héros or ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
        {cart.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', fontSize: 13, marginBottom: 5 }}>
              <span>{lang === 'en' ? 'Subtotal' : lang === 'es' ? 'Subtotal' : lang === 'it' ? 'Subtotale' : 'Sous-total'}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmt(cartSubtotal)}</span>
            </div>
            {discount && discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--acc2)', fontSize: 13, marginBottom: 5 }}>
                <span>{lang === 'en' ? 'Discount' : lang === 'es' ? 'Descuento' : lang === 'it' ? 'Sconto' : 'Remise'}{discount.type === 'percent' ? ` (${discount.value}%)` : ''}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>− {fmt(discountAmount)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--acc2)', fontSize: 13, marginBottom: 5 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lang === 'en' ? 'Loyalty discount' : lang === 'es' ? 'Descuento fidelidad' : lang === 'it' ? 'Sconto fedeltà' : 'Remise fidélité'} ({loyaltyPct}%)
                  {loyaltyCustomerName ? ` · ${loyaltyCustomerName}` : ''}
                </span>
                <span style={{ fontFamily: 'var(--mono)', flexShrink: 0 }}>− {fmt(loyaltyDiscount)}</span>
              </div>
            )}
            {/* Ventilation fiscale (spec §1, complément maquette) — discrète */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>
              <span>{lang === 'en' ? 'Net total (excl. VAT)' : lang === 'es' ? 'Total sin IVA' : lang === 'it' ? 'Totale imponibile' : 'Total HT'}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmt(Math.round(totalHT))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
              <span>{lang === 'en' ? 'VAT' : lang === 'es' ? 'IVA' : lang === 'it' ? 'IVA' : 'TVA'} ({posTaxRate}%)</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmt(Math.round(tva))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 'var(--fw-semibold)' }}>Total</span>
              {/* Chiffre héros : or --acc (code couleur argent) */}
              <span style={{ color: 'var(--acc)', fontSize: 24, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>{fmt(total)}</span>
            </div>
          </>
        )}

        {/* CTA — ouvre la feuille d'encaissement (modes de paiement) */}
        <button type="button"
          disabled={cart.length === 0}
          onClick={() => setShowModal(true)}
          style={{
            width: '100%', minHeight: 50, padding: 14,
            background: cart.length === 0 ? 'var(--bg4)' : 'var(--grad-p)',
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 'var(--fw-semibold)',
            color: cart.length === 0 ? 'var(--text3)' : '#fff',
            cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)', boxShadow: cart.length === 0 ? 'none' : 'var(--sh-md)',
            transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {lang === 'fr' ? 'Encaisser' : lang === 'en' ? 'Checkout' : lang === 'es' ? 'Cobrar' : 'Incassare'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
