import { useState, Fragment, type ReactNode } from 'react'
import { useAppStore, formatCurrency } from '@/stores/appStore'
import {
  Search, Plus, Download, X, Eye, Truck,
  CheckCircle2, Send, Clock, XCircle, PackageCheck,
  AlertTriangle, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

type OrderStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED'

interface OrderItem {
  productName: string
  qty: number
  unitPrice: number
}

interface Order {
  id: number
  reference: string
  supplier: string
  supplierId: number
  status: OrderStatus
  totalHT: number
  totalTTC: number
  items: OrderItem[]
  expectedAt: string
  createdAt: string
  notes: string
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; cls: string; icon: ReactNode }> = {
  DRAFT:      { label: 'Brouillon',  cls: 'badge-gray',   icon: <Clock size={11} />       },
  SENT:       { label: 'Envoyée',    cls: 'badge-amber',  icon: <Send size={11} />        },
  CONFIRMED:  { label: 'Confirmée',  cls: 'badge-violet', icon: <CheckCircle2 size={11}/> },
  IN_TRANSIT: { label: 'En Transit', cls: 'badge-blue',   icon: <Truck size={11} />       },
  RECEIVED:   { label: 'Reçue',      cls: 'badge-green',  icon: <PackageCheck size={11}/> },
  CANCELLED:  { label: 'Annulée',    cls: 'badge-red',    icon: <XCircle size={11} />     },
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  DRAFT:      'SENT',
  SENT:       'CONFIRMED',
  CONFIRMED:  'IN_TRANSIT',
  IN_TRANSIT: 'RECEIVED',
  RECEIVED:   null,
  CANCELLED:  null,
}

const STATUS_ALL: OrderStatus[] = ['DRAFT', 'SENT', 'CONFIRMED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']

const SUPPLIERS_LIST = [
  { id: 1, name: 'SENRIZ SA' },
  { id: 2, name: 'SONACO' },
  { id: 3, name: 'CSS Sénégal' },
  { id: 4, name: 'Grands Moulins' },
  { id: 5, name: 'UNILEVER Afrique' },
  { id: 6, name: 'NESTLÉ Sénégal' },
]

const PRODUCTS_LIST = [
  { name: 'Riz parfumé 5kg',          price: 3200 },
  { name: 'Huile palme 1L',            price: 1200 },
  { name: 'Sucre 1kg',                 price: 600  },
  { name: 'Farine blé 1kg',            price: 400  },
  { name: 'Savon OMO 500g',            price: 320  },
  { name: 'Lait poudre 400g',          price: 1500 },
  { name: 'Huile végétale 5L',         price: 6500 },
  { name: 'Tomate concentrée 800g',    price: 900  },
]

const ORDERS_INIT: Order[] = [
  {
    id: 1, reference: 'CMD240089', supplier: 'SENRIZ SA', supplierId: 1,
    status: 'RECEIVED', totalHT: 640000, totalTTC: 755200,
    items: [{ productName: 'Riz parfumé 5kg', qty: 200, unitPrice: 3200 }],
    expectedAt: '2026-05-10', createdAt: '2026-05-05', notes: 'Livraison prioritaire',
  },
  {
    id: 2, reference: 'CMD240090', supplier: 'CSS Sénégal', supplierId: 3,
    status: 'CONFIRMED', totalHT: 300000, totalTTC: 354000,
    items: [{ productName: 'Sucre 1kg', qty: 500, unitPrice: 600 }],
    expectedAt: '2026-05-20', createdAt: '2026-05-08', notes: '',
  },
  {
    id: 3, reference: 'CMD240091', supplier: 'SONACO', supplierId: 2,
    status: 'IN_TRANSIT', totalHT: 432000, totalTTC: 509760,
    items: [
      { productName: 'Huile palme 1L',    qty: 240, unitPrice: 1200 },
      { productName: 'Huile végétale 5L', qty: 24,  unitPrice: 6500 },
    ],
    expectedAt: '2026-05-22', createdAt: '2026-05-10', notes: 'Commande groupée corps gras',
  },
  {
    id: 4, reference: 'CMD240092', supplier: 'Grands Moulins', supplierId: 4,
    status: 'DRAFT', totalHT: 200000, totalTTC: 236000,
    items: [{ productName: 'Farine blé 1kg', qty: 500, unitPrice: 400 }],
    expectedAt: '2026-05-25', createdAt: '2026-05-12', notes: '',
  },
  {
    id: 5, reference: 'CMD240087', supplier: 'NESTLÉ Sénégal', supplierId: 6,
    status: 'RECEIVED', totalHT: 225000, totalTTC: 265500,
    items: [{ productName: 'Lait poudre 400g', qty: 150, unitPrice: 1500 }],
    expectedAt: '2026-05-01', createdAt: '2026-04-25', notes: '',
  },
  {
    id: 6, reference: 'CMD240086', supplier: 'UNILEVER Afrique', supplierId: 5,
    status: 'CANCELLED', totalHT: 96000, totalTTC: 113280,
    items: [{ productName: 'Savon OMO 500g', qty: 300, unitPrice: 320 }],
    expectedAt: '2026-04-20', createdAt: '2026-04-15', notes: 'Annulée — rupture fournisseur',
  },
  {
    id: 7, reference: 'CMD240093', supplier: 'Grands Moulins', supplierId: 4,
    status: 'SENT', totalHT: 160000, totalTTC: 188800,
    items: [
      { productName: 'Farine blé 1kg', qty: 250, unitPrice: 400 },
      { productName: 'Sucre 1kg',      qty: 100, unitPrice: 600 },
    ],
    expectedAt: '2026-05-28', createdAt: '2026-05-13', notes: '',
  },
]

const EMPTY_FORM = { supplierId: 1, expectedAt: '', notes: '' }
const EMPTY_ITEM = { productName: PRODUCTS_LIST[0].name, qty: 1, unitPrice: PRODUCTS_LIST[0].price }

const TODAY = new Date().toISOString().slice(0, 10)

function isOverdue(o: Order) {
  return !['RECEIVED', 'CANCELLED'].includes(o.status) && !!o.expectedAt && o.expectedAt < TODAY
}

export default function Orders() {
  const { currency } = useAppStore()
  const [orders, setOrders]         = useState<Order[]>(ORDERS_INIT)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]         = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId]     = useState<number | null>(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [items, setItems]           = useState([{ ...EMPTY_ITEM }])

  /* ── derived ── */
  const filtered = orders.filter(o =>
    (!statusFilter || o.status === statusFilter) &&
    (!search ||
      o.reference.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier.toLowerCase().includes(search.toLowerCase()))
  )

  const liveDetail   = detailId !== null ? orders.find(o => o.id === detailId) ?? null : null
  const pending      = orders.filter(o => ['DRAFT','SENT','CONFIRMED','IN_TRANSIT'].includes(o.status)).length
  const inTransit    = orders.filter(o => o.status === 'IN_TRANSIT').length
  const thisMonth    = orders.filter(o => o.createdAt.startsWith('2026-05')).length
  const totalVal     = orders.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + o.totalTTC, 0)
  const overdueList  = orders.filter(isOverdue)

  /* ── form helpers ── */
  const addItem    = () => setItems(p => [...p, { ...EMPTY_ITEM }])
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i: number, key: string, val: unknown) =>
    setItems(p => p.map((it, idx) => {
      if (idx !== i) return it
      const u = { ...it, [key]: val }
      if (key === 'productName') {
        const found = PRODUCTS_LIST.find(p => p.name === val)
        if (found) u.unitPrice = found.price
      }
      return u
    }))

  const formHT  = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  const formTTC = formHT * 1.18

  /* ── actions ── */
  const createOrder = () => {
    if (items.every(i => i.qty <= 0)) { toast.error('Ajoutez au moins un article'); return }
    const supplier = SUPPLIERS_LIST.find(s => s.id === form.supplierId)!
    const id  = Math.max(0, ...orders.map(o => o.id)) + 1
    const ref = `CMD${Date.now().toString().slice(-6)}`
    setOrders(p => [{
      id, reference: ref,
      supplier: supplier.name, supplierId: form.supplierId,
      status: 'DRAFT', totalHT: formHT, totalTTC: formTTC,
      items: items.map(i => ({ ...i })),
      expectedAt: form.expectedAt,
      createdAt: TODAY,
      notes: form.notes,
    }, ...p])
    toast.success(`✅ Commande ${ref} créée`)
    setShowCreate(false)
    setForm(EMPTY_FORM)
    setItems([{ ...EMPTY_ITEM }])
  }

  const advance = (id: number) => {
    setOrders(p => p.map(o => {
      if (o.id !== id) return o
      const next = STATUS_FLOW[o.status]
      if (!next) return o
      toast.success(`📦 ${o.reference} → ${STATUS_CONFIG[next].label}`)
      return { ...o, status: next }
    }))
  }

  const cancel = (id: number) => {
    setOrders(p => p.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o))
    toast('Commande annulée', { icon: '🚫' })
  }

  /* ── render ── */
  return (
    <div className="space-y-5 animate-in">

      {/* Alerte retard */}
      {overdueList.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
              {overdueList.length} commande{overdueList.length > 1 ? 's' : ''} en retard de livraison
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
              {overdueList.map(o => `${o.reference} (${o.supplier})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'En cours',      value: String(pending),                    icon: '📋', color: 'var(--primary2)'  },
          { label: 'En transit',    value: String(inTransit),                  icon: '🚚', color: '#60A5FA'          },
          { label: 'Ce mois',       value: String(thisMonth),                  icon: '📅', color: 'var(--teal)'      },
          { label: 'Valeur totale', value: formatCurrency(totalVal, currency), icon: '💸', color: 'var(--green)'     },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Panel principal */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">📋 Commandes fournisseurs</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('📊 Export CSV en cours…')}>
              <Download size={13} /> CSV
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> Nouvelle commande
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-48">
            <Search size={13} className="search-icon" />
            <input
              className="input pl-8 py-2 text-sm w-full"
              placeholder="Référence, fournisseur…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['', 'DRAFT', 'SENT', 'CONFIRMED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: statusFilter === s
                    ? 'linear-gradient(135deg,var(--primary),var(--teal))'
                    : 'var(--bg3)',
                  color: statusFilter === s ? '#fff' : 'var(--text2)',
                  border: 'none', fontFamily: 'inherit',
                }}>
                {s === '' ? 'Tous' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Fournisseur</th>
                <th>Statut</th>
                <th>Articles</th>
                <th>Total TTC</th>
                <th>Livraison prévue</th>
                <th>Créée le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const st      = STATUS_CONFIG[o.status]
                const next    = STATUS_FLOW[o.status]
                const overdue = isOverdue(o)
                return (
                  <tr key={o.id} style={overdue ? { background: 'rgba(239,68,68,0.04)' } : {}}>
                    <td>
                      <span className="td-mono font-black" style={{ color: 'var(--primary2)' }}>
                        {o.reference}
                      </span>
                    </td>
                    <td className="td-bold">{o.supplier}</td>
                    <td>
                      <span className={`badge ${st.cls} flex items-center gap-1 w-fit`}>
                        {st.icon}{st.label}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs" style={{ color: 'var(--text2)' }}>
                        {o.items.length} article{o.items.length > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="td-num" style={{ color: 'var(--teal)' }}>
                      {formatCurrency(o.totalTTC, currency)}
                    </td>
                    <td>
                      <span className="text-xs" style={{
                        color: overdue ? 'var(--danger)' : 'var(--text2)',
                        fontWeight: overdue ? 700 : 400,
                      }}>
                        {overdue && '⚠ '}
                        {o.expectedAt ? new Date(o.expectedAt).toLocaleDateString('fr-FR') : '—'}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text3)' }}>
                      {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <div className="flex gap-1.5 items-center">
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Voir le détail"
                          onClick={() => setDetailId(o.id)}>
                          <Eye size={13} />
                        </button>
                        {next && (
                          <button
                            className="btn btn-sm btn-primary gap-1"
                            style={{ fontSize: 11 }}
                            onClick={() => advance(o.id)}>
                            {next === 'RECEIVED'
                              ? '📦 Réceptionner'
                              : <><ArrowRight size={11} /> {STATUS_CONFIG[next].label}</>}
                          </button>
                        )}
                        {['DRAFT', 'SENT'].includes(o.status) && (
                          <button
                            className="btn btn-sm btn-ghost"
                            title="Annuler la commande"
                            onClick={() => cancel(o.id)}
                            style={{ color: 'var(--danger)' }}>
                            <XCircle size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--text3)' }}>
                    Aucune commande trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════ Modal Détail ══════════════ */}
      {liveDetail && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDetailId(null)}>
          <div className="modal-box" style={{ maxWidth: 600 }}>

            {/* En-tête */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="td-mono text-lg font-black" style={{ color: 'var(--primary2)' }}>
                    {liveDetail.reference}
                  </span>
                  <span className={`badge ${STATUS_CONFIG[liveDetail.status].cls} flex items-center gap-1`}>
                    {STATUS_CONFIG[liveDetail.status].icon}
                    {STATUS_CONFIG[liveDetail.status].label}
                  </span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>
                  {liveDetail.supplier}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(null)}>
                <X size={14} />
              </button>
            </div>

            {/* Barre de progression statut */}
            <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
              {STATUS_ALL.filter(s => s !== 'CANCELLED').map((s, idx, arr) => {
                const activeIdx  = arr.indexOf(liveDetail.status as Exclude<OrderStatus,'CANCELLED'>)
                const isCurrent  = s === liveDetail.status
                const isPast     = arr.indexOf(s) < activeIdx
                const isCancelled= liveDetail.status === 'CANCELLED'
                return (
                  <Fragment key={s}>
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                        style={{
                          background: isCancelled
                            ? 'var(--bg3)'
                            : isCurrent
                              ? 'linear-gradient(135deg,var(--primary),var(--teal))'
                              : isPast
                                ? 'rgba(16,185,129,0.2)'
                                : 'var(--bg3)',
                          color: isCancelled ? 'var(--text3)' : isCurrent ? '#fff' : isPast ? 'var(--green)' : 'var(--text3)',
                          border: isCurrent ? 'none' : '1.5px solid var(--border)',
                        }}>
                        {isPast && !isCancelled ? '✓' : STATUS_CONFIG[s].icon}
                      </div>
                      <span className="text-xs whitespace-nowrap"
                        style={{ color: isCurrent ? 'var(--text)' : 'var(--text3)', fontWeight: isCurrent ? 700 : 400 }}>
                        {STATUS_CONFIG[s].label}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="flex-1 h-px" style={{ minWidth: 12, background: isPast && !isCancelled ? 'var(--green)' : 'var(--border)' }} />
                    )}
                  </Fragment>
                )
              })}
              {liveDetail.status === 'CANCELLED' && (
                <span className="badge badge-red flex items-center gap-1 ml-2">
                  <XCircle size={11} /> Annulée
                </span>
              )}
            </div>

            {/* Infos dates */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg3)' }}>
                <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>
                  Créée le
                </p>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  {new Date(liveDetail.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg3)' }}>
                <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>
                  Livraison prévue
                </p>
                <p className="text-sm font-bold"
                  style={{ color: isOverdue(liveDetail) ? 'var(--danger)' : 'var(--text)' }}>
                  {isOverdue(liveDetail) && '⚠ '}
                  {liveDetail.expectedAt
                    ? new Date(liveDetail.expectedAt).toLocaleDateString('fr-FR')
                    : '—'}
                </p>
              </div>
            </div>

            {/* Articles */}
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>
              Articles commandés
            </p>
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)' }}>
                    {['Produit', 'Qté', 'P.U.', 'Total'].map((h, i) => (
                      <th key={h} style={{
                        padding: '8px 12px',
                        textAlign: i === 0 ? 'left' : i === 1 ? 'center' : 'right',
                        fontSize: 11, color: 'var(--text3)',
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveDetail.items.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)' }}>
                        {item.productName}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                        {item.qty}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                        {formatCurrency(item.unitPrice, currency)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--teal)' }}>
                        {formatCurrency(item.unitPrice * item.qty, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totaux */}
            <div className="rounded-xl p-3 mb-4 space-y-1.5" style={{ background: 'var(--bg3)' }}>
              <div className="flex justify-between text-xs" style={{ color: 'var(--text2)' }}>
                <span>Total HT</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{formatCurrency(liveDetail.totalHT, currency)}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ color: 'var(--text2)' }}>
                <span>TVA 18%</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{formatCurrency(liveDetail.totalTTC - liveDetail.totalHT, currency)}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text)' }}>Total TTC</span>
                <span style={{ color: 'var(--primary2)', fontFamily: 'var(--mono)' }}>
                  {formatCurrency(liveDetail.totalTTC, currency)}
                </span>
              </div>
            </div>

            {/* Notes */}
            {liveDetail.notes && (
              <div className="rounded-xl p-3 mb-4 text-xs"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <p className="font-semibold mb-0.5" style={{ color: 'var(--primary2)' }}>📝 Notes</p>
                <p style={{ color: 'var(--text2)' }}>{liveDetail.notes}</p>
              </div>
            )}

            {/* Actions modal */}
            <div className="flex gap-2">
              {STATUS_FLOW[liveDetail.status] && (
                <button className="btn btn-primary flex-1 justify-center gap-1.5"
                  onClick={() => advance(liveDetail.id)}>
                  {STATUS_FLOW[liveDetail.status] === 'RECEIVED'
                    ? '📦 Réceptionner la commande'
                    : `→ Passer à : ${STATUS_CONFIG[STATUS_FLOW[liveDetail.status]!].label}`}
                </button>
              )}
              {['DRAFT', 'SENT'].includes(liveDetail.status) && (
                <button className="btn btn-ghost btn-sm"
                  onClick={() => { cancel(liveDetail.id); setDetailId(null) }}
                  style={{ color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  Annuler la commande
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Modal Création ══════════════ */}
      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                📦 Nouvelle commande fournisseur
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text3)' }}>
                  Fournisseur *
                </label>
                <select className="input text-sm" value={form.supplierId}
                  onChange={e => setForm(p => ({ ...p, supplierId: +e.target.value }))}>
                  {SUPPLIERS_LIST.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text3)' }}>
                  Livraison prévue
                </label>
                <input className="input text-sm" type="date" value={form.expectedAt}
                  onChange={e => setForm(p => ({ ...p, expectedAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text3)' }}>
                  Notes
                </label>
                <input className="input text-sm" type="text" placeholder="Optionnel…" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            {/* Lignes dynamiques */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
                  Articles *
                </label>
                <button className="btn btn-ghost btn-sm gap-1" onClick={addItem}>
                  <Plus size={11} /> Ajouter un article
                </button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center rounded-xl p-2.5"
                    style={{ background: 'var(--bg3)' }}>
                    <select
                      className="input text-sm flex-1"
                      style={{ background: 'var(--bg2)' }}
                      value={item.productName}
                      onChange={e => updateItem(idx, 'productName', e.target.value)}>
                      {PRODUCTS_LIST.map(p => <option key={p.name}>{p.name}</option>)}
                    </select>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs" style={{ color: 'var(--text3)' }}>Qté</span>
                      <input
                        className="input text-sm text-center"
                        style={{ width: 60, background: 'var(--bg2)' }}
                        type="number" min={1}
                        value={item.qty}
                        onChange={e => updateItem(idx, 'qty', Math.max(1, +e.target.value))} />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs" style={{ color: 'var(--text3)' }}>P.U.</span>
                      <input
                        className="input text-sm"
                        style={{ width: 90, background: 'var(--bg2)', fontFamily: 'var(--mono)' }}
                        type="number" min={0}
                        value={item.unitPrice}
                        onChange={e => updateItem(idx, 'unitPrice', +e.target.value)} />
                    </div>
                    <span className="text-xs font-bold flex-shrink-0"
                      style={{ color: 'var(--teal)', fontFamily: 'var(--mono)', minWidth: 90, textAlign: 'right' }}>
                      {formatCurrency(item.unitPrice * item.qty, 'XOF')}
                    </span>
                    {items.length > 1 && (
                      <button className="btn btn-ghost btn-sm flex-shrink-0"
                        onClick={() => removeItem(idx)}
                        style={{ color: 'var(--danger)' }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Totaux récap */}
            <div className="rounded-xl p-3 mb-5 space-y-1.5" style={{ background: 'var(--bg3)' }}>
              <div className="flex justify-between text-xs" style={{ color: 'var(--text2)' }}>
                <span>Total HT</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{formatCurrency(formHT, 'XOF')}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ color: 'var(--text2)' }}>
                <span>TVA 18%</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{formatCurrency(formTTC - formHT, 'XOF')}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1.5"
                style={{ borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text)' }}>Total TTC</span>
                <span style={{ color: 'var(--primary2)', fontFamily: 'var(--mono)' }}>
                  {formatCurrency(formTTC, 'XOF')}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center" onClick={createOrder}>
                ✅ Créer la commande
              </button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
