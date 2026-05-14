import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Package, Users, DollarSign } from 'lucide-react'

const WEEK_BARS = [
  { label: 'Lun', h: 55, val: '520K' }, { label: 'Mar', h: 72, val: '680K' },
  { label: 'Mer', h: 45, val: '430K' }, { label: 'Jeu', h: 83, val: '790K' },
  { label: 'Ven', h: 97, val: '920K' }, { label: 'Sam', h: 100, val: '1.1M' },
  { label: 'Auj', h: 88, val: '842K', highlight: true },
]

const ACTIVITY = [
  { type: 'sale',  icon: '💳', label: 'Vente #2041',      sub: '45 000 F CFA · Il y a 3 min · Caisse 1',   color: 'rgba(16,185,129,0.15)' },
  { type: 'stock', icon: '📦', label: 'Réception stock',  sub: 'Fournisseur Diallo · Il y a 18 min',        color: 'rgba(245,158,11,0.15)' },
  { type: 'hr',    icon: '🧑‍💼', label: 'Pointage Marie K.', sub: 'Arrivée 08:02 · Il y a 35 min',          color: 'rgba(139,92,246,0.15)' },
  { type: 'alert', icon: '⚠️', label: 'Alerte rupture',  sub: 'Sucre 50kg · Il y a 1h · Auto',             color: 'rgba(239,68,68,0.15)'  },
  { type: 'sale',  icon: '💳', label: 'Vente #2040',      sub: '128 000 F CFA · Il y a 1h 12 · Caisse 2',  color: 'rgba(16,185,129,0.15)' },
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
          { icon: '📥', label: 'Réception stock',  path: '/app/stock',   color: 'rgba(20,184,166,0.12)'  },
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
          { label: t('kpi_sales_today'),     value: fmt(842000),  sub: '▲ 12% vs hier',              up: true,  icon: <DollarSign size={18} /> },
          { label: t('kpi_stock'),           value: '3 248',                            sub: '▼ 8 alertes rupture',        up: false, icon: <Package size={18} />    },
          { label: t('kpi_employees'),       value: '18/21',                            sub: '3 absents aujourd\'hui',     up: null,  icon: <Users size={18} />      },
          { label: t('kpi_monthly_revenue'), value: fmt(2650000), sub: '▲ 7% vs mois dernier',       up: true,  icon: <TrendingUp size={18} /> },
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
            <span className="panel-title">📈 Ventes — 7 derniers jours</span>
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
              <thead><tr><th>Produit</th><th>Stock</th><th>Statut</th></tr></thead>
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
            {ACTIVITY.map((a, i) => (
              <div key={i} className="act-item">
                <div className="act-ic" style={{ background: a.color }}>{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{a.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>{a.sub}</div>
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
              <thead><tr><th>#</th><th>Produit</th><th>Qté</th><th>CA</th></tr></thead>
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
