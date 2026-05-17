import { useState, useEffect } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { customersApi } from '@/lib/api'
import { Search, Download, Plus, Eye, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, generateInvoice } from '@/utils/export'
import LoyaltyCard from '@/components/ui/LoyaltyCard'

type ClientType = 'Grossiste' | 'Semi-gros' | 'Fidèle' | 'Détail'

interface Purchase { ref: string; date: string; total: number; items: number }

interface Customer {
  id: string; name: string; type: ClientType; phone: string; email: string
  address: string; purchasesPerMonth: number; totalCA: number
  loyaltyPoints: number; maxLoyalty: number; since: string; lastPurchase: string
  purchases: Purchase[]; notes: string
}

const TYPE_CFG: Record<ClientType, { cls: string }> = {
  Grossiste: { cls: 'badge-violet' },
  'Semi-gros':{ cls: 'badge-blue'   },
  Fidèle:    { cls: 'badge-green'  },
  Détail:    { cls: 'badge-gray'   },
}

const CUSTOMERS_INIT: Customer[] = [
  {
    id: '1', name: 'Marché Central Sandaga', type: 'Grossiste',
    phone: '+221 77 100 20 30', email: 'sandaga@gmail.com',
    address: 'Marché Sandaga, Dakar', purchasesPerMonth: 8, totalCA: 4200000,
    loyaltyPoints: 840, maxLoyalty: 1000, since: '2024-01-15', lastPurchase: '2026-05-10',
    purchases: [
      { ref: 'VNT-2026-148', date: '2026-05-10', total: 520000, items: 6 },
      { ref: 'VNT-2026-130', date: '2026-04-28', total: 480000, items: 5 },
      { ref: 'VNT-2026-112', date: '2026-04-15', total: 610000, items: 8 },
    ],
    notes: 'Client prioritaire — livraison à domicile',
  },
  {
    id: '2', name: 'Boutique Awa Diallo', type: 'Fidèle',
    phone: '+221 76 234 56 78', email: 'awa.diallo@yahoo.fr',
    address: 'HLM, Dakar', purchasesPerMonth: 4, totalCA: 980000,
    loyaltyPoints: 420, maxLoyalty: 500, since: '2024-06-01', lastPurchase: '2026-05-08',
    purchases: [
      { ref: 'VNT-2026-145', date: '2026-05-08', total: 87000, items: 3 },
      { ref: 'VNT-2026-128', date: '2026-04-22', total: 95000, items: 4 },
    ],
    notes: '',
  },
  {
    id: '3', name: 'Super Épicerie du Plateau', type: 'Semi-gros',
    phone: '+221 33 456 78 90', email: 'epicerie.plateau@sn.com',
    address: 'Plateau, Dakar', purchasesPerMonth: 6, totalCA: 2100000,
    loyaltyPoints: 380, maxLoyalty: 500, since: '2024-03-20', lastPurchase: '2026-05-09',
    purchases: [
      { ref: 'VNT-2026-147', date: '2026-05-09', total: 215000, items: 7 },
      { ref: 'VNT-2026-132', date: '2026-04-30', total: 198000, items: 6 },
    ],
    notes: 'Paiement par virement bancaire',
  },
  {
    id: '4', name: 'Moussa Traoré', type: 'Détail',
    phone: '+221 70 567 89 01', email: '',
    address: 'Parcelles Assainies, Dakar', purchasesPerMonth: 2, totalCA: 145000,
    loyaltyPoints: 80, maxLoyalty: 200, since: '2025-02-10', lastPurchase: '2026-05-05',
    purchases: [
      { ref: 'VNT-2026-140', date: '2026-05-05', total: 18500, items: 2 },
    ],
    notes: '',
  },
  {
    id: '5', name: 'Distribution Thiès Nord', type: 'Grossiste',
    phone: '+221 77 678 90 12', email: 'distribution.thies@gmail.com',
    address: 'Thiès', purchasesPerMonth: 5, totalCA: 3400000,
    loyaltyPoints: 700, maxLoyalty: 1000, since: '2023-11-05', lastPurchase: '2026-05-07',
    purchases: [
      { ref: 'VNT-2026-143', date: '2026-05-07', total: 380000, items: 9 },
      { ref: 'VNT-2026-125', date: '2026-04-18', total: 420000, items: 10 },
    ],
    notes: 'Commandes hebdomadaires',
  },
  {
    id: '6', name: 'Fatou Seck Commerce', type: 'Semi-gros',
    phone: '+221 76 789 01 23', email: 'fatou.seck@gmail.com',
    address: 'Pikine, Dakar', purchasesPerMonth: 3, totalCA: 680000,
    loyaltyPoints: 150, maxLoyalty: 300, since: '2025-05-20', lastPurchase: '2026-05-03',
    purchases: [
      { ref: 'VNT-2026-138', date: '2026-05-03', total: 126000, items: 5 },
    ],
    notes: '',
  },
]

function LoyaltyBar({ points, max }: { points: number; max: number }) {
  const pct = Math.min(100, Math.round((points / max) * 100))
  const color = pct >= 80 ? 'var(--acc2)' : pct >= 50 ? 'var(--acc)' : 'var(--p2)'
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

function mapApiCustomer(c: any): Customer {
  return {
    id: c.id,
    name: c.name,
    type: (c.type === 'wholesale' ? 'Grossiste' : c.type === 'semi-wholesale' ? 'Semi-gros' : c.type === 'loyal' ? 'Fidèle' : 'Détail') as ClientType,
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    purchasesPerMonth: 0,
    totalCA: c.totalRevenue ?? 0,
    loyaltyPoints: c.loyaltyPoints ?? 0,
    maxLoyalty: 1000,
    since: c.createdAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    lastPurchase: c.updatedAt?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    purchases: [],
    notes: c.notes || '',
  }
}

export default function Customers() {
  const { lang } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const [customers, setCustomers] = useState(CUSTOMERS_INIT)

  useEffect(() => {
    customersApi.list()
      .then(data => setCustomers(data.map(mapApiCustomer)))
      .catch(() => {})
  }, [])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ClientType | ''>('')
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'Détail' as ClientType, phone: '', email: '', address: '', notes: '',
  })
  const [editCustomer,     setEditCustomer]     = useState<Customer | null>(null)
  const [showEditCustModal, setShowEditCustModal] = useState(false)
  const [editCustForm,     setEditCustForm]     = useState({
    name: '', type: 'Détail' as ClientType, phone: '', email: '', address: '', notes: '',
  })
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null)

  const filtered = customers.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)) &&
    (!typeFilter || c.type === typeFilter)
  )

  const now = new Date()
  const activeThisMonth = customers.filter(c => {
    const d = new Date(c.lastPurchase)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const avgCart = customers.length > 0
    ? Math.round(customers.reduce((s, c) => s + c.totalCA / Math.max(1, c.purchasesPerMonth * 12), 0) / customers.length)
    : 0
  const retentionRate = customers.length > 0
    ? Math.round((customers.filter(c => c.purchasesPerMonth >= 3).length / customers.length) * 100)
    : 0

  const printCustomersPDF = () => {
    const body = `
      <h2>${t('customers_pdf_title')}</h2>
      ${htmlTable(
        [t('col_name'), t('col_type'), t('col_phone'), t('customers_purchases'), t('customers_total_revenue'), t('col_loyalty')],
        customers.map(c => [
          c.name,
          `<span class="badge badge-purple">${c.type}</span>`,
          c.phone,
          String(c.purchasesPerMonth),
          fmt(c.totalCA),
          c.loyaltyPoints + ' pts',
        ])
      )}
    `
    openPDF(t('customers_pdf_title'), body)
  }

  const addCustomer = async () => {
    const newC: Customer = {
      id: String(Date.now()), name: form.name, type: form.type, phone: form.phone,
      email: form.email, address: form.address, purchasesPerMonth: 0, totalCA: 0,
      loyaltyPoints: 0, maxLoyalty: 200,
      since: new Date().toISOString().split('T')[0],
      lastPurchase: new Date().toISOString().split('T')[0],
      purchases: [], notes: form.notes,
    }
    try {
      const created = await customersApi.create({ name: form.name, phone: form.phone, email: form.email, address: form.address, notes: form.notes, type: form.type })
      newC.id = created.id
    } catch {}
    setCustomers(prev => [newC, ...prev])
    setShowCreate(false)
    setForm({ name: '', type: 'Détail', phone: '', email: '', address: '', notes: '' })
    toast.success(`✅ Client ${newC.name} ajouté !`)
  }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('customers_total'),       value: customers.length.toString(), color: 'var(--p2)',   icon: '👥' },
          { label: t('customers_active'),    value: activeThisMonth.toString(),  color: 'var(--acc2)', icon: '🟢' },
          { label: t('customers_avg_cart'),  value: fmt(avgCart),                color: 'var(--acc)',  icon: '🛒' },
          { label: t('customers_retention'), value: `${retentionRate}%`,         color: 'var(--p3)',   icon: '🔄' },
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
          <span className="panel-title">👥 {t('customers_title')}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_clients',
                ['Nom','Type','Téléphone','Email','Achats/mois','CA total','Points fidélité'],
                customers.map(c => [c.name, c.type, c.phone, c.email ?? '', c.purchasesPerMonth, c.totalCA, c.loyaltyPoints])
              )
              toast.success('📊 Export CSV téléchargé !')
            }}>
              <Download size={13} /> {t('btn_export')}
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { printCustomersPDF(); toast.success('📄 PDF ouvert !') }}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> {t('btn_new')} client
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-40">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder="🔍 Nom, téléphone…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}>
            <option value="">{t('pos_all')} {t('col_type').toLowerCase()}</option>
            <option>Grossiste</option><option>Semi-gros</option><option>Fidèle</option><option>Détail</option>
          </select>
        </div>

        {/* Tableau */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('col_client')}</th><th>{t('col_type')}</th><th>{t('col_phone')}</th>
                <th>{t('customers_purchases')}</th><th>{t('customers_total_revenue')}</th><th>{t('col_loyalty')}</th><th>{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="td-bold">{c.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                      Depuis {new Date(c.since).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td><span className={`badge ${TYPE_CFG[c.type].cls}`}>{c.type}</span></td>
                  <td className="td-mono">{c.phone}</td>
                  <td className="td-num" style={{ color: 'var(--text2)' }}>{c.purchasesPerMonth}×</td>
                  <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(c.totalCA)}</td>
                  <td style={{ minWidth: 120 }}><LoyaltyBar points={c.loyaltyPoints} max={c.maxLoyalty} /></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn btn-sm btn-ghost" title="Voir fiche" onClick={() => setViewCustomer(c)}>
                        <Eye size={12} />
                      </button>
                      <button className="btn btn-sm btn-ghost" title="Modifier" onClick={() => {
                        setEditCustomer(c)
                        setEditCustForm({ name:c.name, type:c.type, phone:c.phone, email:c.email??'', address:c.address??'', notes:c.notes??'' })
                        setShowEditCustModal(true)
                      }}>✏️</button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(14,196,126,0.12)', color: 'var(--acc2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                        onClick={() => toast.success(`🛒 Vente pour ${c.name}`)}>
                        🛒 Vente
                      </button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(255,215,0,0.12)', color: '#B8860B', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                        title="Carte fidélité"
                        onClick={() => setLoyaltyCustomer(c)}>
                        🎁
                      </button>
                      <button className="btn btn-sm"
                        style={{ background: 'rgba(91,78,232,0.12)', color: 'var(--p2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontFamily: 'inherit' }}
                        title="Générer un devis PDF"
                        onClick={() => generateInvoice({
                          type: 'devis',
                          lang: 'fr',
                          customer: { name: c.name, phone: c.phone },
                          items: [{ name: 'Article', qty: 1, price: 0 }],
                        })}>
                        📄
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text3)' }}>Aucun client trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal fiche client ── */}
      {viewCustomer && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewCustomer(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>👤 {viewCustomer.name}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                  Depuis {new Date(viewCustomer.since).toLocaleDateString('fr-FR')} · Dernière visite {new Date(viewCustomer.lastPurchase).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${TYPE_CFG[viewCustomer.type].cls}`}>{viewCustomer.type}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewCustomer(null)}><X size={14} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Téléphone',    value: viewCustomer.phone || '—' },
                { label: 'Email',        value: viewCustomer.email || '—' },
                { label: 'CA total',     value: fmt(viewCustomer.totalCA) },
                { label: 'Achats/mois',  value: `${viewCustomer.purchasesPerMonth} commandes` },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
                  <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--bg3)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text3)' }}>Solde fidélité</span>
                <span className="text-sm font-black" style={{ color: 'var(--acc)' }}>{viewCustomer.loyaltyPoints} pts</span>
              </div>
              <LoyaltyBar points={viewCustomer.loyaltyPoints} max={viewCustomer.maxLoyalty} />
              <p className="text-xs mt-2" style={{ color: 'var(--text3)' }}>
                Objectif : {viewCustomer.maxLoyalty} pts · Reste {Math.max(0, viewCustomer.maxLoyalty - viewCustomer.loyaltyPoints)} pts
              </p>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>Historique achats</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Référence</th><th>Date</th><th>Articles</th><th>Montant</th></tr></thead>
                  <tbody>
                    {viewCustomer.purchases.map(p => (
                      <tr key={p.ref}>
                        <td className="td-mono text-xs">{p.ref}</td>
                        <td className="td-mono text-xs">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                        <td className="text-xs" style={{ color: 'var(--text2)' }}>{p.items} art.</td>
                        <td className="td-num text-xs" style={{ color: 'var(--acc2)' }}>{fmt(p.total)}</td>
                      </tr>
                    ))}
                    {viewCustomer.purchases.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-4" style={{ color: 'var(--text3)' }}>Aucun achat</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {viewCustomer.notes && (
              <div className="p-3 rounded-xl text-xs mb-4"
                style={{ background: 'rgba(91,78,232,0.08)', border: '1px solid rgba(91,78,232,0.2)', color: 'var(--p3)' }}>
                📝 {viewCustomer.notes}
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center"
                onClick={() => { toast.success(`🛒 Vente pour ${viewCustomer.name}`); setViewCustomer(null) }}>
                🛒 Nouvelle vente
              </button>
              <button className="btn btn-ghost" onClick={() => setViewCustomer(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal modifier client ── */}
      {showEditCustModal && editCustomer && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowEditCustModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>✏️ Modifier — {editCustomer.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditCustModal(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Nom / Enseigne</label>
                <input className="input text-sm" value={editCustForm.name}
                  onChange={e => setEditCustForm(f => ({...f, name:e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Type</label>
                <select className="input text-sm" value={editCustForm.type}
                  onChange={e => setEditCustForm(f => ({...f, type:e.target.value as ClientType}))}>
                  <option>Grossiste</option><option>Semi-gros</option><option>Fidèle</option><option>Détail</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Téléphone</label>
                <input className="input text-sm" value={editCustForm.phone}
                  onChange={e => setEditCustForm(f => ({...f, phone:e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Email</label>
                <input className="input text-sm" type="email" value={editCustForm.email}
                  onChange={e => setEditCustForm(f => ({...f, email:e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Adresse</label>
                <input className="input text-sm" value={editCustForm.address}
                  onChange={e => setEditCustForm(f => ({...f, address:e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
                <textarea className="input text-sm" rows={2} value={editCustForm.notes}
                  onChange={e => setEditCustForm(f => ({...f, notes:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-ghost" onClick={() => setShowEditCustModal(false)}>{t('btn_cancel')}</button>
              <button className="btn btn-primary flex-1 justify-center" onClick={async () => {
                if (!editCustForm.name) { toast.error('Nom requis'); return }
                try { await customersApi.update(editCustomer.id, { name: editCustForm.name, phone: editCustForm.phone, email: editCustForm.email, address: editCustForm.address, notes: editCustForm.notes, type: editCustForm.type }) } catch {}
                setCustomers(prev => prev.map(c =>
                  c.id === editCustomer.id ? { ...c, ...editCustForm } : c
                ))
                setShowEditCustModal(false)
                toast.success(`✅ ${editCustForm.name} mis à jour`)
              }}>✅ Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nouveau client ── */}
      {showCreate && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>➕ Nouveau client</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Nom / Enseigne</label>
                <input className="input text-sm" placeholder="Nom du client…" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Type</label>
                <select className="input text-sm" value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as ClientType }))}>
                  <option>Grossiste</option><option>Semi-gros</option><option>Fidèle</option><option>Détail</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Téléphone</label>
                <input className="input text-sm" placeholder="+221 77…" value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Email</label>
                <input className="input text-sm" type="email" placeholder="email@exemple.com" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Adresse</label>
                <input className="input text-sm" placeholder="Adresse…" value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Notes</label>
                <textarea className="input text-sm" rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" onClick={addCustomer}>✅ {t('btn_add')} le client</button>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>{t('btn_cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {loyaltyCustomer && (
        <LoyaltyCard customer={loyaltyCustomer} onClose={() => setLoyaltyCustomer(null)} />
      )}
    </div>
  )
}
