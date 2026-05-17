import { useState, useEffect } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { ordersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X, CheckCircle, Truck, Clock, FileText, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs, htmlInfoGrid } from '@/utils/export'

type OrderStatus = 'BROUILLON' | 'ENVOYÉE' | 'CONFIRMÉE' | 'EN TRANSIT' | 'REÇUE' | 'ANNULÉE'

interface OrderItem { product: string; qty: number; unit: string; unitPrice: number }
interface Order {
  id: string; ref: string; supplier: string; date: string
  expectedAt: string; status: OrderStatus; total: number
  items: OrderItem[]; notes: string
}

const STATUS_CONFIG: Record<OrderStatus, { cls: string; icon: React.ReactNode; color: string }> = {
  'BROUILLON':  { cls: 'badge-gray',   icon: <FileText size={11}/>,    color: 'var(--text3)'  },
  'ENVOYÉE':    { cls: 'badge-blue',   icon: <Clock size={11}/>,        color: '#60A5FA'       },
  'CONFIRMÉE':  { cls: 'badge-violet', icon: <CheckCircle size={11}/>,  color: 'var(--p3)'    },
  'EN TRANSIT': { cls: 'badge-amber',  icon: <Truck size={11}/>,        color: 'var(--acc)'   },
  'REÇUE':      { cls: 'badge-green',  icon: <CheckCircle size={11}/>,  color: 'var(--acc2)'  },
  'ANNULÉE':    { cls: 'badge-red',    icon: <XCircle size={11}/>,      color: 'var(--danger)' },
}

const ORDERS_INIT: Order[] = [
  {
    id: '1', ref: 'CMD-2026-089', supplier: 'SONACO', date: '2026-05-10',
    expectedAt: '2026-05-14', status: 'EN TRANSIT', total: 1250000,
    items: [
      { product: '🫙 Huile palme 1L', qty: 500, unit: 'unité', unitPrice: 1200 },
      { product: '🫒 Huile végétale 5L', qty: 50, unit: 'carton', unitPrice: 6500 },
    ],
    notes: 'Livraison urgente — rupture imminente'
  },
  {
    id: '2', ref: 'CMD-2026-088', supplier: 'SENRIZ', date: '2026-05-08',
    expectedAt: '2026-05-12', status: 'REÇUE', total: 980000,
    items: [
      { product: '🌾 Riz parfumé 5kg', qty: 200, unit: 'sac', unitPrice: 3200 },
      { product: '🌾 Farine blé 1kg', qty: 500, unit: 'unité', unitPrice: 400 },
    ],
    notes: ''
  },
  {
    id: '3', ref: 'CMD-2026-087', supplier: 'CSS', date: '2026-05-06',
    expectedAt: '2026-05-16', status: 'CONFIRMÉE', total: 560000,
    items: [
      { product: '🍚 Sucre 1kg', qty: 800, unit: 'unité', unitPrice: 600 },
      { product: '🍚 Sucre 50kg', qty: 2, unit: 'sac', unitPrice: 28000 },
    ],
    notes: 'Bon de commande signé le 06/05'
  },
  {
    id: '4', ref: 'CMD-2026-086', supplier: 'UNILEVER', date: '2026-05-03',
    expectedAt: '2026-05-18', status: 'ENVOYÉE', total: 325000,
    items: [
      { product: '🧼 Savon OMO 500g', qty: 300, unit: 'unité', unitPrice: 320 },
      { product: '🫧 Savon ménage 400g', qty: 500, unit: 'unité', unitPrice: 280 },
    ],
    notes: ''
  },
  {
    id: '5', ref: 'CMD-2026-085', supplier: 'NESTLÉ', date: '2026-04-28',
    expectedAt: '2026-05-05', status: 'REÇUE', total: 440000,
    items: [
      { product: '🥛 Lait poudre 400g', qty: 200, unit: 'boîte', unitPrice: 1500 },
      { product: '🥤 Lait concentré 397g', qty: 100, unit: 'boîte', unitPrice: 900 },
    ],
    notes: 'Réception partielle — 18 boîtes manquantes signalées'
  },
  {
    id: '6', ref: 'CMD-2026-084', supplier: 'TOMAPOR', date: '2026-04-25',
    expectedAt: '2026-04-30', status: 'BROUILLON', total: 168000,
    items: [
      { product: '🍅 Tomate concentrée 800g', qty: 120, unit: 'boîte', unitPrice: 900 },
    ],
    notes: 'À valider avant envoi'
  },
]

const STATUSES: OrderStatus[] = ['BROUILLON','ENVOYÉE','CONFIRMÉE','EN TRANSIT','REÇUE','ANNULÉE']

const API_TO_LOCAL_STATUS: Record<string, OrderStatus> = {
  DRAFT: 'BROUILLON', SENT: 'ENVOYÉE', CONFIRMED: 'CONFIRMÉE',
  IN_TRANSIT: 'EN TRANSIT', RECEIVED: 'REÇUE', CANCELLED: 'ANNULÉE',
}
const LOCAL_TO_API_STATUS: Record<string, string> = {
  BROUILLON: 'DRAFT', ENVOYÉE: 'SENT', CONFIRMÉE: 'CONFIRMED',
  'EN TRANSIT': 'IN_TRANSIT', REÇUE: 'RECEIVED', ANNULÉE: 'CANCELLED',
}

function mapApiOrder(o: any): Order {
  return {
    id: o.id,
    ref: o.ref,
    supplier: o.supplier?.name || o.supplierId || '',
    date: o.createdAt?.split('T')[0] ?? '',
    expectedAt: o.expectedAt?.split('T')[0] ?? '',
    status: (API_TO_LOCAL_STATUS[o.status] ?? 'BROUILLON') as OrderStatus,
    total: o.total ?? 0,
    items: (o.items || []).map((i: any) => ({ product: i.productName, qty: i.qty, unit: 'unité', unitPrice: i.unitPrice })),
    notes: o.notes || '',
  }
}

export default function Orders() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const [orders, setOrders] = useState<Order[]>(ORDERS_INIT)

  useEffect(() => {
    ordersApi.list()
      .then(data => setOrders(data.map(mapApiOrder)))
      .catch(() => {})
  }, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [viewOrder, setViewOrder] = useState<Order | null>(null)
  const [ordersTab, setOrdersTab] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const [showCreateModal, setShowCreateModal] = useState(false)
  const TODAY = new Date().toISOString().split('T')[0]
  const DEFAULT_EXPECTED = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })()
  const [form, setForm] = useState({
    supplier: '', expectedAt: DEFAULT_EXPECTED, notes: '',
    items: [{ product: '', qty: 1, unit: 'unité', unitPrice: 0 }]
  })

  const suppliers = Array.from(new Set(orders.map(o => o.supplier)))

  const filtered = orders.filter(o =>
    (!search || o.ref.toLowerCase().includes(search.toLowerCase()) || o.supplier.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || o.status === statusFilter) &&
    (!supplierFilter || o.supplier === supplierFilter)
  )

  // KPIs
  const totalEngaged  = orders.filter(o => ['ENVOYÉE','CONFIRMÉE','EN TRANSIT'].includes(o.status)).reduce((s,o) => s+o.total, 0)
  const pending       = orders.filter(o => o.status === 'EN TRANSIT').length
  const receivedMonth = orders.filter(o => o.status === 'REÇUE').length
  const drafts        = orders.filter(o => o.status === 'BROUILLON').length

  const changeStatus = async (id: string, status: OrderStatus) => {
    try { await ordersApi.updateStatus(id, LOCAL_TO_API_STATUS[status] ?? status) } catch {}
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    setViewOrder(prev => prev?.id === id ? { ...prev, status } : prev)
    toast.success(`Statut mis à jour → ${status}`)
  }

  const createOrder = () => {
    const total = form.items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
    const newOrder: Order = {
      id: String(Date.now()),
      ref: `CMD-2026-${String(orders.length + 90).padStart(3, '0')}`,
      supplier: form.supplier,
      date: new Date().toISOString().split('T')[0],
      expectedAt: form.expectedAt,
      status: 'BROUILLON',
      total,
      items: form.items,
      notes: form.notes,
    }
    setOrders(prev => [newOrder, ...prev])
    setShowCreateModal(false)
    setForm({ supplier: '', expectedAt: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })(), notes: '', items: [{ product: '', qty: 1, unit: 'unité', unitPrice: 0 }] })
    toast.success(`✅ Commande ${newOrder.ref} créée !`)
  }

  const printOrderPDF = (order: Order) => {
    const body = `
      ${htmlInfoGrid([
        { label: t('col_ref'),         value: order.ref },
        { label: t('col_supplier'),    value: order.supplier },
        { label: t('orders_date'),     value: new Date(order.date).toLocaleDateString() },
        { label: t('orders_expected'), value: new Date(order.expectedAt).toLocaleDateString() },
        { label: t('col_status'),      value: order.status },
        { label: t('orders_articles'), value: String(order.items.length) },
      ])}
      <h2>${t('order_pdf_detail')}</h2>
      ${htmlTable(
        [t('col_product'), t('col_qty'), 'Unité', t('col_price'), t('col_amount')],
        order.items.map(item => [
          item.product, String(item.qty), item.unit,
          fmt(item.unitPrice),
          fmt(item.qty * item.unitPrice),
        ]),
        ['','','',`<strong>${t('order_pdf_total')}</strong>`, `<strong>${fmt(order.total)}</strong>`]
      )}
      ${order.notes ? `
        <h2>${t('order_pdf_notes')}</h2>
        <div style="padding:12px;background:#f8f7ff;border-radius:8px;font-size:12px;">${order.notes}</div>
      ` : ''}
      <div class="signature-block">
        <div><div class="signature-line">${t('doc_signature_buyer')}</div></div>
        <div><div class="signature-line">${t('doc_signature_supplier')}</div></div>
      </div>
    `
    openPDF(`${t('order_pdf_title')} — ${order.ref}`, body)
  }

  const printOrdersListPDF = () => {
    const body = `
      ${htmlKPIs([
        { label: t('order_pdf_total_orders'), value: String(orders.length) },
        { label: t('order_pdf_in_transit'),   value: String(orders.filter(o => o.status === 'EN TRANSIT').length) },
        { label: t('order_pdf_received'),     value: String(orders.filter(o => o.status === 'REÇUE').length) },
        { label: t('order_pdf_total_amount'), value: fmt(orders.reduce((s,o) => s+o.total, 0)) },
      ])}
      <h2>${t('order_pdf_list_title')}</h2>
      ${htmlTable(
        [t('col_ref'), t('col_supplier'), t('col_date'), t('orders_expected'), t('orders_articles'), t('col_amount'), t('col_status')],
        orders.map(o => {
          const cls = o.status === 'REÇUE' ? 'badge-green' : o.status === 'EN TRANSIT' ? 'badge-amber' : o.status === 'ANNULÉE' ? 'badge-red' : 'badge-blue'
          return [
            o.ref, o.supplier,
            new Date(o.date).toLocaleDateString(),
            new Date(o.expectedAt).toLocaleDateString(),
            String(o.items.length),
            fmt(o.total),
            `<span class="badge ${cls}">${o.status}</span>`,
          ]
        })
      )}
    `
    openPDF(t('order_pdf_list_title'), body)
  }

  const addFormItem = () =>
    setForm(f => ({ ...f, items: [...f.items, { product: '', qty: 1, unit: 'unité', unitPrice: 0 }] }))

  const updateFormItem = (i: number, key: string, val: any) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [key]: val } : item) }))

  const removeFormItem = (i: number) =>
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('orders_engaged'),       value: fmt(totalEngaged),      color: 'var(--p2)',    icon: '💰' },
          { label: t('status_transit'),     value: String(pending),        color: 'var(--acc)',   icon: '🚚' },
          { label: t('orders_received_month'), value: String(receivedMonth), color: 'var(--acc2)', icon: '✅' },
          { label: t('status_draft'),   value: String(drafts),         color: 'var(--text3)',icon: '📝' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 10, padding: 4, marginBottom: 4 }}>
        {[
          { id: 'list',     label: lang === 'fr' ? '📋 Liste' : '📋 List' },
          { id: 'calendar', label: lang === 'fr' ? '📅 Calendrier' : '📅 Calendar' },
        ].map(tab => (
          <button key={tab.id} type="button"
            onClick={() => setOrdersTab(tab.id as any)}
            style={{
              flex: 1, padding: '8px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              background: ordersTab === tab.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'transparent',
              color: ordersTab === tab.id ? '#fff' : 'var(--text2)',
              border: 'none', transition: 'all .15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar view */}
      {ordersTab === 'calendar' && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">📅 {lang === 'fr' ? 'Calendrier des livraisons' : 'Delivery calendar'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="mini-btn" onClick={prevMonth}>← {lang === 'fr' ? 'Préc.' : 'Prev'}</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {currentMonth.toLocaleDateString(
                  lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'it-IT',
                  { month: 'long', year: 'numeric' }
                )}
              </span>
              <button className="mini-btn" onClick={nextMonth}>{lang === 'fr' ? 'Suiv.' : 'Next'} →</button>
            </div>
          </div>
          {(() => {
            const year = currentMonth.getFullYear()
            const month = currentMonth.getMonth()
            const firstDay = new Date(year, month, 1).getDay()
            const daysInMonth = new Date(year, month + 1, 0).getDate()
            const offset = firstDay === 0 ? 6 : firstDay - 1
            const DAY_HEADERS: Record<string, string[]> = {
              fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
              en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
              es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
              it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
            }
            const dayHeaders = DAY_HEADERS[lang] ?? DAY_HEADERS.fr
            const todayStr = new Date().toISOString().split('T')[0]
            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                  {dayHeaders.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', padding: '6px 0' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {Array(offset).fill(null).map((_, i) => (
                    <div key={`e-${i}`} style={{ minHeight: 70 }} />
                  ))}
                  {Array(daysInMonth).fill(null).map((_, i) => {
                    const day = i + 1
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isToday = dateStr === todayStr
                    const deliveries = orders.filter(o => {
                      if (!o.expectedAt) return false
                      return o.expectedAt === dateStr && ['ENVOYÉE','CONFIRMÉE','EN TRANSIT'].includes(o.status)
                    })
                    const ordered = orders.filter(o => o.date === dateStr)
                    return (
                      <div key={day} style={{
                        minHeight: 70, borderRadius: 8, padding: '4px',
                        background: isToday ? 'rgba(91,78,232,.12)' : 'var(--bg3)',
                        border: `1px solid ${isToday ? 'var(--p2)' : 'var(--border)'}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 400, color: isToday ? 'var(--p2)' : 'var(--text2)', marginBottom: 4 }}>{day}</div>
                        {deliveries.slice(0, 2).map((o, j) => (
                          <div key={j} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(14,196,126,.15)', color: 'var(--acc2)', borderRadius: 4, padding: '2px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Livraison: ${o.supplier}`}>
                            🚚 {o.supplier.slice(0, 8)}
                          </div>
                        ))}
                        {ordered.slice(0, 2).map((o, j) => (
                          <div key={j} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(91,78,232,.12)', color: 'var(--p2)', borderRadius: 4, padding: '2px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Commande: ${o.ref}`}>
                            📦 {o.ref.slice(-6)}
                          </div>
                        ))}
                        {(deliveries.length + ordered.length) > 2 && (
                          <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{deliveries.length + ordered.length - 2}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(14,196,126,.25)' }} />
                    {lang === 'fr' ? 'Livraison prévue' : 'Expected delivery'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(91,78,232,.2)' }} />
                    {lang === 'fr' ? 'Commande passée' : 'Order placed'}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Panel commandes */}
      {ordersTab === 'list' && <div className="panel">
        <div className="panel-head">
          <span className="panel-title">📦 {t('orders_title')}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_commandes',
                ['Référence','Fournisseur','Date','Livraison prévue','Articles','Montant','Statut'],
                orders.map(o => [o.ref, o.supplier, o.date, o.expectedAt, o.items.length, o.total, o.status])
              )
              toast.success('📊 Export CSV téléchargé !')
            }}>
              <Download size={13} /> {t('btn_export')}
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printOrdersListPDF(); toast.success('📄 PDF ouvert !') }}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreateModal(true)}>
              <Plus size={13} /> {t('btn_new')} commande
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-40">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder="🔍 Référence, fournisseur…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">{t('pos_all')} {t('col_status').toLowerCase()}</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="input py-2 text-sm w-auto" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
            <option value="">{t('pos_all')} {t('col_supplier').toLowerCase()}</option>
            {suppliers.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Filtres rapides statut */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className="px-3 py-1 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: !statusFilter ? 'var(--p)' : 'var(--bg3)',
              color: !statusFilter ? '#fff' : 'var(--text2)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit'
            }}
            onClick={() => setStatusFilter('')}
          >{t('pos_all')} ({orders.length})</button>
          {STATUSES.map(s => {
            const count = orders.filter(o => o.status === s).length
            const cfg = STATUS_CONFIG[s]
            return (
              <button key={s}
                className="px-3 py-1 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: statusFilter === s ? cfg.color + '22' : 'var(--bg3)',
                  color: statusFilter === s ? cfg.color : 'var(--text2)',
                  border: statusFilter === s ? `1px solid ${cfg.color}44` : '1px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit'
                }}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              >
                {s} ({count})
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('col_ref')}</th>
                <th>{t('col_supplier')}</th>
                <th>{t('orders_date')}</th>
                <th>{t('orders_expected')}</th>
                <th>{t('orders_articles')}</th>
                <th>{t('col_amount')}</th>
                <th>{t('col_status')}</th>
                <th>{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const cfg = STATUS_CONFIG[o.status]
                const isLate = o.status === 'EN TRANSIT' && new Date(o.expectedAt) < new Date()
                return (
                  <tr key={o.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="td-mono">{o.ref}</span>
                        {isLate && <span className="badge badge-red text-xs">Retard</span>}
                      </div>
                    </td>
                    <td className="td-bold">{o.supplier}</td>
                    <td className="td-mono text-xs">{new Date(o.date).toLocaleDateString('fr-FR')}</td>
                    <td className="td-mono text-xs" style={{ color: isLate ? 'var(--danger)' : 'var(--text2)' }}>
                      {new Date(o.expectedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <span className="badge badge-gray">{o.items.length} article{o.items.length > 1 ? 's' : ''}</span>
                    </td>
                    <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(o.total)}</td>
                    <td>
                      <span className={`badge ${cfg.cls} flex items-center gap-1 w-fit`}>
                        {cfg.icon} {o.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn btn-sm btn-ghost" onClick={() => setViewOrder(o)} title="Voir détails">
                          <Eye size={12} />
                        </button>
                        {o.status === 'BROUILLON' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                            onClick={() => changeStatus(o.id, 'ENVOYÉE')}>
                            📤 {t('btn_send')}
                          </button>
                        )}
                        {o.status === 'ENVOYÉE' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--p3)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                            onClick={() => changeStatus(o.id, 'CONFIRMÉE')}>
                            ✓ {t('btn_confirm')}
                          </button>
                        )}
                        {o.status === 'CONFIRMÉE' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--acc)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                            onClick={() => changeStatus(o.id, 'EN TRANSIT')}>
                            🚚 {t('status_transit')}
                          </button>
                        )}
                        {o.status === 'EN TRANSIT' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--acc2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                            onClick={() => changeStatus(o.id, 'REÇUE')}>
                            📥 {t('status_received')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--text3)' }}>Aucune commande trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* ── Modal détail commande ── */}
      {viewOrder && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewOrder(null)}>
          <div className="modal-box" style={{ maxWidth: 580 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  📦 {viewOrder.ref}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  {viewOrder.supplier} · {new Date(viewOrder.date).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${STATUS_CONFIG[viewOrder.status].cls} flex items-center gap-1`}>
                  {STATUS_CONFIG[viewOrder.status].icon} {viewOrder.status}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewOrder(null)}><X size={14} /></button>
              </div>
            </div>

            {/* Infos */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Fournisseur', value: viewOrder.supplier },
                { label: 'Livraison prévue', value: new Date(viewOrder.expectedAt).toLocaleDateString('fr-FR') },
                { label: 'Montant total', value: fmt(viewOrder.total) },
                { label: 'Nb articles', value: `${viewOrder.items.length} ligne${viewOrder.items.length > 1 ? 's' : ''}` },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Lignes */}
            <div className="table-wrap mb-4">
              <table>
                <thead>
                  <tr><th>Produit</th><th>Qté</th><th>Unité</th><th>PU</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {viewOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td className="td-bold text-xs">{item.product}</td>
                      <td className="td-num text-xs">{item.qty}</td>
                      <td className="text-xs" style={{ color: 'var(--text2)' }}>{item.unit}</td>
                      <td className="td-num text-xs">{fmt(item.unitPrice)}</td>
                      <td className="td-num text-xs" style={{ color: 'var(--acc2)' }}>{fmt(item.qty * item.unitPrice)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg3)' }}>
                    <td colSpan={4} className="text-xs font-bold text-right px-4 py-2">TOTAL</td>
                    <td className="td-num font-black" style={{ color: 'var(--p2)' }}>{fmt(viewOrder.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {viewOrder.notes && (
              <div className="p-3 rounded-xl text-xs mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--acc)' }}>
                📝 {viewOrder.notes}
              </div>
            )}

            {/* Actions progression */}
            <div className="flex gap-2">
              {viewOrder.status === 'BROUILLON' && (
                <button className="btn btn-primary flex-1 justify-center"
                  onClick={() => changeStatus(viewOrder.id, 'ENVOYÉE')}>
                  📤 Envoyer au fournisseur
                </button>
              )}
              {viewOrder.status === 'EN TRANSIT' && (
                <button className="btn btn-primary flex-1 justify-center"
                  style={{ background: 'linear-gradient(135deg,var(--acc2),#059669)' }}
                  onClick={() => changeStatus(viewOrder.id, 'REÇUE')}>
                  📥 Confirmer la réception
                </button>
              )}
              {!['ANNULÉE','REÇUE'].includes(viewOrder.status) && (
                <button className="btn btn-ghost"
                  onClick={() => { changeStatus(viewOrder.id, 'ANNULÉE'); setViewOrder(null) }}>
                  🗑️ Annuler
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => { printOrderPDF(viewOrder); toast.success('📄 PDF ouvert !') }}>🖨️ PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal créer commande ── */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>➕ Nouvelle commande</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Fournisseur</label>
                <select className="input text-sm" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}>
                  <option value="">Choisir…</option>
                  {['SONACO','SENRIZ','CSS','UNILEVER','NESTLÉ','TOMAPOR','GRANDS MOULINS'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Livraison prévue</label>
                <input className="input text-sm" type="date" value={form.expectedAt}
                  onChange={e => setForm(f => ({ ...f, expectedAt: e.target.value }))} />
              </div>
            </div>

            {/* Lignes produits */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>Articles</label>
                <button className="btn btn-ghost btn-sm gap-1" onClick={addFormItem}><Plus size={11} /> Ajouter</button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 60px 80px 90px 28px' }}>
                    <input className="input text-xs py-2" placeholder="Produit…" value={item.product}
                      onChange={e => updateFormItem(i, 'product', e.target.value)} />
                    <input className="input text-xs py-2 text-center" type="number" placeholder="Qté" value={item.qty}
                      onChange={e => updateFormItem(i, 'qty', +e.target.value)} />
                    <select className="input text-xs py-2" value={item.unit}
                      onChange={e => updateFormItem(i, 'unit', e.target.value)}>
                      <option>unité</option><option>carton</option><option>sac</option><option>boîte</option><option>palette</option>
                    </select>
                    <input className="input text-xs py-2 text-right" type="number" placeholder="Prix unit." value={item.unitPrice}
                      onChange={e => updateFormItem(i, 'unitPrice', +e.target.value)} />
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: 4, fontFamily: 'inherit' }}
                      onClick={() => removeFormItem(i)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Total */}
              <div className="flex justify-end mt-2 text-sm font-black" style={{ color: 'var(--p2)' }}>
                Total : {fmt(form.items.reduce((s, i) => s + i.qty * i.unitPrice, 0))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
              <textarea className="input text-sm" rows={2} placeholder="Instructions spéciales, conditions…"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center" onClick={createOrder}>✅ Créer la commande</button>
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
