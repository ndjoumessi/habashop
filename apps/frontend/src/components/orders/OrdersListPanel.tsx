import Skeleton from '@/components/ui/skeleton'
import Pagination from '@/components/ui/Pagination'
import FilterSelect from '@/components/ui/FilterSelect'
import { Search, Download, Plus, Eye, CheckCircle, Truck, Package, Users, Send, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'
import { useConfig, useFormatAmount, convertFromXOF, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { exportCSV } from '@/utils/export'
import { type Order, type OrderStatus, STATUS_CONFIG, STATUSES, orderStatusLabel, OrderStatusPill } from './ordersShared'

interface PaginationApi {
  page: number; totalPages: number; total: number; pageSize: number
  paginated: Order[]; onPage: (p: number) => void; onSize: (n: number) => void
}

interface Props {
  orders: Order[]
  filtered: Order[]
  pg: PaginationApi
  loading: boolean
  search: string; setSearch: (v: string) => void
  statusFilter: OrderStatus | ''; setStatusFilter: (v: OrderStatus | '') => void
  supplierFilter: string; setSupplierFilter: (v: string) => void
  supplierNames: string[]
  changeStatus: (id: string, status: OrderStatus) => void
  setViewOrder: (o: Order) => void
  openNewOrderModal: () => void
  printOrdersListPDF: () => void
}

export default function OrdersListPanel({
  orders, filtered, pg, loading, search, setSearch, statusFilter, setStatusFilter,
  supplierFilter, setSupplierFilter, supplierNames, changeStatus, setViewOrder,
  openNewOrderModal, printOrdersListPDF,
}: Props) {
  const { lang, currency } = useConfig()
  const { i } = useI18n()
  const fmt = useFormatAmount()
  // Montants stockés en base XOF → convertis vers la devise d'affichage (pattern reportsExport)
  const cv = (xof: number) => Math.round(convertFromXOF(xof ?? 0, currency) * 100) / 100
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Package size={14}/> {t('orders_title')}</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
            exportCSV('habashop_commandes',
              [i('Référence', 'Reference', 'Referencia', 'Riferimento'), i('Fournisseur', 'Supplier', 'Proveedor', 'Fornitore'), i('Date', 'Date', 'Fecha', 'Data'), i('Livraison prévue', 'Expected delivery', 'Entrega prevista', 'Consegna prevista'), i('Articles', 'Items', 'Artículos', 'Articoli'), `${i('Montant', 'Amount', 'Importe', 'Importo')} (${currency})`, i('Statut', 'Status', 'Estado', 'Stato')],
              orders.map(o => [o.ref, o.supplier, o.date, o.expectedAt, o.items.length, cv(o.total), orderStatusLabel(o.status, lang)])
            )
            toast.success(i('Export CSV téléchargé !', 'CSV export downloaded!', '¡Exportación CSV descargada!', 'Esportazione CSV scaricata!'))
          }}>
            <Download size={13} /> {t('btn_export')}
          </button>
          <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printOrdersListPDF(); toast.success(i('PDF ouvert !', 'PDF opened!', '¡PDF abierto!', 'PDF aperto!')) }}>
            <Download size={13} /> PDF
          </button>
          <button className="btn btn-primary btn-sm gap-1.5" onClick={openNewOrderModal}>
            <Plus size={13} /> {i('Nouvelle commande', 'New order', 'Nueva orden', 'Nuovo ordine')}
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="search-wrap flex-1 min-w-40">
          <span className="search-icon"><Search size={13} /></span>
          <input className="input pl-8 py-2 text-sm w-full"
            aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')}
            placeholder={i('Référence, fournisseur', 'Reference, supplier', 'Referencia, proveedor', 'Riferimento, fornitore') + '…'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <FilterSelect
          value={statusFilter} onChange={v => setStatusFilter(v as any)}
          ariaLabel={t('col_status')}
          minWidth={150}
          options={[
            { value: '', label: i('Tous les statuts', 'All statuses', 'Todos los estados', 'Tutti gli stati') },
            ...STATUSES.map(s => ({ value: s, label: orderStatusLabel(s, lang) })),
          ]}
        />
        <FilterSelect
          value={supplierFilter} onChange={setSupplierFilter}
          ariaLabel={t('col_supplier')}
          minWidth={160}
          icon={<Truck size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
          options={[
            { value: '', label: i('Tous les fournisseurs', 'All suppliers', 'Todos los proveedores', 'Tutti i fornitori') },
            ...supplierNames.map(s => ({ value: s, label: s })),
          ]}
        />
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
          aria-pressed={!statusFilter}
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
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            >
              {orderStatusLabel(s, lang)} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="table-wrap data-table">
        <table aria-label={t('orders_title')}>
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
              const isLate = o.status === 'EN TRANSIT' && new Date(o.expectedAt) < new Date()
              return (
                <tr key={o.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="td-mono">{o.ref}</span>
                      {isLate && <span className="badge badge-red text-xs">{i('Retard', 'Late', 'Retrasado', 'In ritardo')}</span>}
                    </div>
                  </td>
                  <td>
                    {o.type === 'supplier'
                      ? <span className="badge badge-amber" style={{ fontSize: 11, display:'inline-flex', alignItems:'center', gap:3 }}><Truck size={9}/> {i('BC', 'PO', 'OC', 'OA')}</span>
                      : <span className="badge badge-blue" style={{ fontSize: 11, display:'inline-flex', alignItems:'center', gap:3 }}><Users size={9}/> {i('Vente', 'Sale', 'Venta', 'Vendita')}</span>
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
                    <OrderStatusPill status={o.status} lang={lang} />
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
    </div>
  )
}
