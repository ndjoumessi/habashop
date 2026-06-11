import Skeleton from '@/components/ui/skeleton'
import Pagination from '@/components/ui/Pagination'
import FilterSelect from '@/components/ui/FilterSelect'
import { useConfig, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { Search, Download, Plus, Eye, Phone, Pencil, Package, Trash2, Factory } from 'lucide-react'
import { STATUS_LIST, statusLabel, SupplierStatusPill, StarRating } from './suppliersShared'
import type { Supplier, SupplierStatus } from './suppliersShared'

interface Pg {
  page: number; totalPages: number; total: number; pageSize: number
  paginated: Supplier[]
  onPage: (p: number) => void; onSize: (s: number) => void
}

interface Props {
  loading: boolean
  filtered: Supplier[]
  pg: Pg
  search: string; setSearch: (v: string) => void
  statusFilter: SupplierStatus | ''; setStatusFilter: (v: SupplierStatus | '') => void
  catFilter: string; setCatFilter: (v: string) => void
  allCats: string[]
  onExportCSV: () => void
  onPrintPDF: () => void
  onAdd: () => void
  onView: (s: Supplier) => void
  onEdit: (s: Supplier) => void
  onDelete: (s: Supplier) => void
  onCall: (s: Supplier) => void
  onOrder: () => void
}

export default function SuppliersTable(props: Props) {
  const {
    loading, filtered, pg, search, setSearch, statusFilter, setStatusFilter,
    catFilter, setCatFilter, allCats, onExportCSV, onPrintPDF, onAdd,
    onView, onEdit, onDelete, onCall, onOrder,
  } = props
  const { lang } = useConfig()
  const { i } = useI18n()

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">{t('suppliers_title')}</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm gap-1.5" onClick={onExportCSV}>
            <Download size={13} /> {t('btn_export')}
          </button>
          <button className="btn btn-ghost btn-sm gap-1.5" onClick={onPrintPDF}>
            <Download size={13} /> PDF
          </button>
          <button className="btn btn-primary btn-sm gap-1.5" onClick={onAdd}>
            <Plus size={13} /> {t('btn_add')}
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="search-wrap flex-1 min-w-40">
          <span className="search-icon"><Search size={13} /></span>
          <input className="input pl-8 py-2 text-sm w-full"
            aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')}
            placeholder={i('Nom, contact', 'Name, contact', 'Nombre, contacto', 'Nome, contatto') + '…'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <FilterSelect
          value={statusFilter} onChange={v => setStatusFilter(v as any)}
          ariaLabel={t('col_status')}
          minWidth={150}
          options={[
            { value: '', label: i('Tous les statuts', 'All statuses', 'Todos los estados', 'Tutti gli stati') },
            ...STATUS_LIST.map(s => ({ value: s, label: statusLabel(s, lang) })),
          ]}
        />
        <FilterSelect
          value={catFilter} onChange={setCatFilter}
          ariaLabel={t('col_category')}
          minWidth={150}
          icon={<Package size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
          options={[
            { value: '', label: i('Toutes les catégories', 'All categories', 'Todas las categorías', 'Tutte le categorie') },
            ...allCats.map(c => ({ value: c, label: c })),
          ]}
        />
      </div>

      {/* Tableau */}
      <div className="table-wrap data-table">
        <table aria-label={t('suppliers_title')}>
          <thead>
            <tr>
              <th scope="col">{t('col_supplier')}</th><th scope="col">{t('col_category')}</th><th scope="col">{t('col_phone')}</th>
              <th scope="col">{t('col_delivery')}</th><th scope="col">{t('col_rating')}</th><th scope="col">{t('col_status')}</th><th scope="col">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '8px 14px' }}><Skeleton height={34} count={6} radius={8} /></td></tr>
            ) : (<>
            {pg.paginated.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:34, height:34, borderRadius:10, flexShrink:0,
                      background:'color-mix(in srgb, var(--p) 10%, transparent)',
                      border:'1px solid color-mix(in srgb, var(--p) 16%, transparent)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:13, fontWeight:'var(--fw-semibold)' as any, color:'var(--p2)',
                    }}>{s.name[0]}</div>
                    <div>
                      <div className="td-bold">{s.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{s.contact}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {s.categories.map(c => <span key={c} className="badge badge-teal">{c}</span>)}
                  </div>
                </td>
                <td className="td-mono">{s.phone}</td>
                <td><span className="badge badge-gray">{s.leadTime}{i('j', 'd', 'd', 'g')}</span></td>
                <td><StarRating rating={s.rating} /></td>
                <td><SupplierStatusPill status={s.status} lang={lang} /></td>
                <td>
                  <div className="flex gap-1.5">
                    <button className="btn btn-sm btn-ghost stock-action" title={i('Voir fiche', 'View', 'Ver', 'Vedi')} aria-label={`${i('Voir fiche', 'View', 'Ver', 'Vedi')} ${s.name}`} onClick={() => onView(s)}>
                      <Eye size={14} />
                    </button>
                    <button className="btn btn-sm btn-ghost stock-action" title={`${i('Appeler', 'Call', 'Llamar', 'Chiamare')} ${s.phone}`}
                      aria-label={`${i('Appeler', 'Call', 'Llamar', 'Chiamare')} ${s.name} — ${s.phone}`}
                      onClick={() => onCall(s)}>
                      <Phone size={14} />
                    </button>
                    <button className="btn btn-sm btn-ghost stock-action" title={i('Modifier', 'Edit', 'Editar', 'Modifica')} aria-label={`${i('Modifier', 'Edit', 'Editar', 'Modifica')} ${s.name}`} style={{ cursor: 'pointer' }} onClick={() => onEdit(s)}><Pencil size={14} /></button>
                    <button className="btn btn-sm btn-ghost stock-action"
                      title={i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}
                      aria-label={i(`Supprimer ${s.name}`, `Delete ${s.name}`, `Eliminar ${s.name}`, `Elimina ${s.name}`)}
                      style={{ color: 'var(--danger)', cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); onDelete(s) }}>
                      <Trash2 size={14} />
                    </button>
                    <button className="btn btn-sm"
                      style={{ background: 'color-mix(in srgb, var(--p) 12%, transparent)', color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={onOrder}>
                      <Package size={11} /> {i('Commander', 'Order', 'Pedir', 'Ordinare')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text3)' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                  <Factory size={28} style={{ opacity:.45 }} aria-hidden="true" />
                  <span>{i('Aucun fournisseur trouvé', 'No supplier found', 'Ningún proveedor encontrado', 'Nessun fornitore trovato')}</span>
                </div>
              </td></tr>
            )}
            </>)}
          </tbody>
        </table>
      </div>
      <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
    </div>
  )
}
