import { useState, useEffect } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Package, Users, DollarSign, ShoppingCart, ShoppingBag, Download, Plus, AlertTriangle, CreditCard, Clock } from 'lucide-react'
import { dashboardApi } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

const SALES_CHART_FALLBACK = [
  { name:'Lun', ventes:320000, transactions:12 },
  { name:'Mar', ventes:450000, transactions:18 },
  { name:'Mer', ventes:280000, transactions:10 },
  { name:'Jeu', ventes:590000, transactions:24 },
  { name:'Ven', ventes:750000, transactions:31 },
  { name:'Sam', ventes:890000, transactions:38 },
  { name:'Dim', ventes:420000, transactions:17 },
]

type Lang = 'fr' | 'en' | 'es' | 'it'
type LangMap = Record<Lang, string>
const RECENT_ACTIVITY: Array<{
  type: string; iconType: 'sale'|'stock'|'hr'|'alert'; color: string; iconColor: string
  title: LangMap
  getDesc: (fmt: (n: number) => string, lang: string) => string
}> = [
  { type:'sale',  iconType:'sale',  color:'rgba(16,185,129,0.15)',  iconColor:'#10B981',
    title: { fr:'Vente #2041',       en:'Sale #2041',          es:'Venta #2041',       it:'Vendita #2041'    },
    getDesc: (f, l) => ({ fr:`${f(45000)} · Il y a 3 min · Caisse 1`, en:`${f(45000)} · 3 min ago · Till 1`, es:`${f(45000)} · Hace 3 min · Caja 1`, it:`${f(45000)} · 3 min fa · Cassa 1` })[l as Lang] ?? `${f(45000)} · Il y a 3 min · Caisse 1`,
  },
  { type:'stock', iconType:'stock', color:'rgba(245,158,11,0.15)',  iconColor:'#F59E0B',
    title: { fr:'Réception stock',   en:'Stock receipt',       es:'Recepción stock',   it:'Ricezione stock'  },
    getDesc: (_f, l) => ({ fr:'Fournisseur Diallo · Il y a 18 min', en:'Supplier Diallo · 18 min ago', es:'Proveedor Diallo · Hace 18 min', it:'Fornitore Diallo · 18 min fa' })[l as Lang] ?? 'Fournisseur Diallo · Il y a 18 min',
  },
  { type:'hr',    iconType:'hr',    color:'rgba(139,92,246,0.15)',  iconColor:'#8B5CF6',
    title: { fr:'Pointage Marie K.', en:'Clock-in Marie K.',   es:'Fichaje Marie K.',  it:'Timbratura Marie K.' },
    getDesc: (_f, l) => ({ fr:'Arrivée 08:02 · Il y a 35 min', en:'Arrived 08:02 · 35 min ago', es:'Llegada 08:02 · Hace 35 min', it:'Arrivo 08:02 · 35 min fa' })[l as Lang] ?? 'Arrivée 08:02 · Il y a 35 min',
  },
  { type:'alert', iconType:'alert', color:'rgba(239,68,68,0.15)',   iconColor:'#EF4444',
    title: { fr:'Alerte rupture',    en:'Out-of-stock alert',  es:'Alerta rotura',     it:'Allarme esaurimento' },
    getDesc: (_f, l) => ({ fr:'Sucre 50kg · Il y a 1h · Auto', en:'Sugar 50kg · 1h ago · Auto', es:'Azúcar 50kg · Hace 1h · Auto', it:'Zucchero 50kg · 1h fa · Auto' })[l as Lang] ?? 'Sucre 50kg · Il y a 1h · Auto',
  },
  { type:'sale',  iconType:'sale',  color:'rgba(16,185,129,0.15)',  iconColor:'#10B981',
    title: { fr:'Vente #2040',       en:'Sale #2040',          es:'Venta #2040',       it:'Vendita #2040'    },
    getDesc: (f, l) => ({ fr:`${f(128000)} · Il y a 1h 12 · Caisse 2`, en:`${f(128000)} · 1h 12 ago · Till 2`, es:`${f(128000)} · Hace 1h 12 · Caja 2`, it:`${f(128000)} · 1h 12 fa · Cassa 2` })[l as Lang] ?? `${f(128000)} · Il y a 1h 12 · Caisse 2`,
  },
]

function ActivityIcon({ type }: { type: 'sale'|'stock'|'hr'|'alert' }) {
  if (type === 'sale')  return <CreditCard  size={16} />
  if (type === 'stock') return <Package     size={16} />
  if (type === 'hr')    return <Clock       size={16} />
  return <AlertTriangle size={16} />
}

const TOP_PRODUCTS = [
  { rank: '1', name: 'Riz parfumé 5kg',  qty: 842, ca: 2100000, medal: true  },
  { rank: '2', name: 'Huile palme 1L',   qty: 612, ca: 1500000, medal: true  },
  { rank: '3', name: 'Farine blé 25kg',  qty: 430, ca:  980000, medal: true  },
  { rank: '4', name: 'Sucre 50kg',        qty: 318, ca:  720000, medal: false },
  { rank: '5', name: 'Savon 500g',         qty: 290, ca:  580000, medal: false },
]

const ALERTS = [
  { name: 'Riz parfumé 5kg', stock: 12, threshold: 20, status: 'badge-red',   label: 'Rupture' },
  { name: 'Huile palme 1L',  stock: 18, threshold: 25, status: 'badge-amber', label: 'Bas'     },
  { name: 'Sucre 50kg',      stock:  5, threshold: 10, status: 'badge-red',   label: 'Rupture' },
  { name: 'Farine blé 25kg', stock: 22, threshold: 30, status: 'badge-amber', label: 'Bas'     },
]

export default function Dashboard() {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  void lang // subscribe for t() reactivity

  const [stats, setStats] = useState({
    salesToday: 842000,
    transactionsToday: 47,
    salesMonth: 2650000,
    totalProducts: 248,
    lowStockProducts: 3,
    activeEmployees: 18,
    pendingOrders: 4,
  })

  const [salesChart, setSalesChart] = useState<{ name:string; ventes:number; transactions:number }[]>(SALES_CHART_FALLBACK)
  const [reportPeriod, setReportPeriod] = useState('7days')

  useEffect(() => {
    dashboardApi.stats()
      .then((data: any) => {
        if (data) setStats({
          salesToday:        data.salesToday        ?? stats.salesToday,
          transactionsToday: data.transactionsToday ?? stats.transactionsToday,
          salesMonth:        data.salesMonth        ?? stats.salesMonth,
          totalProducts:     data.totalProducts     ?? stats.totalProducts,
          lowStockProducts:  data.lowStockProducts  ?? stats.lowStockProducts,
          activeEmployees:   data.activeEmployees   ?? stats.activeEmployees,
          pendingOrders:     data.pendingOrders     ?? stats.pendingOrders,
        })
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    dashboardApi.sales(reportPeriod)
      .then((data: any) => {
        if (data?.sales?.length > 0) {
          const DAY_LABELS: Record<string,string[]> = {
            fr: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
            en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
            es: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
            it: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],
          }
          const labels = DAY_LABELS[lang] ?? DAY_LABELS.fr
          const grouped = data.sales.reduce((acc: any, sale: any) => {
            const d = new Date(sale.createdAt)
            const key = labels[d.getDay()]
            if (!acc[key]) acc[key] = { name: key, ventes: 0, transactions: 0 }
            acc[key].ventes += sale.total
            acc[key].transactions += 1
            return acc
          }, {})
          const chartData = Object.values(grouped)
          if (chartData.length > 0) setSalesChart(chartData as any)
        }
      })
      .catch(() => {})
  }, [reportPeriod, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const dateStr = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>
            {t('hello')}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="page-subtitle">{t('today')} — {dateStr}</p>
        </div>
        <button className="topbar-btn" onClick={() => navigate('/app/pos')}>
          <ShoppingCart size={14} />
          {lang === 'fr' ? 'Nouvelle vente' : lang === 'en' ? 'New sale' : lang === 'es' ? 'Nueva venta' : 'Nuova vendita'}
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: <ShoppingBag size={18} />, label: t('nav_pos'),           path: '/app/pos',     color: 'rgba(99,102,241,0.12)',  iconColor: 'var(--p2)'   },
          { icon: <Download    size={18} />, label: t('dash_receive_stock'), path: '/app/stock',   color: 'rgba(20,184,166,0.12)',  iconColor: 'var(--acc2)' },
          { icon: <Plus        size={18} />, label: t('btn_add'),            path: '/app/stock',   color: 'rgba(245,158,11,0.12)',  iconColor: 'var(--acc)'  },
          { icon: <Download    size={18} />, label: t('btn_export'),         path: '/app/reports', color: 'rgba(139,92,246,0.12)',  iconColor: 'var(--info)' },
        ].map(a => (
          <div key={a.label} className="qa-card" onClick={() => navigate(a.path)}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: a.color, color: a.iconColor }}>{a.icon}</div>
            <span className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>{a.label}</span>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpi_sales_today'),     value: fmt(stats.salesToday),          sub: `${stats.transactionsToday} tx`,          up: true  as const, evol: '+12%', icon: <DollarSign size={18} />, color: 'var(--p2)',   bg: 'rgba(108,71,255,.12)' },
          { label: t('kpi_stock'),           value: String(stats.totalProducts),    sub: `${stats.lowStockProducts} alertes`,      up: false as const, evol: '−3',   icon: <Package    size={18} />, color: 'var(--acc)',  bg: 'rgba(240,165,0,.12)'  },
          { label: t('kpi_employees'),       value: String(stats.activeEmployees),  sub: `${stats.pendingOrders} cmd. en attente`, up: null,           evol: '',     icon: <Users      size={18} />, color: 'var(--acc2)', bg: 'rgba(0,208,132,.12)'  },
          { label: t('kpi_monthly_revenue'), value: fmt(stats.salesMonth),          sub: `vs mois dernier`,                        up: true  as const, evol: '+7%',  icon: <TrendingUp size={18} />, color: 'var(--info)', bg: 'rgba(27,154,245,.12)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: k.bg, color: k.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{k.icon}</div>
              {k.up !== null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '3px 8px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700,
                  background: k.up ? 'rgba(0,208,132,.1)' : 'rgba(255,59,92,.1)',
                  color: k.up ? 'var(--acc2)' : 'var(--danger)',
                  border: `1px solid ${k.up ? 'rgba(0,208,132,.2)' : 'rgba(255,59,92,.2)'}`,
                }}>
                  {k.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {k.evol}
                </span>
              )}
            </div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub" style={{ marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart recharts */}
        <div className="panel lg:col-span-2">
          <div className="panel-head">
            <span className="panel-title">
              {lang === 'fr' ? 'Ventes — 7 derniers jours'
                : lang === 'en' ? 'Sales — Last 7 days'
                : lang === 'es' ? 'Ventas — Últimos 7 días'
                : 'Vendite — Ultimi 7 giorni'}
            </span>
            <select className="input" style={{ width:'auto', fontSize:12 }}
              value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}>
              <option value="7days">{lang === 'fr' ? '7 jours' : '7 days'}</option>
              <option value="30days">{lang === 'fr' ? '30 jours' : '30 days'}</option>
              <option value="3months">{lang === 'fr' ? '3 mois' : '3 months'}</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={salesChart} margin={{ top:5, right:5, bottom:5, left:5 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B4EE8" stopOpacity={1} />
                  <stop offset="100%" stopColor="#7C6FF0" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey="name" tick={{ fontSize:12, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false}
                tickFormatter={v => fmt(v).replace(/\s?F\s?CFA|€|\$/g, '').trim()} />
              <Tooltip
                contentStyle={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, fontSize:12 }}
                formatter={(value: any, name: string) => [
                  name === 'ventes' ? fmt(value) : value,
                  name === 'ventes'
                    ? (lang === 'fr' ? 'Ventes' : lang === 'en' ? 'Sales' : lang === 'es' ? 'Ventas' : 'Vendite')
                    : 'Transactions',
                ]}
              />
              <Bar dataKey="ventes" fill="url(#salesGrad)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alertes */}
        <div className="panel">
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'rgba(255,59,92,.12)', border: '1px solid rgba(255,59,92,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)',
              }}><AlertTriangle size={15} /></div>
              <span className="panel-title">{t('stock_alerts')}</span>
            </div>
            <span style={{
              background: 'rgba(255,59,92,.12)', color: 'var(--danger)',
              border: '1px solid rgba(255,59,92,.25)', borderRadius: 20,
              padding: '2px 9px', fontSize: 11, fontWeight: 800,
            }}>{ALERTS.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ALERTS.map(a => (
              <div key={a.name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 10,
                background: a.status === 'badge-red' ? 'rgba(255,59,92,.05)' : 'rgba(240,165,0,.05)',
                border: `1px solid ${a.status === 'badge-red' ? 'rgba(255,59,92,.12)' : 'rgba(240,165,0,.12)'}`,
              }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
                  color: a.status === 'badge-red' ? 'var(--danger)' : 'var(--acc)',
                }}>{a.stock}<span style={{ color: 'var(--text3)', fontWeight: 400 }}>/{a.threshold}</span></span>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: a.status === 'badge-red' ? 'rgba(255,59,92,.12)' : 'rgba(240,165,0,.12)',
                  color: a.status === 'badge-red' ? 'var(--danger)' : 'var(--acc)',
                  border: `1px solid ${a.status === 'badge-red' ? 'rgba(255,59,92,.2)' : 'rgba(240,165,0,.2)'}`,
                }}>{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity timeline */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">{t('recent_activity')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '10px 4px',
                borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background .12s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.02)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: a.color, border: '1px solid rgba(255,255,255,.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.iconColor,
                }}><ActivityIcon type={a.iconType} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    {a.title[lang as Lang] ?? a.title.fr}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
                    {a.getDesc(fmt, lang)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">{t('top_products')}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>{t('col_product')}</th><th>{t('col_qty')}</th><th>{t('col_revenue')}</th></tr></thead>
              <tbody>
                {TOP_PRODUCTS.map(p => (
                  <tr key={p.name}>
                    <td style={{ color: p.medal ? 'var(--acc)' : 'var(--text3)', fontWeight: 700 }}>{p.rank}</td>
                    <td className="td-bold text-xs">{p.name}</td>
                    <td className="td-num text-xs">{p.qty}</td>
                    <td className="td-num text-xs" style={{ color: 'var(--acc)' }}>{fmt(p.ca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
