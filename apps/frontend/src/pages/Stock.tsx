import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { Search, Download, Plus, AlertTriangle, List, Gem, FolderOpen, Tag, Printer, Camera, Pencil, Package, X, Eye, Trash2, LayoutGrid, AlignJustify } from 'lucide-react'
import ViewField from '@/components/ui/ViewField'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs, printProductLabels } from '@/utils/export'
import { productsApi } from '@/lib/api'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

import StockInventory from '@/components/stock/StockInventory'
import StockModals from '@/components/stock/StockModals'
import EmptyState from '@/components/ui/EmptyState'
import { type ProductItem, CATEGORIES_INIT, statusOf } from '@/components/stock/stockShared'

export default function Stock() {
  const { stockLowThreshold, stockShowSKU, lang } = useConfig()
  const fmt = useFormatAmount()
  const navigate = useNavigate()
  void lang // for t() reactivity

  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading]   = useState(true)
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
  const [stockView, setStockView] = useState<'grid'|'list'>('list')
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
  const pg = usePagination(filtered, 24)
  useEffect(() => { pg.reset() }, [search, cat, statusFilter])

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
      .finally(() => setLoading(false))
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
          <p className="page-subtitle">{products.length} {lang === 'en' ? 'items in catalog' : lang === 'es' ? 'artículos en catálogo' : lang === 'it' ? 'articoli in catalogo' : 'articles en catalogue'}</p>
        </div>
        <button className="topbar-btn" onClick={() => { setEditingSku(null); setEditingId(null); setProductEditMode(true); setShowModal(true) }}>
          <Plus size={14} /> {lang === 'en' ? 'New product' : lang === 'es' ? 'Nuevo producto' : lang === 'it' ? 'Nuovo prodotto' : 'Nouveau produit'}
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
          { label: t('stock_total'),      value: products.length.toString(),         color: 'var(--p2)',    hex: 'var(--p)', icon: <List          size={18} /> },
          { label: t('stock_value'),      value: fmt(totalValue),                    color: 'var(--acc2)', hex: 'var(--acc2)', icon: <Gem           size={18} /> },
          { label: t('stock_ruptures'),   value: ruptures.length.toString(),         color: 'var(--danger)',hex: 'var(--danger)', icon: <AlertTriangle size={18} /> },
          { label: t('stock_categories'), value: String(new Set(products.map(p => p.category)).size), color: 'var(--acc)', hex: 'var(--acc)', icon: <FolderOpen size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{
            background: `linear-gradient(135deg,${k.hex}18,${k.hex}06)`,
            border: `1px solid ${k.hex}28`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div className="kpi-icon-w" style={{ color: k.color, background: `${k.hex}20` }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Panel inventaire */}
      {!loading && products.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="📦"
            title={lang === 'en' ? 'No products in stock' : lang === 'es' ? 'Sin productos en stock' : lang === 'it' ? 'Nessun prodotto in stock' : 'Aucun produit en stock'}
            message={lang === 'en' ? 'Add your first products to start managing your inventory.' : lang === 'es' ? 'Agregue sus primeros productos para empezar a gestionar su inventario.' : lang === 'it' ? 'Aggiungi i tuoi primi prodotti per iniziare a gestire l\'inventario.' : 'Ajoutez vos premiers produits pour commencer à gérer votre inventaire.'}
            action={{ label: lang === 'en' ? '+ Add a product' : lang === 'es' ? '+ Agregar un producto' : lang === 'it' ? '+ Aggiungi un prodotto' : '+ Ajouter un produit', onClick: () => { resetForm(); setShowModal(true) } }}
          />
        </div>
      ) : (
      <StockInventory
        products={products}
        fmt={fmt} lang={lang} stockShowSKU={stockShowSKU}
        navigate={navigate}
        stockView={stockView} setStockView={setStockView}
        search={search} setSearch={setSearch}
        cat={cat} setCat={setCat} cats={cats}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        pg={pg}
        setSelectedForLabel={setSelectedForLabel} setShowLabelModal={setShowLabelModal}
        setProductEditMode={setProductEditMode} setShowModal={setShowModal}
        setForm={setForm} setEditingSku={setEditingSku} setEditingId={setEditingId}
        setModalTab={setModalTab}
      />
      )}

      {/* ── Panel Catégories ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Tag size={14} /> Gestion des catégories</span>
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
                  <button className="mini-btn" style={{ cursor:'pointer' }} onClick={() => { setEditCat(cat); setCatForm({ name:cat.name, color:cat.color, icon:cat.icon, description:cat.description }); setShowCatModal(true) }}><Pencil size={12} /></button>
                  <button className="mini-btn" style={{ color:'var(--danger)', cursor:'pointer' }} onClick={() => {
                    if (cat.productsCount > 0) { toast.error('Catégorie non vide !'); return }
                    setCategories(prev => prev.filter(c => c.id !== cat.id))
                    toast.success('Catégorie supprimée')
                  }}><Trash2 size={12} /></button>
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
      <StockModals
        showModal={showModal} setShowModal={setShowModal}
        resetForm={resetForm}
        editingSku={editingSku}
        form={form} setForm={setForm}
        productEditMode={productEditMode} setProductEditMode={setProductEditMode}
        modalTab={modalTab} setModalTab={setModalTab}
        categories={categories} setCategories={setCategories}
        showScanner={showScanner} setShowScanner={setShowScanner}
        fmt={fmt} products={products} saveProduct={saveProduct}
        showCatModal={showCatModal} setShowCatModal={setShowCatModal}
        editCat={editCat} catForm={catForm} setCatForm={setCatForm}
        showLabelModal={showLabelModal} setShowLabelModal={setShowLabelModal}
        lang={lang} labelConfig={labelConfig} setLabelConfig={setLabelConfig}
        selectedForLabel={selectedForLabel} setSelectedForLabel={setSelectedForLabel}
      />
    </div>
  )
}
