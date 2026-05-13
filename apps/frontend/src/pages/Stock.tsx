import { useState } from 'react'
import { Search, Plus, AlertTriangle, Package, Filter, Download } from 'lucide-react'
import { useAppStore, formatCurrency } from '@/stores/appStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Product {
  id: number; sku: string; name: string; category: string
  stock: number; threshold: number; price: number; supplier: string
}

const INITIAL_PRODUCTS: Product[] = [
  { id: 1, sku: 'HU-PAL-5L', name: 'Huile Palme 5L', category: 'Corps gras', stock: 0, threshold: 10, price: 8500, supplier: 'SONACO' },
  { id: 2, sku: 'RI-PAR-25', name: 'Riz Parfumé 25kg', category: 'Céréales', stock: 120, threshold: 20, price: 24500, supplier: 'SENRIZ' },
  { id: 3, sku: 'SU-BLC-50', name: 'Sucre Blanc 50kg', category: 'Épicerie', stock: 8, threshold: 15, price: 32000, supplier: 'CSS' },
  { id: 4, sku: 'LA-POU-25', name: 'Lait Poudre 2.5kg', category: 'Laitiers', stock: 32, threshold: 10, price: 18500, supplier: 'NESTLE' },
  { id: 5, sku: 'SA-OMO-1K', name: 'Savon OMO 1kg', category: 'Hygiène', stock: 200, threshold: 30, price: 2800, supplier: 'UNILEVER' },
  { id: 6, sku: 'FA-BLE-50', name: 'Farine de blé 50kg', category: 'Céréales', stock: 7, threshold: 20, price: 28000, supplier: 'GRANDS MOULINS' },
  { id: 7, sku: 'TO-CON-85', name: 'Tomate Concentrée 850g', category: 'Conserves', stock: 150, threshold: 20, price: 1200, supplier: 'TOMAPOR' },
  { id: 8, sku: 'SA-MEN-40', name: 'Savon Ménage 400g', category: 'Hygiène', stock: 400, threshold: 50, price: 650, supplier: 'UNILEVER' },
]

export default function Stock() {
  const { currency } = useAppStore()
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('Tous')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ sku: '', name: '', category: 'Céréales', stock: 0, threshold: 10, price: 0, supplier: '' })

  const categories = ['Tous', ...Array.from(new Set(products.map(p => p.category)))]

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)
    const matchCat = filterCat === 'Tous' || p.category === filterCat
    return matchSearch && matchCat
  })

  const lowStock = products.filter(p => p.stock <= p.threshold)

  const getStatus = (p: Product) => {
    if (p.stock === 0) return { label: 'Rupture', class: 'badge-red' }
    if (p.stock <= p.threshold) return { label: 'Faible', class: 'badge-orange' }
    return { label: 'OK', class: 'badge-green' }
  }

  const addProduct = () => {
    const newP: Product = { ...form, id: Date.now() }
    setProducts(prev => [...prev, newP])
    setShowModal(false)
    setForm({ sku: '', name: '', category: 'Céréales', stock: 0, threshold: 10, price: 0, supplier: '' })
    toast.success('Produit ajouté !')
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Alertes rupture */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(232,64,74,0.1)', border: '1px solid rgba(232,64,74,0.2)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
              {lowStock.length} article{lowStock.length > 1 ? 's' : ''} en rupture ou stock faible
            </p>
            <p className="text-xs" style={{ color: 'var(--text2)' }}>
              {lowStock.map(p => p.name).join(' · ')}
            </p>
          </div>
          <button className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(232,64,74,0.15)', color: 'var(--danger)' }}>
            Commander
          </button>
        </div>
      )}

      {/* KPIs stock */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total produits', value: products.length.toString(), color: 'var(--p)' },
          { label: 'Valeur du stock', value: formatCurrency(products.reduce((s, p) => s + p.stock * p.price, 0), currency), color: 'var(--acc2)' },
          { label: 'Ruptures', value: products.filter(p => p.stock === 0).length.toString(), color: 'var(--danger)' },
          { label: 'Stock faible', value: lowStock.length.toString(), color: 'var(--acc)' },
        ].map(kpi => (
          <div key={kpi.label} className="card flex items-center gap-3">
            <Package size={20} style={{ color: kpi.color }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>{kpi.label}</p>
              <p className="font-black text-lg" style={{ color: kpi.color, letterSpacing: '-0.5px' }}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
          <input className="input pl-9 w-full text-sm" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={clsx('px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all')}
              style={{
                background: filterCat === cat ? 'var(--p)' : 'var(--bg3)',
                color: filterCat === cat ? '#fff' : 'var(--text2)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <button onClick={() => toast('Export CSV...', { icon: '📊' })} className="btn-ghost flex items-center gap-2 text-sm px-3 py-2">
          <Download size={14} /> Export
        </button>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm px-3 py-2">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['SKU', 'Produit', 'Catégorie', 'Stock', 'Seuil', 'Prix unitaire', 'Fournisseur', 'Statut'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const status = getStatus(p)
                return (
                  <tr
                    key={p.id}
                    className="transition-all hover:brightness-110"
                    style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text3)' }}>{p.sku}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>{p.name}</td>
                    <td className="px-4 py-3"><span className="badge badge-purple">{p.category}</span></td>
                    <td className="px-4 py-3 font-bold" style={{ color: p.stock === 0 ? 'var(--danger)' : 'var(--text)' }}>{p.stock}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text3)' }}>{p.threshold}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--p2)' }}>{formatCurrency(p.price, currency)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text2)' }}>{p.supplier}</td>
                    <td className="px-4 py-3"><span className={clsx('badge', status.class)}>{status.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ajout produit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card w-96 space-y-4">
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Nouveau produit</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'SKU', field: 'sku', type: 'text' },
                { label: 'Nom', field: 'name', type: 'text' },
                { label: 'Stock initial', field: 'stock', type: 'number' },
                { label: 'Seuil alerte', field: 'threshold', type: 'number' },
                { label: 'Prix (F CFA)', field: 'price', type: 'number' },
                { label: 'Fournisseur', field: 'supplier', type: 'text' },
              ].map(f => (
                <div key={f.field} className={f.field === 'name' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text2)' }}>{f.label}</label>
                  <input
                    className="input text-sm w-full"
                    type={f.type}
                    value={(form as any)[f.field]}
                    onChange={e => setForm(prev => ({ ...prev, [f.field]: f.type === 'number' ? +e.target.value : e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={addProduct} className="btn-primary flex-1 py-2.5 text-sm">Ajouter</button>
              <button onClick={() => setShowModal(false)} className="btn-ghost px-4 py-2.5 text-sm">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
