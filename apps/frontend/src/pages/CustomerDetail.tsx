import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Phone, Mail, MapPin, ShoppingCart, Banknote, CreditCard, AlertTriangle, CheckCircle, X, Plus, Clock, Receipt, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFormatAmount } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { customersApi } from '@/lib/api'

interface CustomerDetailData {
  id: string; name: string; type: string
  phone?: string; email?: string; address?: string
  totalRevenue: number
  loyaltyPoints: number
  creditBalance: number
  creditLimit: number | null
  createdAt: string
  stats: { nbSales: number; nbPayments: number; lastSaleAt: string | null }
}

interface TimelineItem {
  type: 'sale' | 'payment'
  id: string
  date: string
  amount: number
  amountPaid?: number
  due?: number
  paymentStatus?: 'paid' | 'credit' | 'partial'
  paymentMode?: string
  saleId?: string | null
  note?: string | null
  items?: { name?: string; qty: number; total: number }[]
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { i, lang } = useI18n()
  const fmt = useFormatAmount()
  const [customer, setCustomer] = useState<CustomerDetailData | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'sales' | 'payments'>('all')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMode: 'cash', saleId: '', note: '' })
  const [saving, setSaving] = useState(false)
  const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' }
  const locale = LOCALE_MAP[lang] ?? 'fr-FR'

  const refresh = async () => {
    if (!id) return
    try {
      const [c, t] = await Promise.all([
        customersApi.get(id),
        customersApi.transactions(id, { limit: 100 }),
      ])
      setCustomer(c as CustomerDetailData)
      setTimeline(t as TimelineItem[])
    } catch (err: any) {
      toast.error(err?.message ?? i('Erreur de chargement', 'Loading error', 'Error de carga', 'Errore di caricamento'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [id])

  const filtered = useMemo(() => {
    if (tab === 'sales')    return timeline.filter(t => t.type === 'sale')
    if (tab === 'payments') return timeline.filter(t => t.type === 'payment')
    return timeline
  }, [timeline, tab])

  const debtorSales = useMemo(
    () => timeline.filter(t => t.type === 'sale' && (t.paymentStatus === 'credit' || t.paymentStatus === 'partial') && (t.due ?? 0) > 0),
    [timeline],
  )

  const submitPayment = async () => {
    if (!id || !customer) return
    const amount = parseFloat(paymentForm.amount) || 0
    if (amount <= 0) {
      toast.error(i('Montant invalide', 'Invalid amount', 'Importe no válido', 'Importo non valido'))
      return
    }
    setSaving(true)
    try {
      await customersApi.recordPayment(id, {
        amount,
        paymentMode: paymentForm.paymentMode,
        saleId: paymentForm.saleId || null,
        note: paymentForm.note || undefined,
      })
      toast.success(i('Paiement enregistré', 'Payment recorded', 'Pago registrado', 'Pagamento registrato'))
      setShowPaymentModal(false)
      setPaymentForm({ amount: '', paymentMode: 'cash', saleId: '', note: '' })
      await refresh()
    } catch (err: any) {
      toast.error(err?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>
        {i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}
      </div>
    )
  }
  if (!customer) {
    return (
      <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>
        {i('Client introuvable', 'Customer not found', 'Cliente no encontrado', 'Cliente non trovato')}
      </div>
    )
  }

  const debt = customer.creditBalance
  const debtColor = debt > 0 ? 'var(--warn)' : debt < 0 ? 'var(--acc2)' : 'var(--text3)'
  const debtBg    = debt > 0 ? 'rgba(245,158,11,.12)' : debt < 0 ? 'rgba(0,208,132,.12)' : 'var(--bg3)'
  const initial   = (customer.name ?? '?').charAt(0).toUpperCase()

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button
          onClick={() => navigate('/app/customers')}
          style={{
            display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
            background:'var(--bg3)', border:'1px solid var(--border)',
            borderRadius:8, color:'var(--text2)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit',
          }}
        >
          <ArrowLeft size={14} /> {i('Retour', 'Back', 'Volver', 'Indietro')}
        </button>
        <button
          onClick={() => setShowPaymentModal(true)}
          style={{
            marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
            background:'linear-gradient(135deg,var(--p),var(--p2))', border:'none', borderRadius:8,
            color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
            boxShadow:'0 4px 12px rgba(91,78,232,.3)',
          }}
        >
          <Plus size={14} /> {i('Enregistrer un paiement', 'Record a payment', 'Registrar un pago', 'Registra un pagamento')}
        </button>
      </div>

      {/* Profil card */}
      <div style={{
        background:'var(--card)', border:'1px solid var(--border)', borderRadius:14,
        padding:20, marginBottom:16, display:'flex', alignItems:'center', gap:18,
      }}>
        <div style={{
          width:72, height:72, borderRadius:'50%',
          background:'linear-gradient(135deg,var(--p),var(--p2))',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#fff', fontSize:28, fontWeight:900, flexShrink:0,
        }}>{initial}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:0 }}>{customer.name}</h1>
            <span style={{
              padding:'3px 10px', borderRadius:99,
              background: debtBg, color: debtColor,
              fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px',
              display:'flex', alignItems:'center', gap:4,
            }}>
              {debt > 0 ? <AlertTriangle size={11} /> : debt < 0 ? <CheckCircle size={11} /> : <CheckCircle size={11} />}
              {debt > 0
                ? `${i('Solde dû', 'Outstanding', 'Saldo pendiente', 'Saldo dovuto')}: ${fmt(debt)}`
                : debt < 0
                  ? `${i('Avoir', 'Credit', 'Crédito a favor', 'Credito a favore')}: ${fmt(Math.abs(debt))}`
                  : i('Soldé', 'Settled', 'Saldado', 'Saldato')}
            </span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:14, fontSize:12, color:'var(--text3)' }}>
            {customer.phone   && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Phone size={12} /> {customer.phone}</span>}
            {customer.email   && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Mail size={12} /> {customer.email}</span>}
            {customer.address && <span style={{ display:'flex', alignItems:'center', gap:4 }}><MapPin size={12} /> {customer.address}</span>}
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><User size={12} /> {customer.type}</span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginBottom:16 }}>
        {[
          { icon: <ShoppingCart size={16} />, label: i('Total ventes', 'Total sales', 'Ventas totales', 'Vendite totali'), value: fmt(customer.totalRevenue), color:'var(--acc3)' },
          { icon: <AlertTriangle size={16} />, label: i('Dette actuelle', 'Current debt', 'Deuda actual', 'Debito attuale'), value: fmt(Math.max(0, debt)), color: debt > 0 ? 'var(--warn)' : 'var(--text3)' },
          { icon: <CreditCard size={16} />, label: i('Plafond crédit', 'Credit limit', 'Límite de crédito', 'Limite di credito'), value: customer.creditLimit != null ? fmt(customer.creditLimit) : i('Illimité', 'Unlimited', 'Sin límite', 'Illimitato'), color:'var(--p2)' },
          { icon: <Receipt size={16} />, label: i('Nombre de ventes', 'Sales count', 'Nº ventas', 'N. vendite'), value: String(customer.stats.nbSales), color:'var(--text2)' },
        ].map((k, idx) => (
          <div key={idx} style={{
            background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, color:'var(--text3)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>
              <span style={{ color: k.color }}>{k.icon}</span> {k.label}
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:'var(--text)', fontFamily:'var(--mono)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display:'flex', gap:6, marginBottom:12, padding:4,
        background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, width:'fit-content',
      }}>
        {([
          { id: 'all',      label: i('Toutes', 'All', 'Todas', 'Tutte') },
          { id: 'sales',    label: i('Ventes', 'Sales', 'Ventas', 'Vendite') },
          { id: 'payments', label: i('Paiements', 'Payments', 'Pagos', 'Pagamenti') },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'7px 14px', borderRadius:7, fontSize:12, fontWeight:700,
            background: tab === t.id ? 'var(--card)' : 'transparent',
            border: 'none', color: tab === t.id ? 'var(--text)' : 'var(--text3)',
            cursor:'pointer', fontFamily:'inherit',
            boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,.2)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Timeline */}
      <div style={{
        background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
            {i('Aucune transaction', 'No transactions', 'Sin transacciones', 'Nessuna transazione')}
          </div>
        ) : filtered.map((t, idx) => {
          const isPayment = t.type === 'payment'
          const color = isPayment ? 'var(--acc2)' : t.paymentStatus === 'paid' ? 'var(--acc3)' : 'var(--warn)'
          const Icon  = isPayment ? Wallet : Receipt
          return (
            <div key={`${t.type}-${t.id}-${idx}`} style={{
              display:'flex', alignItems:'flex-start', gap:14, padding:'14px 18px',
              borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width:36, height:36, borderRadius:'50%',
                background:`${color === 'var(--acc2)' ? 'rgba(0,208,132,.15)' : color === 'var(--acc3)' ? 'rgba(0,184,255,.15)' : 'rgba(245,158,11,.15)'}`,
                display:'flex', alignItems:'center', justifyContent:'center', color, flexShrink:0,
              }}><Icon size={16} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4, gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>
                    {isPayment
                      ? i('Paiement reçu', 'Payment received', 'Pago recibido', 'Pagamento ricevuto')
                      : t.paymentStatus === 'paid'
                        ? i('Vente comptant', 'Cash sale', 'Venta al contado', 'Vendita in contanti')
                        : t.paymentStatus === 'credit'
                          ? i('Vente à crédit', 'Credit sale', 'Venta a crédito', 'Vendita a credito')
                          : i('Vente avec acompte', 'Sale with down payment', 'Venta con anticipo', 'Vendita con acconto')}
                  </span>
                  <span style={{ fontSize:14, fontWeight:900, color, fontFamily:'var(--mono)' }}>
                    {isPayment ? '+ ' : ''}{fmt(t.amount)}
                  </span>
                </div>
                <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text3)', flexWrap:'wrap' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                    <Clock size={10} /> {new Date(t.date).toLocaleString(locale, { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </span>
                  {t.paymentMode && <span>{t.paymentMode}</span>}
                  {!isPayment && t.paymentStatus !== 'paid' && (t.due ?? 0) > 0 && (
                    <span style={{ color:'var(--warn)', fontWeight:700 }}>
                      {i('Reste dû', 'Remaining', 'Pendiente', 'Resto')}: {fmt(t.due ?? 0)}
                    </span>
                  )}
                  {t.note && <span style={{ fontStyle:'italic' }}>« {t.note} »</span>}
                </div>
                {!isPayment && t.items && t.items.length > 0 && (
                  <div style={{ marginTop:6, fontSize:11, color:'var(--text2)' }}>
                    {t.items.slice(0,3).map((it, i) => (
                      <span key={i}>{it.name ?? '—'} ×{it.qty}{i < Math.min(t.items!.length, 3) - 1 ? ', ' : ''}</span>
                    ))}
                    {t.items.length > 3 && <span> +{t.items.length - 3}</span>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Enregistrer paiement */}
      {showPaymentModal && (
        <div onClick={() => !saving && setShowPaymentModal(false)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'var(--card)', border:'1px solid var(--border)', borderRadius:14,
            padding:24, width:'100%', maxWidth:480,
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text)', margin:0 }}>
                {i('Enregistrer un paiement', 'Record a payment', 'Registrar un pago', 'Registra un pagamento')}
              </h2>
              <button onClick={() => setShowPaymentModal(false)} disabled={saving} style={{
                background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:4,
              }}><X size={20} /></button>
            </div>

            <div style={{
              padding:'10px 14px', borderRadius:8, marginBottom:14,
              background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.25)',
              display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12,
            }}>
              <span style={{ color:'var(--text2)', fontWeight:600 }}>
                {i('Dette actuelle', 'Current debt', 'Deuda actual', 'Debito attuale')}
              </span>
              <span style={{ color:'var(--warn)', fontWeight:900, fontFamily:'var(--mono)' }}>{fmt(Math.max(0, debt))}</span>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>
                {i('Montant', 'Amount', 'Importe', 'Importo')} *
              </label>
              <input className="input" type="number" value={paymentForm.amount}
                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="0" style={{ fontSize:15, textAlign:'right' }} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>
                {i('Mode de paiement', 'Payment mode', 'Modo de pago', 'Modo di pagamento')} *
              </label>
              <select className="input" value={paymentForm.paymentMode}
                onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}>
                <option value="cash">{i('Espèces', 'Cash', 'Efectivo', 'Contanti')}</option>
                <option value="card">{i('Carte', 'Card', 'Tarjeta', 'Carta')}</option>
                <option value="wave">Wave</option>
                <option value="orange">Orange Money</option>
                <option value="mtn">MTN</option>
              </select>
            </div>

            {debtorSales.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>
                  {i('Lier à une vente (optionnel)', 'Link to a sale (optional)', 'Vincular a una venta (opcional)', 'Collega a una vendita (opzionale)')}
                </label>
                <select className="input" value={paymentForm.saleId}
                  onChange={e => setPaymentForm({ ...paymentForm, saleId: e.target.value })}>
                  <option value="">— {i('Aucune', 'None', 'Ninguna', 'Nessuna')} —</option>
                  {debtorSales.map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.date).toLocaleDateString(locale)} — {fmt(s.amount)} ({i('reste', 'remaining', 'pendiente', 'resto')} {fmt(s.due ?? 0)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>
                {i('Note (optionnel)', 'Note (optional)', 'Nota (opcional)', 'Nota (opzionale)')}
              </label>
              <textarea className="input" value={paymentForm.note} rows={2}
                onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                placeholder={i('Précisions…', 'Notes…', 'Detalles…', 'Dettagli…')}
                style={{ resize:'vertical', minHeight:60, fontFamily:'inherit' }} />
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setShowPaymentModal(false)} disabled={saving} style={{
                padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)',
              }}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</button>
              <button onClick={submitPayment} disabled={saving} style={{
                padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:800, cursor: saving ? 'wait' : 'pointer', fontFamily:'inherit',
                background:'linear-gradient(135deg,var(--p),var(--p2))', border:'none', color:'#fff',
                boxShadow:'0 4px 12px rgba(91,78,232,.3)',
              }}>{saving ? i('Enregistrement…', 'Saving…', 'Guardando…', 'Salvataggio…') : i('Enregistrer', 'Save', 'Guardar', 'Salva')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
