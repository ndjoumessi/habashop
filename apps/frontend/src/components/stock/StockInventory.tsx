import { Search, Download, Plus, Tag, Package, Eye, Trash2, LayoutGrid, AlignJustify } from 'lucide-react'
import toast from 'react-hot-toast'
import { t, useAppStore } from '@/stores/appStore'
import { exportCSV, openPDF, htmlTable, htmlKPIs } from '@/utils/export'
import { hydratePricesFromApi } from '@/lib/productCurrency'
import Pagination from '@/components/ui/Pagination'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type ProductItem, statusOf, stockCatLabel } from '@/components/stock/stockShared'

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
  pg: any
  setSelectedForLabel: (v: any) => void
  setShowLabelModal: (b: boolean) => void
  setProductEditMode: (b: boolean) => void
  setShowModal: (b: boolean) => void
  setForm: (v: any) => void
  setEditingSku: (v: string | null) => void
  setEditingId: (v: string | null) => void
  setModalTab: (v: any) => void
  onDeleteProduct: (p: ProductItem) => void
  // Sélection inline pour impression étiquettes
  selectedSkus: Set<string>
  onToggleSelect: (sku: string) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
}

export default function StockInventory({ products, fmt, lang, stockShowSKU, navigate, stockView, setStockView, search, setSearch, cat, setCat, cats, statusFilter, setStatusFilter, pg, setSelectedForLabel, setShowLabelModal, setProductEditMode, setShowModal, setForm, setEditingSku, setEditingId, setModalTab, onDeleteProduct, selectedSkus, onToggleSelect, onSelectAllVisible, onClearSelection }: StockInventoryProps) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const currency = useAppStore(s => s.currency)
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
  return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">{t('stock_title')}</span>
          <div className="flex items-center gap-2">
            <div role="group" aria-label={i('Affichage', 'View', 'Vista', 'Visualizzazione')} style={{ display:'flex', background:'var(--bg3)', borderRadius:8, padding:2, border:'1px solid var(--border)' }}>
              <button onClick={() => setStockView('grid')} aria-pressed={stockView === 'grid'} aria-label={i('Vue grille', 'Grid view', 'Vista de cuadrícula', 'Vista a griglia')} title={i('Vue grille', 'Grid view', 'Vista de cuadrícula', 'Vista a griglia')} style={{ padding:'4px 8px', borderRadius:6, border:'none', cursor:'pointer', background: stockView === 'grid' ? 'var(--p)' : 'transparent', color: stockView === 'grid' ? '#fff' : 'var(--text3)', display:'flex', alignItems:'center', transition:'all .15s' }}><LayoutGrid size={13} /></button>
              <button onClick={() => setStockView('list')} aria-pressed={stockView === 'list'} aria-label={i('Vue liste', 'List view', 'Vista de lista', 'Vista a elenco')} title={i('Vue liste', 'List view', 'Vista de lista', 'Vista a elenco')} style={{ padding:'4px 8px', borderRadius:6, border:'none', cursor:'pointer', background: stockView === 'list' ? 'var(--p)' : 'transparent', color: stockView === 'list' ? '#fff' : 'var(--text3)', display:'flex', alignItems:'center', transition:'all .15s' }}><AlignJustify size={13} /></button>
            </div>
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
              <Tag size={13} /> {lang === 'en' ? 'Labels' : lang === 'es' ? 'Etiquetas' : lang === 'it' ? 'Etichette' : 'Étiquettes'}
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
            <input className="input pl-8 py-2 text-sm w-full" aria-label={i('Rechercher', 'Search', 'Buscar', 'Cerca')} placeholder={t('common_search') + '…'}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-2 text-sm w-auto" value={cat} onChange={e => setCat(e.target.value)}>
            <option value="">{t('pos_all')} {t('col_category').toLowerCase()}</option>
            {cats.filter(Boolean).map(c => <option key={c} value={c}>{stockCatLabel(c, lang)}</option>)}
          </select>
          <select className="input py-2 text-sm w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">{t('pos_all')} {t('col_status').toLowerCase()}</option>
            <option>{t('status_out')}</option>
            <option>{t('status_low')}</option>
            <option>OK</option>
          </select>
        </div>

        {/* Grid / List view */}
        {stockView === 'grid' ? (
          <ResponsiveGrid min={200}>
            {pg.paginated.map(p => {
              const st = statusOf(p.stock, p.threshold)
              const pct = Math.min(100, (p.stock / Math.max(p.threshold, 1)) * 100)
              const isSelected = selectedSkus.has(p.sku)
              return (
                <div key={p.sku} style={{
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
                    <div style={{ width:42, height:42, borderRadius:12, background:'var(--bg3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                      {p.name.match(/^\S+/)?.[0]}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.name.replace(/^\S+\s?/, '')}
                      </div>
                      {stockShowSKU && <div style={{ fontSize:11, color:'var(--text4)', fontFamily:'var(--mono)' }}>{p.sku}</div>}
                    </div>
                    <span className={`badge ${st.cls}`} style={{ flexShrink:0 }}>{st.label}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <div style={{ padding:'7px 9px', borderRadius:8, background:'var(--c-purple-bg2)', border:'1px solid rgba(108,71,255,.15)' }}>
                      <div style={{ fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:1 }}>{lang === 'en' ? 'Buy' : lang === 'es' ? 'Compra' : lang === 'it' ? 'Acquisto' : 'Achat'}</div>
                      <div style={{ fontSize:12, fontWeight:'var(--fw-bold)', color:'var(--p3)', fontFamily:'var(--mono)' }}>{fmt(p.buy)}</div>
                    </div>
                    <div style={{ padding:'7px 9px', borderRadius:8, background:'var(--c-green-bg2)', border:'1px solid rgba(0,208,132,.15)' }}>
                      <div style={{ fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text4)', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:1 }}>{lang === 'en' ? 'Sell' : lang === 'es' ? 'Vender' : lang === 'it' ? 'Vendi' : 'Vente'}</div>
                      <div style={{ fontSize:12, fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)' }}>{fmt(p.sell)}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginBottom:4 }}>
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
                      <button className="mini-btn" style={{ flex:1, cursor:'pointer', justifyContent:'center', display:'flex', alignItems:'center', gap:4, fontSize:11 }} onClick={() => navigate('/app/orders')}>
                        <Package size={11} /> {lang === 'en' ? 'Order' : lang === 'es' ? 'Pedir' : lang === 'it' ? 'Ordina' : 'Commander'}
                      </button>
                    )}
                    <button className="mini-btn" style={{ cursor:'pointer' }} title={i('Voir', 'View', 'Ver', 'Vedi')} aria-label={`${i('Voir', 'View', 'Ver', 'Vedi')} ${p.name}`} onClick={() => {
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
          <div className="table-wrap">
            <table>
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
                  {stockShowSKU && <th scope="col">{t('col_ref')}</th>}
                  <th scope="col">{t('col_product')}</th><th scope="col">{t('col_category')}</th>
                  <th scope="col">{t('col_buy_price')}</th><th scope="col">{t('col_sell_price')}</th>
                  <th scope="col">{t('col_stock')}</th><th scope="col">{t('col_threshold')}</th><th scope="col">{t('col_supplier')}</th>
                  <th scope="col">{t('col_status')}</th><th scope="col">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pg.paginated.map(p => {
                  const st = statusOf(p.stock, p.threshold)
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
                      {stockShowSKU && <td className="td-mono">{p.sku}</td>}
                      <td className="td-bold">{p.name}</td>
                      <td><span className="badge badge-teal">{stockCatLabel(p.category, lang)}</span></td>
                      <td className="td-num">{fmt(p.buy)}</td>
                      <td className="td-num" style={{ color: 'var(--acc2)' }}>{fmt(p.sell)}</td>
                      <td>
                        <span className="td-num" style={{
                          color: st.cls === 'badge-red' ? 'var(--danger)' : st.cls === 'badge-amber' ? 'var(--acc)' : 'var(--acc2)',
                          fontWeight: 'var(--fw-semibold)',
                        }}>{p.stock}</span>
                      </td>
                      <td className="td-num" style={{ color: 'var(--text3)' }}>{p.threshold}</td>
                      <td className="text-xs" style={{ color: 'var(--text2)' }}>{p.supplier}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        <div className="flex gap-1.5">
                          {st.cls !== 'badge-green' && (
                            <button className="btn btn-sm btn-ghost gap-1" title={i('Commander', 'Order', 'Pedir', 'Ordina')} aria-label={`${i('Commander', 'Order', 'Pedir', 'Ordina')} ${p.name}`} style={{ cursor:'pointer' }}
                              onClick={() => navigate('/app/orders')}><Package size={12} /></button>
                          )}
                          <button className="btn btn-sm btn-ghost" title={i('Voir', 'View', 'Ver', 'Vedi')} aria-label={`${i('Voir', 'View', 'Ver', 'Vedi')} ${p.name}`}
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
                            }}><Eye size={12} /></button>
                          <button className="btn btn-sm btn-ghost" style={{ color:'var(--danger)' }}
                            title={lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'}
                            aria-label={(lang === 'en' ? 'Delete ' : lang === 'es' ? 'Eliminar ' : lang === 'it' ? 'Elimina ' : 'Supprimer ') + p.name}
                            onClick={e => { e.stopPropagation(); onDeleteProduct(p) }}
                          ><Trash2 size={12} /></button>
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
