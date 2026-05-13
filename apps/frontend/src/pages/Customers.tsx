import { useState } from 'react'
import { useAppStore, formatCurrency } from '@/stores/appStore'
import { Search, Plus, Download, Phone, Mail, X, Pencil, Trash2, Gift } from 'lucide-react'
import toast from 'react-hot-toast'

type ClientType = 'RETAIL' | 'WHOLESALE' | 'SEMI_WHOLESALE'

interface Customer {
  id: number
  name: string
  email: string
  phone: string
  address: string
  type: ClientType
  loyalty: number
  balance: number
  totalPurchases: number
  lastPurchase: string
  active: boolean
}

const TYPE_LABELS: Record<ClientType, string> = {
  RETAIL: 'Détail',
  WHOLESALE: 'Grossiste',
  SEMI_WHOLESALE: 'Demi-gros',
}
const TYPE_COLORS: Record<ClientType, string> = {
  RETAIL: 'badge-teal',
  WHOLESALE: 'badge-violet',
  SEMI_WHOLESALE: 'badge-amber',
}

const CUSTOMERS_INIT: Customer[] = [
  { id: 1,  name: 'Fatou Diallo',      email: 'fatou@gmail.com',     phone: '+221 77 123 45 67', address: 'Médina, Dakar',           type: 'RETAIL',        loyalty: 1250, balance: 0,       totalPurchases: 428000,   lastPurchase: '2026-05-12', active: true  },
  { id: 2,  name: 'Mamadou Sarr',      email: 'msarr@orange.sn',     phone: '+221 78 234 56 78', address: 'Pikine, Dakar',           type: 'RETAIL',        loyalty:  840, balance: 15000,   totalPurchases: 312000,   lastPurchase: '2026-05-11', active: true  },
  { id: 3,  name: 'Épicerie du Coin',  email: 'edc@outlook.com',     phone: '+221 33 820 11 22', address: 'Plateau, Dakar',          type: 'SEMI_WHOLESALE',loyalty: 3800, balance: -25000,  totalPurchases: 1850000,  lastPurchase: '2026-05-10', active: true  },
  { id: 4,  name: 'Aminata Kouyaté',  email: '',                     phone: '+221 76 345 67 89', address: 'Guédiawaye',              type: 'RETAIL',        loyalty:  320, balance: 0,       totalPurchases: 145000,   lastPurchase: '2026-05-08', active: true  },
  { id: 5,  name: 'Grossiste Ndiaye',  email: 'ndiaye.gros@sn.com',  phone: '+221 33 825 44 55', address: 'Sandaga, Dakar',          type: 'WHOLESALE',     loyalty: 9200, balance: 0,       totalPurchases: 12500000, lastPurchase: '2026-05-12', active: true  },
  { id: 6,  name: 'Mariama Bah',       email: 'mbah@yahoo.fr',       phone: '+221 70 456 78 90', address: 'Parcelles Assainies',     type: 'RETAIL',        loyalty:  620, balance: 5000,    totalPurchases: 235000,   lastPurchase: '2026-05-09', active: true  },
  { id: 7,  name: 'Dist. Abidjan SA',  email: 'dist@abjci.com',      phone: '+225 27 22 10 33',  address: 'Abidjan, Adjamé',         type: 'WHOLESALE',     loyalty: 6500, balance: -80000,  totalPurchases: 8200000,  lastPurchase: '2026-05-07', active: true  },
  { id: 8,  name: 'Ibrahima Faye',     email: 'ibra.faye@mail.sn',   phone: '+221 77 567 89 01', address: 'Thiès',                   type: 'RETAIL',        loyalty:  180, balance: 0,       totalPurchases:  78000,   lastPurchase: '2026-04-30', active: true  },
  { id: 9,  name: 'Safi Market',       email: 'safi@hotmail.com',    phone: '+221 33 942 22 33', address: 'Mbour, Petite Côte',      type: 'SEMI_WHOLESALE',loyalty: 2100, balance: 0,       totalPurchases:  950000,  lastPurchase: '2026-05-05', active: true  },
  { id: 10, name: 'Moussa Traoré',     email: '',                     phone: '+223 76 123 45 67', address: 'Bamako, Lafiabougou',     type: 'RETAIL',        loyalty:   90, balance: 0,       totalPurchases:  42000,   lastPurchase: '2026-04-22', active: false },
]

const EMPTY_FORM = { name: '', email: '', phone: '', address: '', type: 'RETAIL' as ClientType, loyalty: 0, balance: 0 }

export default function Customers() {
  const { currency } = useAppStore()
  const [customers, setCustomers] = useState(CUSTOMERS_INIT)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const active   = customers.filter(c => c.active)
  const filtered = active.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) || c.email.toLowerCase().includes(search.toLowerCase())) &&
    (!typeFilter || c.type === typeFilter)
  )

  const totalCA      = active.reduce((s, c) => s + c.totalPurchases, 0)
  const panierMoyen  = active.length ? totalCA / active.length : 0
  const fideles      = active.filter(c => c.loyalty >= 1000).length

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true) }
  const openEdit = (c: Customer) => {
    setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, type: c.type, loyalty: c.loyalty, balance: c.balance })
    setEditId(c.id); setShowModal(true)
  }

  const save = () => {
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    if (editId !== null) {
      setCustomers(prev => prev.map(c => c.id === editId ? { ...c, ...form } : c))
      toast.success('✅ Client modifié')
    } else {
      const id = Math.max(...customers.map(c => c.id)) + 1
      setCustomers(prev => [...prev, { id, ...form, totalPurchases: 0, lastPurchase: new Date().toISOString().slice(0, 10), active: true }])
      toast.success('✅ Client ajouté')
    }
    setShowModal(false)
  }

  const archive = (id: number) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, active: false } : c))
    toast.success('Client archivé')
  }

  return (
    <div className="space-y-5 animate-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clients actifs',    value: String(active.length),                 icon: '👥', color: 'var(--primary2)' },
          { label: 'CA total clients',  value: formatCurrency(totalCA, currency),     icon: '💰', color: 'var(--teal)'     },
          { label: 'Panier moyen',      value: formatCurrency(panierMoyen, currency), icon: '🛒', color: 'var(--amber)'    },
          { label: 'Clients fidèles',   value: String(fideles),                       icon: '🎁', color: 'var(--green)'    },
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
          <span className="panel-title">👥 Clients CRM</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('📊 Export CSV en cours…')}>
              <Download size={13} /> CSV
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={openAdd}>
              <Plus size={13} /> Ajouter
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-box flex-1 min-w-48">
            <Search size={13} className="search-icon" />
            <input className="input pl-8 py-2 text-sm w-full" placeholder="Nom, téléphone, email…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th><th>Contact</th><th>Type</th>
                <th>Fidélité</th><th>Solde</th><th>Total achats</th><th>Dernier achat</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="td-bold">{c.name}</div>
                    {c.address && <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{c.address}</div>}
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      {c.email && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text2)' }}><Mail size={10}/>{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text2)' }}><Phone size={10}/>{c.phone}</span>}
                    </div>
                  </td>
                  <td><span className={`badge ${TYPE_COLORS[c.type]} text-xs`}>{TYPE_LABELS[c.type]}</span></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Gift size={11} style={{ color: 'var(--amber)' }} />
                      <span className="td-num text-xs" style={{ color: c.loyalty >= 1000 ? 'var(--amber)' : 'var(--text2)' }}>
                        {c.loyalty.toLocaleString('fr-FR')} pts
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="td-num text-xs" style={{ color: c.balance < 0 ? 'var(--danger)' : c.balance > 0 ? 'var(--amber)' : 'var(--text3)' }}>
                      {c.balance !== 0 ? formatCurrency(c.balance, currency) : '—'}
                    </span>
                  </td>
                  <td className="td-num" style={{ color: 'var(--teal)' }}>{formatCurrency(c.totalPurchases, currency)}</td>
                  <td className="text-xs" style={{ color: 'var(--text3)' }}>
                    {new Date(c.lastPurchase).toLocaleDateString('fr-FR')}
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(c)} title="Modifier"><Pencil size={12} /></button>
                      <button className="btn btn-sm btn-ghost" onClick={() => archive(c.id)} title="Archiver"
                        style={{ color: 'var(--danger)' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-sm" style={{ color: 'var(--text3)' }}>Aucun client trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                {editId !== null ? '✏️ Modifier client' : '➕ Nouveau client'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Nom complet *', key: 'name',    type: 'text',  span: true  },
                { label: 'Email',          key: 'email',   type: 'email', span: false },
                { label: 'Téléphone',      key: 'phone',   type: 'text',  span: false },
                { label: 'Adresse',        key: 'address', type: 'text',  span: true  },
              ] as const).map(f => (
                <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{f.label}</label>
                  <input className="input text-sm" type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Type</label>
                <select className="input text-sm" value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as ClientType }))}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Solde (F CFA)</label>
                <input className="input text-sm" type="number" value={form.balance}
                  onChange={e => setForm(p => ({ ...p, balance: +e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" onClick={save}>
                {editId !== null ? '💾 Enregistrer' : '✅ Ajouter'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
