import { useState } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { AlertTriangle, TrendingDown, Package, DollarSign } from 'lucide-react'
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

const PRIORITY_CFG: Record<Priority, { color: string; bg: string; border: string; label: string }> = {
  CRITIQUE: { color:'var(--danger)', bg:'rgba(232,64,74,.15)',  border:'rgba(232,64,74,.3)',  label:'⚡ Critique' },
  URGENT:   { color:'var(--acc)',    bg:'rgba(240,165,0,.15)',  border:'rgba(240,165,0,.3)',  label:'🔶 Urgent'   },
  NORMAL:   { color:'#A78BFA',      bg:'rgba(139,92,246,.15)', border:'rgba(139,92,246,.3)', label:'📦 Normal'   },
  OK:       { color:'var(--acc2)',   bg:'rgba(14,196,126,.15)', border:'rgba(14,196,126,.3)', label:'✅ OK'        },
}

const FILTER_MAP: Record<string, Priority | null> = {
  'Toutes':   null,
  'Critique': 'CRITIQUE',
  'Urgent':   'URGENT',
  'Normal':   'NORMAL',
  'OK':       'OK',
}

function joursRestants(item: ForecastItem) { return Math.floor(item.currentStock / item.avgSales) }
function qtyToOrder(item: ForecastItem)    { return Math.max(0, item.avgSales * (item.leadTime + 7) - item.currentStock) }
function totalCost(item: ForecastItem)     { return qtyToOrder(item) * item.unitPrice }

type ActiveTab = 'analyse' | 'bons'

export default function Forecasts() {
  const { lang } = useAppStore()
  void lang
  const fmt = useFormatAmount()

  const [activeTab, setActiveTab]       = useState<ActiveTab>('analyse')
  const [activeFilter, setActiveFilter] = useState('Toutes')
  const [validated, setValidated]       = useState<Set<string>>(new Set())

  const enriched = FORECAST_ITEMS.map(item => ({
    ...item,
    joursRestants: joursRestants(item),
    qtyToOrder:    qtyToOrder(item),
    totalCost:     totalCost(item),
  }))

  const critiques    = enriched.filter(i => i.priority === 'CRITIQUE').length
  const urgents      = enriched.filter(i => i.priority === 'URGENT').length
  const totalCostAll = enriched.reduce((s, i) => s + i.totalCost, 0)
  const avgJours     = Math.round(enriched.reduce((s, i) => s + i.joursRestants, 0) / enriched.length)
  const totalToOrder = FORECAST_ITEMS.filter(i => qtyToOrder(i) > 0).length

  const priorityKey   = FILTER_MAP[activeFilter]
  const filteredItems = priorityKey ? enriched.filter(i => i.priority === priorityKey) : enriched

  const allSuppliers   = Array.from(new Set(FORECAST_ITEMS.map(i => i.supplier)))
  const supplierGroups = allSuppliers
    .map(supplier => ({ supplier, items: enriched.filter(i => i.supplier === supplier && i.qtyToOrder > 0) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Articles critiques',  value:String(critiques),  color:'var(--danger)', icon:<AlertTriangle size={20}/> },
          { label:'Articles urgents',    value:String(urgents),    color:'var(--acc)',    icon:<TrendingDown size={20}/> },
          { label:'Valeur à commander', value:fmt(totalCostAll),  color:'var(--p2)',     icon:<DollarSign size={20}/> },
          { label:'Jours stock moyen',  value:`${avgJours}j`,     color:'var(--acc2)',   icon:<Package size={20}/> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:22 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:6 }}>
        {([
          { id:'analyse', label:'📊 Analyse & Prévisions stock' },
          { id:'bons',    label:'📋 Bons de commande auto'      },
        ] as { id:ActiveTab; label:string }[]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:'8px 18px', borderRadius:10, fontSize:13, fontWeight:700,
            fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
            background: activeTab === t.id ? 'var(--p)' : 'var(--card)',
            color:      activeTab === t.id ? '#fff'     : 'var(--text2)',
            border:     activeTab === t.id ? 'none'     : '1px solid var(--border)',
            boxShadow:  activeTab === t.id ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ONGLET A — Analyse & Prévisions stock ── */}
      {activeTab === 'analyse' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📊 Analyse des stocks & Prévisions</span>
          </div>

          {/* Filtres priorité + actions */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, alignItems:'center' }}>
            {['Toutes', 'Critique', 'Urgent', 'Normal', 'OK'].map(p => (
              <button key={p} onClick={() => setActiveFilter(p)} style={{
                padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                background: activeFilter === p ? 'var(--p)' : 'var(--bg3)',
                color:      activeFilter === p ? '#fff'     : 'var(--text2)',
                border:'none',
              }}>{p}</button>
            ))}
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button className="mini-btn" style={{ color:'var(--danger)' }}
                onClick={() => toast('⚡ Bons critiques générés !')}>
                ⚡ Commander critique
              </button>
              <button className="topbar-btn"
                onClick={() => { setActiveTab('bons'); toast('📋 Tous les bons générés !') }}>
                📋 Générer tous les bons
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Stock / Seuil</th>
                  <th>Ventes/j</th>
                  <th>Jours restants</th>
                  <th>Délai livraison</th>
                  <th>Qté à commander</th>
                  <th>Coût estimé</th>
                  <th>Fournisseur</th>
                  <th>Priorité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const j    = item.joursRestants
                  const qty  = item.qtyToOrder
                  const cost = item.totalCost
                  const prio = PRIORITY_CFG[item.priority]
                  const barPct   = Math.min(100, Math.round(item.currentStock / item.minStock * 100))
                  const barColor = item.currentStock < item.minStock * 0.3 ? 'var(--danger)'
                    : item.currentStock < item.minStock ? 'var(--acc)' : 'var(--acc2)'
                  const jColor = j <= 2 ? 'var(--danger)' : j <= 7 ? 'var(--acc)' : 'var(--acc2)'
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="td-bold">{item.name}</div>
                        <div className="td-mono" style={{ fontSize:10 }}>{item.sku}</div>
                      </td>
                      <td>
                        <span style={{
                          display:'inline-block', padding:'2px 9px', borderRadius:20,
                          fontSize:11, fontWeight:600,
                          background:'rgba(124,111,240,.15)', color:'#A89CF5',
                        }}>{item.category}</span>
                      </td>
                      <td>
                        <div style={{ minWidth:90 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                            <span style={{ fontWeight:700, fontFamily:'var(--mono)',
                              color: item.currentStock === 0 ? 'var(--danger)'
                                : item.currentStock < item.minStock ? 'var(--acc)' : 'var(--text)' }}>
                              {item.currentStock}
                            </span>
                            <span style={{ color:'var(--text3)', fontFamily:'var(--mono)' }}>/{item.minStock}</span>
                          </div>
                          <div style={{ height:4, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${barPct}%`, background:barColor, borderRadius:99, transition:'width .3s' }} />
                          </div>
                        </div>
                      </td>
                      <td className="td-mono" style={{ color:'var(--text2)' }}>{item.avgSales}/j</td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:13, color:jColor }}>
                          {j}j
                        </span>
                      </td>
                      <td className="td-mono" style={{ color:'var(--text3)' }}>{item.leadTime}j</td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: qty > 0 ? 'var(--p2)' : 'var(--text3)' }}>
                          {qty > 0 ? qty : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: qty > 0 ? 'var(--acc)' : 'var(--text3)' }}>
                          {qty > 0 ? fmt(cost) : '—'}
                        </span>
                      </td>
                      <td style={{ fontSize:12, color:'var(--text2)' }}>{item.supplier}</td>
                      <td>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          background:prio.bg, border:`1px solid ${prio.border}`,
                          color:prio.color, borderRadius:20,
                          padding:'3px 10px', fontSize:11, fontWeight:700, whiteSpace:'nowrap',
                        }}>{prio.label}</span>
                      </td>
                      <td>
                        {qty > 0 && (
                          <button className="mini-btn" style={{ color:'var(--p2)', fontSize:11 }}
                            onClick={() => toast.success(`🛒 ${item.name} ajouté au bon`)}>
                            🛒 Commander
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Résumé total */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 16px', marginTop:12,
            background:'var(--bg3)', borderRadius:12,
            border:'1px solid var(--border)',
          }}>
            <div style={{ display:'flex', gap:24 }}>
              <div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3, textTransform:'uppercase', letterSpacing:'.5px' }}>
                  ARTICLES À COMMANDER
                </div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)' }}>
                  {totalToOrder}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3, textTransform:'uppercase', letterSpacing:'.5px' }}>
                  COÛT TOTAL ESTIMÉ
                </div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--acc)', fontFamily:'var(--mono)' }}>
                  {fmt(totalCostAll)}
                </div>
              </div>
            </div>
            <button className="topbar-btn"
              onClick={() => { setActiveTab('bons'); toast('📋 Bons générés !') }}>
              📤 Générer tous les bons de commande
            </button>
          </div>
        </div>
      )}

      {/* ── ONGLET B — Bons de commande ── */}
      {activeTab === 'bons' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {supplierGroups.length === 0 ? (
            <div className="panel" style={{ textAlign:'center', color:'var(--text3)', padding:'40px 0', marginBottom:0 }}>
              <Package size={32} style={{ margin:'0 auto 12px', display:'block', opacity:.4 }} />
              Aucun article à commander
            </div>
          ) : supplierGroups.map(({ supplier, items }) => {
            const groupTotal  = items.reduce((s, i) => s + i.totalCost, 0)
            const isValidated = validated.has(supplier)
            return (
              <div key={supplier} style={{
                background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:14, overflow:'hidden',
              }}>
                {/* Header fournisseur */}
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 18px',
                  background:'linear-gradient(135deg, rgba(91,78,232,.1), rgba(124,111,240,.06))',
                  borderBottom:'1px solid var(--border)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:36, height:36, borderRadius:9,
                      background:'rgba(91,78,232,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18,
                    }}>🚚</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{supplier}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>
                        {items.length} article{items.length > 1 ? 's' : ''} · {fmt(groupTotal)} estimé
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button className="mini-btn" onClick={() => toast(`📥 PDF ${supplier}...`)}>
                      📥 PDF
                    </button>
                    <button className="mini-btn" onClick={() => toast(`📤 Email envoyé à ${supplier}`)}>
                      📤 Email
                    </button>
                    {!isValidated ? (
                      <button style={{
                        background:'linear-gradient(135deg, var(--p), var(--p2))',
                        border:'none', borderRadius:8, padding:'6px 14px',
                        fontSize:12, fontWeight:700, color:'#fff',
                        cursor:'pointer', fontFamily:'var(--font)',
                      }} onClick={() => { setValidated(v => new Set([...v, supplier])); toast.success(`✅ Bon ${supplier} validé !`) }}>
                        ✅ Valider
                      </button>
                    ) : (
                      <span className="badge badge-green">✅ Envoyé</span>
                    )}
                  </div>
                </div>

                {/* Lignes bon */}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Qté à commander</th>
                        <th>Prix unitaire</th>
                        <th>Total estimé</th>
                        <th>Délai</th>
                        <th>Priorité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const prio = PRIORITY_CFG[item.priority]
                        return (
                          <tr key={item.id}>
                            <td className="td-bold">{item.name}</td>
                            <td className="td-num" style={{ color:'var(--p2)' }}>{item.qtyToOrder}</td>
                            <td className="td-num">{fmt(item.unitPrice)}</td>
                            <td className="td-num" style={{ color:'var(--acc)' }}>{fmt(item.totalCost)}</td>
                            <td style={{ fontSize:12, color:'var(--text3)' }}>{item.leadTime} jours</td>
                            <td>
                              <span style={{
                                display:'inline-flex', alignItems:'center', gap:4,
                                background:prio.bg, color:prio.color,
                                border:`1px solid ${prio.border}`,
                                borderRadius:20, padding:'2px 9px',
                                fontSize:10, fontWeight:700, whiteSpace:'nowrap',
                              }}>{prio.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ background:'var(--bg3)' }}>
                        <td colSpan={3} style={{ textAlign:'right', fontWeight:800, fontSize:13, padding:'10px 9px', color:'var(--text)' }}>
                          TOTAL
                        </td>
                        <td className="td-num" style={{ color:'var(--p2)', fontSize:14, fontWeight:900 }}>
                          {fmt(groupTotal)}
                        </td>
                        <td colSpan={2} />
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
