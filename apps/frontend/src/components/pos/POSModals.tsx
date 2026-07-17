import { useEffect, useState } from 'react'
import { X, Smartphone, AlertTriangle, AlertCircle, Loader2, TestTube, CreditCard, Coins, Waves, Wallet, Split, Check, Printer } from 'lucide-react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import toast from 'react-hot-toast'
import { t, CURRENCY_SYMBOLS } from '@/stores/appStore'
import { salesApi } from '@/lib/api'
import { COUNTRY_CODES, CountryItem } from '@/components/pos/posShared'
import POSCashField from '@/components/pos/POSCashField'
import { useModalFocus } from '@/hooks/useModalFocus'

interface POSModalsProps {
  showDiscountModal: boolean; setShowDiscountModal: (b: boolean) => void
  discountForm: any; setDiscountForm: (v: any) => void
  fmt: (n: number) => string
  subtotalBeforeDiscount: number
  setDiscount: (v: any) => void
  showCloseModal: boolean; setShowCloseModal: (b: boolean) => void
  ct: any
  cashierOpenedAt: any; locale: string
  cashierOpeningFund: number; cashierSessionTx: number; cashierSessionCA: number
  cashierName?: string
  closeCashier: () => void
  setOpeningFundInput: (v: string) => void
  currency: any
  showModal: boolean; setShowModal: (b: boolean) => void
  cart: any[]
  total: number
  sendWhatsApp: boolean; setSendWhatsApp: (b: boolean) => void
  waCountryFlag: string; waCountryCode: string
  setWaCountryCode: (v: string) => void; setWaCountryFlag: (v: string) => void
  showCountryPicker: boolean; setShowCountryPicker: (v: any) => void
  countrySearch: string; setCountrySearch: (v: string) => void
  waNumber: string; setWaNumber: (v: any) => void
  lang: string
  confirmSale: () => void
  isSaving: boolean; waSending: boolean
  discount: any; payMode: string
  cashGiven: string; toXOF: (v: number) => number
  // ── Sélection du MODE DE PAIEMENT — vit dans cette feuille depuis l'item 11 (maquette) ──
  PAY_MODES: { id: string; label: string; color?: string }[]
  setPayMode: (v: any) => void
  isOnline?: boolean                       // hors-ligne → cash-only
  setCashGiven: (v: string) => void
  monnaie: number
  currencySymbol: string
  // Paiement mixte (split, 2 méthodes)
  mixedOn: boolean; mixedValid: boolean
  setMixedOn: (b: boolean) => void
  mixedM1: 'cash'|'mobile'|'card'; setMixedM1: (m: 'cash'|'mobile'|'card') => void
  mixedM2: 'cash'|'mobile'|'card'; setMixedM2: (m: 'cash'|'mobile'|'card') => void
  mixedAmt1: string; setMixedAmt1: (v: string) => void
  mixedAmt2XOF: number
  // PayDunya (Wave / OM Sénégal & UEMOA) : si configuré, Wave/Orange passent par PayDunya
  paydunyaOk?: boolean; onPaydunyaStart?: () => void
  // « dont TVA » sous le total (spec §2) + total en devise d'affichage (raccourcis espèces)
  tvaAmount?: number
  totalDisplay?: number
  // MTN MoMo — flux USSD polling dans la modale de confirmation
  mtnPhone: string; setMtnPhone: (v: string) => void
  mtnStatus: 'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'
  mtnError: string
  startMtnPayment: () => void
  onMtnRetry: () => void
  // Orange Money (Campay) — flux polling dans la modale de confirmation
  orangePhone: string; setOrangePhone: (v: string) => void
  orangeStatus: 'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'
  orangeError: string
  startOrangePayment: () => void
  onOrangeRetry: () => void
  // Carte Campay (QR / lien hébergé) — flux polling dans la modale de confirmation
  cardStatus: 'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'
  cardPaymentUrl: string|null
  cardQrDataUrl: string|null
  startCardPayment: () => void
  onCardRetry: () => void
}

export default function POSModals({ showDiscountModal, setShowDiscountModal, discountForm, setDiscountForm, fmt, subtotalBeforeDiscount, setDiscount, showCloseModal, setShowCloseModal, ct, cashierOpenedAt, locale, cashierOpeningFund, cashierSessionTx, cashierSessionCA, cashierName = '', closeCashier, setOpeningFundInput, currency, showModal, setShowModal, cart, total, sendWhatsApp, setSendWhatsApp, waCountryFlag, waCountryCode, setWaCountryCode, setWaCountryFlag, showCountryPicker, setShowCountryPicker, countrySearch, setCountrySearch, waNumber, setWaNumber, lang, confirmSale, isSaving, waSending, discount, payMode, cashGiven, toXOF, PAY_MODES, setPayMode, isOnline = true, setCashGiven, monnaie, currencySymbol, mixedOn, mixedValid, setMixedOn, mixedM1, setMixedM1, mixedM2, setMixedM2, mixedAmt1, setMixedAmt1, mixedAmt2XOF, paydunyaOk = false, onPaydunyaStart, tvaAmount = 0, totalDisplay, mtnPhone, setMtnPhone, mtnStatus, mtnError, startMtnPayment, onMtnRetry, orangePhone, setOrangePhone, orangeStatus, orangeError, startOrangePayment, onOrangeRetry, cardStatus, cardPaymentUrl, cardQrDataUrl, startCardPayment, onCardRetry }: POSModalsProps) {
  // Garde-fou cash : en mode espèces, exiger un montant reçu (converti en XOF) ≥ total.
  // Les autres modes (Wave/Orange/Carte/Mobile) ne saisissent pas de montant → toujours OK.
  const cashOK  = payMode !== 'cash' || toXOF(parseFloat(cashGiven) || 0) >= total
  // En paiement mixte, c'est la validité du split (somme=total, 2 modes) qui conditionne.
  const payOK = mixedOn ? mixedValid : cashOK
  // PayDunya configuré → Wave/Orange passent par la facture hébergée (QR overlay), pas Campay.
  const paydunyaMode = paydunyaOk && !mixedOn && (payMode === 'wave' || payMode === 'orange')
  // MTN MoMo : le bouton Confirmer est masqué (le flux polling gère la confirmation).
  const isMtnMode = !mixedOn && payMode === 'mtn'
  // Orange Money (Campay) : idem — sauf si PayDunya prend la main sur Orange.
  const isOrangeMode = !paydunyaMode && !mixedOn && payMode === 'orange'
  // Carte Campay : masque Confirmer pendant le flux QR / polling.
  const isCardMode   = !mixedOn && payMode === 'card'
  const blocked = isSaving || waSending || !payOK

  // ── Clôture de caisse (maquette 03) — état UI pur ────────────────────────────
  // Montant compté (devise d'affichage) : contrôlé → écart LIVE coloré.
  const [countedInput, setCountedInput] = useState('')
  // Ventilation par mode des ventes du JOUR (lecture seule, affichage) — le PDF
  // Ticket Z serveur reste autoritaire (breakdown COALESCE(split, paymentMode)).
  const [dayByMode, setDayByMode] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    if (!showCloseModal) { setCountedInput(''); return }
    let alive = true
    salesApi.list()
      .then((sales: any[]) => {
        if (!alive || !Array.isArray(sales)) return
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
        const acc: Record<string, number> = {}
        for (const s of sales) {
          if (s.status === 'refunded') continue
          if (new Date(s.createdAt) < dayStart) continue
          const m = s.paymentMode || 'cash'
          acc[m] = (acc[m] ?? 0) + (Number(s.total) || 0)
        }
        setDayByMode(acc)
      })
      .catch(() => { if (alive) setDayByMode(null) })  // hors-ligne → repli session (sans ventilation)
    return () => { alive = false }
  }, [showCloseModal])

  // Espèces attendues = fond + ventes ESPÈCES (maquette/spec : seules les espèces se
  // comptent). Repli si ventilation indisponible : CA session (comportement historique).
  const dayCashSales = dayByMode?.cash ?? null
  const expectedCash = cashierOpeningFund + (dayCashSales ?? cashierSessionCA)
  const countedXOF = toXOF(Math.max(0, parseFloat(countedInput) || 0))
  const countedEntered = countedInput.trim() !== ''
  const cashGap = countedXOF - expectedCash
  // Seuils d'alerte : juste (0) / petit écart (< 5 % de l'attendu) / important.
  const gapLevel = cashGap === 0 ? 'ok' : Math.abs(cashGap) < Math.max(500, expectedCash * 0.05) ? 'warn' : 'danger'
  // Pièges à focus (focus initial + Tab bouclé + restauration au déclencheur)
  const discountBoxRef = useModalFocus<HTMLDivElement>(showDiscountModal)
  const closeBoxRef    = useModalFocus<HTMLDivElement>(showCloseModal)
  const confirmBoxRef  = useModalFocus<HTMLDivElement>(showModal)
  return (
    <>
      {showDiscountModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          aria-label={lang === 'en' ? 'Apply a discount' : lang === 'es' ? 'Aplicar un descuento' : lang === 'it' ? 'Applica uno sconto' : 'Appliquer une remise'}
          onClick={e => e.target === e.currentTarget && setShowDiscountModal(false)}>
          <div ref={discountBoxRef} className="modal-box" style={{ maxWidth:420 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:'var(--fw-bold)', color:'var(--text)' }}>🏷️ Appliquer une remise</h3>
              <button className="mini-btn" aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={() => setShowDiscountModal(false)}>✕</button>
            </div>

            {/* Type */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:8 }}>Type de remise</label>
              <ResponsiveGrid min={160} gap={8}>
                {([
                  { type:'percent', label:'Pourcentage (%)', icon:'%' },
                  { type:'amount',  label:'Montant fixe',    icon:'F' },
                ] as { type:'percent'|'amount'; label:string; icon:string }[]).map(rt => (
                  <button key={rt.type} onClick={() => setDiscountForm(f => ({...f, type:rt.type}))} style={{
                    padding:'12px', borderRadius:10, cursor:'pointer', fontFamily:'var(--font)',
                    fontSize:13, fontWeight:'var(--fw-regular)', transition:'all .15s',
                    background: discountForm.type === rt.type ? 'rgba(91,78,232,.15)' : 'var(--bg3)',
                    border:`1.5px solid ${discountForm.type === rt.type ? 'var(--p2)' : 'var(--border)'}`,
                    color: discountForm.type === rt.type ? 'var(--p2)' : 'var(--text2)',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  }}>
                    <span style={{ fontSize:22, fontWeight:'var(--fw-semibold)' }}>{rt.icon}</span>
                    {rt.label}
                  </button>
                ))}
              </ResponsiveGrid>
            </div>

            {/* Remises rapides % */}
            {discountForm.type === 'percent' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:8 }}>Remise rapide</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[5,10,15,20,25,30].map(pct => (
                    <button key={pct} onClick={() => setDiscountForm(f => ({...f, value:pct}))} style={{
                      padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:'var(--fw-semibold)',
                      cursor:'pointer', fontFamily:'var(--font)', border:'none', transition:'all .15s',
                      background: discountForm.value === pct ? 'var(--p)' : 'var(--bg3)',
                      color: discountForm.value === pct ? '#fff' : 'var(--text2)',
                    }}>{pct} %</button>
                  ))}
                </div>
              </div>
            )}

            {/* Valeur personnalisée */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                {discountForm.type === 'percent' ? 'Pourcentage personnalisé' : 'Montant de la remise'}
              </label>
              <div style={{ position:'relative' }}>
                <input className="input" type="number"
                  placeholder={discountForm.type === 'percent' ? 'Ex: 12' : 'Ex: 5000'}
                  value={discountForm.value || ''}
                  onChange={e => setDiscountForm(f => ({...f, value:+e.target.value}))}
                  style={{ paddingRight:50 }} />
                <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text3)' }}>
                  {discountForm.type === 'percent' ? '%' : 'F'}
                </span>
              </div>
              {discountForm.value > 0 && (
                <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.2)', borderRadius:8, fontSize:12, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--text2)' }}>Remise sur {fmt(subtotalBeforeDiscount)}</span>
                  <span style={{ color:'var(--acc2)', fontWeight:'var(--fw-semibold)', fontFamily:'var(--mono)' }}>
                    − {discountForm.type === 'percent'
                      ? fmt(subtotalBeforeDiscount * discountForm.value / 100)
                      : fmt(discountForm.value)}
                  </span>
                </div>
              )}
            </div>

            {/* Motif */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>{lang === 'en' ? 'Reason (optional)' : lang === 'es' ? 'Motivo (opcional)' : lang === 'it' ? 'Motivo (opzionale)' : 'Motif (optionnel)'}</label>
              <input aria-label={lang === 'en' ? 'Reason (optional)' : lang === 'es' ? 'Motivo (opcional)' : lang === 'it' ? 'Motivo (opzionale)' : 'Motif (optionnel)'} className="input" placeholder={lang === 'en' ? 'Ex: Loyal customer, daily promo...' : lang === 'es' ? 'Ej: Cliente fiel, promoción del día...' : lang === 'it' ? 'Es: Cliente fedele, promo del giorno...' : 'Ex: Client fidèle, promotion du jour...'}
                value={discountForm.reason}
                onChange={e => setDiscountForm(f => ({...f, reason:e.target.value}))} />
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }}
                onClick={() => {
                  if (!discountForm.value) { toast.error('Entrez une valeur'); return }
                  if (discountForm.type === 'percent' && discountForm.value > 100) { toast.error('Max 100 %'); return }
                  setDiscount(discountForm)
                  setShowDiscountModal(false)
                  toast.success(`Remise de ${discountForm.type === 'percent' ? discountForm.value + ' %' : fmt(discountForm.value)} appliquée`)
                }}>
                Appliquer la remise
              </button>
              <button className="mini-btn" style={{ padding:'10px 16px' }} onClick={() => setShowDiscountModal(false)}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          MODAL CONFIRMATION
      ════════════════════════════════ */}
      {/* ════════════════════════════════
          MODAL FERMETURE CAISSE
      ════════════════════════════════ */}
      {showCloseModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={ct.close_title} onClick={e => e.target===e.currentTarget && setShowCloseModal(false)}>
          <div ref={closeBoxRef} className="modal-box" style={{ maxWidth:420 }}>
            {/* Header — « Clôture de caisse » + badge Ticket Z · date (maquette 03) */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4, gap:8 }}>
              <span style={{ color:'var(--text)', fontSize:16, fontWeight:'var(--fw-semibold)' }}>{ct.close_title}</span>
              <span style={{
                background:'color-mix(in srgb, var(--p) 16%, transparent)', color:'var(--p3)',
                fontSize:11, fontWeight:'var(--fw-semibold)', padding:'4px 10px', borderRadius:'var(--r-full)', flexShrink:0,
              }}>
                Ticket Z · {new Date().toLocaleDateString(locale, { day:'2-digit', month:'2-digit' })}
              </span>
            </div>
            {/* Ligne session : caissier · heure d'ouverture · N ventes */}
            <div style={{ color:'var(--text3)', fontSize:12, marginBottom:16 }}>
              {cashierName || ct.cashier_label}
              {' · '}
              {lang === 'en' ? 'opened at' : lang === 'es' ? 'abierta a las' : lang === 'it' ? 'aperta alle' : 'ouverte à'}{' '}
              {cashierOpenedAt ? new Date(cashierOpenedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) : '--:--'}
              {' · '}
              {cashierSessionTx} {lang === 'en' ? 'sales' : lang === 'es' ? 'ventas' : lang === 'it' ? 'vendite' : 'ventes'}
            </div>

            {/* VENTES PAR MODE — pastilles couleur → Total ventes (or) */}
            {dayByMode && Object.keys(dayByMode).length > 0 && (
              <>
                <div style={{ color:'var(--text3)', fontSize:11, letterSpacing:'.5px', textTransform:'uppercase', fontWeight:'var(--fw-semibold)', marginBottom:9 }}>
                  {lang === 'en' ? 'Sales by method' : lang === 'es' ? 'Ventas por método' : lang === 'it' ? 'Vendite per metodo' : 'Ventes par mode'}
                </div>
                <div style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:12, padding:'6px 14px', marginBottom:16 }}>
                  {(['cash','wave','orange','mtn','card','mixed'] as const).filter(m => (dayByMode[m] ?? 0) > 0).map(m => {
                    const dot = m === 'cash' ? 'var(--acc2)' : m === 'wave' ? 'var(--acc3)' : m === 'orange' ? '#FF9F45' : m === 'mtn' ? 'var(--warn)' : m === 'card' ? 'var(--p3)' : 'var(--text3)'
                    const label = m === 'cash' ? (lang==='en'?'Cash':lang==='es'?'Efectivo':lang==='it'?'Contanti':'Espèces')
                      : m === 'wave' ? 'Wave' : m === 'orange' ? 'Orange Money' : m === 'mtn' ? 'MTN MoMo'
                      : m === 'card' ? (lang==='en'?'Card':lang==='es'?'Tarjeta':lang==='it'?'Carta':'Carte')
                      : (lang==='en'?'Mixed':lang==='es'?'Mixto':lang==='it'?'Misto':'Mixte')
                    return (
                      <div key={m} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid color-mix(in srgb, var(--border) 55%, transparent)' }}>
                        <span style={{ color:'var(--text)', fontSize:13, display:'flex', alignItems:'center' }}>
                          <span aria-hidden="true" style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:dot, marginRight:8 }} />
                          {label}
                        </span>
                        <span style={{ color:'var(--text2)', fontSize:13, fontFamily:'var(--mono)' }}>{fmt(dayByMode[m])}</span>
                      </div>
                    )
                  })}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0' }}>
                    <span style={{ color:'var(--text)', fontSize:14, fontWeight:'var(--fw-semibold)' }}>
                      {lang === 'en' ? 'Total sales' : lang === 'es' ? 'Total ventas' : lang === 'it' ? 'Totale vendite' : 'Total ventes'}
                    </span>
                    <span style={{ color:'var(--acc)', fontSize:16, fontWeight:'var(--fw-semibold)', fontFamily:'var(--mono)' }}>
                      {fmt(Object.values(dayByMode).reduce((a, b) => a + b, 0))}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* CAISSE ESPÈCES : fond + ventes espèces = attendu */}
            <div style={{ color:'var(--text3)', fontSize:11, letterSpacing:'.5px', textTransform:'uppercase', fontWeight:'var(--fw-semibold)', marginBottom:9 }}>
              {lang === 'en' ? 'Cash drawer' : lang === 'es' ? 'Caja efectivo' : lang === 'it' ? 'Cassa contanti' : 'Caisse espèces'}
            </div>
            <div style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:12, padding:'12px 14px', marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text2)', fontSize:13, marginBottom:6 }}>
                <span>{ct.initial_fund}</span><span style={{ fontFamily:'var(--mono)' }}>{fmt(cashierOpeningFund)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text2)', fontSize:13, marginBottom:6 }}>
                <span>+ {lang === 'en' ? 'Cash sales' : lang === 'es' ? 'Ventas en efectivo' : lang === 'it' ? 'Vendite in contanti' : 'Ventes espèces'}</span>
                <span style={{ fontFamily:'var(--mono)' }}>{fmt(dayCashSales ?? cashierSessionCA)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text)', fontSize:13, fontWeight:'var(--fw-semibold)', paddingTop:6, borderTop:'1px solid color-mix(in srgb, var(--border) 55%, transparent)' }}>
                <span>= {lang === 'en' ? 'Expected cash' : lang === 'es' ? 'Efectivo esperado' : lang === 'it' ? 'Contanti attesi' : 'Espèces attendues'}</span>
                <span style={{ fontFamily:'var(--mono)' }}>{fmt(expectedCash)}</span>
              </div>
            </div>

            {/* Montant compté (devise d'affichage → XOF pour l'écart) */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:10, flexWrap:'wrap' }}>
              <label htmlFor="counted-amount" style={{ color:'var(--text2)', fontSize:13 }}>{ct.counted_label}</label>
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'2px 13px', display:'flex', alignItems:'baseline', gap:5, flex:1, maxWidth:200 }}>
                <input id="counted-amount" className="no-spin" type="number" min={0} inputMode="decimal"
                  placeholder={ct.counted_placeholder}
                  value={countedInput}
                  onKeyDown={e => { if (e.key === '-') e.preventDefault() }}
                  onChange={e => { const v = e.target.value; setCountedInput(v === '' ? '' : (parseFloat(v) < 0 ? '0' : v)) }}
                  style={{ flex:1, minWidth:0, textAlign:'right', background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:16, fontWeight:'var(--fw-semibold)', fontFamily:'var(--mono)', padding:'7px 0' }} />
                <span aria-hidden="true" style={{ color:'var(--text3)', fontSize:12, flexShrink:0 }}>
                  {CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] ?? currency}
                </span>
              </div>
            </div>

            {/* Écart — vert juste / ambre petit / rouge important */}
            {countedEntered && (
              <div role="status" style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background: gapLevel === 'ok' ? 'color-mix(in srgb, var(--acc2) 10%, transparent)'
                  : gapLevel === 'warn' ? 'color-mix(in srgb, var(--warn) 10%, transparent)'
                  : 'color-mix(in srgb, var(--danger) 10%, transparent)',
                borderRadius:11, padding:'11px 14px', marginBottom:18,
              }}>
                <span style={{ color:'var(--text2)', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                  {gapLevel === 'ok'
                    ? <Check size={14} style={{ color:'var(--acc2)' }} />
                    : <AlertTriangle size={14} style={{ color: gapLevel === 'warn' ? 'var(--warn)' : 'var(--danger)' }} />}
                  {gapLevel === 'ok'
                    ? (lang === 'en' ? 'Drawer balanced' : lang === 'es' ? 'Caja cuadrada' : lang === 'it' ? 'Cassa esatta' : 'Caisse juste')
                    : (lang === 'en' ? 'Difference' : lang === 'es' ? 'Diferencia' : lang === 'it' ? 'Differenza' : 'Écart')}
                </span>
                <span style={{
                  color: gapLevel === 'ok' ? 'var(--acc2)' : gapLevel === 'warn' ? 'var(--warn)' : 'var(--danger)',
                  fontSize:16, fontWeight:'var(--fw-semibold)', fontFamily:'var(--mono)',
                }}>
                  {gapLevel === 'ok' ? fmt(0) : `${cashGap > 0 ? '+ ' : '− '}${fmt(Math.abs(cashGap))}`}
                </span>
              </div>
            )}

            {/* Actions : Annuler (1) + Clôturer & imprimer Z (2) */}
            <div style={{ display:'flex', gap:9 }}>
              <button type="button" onClick={() => setShowCloseModal(false)}
                style={{ flex:1, background:'var(--card2)', color:'var(--text2)', border:'1px solid var(--border)',
                  borderRadius:12, padding:13, minHeight:48, fontSize:14, fontWeight:'var(--fw-semibold)', fontFamily:'var(--font)', cursor:'pointer' }}>
                {ct.cancel}
              </button>
              <button type="button"
                onClick={() => {
                  const openedTime = cashierOpenedAt ? new Date(cashierOpenedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) : '--:--'
                  const win = window.open('', '_blank', 'width=400,height=600')
                  if (win) {
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ct.close_title}</title>
                    <style>body{font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto;}
                    .center{text-align:center;}.bold{font-weight:bold;}.big{font-size:16px;font-weight:900;}
                    .divider{border-top:1px dashed #000;margin:8px 0;}.row{display:flex;justify-content:space-between;margin:4px 0;}
                    .ok{color:green;}.err{color:red;}</style></head><body>
                    <div class="center"><div class="big">HabaShop</div><div>${ct.close_title.toUpperCase()} — TICKET Z</div>
                    <div>${ct.cashier_label} — ${new Date().toLocaleDateString(locale)}</div></div>
                    <div class="divider"></div>
                    <div class="row"><span>${ct.open_time}:</span><span>${openedTime}</span></div>
                    <div class="row"><span>${ct.close_time}:</span><span>${new Date().toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}</span></div>
                    <div class="row"><span>Caissier:</span><span>${cashierName || '—'}</span></div>
                    <div class="divider"></div>
                    <div class="row"><span>${ct.initial_fund}:</span><span>${fmt(cashierOpeningFund)}</span></div>
                    <div class="row"><span>${ct.transactions}:</span><span>${cashierSessionTx}</span></div>
                    <div class="row bold"><span>${ct.ca_cashed}:</span><span>${fmt(cashierSessionCA)}</span></div>
                    ${dayByMode ? Object.entries(dayByMode).map(([m, v]) => `<div class="row"><span>${m}:</span><span>${fmt(v as number)}</span></div>`).join('') : ''}
                    <div class="divider"></div>
                    <div class="row bold"><span>Attendu (espèces):</span><span>${fmt(expectedCash)}</span></div>
                    <div class="row bold"><span>Compté:</span><span>${fmt(countedXOF)}</span></div>
                    <div class="row bold ${cashGap >= 0 ? 'ok' : 'err'}"><span>Écart:</span><span>${cashGap >= 0 ? '+' : '−'}${fmt(Math.abs(cashGap))}</span></div>
                    <div class="divider"></div>
                    <div class="center" style="margin-top:20px;"><div>________________________</div><div>Signature caissier</div></div>
                    <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},300)}<\/script>
                    </body></html>`)
                    win.document.close()
                  }
                  closeCashier()
                  setOpeningFundInput('')
                  setShowCloseModal(false)
                  toast.success(lang === 'en' ? 'Register closed — Z report printed' : lang === 'es' ? 'Caja cerrada — informe Z impreso' : lang === 'it' ? 'Cassa chiusa — rapporto Z stampato' : 'Caisse fermée — Ticket Z imprimé')
                }}
                style={{ flex:2, background:'var(--grad-p)', color:'#fff', border:'none',
                  borderRadius:12, padding:13, minHeight:48, fontSize:14, fontWeight:'var(--fw-semibold)', fontFamily:'var(--font)',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'var(--sh-md)' }}>
                <Printer size={15} /> {lang === 'en' ? 'Close & print Z' : lang === 'es' ? 'Cerrar e imprimir Z' : lang === 'it' ? 'Chiudi e stampa Z' : 'Clôturer & imprimer Z'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal-backdrop" role="dialog" aria-modal="true"
          aria-label={t('pos_confirm_sale')}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div ref={confirmBoxRef} className="modal-box">
            {/* Header — « Encaissement » + compteur articles (maquette 02) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
                  {lang === 'en' ? 'Checkout' : lang === 'es' ? 'Cobro' : lang === 'it' ? 'Incasso' : 'Encaissement'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {cart.length} article{cart.length > 1 ? 's' : ''}
                </span>
              </div>
              <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} className="mini-btn" style={{ minWidth: 44, minHeight: 44 }} onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>

            {/* TOTAL À PAYER — bloc centré or (maquette) + « dont TVA » (spec §2) */}
            <div style={{
              background: 'var(--bg)',
              border: '1px solid color-mix(in srgb, var(--acc) 20%, transparent)',
              borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 18,
            }}>
              <div style={{ color: 'var(--text3)', fontSize: 11, letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)' }}>
                {lang === 'en' ? 'Total to pay' : lang === 'es' ? 'Total a pagar' : lang === 'it' ? 'Totale da pagare' : 'Total à payer'}
              </div>
              <div style={{ color: 'var(--acc)', fontSize: 30, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)', marginTop: 3, letterSpacing: '-.5px' }}>
                {fmt(total)}
              </div>
              {tvaAmount > 0 && (
                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 4 }}>
                  {lang === 'en' ? 'incl. VAT' : lang === 'es' ? 'IVA incl.' : lang === 'it' ? 'IVA incl.' : 'dont TVA'}{' '}
                  <span style={{ fontFamily: 'var(--mono)' }}>{fmt(Math.round(tvaAmount))}</span>
                </div>
              )}
            </div>

            {/* ── MODE DE PAIEMENT — grille 3×2, Mixte en tuile pointillée (maquette 02) ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: 'var(--text3)', fontSize: 11, letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)', marginBottom: 9 }}>
                {lang === 'en' ? 'Payment method' : lang === 'es' ? 'Método de pago' : lang === 'it' ? 'Metodo di pagamento' : 'Mode de paiement'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                {(['cash', 'wave', 'orange', 'mtn', 'card'] as const).map(id => {
                  const mode = PAY_MODES.find(m => m.id === id)
                  if (!mode) return null
                  // Hors-ligne : Mobile Money / Carte indisponibles (webhooks impossibles) → cash-only
                  const offline = !isOnline && id !== 'cash'
                  const active = !mixedOn && payMode === id
                  // Teinte de marque par opérateur (icône dans un carré 30px)
                  const tint =
                    id === 'cash'   ? 'var(--acc2)'  :
                    id === 'wave'   ? 'var(--acc3)'  :
                    id === 'orange' ? '#FF9F45'      :
                    id === 'mtn'    ? 'var(--warn)'  :
                                      'var(--p3)'
                  const TileIcon =
                    id === 'cash'   ? Coins :
                    id === 'wave'   ? Waves :
                    id === 'orange' ? Smartphone :
                    id === 'mtn'    ? Wallet :
                                      CreditCard
                  return (
                    <button key={id} type="button" onClick={() => { if (!offline) { setPayMode(id); if (mixedOn) setMixedOn(false) } }}
                      aria-pressed={active}
                      disabled={offline}
                      style={{
                        background: 'var(--card2)',
                        border: active ? '1.5px solid var(--p)' : '1px solid var(--border2)',
                        borderRadius: 11, padding: '11px 8px', minHeight: 44, textAlign: 'center',
                        cursor: offline ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
                        opacity: offline ? 0.4 : 1, transition: 'all .12s',
                      }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: 8, margin: '0 auto',
                        background: `color-mix(in srgb, ${tint} 17%, transparent)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: tint,
                      }}><TileIcon size={16} /></span>
                      <span style={{ display: 'block', color: 'var(--text)', fontSize: 12, fontWeight: 'var(--fw-semibold)', marginTop: 6 }}>{mode.label}</span>
                    </button>
                  )
                })}
                {/* Tuile Mixte (pointillée) — remplace l'ancien toggle */}
                <button type="button" onClick={() => { if (isOnline) setMixedOn(!mixedOn) }}
                  aria-pressed={mixedOn}
                  disabled={!isOnline}
                  style={{
                    background: 'var(--card2)',
                    border: mixedOn ? '1.5px solid var(--p)' : '1px dashed color-mix(in srgb, var(--text3) 40%, transparent)',
                    borderRadius: 11, padding: '11px 8px', minHeight: 44, textAlign: 'center',
                    cursor: isOnline ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)',
                    opacity: isOnline ? 1 : 0.4, transition: 'all .12s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <span style={{ color: mixedOn ? 'var(--p3)' : 'var(--text3)', display: 'flex' }}><Split size={16} /></span>
                  <span style={{ color: mixedOn ? 'var(--text)' : 'var(--text3)', fontSize: 12, fontWeight: 'var(--fw-semibold)', marginTop: 6 }}>
                    {lang === 'en' ? 'Mixed' : lang === 'es' ? 'Mixto' : lang === 'it' ? 'Misto' : 'Mixte'}
                  </span>
                </button>
              </div>

              {!isOnline && (
                <div role="status" style={{ marginBottom: 6, fontSize: 11, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={12} style={{ flexShrink: 0 }} />
                  {lang === 'en' ? 'Offline — cash only' : lang === 'es' ? 'Sin conexión — solo efectivo' : lang === 'it' ? 'Offline — solo contanti' : 'Hors-ligne — espèces uniquement'}
                </div>
              )}

              {mixedOn && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <MethodPicker value={mixedM1} lang={lang} onChange={m => { setMixedM1(m); if (m === mixedM2) setMixedM2((['cash', 'mobile', 'card'] as const).find(x => x !== m)!) }} />
                    <input type="number" inputMode="decimal" min={0} value={mixedAmt1} onChange={e => setMixedAmt1(e.target.value)}
                      placeholder="0" aria-label={lang === 'en' ? 'Amount 1' : lang === 'es' ? 'Importe 1' : lang === 'it' ? 'Importo 1' : 'Montant 1'}
                      style={{ flex: 1, minWidth: 0, height: 36, padding: '0 8px', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--mono)', textAlign: 'right', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <MethodPicker value={mixedM2} exclude={mixedM1} lang={lang} onChange={setMixedM2} />
                    {/* « Reste à payer » décompté (spec §2) — complété par la 2e méthode */}
                    <div style={{ flex: 1, minWidth: 0, height: 36, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lang === 'en' ? 'Remaining' : lang === 'es' ? 'Restante' : lang === 'it' ? 'Rimanente' : 'Reste à payer'}
                      </span>
                      <span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 13, flexShrink: 0 }}>{fmt(mixedAmt2XOF)}</span>
                    </div>
                  </div>
                  {!mixedValid && (
                    <div style={{ fontSize: 11, color: 'var(--danger)' }}>
                      {lang === 'en' ? 'Amount 1 must be between 0 and the total' : lang === 'es' ? 'El monto 1 debe estar entre 0 y el total' : lang === 'it' ? "L'importo 1 deve essere tra 0 e il totale" : 'Le montant 1 doit être entre 0 et le total'}
                    </div>
                  )}
                </div>
              )}

              {/* Espèces : MONTANT REÇU + raccourcis + Rendu monnaie (maquette 02) */}
              {!mixedOn && payMode === 'cash' && (
                <div style={{ marginTop: 8 }}>
                  <POSCashField lang={lang} cashGiven={cashGiven} setCashGiven={setCashGiven} monnaie={monnaie} currencySymbol={currencySymbol} fmt={fmt} totalDisplay={totalDisplay} />
                </div>
              )}
            </div>

            {/* WhatsApp toggle */}
            <div style={{ padding:'14px 16px', marginBottom:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: sendWhatsApp ? 12 : 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Smartphone size={20} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:'var(--fw-regular)', color:'var(--text)' }}>
                      {lang === 'fr' ? 'Envoyer le ticket WhatsApp' : lang === 'en' ? 'Send WhatsApp receipt' : lang === 'es' ? 'Enviar ticket WhatsApp' : 'Invia scontrino WhatsApp'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {lang === 'fr' ? 'Le client recevra son reçu sur WhatsApp' : lang === 'en' ? 'Customer receives receipt on WhatsApp' : lang === 'es' ? 'El cliente recibirá su recibo por WhatsApp' : 'Il cliente riceverà la ricevuta su WhatsApp'}
                    </div>
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={sendWhatsApp}
                  aria-label={lang === 'fr' ? 'Envoyer le ticket WhatsApp' : lang === 'en' ? 'Send WhatsApp receipt' : lang === 'es' ? 'Enviar ticket WhatsApp' : 'Invia scontrino WhatsApp'}
                  onClick={() => setSendWhatsApp(!sendWhatsApp)}
                  style={{
                    flexShrink:0, width:48, minHeight:44, padding:0,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background:'none', border:'none', cursor:'pointer',
                  }}>
                  {/* Piste : OFF = var(--bg5) + bordure var(--border) → VISIBLE en Mode Soleil
                      (avant : var(--bg4)=blanc → piste invisible sur carte blanche). */}
                  <span style={{
                    position:'relative', display:'block', width:44, height:26, borderRadius:99, boxSizing:'border-box',
                    background: sendWhatsApp ? '#25D366' : 'var(--bg5)',
                    border:'1px solid var(--border)', transition:'background .2s',
                  }}>
                    <span style={{
                      position:'absolute', top:2, width:20, height:20,
                      left: sendWhatsApp ? 20 : 2,
                      borderRadius:'50%', background:'#fff', transition:'left .2s',
                      boxShadow:'0 2px 4px rgba(0,0,0,.2)',
                    }} />
                  </span>
                </button>
              </div>
              {sendWhatsApp && (
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                    {lang==='fr' ? 'Numéro WhatsApp (ticket)' : lang==='en' ? 'WhatsApp number (receipt)' : lang==='es' ? 'Número WhatsApp (recibo)' : 'Numero WhatsApp (ricevuta)'}
                  </label>
                  <div style={{ display:'flex', gap:6, alignItems:'stretch' }}>
                    {/* Sélecteur indicatif — premium */}
                    <div style={{ position:'relative', flexShrink:0 }} data-phone-picker>
                      <button
                        type="button"
                        data-phone-picker
                        aria-expanded={showCountryPicker}
                        aria-haspopup="listbox"
                        aria-label={`${lang==='en' ? 'Country dial code' : lang==='es' ? 'Prefijo del país' : lang==='it' ? 'Prefisso paese' : 'Indicatif pays'} ${waCountryCode}`}
                        onClick={() => { setShowCountryPicker(p => !p); setCountrySearch('') }}
                        style={{
                          display:'flex', alignItems:'center', gap:6,
                          minHeight:44, minWidth:90, padding:'0 10px',
                          background:'var(--bg4)', border:'1.5px solid var(--border)',
                          borderRadius:10, cursor:'pointer', color:'var(--text)',
                          fontSize:13, fontFamily:'var(--font)', transition:'border-color .15s',
                        }}
                      >
                        <span style={{ fontSize:18 }}>{waCountryFlag}</span>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:'var(--fw-semibold)' }}>{waCountryCode}</span>
                        <span style={{ fontSize:11, color:'var(--text3)', marginLeft:2 }}>▼</span>
                      </button>
                      {showCountryPicker && (
                        <div
                          data-phone-picker
                          style={{
                            position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:999,
                            width:280, maxHeight:320, overflowY:'auto',
                            background:'var(--bg2)', border:'1.5px solid var(--border)',
                            borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.18)',
                            display:'flex', flexDirection:'column',
                          }}
                        >
                          <div style={{ position:'sticky', top:0, background:'var(--bg2)', padding:'10px 10px 6px', borderBottom:'1px solid var(--border)', zIndex:1 }}>
                            <input
                              autoFocus
                              type="text"
                              aria-label={lang==='fr' ? 'Rechercher' : lang==='en' ? 'Search' : lang==='es' ? 'Buscar' : 'Cerca'} placeholder={lang==='fr' ? '🔍 Rechercher...' : lang==='en' ? '🔍 Search...' : lang==='es' ? '🔍 Buscar...' : '🔍 Cerca...'}
                              value={countrySearch}
                              onChange={e => setCountrySearch(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Escape') { setShowCountryPicker(false); setCountrySearch('') } }}
                              data-phone-picker
                              style={{
                                width:'100%', padding:'7px 10px',
                                background:'var(--bg4)', border:'1.5px solid var(--border)',
                                borderRadius:8, color:'var(--text)', fontSize:12,
                                fontFamily:'var(--font)', outline:'none', boxSizing:'border-box',
                              }}
                            />
                          </div>
                          {(() => {
                            const q = countrySearch.toLowerCase()
                            const filtered = COUNTRY_CODES.filter(c =>
                              c.country.toLowerCase().includes(q) ||
                              c.code.includes(q) ||
                              c.region.toLowerCase().includes(q)
                            )
                            const regions = Array.from(new Set(filtered.map(c => c.region)))
                            return regions.map(region => (
                              <div key={region} style={{ padding:'4px 0' }}>
                                <div style={{ padding:'6px 12px 2px', fontSize:11, fontWeight:'var(--fw-regular)', textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)' }}>
                                  {region}
                                </div>
                                {filtered.filter(c => c.region === region).map(c => (
                                  <CountryItem
                                    key={c.code}
                                    c={c}
                                    selected={c.code === waCountryCode}
                                    onSelect={() => {
                                      setWaCountryCode(c.code)
                                      setWaCountryFlag(c.flag)
                                      setShowCountryPicker(false)
                                      setCountrySearch('')
                                    }}
                                  />
                                ))}
                              </div>
                            ))
                          })()}
                        </div>
                      )}
                    </div>
                    {/* Input numéro — chiffres seulement */}
                    <div style={{ flex:1, position:'relative' }}>
                      <input
                        type="tel" inputMode="numeric"
                        placeholder="77 000 00 00"
                        value={waNumber}
                        maxLength={15}
                        aria-label={lang==='fr' ? 'Numéro WhatsApp' : lang==='en' ? 'WhatsApp number' : lang==='es' ? 'Número WhatsApp' : 'Numero WhatsApp'}
                        style={{
                          width:'100%', minHeight:44,
                          background:'var(--bg4)',
                          border:`1.5px solid ${waNumber && !/^[\d\s\-]+$/.test(waNumber) ? 'var(--danger)' : 'var(--border)'}`,
                          borderRadius:10, padding:'10px 36px 10px 13px',
                          color:'var(--text)', fontSize:13, fontFamily:'var(--font)',
                          outline:'none', transition:'border-color .15s, box-shadow .15s',
                        }}
                        onFocus={e => { e.target.style.borderColor='var(--p2)'; e.target.style.boxShadow='0 0 0 3px rgba(124,111,240,.15)' }}
                        onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }}
                        onChange={e => setWaNumber(e.target.value.replace(/[^0-9\s\-]/g, ''))}
                        onKeyDown={e => {
                          const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' ','-']
                          if (allowed.includes(e.key) || /^\d$/.test(e.key) || e.ctrlKey || e.metaKey) return
                          e.preventDefault()
                        }}
                        onPaste={e => {
                          e.preventDefault()
                          const cleaned = e.clipboardData.getData('text').replace(/[^0-9\s\-]/g, '')
                          setWaNumber(prev => (prev + cleaned).slice(0, 15))
                        }}
                      />
                      {waNumber.length > 0 && (
                        <div style={{
                          position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                          width:8, height:8, borderRadius:'50%', pointerEvents:'none',
                          background: /^[\d\s\-]{6,}$/.test(waNumber) ? 'var(--acc2)' : 'var(--danger)',
                        }} />
                      )}
                    </div>
                  </div>
                  {/* Aperçu numéro complet */}
                  {waNumber.trim().length > 0 && (
                    <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', gap:6 }}>
                      <span>{lang==='fr' ? 'Numéro complet :' : lang==='en' ? 'Full number:' : lang==='es' ? 'Número completo:' : 'Numero completo:'}</span>
                      <span style={{ fontFamily:'var(--mono)', fontWeight:'var(--fw-semibold)', color:'#25D366' }}>
                        {waCountryCode}{waNumber.replace(/\s/g, '')}
                      </span>
                    </div>
                  )}
                  {/* Message erreur */}
                  {waNumber.length > 0 && !/^[\d\s\-]{6,}$/.test(waNumber) && (
                    <div style={{ marginTop:5, fontSize:11, color:'var(--danger)', fontWeight:'var(--fw-regular)', display:'flex', gap:4, alignItems:'center' }}>
                      <AlertTriangle size={10} /> {lang==='fr' ? 'Chiffres uniquement (ex: 77 000 00 00)' : lang==='en' ? 'Digits only (ex: 77 000 00 00)' : lang==='es' ? 'Solo dígitos (ej: 77 000 00 00)' : 'Solo cifre (es: 77 000 00 00)'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Section MTN MoMo ── */}
            {isMtnMode && (
              <div style={{ padding:'14px 16px', marginBottom:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
                <div style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'#FFCC00', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontWeight:'var(--fw-bold)', fontSize:15 }}>M</span> MTN MoMo
                </div>

                {/* Idle / requesting : saisie numéro */}
                {(mtnStatus === 'idle' || mtnStatus === 'requesting') && (
                  <div>
                    <label htmlFor="mtn-phone" style={{ display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                      {lang === 'en' ? 'MTN number (e.g. 677000000)' : lang === 'es' ? 'Número MTN (ej: 677000000)' : lang === 'it' ? 'Numero MTN (es: 677000000)' : 'Numéro MTN (ex: 677000000)'}
                    </label>
                    <div style={{ display:'flex', gap:8 }}>
                      <input
                        id="mtn-phone"
                        type="tel" inputMode="numeric"
                        placeholder="677 000 000"
                        value={mtnPhone}
                        onChange={e => setMtnPhone(e.target.value.replace(/[^0-9\s\+\-]/g, ''))}
                        aria-label={lang === 'en' ? 'MTN MoMo phone number' : lang === 'es' ? 'Número MTN MoMo' : lang === 'it' ? 'Numero MTN MoMo' : 'Numéro MTN MoMo'}
                        aria-describedby={mtnError ? 'mtn-phone-error' : undefined}
                        aria-invalid={!!mtnError}
                        style={{
                          flex:1, minHeight:44, padding:'0 12px',
                          background:'var(--bg4)',
                          border:`1.5px solid ${mtnError ? 'var(--danger)' : 'var(--border)'}`,
                          borderRadius:10, color:'var(--text)', fontSize:13,
                          fontFamily:'var(--mono)', outline:'none',
                          boxSizing:'border-box' as const,
                        }}
                      />
                      <button
                        type="button"
                        disabled={!mtnPhone.trim() || mtnStatus === 'requesting'}
                        onClick={startMtnPayment}
                        style={{
                          minHeight:44, padding:'0 14px', borderRadius:10, border:'none',
                          background: (!mtnPhone.trim() || mtnStatus === 'requesting') ? 'var(--bg5)' : '#FFCC00',
                          color: (!mtnPhone.trim() || mtnStatus === 'requesting') ? 'var(--text3)' : '#1a1a1a',
                          fontWeight:'var(--fw-semibold)', fontSize:12, cursor: (!mtnPhone.trim() || mtnStatus === 'requesting') ? 'not-allowed' : 'pointer',
                          fontFamily:'inherit', whiteSpace:'nowrap' as const,
                          display:'flex', alignItems:'center', gap:5,
                        }}
                      >
                        {mtnStatus === 'requesting'
                          ? <><Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/> {lang === 'en' ? 'Sending…' : lang === 'es' ? 'Enviando…' : lang === 'it' ? 'Invio…' : 'Envoi…'}</>
                          : (lang === 'en' ? 'Send request' : lang === 'es' ? 'Enviar solicitud' : lang === 'it' ? 'Invia richiesta' : 'Envoyer la demande')}
                      </button>
                    </div>
                    {mtnError && (
                      <div id="mtn-phone-error" role="alert" style={{ marginTop:5, fontSize:11, color:'var(--danger)', fontWeight:'var(--fw-regular)', display:'flex', gap:4, alignItems:'center' }}>
                        <AlertTriangle size={10} /> {mtnError}
                      </div>
                    )}
                  </div>
                )}

                {/* Polling : spinner d'attente */}
                {mtnStatus === 'polling' && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0' }}>
                    <Loader2 size={20} style={{ animation:'spin 1s linear infinite', color:'#FFCC00', flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>
                        {lang === 'en' ? 'Waiting for customer confirmation…' : lang === 'es' ? 'Esperando confirmación del cliente…' : lang === 'it' ? 'In attesa della conferma del cliente…' : 'En attente de confirmation client…'}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>
                        {lang === 'en' ? 'Customer received USSD prompt on their phone' : lang === 'es' ? 'El cliente recibió la solicitud USSD en su teléfono' : lang === 'it' ? 'Il cliente ha ricevuto il prompt USSD sul telefono' : 'Le client a reçu la demande USSD sur son téléphone'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Failed / timeout : erreur + retry */}
                {(mtnStatus === 'failed' || mtnStatus === 'timeout') && (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 0', color:'var(--danger)', fontSize:13 }}>
                      <AlertTriangle size={14} style={{ flexShrink:0 }} />
                      {mtnStatus === 'timeout'
                        ? (lang === 'en' ? 'Payment timeout (2 min). Retry?' : lang === 'es' ? 'Tiempo de espera agotado (2 min). ¿Reintentar?' : lang === 'it' ? 'Timeout pagamento (2 min). Riprovare?' : 'Délai dépassé (2 min). Réessayer ?')
                        : (lang === 'en' ? 'Payment refused or failed.' : lang === 'es' ? 'Pago rechazado o fallido.' : lang === 'it' ? 'Pagamento rifiutato o fallito.' : 'Paiement refusé ou échoué.')}
                    </div>
                    <button
                      type="button"
                      onClick={onMtnRetry}
                      style={{
                        padding:'8px 14px', borderRadius:8, border:'none',
                        background:'rgba(255,204,0,.15)', color:'#FFCC00',
                        fontSize:12, fontWeight:'var(--fw-semibold)',
                        cursor:'pointer', fontFamily:'inherit',
                      }}
                    >
                      {lang === 'en' ? 'Retry' : lang === 'es' ? 'Reintentar' : lang === 'it' ? 'Riprova' : 'Réessayer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Section Orange Money (Campay) ── */}
            {isOrangeMode && (
              <div style={{ padding:'14px 16px', marginBottom:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
                <div style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'#FF6600', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontWeight:'var(--fw-bold)', fontSize:15 }}>OM</span> Orange Money
                </div>

                {/* Idle / requesting */}
                {(orangeStatus === 'idle' || orangeStatus === 'requesting') && (
                  <div>
                    <label htmlFor="orange-phone" style={{ display:'block', fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                      {lang === 'en' ? 'Orange number (e.g. 699000000)' : lang === 'es' ? 'Número Orange (ej: 699000000)' : lang === 'it' ? 'Numero Orange (es: 699000000)' : 'Numéro Orange (ex: 699000000)'}
                    </label>
                    <div style={{ display:'flex', gap:8 }}>
                      <input
                        id="orange-phone"
                        type="tel" inputMode="numeric"
                        placeholder="699 000 000"
                        value={orangePhone}
                        onChange={e => setOrangePhone(e.target.value.replace(/[^0-9\s\+\-]/g, ''))}
                        aria-label={lang === 'en' ? 'Orange Money phone number' : lang === 'es' ? 'Número Orange Money' : lang === 'it' ? 'Numero Orange Money' : 'Numéro Orange Money'}
                        aria-describedby={orangeError ? 'orange-phone-error' : undefined}
                        aria-invalid={!!orangeError}
                        style={{
                          flex:1, minHeight:44, padding:'0 12px',
                          background:'var(--bg4)',
                          border:`1.5px solid ${orangeError ? 'var(--danger)' : 'var(--border)'}`,
                          borderRadius:10, color:'var(--text)', fontSize:13,
                          fontFamily:'var(--mono)', outline:'none',
                          boxSizing:'border-box' as const,
                        }}
                      />
                      <button
                        type="button"
                        disabled={!orangePhone.trim() || orangeStatus === 'requesting'}
                        onClick={startOrangePayment}
                        style={{
                          minHeight:44, padding:'0 14px', borderRadius:10, border:'none',
                          background: (!orangePhone.trim() || orangeStatus === 'requesting') ? 'var(--bg5)' : '#FF6600',
                          color: (!orangePhone.trim() || orangeStatus === 'requesting') ? 'var(--text3)' : '#fff',
                          fontWeight:'var(--fw-semibold)', fontSize:12, cursor: (!orangePhone.trim() || orangeStatus === 'requesting') ? 'not-allowed' : 'pointer',
                          fontFamily:'inherit', whiteSpace:'nowrap' as const,
                          display:'flex', alignItems:'center', gap:5,
                        }}
                      >
                        {orangeStatus === 'requesting'
                          ? <><Loader2 size={12} style={{ animation:'spin 1s linear infinite' }}/> {lang === 'en' ? 'Sending…' : lang === 'es' ? 'Enviando…' : lang === 'it' ? 'Invio…' : 'Envoi…'}</>
                          : (lang === 'en' ? 'Send request' : lang === 'es' ? 'Enviar solicitud' : lang === 'it' ? 'Invia richiesta' : 'Envoyer la demande')}
                      </button>
                    </div>
                    {orangeError && (
                      <div id="orange-phone-error" role="alert" style={{ marginTop:5, fontSize:11, color:'var(--danger)', fontWeight:'var(--fw-regular)', display:'flex', gap:4, alignItems:'center' }}>
                        <AlertTriangle size={10} /> {orangeError}
                      </div>
                    )}
                  </div>
                )}

                {/* Polling */}
                {orangeStatus === 'polling' && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0' }}>
                    <Loader2 size={20} style={{ animation:'spin 1s linear infinite', color:'#FF6600', flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>
                        {lang === 'en' ? 'Waiting for customer confirmation…' : lang === 'es' ? 'Esperando confirmación del cliente…' : lang === 'it' ? 'In attesa della conferma del cliente…' : 'En attente de confirmation client…'}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>
                        {lang === 'en' ? 'Customer received Orange Money prompt on their phone' : lang === 'es' ? 'El cliente recibió la solicitud en su teléfono' : lang === 'it' ? 'Il cliente ha ricevuto la richiesta sul telefono' : 'Le client a reçu la demande Orange Money sur son téléphone'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Failed / timeout */}
                {(orangeStatus === 'failed' || orangeStatus === 'timeout') && (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 0', color:'var(--danger)', fontSize:13 }}>
                      <AlertTriangle size={14} style={{ flexShrink:0 }} />
                      {orangeStatus === 'timeout'
                        ? (lang === 'en' ? 'Payment timeout (2 min). Retry?' : lang === 'es' ? 'Tiempo de espera agotado (2 min). ¿Reintentar?' : lang === 'it' ? 'Timeout pagamento (2 min). Riprovare?' : 'Délai dépassé (2 min). Réessayer ?')
                        : (lang === 'en' ? 'Payment refused or failed.' : lang === 'es' ? 'Pago rechazado o fallido.' : lang === 'it' ? 'Pagamento rifiutato o fallito.' : 'Paiement refusé ou échoué.')}
                    </div>
                    <button
                      type="button"
                      onClick={onOrangeRetry}
                      style={{
                        padding:'8px 14px', borderRadius:8, border:'none',
                        background:'rgba(255,102,0,.15)', color:'#FF6600',
                        fontSize:12, fontWeight:'var(--fw-semibold)',
                        cursor:'pointer', fontFamily:'inherit',
                      }}
                    >
                      {lang === 'en' ? 'Retry' : lang === 'es' ? 'Reintentar' : lang === 'it' ? 'Riprova' : 'Réessayer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Section Carte Campay (QR / lien hébergé) ── */}
            {isCardMode && (
              <div style={{ padding:'14px 16px', marginBottom:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
                <div style={{ fontSize:13, fontWeight:'var(--fw-semibold)', color:'#5B4EE8', marginBottom:10, display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontWeight:'var(--fw-bold)', fontSize:15 }}>💳</span>
                  {lang === 'en' ? 'Card payment (Visa / Mastercard)' : lang === 'es' ? 'Pago con tarjeta (Visa / Mastercard)' : lang === 'it' ? 'Pagamento carta (Visa / Mastercard)' : 'Paiement carte (Visa / Mastercard)'}
                </div>

                {/* Idle : bouton de génération du lien */}
                {cardStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={startCardPayment}
                    style={{
                      width:'100%', minHeight:44, borderRadius:10, border:'none',
                      background:'#5B4EE8', color:'#fff',
                      fontWeight:'var(--fw-semibold)', fontSize:13,
                      cursor:'pointer', fontFamily:'inherit',
                    }}
                  >
                    {lang === 'en' ? 'Generate payment QR' : lang === 'es' ? 'Generar QR de pago' : lang === 'it' ? 'Genera QR di pagamento' : 'Générer le QR de paiement'}
                  </button>
                )}

                {/* Requesting : spinner */}
                {cardStatus === 'requesting' && (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0' }}>
                    <Loader2 size={20} style={{ animation:'spin 1s linear infinite', color:'#5B4EE8', flexShrink:0 }} />
                    <span style={{ fontSize:13, color:'var(--text3)' }}>
                      {lang === 'en' ? 'Generating payment link…' : lang === 'es' ? 'Generando enlace de pago…' : lang === 'it' ? 'Generazione link di pagamento…' : 'Génération du lien de paiement…'}
                    </span>
                  </div>
                )}

                {/* Polling : QR code + lien + instruction */}
                {cardStatus === 'polling' && (
                  <div>
                    {cardPaymentUrl?.includes('SANDBOX-CARD-') ? (
                      /* Sandbox : lien fictif → indicateur mode test, pas de QR */
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, marginBottom:10 }}>
                        <TestTube size={18} style={{ color:'var(--text2)', flexShrink:0 }} />
                        <span style={{ fontSize:12, color:'var(--text2)', fontWeight:'var(--fw-semibold)' }}>
                          {lang === 'en' ? 'Sandbox mode — payment simulated automatically' : lang === 'es' ? 'Modo sandbox — pago simulado automáticamente' : lang === 'it' ? 'Modalità sandbox — pagamento simulato automaticamente' : 'Mode sandbox — paiement simulé automatiquement'}
                        </span>
                      </div>
                    ) : (
                      /* Production : QR réel + lien partageable */
                      <>
                        <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                          {cardQrDataUrl
                            ? <img src={cardQrDataUrl} alt="QR paiement carte" width={160} height={160} style={{ borderRadius:8, display:'block' }} />
                            : <div style={{ width:160, height:160, background:'var(--bg4)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <Loader2 size={24} style={{ animation:'spin 1s linear infinite', color:'#5B4EE8' }} />
                              </div>
                          }
                        </div>
                        {cardPaymentUrl && (
                          <div style={{ textAlign:'center', marginBottom:8 }}>
                            <a href={cardPaymentUrl} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize:11, color:'#5B4EE8', wordBreak:'break-all' as const }}>
                              {lang === 'en' ? 'Or share this link' : lang === 'es' ? 'O comparta este enlace' : lang === 'it' ? 'O condividi questo link' : 'Ou partagez ce lien'}
                            </a>
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 0', color:'var(--text3)', fontSize:12 }}>
                      <Loader2 size={14} style={{ animation:'spin 1s linear infinite', flexShrink:0 }} />
                      {lang === 'en' ? 'Scan QR or share link — waiting for payment…' : lang === 'es' ? 'Escanee el QR o comparta el enlace — esperando pago…' : lang === 'it' ? 'Scansiona il QR o condividi il link — in attesa del pagamento…' : 'Scannez le QR ou partagez le lien — en attente du paiement…'}
                    </div>
                  </div>
                )}

                {/* Failed / timeout */}
                {(cardStatus === 'failed' || cardStatus === 'timeout') && (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 0', color:'var(--danger)', fontSize:13 }}>
                      <AlertTriangle size={14} style={{ flexShrink:0 }} />
                      {cardStatus === 'timeout'
                        ? (lang === 'en' ? 'Payment timeout (2 min). Retry?' : lang === 'es' ? 'Tiempo de espera agotado (2 min). ¿Reintentar?' : lang === 'it' ? 'Timeout pagamento (2 min). Riprovare?' : 'Délai dépassé (2 min). Réessayer ?')
                        : (lang === 'en' ? 'Payment failed or cancelled.' : lang === 'es' ? 'Pago fallido o cancelado.' : lang === 'it' ? 'Pagamento fallito o annullato.' : 'Paiement échoué ou annulé.')}
                    </div>
                    <button
                      type="button"
                      onClick={onCardRetry}
                      style={{
                        padding:'8px 14px', borderRadius:8, border:'none',
                        background:'rgba(91,78,232,.15)', color:'#5B4EE8',
                        fontSize:12, fontWeight:'var(--fw-semibold)',
                        cursor:'pointer', fontFamily:'inherit',
                      }}
                    >
                      {lang === 'en' ? 'Retry' : lang === 'es' ? 'Reintentar' : lang === 'it' ? 'Riprova' : 'Réessayer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {/* PayDunya (Wave / OM UEMOA) : lance la facture hébergée (overlay QR + polling) */}
              {paydunyaMode && (
                <button
                  type="button"
                  onClick={() => { setShowModal(false); onPaydunyaStart?.() }}
                  disabled={isSaving}
                  style={{
                    flex: 1, minHeight: 44, padding: '12px', borderRadius: 10, border: 'none',
                    background: payMode === 'wave' ? '#1B9AF5' : '#FF6600',
                    color: '#fff', fontSize: 14, fontWeight: 'var(--fw-semibold)',
                    cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--sh-md)',
                  }}
                >
                  {(lang === 'en' ? 'Confirm via ' : lang === 'es' ? 'Confirmar vía ' : lang === 'it' ? 'Conferma via ' : 'Confirmer via ') + (payMode === 'wave' ? 'Wave' : 'Orange Money')} — {fmt(total)}
                </button>
              )}
              {!isMtnMode && !isOrangeMode && !isCardMode && !paydunyaMode && (
                <button
                  onClick={() => confirmSale()}
                  disabled={blocked}
                  title={!cashOK ? (lang==='en' ? 'Enter the amount received' : lang==='es' ? 'Ingrese el monto recibido' : lang==='it' ? "Inserire l'importo ricevuto" : 'Saisissez le montant reçu') : undefined}
                  style={{
                    flex: 1,
                    background: blocked ? 'var(--bg4)' : 'var(--grad-p)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '14px',
                    minHeight: 48,
                    fontSize: 15,
                    fontWeight: 'var(--fw-semibold)',
                    color: blocked ? 'var(--text3)' : '#fff',
                    cursor: blocked ? 'not-allowed' : 'pointer',
                    opacity: blocked ? 0.6 : 1,
                    fontFamily: 'inherit',
                    boxShadow: blocked ? 'none' : 'var(--sh-md)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {waSending
                    ? <><Smartphone size={14} /> {lang==='fr' ? 'Envoi WhatsApp…' : lang==='en' ? 'Sending WhatsApp…' : lang==='es' ? 'Enviando WhatsApp…' : 'Invio WhatsApp…'}</>
                    : isSaving
                    ? <><Loader2 size={14} style={{ animation:'spin 1s linear infinite', flexShrink:0 }} /> {lang==='fr' ? 'Enregistrement…' : lang==='en' ? 'Saving…' : lang==='es' ? 'Guardando…' : 'Salvataggio…'}</>
                    : <><Check size={16} /> {lang === 'en' ? 'Confirm payment' : lang === 'es' ? 'Validar el cobro' : lang === 'it' ? "Conferma l'incasso" : "Valider l'encaissement"}</>}
                </button>
              )}
              {/* Boutons « Ticket » et « Facture » retirés de ce modal de CONFIRMATION : l'impression
                  du ticket et la facture PDF n'ont de sens qu'APRÈS création de la vente. Le ticket est
                  proposé dans le modal de SUCCÈS (POSSuccessModal), la facture dans l'historique. */}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sélecteur de méthode (paiement mixte) — vit dans la feuille d'encaissement ──
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
