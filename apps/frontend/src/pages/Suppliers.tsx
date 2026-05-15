import { useState } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { Search, Download, Plus, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV } from '@/utils/export'

type SupplierStatus = 'Actif' | 'Pause' | 'Inactif'

interface SupplierOrder { ref: string; date: string; total: number; status: string }

interface Supplier {
  id: string; name: string; categories: string[]; phone: string
  email: string; address: string; contact: string
  leadTime: number; rating: number; status: SupplierStatus
  orders: SupplierOrder[]; notes: string
}

const SUPPLIERS_INIT: Supplier[] = [
  {
    id: '1', name: 'SONACO', categories: ['Corps gras'], phone: '+221 33 123 45 67',
    email: 'commandes@sonaco.sn', address: 'Zone Industrielle, Dakar', contact: 'M. Diallo',
    leadTime: 3, rating: 4, status: 'Actif',
    orders: [
      { ref: 'CMD-2026-089', date: '2026-05-10', total: 1250000, status: 'EN TRANSIT' },
      { ref: 'CMD-2026-075', date: '2026-04-20', total: 890000,  status: 'REÇUE' },
    ],
    notes: 'Fournisseur principal huiles alimentaires',
  },
  {
    id: '2', name: 'SENRIZ', categories: ['Céréales'], phone: '+221 33 234 56 78',
    email: 'info@senriz.sn', address: 'Route de Rufisque, Dakar', contact: 'Mme Ndiaye',
    leadTime: 5, rating: 5, status: 'Actif',
    orders: [
      { ref: 'CMD-2026-088', date: '2026-05-08', total: 980000, status: 'REÇUE' },
      { ref: 'CMD-2026-070', date: '2026-04-10', total: 760000, status: 'REÇUE' },
    ],
    notes: 'Leader riz local parfumé',
  },
  {
    id: '3', name: 'CSS', categories: ['Épicerie'], phone: '+221 33 345 67 89',
    email: 'ventes@css.sn', address: 'Richard-Toll, Saint-Louis', contact: 'M. Mbaye',
    leadTime: 7, rating: 4, status: 'Actif',
    orders: [
      { ref: 'CMD-2026-087', date: '2026-05-06', total: 560000, status: 'CONFIRMÉE' },
    ],
    notes: 'Compagnie Sucrière Sénégalaise',
  },
  {
    id: '4', name: 'UNILEVER', categories: ['Hygiène', 'Corps gras'], phone: '+221 33 456 78 90',
    email: 'b2b@unilever.sn', address: 'Zone Franche, Dakar', contact: 'Mme Sow',
    leadTime: 10, rating: 3, status: 'Pause',
    orders: [
      { ref: 'CMD-2026-086', date: '2026-05-03', total: 325000, status: 'ENVOYÉE' },
    ],
    notes: 'Délais parfois longs, qualité constante',
  },
  {
    id: '5', name: 'NESTLÉ', categories: ['Laitiers'], phone: '+221 33 567 89 01',
    email: 'pro@nestle.sn', address: 'Plateau, Dakar', contact: 'M. Fall',
    leadTime: 5, rating: 5, status: 'Actif',
    orders: [
      { ref: 'CMD-2026-085', date: '2026-04-28', total: 440000, status: 'REÇUE' },
      { ref: 'CMD-2026-065', date: '2026-03-15', total: 510000, status: 'REÇUE' },
    ],
    notes: 'Excellent service, prix négociés',
  },
  {
    id: '6', name: 'TOMAPOR', categories: ['Conserves'], phone: '+221 33 678 90 12',
    email: 'export@tomapor.sn', address: 'Pikine, Dakar', contact: 'M. Thiam',
    leadTime: 4, rating: 3, status: 'Inactif',
    orders: [
      { ref: 'CMD-2026-084', date: '2026-04-25', total: 168000, status: 'BROUILLON' },
    ],
    notes: 'Contrat en renégociation',
  },
]

const STATUS_CFG: Record<SupplierStatus, { cls: string }> = {
  Actif:   { cls: 'badge-green' },
  Pause:   { cls: 'badge-amber' },
  Inactif: { cls: 'badge-gray'  },
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#F0A500' : 'var(--bg4)', fontSize: 13 }}>★</span>
      ))}
    </div>
  )
}

export default function Suppliers() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const [suppliers, setSuppliers] = useState(SUPPLIERS_INIT)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | ''>('')
  const [catFilter, setCatFilter] = useState('')
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '', categories: '', phone: '', email: '', address: '',
    contact: '', leadTime: 5, rating: 4, status: 'Actif' as SupplierStatus, notes: '',
  })

  const allCats = Array.from(new Set(suppliers.flatMap(s => s.categories)))

  const filtered = suppliers.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.contact.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || s.status === statusFilter) &&
    (!catFilter || s.categories.includes(catFilter))
  )

  const actifs    = suppliers.filter(s => s.status === 'Actif').length
  const enCours   = suppliers.flatMap(s => s.orders).filter(o => ['ENVOYÉE', 'CONFIRMÉE', 'EN TRANSIT'].includes(o.status)).length
  const avgRating = (suppliers.reduce((s, sup) => s + sup.rating, 0) / suppliers.length).toFixed(1)

  const addSupplier = () => {
    const newS: Supplier = {
      id: String(Date.now()),
      name: form.name,
      categories: form.categories.split(',').map(c => c.trim()).filter(Boolean),
      phone: form.phone, email: form.email, address: form.address,
      contact: form.contact, leadTime: form.leadTime, rating: form.rating,
      status: form.status, orders: [], notes: form.notes,
    }
    setSuppliers(prev => [newS, ...prev])
    setShowCreate(false)
    setForm({ name: '', categories: '', phone: '', email: '', address: '', contact: '', leadTime: 5, rating: 4, status: 'Actif', notes: '' })
    toast.success(`✅ Fournisseur ${newS.name} ajouté !`)
  }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total fournisseurs',            value: suppliers.length.toString(), color: 'var(--p2)',   icon: '🏭' },
          { label: t('suppliers_active'),          value: actifs.toString(),            color: 'var(--acc2)', icon: '✅' },
          { label: t('suppliers_pending_orders'),  value: enCours.toString(),           color: 'var(--acc)',  icon: '🚚' },
          { label: t('suppliers_avg_rating'),      value: `${avgRating} ★`,            color: 'var(--acc)',  icon: '⭐' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">🏭 {t('suppliers_title')}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_fournisseurs',
                ['Nom','Catégories','Téléphone','Délai','Note','Statut'],
                suppliers.map(s => [s.name, s.categories.join(', '), s.phone, s.leadTime + 'j', s.rating + '/5', s.status])
              )
              toast.success('📊 Export CSV téléchargé !')
            }}>
              <Download size={13} /> {t('btn_export')}
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
            <input className="input pl-8 py-2 text-sm w-full" placeholder="🔍 Nom, contact…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">{t('pos_all')} {t('col_status').toLowerCase()}</option>
            <option>Actif</option><option>Pause</option><option>Inactif</option>
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
                <th>{t('col_supplier')}</th><th>{t('col_category')}</th><th>{t('col_phone')}</th>
                <th>{t('col_delivery')}</th><th>{t('col_rating')}</th><th>{t('col_status')}</th><th>{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="td-bold">{s.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{s.contact}</div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {s.categories.map(c => <span key={c} className="badge badge-teal">{c}</span>)}
                    </div>
                  </td>
                  <td className="td-mono">{s.phone}</td>
                  <td><span className="badge badge-gray">{s.leadTime}j</span></td>
                  <td><StarRating rating={s.rating} /></td>
                  <td><span className={`badge ${STATUS_CFG[s.status].cls}`}>{s.status}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn btn-sm btn-ghost" title="Voir fiche" onClick={() => setViewSupplier(s)}>
                        <Eye size={12} />
                      </button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(91,78,232,0.15)', color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                        onClick={() => toast.success(`📦 Commande vers ${s.name} créée`)}>
                        📦 Commander
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text3)' }}>Aucun fournisseur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal fiche fournisseur ── */}
      {viewSupplier && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewSupplier(null)}>
          <div className="modal-box" style={{ maxWidth: 580 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>🏭 {viewSupplier.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{viewSupplier.contact} · {viewSupplier.address}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${STATUS_CFG[viewSupplier.status].cls}`}>{viewSupplier.status}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewSupplier(null)}><X size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Téléphone',       value: viewSupplier.phone },
                { label: 'Email',           value: viewSupplier.email },
                { label: 'Délai livraison', value: `${viewSupplier.leadTime} jours` },
                { label: 'Catégories',      value: viewSupplier.categories.join(', ') },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: 'var(--bg3)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>Note :</span>
              <StarRating rating={viewSupplier.rating} />
              <span className="text-sm font-bold" style={{ color: 'var(--acc)' }}>{viewSupplier.rating}/5</span>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>Historique commandes</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Référence</th><th>Date</th><th>Montant</th><th>Statut</th></tr></thead>
                  <tbody>
                    {viewSupplier.orders.map(o => (
                      <tr key={o.ref}>
                        <td className="td-mono text-xs">{o.ref}</td>
                        <td className="td-mono text-xs">{new Date(o.date).toLocaleDateString('fr-FR')}</td>
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
                      <tr><td colSpan={4} className="text-center py-4" style={{ color: 'var(--text3)' }}>Aucune commande</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {viewSupplier.notes && (
              <div className="p-3 rounded-xl text-xs mb-4"
                style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)', color: 'var(--acc)' }}>
                📝 {viewSupplier.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center"
                onClick={() => { toast.success(`📦 Commande vers ${viewSupplier.name} créée`); setViewSupplier(null) }}>
                📦 Nouvelle commande
              </button>
              <button className="btn btn-ghost" onClick={() => setViewSupplier(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nouveau fournisseur ── */}
      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>➕ Nouveau fournisseur</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nom / Raison sociale',         key: 'name',       type: 'text',   span: true  },
                { label: 'Contact principal',             key: 'contact',    type: 'text',   span: false },
                { label: 'Téléphone',                     key: 'phone',      type: 'text',   span: false },
                { label: 'Email',                         key: 'email',      type: 'email',  span: true  },
                { label: 'Adresse',                       key: 'address',    type: 'text',   span: true  },
                { label: 'Catégories (séparées par , )',  key: 'categories', type: 'text',   span: true  },
                { label: 'Délai livraison (jours)',       key: 'leadTime',   type: 'number', span: false },
                { label: 'Note (1-5)',                    key: 'rating',     type: 'number', span: false },
              ].map(f => (
                <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--text3)' }}>{f.label}</label>
                  <input className="input text-sm" type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? +e.target.value : e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Statut</label>
                <select className="input text-sm" value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value as SupplierStatus }))}>
                  <option>Actif</option><option>Pause</option><option>Inactif</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
                <textarea className="input text-sm" rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" onClick={addSupplier}>✅ {t('btn_add')} le fournisseur</button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>{t('btn_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
