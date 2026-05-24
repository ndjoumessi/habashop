import { useState, useEffect } from 'react'
import { useConfig, useFormatAmount, useAbbrevAmount, t } from '@/stores/appStore'
import { useAuthStore, canAccess } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Package, Users, DollarSign, ShoppingCart,
  ShoppingBag, Download, Plus, AlertTriangle, CreditCard, Clock,
  BarChart2, Activity, Target, Zap,
} from 'lucide-react'
import { dashboardApi } from '@/lib/api'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'

const SALES_CHART_FALLBACK = [
  { name: 'Lun', ventes: 320000, transactions: 12 },
  { name: 'Mar', ventes: 450000, transactions: 18 },
  { name: 'Mer', ventes: 280000, transactions: 10 },
  { name: 'Jeu', ventes: 590000, transactions: 24 },
  { name: 'Ven', ventes: 750000, transactions: 31 },
  { name: 'Sam', ventes: 890000, transactions: 38 },
  { name: 'Dim', ventes: 420000, transactions: 17 },
]

const DONUT_COLORS = ['#6C47FF', '#00D084', '#FF9500', '#00B8FF', '#FF3B5C', '#FFB800']

const catData = [
  { name: 'Céréales',   value: 4200000 },
  { name: 'Corps gras', value: 2800000 },
  { name: 'Hygiène',    value: 1900000 },
  { name: 'Laitiers',   value: 1400000 },
  { name: 'Conserves',  value: 980000  },
  { name: 'Épicerie',   value: 720000  },
]

const catTotal = catData.reduce((s, d) => s + d.value, 0)

type Lang = 'fr' | 'en' | 'es' | 'it'
type LangMap = Record<Lang, string>

const RECENT_ACTIVITY: Array<{
  iconType: 'sale' | 'stock' | 'hr' | 'alert'
  color: string; iconColor: string
  title: LangMap
  getDesc: (fmt: (n: number) => string, lang: string) => string
}> = [
  {
    iconType: 'sale', color: 'rgba(0,208,132,.15)', iconColor: '#00D084',
    title: { fr: 'Vente #2041', en: 'Sale #2041', es: 'Venta #2041', it: 'Vendita #2041' },
    getDesc: (f, l) => ({ fr: `${f(45000)} · Il y a 3 min · Caisse 1`, en: `${f(45000)} · 3 min ago · Till 1`, es: `${f(45000)} · Hace 3 min · Caja 1`, it: `${f(45000)} · 3 min fa · Cassa 1` })[l as Lang] ?? `${f(45000)} · 3 min`,
  },
  {
    iconType: 'stock', color: 'rgba(255,149,0,.15)', iconColor: '#FF9500',
    title: { fr: 'Réception stock', en: 'Stock receipt', es: 'Recepción stock', it: 'Ricezione stock' },
    getDesc: (_f, l) => ({ fr: 'Fournisseur Diallo · Il y a 18 min', en: 'Supplier Diallo · 18 min ago', es: 'Proveedor Diallo · Hace 18 min', it: 'Fornitore Diallo · 18 min fa' })[l as Lang] ?? '',
  },
  {
    iconType: 'hr', color: 'rgba(108,71,255,.15)', iconColor: '#A991FF',
    title: { fr: 'Pointage Marie K.', en: 'Clock-in Marie K.', es: 'Fichaje Marie K.', it: 'Timbratura Marie K.' },
    getDesc: (_f, l) => ({ fr: 'Arrivée 08:02 · Il y a 35 min', en: 'Arrived 08:02 · 35 min ago', es: 'Llegada 08:02 · Hace 35 min', it: 'Arrivo 08:02 · 35 min fa' })[l as Lang] ?? '',
  },
  {
    iconType: 'alert', color: 'rgba(255,59,92,.15)', iconColor: '#FF3B5C',
    title: { fr: 'Alerte rupture', en: 'Out-of-stock alert', es: 'Alerta rotura', it: 'Allarme esaurimento' },
    getDesc: (_f, l) => ({ fr: 'Sucre 50kg · Il y a 1h', en: 'Sugar 50kg · 1h ago', es: 'Azúcar 50kg · Hace 1h', it: 'Zucchero 50kg · 1h fa' })[l as Lang] ?? '',
  },
  {
    iconType: 'sale', color: 'rgba(0,208,132,.15)', iconColor: '#00D084',
    title: { fr: 'Vente #2040', en: 'Sale #2040', es: 'Venta #2040', it: 'Vendita #2040' },
    getDesc: (f, l) => ({ fr: `${f(128000)} · Il y a 1h 12`, en: `${f(128000)} · 1h 12 ago`, es: `${f(128000)} · Hace 1h 12`, it: `${f(128000)} · 1h 12 fa` })[l as Lang] ?? `${f(128000)}`,
  },
]

function ActivityIcon({ type }: { type: 'sale' | 'stock' | 'hr' | 'alert' }) {
  if (type === 'sale')  return <CreditCard size={15} />
  if (type === 'stock') return <Package size={15} />
  if (type === 'hr')    return <Clock size={15} />
  return <AlertTriangle size={15} />
}

const TOP_PRODUCTS = [
  { rank: 1, name: 'Riz parfumé 5kg', qty: 842, ca: 2100000, pct: 100 },
  { rank: 2, name: 'Huile palme 1L',  qty: 612, ca: 1500000, pct: 71  },
  { rank: 3, name: 'Farine blé 25kg', qty: 430, ca: 980000,  pct: 46  },
  { rank: 4, name: 'Sucre 50kg',       qty: 318, ca: 720000,  pct: 34  },
  { rank: 5, name: 'Savon 500g',        qty: 290, ca: 580000,  pct: 27  },
]

const ALERTS = [
  { name: 'Riz parfumé 5kg', stock: 12, threshold: 20, cls: 'badge-red',   label: 'Rupture' },
  { name: 'Huile palme 1L',  stock: 18, threshold: 25, cls: 'badge-amber', label: 'Bas'     },
  { name: 'Sucre 50kg',      stock:  5, threshold: 10, cls: 'badge-red',   label: 'Rupture' },
  { name: 'Farine blé 25kg', stock: 22, threshold: 30, cls: 'badge-amber', label: 'Bas'     },
]

const RANK_COLORS = ['#6C47FF', '#00D084', '#FF9500', '#8888A8', '#8888A8']

const RenderDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 800, pointerEvents: 'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

const CatTooltip = ({ active, payload }: any) => {
  const fmt = useFormatAmount()
  if (!active || !payload?.length) return null
  const p = payload[0]
  const pct = Math.round((p.value / catTotal) * 100)
  const idx = catData.findIndex(d => d.name === p.name)
  const color = DONUT_COLORS[idx >= 0 ? idx : 0]
  return (
    <div style={{
      background: '#0A0A16',
      border: `1px solid ${color}55`,
      borderRadius: 12, padding: '12px 16px',
      boxShadow: '0 12px 40px rgba(0,0,0,.85)',
      fontFamily: 'var(--font)', minWidth: 160, zIndex: 9999,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}/>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{p.name}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: 'var(--mono)', marginBottom: 6 }}>
        {fmt(p.value)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }}/>
        </div>
        <span style={{ fontSize: 13, fontWeight: 900, color, fontFamily: 'var(--mono)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  const fmt = useFormatAmount()
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0D0D1C',
      border: '1px solid rgba(255,255,255,.15)',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,.8)',
      fontFamily: 'var(--font)',
      minWidth: 140,
    }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          {label}
        </div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i > 0 ? 4 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color ?? p.fill ?? 'var(--p)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{p.name ?? p.dataKey}</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
            {typeof p.value === 'number' ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const abbr = useAbbrevAmount()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  void lang

  const [stats, setStats] = useState({
    salesToday: 842000,
    transactionsToday: 47,
    salesMonth: 2650000,
    totalProducts: 248,
    lowStockProducts: 3,
    activeEmployees: 18,
    pendingOrders: 4,
  })
  const [salesChart, setSalesChart] = useState(SALES_CHART_FALLBACK)
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
          const DAY_LABELS: Record<string, string[]> = {
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


  const ALL_QUICK_ACTIONS = [
    { Icon: ShoppingBag, label: lang === 'fr' ? 'Nouvelle vente' : 'New sale',       path: '/app/pos',     color: 'rgba(108,71,255,.12)',  ic: 'var(--p3)'    },
    { Icon: Download,    label: lang === 'fr' ? 'Recevoir stock' : 'Receive stock',   path: '/app/stock',   color: 'rgba(0,208,132,.12)',   ic: 'var(--acc2)'  },
    { Icon: Plus,        label: lang === 'fr' ? 'Ajouter produit': 'Add product',     path: '/app/stock',   color: 'rgba(255,149,0,.12)',   ic: 'var(--acc)'   },
    { Icon: BarChart2,   label: lang === 'fr' ? 'Voir rapports'  : 'View reports',    path: '/app/reports', color: 'rgba(0,184,255,.12)',   ic: 'var(--acc3)'  },
    { Icon: Users,       label: lang === 'fr' ? 'Clients'        : 'Customers',       path: '/app/customers', color: 'rgba(244,114,182,.12)', ic: '#F472B6'   },
    { Icon: Target,      label: lang === 'fr' ? 'Objectifs'      : 'Goals',           path: '/app/goals',   color: 'rgba(139,92,246,.12)',  ic: '#8B5CF6'      },
    { Icon: Activity,    label: lang === 'fr' ? 'Activité'       : 'Activity',        path: '/app/activity',color: 'rgba(251,146,60,.12)',  ic: '#FB923C'      },
    { Icon: Zap,         label: 'IA Assistant',                                        path: '/app/ai',      color: 'rgba(108,71,255,.15)',  ic: 'var(--p2)'    },
  ]
  const QUICK_ACTIONS = ALL_QUICK_ACTIONS.filter(a => canAccess(user?.role, a.path.split('/').pop() || ''))

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 900, letterSpacing: '-.4px',
            background: 'linear-gradient(135deg,var(--text) 30%,var(--p3))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {t('hello')}, {user?.name?.split(' ')[0] || 'Nelson'} 👋
          </h1>
          <p className="page-subtitle">{t('today')} — {dateStr}</p>
        </div>
        {canAccess(user?.role, 'pos') && (
          <button className="btn-primary" onClick={() => navigate('/app/pos')} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ShoppingCart size={14} />
            {lang === 'fr' ? 'Nouvelle vente' : lang === 'en' ? 'New sale' : lang === 'es' ? 'Nueva venta' : 'Nuova vendita'}
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[
          { label: t('kpi_sales_today'),     value: fmt(stats.salesToday),         sub: `${stats.transactionsToday} transactions`,  evol: '+12%', up: true,  Icon: DollarSign, color: 'var(--p2)',   hex: '#6C47FF', bg: 'rgba(108,71,255,.14)' },
          { label: t('kpi_stock'),           value: String(stats.totalProducts),   sub: `${stats.lowStockProducts} alertes stock`,   evol: '−3',   up: false, Icon: Package,    color: 'var(--acc)',  hex: '#FF9500', bg: 'rgba(255,149,0,.14)'  },
          { label: t('kpi_employees'),       value: String(stats.activeEmployees), sub: `${stats.pendingOrders} cmd. en attente`,   evol: '',     up: null,  Icon: Users,      color: 'var(--acc2)', hex: '#00D084', bg: 'rgba(0,208,132,.14)'  },
          { label: t('kpi_monthly_revenue'), value: fmt(stats.salesMonth),         sub: 'vs mois dernier',                           evol: '+7%',  up: true,  Icon: TrendingUp, color: 'var(--acc3)', hex: '#00B8FF', bg: 'rgba(0,184,255,.14)'  },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{
            background: `linear-gradient(135deg,${k.hex}18,${k.hex}06)`,
            border: `1px solid ${k.hex}28`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: k.bg, color: k.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${k.color}30`,
              }}>
                <k.Icon size={19} />
              </div>
              {k.up !== null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
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
            <div className="kpi-value" style={{ color: k.color, fontSize: 24 }}>{k.value}</div>
            <div className="kpi-sub" style={{ marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions 2×4 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8 }}>
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} type="button"
            onClick={() => navigate(a.path)}
            aria-label={a.label}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all .18s var(--ease)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
              fontFamily: 'var(--font)',
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border3)'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--sh-sm)' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.transform = ''; el.style.boxShadow = '' }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: a.color, color: a.ic, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${a.ic}22` }}>
              <a.Icon size={17} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', lineHeight: 1.2, textAlign: 'center' }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="dashboard-charts-grid" style={{ display: 'grid', gap: 12 }}>
        {/* Bar chart (col span 2 on wide screens) */}
        <div className="panel dashboard-chart-wide" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(108,71,255,.15)', border: '1px solid rgba(108,71,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p3)' }}>
                <BarChart2 size={15} />
              </div>
              <span className="panel-title">
                {lang === 'fr' ? 'Ventes — 7 derniers jours' : lang === 'en' ? 'Sales — Last 7 days' : lang === 'es' ? 'Ventas — Últimos 7 días' : 'Vendite — Ultimi 7 giorni'}
              </span>
            </div>
            <select className="input" style={{ width: 'auto', fontSize: 12, minHeight: 34 }}
              value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}>
              <option value="7days">{lang === 'fr' ? '7 jours' : '7 days'}</option>
              <option value="30days">{lang === 'fr' ? '30 jours' : '30 days'}</option>
              <option value="3months">{lang === 'fr' ? '3 mois' : '3 months'}</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={salesChart} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D084" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00D084" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
                tickFormatter={v => abbr(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,.04)', stroke: 'rgba(255,255,255,.08)', strokeWidth: 1 }} />
              <Area dataKey="ventes" stroke="#00D084" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{lang === 'fr' ? 'CA par catégorie' : 'Revenue by category'}</span>
          </div>
          <div style={{ position: 'relative', margin: '0 -8px', overflow: 'visible' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={catData} cx="50%" cy="50%"
                  innerRadius={68} outerRadius={108}
                  stroke="none" paddingAngle={2}
                  dataKey="value"
                  label={RenderDonutLabel} labelLine={false}
                >
                  {catData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CatTooltip />} wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: 110, left: '50%',
              transform: 'translate(-50%,-50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 2 }}>Total CA</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>
                {`${(catTotal / 1000000).toFixed(1)}M`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6, padding: '0 4px' }}>
            {catData.map((d, i) => {
              const pct = Math.round((d.value / catTotal) * 100)
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i], flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text2)' }}>{d.name}</span>
                  <div style={{ width: 48, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: DONUT_COLORS[i], borderRadius: 99 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: DONUT_COLORS[i], minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Stock alerts + Activity + Top products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* Stock alerts */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,59,92,.12)', border: '1px solid rgba(255,59,92,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <AlertTriangle size={14} />
              </div>
              <span className="panel-title">{t('stock_alerts')}</span>
            </div>
            <span className="badge badge-red">{ALERTS.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {ALERTS.map(a => (
              <div key={a.name} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
                background: a.cls === 'badge-red' ? 'rgba(255,59,92,.05)' : 'rgba(255,184,0,.05)',
                border: `1px solid ${a.cls === 'badge-red' ? 'rgba(255,59,92,.15)' : 'rgba(255,184,0,.15)'}`,
              }}
                onClick={() => navigate('/app/stock')}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}
              >
                <Package size={13} style={{ color: a.cls === 'badge-red' ? 'var(--danger)' : 'var(--warn)', flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: a.cls === 'badge-red' ? 'var(--danger)' : 'var(--warn)' }}>
                  {a.stock}<span style={{ color: 'var(--text4)', fontWeight: 400 }}>/{a.threshold}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{t('recent_activity')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 11, alignItems: 'flex-start', padding: '9px 3px',
                borderBottom: i < RECENT_ACTIVITY.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background .12s', cursor: 'default', borderRadius: 8,
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.iconColor }}>
                  <ActivityIcon type={a.iconType} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* Top products with progress bars */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{t('top_products')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TOP_PRODUCTS.map((p, i) => (
              <div key={p.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: `${RANK_COLORS[i]}22`, border: `1px solid ${RANK_COLORS[i]}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, color: RANK_COLORS[i],
                  }}>{p.rank}</div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: RANK_COLORS[i] }}>{fmt(p.ca)}</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct}%`, background: RANK_COLORS[i], borderRadius: 99, transition: 'width .4s var(--ease)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
