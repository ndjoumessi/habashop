import { lazy, Suspense, useState, type Dispatch, type SetStateAction } from 'react'
import { Search, Download, Plus, Tag, Package, Eye, Trash2, LayoutGrid, AlignJustify, Camera, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { t, useAppStore, convertFromXOF, isThemeLight } from '@/stores/appStore'
import { exportCSV, openPDF, htmlTable, htmlKPIs } from '@/utils/export'
import { hydratePricesFromApi } from '@/lib/productCurrency'
import { normalizeBarcode } from '@/lib/barcode'
import Pagination from '@/components/ui/Pagination'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import FilterSelect, { type FilterOption } from '@/components/ui/FilterSelect'
import { normCat } from '@/utils/normCat'
import { type ProductItem, type StockForm, statusOf, stockCatLabel, isActivePromo, productMargin } from '@/components/stock/stockShared'
// Chargé à la demande (@zxing) — uniquement à l'ouverture du scanner de recherche.
const BarcodeScanner = lazy(() => import('@/components/ui/BarcodeScanner'))

interface StockInventoryProps {
  products: ProductItem[]
  fmt: (n: number) => string
  lang: string
  stockShowSKU: boolean
  navigate: (path: string) => void
  stockView: 'grid' | 'list'; setStockView: (v: any) => void
  search: string; setSearch: (v: string) => void
  cat: string; setCat: (v: string) => void
  cats: string[]
  statusFilter: string; setStatusFilter: (v: string) => void
  promoOnly: boolean; setPromoOnly: (b: boolean) => void; promoCount: number
  pg: any
  setSelectedForLabel: (v: any) => void
  setShowLabelModal: (b: boolean) => void
  setProductEditMode: (b: boolean) => void
  setShowModal: (b: boolean) => void
  setForm: Dispatch<SetStateAction<StockForm>>
  setEditingSku: (v: string | null) => void
  setEditingId: (v: string | null) => void
  setModalTab: (v: any) => void
  onDeleteProduct: (p: ProductItem) => void
  // Sélection inline pour impression étiquettes
  selectedSkus: Set<string>
  onToggleSelect: (sku: string) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
  // Rattrapage codes-barres (PR5)
  missingBarcodeCount: number
  onOpenBackfill: () => void
}

export default function StockInventory({ products, fmt, lang, stockShowSKU, navigate, stockView, setStockView, search, setSearch, cat, setCat, cats, statusFilter, setStatusFilter, promoOnly, setPromoOnly, promoCount, pg, setSelectedForLabel, setShowLabelModal, setProductEditMode, setShowModal, setForm, setEditingSku, setEditingId, setModalTab, onDeleteProduct, selectedSkus, onToggleSelect, onSelectAllVisible, onClearSelection, missingBarcodeCount, onOpenBackfill }: StockInventoryProps) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const currency = useAppStore(s => s.currency)
  // Couleur sémantique de la marge : SOMBRE seulement. MESURÉ sur fond de carte — en thème
  // CLAIR, --warn rend 1,58:1, --danger 2,99:1 et --acc2 3,77:1, tous sous AA, sur un chiffre
  // d'ARGENT. Aucune teinte de la palette ne passe sur blanc et un color-mix vers --text
  // plafonne à 4,19:1 avant de dénaturer la teinte (mesuré) : la cause est l'absence de
  // variantes claires (#193 point 2). En clair on retombe donc sur --text, lisible partout ;
  // le % chiffré porte l'information, la couleur ne fait que la renforcer (WCAG 1.4.1).
  // Quand #193 aura donné leurs variantes claires aux tokens, retirer la garde suffira.
  const themeIsLight = isThemeLight(useAppStore(s => s.theme))
  // Scan pour la recherche : remplit la barre avec le code canonicalisé (filtre
  // seulement, pas d'ouverture de fiche — geste d'inventaire en série).
  const [showSearchScanner, setShowSearchScanner] = useState(false)
  // ProductItem est en XOF (cohérence DB). On hydrate vers la devise d'affichage
  // au moment de remplir le form (form fonctionne dans la devise du tenant).
  const hydrate = (p: ProductItem) => hydratePricesFromApi({
    buyPrice:           p.buy,
    sellPrice:          p.sell,
    wholesalePrice:     p.priceWholesale ?? 0,
    semiWholesalePrice: p.priceSemiWholesale ?? 0,
    priceTiers:         p.priceTiers ?? [],
  }, currency)
  // Calcul état "tout sélectionné" (indeterminate si partiel sur la page courante)
  const visibleSkus: string[] = pg.paginated.map((p: ProductItem) => p.sku)
  const visibleSelectedCount = visibleSkus.filter(s => selectedSkus.has(s)).length
  const allVisibleSelected   = visibleSkus.length > 0 && visibleSelectedCount === visibleSkus.length
  const someVisibleSelected  = visibleSelectedCount > 0 && !allVisibleSelected
  // Options catégorie : dédupliquées par nom normalisé (normCat, partagé avec le
  // donut CA Dashboard) → une seule entrée par catégorie quelles que soient les
  // variantes emoji/casse (« 🥥 Épicerie » == « Épicerie »). La VALEUR émise reste
  // la chaîne d'origine → le filtrage en amont (p.category === cat) est inchangé.
  const catOptions: FilterOption[] = [{ value: '', label: i('Toutes les catégories', 'All categories', 'Todas las categorías', 'Tutte le categorie') }]
  const seenCat = new Set<string>()
  for (const c of cats) {
    if (!c) continue
    const k = normCat(c)
    if (seenCat.has(k)) continue
    seenCat.add(k)
    catOptions.push({ value: c, label: stockCatLabel(c, lang) })
  }
  // Statut : valeurs identiques aux libellés statusOf (status_out/status_low/OK)
  // → la comparaison de filtre (s.label === statusFilter) reste inchangée.
  const statusOptions: FilterOption[] = [
    { value: '', label: i('Tous statuts', 'All statuses', 'Todos los estados', 'Tutti gli stati') },
    { value: t('status_out'), label: t('status_out') },
    { value: t('status_low'), label: t('status_low') },
    { value: 'OK', label: 'OK' },
  ]
  return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">{t('stock_title')}</span>
          <div className="flex items-center gap-2">
            <div style={{ display:'flex', background:'var(--bg3)', borderRadius:8, padding:2, border:'1px solid var(--border)' }}>
              <button onClick={() => setStockView('grid')} aria-pressed={stockView === 'grid'} aria-label={i('Vue grille', 'Grid view', 'Vista cuadrícula', 'Vista griglia')} style={{ padding:'4px 8px', borderRadius:6, border:'none', cursor:'pointer', background: stockView === 'grid' ? 'var(--p)' : 'transparent', color: stockView === 'grid' ? '#fff' : 'var(--text3)', display:'flex', alignItems:'center', transition:'all .15s' }} title={i('Vue grille', 'Grid view', 'Vista cuadrícula', 'Vista griglia')}><LayoutGrid size={13} /></button>
              <button onClick={() => setStockView('list')} aria-pressed={stockView === 'list'} aria-label={i('Vue liste', 'List view', 'Vista lista', 'Vista elenco')} style={{ padding:'4px 8px', borderRadius:6, border:'none', cursor:'pointer', background: stockView === 'list' ? 'var(--p)' : 'transparent', color: stockView === 'list' ? '#fff' : 'var(--text3)', display:'flex', alignItems:'center', transition:'all .15s' }} title={i('Vue liste', 'List view', 'Vista lista', 'Vista elenco')}><AlignJustify size={13} /></button>
            </div>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
              // Prix stockés en base XOF → convertis vers la devise d'affichage (pattern reportsExport)
              const currency = useAppStore.getState().currency
              const cv = (xof: number) => Math.round(convertFromXOF(xof ?? 0, currency) * 100) / 100
              exportCSV('habashop_stock',
                ['SKU', i('Produit','Product','Producto','Prodotto'), i('Catégorie','Category','Categoría','Categoria'),
                 `${i('Prix achat','Buy price','Precio compra','Prezzo acquisto')} (${currency})`,
                 `${i('Prix vente','Sell price','Precio venta','Prezzo vendita')} (${currency})`,
                 `${i('Marge','Margin','Margen','Margine')} (%)`, `${i('Profit','Profit','Beneficio','Profitto')} (${currency})`,
                 'Stock', i('Seuil','Threshold','Umbral','Soglia'), i('Fournisseur','Supplier','Proveedor','Fornitore'), i('Statut','Status','Estado','Stato')],
                products.map(p => [p.sku, p.name, p.category, cv(p.buy), cv(p.sell), productMargin(p.buy, p.sell).pct ?? '', cv(productMargin(p.buy, p.sell).profitXof), p.stock, p.threshold, p.supplier, statusOf(p.stock,p.threshold).label])
              )
              toast.success(i('Export CSV téléchargé !','CSV export downloaded!','¡Exportación CSV descargada!','Esportazione CSV scaricata!'))
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
              toast.success('PDF ouvert !')
            }}>
              <Download size={13} /> PDF
            </button>
            {missingBarcodeCount > 0 && (
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={onOpenBackfill}
                title={i('Compléter les codes-barres manquants', 'Complete missing barcodes', 'Completar códigos faltantes', 'Completa i codici mancanti')}
                style={{ color: 'var(--warn)', borderColor: 'color-mix(in srgb, var(--warn) 40%, transparent)' }}>
                <Camera size={13} /> {i('Codes manquants', 'Missing codes', 'Códigos faltantes', 'Codici mancanti')} ({missingBarcodeCount})
              </button>
            )}
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { setSelectedForLabel(products.map(p => p.sku)); setShowLabelModal(true) }}>
              <Tag size={13} /> {lang === 'en' ? 'Labels' : lang === 'es' ? 'Etiquetas' : lang === 'it' ? 'Etichette' : 'Étiquettes'}
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => { setProductEditMode(true); setShowModal(true) }}>
              <Plus size={13} /> {t('btn_add')}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="search-wrap flex-1 min-w-40" style={{ display:'flex', alignItems:'center' }}>
            <span className="search-icon"><Search size={13} /></span>
            <input className="input pl-8 py-2 text-sm w-full"
              aria-label={i('Rechercher (nom, SKU, code-barres)', 'Search (name, SKU, barcode)', 'Buscar (nombre, SKU, código de barras)', 'Cerca (nome, SKU, codice a barre)')}
              placeholder={i('Rechercher (nom, SKU, code-barres)', 'Search (name, SKU, barcode)', 'Buscar (nombre, SKU, código)', 'Cerca (nome, SKU, codice)') + '…'}
              value={search} onChange={e => setSearch(e.target.value)} />
            <button type="button" onClick={() => setShowSearchScanner(true)}
              aria-label={i('Scanner pour rechercher', 'Scan to search', 'Escanear para buscar', 'Scansiona per cercare')}
              title={i('Scanner pour rechercher', 'Scan to search', 'Escanear para buscar', 'Scansiona per cercare')}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, marginRight:4, background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer' }}>
              <Camera size={16} />
            </button>
          </div>
          {showSearchScanner && (
            <Suspense fallback={null}>
              <BarcodeScanner
                onScan={code => { setSearch(normalizeBarcode(code)); setShowSearchScanner(false) }}
                onClose={() => setShowSearchScanner(false)}
              />
            </Suspense>
          )}
          <FilterSelect
            value={cat} onChange={setCat}
            ariaLabel={t('col_category')}
            options={catOptions}
            minWidth={170}
            icon={<Tag size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
          />
          <FilterSelect
            value={statusFilter} onChange={setStatusFilter}
            ariaLabel={t('col_status')}
            options={statusOptions}
            minWidth={150}
          />
          {/* Filtre « En promotion » — TOUJOURS visible (même à 0) pour NOMMER la fonction :
              c'est le levier de découvrabilité, la promo produit étant sinon invisible en liste. */}
          <button type="button" onClick={() => setPromoOnly(!promoOnly)} aria-pressed={promoOnly}
            style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:'var(--fs-sm)', fontWeight:'var(--fw-semibold)', fontFamily:'var(--font)', cursor:'pointer',
              borderRadius:'var(--r-full)', padding:'7px 13px', minHeight:36,
              background: promoOnly ? 'var(--c-purple-bg)' : 'var(--card)', color: promoOnly ? 'var(--p2)' : 'var(--text2)',
              border:`1px solid ${promoOnly ? 'var(--border3)' : 'var(--border)'}` }}>
            <Sparkles size={14} style={{ flexShrink:0 }} />
            {i('En promotion', 'On promotion', 'En promoción', 'In promozione')}
            <span style={{ fontFamily:'var(--mono)', fontSize:'var(--fs-label)', opacity:.85 }}>{promoCount}</span>
          </button>
        </div>

        {/* Compteur de résultats — annoncé aux lecteurs d'écran à chaque filtre/recherche */}
        <div className="sr-only" role="status" aria-live="polite">
          {pg.total} {i('produits affichés', 'products displayed', 'productos mostrados', 'prodotti visualizzati')}
        </div>

        {/* Filtre promo actif mais AUCUNE promo → on NOMME la fonction et on dit comment
            en créer une (c'est le cœur de la découvrabilité : sinon le marchand ignore
            que la promo existe). */}
        {promoOnly && pg.total === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)' }}>
            <Sparkles size={32} style={{ color:'var(--p2)', marginBottom:12 }} />
            <div style={{ fontSize:'var(--fs-body)', color:'var(--text2)', fontWeight:'var(--fw-semibold)', marginBottom:6 }}>
              {i('Aucune promotion active', 'No active promotion', 'Sin promoción activa', 'Nessuna promozione attiva')}
            </div>
            <div style={{ fontSize:'var(--fs-sm)', maxWidth:360, margin:'0 auto', lineHeight:1.5 }}>
              {i('Pour mettre un produit en promotion : ouvrez sa fiche, cliquez sur « Modifier », puis activez « Produit en promotion » et fixez un prix promo + une date de fin.',
                 'To put a product on promotion: open its details, click “Edit”, then turn on “Product on promotion” and set a promo price + end date.',
                 'Para poner un producto en promoción: abra su ficha, haga clic en «Editar», active «Producto en promoción» y fije un precio promo + fecha de fin.',
                 'Per mettere un prodotto in promozione: apri la scheda, clicca “Modifica”, attiva “Prodotto in promozione” e imposta un prezzo promo + data di fine.')}
            </div>
          </div>
        ) : stockView === 'grid' ? (
          <ResponsiveGrid min={200} role="list" aria-label={i('Produits', 'Products', 'Productos', 'Prodotti')}>
            {pg.paginated.map((p: ProductItem) => {
              const st = statusOf(p.stock, p.threshold)
              const pct = Math.min(100, (p.stock / Math.max(p.threshold, 1)) * 100)
              const isSelected = selectedSkus.has(p.sku)
              return (
                <div key={p.sku} role="listitem" style={{
                  background: isSelected ? 'rgba(91,78,232,0.06)' : 'var(--card)',
                  border: `1px solid ${isSelected ? 'var(--p)' : 'var(--border)'}`,
                  borderLeft: `3px solid ${isSelected ? 'var(--p)' : 'var(--border)'}`,
                  borderRadius:14, padding:16, display:'flex', flexDirection:'column', gap:10,
                  transition:'all .18s', position:'relative',
                }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,.2)' }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = ''; el.style.boxShadow = '' }}
                >
                  <input
                    type="checkbox"
                    aria-label={`${i('Sélectionner', 'Select', 'Seleccionar', 'Seleziona')} ${p.name}`}
                    checked={isSelected}
                    onChange={() => onToggleSelect(p.sku)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: 10, right: 10,
                      width: 18, height: 18, accentColor: 'var(--p)', cursor: 'pointer', zIndex: 1,
                    }}
                  />
                  <div style={{ display:'flex', alignItems:'center', gap:10, paddingRight: 28 }}>
                    <div style={{ width:42, height:42, borderRadius:12, background:'var(--bg3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-2xl)', flexShrink:0 }}>
                      {p.name.match(/^\S+/)?.[0]}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.name.replace(/^\S+\s?/, '')}
                      </div>
                      {stockShowSKU && <div style={{ fontSize:'var(--fs-caption)', color:'var(--text4)', fontFamily:'var(--mono)' }}>{p.sku}</div>}
                    </div>
                    {isActivePromo(p) && (
                      <span style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.4px', borderRadius:'var(--r-full)', padding:'2px 7px', background:'var(--c-purple-bg)', color:'var(--p2)', border:'1px solid var(--border3)' }}>
                        <Sparkles size={10} /> PROMO
                      </span>
                    )}
                    <span className={`badge ${st.cls}`} style={{ flexShrink:0 }}>{st.label}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <div style={{ padding:'7px 9px', borderRadius:8, background:'var(--c-purple-bg2)', border:'1px solid rgba(108,71,255,.15)' }}>
                      <div style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:1 }}>{lang === 'en' ? 'Buy' : lang === 'es' ? 'Compra' : lang === 'it' ? 'Acquisto' : 'Achat'}</div>
                      <div style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-bold)', color:'var(--p3)', fontFamily:'var(--mono)' }}>{fmt(p.buy)}</div>
                    </div>
                    <div style={{ padding:'7px 9px', borderRadius:8, background:'var(--c-green-bg2)', border:'1px solid rgba(0,208,132,.15)' }}>
                      <div style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:1 }}>{lang === 'en' ? 'Sell' : lang === 'es' ? 'Vender' : lang === 'it' ? 'Vendi' : 'Vente'}</div>
                      <div style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)' }}>{fmt(p.sell)}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--fs-caption)', color:'var(--text3)', marginBottom:4 }}>
                      <span>Stock</span>
                      <span style={{ fontFamily:'var(--mono)', fontWeight:'var(--fw-semibold)', color: st.cls === 'badge-red' ? 'var(--danger)' : st.cls === 'badge-amber' ? 'var(--acc)' : 'var(--acc2)' }}>
                        {p.stock}<span style={{ color:'var(--text4)', fontWeight:400 }}>/{p.threshold}</span>
                      </span>
                    </div>
                    <div style={{ height:5, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background: st.cls === 'badge-red' ? 'var(--danger)' : st.cls === 'badge-amber' ? 'var(--acc)' : 'var(--acc2)', transition:'width .3s' }} />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:5, marginTop:2 }}>
                    {st.cls !== 'badge-green' && (
                      <button className="mini-btn" style={{ flex:1, cursor:'pointer', justifyContent:'center', display:'flex', alignItems:'center', gap:4, fontSize:'var(--fs-caption)' }} onClick={() => navigate('/app/orders')}>
                        <Package size={11} /> {lang === 'en' ? 'Order' : lang === 'es' ? 'Pedir' : lang === 'it' ? 'Ordina' : 'Commander'}
                      </button>
                    )}
                    <button className="mini-btn" style={{ cursor:'pointer' }} title={lang === 'en' ? 'View' : lang === 'es' ? 'Ver' : lang === 'it' ? 'Vedi' : 'Voir'}
                      aria-label={(lang === 'en' ? 'View ' : lang === 'es' ? 'Ver ' : lang === 'it' ? 'Vedi ' : 'Voir ') + p.name}
                      onClick={() => {
                      const h = hydrate(p)
                      setForm(f => ({ ...f, sku: p.sku, name: p.name.replace(/^\S+\s/, ''), category: p.category, buy: h.buy, sell: h.sell, stock: p.stock, threshold: p.threshold, supplier: p.supplier, supplierId: p.supplierId ?? '', image: p.name.match(/^\S+/)?.[0] ?? '📦', barcode: p.barcode ?? '', description: p.description ?? '', notes: p.notes ?? '', priceWholesale: h.priceWholesale, priceSemiWholesale: h.priceSemiWholesale, priceTiers: h.priceTiers }))
                      setEditingSku(p.sku); setEditingId(p._id ?? null); setModalTab('general'); setProductEditMode(false); setShowModal(true)
                    }}><Eye size={11} /></button>
                    <button className="mini-btn" style={{ cursor:'pointer', color:'var(--danger)' }}
                      title={lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'}
                      aria-label={(lang === 'en' ? 'Delete ' : lang === 'es' ? 'Eliminar ' : lang === 'it' ? 'Elimina ' : 'Supprimer ') + p.name}
                      onClick={e => { e.stopPropagation(); onDeleteProduct(p) }}
                    ><Trash2 size={11} /></button>
                  </div>
                </div>
              )
            })}
          </ResponsiveGrid>
        ) : (
          <div className="table-wrap stock-table">
            <table aria-label={t('stock_title')}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 36, padding: '0 8px' }}>
                    <input
                      type="checkbox"
                      aria-label={i('Tout sélectionner', 'Select all', 'Seleccionar todo', 'Seleziona tutto')}
                      checked={allVisibleSelected}
                      ref={el => { if (el) el.indeterminate = someVisibleSelected }}
                      onChange={() => (allVisibleSelected ? onClearSelection() : onSelectAllVisible())}
                      style={{ width: 16, height: 16, accentColor: 'var(--p)', cursor: 'pointer' }}
                    />
                  </th>
                  <th scope="col">{t('col_product')}</th><th scope="col">{t('col_category')}</th>
                  <th scope="col">{t('col_buy_price')}</th><th scope="col">{t('col_sell_price')}</th><th scope="col">{i('Marge', 'Margin', 'Margen', 'Margine')}</th>
                  <th scope="col">{t('col_stock')}</th><th scope="col">{t('col_threshold')}</th><th scope="col">{t('col_supplier')}</th>
                  <th scope="col">{t('col_status')}</th><th scope="col">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pg.paginated.map((p: ProductItem) => {
                  const st = statusOf(p.stock, p.threshold)
                  const mg = productMargin(p.buy, p.sell)
                  const mgColor = mg.pct === null ? 'var(--text4)'
                    : themeIsLight ? 'var(--text)'
                    : mg.pct < 0 ? 'var(--danger)' : mg.pct < 15 ? 'var(--warn)' : 'var(--acc2)'
                  const isSelected = selectedSkus.has(p.sku)
                  return (
                    <tr key={p.sku} style={isSelected ? { background: 'rgba(91,78,232,0.06)' } : undefined}>
                      <td style={{ padding: '0 8px', borderLeft: isSelected ? '3px solid var(--p)' : '3px solid transparent' }}>
                        <input
                          type="checkbox"
                          aria-label={`${i('Sélectionner', 'Select', 'Seleccionar', 'Seleziona')} ${p.name}`}
                          checked={isSelected}
                          onChange={() => onToggleSelect(p.sku)}
                          style={{ width: 16, height: 16, accentColor: 'var(--p)', cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                          <span aria-hidden="true" style={{ fontSize:'var(--fs-lg)', flexShrink:0, lineHeight:1 }}>{p.name.match(/^\S+/)?.[0]}</span>
                          <span style={{ minWidth:0 }}>
                            <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:'var(--fs-body)', fontWeight:'var(--fw-regular)', color:'var(--text)', minWidth:0 }}>
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name.replace(/^\S+\s?/, '')}</span>
                              {isActivePromo(p) && (
                                <span style={{ flexShrink:0, display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.4px', borderRadius:'var(--r-full)', padding:'1px 6px', background:'var(--c-purple-bg)', color:'var(--p2)', border:'1px solid var(--border3)' }}>
                                  <Sparkles size={9} /> Promo
                                </span>
                              )}
                            </span>
                            {stockShowSKU && (
                              <span style={{ display:'block', fontSize:'var(--fs-label)', color:'var(--text3)', fontFamily:'var(--mono)' }}>{p.sku}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td><span className="badge badge-teal">{stockCatLabel(p.category, lang)}</span></td>
                      <td className="td-num">{fmt(p.buy)}</td>
                      <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(p.sell)}</td>
                      <td className="td-num" style={{ color: mgColor }}>
                        {mg.pct === null ? '—' : `${mg.pct}%`}
                        {mg.pct !== null && <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fmt(mg.profitXof)}</span>}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 34, padding: '3px 9px', borderRadius: 'var(--r-full)',
                          fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)', lineHeight: 1.4,
                          background: st.cls === 'badge-red' ? 'var(--c-red-bg)' : st.cls === 'badge-amber' ? 'var(--c-orange-bg)' : 'var(--c-green-bg)',
                          border: `1px solid ${st.cls === 'badge-red' ? 'var(--c-red-border)' : st.cls === 'badge-amber' ? 'var(--c-orange-border)' : 'var(--c-green-border)'}`,
                          color: st.cls === 'badge-red' ? 'var(--danger)' : st.cls === 'badge-amber' ? 'var(--warn)' : 'var(--acc2)',
                        }}>{p.stock}</span>
                      </td>
                      <td className="td-num" style={{ color: 'var(--text3)' }}>{p.threshold}</td>
                      <td>
                        {p.supplier ? (
                          <span style={{
                            display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-label)',
                            background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)',
                          }}>{p.supplier}</span>
                        ) : <span style={{ color: 'var(--text4)' }}>—</span>}
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        <div className="flex gap-1.5">
                          {st.cls !== 'badge-green' && (
                            <button className="btn btn-sm btn-ghost stock-action gap-1"
                              title={i('Commander', 'Order', 'Pedir', 'Ordina')}
                              aria-label={`${i('Commander', 'Order', 'Pedir', 'Ordina')} ${p.name}`}
                              style={{ cursor:'pointer' }}
                              onClick={() => navigate('/app/orders')}><Package size={14} /></button>
                          )}
                          <button className="btn btn-sm btn-ghost stock-action" title={lang === 'en' ? 'View' : lang === 'es' ? 'Ver' : lang === 'it' ? 'Vedi' : 'Voir'}
                            aria-label={(lang === 'en' ? 'View ' : lang === 'es' ? 'Ver ' : lang === 'it' ? 'Vedi ' : 'Voir ') + p.name}
                            onClick={() => {
                              const h = hydrate(p)
                              setForm(f => ({ ...f,
                                sku: p.sku, name: p.name.replace(/^\S+\s/, ''),
                                category: p.category, buy: h.buy, sell: h.sell,
                                stock: p.stock, threshold: p.threshold, supplier: p.supplier,
                                supplierId: p.supplierId ?? '',
                                image: p.name.match(/^\S+/)?.[0] ?? '📦',
                                barcode: p.barcode ?? '',
                                description: p.description ?? '',
                                notes: p.notes ?? '',
                                priceWholesale: h.priceWholesale,
                                priceSemiWholesale: h.priceSemiWholesale,
                                priceTiers: h.priceTiers,
                              }))
                              setEditingSku(p.sku)
                              setEditingId(p._id ?? null)
                              setModalTab('general')
                              setProductEditMode(false)
                              setShowModal(true)
                            }}><Eye size={14} /></button>
                          <button className="btn btn-sm btn-ghost stock-action" style={{ color:'var(--danger)' }}
                            title={lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'}
                            aria-label={(lang === 'en' ? 'Delete ' : lang === 'es' ? 'Eliminar ' : lang === 'it' ? 'Elimina ' : 'Supprimer ') + p.name}
                            onClick={e => { e.stopPropagation(); onDeleteProduct(p) }}
                          ><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total} pageSize={pg.pageSize} onPage={pg.onPage} onPageSize={pg.onSize} lang={lang} />
      </div>
  )
}
