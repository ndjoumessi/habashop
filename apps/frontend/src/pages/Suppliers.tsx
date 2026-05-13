import { useState } from 'react'
import { useAppStore, formatCurrency } from '@/stores/appStore'
import { Search, Plus, Download, Star, Phone, Mail, MapPin, X, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Supplier {
  id: number
  name: string
  email: string
  phone: string
  address: string
  country: string
  rating: number
  products: number
  orders: number
  totalSpent: number
  active: boolean
}

const SUPPLIERS_INIT: Supplier[] = [
  { id: 1, name: 'SENRIZ SA',        email: 'contact@senriz.sn',  phone: '+221 33 821 00 11', address: 'Zone industrielle de Dakar',  country: 'Sénégal',       rating: 5, products: 8,  orders: 42, totalSpent: 18500000, active: true  },
  { id: 2, name: 'SONACO',           email: 'info@sonaco.ci',      phone: '+225 27 20 30 44',  address: 'Abidjan, Zone industrielle',  country: "Côte d'Ivoire", rating: 4, products: 12, orders: 38, totalSpent: 24200000, active: true  },
  { id: 3, name: 'CSS Sénégal',      email: 'ventes@css-sn.com',  phone: '+221 33 957 20 00', address: 'Richard Toll, Saint-Louis',   country: 'Sénégal',       rating: 5, products: 3,  orders: 56, totalSpent: 31000000, active: true  },
  { id: 4, name: 'Grands Moulins',   email: 'gmds@gmds.sn',        phone: '+221 33 839 80 00', address: 'Port de Dakar',               country: 'Sénégal',       rating: 4, products: 5,  orders: 29, totalSpent: 12800000, active: true  },
  { id: 5, name: 'UNILEVER Afrique', email: 'trade@unilever.com',  phone: '+225 27 21 60 70',  address: 'Abidjan, Plateau',            country: "Côte d'Ivoire", rating: 3, products: 9,  orders: 18, totalSpent:  8400000, active: true  },
  { id: 6, name: 'NESTLÉ Sénégal',  email: 'b2b@nestle.sn',       phone: '+221 33 839 99 00', address: 'Dakar, Almadies',             country: 'Sénégal',       rating: 4, products: 7,  orders: 31, totalSpent: 16700000, active: true  },
  { id: 7, name: 'TOMAPOR',          email: 'export@tomapor.ma',   phone: '+212 5 22 30 12 34',address: 'Casablanca, Zone port',        country: 'Maroc',         rating: 3, products: 4,  orders: 14, totalSpent:  5200000, active: true  },
  { id: 8, name: 'Olam Agri Mali',   email: 'mali@olamgroup.com',  phone: '+223 20 23 08 90',  address: 'Bamako, Zone industrielle',   country: 'Mali',          rating: 4, products: 6,  orders: 22, totalSpent:  9800000, active: false },
]

const COUNTRIES = ['Sénégal', "Côte d'Ivoire", 'Mali', 'Maroc', 'Cameroun', 'RDC', 'Guinée', 'Burkina Faso']

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={13}
          fill={s <= value ? 'var(--amber)' : 'none'}
          style={{ color: 'var(--amber)', cursor: onChange ? 'pointer' : 'default' }}
          onClick={() => onChange?.(s)} />
      ))}
    </div>
  )
}

const EMPTY_FORM = { name: '', email: '', phone: '', address: '', country: 'Sénégal', rating: 3 }

export default function Suppliers() {
  const { currency } = useAppStore()
  const [suppliers, setSuppliers] = useState(SUPPLIERS_INIT)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const active = suppliers.filter(s => s.active)
  const filtered = active.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())) &&
    (!country || s.country === country)
  )

  const totalSpent = active.reduce((sum, s) => sum + s.totalSpent, 0)
  const avgRating  = active.length ? active.reduce((sum, s) => sum + s.rating, 0) / active.length : 0

  const openAdd  = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true) }
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, email: s.email, phone: s.phone, address: s.address, country: s.country, rating: s.rating })
    setEditId(s.id); setShowModal(true)
  }

  const save = () => {
    if (!form.name.trim()) { toast.error('Le nom est requis'); return }
    if (editId !== null) {
      setSuppliers(prev => prev.map(s => s.id === editId ? { ...s, ...form } : s))
      toast.success('✅ Fournisseur modifié')
    } else {
      const id = Math.max(...suppliers.map(s => s.id)) + 1
      setSuppliers(prev => [...prev, { id, ...form, products: 0, orders: 0, totalSpent: 0, active: true }])
      toast.success('✅ Fournisseur ajouté')
    }
    setShowModal(false)
  }

  const archive = (id: number) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, active: false } : s))
    toast.success('Fournisseur archivé')
  }

  return (
    <div className="space-y-5 animate-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Fournisseurs actifs', value: String(active.length),                                          icon: '🏭', color: 'var(--primary2)' },
          { label: 'Total achats',        value: formatCurrency(totalSpent, currency),                           icon: '💸', color: 'var(--teal)'     },
          { label: 'Commandes passées',   value: String(active.reduce((s, f) => s + f.orders,   0)),             icon: '📦', color: 'var(--amber)'    },
          { label: 'Note moyenne',        value: `${avgRating.toFixed(1)} / 5`,                                  icon: '⭐', color: 'var(--amber)'    },
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
          <span className="panel-title">🏭 Fournisseurs</span>
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
            <input className="input pl-8 py-2 text-sm w-full" placeholder="Rechercher un fournisseur…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">Tous les pays</option>
            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fournisseur</th><th>Contact</th><th>Pays</th>
                <th>Note</th><th>Produits</th><th>Commandes</th><th>Total achats</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="td-bold">{s.name}</div>
                    {s.address && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: 'var(--text3)' }}>
                        <MapPin size={10} />{s.address}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      {s.email && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text2)' }}><Mail size={10}/>{s.email}</span>}
                      {s.phone && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text2)' }}><Phone size={10}/>{s.phone}</span>}
                    </div>
                  </td>
                  <td><span className="badge badge-teal text-xs">{s.country}</span></td>
                  <td><StarRating value={s.rating} /></td>
                  <td className="td-num">{s.products}</td>
                  <td className="td-num">{s.orders}</td>
                  <td className="td-num" style={{ color: 'var(--amber)' }}>{formatCurrency(s.totalSpent, currency)}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(s)} title="Modifier"><Pencil size={12} /></button>
                      <button className="btn btn-sm btn-ghost" onClick={() => archive(s.id)} title="Archiver"
                        style={{ color: 'var(--danger)' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-sm" style={{ color: 'var(--text3)' }}>Aucun fournisseur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal add/edit */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                {editId !== null ? '✏️ Modifier fournisseur' : '➕ Nouveau fournisseur'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'Raison sociale *', key: 'name',    type: 'text',  span: true  },
                { label: 'Email',             key: 'email',   type: 'email', span: false },
                { label: 'Téléphone',         key: 'phone',   type: 'text',  span: false },
                { label: 'Adresse',           key: 'address', type: 'text',  span: true  },
              ] as const).map(f => (
                <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{f.label}</label>
                  <input className="input text-sm" type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>Pays</label>
                <select className="input text-sm" value={form.country}
                  onChange={e => setForm(p => ({ ...p, country: e.target.value }))}>
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>Note qualité</label>
                <StarRating value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
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
