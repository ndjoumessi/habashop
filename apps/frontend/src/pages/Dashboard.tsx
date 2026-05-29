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

const DONUT_COLORS = ['#6C47FF', '#00D084', '#FF9500', '#00B8FF', '#FF3B5C', '#FFB800']

type Lang = 'fr' | 'en' | 'es' | 'it'
type LangMap = Record<Lang, string>

function ActivityIcon({ type }: { type: 'sale' | 'stock' | 'hr' | 'alert' }) {
  if (type === 'sale')  return <CreditCard size={15} />
  if (type === 'stock') return <Package size={15} />
  if (type === 'hr')    return <Clock size={15} />
  return <AlertTriangle size={15} />
}

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
  const pct = Math.round((p.percent ?? 0) * 100)
  const color = p.payload?.color ?? DONUT_COLORS[0]
  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${color}55`,
      borderRadius: 12, padding: '12px 16px',
      boxShadow: '0 12px 40px rgba(0,0,0,.85)',
      fontFamily: 'var(--font)', minWidth: 160, zIndex: 9999,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}/>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
        {fmt(p.value)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
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
      background: 'var(--card)',
      border: '1px solid var(--border2)',
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
    salesToday: 0,
    transactionsToday: 0,
    salesMonth: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    activeEmployees: 0,
    pendingOrders: 0,
    totalReceivables: 0,
    nbDebtors: 0,
  })
  const [salesChart, setSalesChart] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [stockAlerts, setStockAlerts] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [catData, setCatData] = useState<any[]>([])
  const [reportPeriod, setReportPeriod] = useState('7days')
  const catTotal = catData.reduce((s, d) => s + (d.value ?? 0), 0)

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
          totalReceivables:  data.totalReceivables  ?? stats.totalReceivables,
          nbDebtors:         data.nbDebtors         ?? stats.nbDebtors,
        })
        setTopProducts(data?.topProducts ?? [])
        setStockAlerts(data?.stockAlerts ?? [])
        setRecentActivity(data?.recentActivity ?? [])
        setCatData((data?.categoryBreakdown ?? []).map((c: any, i: number) => ({ ...c, color: DONUT_COLORS[i % DONUT_COLORS.length] })))
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
          setSalesChart(chartData as any)
        } else {
          setSalesChart([])
        }
      })
      .catch(() => setSalesChart([]))
  }, [reportPeriod, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const dateStr = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })


  const ALL_QUICK_ACTIONS = [
    { Icon: ShoppingBag, label: lang === 'en' ? 'New sale' : lang === 'es' ? 'Nueva venta' : lang === 'it' ? 'Nuova vendita' : 'Nouvelle vente',       path: '/app/pos',     color: 'rgba(108,71,255,.12)',  ic: 'var(--p3)'    },
    { Icon: Download,    label: lang === 'en' ? 'Receive stock' : lang === 'es' ? 'Recibir stock' : lang === 'it' ? 'Ricevi stock' : 'Recevoir stock',   path: '/app/stock',   color: 'rgba(0,208,132,.12)',   ic: 'var(--acc2)'  },
    { Icon: Plus,        label: lang === 'en' ? 'Add product' : lang === 'es' ? 'Agregar producto' : lang === 'it' ? 'Aggiungi prodotto' : 'Ajouter produit',     path: '/app/stock',   color: 'rgba(255,149,0,.12)',   ic: 'var(--acc)'   },
    { Icon: BarChart2,   label: lang === 'en' ? 'View reports' : lang === 'es' ? 'Ver informes' : lang === 'it' ? 'Vedi rapporti' : 'Voir rapports',    path: '/app/reports', color: 'rgba(0,184,255,.12)',   ic: 'var(--acc3)'  },
    { Icon: Users,       label: lang === 'en' ? 'Customers' : lang === 'es' ? 'Clientes' : lang === 'it' ? 'Clienti' : 'Clients',       path: '/app/customers', color: 'rgba(244,114,182,.12)', ic: '#F472B6'   },
    { Icon: Target,      label: lang === 'en' ? 'Goals' : lang === 'es' ? 'Objetivos' : lang === 'it' ? 'Obiettivi' : 'Objectifs',           path: '/app/goals',   color: 'rgba(139,92,246,.12)',  ic: '#8B5CF6'      },
    { Icon: Activity,    label: lang === 'en' ? 'Activity' : lang === 'es' ? 'Actividad' : lang === 'it' ? 'Attività' : 'Activité',        path: '/app/activity',color: 'rgba(251,146,60,.12)',  ic: '#FB923C'      },
    { Icon: Zap,         label: 'IA Assistant',                                        path: '/app/ai',      color: 'rgba(108,71,255,.15)',  ic: 'var(--p2)'    },
  ]
  const QUICK_ACTIONS = ALL_QUICK_ACTIONS.filter(a => canAccess(user?.role, a.path.split('/').pop() || ''))

  // Toutes les sections sont alimentées par l'API ; états vides sinon (pas de démo).
  const emptyHint = lang === 'en' ? 'Start by recording your first sales' : lang === 'es' ? 'Comience registrando sus primeras ventas' : lang === 'it' ? 'Inizia registrando le tue prime vendite' : 'Commencez par enregistrer vos premières ventes'
  const isNewTenant = stats.transactionsToday === 0 && stats.salesMonth === 0 && stats.totalProducts === 0

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

      {isNewTenant && (
        <div style={{
          background: 'linear-gradient(135deg,rgba(108,71,255,.12),rgba(0,208,132,.08))',
          border: '1px solid rgba(108,71,255,.25)',
          borderRadius: 16, padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>🎉</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
              {lang === 'fr'
                ? `Bienvenue sur HabaShop, ${user?.name?.split(' ')[0] ?? ''} !`
                : `Welcome to HabaShop, ${user?.name?.split(' ')[0] ?? ''}!`}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              {lang === 'en' ? 'Your shop is ready. Start by adding products then open the register.' : lang === 'es' ? 'Su tienda está lista. Comience agregando sus productos y luego abra la caja.' : lang === 'it' ? 'Il tuo negozio è pronto. Inizia aggiungendo i prodotti poi apri la cassa.' : 'Votre boutique est prête. Commencez par ajouter vos produits puis ouvrez la caisse.'}
            </div>
          </div>
          <button onClick={() => navigate('/app/stock')} className="btn-primary" style={{ flexShrink: 0, fontSize: 13 }}>
            {lang === 'en' ? '+ Add products' : lang === 'es' ? '+ Agregar productos' : lang === 'it' ? '+ Aggiungi prodotti' : '+ Ajouter des produits'}
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[
          { label: t('kpi_sales_today'),     value: fmt(stats.salesToday),         sub: `${stats.transactionsToday} ${lang === 'en' ? 'transactions' : lang === 'es' ? 'transacciones' : lang === 'it' ? 'transazioni' : 'transactions'}`,  evol: '+12%', up: true,  Icon: DollarSign, color: 'var(--p2)',   hex: '#6C47FF', bg: 'rgba(108,71,255,.14)' },
          { label: t('kpi_stock'),           value: String(stats.totalProducts),   sub: `${stats.lowStockProducts} ${lang === 'en' ? 'stock alerts' : lang === 'es' ? 'alertas stock' : lang === 'it' ? 'avvisi stock' : 'alertes stock'}`,   evol: '−3',   up: false, Icon: Package,    color: 'var(--acc)',  hex: '#FF9500', bg: 'rgba(255,149,0,.14)'  },
          { label: t('kpi_employees'),       value: String(stats.activeEmployees), sub: `${stats.pendingOrders} ${lang === 'en' ? 'pending orders' : lang === 'es' ? 'ped. pendientes' : lang === 'it' ? 'ord. in attesa' : 'cmd. en attente'}`,   evol: '',     up: null,  Icon: Users,      color: 'var(--acc2)', hex: '#00D084', bg: 'rgba(0,208,132,.14)'  },
          { label: t('kpi_monthly_revenue'), value: fmt(stats.salesMonth),         sub: lang === 'en' ? 'vs last month' : lang === 'es' ? 'vs mes pasado' : lang === 'it' ? 'vs mese scorso' : 'vs mois dernier',                           evol: '+7%',  up: true,  Icon: TrendingUp, color: 'var(--acc3)', hex: '#00B8FF', bg: 'rgba(0,184,255,.14)'  },
          { label: lang === 'en' ? 'Receivables' : lang === 'es' ? 'Cuentas por cobrar' : lang === 'it' ? 'Crediti clienti' : 'Créances clients',
            value: fmt(stats.totalReceivables),
            sub: `${stats.nbDebtors} ${lang === 'en' ? 'debtors' : lang === 'es' ? 'deudores' : lang === 'it' ? 'debitori' : 'débiteurs'}`,
            evol: '', up: null, Icon: CreditCard, color: '#F59E0B', hex: '#F59E0B', bg: 'rgba(245,158,11,.14)' },
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
              <option value="7days">{lang === 'en' ? '7 days' : lang === 'es' ? '7 días' : lang === 'it' ? '7 giorni' : '7 jours'}</option>
              <option value="30days">{lang === 'en' ? '30 days' : lang === 'es' ? '30 días' : lang === 'it' ? '30 giorni' : '30 jours'}</option>
              <option value="3months">{lang === 'en' ? '3 months' : lang === 'es' ? '3 meses' : lang === 'it' ? '3 mesi' : '3 mois'}</option>
            </select>
          </div>
          <div role="img" aria-label={lang === 'fr' ? 'Graphique des ventes par jour' : lang === 'en' ? 'Daily sales chart' : lang === 'es' ? 'Gráfico de ventas diarias' : 'Grafico vendite giornaliere'}>
          {salesChart.length === 0 ? (
            <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '0 16px' }}>
              {lang === 'en' ? 'No sales yet' : lang === 'es' ? 'Sin ventas por ahora' : lang === 'it' ? 'Nessuna vendita per ora' : 'Aucune vente pour le moment'}
            </div>
          ) : (
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(108,71,255,.06)', stroke: 'rgba(108,71,255,.18)', strokeWidth: 1 }} />
              <Area dataKey="ventes" stroke="#00D084" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          )}
          </div>
        </div>

        {/* Donut chart */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{lang === 'en' ? 'Revenue by category' : lang === 'es' ? 'Ingresos por categoría' : lang === 'it' ? 'Ricavi per categoria' : 'CA par catégorie'}</span>
          </div>
          {catData.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {lang === 'en' ? 'No sales data available' : lang === 'es' ? 'No hay datos de ventas' : lang === 'it' ? 'Nessun dato di vendita' : 'Aucune donnée de vente disponible'}
            </div>
          ) : (<>
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
                {abbr(catTotal)}
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
          </>)}
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
            {stockAlerts.length > 0 && <span className="badge badge-red">{stockAlerts.length}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {stockAlerts.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--acc2)', fontSize: 13, fontWeight: 600 }}>
                {lang === 'en' ? '✅ No stock alerts' : lang === 'es' ? '✅ Sin alertas de stock' : lang === 'it' ? '✅ Nessun avviso di stock' : '✅ Aucune alerte de stock'}
              </div>
            ) : stockAlerts.map((a, i) => {
              const red = (a.stockQty ?? 0) === 0
              return (
              <div key={(a.name ?? '') + i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
                background: red ? 'rgba(255,59,92,.05)' : 'rgba(255,184,0,.05)',
                border: `1px solid ${red ? 'rgba(255,59,92,.15)' : 'rgba(255,184,0,.15)'}`,
              }}
                onClick={() => navigate('/app/stock')}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}
              >
                <Package size={13} style={{ color: red ? 'var(--danger)' : 'var(--warn)', flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: red ? 'var(--danger)' : 'var(--warn)' }}>
                  {a.stockQty}<span style={{ color: 'var(--text4)', fontWeight: 400 }}>/{a.stockMin}</span>
                </span>
              </div>
            )})}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{t('recent_activity')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛍️</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  {lang === 'en' ? 'No activity yet' : lang === 'es' ? 'Sin actividad por ahora' : lang === 'it' ? 'Nessuna attività per ora' : 'Aucune activité pour le moment'}
                </div>
                <div style={{ fontSize: 12 }}>{emptyHint}</div>
              </div>
            ) : recentActivity.map((a, i) => {
              const mins = Math.max(0, Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60000))
              const ago = mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}j`
              return (
              <div key={a.id ?? i} style={{
                display: 'flex', gap: 11, alignItems: 'flex-start', padding: '9px 3px',
                borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background .12s', cursor: 'default', borderRadius: 8,
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.025)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(0,208,132,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D084' }}>
                  <ActivityIcon type="sale" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lang === 'en' ? 'Sale' : lang === 'es' ? 'Venta' : lang === 'it' ? 'Vendita' : 'Vente'} #{String(a.id ?? '').slice(-6).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
                    {fmt(a.total ?? 0)} · {a.paymentMode} · {ago}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* Top products with progress bars */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{t('top_products')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topProducts.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>
                {lang === 'en' ? 'No sales recorded yet' : lang === 'es' ? 'Ninguna venta registrada' : lang === 'it' ? 'Nessuna vendita registrata' : 'Aucune vente enregistrée pour le moment'}
              </div>
            ) : topProducts.map((p, i) => {
              const maxCa = topProducts[0]?.ca || 1
              const pct = Math.round(((p.ca ?? 0) / maxCa) * 100)
              const color = RANK_COLORS[i] ?? RANK_COLORS[RANK_COLORS.length - 1]
              return (
              <div key={(p.name ?? '') + i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: `${color}22`, border: `1px solid ${color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, color,
                  }}>{i + 1}</div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color }}>{fmt(p.ca ?? 0)}</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .4s var(--ease)' }} />
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}
