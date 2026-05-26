import { X, Smartphone, Printer, FileText, CheckCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { t, formatInCurrency } from '@/stores/appStore'
import { generateInvoice } from '@/utils/export'
import { COUNTRY_CODES, CountryItem } from '@/components/pos/posShared'

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
  printTicket: () => void
  discount: any; payMode: string
}

export default function POSModals({ showDiscountModal, setShowDiscountModal, discountForm, setDiscountForm, fmt, subtotalBeforeDiscount, setDiscount, showCloseModal, setShowCloseModal, ct, cashierOpenedAt, locale, cashierOpeningFund, cashierSessionTx, cashierSessionCA, closeCashier, setOpeningFundInput, currency, showModal, setShowModal, cart, total, sendWhatsApp, setSendWhatsApp, waCountryFlag, waCountryCode, setWaCountryCode, setWaCountryFlag, showCountryPicker, setShowCountryPicker, countrySearch, setCountrySearch, waNumber, setWaNumber, lang, confirmSale, isSaving, waSending, printTicket, discount, payMode }: POSModalsProps) {
  return (
    <>
      {showDiscountModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowDiscountModal(false)}>
          <div className="modal-box" style={{ maxWidth:420 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>🏷️ Appliquer une remise</h3>
              <button className="mini-btn" onClick={() => setShowDiscountModal(false)}>✕</button>
            </div>

            {/* Type */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:8 }}>Type de remise</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {([
                  { type:'percent', label:'Pourcentage (%)', icon:'%' },
                  { type:'amount',  label:'Montant fixe',    icon:'F' },
                ] as { type:'percent'|'amount'; label:string; icon:string }[]).map(rt => (
                  <button key={rt.type} onClick={() => setDiscountForm(f => ({...f, type:rt.type}))} style={{
                    padding:'12px', borderRadius:10, cursor:'pointer', fontFamily:'var(--font)',
                    fontSize:13, fontWeight:600, transition:'all .15s',
                    background: discountForm.type === rt.type ? 'rgba(91,78,232,.15)' : 'var(--bg3)',
                    border:`1.5px solid ${discountForm.type === rt.type ? 'var(--p2)' : 'var(--border)'}`,
                    color: discountForm.type === rt.type ? 'var(--p2)' : 'var(--text2)',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  }}>
                    <span style={{ fontSize:22, fontWeight:900 }}>{rt.icon}</span>
                    {rt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Remises rapides % */}
            {discountForm.type === 'percent' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:8 }}>Remise rapide</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[5,10,15,20,25,30].map(pct => (
                    <button key={pct} onClick={() => setDiscountForm(f => ({...f, value:pct}))} style={{
                      padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:700,
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
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                {discountForm.type === 'percent' ? 'Pourcentage personnalisé' : 'Montant de la remise'}
              </label>
              <div style={{ position:'relative' }}>
                <input className="input" type="number"
                  placeholder={discountForm.type === 'percent' ? 'Ex: 12' : 'Ex: 5000'}
                  value={discountForm.value || ''}
                  onChange={e => setDiscountForm(f => ({...f, value:+e.target.value}))}
                  style={{ paddingRight:50 }} />
                <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:13, fontWeight:700, color:'var(--text3)' }}>
                  {discountForm.type === 'percent' ? '%' : 'F'}
                </span>
              </div>
              {discountForm.value > 0 && (
                <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.2)', borderRadius:8, fontSize:12, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--text2)' }}>Remise sur {fmt(subtotalBeforeDiscount)}</span>
                  <span style={{ color:'var(--acc2)', fontWeight:700, fontFamily:'var(--mono)' }}>
                    − {discountForm.type === 'percent'
                      ? fmt(subtotalBeforeDiscount * discountForm.value / 100)
                      : fmt(discountForm.value)}
                  </span>
                </div>
              )}
            </div>

            {/* Motif */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>{lang === 'en' ? 'Reason (optional)' : lang === 'es' ? 'Motivo (opcional)' : lang === 'it' ? 'Motivo (opzionale)' : 'Motif (optionnel)'}</label>
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
                  toast.success(`🏷️ Remise de ${discountForm.type === 'percent' ? discountForm.value + ' %' : fmt(discountForm.value)} appliquée`)
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target===e.currentTarget && setShowCloseModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }}>
            <h3 style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:20 }}>
              {ct.close_title}
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
              {[
                { label: ct.open_time,    value: cashierOpenedAt ? new Date(cashierOpenedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) : '--:--' },
                { label: ct.close_time,   value: new Date().toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) },
                { label: ct.initial_fund, value: fmt(cashierOpeningFund) },
                { label: ct.transactions, value: String(cashierSessionTx) },
                { label: ct.ca_cashed,    value: fmt(cashierSessionCA) },
                { label: ct.total_cash,   value: fmt(cashierOpeningFund + cashierSessionCA) },
              ].map(s => (
                <div key={s.label} style={{
                  background:'var(--bg3)', border:'1px solid var(--border)',
                  borderRadius:10, padding:'10px 14px',
                }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px' }}>{s.label}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', fontFamily:'var(--mono)' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                {ct.counted_label}
              </label>
              <input className="input" type="number"
                placeholder={ct.counted_placeholder}
                id="counted-amount"
                style={{ fontSize:14 }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => {
                  // counted et expected sont dans la devise configurée
                  const counted = parseFloat((document.getElementById('counted-amount') as HTMLInputElement)?.value || '0')
                  const expected = cashierOpeningFund + cashierSessionCA
                  const diff = counted - expected
                  const openedTime = cashierOpenedAt ? new Date(cashierOpenedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) : '--:--'
                  const win = window.open('', '_blank', 'width=400,height=600')
                  if (win) {
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ct.close_title}</title>
                    <style>body{font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto;}
                    .center{text-align:center;}.bold{font-weight:bold;}.big{font-size:16px;font-weight:900;}
                    .divider{border-top:1px dashed #000;margin:8px 0;}.row{display:flex;justify-content:space-between;margin:4px 0;}
                    .ok{color:green;}.err{color:red;}</style></head><body>
                    <div class="center"><div class="big">HabaShop</div><div>${ct.close_title.toUpperCase()}</div>
                    <div>${ct.cashier_label} — ${new Date().toLocaleDateString(locale)}</div></div>
                    <div class="divider"></div>
                    <div class="row"><span>${ct.open_time}:</span><span>${openedTime}</span></div>
                    <div class="row"><span>${ct.close_time}:</span><span>${new Date().toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}</span></div>
                    <div class="row"><span>Caissier:</span><span>Nelson D.</span></div>
                    <div class="divider"></div>
                    <div class="row"><span>${ct.initial_fund}:</span><span>${fmt(cashierOpeningFund)}</span></div>
                    <div class="row"><span>${ct.transactions}:</span><span>${cashierSessionTx}</span></div>
                    <div class="row bold"><span>${ct.ca_cashed}:</span><span>${fmt(cashierSessionCA)}</span></div>
                    <div class="divider"></div>
                    <div class="row bold"><span>Attendu:</span><span>${fmt(expected)}</span></div>
                    <div class="row bold"><span>${ct.counted_label.split(' ')[0]}:</span><span>${formatInCurrency(counted, currency)}</span></div>
                    <div class="row bold ${diff >= 0 ? 'ok' : 'err'}"><span>Écart:</span><span>${diff >= 0 ? '+' : ''}${formatInCurrency(Math.abs(diff), currency)}</span></div>
                    <div class="divider"></div>
                    <div class="center" style="margin-top:20px;"><div>________________________</div><div>Signature caissier</div></div>
                    <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},300)}<\/script>
                    </body></html>`)
                    win.document.close()
                  }
                  closeCashier()
                  setOpeningFundInput('')
                  setShowCloseModal(false)
                  toast.success('Caisse fermée — Rapport imprimé')
                }}
                className="topbar-btn"
                style={{ flex:1, justifyContent:'center', background:'linear-gradient(135deg,var(--danger),#dc2626)' }}
              >{ct.confirm_close}</button>
              <button className="mini-btn" style={{ padding:'10px 16px' }}
                onClick={() => setShowCloseModal(false)}>{ct.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal-backdrop" role="dialog" aria-modal="true"
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
                }}><CheckCircle size={20} style={{ color:'var(--acc2)' }} /></div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    {t('pos_confirm_sale')}
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
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('pos_total')}</span>
              <span style={{
                fontSize: 20,
                fontWeight: 900,
                color: 'var(--acc2)',
                fontFamily: 'var(--mono)',
              }}>{fmt(total)}</span>
            </div>

            {/* WhatsApp toggle */}
            <div style={{ padding:'14px 16px', marginBottom:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: sendWhatsApp ? 12 : 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Smartphone size={20} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                      {lang === 'fr' ? 'Envoyer le ticket WhatsApp' : lang === 'en' ? 'Send WhatsApp receipt' : lang === 'es' ? 'Enviar ticket WhatsApp' : 'Invia scontrino WhatsApp'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {lang === 'fr' ? 'Le client recevra son reçu sur WhatsApp' : lang === 'en' ? 'Customer receives receipt on WhatsApp' : lang === 'es' ? 'El cliente recibirá su recibo por WhatsApp' : 'Il cliente riceverà la ricevuta su WhatsApp'}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setSendWhatsApp(!sendWhatsApp)} style={{
                  width:44, height:24, borderRadius:99, flexShrink:0,
                  background: sendWhatsApp ? '#25D366' : 'var(--bg4)',
                  border:'none', cursor:'pointer', position:'relative', transition:'background .2s',
                }}>
                  <div style={{
                    position:'absolute', top:2, width:20, height:20,
                    left: sendWhatsApp ? 22 : 2,
                    borderRadius:'50%', background:'#fff', transition:'left .2s',
                    boxShadow:'0 2px 4px rgba(0,0,0,.2)',
                  }} />
                </button>
              </div>
              {sendWhatsApp && (
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>
                    {lang==='fr' ? 'Numéro WhatsApp (ticket)' : lang==='en' ? 'WhatsApp number (receipt)' : lang==='es' ? 'Número WhatsApp (recibo)' : 'Numero WhatsApp (ricevuta)'}
                  </label>
                  <div style={{ display:'flex', gap:6, alignItems:'stretch' }}>
                    {/* Sélecteur indicatif — premium */}
                    <div style={{ position:'relative', flexShrink:0 }} data-phone-picker>
                      <button
                        type="button"
                        data-phone-picker
                        onClick={() => { setShowCountryPicker(p => !p); setCountrySearch('') }}
                        style={{
                          display:'flex', alignItems:'center', gap:6,
                          minHeight:42, minWidth:90, padding:'0 10px',
                          background:'var(--bg4)', border:'1.5px solid var(--border)',
                          borderRadius:10, cursor:'pointer', color:'var(--text)',
                          fontSize:13, fontFamily:'var(--font)', transition:'border-color .15s',
                        }}
                      >
                        <span style={{ fontSize:18 }}>{waCountryFlag}</span>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700 }}>{waCountryCode}</span>
                        <span style={{ fontSize:9, color:'var(--text3)', marginLeft:2 }}>▼</span>
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
                                <div style={{ padding:'6px 12px 2px', fontSize:9, fontWeight:900, textTransform:'uppercase', letterSpacing:'.8px', color:'var(--text3)' }}>
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
                          width:'100%', minHeight:42,
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
                      <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'#25D366' }}>
                        {waCountryCode}{waNumber.replace(/\s/g, '')}
                      </span>
                    </div>
                  )}
                  {/* Message erreur */}
                  {waNumber.length > 0 && !/^[\d\s\-]{6,}$/.test(waNumber) && (
                    <div style={{ marginTop:5, fontSize:10, color:'var(--danger)', fontWeight:600, display:'flex', gap:4, alignItems:'center' }}>
                      <AlertTriangle size={10} /> {lang==='fr' ? 'Chiffres uniquement (ex: 77 000 00 00)' : lang==='en' ? 'Digits only (ex: 77 000 00 00)' : lang==='es' ? 'Solo dígitos (ej: 77 000 00 00)' : 'Solo cifre (es: 77 000 00 00)'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmSale}
                disabled={isSaving || waSending}
                style={{
                  flex: 1,
                  background: (isSaving || waSending) ? 'var(--bg4)' : 'linear-gradient(135deg, var(--acc2), #059669)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: (isSaving || waSending) ? 'var(--text3)' : '#fff',
                  cursor: (isSaving || waSending) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: (isSaving || waSending) ? 'none' : '0 4px 16px rgba(14,196,126,.35)',
                }}
              >
                {waSending
                  ? <><Smartphone size={14} /> {lang==='fr' ? 'Envoi WhatsApp…' : lang==='en' ? 'Sending WhatsApp…' : lang==='es' ? 'Enviando WhatsApp…' : 'Invio WhatsApp…'}</>
                  : isSaving
                  ? (lang==='fr' ? 'Enregistrement…' : lang==='en' ? 'Saving…' : lang==='es' ? 'Guardando…' : 'Salvataggio…')
                  : t('pos_validate')}
              </button>
              <button
                onClick={() => { printTicket(); confirmSale() }}
                className="mini-btn"
                style={{ padding: '12px 16px', fontSize: 13 }}
              ><Printer size={13} /> Ticket</button>
              <button
                onClick={() => {
                  generateInvoice({
                    type: 'facture',
                    lang,
                    items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, emoji: i.emoji })),
                    discount: discount ?? undefined,
                    paymentMode: payMode,
                  })
                }}
                className="mini-btn"
                style={{ padding: '12px 14px', fontSize: 13 }}
              ><FileText size={13} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
