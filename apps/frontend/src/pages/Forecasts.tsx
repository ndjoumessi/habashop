import { useState } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { TrendingUp, Package, Users, Calendar, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Data ──────────────────────────────────────────────────────────────────────

const CA_DATA = [
  { month:'Jan', reel:1850000,  prevu:null,    type:'reel'  },
  { month:'Fév', reel:2100000,  prevu:null,    type:'reel'  },
  { month:'Mar', reel:1920000,  prevu:null,    type:'reel'  },
  { month:'Avr', reel:2380000,  prevu:null,    type:'reel'  },
  { month:'Mai', reel:2650000,  prevu:null,    type:'reel'  },
  { month:'Jun', reel:null,     prevu:2850000, type:'prevu' },
  { month:'Jul', reel:null,     prevu:3100000, type:'prevu' },
  { month:'Aoû', reel:null,     prevu:3350000, type:'prevu' },
  { month:'Sep', reel:null,     prevu:3600000, type:'prevu' },
  { month:'Oct', reel:null,     prevu:3800000, type:'prevu' },
  { month:'Nov', reel:null,     prevu:4000000, type:'prevu' },
  { month:'Déc', reel:null,     prevu:4200000, type:'prevu' },
]

const QUARTERLY = [
  { quarter:'Q2 2026', ca:7150000,  depenses:4576000, marge:34, reel:true  },
  { quarter:'Q3 2026', ca:9300000,  depenses:5766000, marge:38, reel:false },
  { quarter:'Q4 2026', ca:11500000, depenses:6900000, marge:40, reel:false },
]

const RH_FORECAST = [
  { month:'Juin 2026', besoins:2, motif:'Hausse ventes été',    cout:440000, type:'recrutement' },
  { month:'Juil 2026', besoins:1, motif:'Remplacement congés',  cout:220000, type:'interim'     },
  { month:'Août 2026', besoins:1, motif:'Remplacement congés',  cout:220000, type:'interim'     },
  { month:'Sep 2026',  besoins:0, motif:'Effectifs suffisants', cout:0,      type:'ok'          },
]

const TOP_GROWTH = [
  { name:'🌾 Riz parfumé 5kg',   currentCA:2100000, forecastCA:2730000, growth:30 },
  { name:'🫒 Huile végétale 5L', currentCA:850000,  forecastCA:1105000, growth:30 },
  { name:'🥛 Lait poudre 400g',  currentCA:660000,  forecastCA:792000,  growth:20 },
  { name:'🧼 Savon OMO 500g',    currentCA:580000,  forecastCA:667000,  growth:15 },
  { name:'☕ Café soluble 200g', currentCA:420000,  forecastCA:462000,  growth:10 },
]

const OBJECTIFS = [
  { label:'CA Juin',          target:2850000, current:0,  unit:'FCFA'    },
  { label:'CA Juillet',       target:3100000, current:0,  unit:'FCFA'    },
  { label:'Marge moyenne',    target:38,      current:34, unit:'%'       },
  { label:'Nouveaux clients', target:50,      current:24, unit:'clients' },
  { label:'Taux rupture',     target:2,       current:8,  unit:'%'       },
]

type Priority = 'CRITIQUE' | 'URGENT' | 'NORMAL' | 'OK'

interface ForecastItem {
  id: number; sku: string; name: string; category: string
  currentStock: number; minStock: number; avgSales: number
  leadTime: number; unitPrice: number; supplier: string; priority: Priority
}

const FORECAST_ITEMS: ForecastItem[] = [
  { id:1, sku:'PRD-001', name:'🌾 Riz parfumé 5kg',      category:'Céréales',   currentStock:12,  minStock:20, avgSales:8,  leadTime:3, unitPrice:3200, supplier:'SENRIZ',         priority:'CRITIQUE' },
  { id:2, sku:'PRD-005', name:'🧼 Savon OMO 500g',        category:'Hygiène',    currentStock:5,   minStock:10, avgSales:15, leadTime:2, unitPrice:320,  supplier:'UNILEVER',       priority:'CRITIQUE' },
  { id:3, sku:'PRD-003', name:'🍚 Sucre 1kg',             category:'Épicerie',   currentStock:18,  minStock:50, avgSales:20, leadTime:2, unitPrice:600,  supplier:'CSS',            priority:'URGENT'   },
  { id:4, sku:'PRD-002', name:'🫙 Huile palme 1L',         category:'Corps gras', currentStock:18,  minStock:25, avgSales:12, leadTime:4, unitPrice:1200, supplier:'SONACO',         priority:'URGENT'   },
  { id:5, sku:'PRD-007', name:'🫒 Huile végétale 5L',      category:'Corps gras', currentStock:34,  minStock:15, avgSales:6,  leadTime:4, unitPrice:6500, supplier:'SONACO',         priority:'NORMAL'   },
  { id:6, sku:'PRD-004', name:'🌾 Farine blé 1kg',         category:'Céréales',   currentStock:89,  minStock:30, avgSales:18, leadTime:3, unitPrice:400,  supplier:'GRANDS MOULINS', priority:'NORMAL'   },
  { id:7, sku:'PRD-006', name:'🥛 Lait poudre 400g',       category:'Laitiers',   currentStock:67,  minStock:20, avgSales:10, leadTime:5, unitPrice:1500, supplier:'NESTLÉ',         priority:'NORMAL'   },
  { id:8, sku:'PRD-008', name:'🍅 Tomate concentrée 800g', category:'Conserves',  currentStock:112, minStock:30, avgSales:25, leadTime:2, unitPrice:900,  supplier:'TOMAPOR',        priority:'OK'       },
]

const PRIORITY_CFG: Record<Priority, { color: string; bg: string; border: string; label: string }> = {
  CRITIQUE: { color:'var(--danger)', bg:'rgba(232,64,74,.15)',  border:'rgba(232,64,74,.3)',  label:'⚡ Critique' },
  URGENT:   { color:'var(--acc)',    bg:'rgba(240,165,0,.15)',  border:'rgba(240,165,0,.3)',  label:'🔶 Urgent'   },
  NORMAL:   { color:'#A78BFA',      bg:'rgba(139,92,246,.15)', border:'rgba(139,92,246,.3)', label:'📦 Normal'   },
  OK:       { color:'var(--acc2)',   bg:'rgba(14,196,126,.15)', border:'rgba(14,196,126,.3)', label:'✅ OK'        },
}

const FILTER_MAP: Record<string, Priority | null> = {
  'Toutes': null, 'Critique': 'CRITIQUE', 'Urgent': 'URGENT', 'Normal': 'NORMAL', 'OK': 'OK',
}

const RH_TYPE_CFG = {
  recrutement: { color:'var(--p2)',   bg:'rgba(91,78,232,.15)',  label:'🧑‍💼 Recrutement' },
  interim:     { color:'var(--acc)',  bg:'rgba(240,165,0,.15)',  label:'⏱ Intérim'      },
  ok:          { color:'var(--acc2)', bg:'rgba(14,196,126,.15)', label:'✅ Suffisant'    },
}

const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.']

function joursRestants(item: ForecastItem) { return Math.floor(item.currentStock / item.avgSales) }
function qtyToOrder(item: ForecastItem)    { return Math.max(0, item.avgSales * (item.leadTime + 7) - item.currentStock) }
function totalCost(item: ForecastItem)     { return qtyToOrder(item) * item.unitPrice }

type ActiveTab = 'analyse' | 'bons'

// ── Component ─────────────────────────────────────────────────────────────────

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

  const totalToOrder = enriched.filter(i => i.qtyToOrder > 0).length
  const totalCostAll = enriched.reduce((s, i) => s + i.totalCost, 0)

  const priorityKey   = FILTER_MAP[activeFilter]
  const filteredItems = priorityKey ? enriched.filter(i => i.priority === priorityKey) : enriched

  const allSuppliers   = Array.from(new Set(FORECAST_ITEMS.map(i => i.supplier)))
  const supplierGroups = allSuppliers
    .map(supplier => ({ supplier, items: enriched.filter(i => i.supplier === supplier && i.qtyToOrder > 0) }))
    .filter(g => g.items.length > 0)

  const maxCA = Math.max(...CA_DATA.map(d => d.reel ?? d.prevu ?? 0))
  const maxQCA = Math.max(...QUARTERLY.flatMap(q => [q.ca, q.depenses]))

  return (
    <div className="space-y-5 animate-in">

      {/* ── Section 1 — KPIs ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Meilleure semaine',    value:'842 000 FCFA',    sub:'sem. 19 — +5,25 % vs objectif', color:'var(--acc2)', icon:<TrendingUp size={20}/> },
          { label:'Stock à commander',    value:fmt(totalCostAll), sub:`${totalToOrder} articles en déficit`,  color:'var(--danger)', icon:<Package size={20}/> },
          { label:'Besoin RH (3 mois)',   value:'3 agents',        sub:'Juin–Août 2026',                 color:'var(--p2)',    icon:<Users size={20}/> },
          { label:'CA Q3 prévu',          value:fmt(9300000),      sub:'Marge estimée 38 %',             color:'var(--acc)',   icon:<Calendar size={20}/> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:20 }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Section 2 — Graphiques CA ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Bar chart 12 mois */}
        <div className="panel" style={{ gridColumn:'span 2', marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📈 CA mensuel 2026 — Réel vs Prévu</span>
          </div>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)' }}>
              <div style={{ width:14, height:10, borderRadius:3, background:'linear-gradient(to top, var(--acc), #FCD34D)' }} />
              Réel
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)' }}>
              <div style={{ width:14, height:10, borderRadius:3, background:'linear-gradient(to top, var(--p), var(--p2))', opacity:.75, border:'1px dashed rgba(124,111,240,.5)' }} />
              Prévu
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:160 }}>
            {CA_DATA.map((d, i) => {
              const val    = d.reel ?? d.prevu ?? 0
              const h      = (val / maxCA) * 100
              const isReel = d.type === 'reel'
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div title={fmt(val)} style={{
                    width:'100%', height:`${h}%`,
                    background: isReel
                      ? 'linear-gradient(to top, var(--acc), #FCD34D)'
                      : 'linear-gradient(to top, var(--p), var(--p2))',
                    borderRadius:'4px 4px 0 0',
                    opacity: isReel ? 1 : 0.75,
                    border: isReel ? 'none' : '1px dashed rgba(124,111,240,.5)',
                    minHeight:4, cursor:'pointer', transition:'opacity .2s',
                  }} />
                  <span style={{ fontSize:9, color: isReel ? 'var(--text2)' : 'var(--text3)' }}>{d.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Trimestriel CA vs dépenses */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📊 Trimestriel</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {QUARTERLY.map(q => (
              <div key={q.quarter}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{q.quarter}</span>
                    {!q.reel && <span style={{ fontSize:10, color:'var(--p2)', background:'rgba(91,78,232,.15)', padding:'1px 7px', borderRadius:20, fontWeight:700 }}>Prévu</span>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--acc2)' }}>+{q.marge}%</span>
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>CA</div>
                <div style={{ height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden', marginBottom:6 }}>
                  <div style={{
                    height:'100%', width:`${(q.ca / maxQCA) * 100}%`,
                    background:'linear-gradient(to right, var(--p), var(--p2))',
                    borderRadius:99,
                  }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ color:'var(--text3)' }}>Dépenses</span>
                  <span style={{ color:'var(--text2)', fontFamily:'var(--mono)', fontWeight:700 }}>{fmt(q.ca)}</span>
                </div>
                <div style={{ height:4, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', width:`${(q.depenses / maxQCA) * 100}%`,
                    background:'linear-gradient(to right, var(--danger), #F87171)',
                    borderRadius:99, opacity:.7,
                  }} />
                </div>
                <div style={{ textAlign:'right', fontSize:10, color:'var(--text3)', marginTop:3 }}>{fmt(q.depenses)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3 — Objectifs + Top croissance ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Objectifs */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">🎯 Objectifs à venir</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {OBJECTIFS.map(obj => {
              const isInverse  = obj.label === 'Taux rupture'
              const pct        = isInverse
                ? Math.min(100, Math.round((obj.target / obj.current) * 100))
                : obj.current === 0 ? 0 : Math.min(100, Math.round((obj.current / obj.target) * 100))
              const reached    = isInverse ? obj.current <= obj.target : obj.current >= obj.target
              const barColor   = reached ? 'var(--acc2)' : pct > 60 ? 'var(--acc)' : 'var(--p2)'
              const displayVal = obj.unit === 'FCFA' ? fmt(obj.current) : `${obj.current} ${obj.unit}`
              const displayTgt = obj.unit === 'FCFA' ? fmt(obj.target) : `${obj.target} ${obj.unit}`
              return (
                <div key={obj.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{obj.label}</span>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'var(--text3)' }}>
                        {displayVal} / {displayTgt}
                      </span>
                      {reached && <span style={{ fontSize:10, color:'var(--acc2)', fontWeight:800 }}>✓</span>}
                    </div>
                  </div>
                  <div style={{ height:8, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', width:`${pct}%`,
                      background: reached
                        ? 'linear-gradient(to right, var(--acc2), #34D399)'
                        : `linear-gradient(to right, ${barColor}, ${barColor}aa)`,
                      borderRadius:99, transition:'width .4s',
                    }} />
                  </div>
                  <div style={{ textAlign:'right', fontSize:10, color:'var(--text3)', marginTop:3 }}>{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top croissance */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">🚀 Top croissance prévue (3 mois)</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {TOP_GROWTH.map((p, i) => {
              const maxGrowth = TOP_GROWTH[0].growth
              const barW = (p.growth / maxGrowth) * 100
              return (
                <div key={p.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:16, minWidth:24, textAlign:'center' }}>{MEDALS[i]}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{p.name}</span>
                      <span style={{ fontSize:13, fontWeight:900, color:'var(--acc2)' }}>+{p.growth}%</span>
                    </div>
                    <div style={{ height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden', marginBottom:3 }}>
                      <div style={{
                        height:'100%', width:`${barW}%`,
                        background:'linear-gradient(to right, var(--acc2), #34D399)',
                        borderRadius:99,
                      }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)' }}>
                      <span>{fmt(p.currentCA)}</span>
                      <span style={{ color:'var(--acc2)' }}>{fmt(p.forecastCA)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Section 4 — RH Forecast ──────────────────────────────── */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">👥 Prévisions RH — Besoins à venir</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {RH_FORECAST.map(r => {
            const cfg = RH_TYPE_CFG[r.type as keyof typeof RH_TYPE_CFG]
            return (
              <div key={r.month} style={{
                background: cfg.bg,
                border:`1px solid ${cfg.color}33`,
                borderRadius:14, padding:'16px 18px',
              }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'var(--text2)' }}>{r.month}</span>
                  <span style={{
                    fontSize:10, fontWeight:700, color:cfg.color,
                    background:`${cfg.color}22`, padding:'2px 8px', borderRadius:20,
                  }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize:28, fontWeight:900, color:cfg.color, fontFamily:'var(--mono)', marginBottom:4 }}>
                  {r.besoins > 0 ? `+${r.besoins}` : '—'}
                </div>
                <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>{r.motif}</div>
                {r.cout > 0 && (
                  <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                    Coût estimé : <span style={{ color:cfg.color, fontWeight:700 }}>{fmt(r.cout)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 5 — Stock onglets ────────────────────────────── */}
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

      {/* ── Onglet A — Analyse ─── */}
      {activeTab === 'analyse' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📊 Analyse des stocks & Prévisions</span>
          </div>

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
                  const j        = item.joursRestants
                  const qty      = item.qtyToOrder
                  const cost     = item.totalCost
                  const prio     = PRIORITY_CFG[item.priority]
                  const barPct   = Math.min(100, Math.round(item.currentStock / item.minStock * 100))
                  const barColor = item.currentStock < item.minStock * 0.3 ? 'var(--danger)'
                    : item.currentStock < item.minStock ? 'var(--acc)' : 'var(--acc2)'
                  const jColor   = j <= 2 ? 'var(--danger)' : j <= 7 ? 'var(--acc)' : 'var(--acc2)'
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

          {/* Résumé */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 16px', marginTop:12,
            background:'var(--bg3)', borderRadius:12, border:'1px solid var(--border)',
          }}>
            <div style={{ display:'flex', gap:24 }}>
              <div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3, textTransform:'uppercase', letterSpacing:'.5px' }}>ARTICLES À COMMANDER</div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)' }}>{totalToOrder}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3, textTransform:'uppercase', letterSpacing:'.5px' }}>COÛT TOTAL ESTIMÉ</div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--acc)', fontFamily:'var(--mono)' }}>{fmt(totalCostAll)}</div>
              </div>
            </div>
            <button className="topbar-btn"
              onClick={() => { setActiveTab('bons'); toast('📋 Bons générés !') }}>
              <ShoppingCart size={13} /> Générer tous les bons de commande
            </button>
          </div>
        </div>
      )}

      {/* ── Onglet B — Bons de commande ─── */}
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
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                    }}>🚚</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{supplier}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>
                        {items.length} article{items.length > 1 ? 's' : ''} · {fmt(groupTotal)} estimé
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button className="mini-btn" onClick={() => toast(`📥 PDF ${supplier}...`)}>📥 PDF</button>
                    <button className="mini-btn" onClick={() => toast(`📤 Email envoyé à ${supplier}`)}>📤 Email</button>
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
                        <td colSpan={3} style={{ textAlign:'right', fontWeight:800, fontSize:13, padding:'10px 9px', color:'var(--text)' }}>TOTAL</td>
                        <td className="td-num" style={{ color:'var(--p2)', fontSize:14, fontWeight:900 }}>{fmt(groupTotal)}</td>
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
