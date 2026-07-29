import { useState, useEffect } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { ordersApi, productsApi, suppliersApi, customersApi } from '@/lib/api'
import { Plus, List, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import { openPDF, htmlTable, htmlKPIs, htmlInfoGrid } from '@/utils/export'
import { usePagination } from '@/hooks/usePagination'
import { type Order, type OrderStatus, type OrderSupplierOption, orderStatusLabel, LOCAL_TO_API_STATUS, mapApiOrder, toSupplierOption, toOrderPayload } from '@/components/orders/ordersShared'
import OrdersKpis from '@/components/orders/OrdersKpis'
import OrdersCalendar from '@/components/orders/OrdersCalendar'
import OrdersListPanel from '@/components/orders/OrdersListPanel'
import OrderDetailModal from '@/components/orders/OrderDetailModal'
import NewOrderModal, { type NewOrderForm } from '@/components/orders/NewOrderModal'
import Tabs from '@/components/ui/TabBar'

export default function Orders() {
  const { lang } = useConfig()
  const { i } = useI18n()
  const fmt = useFormatAmount()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ordersApi.list()
      .then(data => setOrders(data.map(mapApiOrder)))
      .catch(() => toast.error(i('Impossible de charger les commandes — réessayer', 'Could not load orders — please retry', 'No se pudieron cargar los pedidos — reintenta', 'Impossibile caricare gli ordini — riprova')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [newOrderForm, setNewOrderForm] = useState<NewOrderForm>({
    clientName: '', clientPhone: '',
    items: [],
    note: '',
  })
  const [suppliersList, setSuppliersList] = useState<OrderSupplierOption[]>([])
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
        data.map(toSupplierOption)
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
    try { await ordersApi.updateStatus(id, LOCAL_TO_API_STATUS[status] ?? status) } catch {
      // Échec serveur : on n'applique PAS le changement localement (sinon désynchro silencieuse)
      toast.error(i('Échec de la mise à jour du statut — réessayer', 'Status update failed — please retry', 'Error al actualizar el estado — reintenta', 'Aggiornamento stato non riuscito — riprova'))
      return
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    setViewOrder(prev => prev?.id === id ? { ...prev, status } : prev)
    toast.success(`${i('Statut mis à jour', 'Status updated', 'Estado actualizado', 'Stato aggiornato')} → ${orderStatusLabel(status, lang)}`)
    announce(`${i('Statut mis à jour', 'Status updated', 'Estado actualizado', 'Stato aggiornato')} — ${orderStatusLabel(status, lang)}`)
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
    // ⚠️ COMMANDES CLIENT = LOCALES ET ÉPHÉMÈRES, par décision produit (2026-07-29).
    // `PurchaseOrder` n'a ni `clientName`, ni `clientPhone`, ni colonne `type`, et
    // `supplierId` y est une FK OBLIGATOIRE : le modèle ne sait pas représenter une commande
    // client. L'appel serveur qui existait ici partait donc SANS `supplierId` et se faisait
    // refuser par le zod à chaque fois — un 400 systématique, dont l'utilisateur ne voyait
    // qu'un « Échec de la création ». On ne l'émet plus : la commande vit en mémoire, ce qui
    // est le comportement réel depuis toujours, désormais assumé au lieu d'être subi.
    // Persistance = dette backend (colonnes + zod) — cf. CLAUDE.md § Commandes.
    if (orderType === 'supplier') {
      try {
        // ⚠️ `toOrderPayload` — PAS `newOrderForm.items` tel quel. Les lignes du formulaire
        // sont `{ id, name, price, qty, emoji }` ; le zod exige `{ product, qty, unitPrice }`.
        // C'est cet écart qui a fait 400 sur CHAQUE création (0 commande en base).
        await ordersApi.create(toOrderPayload({
          supplierId: selectedSupplierId,
          items: newOrderForm.items,
          expectedAt: defaultExpected,
          notes: newOrderForm.note,
        }))
      } catch {
        toast.error(i('Échec de la création de la commande — réessayer', 'Order creation failed — please retry', 'Error al crear el pedido — reintenta', 'Creazione ordine non riuscita — riprova'))
        return
      }
    }
    setOrders(prev => [newOrder, ...prev])
    setShowNewOrderModal(false)
    toast.success(orderType === 'client'
      ? i(`Commande créée — ${fmt(total)}`, `Order created — ${fmt(total)}`, `Pedido creado — ${fmt(total)}`, `Ordine creato — ${fmt(total)}`)
      : i(`Bon de commande envoyé à ${supplierObj?.name}`, `PO sent to ${supplierObj?.name}`, `Orden enviada a ${supplierObj?.name}`, `Ordine inviato a ${supplierObj?.name}`)
    )
    announce(orderType === 'client'
      ? i('Commande créée', 'Order created', 'Pedido creado', 'Ordine creato')
      : i('Bon de commande envoyé', 'Purchase order sent', 'Orden de compra enviada', 'Ordine di acquisto inviato'))
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
        [t('col_product'), t('col_qty'), i('Unité', 'Unit', 'Unidad', 'Unità'), t('col_price'), t('col_amount')],
        order.items.map(item => [
          item.product, String(item.qty), item.unit === 'unité' ? i('unité', 'unit', 'unidad', 'unità') : item.unit,
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

      <OrdersKpis totalEngaged={totalEngaged} pending={pending} receivedMonth={receivedMonth} drafts={drafts} />

      {/* Tab switcher */}
      <Tabs
        variant="segmented"
        ariaLabel={i('Vue commandes', 'Orders view', 'Vista de pedidos', 'Vista ordini')}
        value={ordersTab}
        onChange={id => setOrdersTab(id as 'list' | 'calendar')}
        tabs={[
          { id: 'list',     icon: <List size={14} />,         label: i('Liste', 'List', 'Lista', 'Elenco') },
          { id: 'calendar', icon: <CalendarDays size={14} />, label: i('Calendrier', 'Calendar', 'Calendario', 'Calendario') },
        ]}
      />

      {ordersTab === 'calendar' && (
        <OrdersCalendar orders={orders} currentMonth={currentMonth} prevMonth={prevMonth} nextMonth={nextMonth} />
      )}

      {ordersTab === 'list' && (
        <OrdersListPanel
          orders={orders} filtered={filtered} pg={pg} loading={loading}
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          supplierFilter={supplierFilter} setSupplierFilter={setSupplierFilter}
          supplierNames={supplierNames}
          changeStatus={changeStatus} setViewOrder={setViewOrder}
          openNewOrderModal={openNewOrderModal} printOrdersListPDF={printOrdersListPDF}
        />
      )}

      {viewOrder && (
        <OrderDetailModal order={viewOrder} onClose={() => setViewOrder(null)} changeStatus={changeStatus} printOrderPDF={printOrderPDF} />
      )}

      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          orderType={orderType} setOrderType={setOrderType}
          newOrderForm={newOrderForm} setNewOrderForm={setNewOrderForm}
          selectedClient={selectedClient} setSelectedClient={setSelectedClient}
          clientSuggestions={clientSuggestions} setClientSuggestions={setClientSuggestions}
          showClientDropdown={showClientDropdown} setShowClientDropdown={setShowClientDropdown}
          customers={customers} suppliersList={suppliersList}
          selectedSupplierId={selectedSupplierId} setSelectedSupplierId={setSelectedSupplierId}
          availableProducts={availableProducts} productSearch={productSearch} setProductSearch={setProductSearch}
          handleCreateOrder={handleCreateOrder}
        />
      )}
    </div>
  )
}
