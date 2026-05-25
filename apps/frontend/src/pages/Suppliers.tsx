import { useState, useEffect } from 'react'
import Skeleton from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { suppliersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X, Phone, Factory, CheckCircle, Truck, Star, Pencil, Package, FileText, Trash2 } from 'lucide-react'
import ViewField from '@/components/ui/ViewField'
import { confirm } from '@/lib/confirm'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable } from '@/utils/export'
import PhoneInputWithCountry from '@/components/ui/PhoneInputWithCountry'
import AddressAutocompleteInput from '@/components/ui/AddressAutocompleteInput'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

type SupplierStatus = 'Actif' | 'Pause' | 'Inactif'
type L4 = 'fr' | 'en' | 'es' | 'it'

interface SupplierOrder { ref: string; date: string; total: number; status: string }

interface Supplier {
  id: string; name: string; categories: string[]; phone: string
  email: string; address: string; contact: string
  leadTime: number; rating: number; status: SupplierStatus
  orders: SupplierOrder[]; notes: string
}

const STATUS_CFG: Record<SupplierStatus, { cls: string }> = {
  Actif:   { cls: 'badge-green' },
  Pause:   { cls: 'badge-amber' },
  Inactif: { cls: 'badge-gray'  },
}
const STATUS_LABELS: Record<SupplierStatus, Record<L4, string>> = {
  Actif:   { fr: 'Actif',    en: 'Active',   es: 'Activo',   it: 'Attivo'   },
  Pause:   { fr: 'En pause',  en: 'On hold',  es: 'En pausa', it: 'In pausa' },
  Inactif: { fr: 'Inactif',  en: 'Inactive', es: 'Inactivo', it: 'Inattivo' },
}
const STATUS_LIST: SupplierStatus[] = ['Actif', 'Pause', 'Inactif']
const STATUS_COLOR: Record<SupplierStatus, string> = { Actif: 'var(--acc2)', Pause: 'var(--warn)', Inactif: 'var(--danger)' }

const SUPP_COLORS = ['#6C47FF','#00D084','#FF9500','#00B8FF','#FF3B5C','#F59E0B','#8B5CF6','#10B981']
function supplierColor(name: string) { return SUPP_COLORS[name.charCodeAt(0) % SUPP_COLORS.length] }

function StarRating({ rating }: { rating: number }) {
  const r = Number(rating) || 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} style={{ color: i <= r ? '#F0A500' : 'var(--border)', fill: i <= r ? '#F0A500' : 'none' }} />
      ))}
    </div>
  )
}

function mapApiSupplier(s: any): Supplier {
  return {
    id: s.id,
    name: s.name,
    categories: s.categories ? s.categories.split(',').map((c: string) => c.trim()).filter(Boolean) : [],
    phone: s.phone || '',
    email: s.email || '',
    address: s.address || '',
    contact: '',
    leadTime: s.leadTime ?? 3,
    rating: s.rating ?? 3,
    status: (s.status || 'Actif') as SupplierStatus,
    orders: [],
    notes: s.notes || '',
  }
}

export default function Suppliers() {
  const navigate = useNavigate()
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const { i } = useI18n()
  const statusLabel = (s: SupplierStatus) => STATUS_LABELS[s]?.[lang as L4] ?? s

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    suppliersApi.list()
      .then(data => setSuppliers(data.map(mapApiSupplier)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => setShowCreate(true)
    window.addEventListener('habashop:new-supplier', handler)
    return () => window.removeEventListener('habashop:new-supplier', handler)
  }, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | ''>('')
  const [catFilter, setCatFilter] = useState('')
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '', categories: '', phone: '', email: '', address: '',
    contact: '', leadTime: 5, rating: 4, status: 'Actif' as SupplierStatus, notes: '',
  })
  const [editSupplier,     setEditSupplier]     = useState<Supplier | null>(null)
  const [showEditSuppModal, setShowEditSuppModal] = useState(false)
  const [suppEditMode,     setSuppEditMode]     = useState(false)
  const [editSuppForm,     setEditSuppForm]     = useState({
    name: '', categories: '', phone: '', email: '', address: '',
    contact: '', leadTime: 5, rating: 4, status: 'Actif' as SupplierStatus, notes: '',
  })

  const allCats = Array.from(new Set(suppliers.flatMap(s => s.categories)))

  const filtered = suppliers.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.contact.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || s.status === statusFilter) &&
    (!catFilter || s.categories.includes(catFilter))
  )
  const pg = usePagination(filtered, 15)
  useEffect(() => { pg.reset() }, [search, statusFilter, catFilter])

  const actifs    = suppliers.filter(s => s.status === 'Actif').length
  const enCours   = suppliers.flatMap(s => s.orders).filter(o => ['ENVOYÉE', 'CONFIRMÉE', 'EN TRANSIT'].includes(o.status)).length
  const avgRating = suppliers.length > 0
    ? (suppliers.reduce((s, sup) => s + (Number(sup.rating) || 0), 0) / suppliers.length).toFixed(1)
    : null

  const printSuppliersPDF = () => {
    const body = `
      <h2>${t('suppliers_pdf_title')}</h2>
      ${htmlTable(
        [t('col_name'), t('col_category'), t('col_phone'), t('col_delivery'), t('col_rating'), t('col_status')],
        suppliers.map(s => [
          s.name,
          s.categories.join(', '),
          s.phone,
          s.leadTime + ' j',
          '⭐'.repeat(s.rating) + ' (' + s.rating + '/5)',
          s.status === 'Actif'
            ? `<span class="badge badge-green">${t('status_active')}</span>`
            : s.status === 'Pause'
            ? `<span class="badge badge-amber">${t('status_pending')}</span>`
            : `<span class="badge badge-red">${t('status_inactive')}</span>`,
        ])
      )}
    `
    openPDF(t('suppliers_pdf_title'), body)
  }

  const addSupplier = async () => {
    const newS: Supplier = {
      id: String(Date.now()),
      name: form.name,
      categories: form.categories.split(',').map(c => c.trim()).filter(Boolean),
      phone: form.phone, email: form.email, address: form.address,
      contact: form.contact, leadTime: form.leadTime, rating: form.rating,
      status: form.status, orders: [], notes: form.notes,
    }
    try {
      const created = await suppliersApi.create({ name: form.name, categories: form.categories, phone: form.phone, email: form.email, address: form.address, leadTime: form.leadTime, rating: form.rating, status: form.status, notes: form.notes })
      newS.id = created.id
    } catch {}
    setSuppliers(prev => [newS, ...prev])
    setShowCreate(false)
    setForm({ name: '', categories: '', phone: '', email: '', address: '', contact: '', leadTime: 5, rating: 4, status: 'Actif', notes: '' })
    toast.success(i(`✅ Fournisseur ${newS.name} ajouté !`, `✅ Supplier ${newS.name} added!`, `✅ Proveedor ${newS.name} añadido!`, `✅ Fornitore ${newS.name} aggiunto!`))
  }

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_suppliers')}</h1>
          <p className="page-subtitle">{suppliers.length} {i('fournisseurs enregistrés', 'registered suppliers', 'proveedores registrados', 'fornitori registrati')}</p>
        </div>
        <button className="topbar-btn" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> {i('Nouveau fournisseur', 'New supplier', 'Nuevo proveedor', 'Nuovo fornitore')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('suppliers_total'),           value: suppliers.length.toString(), color: 'var(--p2)',   hex: '#6C47FF', icon: <Factory       size={18} /> },
          { label: t('suppliers_active'),          value: actifs.toString(),           color: 'var(--acc2)', hex: '#00D084', icon: <CheckCircle   size={18} /> },
          { label: t('suppliers_pending_orders'),  value: enCours.toString(),          color: 'var(--acc)',  hex: '#FF9500', icon: <Truck         size={18} /> },
          { label: t('suppliers_avg_rating'),      value: avgRating ? `${avgRating}/5` : '—', color: 'var(--acc)',  hex: '#FF9500', icon: <Star          size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{
            background: `linear-gradient(135deg,${k.hex}18,${k.hex}06)`,
            border: `1px solid ${k.hex}28`,
            position: 'relative', overflow: 'hidden',
            transition: 'transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = `0 12px 36px ${k.hex}22` }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none' }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div className="kpi-icon-w" style={{ color: k.color, background: `${k.hex}20` }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">{t('suppliers_title')}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_fournisseurs',
                [t('col_name'), t('col_category'), t('col_phone'), t('col_delivery'), t('col_rating'), t('col_status')],
                suppliers.map(s => [s.name, s.categories.join(', '), s.phone, s.leadTime + 'j', s.rating + '/5', statusLabel(s.status)])
              )
              toast.success(i('📊 Export CSV téléchargé !', '📊 CSV export downloaded!', '📊 Exportación CSV descargada!', '📊 Esportazione CSV scaricata!'))
            }}>
              <Download size={13} /> {t('btn_export')}
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printSuppliersPDF(); toast.success(i('📄 PDF ouvert !', '📄 PDF opened!', '📄 PDF abierto!', '📄 PDF aperto!')) }}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> {t('btn_add')}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-40">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder={i('🔍 Nom, contact…', '🔍 Name, contact…', '🔍 Nombre, contacto…', '🔍 Nome, contatto…')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">{t('pos_all')} {t('col_status').toLowerCase()}</option>
            {STATUS_LIST.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select className="input py-2 text-sm w-auto" value={catFilter}
            onChange={e => setCatFilter(e.target.value)}>
            <option value="">{t('pos_all')} {t('col_category').toLowerCase()}</option>
            {allCats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Tableau */}
        <div className="table-wrap">
          <table>
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
                        background:`linear-gradient(135deg,${supplierColor(s.name)}22,${supplierColor(s.name)}11)`,
                        border:`1px solid ${supplierColor(s.name)}44`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:900, color:supplierColor(s.name),
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
                  <td><span className={`badge ${STATUS_CFG[s.status].cls}`}>{statusLabel(s.status)}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn btn-sm btn-ghost" title={i('Voir fiche', 'View', 'Ver', 'Vedi')} onClick={() => setViewSupplier(s)}>
                        <Eye size={12} />
                      </button>
                      <button className="btn btn-sm btn-ghost" title={`${i('Appeler', 'Call', 'Llamar', 'Chiamare')} ${s.phone}`}
                        onClick={() => toast.success(`📞 ${s.phone}`)}>
                        <Phone size={12} />
                      </button>
                      <button className="btn btn-sm btn-ghost" title={i('Modifier', 'Edit', 'Editar', 'Modifica')} style={{ cursor: 'pointer' }} onClick={() => {
                        setEditSupplier(s)
                        setEditSuppForm({
                          name: s.name, categories: s.categories.join(', '), phone: s.phone,
                          email: s.email ?? '', address: s.address ?? '', contact: s.contact ?? '',
                          leadTime: s.leadTime ?? 3, rating: s.rating ?? 3,
                          status: s.status ?? 'Actif', notes: s.notes ?? '',
                        })
                        setSuppEditMode(false)
                        setShowEditSuppModal(true)
                      }}><Pencil size={12} /></button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(91,78,232,0.15)', color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => navigate('/app/orders')}>
                        <Package size={11} /> {i('Commander', 'Order', 'Pedir', 'Ordinare')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text3)' }}>{i('Aucun fournisseur trouvé', 'No supplier found', 'Ningún proveedor encontrado', 'Nessun fornitore trovato')}</td></tr>
              )}
              </>)}
            </tbody>
          </table>
        </div>
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
      </div>

      {/* ── Modal fiche fournisseur ── */}
      {viewSupplier && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setViewSupplier(null)}>
          <div className="modal-box" style={{ maxWidth: 580 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Factory size={15}/> {viewSupplier.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{viewSupplier.contact} · {viewSupplier.address}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${STATUS_CFG[viewSupplier.status].cls}`}>{statusLabel(viewSupplier.status)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewSupplier(null)}><X size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: i('Téléphone', 'Phone', 'Teléfono', 'Telefono'),       value: viewSupplier.phone },
                { label: 'Email',           value: viewSupplier.email },
                { label: i('Délai livraison', 'Lead time', 'Plazo entrega', 'Tempo consegna'), value: `${viewSupplier.leadTime} ${i('jours', 'days', 'días', 'giorni')}` },
                { label: i('Catégories', 'Categories', 'Categorías', 'Categorie'),      value: viewSupplier.categories.join(', ') },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: 'var(--bg3)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>{i('Note', 'Rating', 'Valoración', 'Valutazione')} :</span>
              <StarRating rating={viewSupplier.rating} />
              <span className="text-sm font-bold" style={{ color: 'var(--acc)' }}>{(Number(viewSupplier.rating) || 0) > 0 ? `${(Number(viewSupplier.rating) || 0).toFixed(1)}/5` : '—'}</span>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>{i('Historique commandes', 'Order history', 'Historial de pedidos', 'Storico ordini')}</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">{i('Référence', 'Reference', 'Referencia', 'Riferimento')}</th><th scope="col">{i('Date', 'Date', 'Fecha', 'Data')}</th><th scope="col">{i('Montant', 'Amount', 'Importe', 'Importo')}</th><th scope="col">{t('col_status')}</th></tr></thead>
                  <tbody>
                    {viewSupplier.orders.map(o => (
                      <tr key={o.ref}>
                        <td className="td-mono text-xs">{o.ref}</td>
                        <td className="td-mono text-xs">{new Date(o.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'en-US')}</td>
                        <td className="td-num text-xs" style={{ color: 'var(--acc2)' }}>{fmt(o.total)}</td>
                        <td>
                          <span className={`badge ${
                            o.status === 'REÇUE'      ? 'badge-green'  :
                            o.status === 'EN TRANSIT' ? 'badge-amber'  :
                            o.status === 'CONFIRMÉE'  ? 'badge-violet' :
                            o.status === 'ENVOYÉE'    ? 'badge-blue'   : 'badge-gray'
                          }`}>{o.status}</span>
                        </td>
                      </tr>
                    ))}
                    {viewSupplier.orders.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-4" style={{ color: 'var(--text3)' }}>{i('Aucune commande', 'No orders', 'Sin pedidos', 'Nessun ordine')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {viewSupplier.notes && (
              <div className="p-3 rounded-xl text-xs mb-4"
                style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)', color: 'var(--acc)', display:'flex', gap:6, alignItems:'flex-start' }}>
                <FileText size={12} style={{ flexShrink:0, marginTop:1 }}/> {viewSupplier.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center"
                style={{ display:'flex', alignItems:'center', gap:6 }}
                onClick={() => { setViewSupplier(null); navigate('/app/orders') }}>
                <Package size={13}/> {i('Nouvelle commande', 'New order', 'Nuevo pedido', 'Nuovo ordine')}
              </button>
              <button className="btn btn-ghost" onClick={() => setViewSupplier(null)}>{i('Fermer', 'Close', 'Cerrar', 'Chiudi')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal modifier fournisseur ── */}
      {showEditSuppModal && editSupplier && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowEditSuppModal(false)}>
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Factory size={15}/> {editSupplier.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditSuppModal(false)}><X size={14} /></button>
            </div>

            {/* Mode banner */}
            {!suppEditMode
              ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                  <Eye size={13} style={{ color:'var(--acc3)', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:600 }}>
                    {i('Mode visualisation — cliquez sur Modifier pour éditer', 'View mode — click Edit to make changes', 'Modo visualización — clic en Editar para cambiar', 'Modalità visualizzazione — clicca Modifica per cambiare')}
                  </span>
                </div>
              : <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', marginBottom:16, background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                  <Pencil size={13} style={{ color:'var(--warn)', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'var(--warn)', fontWeight:600 }}>
                    {i('Mode édition — modifications non sauvegardées', 'Edit mode — unsaved changes', 'Modo edición — cambios sin guardar', 'Modalità modifica — modifiche non salvate')}
                  </span>
                </div>
            }

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <ViewField label={i('NOM / RAISON SOCIALE', 'NAME / COMPANY', 'NOMBRE / EMPRESA', 'NOME / AZIENDA')} value={editSuppForm.name} fullWidth editing={suppEditMode}>
                <input className="input text-sm" value={editSuppForm.name}
                  onChange={e => setEditSuppForm(p => ({...p, name:e.target.value}))} />
              </ViewField>
              <ViewField label={i('CONTACT PRINCIPAL', 'MAIN CONTACT', 'CONTACTO PRINCIPAL', 'CONTATTO PRINCIPALE')} value={editSuppForm.contact||''} editing={suppEditMode}>
                <input className="input text-sm" value={editSuppForm.contact}
                  onChange={e => setEditSuppForm(p => ({...p, contact:e.target.value}))} />
              </ViewField>
              <ViewField label="EMAIL" value={editSuppForm.email||''} editing={suppEditMode}>
                <input className="input text-sm" value={editSuppForm.email}
                  onChange={e => setEditSuppForm(p => ({...p, email:e.target.value}))} />
              </ViewField>
              <ViewField label={i('CATÉGORIES (séparées par ,)', 'CATEGORIES (comma-separated)', 'CATEGORÍAS (separadas por ,)', 'CATEGORIE (separate da ,)')} value={editSuppForm.categories||''} fullWidth editing={suppEditMode}>
                <input className="input text-sm" value={editSuppForm.categories}
                  onChange={e => setEditSuppForm(p => ({...p, categories:e.target.value}))} />
              </ViewField>
              <ViewField label={i('ADRESSE', 'ADDRESS', 'DIRECCIÓN', 'INDIRIZZO')} value={editSuppForm.address||''} fullWidth editing={suppEditMode}>
                <AddressAutocompleteInput value={editSuppForm.address}
                  onChange={v => setEditSuppForm(p => ({...p, address:v}))} lang={lang} />
              </ViewField>
              <ViewField label={i('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO')} value={editSuppForm.phone||''} icon="📞" editing={suppEditMode}>
                <PhoneInputWithCountry value={editSuppForm.phone} onChange={v => setEditSuppForm(p => ({...p, phone:v}))} lang={lang} />
              </ViewField>
              <ViewField label={i('DÉLAI LIVRAISON', 'LEAD TIME', 'PLAZO ENTREGA', 'TEMPO CONSEGNA')} value={`${editSuppForm.leadTime} ${i('jours', 'days', 'días', 'giorni')}`} editing={suppEditMode}>
                <input className="input text-sm" type="number" value={editSuppForm.leadTime}
                  onChange={e => setEditSuppForm(p => ({...p, leadTime:+e.target.value}))} />
              </ViewField>
              <ViewField label={i('NOTE', 'RATING', 'VALORACIÓN', 'VALUTAZIONE')} value={`${editSuppForm.rating}/5`} editing={suppEditMode}>
                <input className="input text-sm" type="number" min={1} max={5} value={editSuppForm.rating}
                  onChange={e => setEditSuppForm(p => ({...p, rating:+e.target.value}))} />
              </ViewField>
              <ViewField label="STATUT" value={statusLabel(editSuppForm.status)} editing={suppEditMode}>
                <select className="input text-sm" value={editSuppForm.status}
                  onChange={e => setEditSuppForm(p => ({...p, status:e.target.value as SupplierStatus}))}>
                  {STATUS_LIST.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </ViewField>
              <ViewField label="NOTES" value={editSuppForm.notes||''} fullWidth editing={suppEditMode}>
                <textarea className="input text-sm" rows={2} value={editSuppForm.notes}
                  onChange={e => setEditSuppForm(p => ({...p, notes:e.target.value}))} />
              </ViewField>
            </div>

            <div className="flex gap-2 mt-5">
              {!suppEditMode ? (
                <>
                  <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:6 }} onClick={() => setSuppEditMode(true)}><Pencil size={13} /> {i('Modifier', 'Edit', 'Editar', 'Modifica')}</button>
                  <button className="btn btn-ghost" style={{ color:'var(--danger)', display:'flex', alignItems:'center', gap:6 }}
                    aria-label={i('Supprimer le fournisseur', 'Delete supplier', 'Eliminar proveedor', 'Elimina fornitore')}
                    onClick={async () => {
                      if (!editSupplier) return
                      if (!(await confirm({ title: i('Supprimer le fournisseur', 'Delete supplier', 'Eliminar proveedor', 'Elimina fornitore'), message: i('Cette action est irréversible.', 'This action is irreversible.', 'Esta acción es irreversible.', 'Questa azione è irreversibile.'), danger: true }))) return
                      try {
                        await suppliersApi.delete(editSupplier.id)
                        setSuppliers(prev => prev.filter(s => s.id !== editSupplier.id))
                        setShowEditSuppModal(false)
                        toast.success(i('Fournisseur supprimé', 'Supplier deleted', 'Proveedor eliminado', 'Fornitore eliminato'))
                      } catch (e: any) { toast.error(e?.message ?? 'Erreur') }
                    }}><Trash2 size={13} /> {i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}</button>
                  <button className="btn btn-ghost" onClick={() => setShowEditSuppModal(false)}>{i('Fermer', 'Close', 'Cerrar', 'Chiudi')}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => {
                    setEditSuppForm({ name:editSupplier.name, categories:editSupplier.categories.join(', '), phone:editSupplier.phone, email:editSupplier.email??'', address:editSupplier.address??'', contact:editSupplier.contact??'', leadTime:editSupplier.leadTime??3, rating:editSupplier.rating??3, status:editSupplier.status??'Actif', notes:editSupplier.notes??'' })
                    setSuppEditMode(false)
                  }}>{t('btn_cancel')}</button>
                  <button className="btn btn-primary flex-1 justify-center" style={{ cursor:'pointer' }} onClick={async () => {
                    if (!editSuppForm.name) { toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto')); return }
                    try { await suppliersApi.update(editSupplier.id, { name: editSuppForm.name, categories: editSuppForm.categories, phone: editSuppForm.phone, email: editSuppForm.email, address: editSuppForm.address, leadTime: editSuppForm.leadTime, rating: editSuppForm.rating, status: editSuppForm.status, notes: editSuppForm.notes }) } catch {}
                    setSuppliers(prev => prev.map(s =>
                      s.id === editSupplier.id
                        ? { ...s, ...editSuppForm, categories: editSuppForm.categories.split(',').map(c => c.trim()).filter(Boolean) }
                        : s
                    ))
                    setShowEditSuppModal(false)
                    toast.success(i(`${editSuppForm.name} mis à jour`, `${editSuppForm.name} updated`, `${editSuppForm.name} actualizado`, `${editSuppForm.name} aggiornato`))
                  }}>{i('Enregistrer', 'Save', 'Guardar', 'Salva')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nouveau fournisseur ── */}
      {showCreate && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Plus size={15}/> {i('Nouveau fournisseur', 'New supplier', 'Nuevo proveedor', 'Nuovo fornitore')}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: i('Nom / Raison sociale', 'Name / Company', 'Nombre / Empresa', 'Nome / Azienda'),         key: 'name',       type: 'text',   span: true  },
                { label: i('Contact principal', 'Main contact', 'Contacto principal', 'Contatto principale'),             key: 'contact',    type: 'text',   span: false },
                { label: 'Email',                         key: 'email',      type: 'email',  span: false },
                { label: i('Catégories (séparées par , )', 'Categories (comma-separated)', 'Categorías (separadas por ,)', 'Categorie (separate da ,)'),  key: 'categories', type: 'text',   span: true  },
                { label: i('Délai livraison (jours)', 'Lead time (days)', 'Plazo entrega (días)', 'Tempo consegna (giorni)'),       key: 'leadTime',   type: 'number', span: false },
              ].map(f => (
                <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--text3)' }}>{f.label}</label>
                  <input className="input text-sm" type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? +e.target.value : e.target.value }))} />
                </div>
              ))}
              {/* Rating — clickable stars */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{i('Note (1-5)', 'Rating (1-5)', 'Valoración (1-5)', 'Valutazione (1-5)')}</label>
                <div style={{ display: 'flex', gap: 4, height: 38, alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => setForm(p => ({ ...p, rating: s }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', display: 'flex' }}>
                      <Star size={20} style={{ color: s <= form.rating ? '#F0A500' : 'var(--border2)', fill: s <= form.rating ? '#F0A500' : 'none', transition: 'all .15s' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <AddressAutocompleteInput
                  label={i('ADRESSE', 'ADDRESS', 'DIRECCIÓN', 'INDIRIZZO')}
                  value={form.address}
                  onChange={v => setForm(p => ({ ...p, address: v }))}
                  lang={lang}
                />
              </div>
              <div className="col-span-2">
                <PhoneInputWithCountry
                  label={i('TÉLÉPHONE', 'PHONE', 'TELÉFONO', 'TELEFONO')}
                  value={form.phone}
                  onChange={v => setForm(p => ({ ...p, phone: v }))}
                  lang={lang}
                />
              </div>
              {/* Statut — pill buttons */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>STATUT</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUS_LIST.map(s => {
                    const active = form.status === s
                    const color = STATUS_COLOR[s]
                    return (
                      <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))}
                        style={{ flex: 1, padding: '8px 6px', borderRadius: 10, border: `1px solid ${active ? color + '55' : 'var(--border)'}`, background: active ? color + '18' : 'transparent', color: active ? color : 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, transition: 'all .15s' }}>
                        {statusLabel(s)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
                <textarea aria-label="Notes" className="input text-sm" rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" style={{ display:'flex', alignItems:'center', gap:6 }} disabled={!form.name.trim()} onClick={addSupplier}><CheckCircle size={13}/> {i('Créer le fournisseur', 'Create supplier', 'Crear proveedor', 'Crea fornitore')}</button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>{t('btn_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
