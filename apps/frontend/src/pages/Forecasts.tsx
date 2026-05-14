import { useState } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { ShoppingCart, FileText, Send, Download, AlertTriangle, TrendingDown, Package, DollarSign, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

type Priority = 'CRITIQUE' | 'URGENT' | 'NORMAL' | 'OK'

interface ForecastItem {
  id: number; sku: string; name: string; category: string
  currentStock: number; minStock: number; avgSales: number
  leadTime: number; unitPrice: number; supplier: string; priority: Priority
}

const FORECAST_ITEMS: ForecastItem[] = [
  { id:1, sku:'PRD-001', name:'🌾 Riz parfumé 5kg',       category:'Céréales',   currentStock:12,  minStock:20, avgSales:8,  leadTime:3, unitPrice:3200, supplier:'SENRIZ',         priority:'CRITIQUE' },
  { id:2, sku:'PRD-005', name:'🧼 Savon OMO 500g',         category:'Hygiène',    currentStock:5,   minStock:10, avgSales:15, leadTime:2, unitPrice:320,  supplier:'UNILEVER',       priority:'CRITIQUE' },
  { id:3, sku:'PRD-003', name:'🍚 Sucre 1kg',              category:'Épicerie',   currentStock:18,  minStock:50, avgSales:20, leadTime:2, unitPrice:600,  supplier:'CSS',            priority:'URGENT'   },
  { id:4, sku:'PRD-002', name:'🫙 Huile palme 1L',          category:'Corps gras', currentStock:18,  minStock:25, avgSales:12, leadTime:4, unitPrice:1200, supplier:'SONACO',         priority:'URGENT'   },
  { id:5, sku:'PRD-007', name:'🫒 Huile végétale 5L',       category:'Corps gras', currentStock:34,  minStock:15, avgSales:6,  leadTime:4, unitPrice:6500, supplier:'SONACO',         priority:'NORMAL'   },
  { id:6, sku:'PRD-004', name:'🌾 Farine blé 1kg',          category:'Céréales',   currentStock:89,  minStock:30, avgSales:18, leadTime:3, unitPrice:400,  supplier:'GRANDS MOULINS', priority:'NORMAL'   },
  { id:7, sku:'PRD-006', name:'🥛 Lait poudre 400g',        category:'Laitiers',   currentStock:67,  minStock:20, avgSales:10, leadTime:5, unitPrice:1500, supplier:'NESTLÉ',         priority:'NORMAL'   },
  { id:8, sku:'PRD-008', name:'🍅 Tomate concentrée 800g',  category:'Conserves',  currentStock:112, minStock:30, avgSales:25, leadTime:2, unitPrice:900,  supplier:'TOMAPOR',        priority:'OK'       },
]

const PRIORITY_CFG: Record<Priority, { cls: string; label: string }> = {
  CRITIQUE: { cls:'badge-red',    label:'⚡ Critique' },
  URGENT:   { cls:'badge-amber',  label:'🔶 Urgent'   },
  NORMAL:   { cls:'badge-violet', label:'📦 Normal'   },
  OK:       { cls:'badge-green',  label:'✅ OK'        },
}

function calcItem(item: ForecastItem) {
  const joursRestants = Math.floor(item.currentStock / item.avgSales)
  const qtyToOrder    = Math.max(0, item.avgSales * (item.leadTime + 7) - item.currentStock)
  const totalCost     = qtyToOrder * item.unitPrice
  return { joursRestants, qtyToOrder, totalCost }
}

type Tab = 'analyse' | 'bons'

export default function Forecasts() {
  const { lang } = useAppStore()
  void lang
  const fmt = useFormatAmount()

  const [tab, setTab]                       = useState<Tab>('analyse')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [catFilter, setCatFilter]           = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [cart, setCart]                     = useState<Set<number>>(new Set())
  const [validated, setValidated]           = useState<Set<string>>(new Set())

  const enriched      = FORECAST_ITEMS.map(item => ({ ...item, ...calcItem(item) }))
  const allCategories = Array.from(new Set(FORECAST_ITEMS.map(i => i.category)))
  const allSuppliers  = Array.from(new Set(FORECAST_ITEMS.map(i => i.supplier)))

  const filtered = enriched.filter(item => {
    if (priorityFilter && item.priority !== priorityFilter) return false
    if (catFilter && item.category !== catFilter) return false
    if (supplierFilter && item.supplier !== supplierFilter) return false
    return true
  })

  const critiques = enriched.filter(i => i.priority === 'CRITIQUE').length
  const urgents   = enriched.filter(i => i.priority === 'URGENT').length
  const totalCost = enriched.reduce((s, i) => s + i.totalCost, 0)
  const avgJours  = Math.round(enriched.reduce((s, i) => s + i.joursRestants, 0) / enriched.length)

  const supplierGroups = allSuppliers
    .map(supplier => ({ supplier, items: enriched.filter(i => i.supplier === supplier && i.qtyToOrder > 0) }))
    .filter(g => g.items.length > 0)

  function addToCart(id: number) {
    setCart(prev => new Set([...prev, id]))
    toast.success('Ajouté au bon de commande')
  }

  function orderAllCritiques() {
    const ids = enriched.filter(i => i.priority === 'CRITIQUE').map(i => i.id)
    setCart(prev => new Set([...prev, ...ids]))
    toast.success(`${ids.length} article(s) critique(s) ajouté(s) au bon de commande`)
  }

  function joursColor(j: number) {
    if (j < 5)  return 'var(--danger)'
    if (j < 10) return 'var(--acc)'
    return 'var(--acc2)'
  }

  function stockBar(current: number, min: number) {
    const pct = Math.min(100, Math.round(current / min * 100))
    const color = pct < 50 ? 'var(--danger)' : pct < 80 ? 'var(--acc)' : 'var(--acc2)'
    return { pct, color }
  }

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Articles critiques',  value:String(critiques), color:'var(--danger)', icon:<AlertTriangle size={20}/> },
          { label:'Articles urgents',    value:String(urgents),   color:'var(--acc)',    icon:<TrendingDown size={20}/> },
          { label:'Valeur à commander', value:fmt(totalCost),    color:'var(--p2)',     icon:<DollarSign size={20}/> },
          { label:'Jours stock moyen',  value:`${avgJours}j`,    color:'var(--acc2)',   icon:<Package size={20}/> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:22 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6 }}>
        {([
          { id:'analyse', label:'📊 Analyse & Prévisions' },
          { id:'bons',    label:'📋 Bons de commande'     },
        ] as { id:Tab; label:string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'8px 18px', borderRadius:10, fontSize:13, fontWeight:700,
            fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
            background: tab === t.id ? 'var(--p)' : 'var(--card)',
            color:      tab === t.id ? '#fff'     : 'var(--text2)',
            border:     tab === t.id ? 'none'     : '1px solid var(--border)',
            boxShadow:  tab === t.id ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ONGLET 1 — Analyse & Prévisions ── */}
      {tab === 'analyse' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📊 Analyse des stocks & Prévisions</span>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={orderAllCritiques}>
                <Zap size={13} /> Commander tout le critique
              </button>
              <button className="btn btn-primary btn-sm gap-1.5"
                onClick={() => { toast.success('Bons générés !'); setTab('bons') }}>
                <FileText size={13} /> Générer bons auto
              </button>
            </div>
          </div>

          {/* Filtres */}
          <div style={{ display:'flex', gap:9, marginBottom:14, flexWrap:'wrap' }}>
            <select className="input" value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              style={{ width:'auto', minWidth:150 }}>
              <option value="">Toutes priorités</option>
              <option value="CRITIQUE">Critique</option>
              <option value="URGENT">Urgent</option>
              <option value="NORMAL">Normal</option>
              <option value="OK">OK</option>
            </select>
            <select className="input" value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              style={{ width:'auto', minWidth:140 }}>
              <option value="">Toutes catégories</option>
              {allCategories.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="input" value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              style={{ width:'auto', minWidth:150 }}>
              <option value="">Tous fournisseurs</option>
              {allSuppliers.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Stock / Seuil</th>
                  <th>Ventes/j</th>
                  <th>Jours rest.</th>
                  <th>Délai liv.</th>
                  <th>Qté à cmd.</th>
                  <th>Coût estimé</th>
                  <th>Fournisseur</th>
                  <th>Priorité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const bar    = stockBar(item.currentStock, item.minStock)
                  const inCart = cart.has(item.id)
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="td-bold" style={{ fontSize:13 }}>{item.name}</div>
                        <div className="td-mono" style={{ fontSize:10, marginTop:2 }}>{item.sku}</div>
                      </td>
                      <td><span className="badge badge-teal">{item.category}</span></td>
                      <td style={{ minWidth:130 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ flex:1, height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ width:`${bar.pct}%`, height:'100%', background:bar.color, borderRadius:99 }} />
                          </div>
                          <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text2)', whiteSpace:'nowrap' }}>
                            {item.currentStock}/{item.minStock}
                          </span>
                        </div>
                      </td>
                      <td className="td-mono" style={{ fontSize:12 }}>{item.avgSales}</td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:12, color:joursColor(item.joursRestants) }}>
                          {item.joursRestants}j
                        </span>
                      </td>
                      <td className="td-mono" style={{ fontSize:12, color:'var(--text3)' }}>{item.leadTime}j</td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:12,
                          color: item.qtyToOrder > 0 ? 'var(--text)' : 'var(--text3)' }}>
                          {item.qtyToOrder > 0 ? item.qtyToOrder : '—'}
                        </span>
                      </td>
                      <td className="td-num" style={{ fontSize:12, color: item.totalCost > 0 ? 'var(--acc)' : 'var(--text3)' }}>
                        {item.totalCost > 0 ? fmt(item.totalCost) : '—'}
                      </td>
                      <td style={{ fontSize:12, color:'var(--text2)' }}>{item.supplier}</td>
                      <td>
                        <span className={`badge ${PRIORITY_CFG[item.priority].cls}`}>
                          {PRIORITY_CFG[item.priority].label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="mini-btn gap-1"
                            onClick={() => addToCart(item.id)}
                            style={{ color: inCart ? 'var(--acc2)' : undefined }}>
                            <ShoppingCart size={11} /> {inCart ? 'Ajouté' : 'Commander'}
                          </button>
                          <button className="mini-btn" onClick={() => toast(`👁 ${item.sku}`)}>👁</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Résumé panier */}
          {cart.size > 0 && (
            <div style={{
              marginTop:16, padding:'14px 18px',
              background:'rgba(91,78,232,.08)', border:'1px solid rgba(91,78,232,.2)',
              borderRadius:12, display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div>
                <span style={{ fontWeight:700, color:'var(--text)' }}>
                  {cart.size} article{cart.size > 1 ? 's' : ''} sélectionné{cart.size > 1 ? 's' : ''}
                </span>
                <span style={{ fontSize:12, color:'var(--text3)', marginLeft:10 }}>
                  Coût estimé :&nbsp;
                  <strong style={{ color:'var(--acc)', fontFamily:'var(--mono)' }}>
                    {fmt(enriched.filter(i => cart.has(i.id)).reduce((s, i) => s + i.totalCost, 0))}
                  </strong>
                </span>
              </div>
              <button className="btn btn-primary btn-sm gap-1.5"
                onClick={() => { toast.success('Bons de commande générés !'); setTab('bons') }}>
                <FileText size={13} /> Générer tous les bons
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET 2 — Bons de commande ── */}
      {tab === 'bons' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {supplierGroups.length === 0 ? (
            <div className="panel" style={{ textAlign:'center', color:'var(--text3)', padding:'40px 0', marginBottom:0 }}>
              <Package size={32} style={{ margin:'0 auto 12px', display:'block', opacity:.4 }} />
              Aucun article à commander
            </div>
          ) : supplierGroups.map(({ supplier, items }) => {
            const total       = items.reduce((s, i) => s + i.totalCost, 0)
            const isValidated = validated.has(supplier)
            return (
              <div key={supplier} className="panel" style={{ marginBottom:0 }}>
                <div className="panel-head">
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{
                      width:38, height:38, borderRadius:10, flexShrink:0,
                      background:'linear-gradient(135deg, var(--p), var(--p2))',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Send size={16} style={{ color:'#fff' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>🚚 {supplier}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
                        {items.length} article{items.length > 1 ? 's' : ''} · {fmt(total)} estimé
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button className="mini-btn gap-1" onClick={() => toast(`📤 Email envoyé à ${supplier}`)}>
                      <Send size={11} /> Email
                    </button>
                    <button className="mini-btn gap-1" onClick={() => toast(`📥 PDF ${supplier}`)}>
                      <Download size={11} /> PDF
                    </button>
                    {!isValidated ? (
                      <button className="btn btn-primary btn-sm"
                        onClick={() => { setValidated(v => new Set([...v, supplier])); toast.success(`Bon ${supplier} validé`) }}>
                        ✅ Valider bon
                      </button>
                    ) : (
                      <span className="badge badge-green">✅ Envoyé</span>
                    )}
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th style={{ textAlign:'center' }}>Qté</th>
                        <th style={{ textAlign:'right' }}>PU</th>
                        <th style={{ textAlign:'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>
                          <td className="td-bold" style={{ fontSize:13 }}>{item.name}</td>
                          <td className="td-mono" style={{ textAlign:'center' }}>{item.qtyToOrder}</td>
                          <td className="td-num" style={{ textAlign:'right', color:'var(--text2)', fontSize:12 }}>{fmt(item.unitPrice)}</td>
                          <td className="td-num" style={{ textAlign:'right', color:'var(--acc)', fontSize:12 }}>{fmt(item.totalCost)}</td>
                        </tr>
                      ))}
                      <tr style={{ background:'rgba(91,78,232,.06)' }}>
                        <td colSpan={3} style={{ fontWeight:800, fontSize:13, color:'var(--text)', padding:'10px 9px' }}>TOTAL</td>
                        <td style={{ textAlign:'right', fontWeight:900, fontSize:14, fontFamily:'var(--mono)', color:'var(--p2)', padding:'10px 9px' }}>
                          {fmt(total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
