import { useState } from 'react'
import { useAppStore, formatCurrency } from '@/stores/appStore'
import toast from 'react-hot-toast'

const PRODUCTS = [
  { sku: 'PRD-001', name: '🌾 Riz parfumé 5kg', category: 'Céréales', priceBuy: 3200, priceSell: 4500, stock: 12, threshold: 20, status: 'red', statusLabel: 'Rupture' },
  { sku: 'PRD-002', name: '🫙 Huile palme 1L', category: 'Corps gras', priceBuy: 1200, priceSell: 1800, stock: 18, threshold: 25, status: 'amber', statusLabel: 'Bas' },
  { sku: 'PRD-003', name: '🍚 Sucre 1kg', category: 'Épicerie', priceBuy: 600, priceSell: 850, stock: 245, threshold: 50, status: 'green', statusLabel: 'OK' },
  { sku: 'PRD-004', name: '🌾 Farine blé 1kg', category: 'Céréales', priceBuy: 400, priceSell: 650, stock: 89, threshold: 30, status: 'green', statusLabel: 'OK' },
  { sku: 'PRD-005', name: '🧼 Savon 500g', category: 'Hygiène', priceBuy: 320, priceSell: 500, stock: 5, threshold: 10, status: 'red', statusLabel: 'Rupture' },
  { sku: 'PRD-006', name: '🥛 Lait poudre 400g', category: 'Laitiers', priceBuy: 1500, priceSell: 2200, stock: 67, threshold: 20, status: 'green', statusLabel: 'OK' },
  { sku: 'PRD-007', name: '🫒 Huile végétale 5L', category: 'Corps gras', priceBuy: 6500, priceSell: 8500, stock: 34, threshold: 15, status: 'green', statusLabel: 'OK' },
  { sku: 'PRD-008', name: '🍅 Tomate concentrée 800g', category: 'Conserves', priceBuy: 900, priceSell: 1400, stock: 112, threshold: 30, status: 'green', statusLabel: 'OK' },
]

export default function Stock() {
  const { currency } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [products, setProducts] = useState(PRODUCTS)
  const [form, setForm] = useState({ sku: '', name: '', category: 'Céréales', priceBuy: 0, priceSell: 0, stock: 0, threshold: 5 })

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || p.category === filterCat
    const matchStatus = !filterStatus || p.statusLabel === filterStatus
    return matchSearch && matchCat && matchStatus
  })

  const ruptures = products.filter(p => p.status === 'red')
  const stockValue = products.reduce((s, p) => s + p.stock * p.priceSell, 0)

  const addProduct = () => {
    const status = form.stock === 0 ? 'red' : form.stock <= form.threshold ? 'amber' : 'green'
    const statusLabel = form.stock === 0 ? 'Rupture' : form.stock <= form.threshold ? 'Bas' : 'OK'
    setProducts(prev => [...prev, { ...form, status, statusLabel }])
    setShowModal(false)
    setForm({ sku: '', name: '', category: 'Céréales', priceBuy: 0, priceSell: 0, stock: 0, threshold: 5 })
    toast.success('Produit ajouté !')
  }

  return (
    <div className="page active" id="page-stock">
      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">📋</div>
          <div className="kpi-label">Total articles</div>
          <div className="kpi-value">{products.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">💎</div>
          <div className="kpi-label">Valeur stock</div>
          <div className="kpi-value">{formatCurrency(stockValue, currency)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-label">Alertes rupture</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{ruptures.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">📁</div>
          <div className="kpi-label">Catégories</div>
          <div className="kpi-value">{new Set(products.map(p => p.category)).size}</div>
        </div>
      </div>

      {/* Tableau inventaire */}
      <div className="panel">
        <div className="panel-h">
          <div className="panel-t">🗄️ Inventaire Produits</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="topbar-btn" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onClick={() => toast('📊 Export CSV stock')}>📊 CSV</button>
            <button className="topbar-btn" onClick={() => setShowModal(true)}>＋ Ajouter produit</button>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ width: 200, fontSize: 12 }}
            placeholder="🔍 Produit, référence…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">Toutes catégories</option>
            <option>Céréales</option><option>Corps gras</option><option>Épicerie</option>
            <option>Hygiène</option><option>Laitiers</option><option>Conserves</option>
          </select>
          <select className="form-input" style={{ width: 'auto', fontSize: 12 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option>Rupture</option><option>Bas</option><option>OK</option>
          </select>
        </div>

        <div className="scroll-x">
          <table id="stockTable">
            <thead>
              <tr>
                <th>Réf.</th><th>Produit</th><th>Catégorie</th>
                <th>Prix achat</th><th>Prix vente</th>
                <th>Stock</th><th>Seuil</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.sku}>
                  <td style={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{p.sku}</td>
                  <td className="td-bold">{p.name}</td>
                  <td>{p.category}</td>
                  <td className="cv">{formatCurrency(p.priceBuy, currency)}</td>
                  <td className="cv">{formatCurrency(p.priceSell, currency)}</td>
                  <td>
                    <span style={{
                      color: p.status === 'red' ? 'var(--danger)' : p.status === 'amber' ? 'var(--acc)' : 'inherit',
                      fontWeight: p.status !== 'green' ? 700 : 'normal'
                    }}>{p.stock}</span>
                  </td>
                  <td>{p.threshold}</td>
                  <td><span className={`pill ${p.status}`}>{p.statusLabel}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {p.status !== 'green' && (
                        <button className="mini-btn" onClick={() => toast.success(`📦 Bon de commande créé`)}>📦 Commander</button>
                      )}
                      <button className="mini-btn" onClick={() => toast(`✏️ Modifier ${p.sku}`)}>✏️ Modifier</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ajout */}
      {showModal && (
        <div className="modal-overlay show">
          <div className="modal">
            <div className="modal-h">
              <div className="modal-t">➕ Ajouter un produit</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Référence (SKU)</label>
                <input className="form-input" value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} placeholder="PRD-XXX" />
              </div>
              <div className="form-group">
                <label className="form-label">Catégorie</label>
                <select className="form-input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option>Céréales</option><option>Corps gras</option><option>Épicerie</option>
                  <option>Hygiène</option><option>Laitiers</option><option>Conserves</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nom du produit</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nom du produit…" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prix achat (F CFA)</label>
                <input className="form-input" type="number" value={form.priceBuy} onChange={e => setForm(p => ({ ...p, priceBuy: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Prix vente (F CFA)</label>
                <input className="form-input" type="number" value={form.priceSell} onChange={e => setForm(p => ({ ...p, priceSell: +e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Stock initial</label>
                <input className="form-input" type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Seuil d'alerte</label>
                <input className="form-input" type="number" value={form.threshold} onChange={e => setForm(p => ({ ...p, threshold: +e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="topbar-btn" style={{ flex: 1 }} onClick={addProduct}>✅ Ajouter le produit</button>
              <button className="topbar-btn" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={() => setShowModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
