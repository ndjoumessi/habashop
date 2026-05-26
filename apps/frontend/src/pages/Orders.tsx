import { useState, useEffect } from 'react'
import Skeleton from '@/components/ui/skeleton'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { ordersApi, productsApi, suppliersApi, customersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X, CheckCircle, Truck, Clock, FileText, XCircle, DollarSign, Package, CalendarDays, List, Users, Phone, Send, Inbox, Printer, ClipboardList, User, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs, htmlInfoGrid } from '@/utils/export'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

type OrderStatus = 'BROUILLON' | 'ENVOYÉE' | 'CONFIRMÉE' | 'EN TRANSIT' | 'REÇUE' | 'ANNULÉE'

interface OrderItem { product: string; qty: number; unit: string; unitPrice: number }
interface Order {
  id: string; ref: string; supplier: string; date: string
  expectedAt: string; status: OrderStatus; total: number
  items: OrderItem[]; notes: string
  type?: 'client' | 'supplier'
}

const STATUS_CONFIG: Record<OrderStatus, { cls: string; icon: React.ReactNode; color: string }> = {
  'BROUILLON':  { cls: 'badge-gray',   icon: <FileText size={11}/>,    color: 'var(--text3)'  },
  'ENVOYÉE':    { cls: 'badge-blue',   icon: <Clock size={11}/>,        color: '#60A5FA'       },
  'CONFIRMÉE':  { cls: 'badge-violet', icon: <CheckCircle size={11}/>,  color: 'var(--p3)'    },
  'EN TRANSIT': { cls: 'badge-amber',  icon: <Truck size={11}/>,        color: 'var(--acc)'   },
  'REÇUE':      { cls: 'badge-green',  icon: <CheckCircle size={11}/>,  color: 'var(--acc2)'  },
  'ANNULÉE':    { cls: 'badge-red',    icon: <XCircle size={11}/>,      color: 'var(--danger)' },
}

const STATUSES: OrderStatus[] = ['BROUILLON','ENVOYÉE','CONFIRMÉE','EN TRANSIT','REÇUE','ANNULÉE']

type L4 = 'fr' | 'en' | 'es' | 'it'
const ORDER_STATUS_LABELS: Record<OrderStatus, Record<L4, string>> = {
  'BROUILLON':  { fr: 'Brouillon',  en: 'Draft',      es: 'Borrador',   it: 'Bozza' },
  'ENVOYÉE':    { fr: 'Envoyée',    en: 'Sent',       es: 'Enviada',    it: 'Inviata' },
  'CONFIRMÉE':  { fr: 'Confirmée',  en: 'Confirmed',  es: 'Confirmada', it: 'Confermata' },
  'EN TRANSIT': { fr: 'En transit', en: 'In transit', es: 'En tránsito',it: 'In transito' },
  'REÇUE':      { fr: 'Reçue',      en: 'Received',   es: 'Recibida',   it: 'Ricevuta' },
  'ANNULÉE':    { fr: 'Annulée',    en: 'Cancelled',  es: 'Cancelada',  it: 'Annullata' },
}
const orderStatusLabel = (s: OrderStatus, lang: string) => ORDER_STATUS_LABELS[s]?.[lang as L4] ?? s

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
  const { i } = useI18n()
  void lang
  const fmt = useFormatAmount()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ordersApi.list()
      .then(data => setOrders(data.map(mapApiOrder)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [viewOrder, setViewOrder] = useState<Order | null>(null)
  const [ordersTab, setOrdersTab] = useState<'list' | 'calendar'>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [orderType, setOrderType] = useState<'client' | 'supplier'>('client')
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [newOrderForm, setNewOrderForm] = useState({
    clientName: '', clientPhone: '',
    items: [] as { id: string; name: string; price: number; qty: number; emoji: string }[],
    note: '',
  })
  const [suppliersList, setSuppliersList] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([])
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)

  useEffect(() => {
    productsApi.list()
      .then(data => setAvailableProducts(
        data.map((p: any) => ({
          id: p.id, name: p.name,
          price: p.sellPrice ?? p.price ?? 0,
          emoji: p.emoji || '📦',
          category: p.category || '',
        }))
      ))
      .catch(() => {})
  }, [])

  useEffect(() => {
    suppliersApi.list()
      .then(data => setSuppliersList(
        data.map((s: any) => ({
          id: s.id, name: s.name,
          specialty: s.specialty || s.category || '',
          phone: s.phone || '',
          leadTime: s.leadTime || s.lead_time || '—',
          rating: s.rating ?? 4,
          status: s.status || 'active',
        }))
      ))
      .catch(() => {})
  }, [])

  useEffect(() => {
    customersApi.list()
      .then((data: any[]) => setCustomers(data.map((c: any) => ({
        id: c.id, name: c.name,
        phone: c.phone || '',
        type: c.type || c.customerType || '',
        totalCA: c.totalCA ?? c.total_ca ?? 0,
      }))))
      .catch(() => {})
  }, [])

  const supplierNames = Array.from(new Set(orders.map(o => o.supplier)))

  const filtered = orders.filter(o =>
    (!search || o.ref.toLowerCase().includes(search.toLowerCase()) || o.supplier.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || o.status === statusFilter) &&
    (!supplierFilter || o.supplier === supplierFilter)
  )
  const pg = usePagination(filtered, 20)
  useEffect(() => { pg.reset() }, [search, statusFilter, supplierFilter])

  // KPIs
  const totalEngaged  = orders.filter(o => ['ENVOYÉE','CONFIRMÉE','EN TRANSIT'].includes(o.status)).reduce((s,o) => s+o.total, 0)
  const pending       = orders.filter(o => o.status === 'EN TRANSIT').length
  const receivedMonth = orders.filter(o => o.status === 'REÇUE').length
  const drafts        = orders.filter(o => o.status === 'BROUILLON').length

  const changeStatus = async (id: string, status: OrderStatus) => {
    try { await ordersApi.updateStatus(id, LOCAL_TO_API_STATUS[status] ?? status) } catch {}
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    setViewOrder(prev => prev?.id === id ? { ...prev, status } : prev)
    toast.success(`${i('Statut mis à jour', 'Status updated', 'Estado actualizado', 'Stato aggiornato')} → ${orderStatusLabel(status, lang)}`)
  }

  const openNewOrderModal = () => {
    setNewOrderForm({ clientName: '', clientPhone: '', items: [], note: '' })
    setSelectedClient(null)
    setClientSuggestions([])
    setShowClientDropdown(false)
    setProductSearch('')
    setOrderType('client')
    setSelectedSupplierId('')
    setShowNewOrderModal(true)
  }

  const handleCreateOrder = async () => {
    const canCreate = orderType === 'client'
      ? newOrderForm.clientName.trim() !== '' && newOrderForm.items.length > 0
      : selectedSupplierId !== '' && newOrderForm.items.length > 0
    if (!canCreate) return

    const total = newOrderForm.items.reduce((s, i) => s + i.price * i.qty, 0)
    const defaultExpected = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0] })()
    const supplierObj = orderType === 'supplier' ? suppliersList.find(s => s.id === selectedSupplierId) : null
    const displayName = orderType === 'client' ? newOrderForm.clientName : (supplierObj?.name ?? '')

    const newOrder: Order = {
      id: String(Date.now()),
      ref: `CMD-2026-${String(orders.length + 90).padStart(3, '0')}`,
      supplier: displayName,
      date: new Date().toISOString().split('T')[0],
      expectedAt: defaultExpected,
      status: 'BROUILLON',
      total,
      type: orderType,
      items: newOrderForm.items.map(i => ({ product: `${i.emoji} ${i.name}`, qty: i.qty, unit: 'unité', unitPrice: i.price })),
      notes: newOrderForm.note,
    }
    try {
      if (orderType === 'client') {
        await ordersApi.create({ clientName: newOrderForm.clientName, clientPhone: newOrderForm.clientPhone, items: newOrderForm.items, total, note: newOrderForm.note, type: 'client' })
      } else {
        await ordersApi.create({ supplierId: selectedSupplierId, supplierName: supplierObj?.name, items: newOrderForm.items, total, note: newOrderForm.note, type: 'supplier' })
      }
    } catch {}
    setOrders(prev => [newOrder, ...prev])
    setShowNewOrderModal(false)
    toast.success(orderType === 'client'
      ? i(`✅ Commande créée — ${fmt(total)}`, `✅ Order created — ${fmt(total)}`, `✅ Pedido creado — ${fmt(total)}`, `✅ Ordine creato — ${fmt(total)}`)
      : i(`📦 Bon de commande envoyé à ${supplierObj?.name}`, `📦 PO sent to ${supplierObj?.name}`, `📦 Orden enviada a ${supplierObj?.name}`, `📦 Ordine inviato a ${supplierObj?.name}`)
    )
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

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_orders')}</h1>
          <p className="page-subtitle">{orders.length} {i('commandes fournisseurs', 'purchase orders', 'pedidos a proveedores', 'ordini fornitori')}</p>
        </div>
        <button className="topbar-btn" onClick={openNewOrderModal}>
          <Plus size={14} /> {lang === 'fr' ? 'Nouvelle commande' : lang === 'en' ? 'New order' : lang === 'es' ? 'Nueva orden' : 'Nuovo ordine'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('orders_engaged'),        value: fmt(totalEngaged),      color: 'var(--p2)',    hex: '#6C47FF', icon: <DollarSign  size={18} /> },
          { label: t('status_transit'),        value: String(pending),        color: 'var(--acc)',   hex: '#FF9500', icon: <Truck       size={18} /> },
          { label: t('orders_received_month'), value: String(receivedMonth),  color: 'var(--acc2)', hex: '#00D084', icon: <CheckCircle size={18} /> },
          { label: t('status_draft'),          value: String(drafts),         color: 'var(--text3)', hex: '#8888A8', icon: <Package     size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{
            background: `linear-gradient(135deg,${k.hex}18,${k.hex}06)`,
            border: `1px solid ${k.hex}28`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div className="kpi-icon-w" style={{ color: k.color, background: `${k.hex}20` }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg3)', borderRadius: 10, padding: 4, marginBottom: 4 }}>
        {[
          { id: 'list',     icon: <List size={14} />,         label: i('Liste', 'List', 'Lista', 'Elenco') },
          { id: 'calendar', icon: <CalendarDays size={14} />, label: i('Calendrier', 'Calendar', 'Calendario', 'Calendario') },
        ].map(tab => (
          <button key={tab.id} type="button"
            onClick={() => setOrdersTab(tab.id as any)}
            style={{
              flex: 1, padding: '8px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
              background: ordersTab === tab.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'transparent',
              color: ordersTab === tab.id ? '#fff' : 'var(--text2)',
              border: 'none', transition: 'all .15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar view */}
      {ordersTab === 'calendar' && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><CalendarDays size={14}/> {i('Calendrier des livraisons', 'Delivery calendar', 'Calendario de entregas', 'Calendario consegne')}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="mini-btn" onClick={prevMonth}>← {i('Préc.', 'Prev', 'Ant.', 'Prec.')}</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {currentMonth.toLocaleDateString(
                  lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'it-IT',
                  { month: 'long', year: 'numeric' }
                )}
              </span>
              <button className="mini-btn" onClick={nextMonth}>{i('Suiv.', 'Next', 'Sig.', 'Succ.')} →</button>
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
                          <div key={j} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(14,196,126,.15)', color: 'var(--acc2)', borderRadius: 4, padding: '2px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${lang === 'en' ? 'Delivery' : lang === 'es' ? 'Entrega' : lang === 'it' ? 'Consegna' : 'Livraison'}: ${o.supplier}`}>
                            ▸ {o.supplier.slice(0, 8)}
                          </div>
                        ))}
                        {ordered.slice(0, 2).map((o, j) => (
                          <div key={j} style={{ fontSize: 9, fontWeight: 700, background: 'rgba(91,78,232,.12)', color: 'var(--p2)', borderRadius: 4, padding: '2px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${lang === 'en' ? 'Order' : lang === 'es' ? 'Pedido' : lang === 'it' ? 'Ordine' : 'Commande'}: ${o.ref}`}>
                            · {o.ref.slice(-6)}
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
                    {i('Livraison prévue', 'Expected delivery', 'Entrega prevista', 'Consegna prevista')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(91,78,232,.2)' }} />
                    {i('Commande passée', 'Order placed', 'Pedido realizado', 'Ordine effettuato')}
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
          <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Package size={14}/> {t('orders_title')}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_commandes',
                [i('Référence', 'Reference', 'Referencia', 'Riferimento'), i('Fournisseur', 'Supplier', 'Proveedor', 'Fornitore'), i('Date', 'Date', 'Fecha', 'Data'), i('Livraison prévue', 'Expected delivery', 'Entrega prevista', 'Consegna prevista'), i('Articles', 'Items', 'Artículos', 'Articoli'), i('Montant', 'Amount', 'Importe', 'Importo'), i('Statut', 'Status', 'Estado', 'Stato')],
                orders.map(o => [o.ref, o.supplier, o.date, o.expectedAt, o.items.length, o.total, orderStatusLabel(o.status, lang)])
              )
              toast.success(i('📊 Export CSV téléchargé !', '📊 CSV export downloaded!', '📊 ¡Exportación CSV descargada!', '📊 Esportazione CSV scaricata!'))
            }}>
              <Download size={13} /> {t('btn_export')}
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printOrdersListPDF(); toast.success(i('📄 PDF ouvert !', '📄 PDF opened!', '📄 ¡PDF abierto!', '📄 PDF aperto!')) }}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={openNewOrderModal}>
              <Plus size={13} /> {i('Nouvelle commande', 'New order', 'Nueva orden', 'Nuovo ordine')}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-40">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder={i('🔍 Référence, fournisseur…', '🔍 Reference, supplier…', '🔍 Referencia, proveedor…', '🔍 Riferimento, fornitore…')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">{t('pos_all')} {t('col_status').toLowerCase()}</option>
            {STATUSES.map(s => <option key={s} value={s}>{orderStatusLabel(s, lang)}</option>)}
          </select>
          <select className="input py-2 text-sm w-auto" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}>
            <option value="">{t('pos_all')} {t('col_supplier').toLowerCase()}</option>
            {supplierNames.map(s => <option key={s}>{s}</option>)}
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
                {orderStatusLabel(s, lang)} ({count})
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('col_ref')}</th>
                <th scope="col">{i('Type', 'Type', 'Tipo', 'Tipo')}</th>
                <th scope="col">{i('Client / Fournisseur', 'Client / Supplier', 'Cliente / Proveedor', 'Cliente / Fornitore')}</th>
                <th scope="col">{t('orders_date')}</th>
                <th scope="col">{t('orders_expected')}</th>
                <th scope="col">{t('orders_articles')}</th>
                <th scope="col">{t('col_amount')}</th>
                <th scope="col">{t('col_status')}</th>
                <th scope="col">{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '8px 14px' }}><Skeleton height={34} count={6} radius={8} /></td></tr>
              ) : (<>
              {pg.paginated.map(o => {
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
                    <td>
                      {o.type === 'supplier'
                        ? <span className="badge badge-amber" style={{ fontSize: 10, display:'inline-flex', alignItems:'center', gap:3 }}><Truck size={9}/> {i('BC', 'PO', 'OC', 'OA')}</span>
                        : <span className="badge badge-blue" style={{ fontSize: 10, display:'inline-flex', alignItems:'center', gap:3 }}><Users size={9}/> {i('Vente', 'Sale', 'Venta', 'Vendita')}</span>
                      }
                    </td>
                    <td className="td-bold">{o.supplier}</td>
                    <td className="td-mono text-xs">{new Date(o.date).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}</td>
                    <td className="td-mono text-xs" style={{ color: isLate ? 'var(--danger)' : 'var(--text2)' }}>
                      {new Date(o.expectedAt).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}
                    </td>
                    <td>
                      <span className="badge badge-gray">{o.items.length} {o.items.length > 1 ? i('articles', 'items', 'artículos', 'articoli') : i('article', 'item', 'artículo', 'articolo')}</span>
                    </td>
                    <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(o.total)}</td>
                    <td>
                      <span className={`badge ${cfg.cls} flex items-center gap-1 w-fit`}>
                        {cfg.icon} {orderStatusLabel(o.status, lang)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn btn-sm btn-ghost" onClick={() => setViewOrder(o)} title={i('Voir détails', 'View details', 'Ver detalles', 'Vedi dettagli')}>
                          <Eye size={12} />
                        </button>
                        {o.status === 'BROUILLON' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => changeStatus(o.id, 'ENVOYÉE')}>
                            <Send size={11}/> {t('btn_send')}
                          </button>
                        )}
                        {o.status === 'ENVOYÉE' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--p3)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => changeStatus(o.id, 'CONFIRMÉE')}>
                            <CheckCircle size={11}/> {t('btn_confirm')}
                          </button>
                        )}
                        {o.status === 'CONFIRMÉE' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--acc)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => changeStatus(o.id, 'EN TRANSIT')}>
                            <Truck size={11}/> {t('status_transit')}
                          </button>
                        )}
                        {o.status === 'EN TRANSIT' && (
                          <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--acc2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', display:'inline-flex', alignItems:'center', gap:4 }}
                            onClick={() => changeStatus(o.id, 'REÇUE')}>
                            <Inbox size={11}/> {t('status_received')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--text3)' }}>{i('Aucune commande trouvée', 'No orders found', 'Sin pedidos', 'Nessun ordine trovato')}</td></tr>
              )}
              </>)}
            </tbody>
          </table>
        </div>
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
      </div>}

      {/* ── Modal détail commande ── */}
      {viewOrder && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setViewOrder(null)}>
          <div className="modal-box" style={{ maxWidth: 580 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                  <Package size={16}/> {viewOrder.ref}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  {viewOrder.supplier} · {new Date(viewOrder.date).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${STATUS_CONFIG[viewOrder.status].cls} flex items-center gap-1`}>
                  {STATUS_CONFIG[viewOrder.status].icon} {orderStatusLabel(viewOrder.status, lang)}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewOrder(null)}><X size={14} /></button>
              </div>
            </div>

            {/* Infos */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: i('Fournisseur', 'Supplier', 'Proveedor', 'Fornitore'), value: viewOrder.supplier },
                { label: i('Livraison prévue', 'Expected delivery', 'Entrega prevista', 'Consegna prevista'), value: new Date(viewOrder.expectedAt).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT')) },
                { label: i('Montant total', 'Total amount', 'Importe total', 'Importo totale'), value: fmt(viewOrder.total) },
                { label: i('Nb articles', 'Items count', 'Nº artículos', 'N° articoli'), value: `${viewOrder.items.length} ${viewOrder.items.length > 1 ? i('lignes', 'lines', 'líneas', 'righe') : i('ligne', 'line', 'línea', 'riga')}` },
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
                  <tr><th scope="col">{i('Produit', 'Product', 'Producto', 'Prodotto')}</th><th scope="col">{i('Qté', 'Qty', 'Cant.', 'Qtà')}</th><th scope="col">{i('Unité', 'Unit', 'Unidad', 'Unità')}</th><th scope="col">{i('PU', 'UP', 'PU', 'PU')}</th><th scope="col">Total</th></tr>
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
              <div className="p-3 rounded-xl text-xs mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--acc)', display:'flex', gap:6, alignItems:'flex-start' }}>
                <FileText size={12} style={{ flexShrink:0, marginTop:1 }}/> {viewOrder.notes}
              </div>
            )}

            {/* Actions progression */}
            <div className="flex gap-2">
              {viewOrder.status === 'BROUILLON' && (
                <button className="btn btn-primary flex-1 justify-center"
                  style={{ display:'flex', alignItems:'center', gap:6 }}
                  onClick={() => changeStatus(viewOrder.id, 'ENVOYÉE')}>
                  <Send size={14}/> {i('Envoyer au fournisseur', 'Send to supplier', 'Enviar al proveedor', 'Invia al fornitore')}
                </button>
              )}
              {viewOrder.status === 'EN TRANSIT' && (
                <button className="btn btn-primary flex-1 justify-center"
                  style={{ background: 'linear-gradient(135deg,var(--acc2),#059669)', display:'flex', alignItems:'center', gap:6 }}
                  onClick={() => changeStatus(viewOrder.id, 'REÇUE')}>
                  <Inbox size={14}/> {i('Confirmer la réception', 'Confirm receipt', 'Confirmar recepción', 'Conferma ricezione')}
                </button>
              )}
              {!['ANNULÉE','REÇUE'].includes(viewOrder.status) && (
                <button className="btn btn-ghost"
                  style={{ display:'flex', alignItems:'center', gap:6 }}
                  onClick={() => { changeStatus(viewOrder.id, 'ANNULÉE'); setViewOrder(null) }}>
                  <XCircle size={14}/> {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
                </button>
              )}
              <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={() => { printOrderPDF(viewOrder); toast.success(i('📄 PDF ouvert !', '📄 PDF opened!', '📄 ¡PDF abierto!', '📄 PDF aperto!')) }}><Printer size={14}/> PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nouvelle commande ── */}
      {showNewOrderModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          onClick={e => e.target === e.currentTarget && setShowNewOrderModal(false)}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 20, width: '100%', maxWidth: 640,
            maxHeight: '92vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,.5)',
          }}>

            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', margin: 0, display:'flex', alignItems:'center', gap:8 }}>
                <ClipboardList size={18}/> {lang === 'fr' ? 'Nouvelle commande' : lang === 'en' ? 'New order' : lang === 'es' ? 'Nueva orden' : 'Nuovo ordine'}
              </h2>
              <button onClick={() => setShowNewOrderModal(false)} style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                cursor: 'pointer', color: 'var(--text3)', fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><X size={15}/></button>
            </div>

            {/* Corps scrollable */}
            <div style={{
              flex: 1, overflowY: 'auto', minHeight: 0,
              padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16,
            }}>

              {/* Toggle type commande */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" onClick={() => { setOrderType('client'); setSelectedSupplierId('') }}
                  style={{
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'var(--font)', transition: 'all .15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: orderType === 'client' ? 'rgba(108,71,255,.15)' : 'var(--bg4)',
                    border: `2px solid ${orderType === 'client' ? 'rgba(108,71,255,.4)' : 'var(--border)'}`,
                  }}>
                  <Users size={22} style={{ color: orderType === 'client' ? 'var(--p3)' : 'var(--text3)' }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: orderType === 'client' ? 'var(--p3)' : 'var(--text2)' }}>
                    {i('Commande client', 'Customer order', 'Pedido cliente', 'Ordine cliente')}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {i('Vente à un client', 'Sale to customer', 'Venta a un cliente', 'Vendita a un cliente')}
                  </span>
                </button>
                <button type="button" onClick={() => { setOrderType('supplier'); setNewOrderForm(f => ({ ...f, clientName: '', clientPhone: '' })) }}
                  style={{
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'var(--font)', transition: 'all .15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: orderType === 'supplier' ? 'rgba(240,165,0,.12)' : 'var(--bg4)',
                    border: `2px solid ${orderType === 'supplier' ? 'rgba(240,165,0,.35)' : 'var(--border)'}`,
                  }}>
                  <Truck size={22} style={{ color: orderType === 'supplier' ? 'var(--acc)' : 'var(--text3)' }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: orderType === 'supplier' ? 'var(--acc)' : 'var(--text2)' }}>
                    {i('Bon de commande', 'Purchase order', 'Orden de compra', 'Ordine acquisto')}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {i('Achat chez fournisseur', 'Order from supplier', 'Compra a proveedor', 'Acquisto da fornitore')}
                  </span>
                </button>
              </div>

              {/* Formulaire client OU sélecteur fournisseur */}
              {orderType === 'client' ? (
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
                    {i('NOM CLIENT *', 'CLIENT NAME *', 'NOMBRE CLIENTE *', 'NOME CLIENTE *')}
                  </label>

                  {/* Input avec icône */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={15} style={{ position: 'absolute', left: 12, color: 'var(--text3)', pointerEvents: 'none', zIndex: 1 }}/>
                    <input className="input" style={{ paddingLeft: 38 }} autoComplete="off"
                      aria-label="Rechercher" placeholder={i('Rechercher ou saisir un client…', 'Search or enter a client…', 'Buscar o ingresar un cliente…', 'Cerca o inserisci un cliente…')}
                      value={newOrderForm.clientName}
                      onChange={e => {
                        const val = e.target.value
                        setNewOrderForm(f => ({ ...f, clientName: val }))
                        setSelectedClient(null)
                        const matches = val.trim().length >= 1
                          ? customers.filter(c => c.name.toLowerCase().includes(val.toLowerCase()) || (c.phone && c.phone.includes(val)))
                          : customers
                        setClientSuggestions(matches.slice(0, 6))
                        setShowClientDropdown(true)
                      }}
                      onFocus={() => {
                        const matches = newOrderForm.clientName.trim()
                          ? customers.filter(c => c.name.toLowerCase().includes(newOrderForm.clientName.toLowerCase()))
                          : customers
                        setClientSuggestions(matches.slice(0, 6))
                        setShowClientDropdown(true)
                      }}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                    />
                    {(newOrderForm.clientName || selectedClient) && (
                      <button type="button" tabIndex={-1}
                        onClick={() => {
                          setNewOrderForm(f => ({ ...f, clientName: '', clientPhone: '' }))
                          setSelectedClient(null)
                          setClientSuggestions(customers.slice(0, 6))
                          setShowClientDropdown(true)
                        }}
                        style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, display: 'flex', alignItems: 'center' }}><X size={14}/></button>
                    )}
                  </div>

                  {/* Badge client sélectionné */}
                  {selectedClient && (() => {
                    const color = selectedClient.type === 'Grossiste' ? '#6C47FF' : selectedClient.type === 'Semi-gros' ? '#FF9500' : selectedClient.type === 'Fidèle' ? '#00D084' : '#00B8FF'
                    return (
                      <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,208,132,.08)', border: '1px solid rgba(0,208,132,.2)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, background: `${color}22`, border: `1px solid ${color}44`, color }}>
                          {selectedClient.name[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={12}/> {selectedClient.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 8 }}>
                            {selectedClient.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Phone size={10}/> {selectedClient.phone}</span>}
                            {selectedClient.type && <span>· {selectedClient.type}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Dropdown suggestions */}
                  {showClientDropdown && clientSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 999, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.6)' }}>
                      <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{i('CLIENTS EXISTANTS', 'EXISTING CLIENTS', 'CLIENTES EXISTENTES', 'CLIENTI ESISTENTI')}</span>
                        <span>{clientSuggestions.length} {i('résultat', 'result', 'resultado', 'risultato')}{clientSuggestions.length > 1 ? 's' : ''}</span>
                      </div>
                      {clientSuggestions.map((customer, i) => {
                        const color = customer.type === 'Grossiste' ? '#6C47FF' : customer.type === 'Semi-gros' ? '#FF9500' : customer.type === 'Fidèle' ? '#00D084' : '#00B8FF'
                        const bgAlpha = customer.type === 'Grossiste' ? 'rgba(108,71,255,.15)' : customer.type === 'Semi-gros' ? 'rgba(255,149,0,.15)' : customer.type === 'Fidèle' ? 'rgba(0,208,132,.15)' : 'rgba(0,184,255,.15)'
                        return (
                          <button key={customer.id} type="button"
                            onMouseDown={() => {
                              setSelectedClient(customer)
                              setNewOrderForm(f => ({ ...f, clientName: customer.name, clientPhone: customer.phone ?? '' }))
                              setShowClientDropdown(false)
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < clientSuggestions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background .1s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.08)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, background: bgAlpha, color }}>
                              {customer.name[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 8, marginTop: 1, alignItems: 'center' }}>
                                {customer.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Phone size={10}/> {customer.phone}</span>}
                                {customer.type && <span style={{ padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 700, background: bgAlpha, color }}>{customer.type}</span>}
                              </div>
                            </div>
                            {customer.totalCA > 0 && <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--acc)', fontWeight: 700, flexShrink: 0 }}>{fmt(customer.totalCA)}</div>}
                          </button>
                        )
                      })}
                      {/* Option "Nouveau client" */}
                      <button type="button"
                        onMouseDown={() => setShowClientDropdown(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'rgba(108,71,255,.06)', borderTop: '1px solid rgba(108,71,255,.1)', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.12)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(108,71,255,.06)'}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(108,71,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={16} style={{ color:'var(--p3)' }}/></div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--p3)' }}>
                            {i(`Nouveau client "${newOrderForm.clientName || '…'}"`, `New client "${newOrderForm.clientName || '…'}"`, `Nuevo cliente "${newOrderForm.clientName || '…'}"`, `Nuovo cliente "${newOrderForm.clientName || '…'}"`)}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{i('Créer et continuer', 'Create and continue', 'Crear y continuar', 'Crea e continua')}</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Aucun résultat */}
                  {showClientDropdown && clientSuggestions.length === 0 && newOrderForm.clientName.trim().length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 999, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.6)' }}>
                      <button type="button" onMouseDown={() => setShowClientDropdown(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        <Plus size={20} style={{ color:'var(--p3)' }}/>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--p3)' }}>{i(`Créer "${newOrderForm.clientName}"`, `Create "${newOrderForm.clientName}"`, `Crear "${newOrderForm.clientName}"`, `Creare "${newOrderForm.clientName}"`)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{i('Nouveau client — pas encore enregistré', 'New client — not yet registered', 'Nuevo cliente — aún no registrado', 'Nuovo cliente — non ancora registrato')}</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
                    {i('FOURNISSEUR *', 'SUPPLIER *', 'PROVEEDOR *', 'FORNITORE *')}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {suppliersList.filter(s => s.status !== 'inactive').map(supplier => {
                      const isSel = selectedSupplierId === supplier.id
                      return (
                        <button key={supplier.id} type="button" onClick={() => setSelectedSupplierId(supplier.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px', borderRadius: 11, cursor: 'pointer',
                            fontFamily: 'var(--font)', textAlign: 'left', transition: 'all .15s',
                            background: isSel ? 'rgba(240,165,0,.1)' : 'var(--bg4)',
                            border: `1.5px solid ${isSel ? 'rgba(240,165,0,.35)' : 'var(--border)'}`,
                          }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            background: isSel ? 'rgba(240,165,0,.15)' : 'rgba(255,255,255,.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}><Truck size={18} style={{ color: isSel ? 'var(--acc)' : 'var(--text3)' }}/></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? 'var(--acc)' : 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {supplier.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8 }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Package size={10}/> {supplier.specialty}</span>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Clock size={10}/> {supplier.leadTime}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                            <div style={{ display:'flex', gap:2 }}>{Array.from({ length: supplier.rating ?? 0 }, (_, i) => <Star key={i} size={10} style={{ fill:'var(--acc)', color:'var(--acc)' }}/>)}</div>
                            {supplier.phone && <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{supplier.phone}</div>}
                          </div>
                          {isSel && (
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#000', fontWeight: 900, flexShrink: 0 }}>✓</div>
                          )}
                        </button>
                      )
                    })}
                    {suppliersList.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 13 }}>
                        <Truck size={28} style={{ color:'var(--text3)', marginBottom: 8 }}/>
                        {i('Aucun fournisseur disponible', 'No suppliers available', 'Ningún proveedor disponible', 'Nessun fornitore disponibile')}
                      </div>
                    )}
                  </div>
                  {selectedSupplierId && (() => {
                    const s = suppliersList.find(x => x.id === selectedSupplierId)
                    if (!s) return null
                    return (
                      <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, display: 'flex', gap: 14, alignItems: 'center', background: 'rgba(240,165,0,.06)', border: '1px solid rgba(240,165,0,.15)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)', marginBottom: 4, display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={12}/> {s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Package size={10}/> {s.specialty}</span>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Clock size={10}/> {i('Délai', 'Lead time', 'Plazo', 'Tempo')} : {s.leadTime}</span>
                            {s.phone && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Phone size={10}/> {s.phone}</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedSupplierId('')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, padding: '4px' }}>✕</button>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Recherche + grille produits */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
                  {i('ARTICLES', 'ITEMS', 'ARTÍCULOS', 'ARTICOLI')}
                </label>
                <input className="input" type="search"
                  aria-label="Rechercher" placeholder={i('🔍 Rechercher un produit…', '🔍 Search product…', '🔍 Buscar un producto…', '🔍 Cerca un prodotto…')}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))',
                  gap: 8, maxHeight: 200, overflowY: 'auto', padding: '2px',
                }}>
                  {availableProducts
                    .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                    .map(product => {
                      const inCart = newOrderForm.items.find(i => i.id === product.id)
                      return (
                        <button key={product.id} type="button"
                          onClick={() => {
                            if (inCart) {
                              setNewOrderForm(f => ({ ...f, items: f.items.filter(i => i.id !== product.id) }))
                            } else {
                              setNewOrderForm(f => ({ ...f, items: [...f.items, { id: product.id, name: product.name, price: product.price, qty: 1, emoji: product.emoji ?? '📦' }] }))
                            }
                          }}
                          style={{
                            background: inCart ? 'rgba(108,71,255,.12)' : 'var(--bg3)',
                            border: `1px solid ${inCart ? 'rgba(108,71,255,.35)' : 'var(--border)'}`,
                            borderRadius: 10, padding: '10px 8px', cursor: 'pointer',
                            textAlign: 'center', transition: 'all .15s',
                            fontFamily: 'var(--font)', position: 'relative',
                          }}>
                          {inCart && (
                            <div style={{
                              position: 'absolute', top: 4, right: 4,
                              width: 16, height: 16, borderRadius: '50%',
                              background: 'var(--p)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, color: '#fff', fontWeight: 900,
                            }}>✓</div>
                          )}
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{product.emoji ?? '📦'}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc)', fontFamily: 'var(--mono)' }}>{fmt(product.price)}</div>
                        </button>
                      )
                    })
                  }
                </div>
              </div>

              {/* Récapitulatif avec contrôle quantités */}
              {newOrderForm.items.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 8 }}>
                    {i('RÉCAPITULATIF', 'SUMMARY', 'RESUMEN', 'RIEPILOGO')} ({newOrderForm.items.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {newOrderForm.items.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', background: 'var(--bg3)',
                        border: '1px solid var(--border)', borderRadius: 10,
                      }}>
                        <span style={{ fontSize: 16 }}>{item.emoji}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button type="button"
                            onClick={() => setNewOrderForm(f => ({ ...f, items: f.items.map(i => i.id === item.id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i) }))}
                            style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{item.qty}</span>
                          <button type="button"
                            onClick={() => setNewOrderForm(f => ({ ...f, items: f.items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i) }))}
                            style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12, color: 'var(--acc)', minWidth: 70, textAlign: 'right' }}>{fmt(item.price * item.qty)}</span>
                        <button type="button"
                          onClick={() => setNewOrderForm(f => ({ ...f, items: f.items.filter(i => i.id !== item.id) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 15, padding: '2px 4px', display:'flex', alignItems:'center' }}><X size={13}/></button>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', padding: '10px 12px',
                      background: 'rgba(108,71,255,.06)', border: '1px solid rgba(108,71,255,.12)', borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        TOTAL ({newOrderForm.items.reduce((s, i) => s + i.qty, 0)} {i('art.', 'items', 'art.', 'art.')})
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--acc2)', fontFamily: 'var(--mono)' }}>
                        {fmt(newOrderForm.items.reduce((s, i) => s + i.price * i.qty, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
                  {i('NOTE (optionnel)', 'NOTE (optional)', 'NOTA (opcional)', 'NOTA (opzionale)')}
                </label>
                <textarea className="input" rows={2} style={{ resize: 'vertical' }}
                  placeholder={i('Instructions livraison, conditions…', 'Delivery instructions, conditions…', 'Instrucciones de entrega, condiciones…', 'Istruzioni di consegna, condizioni…')}
                  value={newOrderForm.note}
                  onChange={e => setNewOrderForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid var(--border)',
              flexShrink: 0, display: 'flex', gap: 8, background: 'var(--bg2)',
            }}>
              {(() => {
                const canCreate = orderType === 'client'
                  ? newOrderForm.clientName.trim() !== '' && newOrderForm.items.length > 0
                  : selectedSupplierId !== '' && newOrderForm.items.length > 0
                return (
                  <button disabled={!canCreate} onClick={handleCreateOrder}
                    style={{
                      flex: 1, padding: '12px', border: 'none', borderRadius: 12,
                      background: canCreate ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg4)',
                      color: canCreate ? '#fff' : 'var(--text3)',
                      fontSize: 14, fontWeight: 800, fontFamily: 'var(--font)',
                      cursor: canCreate ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'all .15s',
                    }}>
                    {orderType === 'client' ? <ClipboardList size={14}/> : <Package size={14}/>}
                    {orderType === 'client'
                      ? (i('Créer la commande', 'Create order', 'Crear el pedido', 'Crea ordine'))
                      : (i('Créer le bon de commande', 'Create PO', 'Crear orden de compra', 'Crea ordine acquisto'))}
                    {newOrderForm.items.length > 0 && (
                      <span style={{ fontSize: 12, opacity: .8 }}>— {newOrderForm.items.reduce((s, i) => s + i.qty, 0)} art.</span>
                    )}
                  </button>
                )
              })()}
              <button onClick={() => setShowNewOrderModal(false)} style={{
                padding: '12px 18px', background: 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 12,
                cursor: 'pointer', color: 'var(--text2)', fontSize: 13,
                fontFamily: 'var(--font)', fontWeight: 600,
              }}>
                {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
