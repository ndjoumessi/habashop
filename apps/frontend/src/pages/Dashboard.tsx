import { useState, useEffect } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Package, Users, DollarSign } from 'lucide-react'
import { dashboardApi } from '@/lib/api'

const WEEK_BARS = [
  { label: 'Lun', h: 55, val: '520K' }, { label: 'Mar', h: 72, val: '680K' },
  { label: 'Mer', h: 45, val: '430K' }, { label: 'Jeu', h: 83, val: '790K' },
  { label: 'Ven', h: 97, val: '920K' }, { label: 'Sam', h: 100, val: '1.1M' },
  { label: 'Auj', h: 88, val: '842K', highlight: true },
]

type Lang = 'fr' | 'en' | 'es' | 'it'
type LangMap = Record<Lang, string>
const RECENT_ACTIVITY: Array<{
  type: string; icon: string; color: string
  title: LangMap
  getDesc: (fmt: (n: number) => string, lang: string) => string
}> = [
  { type:'sale',  icon:'💳', color:'rgba(16,185,129,0.15)',
    title: { fr:'Vente #2041',       en:'Sale #2041',          es:'Venta #2041',       it:'Vendita #2041'    },
    getDesc: (f, l) => ({ fr:`${f(45000)} · Il y a 3 min · Caisse 1`, en:`${f(45000)} · 3 min ago · Till 1`, es:`${f(45000)} · Hace 3 min · Caja 1`, it:`${f(45000)} · 3 min fa · Cassa 1` })[l as Lang] ?? `${f(45000)} · Il y a 3 min · Caisse 1`,
  },
  { type:'stock', icon:'📦', color:'rgba(245,158,11,0.15)',
    title: { fr:'Réception stock',   en:'Stock receipt',       es:'Recepción stock',   it:'Ricezione stock'  },
    getDesc: (_f, l) => ({ fr:'Fournisseur Diallo · Il y a 18 min', en:'Supplier Diallo · 18 min ago', es:'Proveedor Diallo · Hace 18 min', it:'Fornitore Diallo · 18 min fa' })[l as Lang] ?? 'Fournisseur Diallo · Il y a 18 min',
  },
  { type:'hr',    icon:'🧑‍💼', color:'rgba(139,92,246,0.15)',
    title: { fr:'Pointage Marie K.', en:'Clock-in Marie K.',   es:'Fichaje Marie K.',  it:'Timbratura Marie K.' },
    getDesc: (_f, l) => ({ fr:'Arrivée 08:02 · Il y a 35 min', en:'Arrived 08:02 · 35 min ago', es:'Llegada 08:02 · Hace 35 min', it:'Arrivo 08:02 · 35 min fa' })[l as Lang] ?? 'Arrivée 08:02 · Il y a 35 min',
  },
  { type:'alert', icon:'⚠️', color:'rgba(239,68,68,0.15)',
    title: { fr:'Alerte rupture',    en:'Out-of-stock alert',  es:'Alerta rotura',     it:'Allarme esaurimento' },
    getDesc: (_f, l) => ({ fr:'Sucre 50kg · Il y a 1h · Auto', en:'Sugar 50kg · 1h ago · Auto', es:'Azúcar 50kg · Hace 1h · Auto', it:'Zucchero 50kg · 1h fa · Auto' })[l as Lang] ?? 'Sucre 50kg · Il y a 1h · Auto',
  },
  { type:'sale',  icon:'💳', color:'rgba(16,185,129,0.15)',
    title: { fr:'Vente #2040',       en:'Sale #2040',          es:'Venta #2040',       it:'Vendita #2040'    },
    getDesc: (f, l) => ({ fr:`${f(128000)} · Il y a 1h 12 · Caisse 2`, en:`${f(128000)} · 1h 12 ago · Till 2`, es:`${f(128000)} · Hace 1h 12 · Caja 2`, it:`${f(128000)} · 1h 12 fa · Cassa 2` })[l as Lang] ?? `${f(128000)} · Il y a 1h 12 · Caisse 2`,
  },
]

const TOP_PRODUCTS = [
  { rank: '🥇', name: 'Riz parfumé 5kg',  qty: 842, ca: 2100000 },
  { rank: '🥈', name: 'Huile palme 1L',   qty: 612, ca: 1500000 },
  { rank: '🥉', name: 'Farine blé 25kg',  qty: 430, ca:  980000 },
  { rank: '4',  name: 'Sucre 50kg',        qty: 318, ca:  720000 },
  { rank: '5',  name: 'Savon 500g',         qty: 290, ca:  580000 },
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

  useEffect(() => {
    dashboardApi.stats()
      .then(data => setStats(data))
      .catch(() => {
        // Garde les données statiques si API non disponible
      })
  }, [])

  const dateStr = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
          {t('hello')}, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
          {t('today')} — {dateStr}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: '🛒', label: t('nav_pos'),       path: '/app/pos',     color: 'rgba(99,102,241,0.12)'  },
          { icon: '📥', label: t('dash_receive_stock'), path: '/app/stock',   color: 'rgba(20,184,166,0.12)'  },
          { icon: '➕', label: t('btn_add'),        path: '/app/stock',   color: 'rgba(245,158,11,0.12)'  },
          { icon: '📤', label: t('btn_export'),     path: '/app/reports', color: 'rgba(139,92,246,0.12)'  },
        ].map(a => (
          <div key={a.label} className="qa-card" onClick={() => navigate(a.path)}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: a.color }}>{a.icon}</div>
            <span className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>{a.label}</span>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('kpi_sales_today'),     value: fmt(stats.salesToday),  sub: `${stats.transactionsToday} transactions`,      up: true,  icon: <DollarSign size={18} /> },
          { label: t('kpi_stock'),           value: String(stats.totalProducts), sub: `▼ ${stats.lowStockProducts} alertes rupture`, up: false, icon: <Package size={18} />    },
          { label: t('kpi_employees'),       value: String(stats.activeEmployees), sub: `${stats.pendingOrders} commandes en attente`, up: null, icon: <Users size={18} />      },
          { label: t('kpi_monthly_revenue'), value: fmt(stats.salesMonth), sub: `▲ 7 % ${t('dash_vs_last_month')}`,                  up: true,  icon: <TrendingUp size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: 'var(--p2)' }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className={k.up === true ? 'trend-up' : k.up === false ? 'trend-down' : 'kpi-sub'}>
              {k.up === true  && <TrendingUp   size={11} />}
              {k.up === false && <TrendingDown  size={11} />}
              <span>{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="panel lg:col-span-2">
          <div className="panel-head">
            <span className="panel-title">📈 {t('dash_sales_chart')}</span>
            <span className="badge badge-teal">Cette semaine</span>
          </div>
          <div className="flex items-end gap-2" style={{ height: 140 }}>
            {WEEK_BARS.map(b => (
              <div key={b.label} className="bar-group">
                <div
                  className="bar w-full"
                  style={{
                    height: `${b.h}%`,
                    background: b.highlight
                      ? 'linear-gradient(to top, var(--acc), #FCD34D)'
                      : 'linear-gradient(to top, var(--p), var(--acc2))',
                  }}
                  title={b.val}
                />
                <div className="bar-label">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">🔴 {t('stock_alerts')}</span>
            <span className="badge badge-red">{ALERTS.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('col_product')}</th><th>{t('col_stock')}</th><th>{t('col_status')}</th></tr></thead>
              <tbody>
                {ALERTS.map(a => (
                  <tr key={a.name}>
                    <td className="td-bold text-xs">{a.name}</td>
                    <td className="td-num text-xs">{a.stock}<span className="text-xs" style={{ color: 'var(--text3)' }}>/{a.threshold}</span></td>
                    <td><span className={`badge ${a.status}`}>{a.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activity + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">⚡ {t('recent_activity')}</span>
          </div>
          <div className="space-y-1">
            {RECENT_ACTIVITY.map((a, i) => (
              <div key={i} className="act-item">
                <div className="act-ic" style={{ background: a.color }}>{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {a.title[lang as Lang] ?? a.title.fr}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>
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
            <span className="panel-title">🏆 {t('top_products')}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>{t('col_product')}</th><th>{t('col_qty')}</th><th>{t('col_revenue')}</th></tr></thead>
              <tbody>
                {TOP_PRODUCTS.map(p => (
                  <tr key={p.name}>
                    <td>{p.rank}</td>
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
