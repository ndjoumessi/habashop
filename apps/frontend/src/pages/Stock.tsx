import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { Search, Download, Plus, AlertTriangle, List, Gem, FolderOpen } from 'lucide-react'
import ViewField from '@/components/ui/ViewField'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs, printProductLabels } from '@/utils/export'
import { productsApi } from '@/lib/api'
import BarcodeScanner from '@/components/ui/BarcodeScanner'

type ProductItem = {
  _id?: string; sku: string; name: string; category: string
  buy: number; sell: number; stock: number; threshold: number; supplier: string
}

const PRODUCTS_INIT: ProductItem[] = [
  { sku: 'PRD-001', name: '🌾 Riz parfumé 5kg',       category: 'Céréales',   buy: 3200, sell: 4500, stock: 12,  threshold: 20, supplier: 'SENRIZ'         },
  { sku: 'PRD-002', name: '🫙 Huile palme 1L',          category: 'Corps gras', buy: 1200, sell: 1800, stock: 18,  threshold: 25, supplier: 'SONACO'         },
  { sku: 'PRD-003', name: '🍚 Sucre 1kg',               category: 'Épicerie',   buy: 600,  sell: 850,  stock: 245, threshold: 50, supplier: 'CSS'            },
  { sku: 'PRD-004', name: '🌾 Farine blé 1kg',          category: 'Céréales',   buy: 400,  sell: 650,  stock: 89,  threshold: 30, supplier: 'GRANDS MOULINS' },
  { sku: 'PRD-005', name: '🧼 Savon OMO 500g',          category: 'Hygiène',    buy: 320,  sell: 500,  stock: 5,   threshold: 10, supplier: 'UNILEVER'       },
  { sku: 'PRD-006', name: '🥛 Lait poudre 400g',        category: 'Laitiers',   buy: 1500, sell: 2200, stock: 67,  threshold: 20, supplier: 'NESTLÉ'         },
  { sku: 'PRD-007', name: '🫒 Huile végétale 5L',       category: 'Corps gras', buy: 6500, sell: 8500, stock: 34,  threshold: 15, supplier: 'SONACO'         },
  { sku: 'PRD-008', name: '🍅 Tomate concentrée 800g',  category: 'Conserves',  buy: 900,  sell: 1400, stock: 112, threshold: 30, supplier: 'TOMAPOR'        },
]

const CATEGORIES_INIT = [
  { id:1, name:'Céréales',   color:'#818CF8', icon:'🌾', productsCount:3, description:'Riz, farine, semoule...'     },
  { id:2, name:'Corps gras', color:'#F59E0B', icon:'🫙', productsCount:2, description:'Huiles, beurre de karité...' },
  { id:3, name:'Épicerie',   color:'#34D399', icon:'🍚', productsCount:2, description:'Sucre, café, condiments...'  },
  { id:4, name:'Hygiène',    color:'#F472B6', icon:'🧼', productsCount:2, description:'Savons, détergents...'       },
  { id:5, name:'Laitiers',   color:'#60A5FA', icon:'🥛', productsCount:2, description:'Lait, fromage, yaourt...'   },
  { id:6, name:'Conserves',  color:'#A78BFA', icon:'🍅', productsCount:2, description:'Tomates, sardines, thon...' },
]

function statusOf(stock: number, threshold: number) {
  if (stock === 0)        return { label: t('status_out'), cls: 'badge-red'   }
  if (stock <= threshold) return { label: t('status_low'), cls: 'badge-amber' }
  return                         { label: 'OK',             cls: 'badge-green' }
}

export default function Stock() {
  const { stockLowThreshold, stockShowSKU, lang } = useConfig()
  const fmt = useFormatAmount()
  const navigate = useNavigate()
  void lang // for t() reactivity

  const [products, setProducts] = useState<ProductItem[]>(PRODUCTS_INIT)
  const [search, setSearch]     = useState('')
  const [cat, setCat]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [productEditMode, setProductEditMode] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [editingSku, setEditingSku] = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [modalTab, setModalTab] = useState<'general'|'prix'|'avance'>('general')
  const [form, setForm] = useState({
    sku: '', name: '', description: '', category: 'Céréales', unit: 'unité',
    buy: 0, sell: 0, priceWholesale: 0, priceSemiWholesale: 0,
    stock: 0, threshold: stockLowThreshold, supplier: '',
    barcode: '', taxRate: 18, isActive: true,
    hasPromotion: false, promotionPrice: 0, promotionEnd: '',
    image: '📦', notes: '',
  })
  const [categories, setCategories] = useState(CATEGORIES_INIT)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [labelConfig, setLabelConfig] = useState({
    size: 'medium' as 'small' | 'medium' | 'large',
    showPrice: true, showSku: true, showBarcode: true, copies: 1,
  })
  const [selectedForLabel, setSelectedForLabel] = useState<string[]>([])
  const [editCat, setEditCat] = useState<typeof CATEGORIES_INIT[0] | null>(null)
  const [catForm, setCatForm] = useState({ name:'', color:'#818CF8', icon:'📦', description:'' })

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

  const resetForm = () => {
    setForm({ sku:'', name:'', description:'', category:'Céréales', unit:'unité', buy:0, sell:0, priceWholesale:0, priceSemiWholesale:0, stock:0, threshold:stockLowThreshold, supplier:'', barcode:'', taxRate:18, isActive:true, hasPromotion:false, promotionPrice:0, promotionEnd:'', image:'📦', notes:'' })
    setModalTab('general')
    setEditingSku(null)
    setEditingId(null)
  }

  useEffect(() => {
    productsApi.list()
      .then(data => setProducts(data.map((p: any): ProductItem => ({
        _id: p.id,
        sku: p.sku || p.id.slice(-8),
        name: `${p.emoji || '📦'} ${p.name}`,
        category: p.category || 'Épicerie',
        buy: p.buyPrice ?? 0,
        sell: p.sellPrice ?? 0,
        stock: p.stockQty ?? 0,
        threshold: p.stockMin ?? 5,
        supplier: '',
      }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = () => { resetForm(); setShowModal(true) }
    window.addEventListener('habashop:new-product', handler)
    return () => window.removeEventListener('habashop:new-product', handler)
  }, [])

  const saveProduct = async () => {
    const sku = form.sku || `PRD-${String(Date.now()).slice(-4)}`
    const apiBody = {
      sku,
      name: form.name,
      emoji: form.image,
      category: form.category,
      buyPrice: form.buy,
      sellPrice: form.sell,
      stockQty: form.stock,
      stockMin: form.threshold,
      unit: form.unit,
      taxRate: form.taxRate,
      isActive: form.isActive,
      hasPromotion: form.hasPromotion,
      promotionPrice: form.promotionPrice || null,
    }
    if (editingSku) {
      if (editingId) {
        try { await productsApi.update(editingId, apiBody) } catch {}
      }
      setProducts(prev => prev.map(p =>
        p.sku === editingSku ? { ...p, name: form.image + ' ' + form.name, category: form.category, buy: form.buy, sell: form.sell, stock: form.stock, threshold: form.threshold, supplier: form.supplier } : p
      ))
      toast.success(`✅ ${form.name} mis à jour !`)
    } else {
      let apiId: string | undefined
      try { const created = await productsApi.create(apiBody); apiId = created.id } catch {}
      setProducts(prev => [...prev, { _id: apiId, ...form, sku, name: form.image + ' ' + form.name }])
      toast.success('✅ Produit ajouté !')
    }
    setShowModal(false)
    resetForm()
  }

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_stock')}</h1>
          <p className="page-subtitle">{products.length} {lang === 'fr' ? 'articles en catalogue' : 'items in catalog'}</p>
        </div>
        <button className="topbar-btn" onClick={() => { setEditingSku(null); setEditingId(null); setProductEditMode(true); setShowModal(true) }}>
          <Plus size={14} /> {lang === 'fr' ? 'Nouveau produit' : 'New product'}
        </button>
      </div>

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
          { label: t('stock_total'),    value: products.length.toString(),          color: 'var(--p2)',    icon: <List          size={18} /> },
          { label: t('stock_value'),   value: fmt(totalValue), color: 'var(--acc2)', icon: <Gem           size={18} /> },
          { label: t('stock_ruptures'),value: ruptures.length.toString(),           color: 'var(--danger)',icon: <AlertTriangle size={18} /> },
          { label: t('stock_categories'),value: String(new Set(products.map(p => p.category)).size), color: 'var(--acc)', icon: <FolderOpen    size={18} /> },
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
          <span className="panel-title">{t('stock_title')}</span>
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
                  { label: t('stock_total'),      value: String(products.length) },
                  { label: t('stock_value'),      value: fmt(products.reduce((s,p) => s+p.stock*p.sell, 0)) },
                  { label: t('stock_ruptures'),   value: String(lowStock.length) },
                  { label: t('stock_categories'), value: String(new Set(products.map(p => p.category)).size) },
                ])}
                ${lowStock.length > 0 ? `
                  <h2 style="color:#dc2626;">⚠️ ${t('stock_pdf_alert_title')} (${lowStock.length})</h2>
                  ${htmlTable(
                    ['SKU', t('col_product'), t('col_stock'), t('col_threshold'), t('col_supplier')],
                    lowStock.map(p => [p.sku, p.name, String(p.stock), String(p.threshold), p.supplier])
                  )}
                ` : ''}
                <h2>${t('stock_pdf_full_title')}</h2>
                ${htmlTable(
                  ['SKU', t('col_product'), t('col_category'), t('col_buy_price'), t('col_sell_price'), t('col_stock'), t('col_threshold'), t('col_supplier'), t('col_status')],
                  products.map(p => {
                    const st = statusOf(p.stock, p.threshold)
                    const cls = st.cls === 'badge-red' ? 'badge-red' : st.cls === 'badge-amber' ? 'badge-amber' : 'badge-green'
                    return [p.sku, p.name, p.category,
                      fmt(p.buy), fmt(p.sell),
                      String(p.stock), String(p.threshold), p.supplier,
                      `<span class="badge ${cls}">${st.label}</span>`]
                  }),
                  ['','','','',`<strong>${t('stock_pdf_total_value')}</strong>`,'',
                   `<strong>${fmt(products.reduce((s,p) => s+p.stock*p.sell,0))}</strong>`,'','']
                )}
              `
              openPDF(t('stock_pdf_title'), body)
              toast.success('📄 PDF ouvert !')
            }}>
              <Download size={13} /> PDF
            </button>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { setSelectedForLabel(products.map(p => p.sku)); setShowLabelModal(true) }}>
              🏷️ {lang === 'fr' ? 'Étiquettes' : 'Labels'}
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => { setProductEditMode(true); setShowModal(true) }}>
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
                          <button className="btn btn-sm btn-ghost gap-1" title="Commander"
                            onClick={() => navigate('/app/orders')}>📦</button>
                        )}
                        <button className="btn btn-sm btn-ghost" title="Modifier"
                          onClick={() => {
                            setForm(f => ({ ...f,
                              sku: p.sku, name: p.name.replace(/^\S+\s/, ''),
                              category: p.category, buy: p.buy, sell: p.sell,
                              stock: p.stock, threshold: p.threshold, supplier: p.supplier,
                              image: p.name.match(/^\S+/)?.[0] ?? '📦',
                            }))
                            setEditingSku(p.sku)
                            setEditingId(p._id ?? null)
                            setModalTab('general')
                            setProductEditMode(false)
                            setShowModal(true)
                          }}>✏️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Panel Catégories ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">🏷️ Gestion des catégories</span>
          <button className="topbar-btn" onClick={() => { setEditCat(null); setCatForm({ name:'', color:'#818CF8', icon:'📦', description:'' }); setShowCatModal(true) }}>
            + Nouvelle catégorie
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:12 }}>
          {categories.map(cat => (
            <div key={cat.id} style={{
              background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:12, padding:16, borderLeft:`4px solid ${cat.color}`,
              display:'flex', flexDirection:'column', gap:8, transition:'all .2s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 6px 20px ${cat.color}33` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none' }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${cat.color}22`, border:`1px solid ${cat.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{cat.icon}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{cat.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{cat.productsCount} produits</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button className="mini-btn" onClick={() => { setEditCat(cat); setCatForm({ name:cat.name, color:cat.color, icon:cat.icon, description:cat.description }); setShowCatModal(true) }}>✏️</button>
                  <button className="mini-btn" style={{ color:'var(--danger)' }} onClick={() => {
                    if (cat.productsCount > 0) { toast.error('Catégorie non vide !'); return }
                    setCategories(prev => prev.filter(c => c.id !== cat.id))
                    toast.success('Catégorie supprimée')
                  }}>🗑</button>
                </div>
              </div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>{cat.description}</div>
              <div style={{ height:4, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, width:`${Math.min(100,(cat.productsCount/10)*100)}%`, background:cat.color, transition:'width .3s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal produit enrichi ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', padding:0, overflow:'hidden' }}>
            {/* Fixed header */}
            <div className="flex items-center justify-between" style={{ padding:'20px 24px 0', flexShrink:0 }}>
              <h3 className="text-base font-bold" style={{ color:'var(--text)' }}>
                {editingSku ? `📦 ${form.name || editingSku}` : `➕ ${t('btn_new')} produit`}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowModal(false); resetForm() }}>✕</button>
            </div>

            {/* Mode banner (edit only, not for new products) */}
            {editingSku && (
              <div style={{ padding:'0 24px', flexShrink:0, marginTop:12 }}>
                {!productEditMode
                  ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                      <span style={{ fontSize:13 }}>👁</span>
                      <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:600 }}>Mode visualisation — cliquez sur Modifier pour éditer</span>
                    </div>
                  : <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                      <span style={{ fontSize:13 }}>✏️</span>
                      <span style={{ fontSize:12, color:'var(--warn)', fontWeight:600 }}>Mode édition — modifications non sauvegardées</span>
                    </div>
                }
              </div>
            )}

            {/* Fixed tabs */}
            <div style={{ padding:'16px 24px 0', flexShrink:0 }}>
              <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:10, padding:4 }}>
                {([
                  { id:'general', label:'ℹ️ Général' },
                  { id:'prix',    label:'💰 Prix & Stock' },
                  { id:'avance',  label:'📋 Avancé' },
                ] as { id:'general'|'prix'|'avance'; label:string }[]).map(tb => (
                  <button key={tb.id} onClick={() => setModalTab(tb.id)} style={{
                    flex:1, padding:'7px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                    cursor:'pointer', fontFamily:'var(--font)', border:'none', transition:'all .15s',
                    background: modalTab === tb.id ? 'linear-gradient(135deg, var(--p), var(--p2))' : 'transparent',
                    color: modalTab === tb.id ? '#fff' : 'var(--text2)',
                  }}>{tb.label}</button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 24px 0' }}>

            {/* ── Onglet Général ── */}
            {modalTab === 'general' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* ── IMAGE ── */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Image</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
                    {['🌾','🫙','🍚','🧼','🥛','🍅','🫒','☕','🐟','🧃','🍬','🧴','🫧','📦'].map(em => (
                      <button key={em} type="button" onClick={() => setForm(f => ({...f, image:em}))} style={{
                        width:40, height:40, borderRadius:10, fontSize:20,
                        background: form.image === em ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                        border:`1.5px solid ${form.image === em ? 'var(--p2)' : 'var(--border)'}`,
                        cursor:'pointer', transition:'all .15s',
                      }}>{em}</button>
                    ))}
                  </div>
                  <input className="input text-sm" placeholder="Ou tapez un emoji personnalisé..."
                    value={form.image} onChange={e => setForm(f => ({...f, image:e.target.value}))}
                    style={{ fontSize:18, width:220 }} />
                </div>

                {/* ── NOM PRODUIT — pleine largeur ── */}
                <ViewField label="Nom du produit *" value={`${form.image} ${form.name}`} editing={productEditMode}>
                  <input className="input" placeholder="Ex: Riz parfumé 5kg"
                    value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}
                    style={{ width:'100%', fontSize:15, fontWeight:600 }}
                    autoFocus />
                </ViewField>

                {/* ── SKU + Catégorie ── */}
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label="SKU" value={form.sku||'—'} editing={productEditMode}>
                    <input className="input text-sm" placeholder="PRD-001" value={form.sku} onChange={e => setForm(f => ({...f, sku:e.target.value}))} />
                  </ViewField>
                  <ViewField label="Catégorie" value={form.category} editing={productEditMode}>
                    <select className="input text-sm" value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
                      {categories.map(c => <option key={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </ViewField>
                </div>

                {/* ── Unité + Fournisseur ── */}
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label="Unité" value={form.unit} editing={productEditMode}>
                    <select className="input text-sm" value={form.unit} onChange={e => setForm(f => ({...f, unit:e.target.value}))}>
                      {['unité','kg','g','litre','ml','carton','sac','boîte','palette','douzaine'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </ViewField>
                  <ViewField label="Fournisseur" value={form.supplier||'—'} editing={productEditMode}>
                    <input className="input text-sm" placeholder="SENRIZ, SONACO..." value={form.supplier} onChange={e => setForm(f => ({...f, supplier:e.target.value}))} />
                  </ViewField>
                </div>

                {/* ── Code-barres + scanner ── */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Code-barres</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input className="input text-sm" style={{ flex:1 }} placeholder="EAN-13..." value={form.barcode} onChange={e => setForm(f => ({...f, barcode:e.target.value}))} />
                    <button type="button" className="mini-btn" onClick={() => setShowScanner(true)}
                      title="Scanner un code-barres" style={{ padding:'8px 14px', fontSize:18 }}>📷</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Description</label>
                  <textarea className="input text-sm" rows={2} placeholder="Description courte..."
                    value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Notes internes</label>
                  <input className="input text-sm" placeholder="Remarques..." value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} />
                </div>
              </div>
            )}

            {/* ── Onglet Prix & Stock ── */}
            {modalTab === 'prix' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label="Prix achat HT *" value={fmt(form.buy)} editing={productEditMode}>
                    <input className="input text-sm" type="number" value={form.buy || ''} onChange={e => setForm(f => ({...f, buy:+e.target.value}))} />
                  </ViewField>
                  <ViewField label="Prix vente TTC *" value={fmt(form.sell)} editing={productEditMode}>
                    <input className="input text-sm" type="number" value={form.sell || ''} onChange={e => setForm(f => ({...f, sell:+e.target.value}))} />
                  </ViewField>
                  <ViewField label="Prix grossiste" value={form.priceWholesale ? fmt(form.priceWholesale) : '—'} editing={productEditMode}>
                    <input className="input text-sm" type="number" value={form.priceWholesale || ''} onChange={e => setForm(f => ({...f, priceWholesale:+e.target.value}))} />
                  </ViewField>
                  <ViewField label="Prix demi-grossiste" value={form.priceSemiWholesale ? fmt(form.priceSemiWholesale) : '—'} editing={productEditMode}>
                    <input className="input text-sm" type="number" value={form.priceSemiWholesale || ''} onChange={e => setForm(f => ({...f, priceSemiWholesale:+e.target.value}))} />
                  </ViewField>
                </div>
                {/* Marge calculée */}
                {form.buy > 0 && form.sell > 0 && (
                  <div style={{ padding:'10px 14px', background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.2)', borderRadius:10, fontSize:13 }}>
                    Marge : <strong style={{ color:'var(--acc2)' }}>{((form.sell - form.buy) / form.buy * 100).toFixed(1)} %</strong>
                    <span style={{ color:'var(--text3)', marginLeft:12 }}>({fmt(form.sell - form.buy)} / unité)</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label="Stock initial *" value={String(form.stock)} editing={productEditMode}>
                    <input className="input text-sm" type="number" value={form.stock || ''} onChange={e => setForm(f => ({...f, stock:+e.target.value}))} />
                  </ViewField>
                  <ViewField label="Seuil alerte *" value={String(form.threshold)} editing={productEditMode}>
                    <input className="input text-sm" type="number" value={form.threshold || ''} onChange={e => setForm(f => ({...f, threshold:+e.target.value}))} />
                  </ViewField>
                  <ViewField label="Taux TVA" value={`${form.taxRate} %`} editing={productEditMode}>
                    <select className="input text-sm" value={form.taxRate} onChange={e => setForm(f => ({...f, taxRate:+e.target.value}))}>
                      {[0,5,10,18,20].map(r => <option key={r} value={r}>{r} %</option>)}
                    </select>
                  </ViewField>
                </div>
                {/* Toggle promotion */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Produit en promotion</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>Affiche un badge PROMO au POS</div>
                  </div>
                  <button onClick={() => setForm(f => ({...f, hasPromotion:!f.hasPromotion}))} style={{
                    width:48, height:26, borderRadius:99, position:'relative',
                    background: form.hasPromotion ? 'var(--p2)' : 'var(--bg4)', border:'none', cursor:'pointer',
                  }}>
                    <div style={{ position:'absolute', top:3, left: form.hasPromotion ? 25 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 2px 4px rgba(0,0,0,.2)' }} />
                  </button>
                </div>
                {form.hasPromotion && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Prix promotion</label>
                      <input className="input text-sm" type="number" value={form.promotionPrice || ''} onChange={e => setForm(f => ({...f, promotionPrice:+e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Date fin promo</label>
                      <input className="input text-sm" type="date" value={form.promotionEnd} onChange={e => setForm(f => ({...f, promotionEnd:e.target.value}))} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Onglet Avancé ── */}
            {modalTab === 'avance' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label:'Produit actif', sub:'Visible dans les listes', key:'isActive' as const },
                ].map(tog => (
                  <div key={tog.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{tog.label}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{tog.sub}</div>
                    </div>
                    <button onClick={() => setForm(f => ({...f, [tog.key]:!f[tog.key]}))} style={{
                      width:48, height:26, borderRadius:99, position:'relative',
                      background: form[tog.key] ? 'var(--p2)' : 'var(--bg4)', border:'none', cursor:'pointer',
                    }}>
                      <div style={{ position:'absolute', top:3, left: form[tog.key] ? 25 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 2px 4px rgba(0,0,0,.2)' }} />
                    </button>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Référence interne</label>
                  <input className="input text-sm" placeholder="Référence optionnelle..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Poids (g)</label>
                    <input className="input text-sm" type="number" placeholder="Ex: 500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Dimensions</label>
                    <input className="input text-sm" placeholder="L × l × h cm" />
                  </div>
                </div>
              </div>
            )}

            </div>{/* end scrollable body */}

            {/* Fixed footer */}
            <div className="flex gap-2" style={{ padding:'16px 24px 20px', flexShrink:0, borderTop:'1px solid var(--border)' }}>
              {editingSku && !productEditMode ? (
                <>
                  <button className="btn btn-primary flex-1 justify-center" onClick={() => setProductEditMode(true)}>✏️ Modifier</button>
                  <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm() }}>Fermer</button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary flex-1 justify-center" onClick={saveProduct}>
                    ✅ {editingSku ? 'Enregistrer les modifications' : `${t('btn_add')} le produit`}
                  </button>
                  {editingSku
                    ? <button className="btn btn-ghost" onClick={() => setProductEditMode(false)}>{t('btn_cancel')}</button>
                    : <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm() }}>{t('btn_cancel')}</button>
                  }
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scanner code-barres ── */}
      {showScanner && (
        <BarcodeScanner
          onScan={barcode => {
            setForm(f => ({ ...f, barcode }))
            setShowScanner(false)
            toast.success(`✅ Code-barres : ${barcode}`)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Modal Catégorie ── */}
      {showCatModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal-box" style={{ maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
                {editCat ? '✏️ Modifier la catégorie' : '➕ Nouvelle catégorie'}
              </h3>
              <button className="mini-btn" onClick={() => setShowCatModal(false)}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Nom de la catégorie</label>
                <input className="input" value={catForm.name} onChange={e => setCatForm(f => ({...f, name:e.target.value}))} placeholder="Ex: Céréales" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Icône (emoji)</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                  {['🌾','🫙','🍚','🧼','🥛','🍅','🫒','☕','🐟','🧃','🍬','🧴','🥤','🍫','🌽','🫚'].map(emoji => (
                    <button key={emoji} onClick={() => setCatForm(f => ({...f, icon:emoji}))} style={{
                      width:36, height:36, borderRadius:8, fontSize:18, cursor:'pointer',
                      background: catForm.icon === emoji ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                      border:`1.5px solid ${catForm.icon === emoji ? 'var(--p2)' : 'var(--border)'}`,
                    }}>{emoji}</button>
                  ))}
                </div>
                <input className="input" value={catForm.icon} onChange={e => setCatForm(f => ({...f, icon:e.target.value}))} placeholder="Ou tapez un emoji..." style={{ fontSize:20 }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Couleur</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                  {['#818CF8','#F59E0B','#34D399','#F472B6','#60A5FA','#A78BFA','#EF4444','#14B8A6','#F97316','#84CC16'].map(color => (
                    <button key={color} onClick={() => setCatForm(f => ({...f, color}))} style={{
                      width:28, height:28, borderRadius:'50%', background:color, border:'none', cursor:'pointer',
                      boxShadow: catForm.color === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : 'none', transition:'box-shadow .15s',
                    }} />
                  ))}
                </div>
                <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({...f, color:e.target.value}))}
                  style={{ width:'100%', height:36, borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', background:'none' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>Description</label>
                <textarea className="input" rows={2} value={catForm.description} onChange={e => setCatForm(f => ({...f, description:e.target.value}))} placeholder="Description courte..." />
              </div>
              {/* Preview */}
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--border)', borderLeft:`4px solid ${catForm.color}` }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${catForm.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{catForm.icon}</div>
                <div>
                  <div style={{ fontWeight:700, color:'var(--text)' }}>{catForm.name || 'Nom catégorie'}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{catForm.description || 'Description...'}</div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }} onClick={() => {
                if (!catForm.name) { toast.error('Nom requis'); return }
                if (editCat) {
                  setCategories(prev => prev.map(c => c.id === editCat.id ? {...c, ...catForm} : c))
                  toast.success(`✅ Catégorie "${catForm.name}" modifiée`)
                } else {
                  setCategories(prev => [...prev, { id:Date.now(), ...catForm, productsCount:0 }])
                  toast.success(`✅ Catégorie "${catForm.name}" créée`)
                }
                setShowCatModal(false)
              }}>{editCat ? '✅ Modifier' : '✅ Créer'}</button>
              <button className="mini-btn" style={{ padding:'10px 16px' }} onClick={() => setShowCatModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Étiquettes ══ */}
      {showLabelModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowLabelModal(false)}>
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                🏷️ {lang === 'fr' ? 'Imprimer des étiquettes' : 'Print labels'}
              </h3>
              <button className="mini-btn" onClick={() => setShowLabelModal(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Taille */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {lang === 'fr' ? 'Taille des étiquettes' : 'Label size'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'small',  label: 'Petite\n150×80px',   icon: '▫️' },
                    { id: 'medium', label: 'Moyenne\n200×100px', icon: '◾' },
                    { id: 'large',  label: 'Grande\n280×140px',  icon: '⬛' },
                  ].map(size => (
                    <button key={size.id} type="button"
                      onClick={() => setLabelConfig(f => ({ ...f, size: size.id as any }))}
                      style={{
                        padding: '12px 8px', borderRadius: 10,
                        background: labelConfig.size === size.id ? 'rgba(91,78,232,.15)' : 'var(--bg3)',
                        border: `1.5px solid ${labelConfig.size === size.id ? 'var(--p2)' : 'var(--border)'}`,
                        cursor: 'pointer', fontFamily: 'var(--font)',
                        fontSize: 12, fontWeight: 600,
                        color: labelConfig.size === size.id ? 'var(--p2)' : 'var(--text2)',
                        whiteSpace: 'pre-line', transition: 'all .15s',
                      }}>
                      {size.icon}{'\n'}{size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {lang === 'fr' ? 'Informations à afficher' : 'Information to display'}
                </label>
                {[
                  { key: 'showPrice',   label: lang === 'fr' ? 'Prix de vente' : 'Selling price' },
                  { key: 'showSku',     label: 'SKU / Référence' },
                  { key: 'showBarcode', label: lang === 'fr' ? 'Code-barres' : 'Barcode' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <input type="checkbox"
                      checked={(labelConfig as any)[opt.key]}
                      onChange={e => setLabelConfig(f => ({ ...f, [opt.key]: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: 'var(--p)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* Copies */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }}>
                  {lang === 'fr' ? 'Copies par produit' : 'Copies per product'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="mini-btn"
                    onClick={() => setLabelConfig(f => ({ ...f, copies: Math.max(1, f.copies - 1) }))}
                    style={{ width: 36, height: 36, justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--mono)', minWidth: 40, textAlign: 'center' }}>
                    {labelConfig.copies}
                  </span>
                  <button type="button" className="mini-btn"
                    onClick={() => setLabelConfig(f => ({ ...f, copies: Math.min(10, f.copies + 1) }))}
                    style={{ width: 36, height: 36, justifyContent: 'center' }}>+</button>
                </div>
              </div>

              {/* Sélection produits */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {lang === 'fr' ? 'Produits à étiqueter' : 'Products to label'}
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button type="button" className="mini-btn" onClick={() => setSelectedForLabel(products.map(p => p.sku))}>
                    {lang === 'fr' ? 'Tout' : 'All'}
                  </button>
                  <button type="button" className="mini-btn" onClick={() => setSelectedForLabel([])}>
                    {lang === 'fr' ? 'Aucun' : 'None'}
                  </button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
                  {products.map(p => (
                    <label key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      <input type="checkbox"
                        checked={selectedForLabel.includes(p.sku)}
                        onChange={e => {
                          if (e.target.checked) setSelectedForLabel(prev => [...prev, p.sku])
                          else setSelectedForLabel(prev => prev.filter(s => s !== p.sku))
                        }}
                        style={{ accentColor: 'var(--p)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 16 }}>{p.name.split(' ')[0]}</span>
                      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{p.name.split(' ').slice(1).join(' ')}</span>
                      <span style={{ fontSize: 11, color: 'var(--p2)', fontFamily: 'var(--mono)' }}>{fmt(p.sell)}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {selectedForLabel.length} {lang === 'fr' ? 'sélectionné(s)' : 'selected'}
                  {' → '}{selectedForLabel.length * labelConfig.copies} {lang === 'fr' ? 'étiquette(s)' : 'label(s)'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="topbar-btn" style={{ flex: 1, justifyContent: 'center' }}
                disabled={selectedForLabel.length === 0}
                onClick={() => {
                  const selectedProducts = products
                    .filter(p => selectedForLabel.includes(p.sku))
                    .map(p => ({
                      name: p.name.split(' ').slice(1).join(' ') || p.name,
                      sku: p.sku,
                      price: p.sell,
                      emoji: p.name.split(' ')[0],
                    }))
                  printProductLabels(selectedProducts, fmt, { ...labelConfig, shopName: 'HabaShop', lang })
                  setShowLabelModal(false)
                }}>
                🖨️ {lang === 'fr' ? 'Imprimer' : 'Print'}
              </button>
              <button className="mini-btn" style={{ padding: '10px 16px' }} onClick={() => setShowLabelModal(false)}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
