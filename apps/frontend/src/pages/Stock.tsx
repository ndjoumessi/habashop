import { useState } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { Search, Download, Plus, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs } from '@/utils/export'

const PRODUCTS_INIT = [
  { sku: 'PRD-001', name: '🌾 Riz parfumé 5kg',       category: 'Céréales',   buy: 3200, sell: 4500, stock: 12,  threshold: 20, supplier: 'SENRIZ'         },
  { sku: 'PRD-002', name: '🫙 Huile palme 1L',          category: 'Corps gras', buy: 1200, sell: 1800, stock: 18,  threshold: 25, supplier: 'SONACO'         },
  { sku: 'PRD-003', name: '🍚 Sucre 1kg',               category: 'Épicerie',   buy: 600,  sell: 850,  stock: 245, threshold: 50, supplier: 'CSS'            },
  { sku: 'PRD-004', name: '🌾 Farine blé 1kg',          category: 'Céréales',   buy: 400,  sell: 650,  stock: 89,  threshold: 30, supplier: 'GRANDS MOULINS' },
  { sku: 'PRD-005', name: '🧼 Savon OMO 500g',          category: 'Hygiène',    buy: 320,  sell: 500,  stock: 5,   threshold: 10, supplier: 'UNILEVER'       },
  { sku: 'PRD-006', name: '🥛 Lait poudre 400g',        category: 'Laitiers',   buy: 1500, sell: 2200, stock: 67,  threshold: 20, supplier: 'NESTLÉ'         },
  { sku: 'PRD-007', name: '🫒 Huile végétale 5L',       category: 'Corps gras', buy: 6500, sell: 8500, stock: 34,  threshold: 15, supplier: 'SONACO'         },
  { sku: 'PRD-008', name: '🍅 Tomate concentrée 800g',  category: 'Conserves',  buy: 900,  sell: 1400, stock: 112, threshold: 30, supplier: 'TOMAPOR'        },
]

function statusOf(stock: number, threshold: number) {
  if (stock === 0)        return { label: t('status_out'), cls: 'badge-red'   }
  if (stock <= threshold) return { label: t('status_low'), cls: 'badge-amber' }
  return                         { label: 'OK',             cls: 'badge-green' }
}

export default function Stock() {
  const { stockLowThreshold, stockShowSKU, lang } = useConfig()
  const fmt = useFormatAmount()
  void lang // for t() reactivity

  const [products, setProducts] = useState(PRODUCTS_INIT)
  const [search, setSearch]     = useState('')
  const [cat, setCat]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    sku: '', name: '', category: 'Céréales', buy: 0, sell: 0,
    stock: 0, threshold: stockLowThreshold, supplier: '',
  })

  const cats     = ['', ...Array.from(new Set(products.map(p => p.category)))]
  const ruptures = products.filter(p => p.stock <= p.threshold)
  const totalValue = products.reduce((s, p) => s + p.stock * p.sell, 0)

  const filtered = products.filter(p => {
    const s = statusOf(p.stock, p.threshold)
    return (
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) &&
      (!cat || p.category === cat) &&
      (!statusFilter || s.label === statusFilter)
    )
  })

  const addProduct = () => {
    setProducts(prev => [...prev, form])
    setShowModal(false)
    setForm({ sku: '', name: '', category: 'Céréales', buy: 0, sell: 0, stock: 0, threshold: stockLowThreshold, supplier: '' })
    toast.success('✅ Produit ajouté !')
  }

  return (
    <div className="space-y-5 animate-in">
      {/* Alert rupture */}
      {ruptures.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
              {ruptures.length} article{ruptures.length > 1 ? 's' : ''} en rupture ou stock faible
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
              {ruptures.map(p => p.name).join(' · ')}
            </p>
          </div>
          <button className="btn btn-sm"
            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
            onClick={() => toast('📦 Bon de commande groupé créé')}>
            Commander
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('stock_total'),    value: products.length.toString(),          color: 'var(--p2)',    icon: '📋' },
          { label: t('stock_value'),   value: fmt(totalValue), color: 'var(--acc2)', icon: '💎' },
          { label: t('stock_ruptures'),value: ruptures.length.toString(),           color: 'var(--danger)',icon: '⚠️' },
          { label: t('stock_categories'),value: String(new Set(products.map(p => p.category)).size), color: 'var(--acc)', icon: '📁' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Panel inventaire */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">🗄️ {t('stock_title')}</span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              exportCSV('habashop_stock',
                ['SKU','Produit','Catégorie','Prix achat','Prix vente','Stock','Seuil','Fournisseur','Statut'],
                products.map(p => [p.sku, p.name, p.category, p.buy, p.sell, p.stock, p.threshold, p.supplier, statusOf(p.stock,p.threshold).label])
              )
              toast.success('📊 Export CSV téléchargé !')
            }}>
              <Download size={13} /> {t('btn_export')}
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              const lowStock = products.filter(p => p.stock <= p.threshold)
              const body = `
                ${htmlKPIs([
                  { label: 'Total articles',  value: String(products.length) },
                  { label: 'Valeur du stock', value: products.reduce((s,p) => s+p.stock*p.sell, 0).toLocaleString('fr-FR') + ' FCFA' },
                  { label: 'Ruptures / Bas',  value: String(lowStock.length) },
                  { label: 'Catégories',      value: String(new Set(products.map(p => p.category)).size) },
                ])}
                ${lowStock.length > 0 ? `
                  <h2 style="color:#dc2626;">⚠️ Articles en alerte (${lowStock.length})</h2>
                  ${htmlTable(
                    ['SKU','Produit','Stock actuel','Seuil','Fournisseur'],
                    lowStock.map(p => [p.sku, p.name, String(p.stock), String(p.threshold), p.supplier])
                  )}
                ` : ''}
                <h2>Inventaire complet</h2>
                ${htmlTable(
                  ['SKU','Produit','Catégorie','Prix achat','Prix vente','Stock','Seuil','Fournisseur','Statut'],
                  products.map(p => {
                    const st = statusOf(p.stock, p.threshold)
                    const cls = st.cls === 'badge-red' ? 'badge-red' : st.cls === 'badge-amber' ? 'badge-amber' : 'badge-green'
                    return [p.sku, p.name, p.category,
                      p.buy.toLocaleString('fr-FR') + ' F', p.sell.toLocaleString('fr-FR') + ' F',
                      String(p.stock), String(p.threshold), p.supplier,
                      `<span class="badge ${cls}">${st.label}</span>`]
                  }),
                  ['','','','','<strong>VALEUR TOTALE</strong>','',
                   `<strong>${products.reduce((s,p) => s+p.stock*p.sell,0).toLocaleString('fr-FR')} FCFA</strong>`,'','']
                )}
              `
              openPDF('Inventaire Stock', body)
              toast.success('📄 PDF ouvert !')
            }}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowModal(true)}>
              <Plus size={13} /> {t('btn_add')}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-wrap flex-1 min-w-40">
            <span className="search-icon"><Search size={13} /></span>
            <input className="input pl-8 py-2 text-sm w-full" placeholder="🔍 Produit, référence…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">{t('pos_all')} {t('col_category').toLowerCase()}</option>
            {cats.filter(Boolean).map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input py-2 text-sm w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">{t('pos_all')} {t('col_status').toLowerCase()}</option>
            <option>{t('status_out')}</option>
            <option>{t('status_low')}</option>
            <option>OK</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {stockShowSKU && <th>{t('col_ref')}</th>}
                <th>{t('col_product')}</th><th>{t('col_category')}</th>
                <th>{t('col_buy_price')}</th><th>{t('col_sell_price')}</th>
                <th>{t('col_stock')}</th><th>{t('col_threshold')}</th><th>{t('col_supplier')}</th>
                <th>{t('col_status')}</th><th>{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const st = statusOf(p.stock, p.threshold)
                return (
                  <tr key={p.sku}>
                    {stockShowSKU && <td className="td-mono">{p.sku}</td>}
                    <td className="td-bold">{p.name}</td>
                    <td><span className="badge badge-teal">{p.category}</span></td>
                    <td className="td-num">{fmt(p.buy)}</td>
                    <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(p.sell)}</td>
                    <td>
                      <span className="td-num" style={{
                        color: st.cls === 'badge-red' ? 'var(--danger)' : st.cls === 'badge-amber' ? 'var(--acc)' : 'var(--acc2)',
                        fontWeight: 700,
                      }}>{p.stock}</span>
                    </td>
                    <td className="td-num" style={{ color: 'var(--text3)' }}>{p.threshold}</td>
                    <td className="text-xs" style={{ color: 'var(--text2)' }}>{p.supplier}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div className="flex gap-1.5">
                        {st.cls !== 'badge-green' && (
                          <button className="btn btn-sm btn-ghost gap-1" onClick={() => toast.success('📦 Bon créé')}>📦</button>
                        )}
                        <button className="btn btn-sm btn-ghost" onClick={() => toast(`✏️ ${p.sku}`)}>✏️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>➕ {t('btn_new')} produit</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { label: 'SKU',             key: 'sku',       type: 'text',   span: false },
                { label: 'Catégorie',       key: 'category',  type: 'select', span: false },
                { label: 'Nom du produit',  key: 'name',      type: 'text',   span: true  },
                { label: 'Fournisseur',     key: 'supplier',  type: 'text',   span: true  },
                { label: 'Prix achat',      key: 'buy',       type: 'number', span: false },
                { label: 'Prix vente',      key: 'sell',      type: 'number', span: false },
                { label: 'Stock initial',   key: 'stock',     type: 'number', span: false },
                { label: 'Seuil alerte',    key: 'threshold', type: 'number', span: false },
              ] as { label: string; key: keyof typeof form; type: string; span: boolean }[]).map(f => (
                <div key={f.key} className={f.span ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text3)' }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input text-sm" value={String(form[f.key])}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                      {['Céréales','Corps gras','Épicerie','Hygiène','Laitiers','Conserves'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input className="input text-sm" type={f.type}
                      value={String(form[f.key])}
                      onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? +e.target.value : e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn btn-primary flex-1 justify-center" onClick={addProduct}>✅ {t('btn_add')} le produit</button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('btn_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
