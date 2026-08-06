import { useState, useEffect, lazy, Suspense } from 'react'
import { useConfig, useFormatAmount, useAbbrevAmount, t } from '@/stores/appStore'
import { useAuthStore, canAccess } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Package, Users, DollarSign, ShoppingCart,
  ShoppingBag, Download, Plus, AlertTriangle, CreditCard, Clock,
  BarChart2, Activity, Target, Zap, PackageX,
} from 'lucide-react'
import { dashboardApi, reportsApi } from '@/lib/api'
import toast from 'react-hot-toast'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import Skeleton from '@/components/ui/skeleton'
import { normCat } from '@/utils/normCat'
import { payModeLabel } from '@/components/pos/posShared'
import ConsolidatedShops from '@/components/dashboard/ConsolidatedShops'
import {
  noSalesInPeriodLabel, noSalesThisMonthLabel, salesChartTitle, periodOptionLabel,
  isChartPeriod, buildSalesSeries, salesPointLabel, pickAxisTicks, CHART_PERIODS, type ChartPeriod,
} from '@/components/dashboard/dashboardShared'
// Charts isolés dans le chunk `charts` (recharts) → lazy pour ne pas bloquer le rendu des KPIs
const DashSalesArea = lazy(() => import('@/components/charts/DashSalesArea'))
const DashCategoryDonut = lazy(() => import('@/components/charts/DashCategoryDonut'))

const DONUT_COLORS = ['#6C47FF', '#00D084', '#FF9500', '#00B8FF', '#FF3B5C', '#FFB800']


function ActivityIcon({ type }: { type: 'sale' | 'stock' | 'hr' | 'alert' }) {
  if (type === 'sale')  return <CreditCard size={15} />
  if (type === 'stock') return <Package size={15} />
  if (type === 'hr')    return <Clock size={15} />
  return <AlertTriangle size={15} />
}

const RANK_COLORS = ['#6C47FF', '#00D084', '#FF9500', '#8888A8', '#8888A8']

// Label du donut : utilise les MÊMES pourcentages que la légende (catPcts, somme garantie
// = 100 %), repérés par `index`, plutôt que le `percent` brut de recharts → aucun décalage
// possible donut/légende (ex. dernier slice corrigé, cas sub-5 %). Les slices < 5 % restent
// masqués sur le donut (lisibilité) ; la légende, elle, les liste toujours.
const makeDonutLabel = (pcts: number[]) => ({ cx, cy, midAngle, innerRadius, outerRadius, index }: any) => {
  const pct = pcts[index]
  if (!pct || pct < 5) return null   // undefined / 0 / < 5 % → pas de label (jamais « 0% »)
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', pointerEvents: 'none' }}>
      {`${pct}%`}
    </text>
  )
}

const CatTooltip = ({ active, payload }: any) => {
  const fmt = useFormatAmount()
  if (!active || !payload?.length) return null
  const p = payload[0]
  // % = catPcts embarqué dans la ligne de données (`pct`) → SOURCE UNIQUE partagée avec la
  // légende et le label du donut. NE PAS recalculer (value/total ou p.percent recharts)
  // sinon le dernier slice (corrigé à 100−Σ) divergerait entre tooltip et légende.
  const pct = Number(p.payload?.pct ?? 0)
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
        <span style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{p.name}</span>
      </div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
        {fmt(p.value)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }}/>
        </div>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color, fontFamily: 'var(--mono)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  const fmt = useFormatAmount()
  if (!active || !payload?.length) return null
  // ⚠️ L'axe X porte `ts` (timestamp) depuis le passage en axe temporel : `label` est donc un
  // NOMBRE brut. Le libellé lisible voyage avec le point (`name`), on le préfère.
  const heading = payload[0]?.payload?.name ?? label
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border2)',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,.8)',
      fontFamily: 'var(--font)',
      minWidth: 140,
    }}>
      {heading && (
        <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          {heading}
        </div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i > 0 ? 4 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color ?? p.fill ?? 'var(--p)', flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)', fontWeight: 'var(--fw-regular)' }}>{p.name ?? p.dataKey}</span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>
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
    salesTodayTrend: null as number | null,
    salesMonthTrend: null as number | null,
  })
  // Chargement des KPIs → skeletons (évite le flash 0 → valeur + réserve l'espace).
  const [kpiLoading, setKpiLoading] = useState(true)
  const [salesChart, setSalesChart] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [stockAlerts, setStockAlerts] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [catData, setCatData] = useState<any[]>([])
  // Typé `ChartPeriod` (pas `string`) : le message de vide se résout par un Record exhaustif,
  // donc une période sans libellé ne peut pas exister sans casser `tsc`.
  const [reportPeriod, setReportPeriod] = useState<ChartPeriod>('7days')
  // Résumé actionnable (réappro / dormants) — non bloquant, renvoie vers Rapports.
  const [inv, setInv] = useState<{ reorder: number; dormant: number } | null>(null)
  useEffect(() => {
    reportsApi.inventory()
      .then(d => setInv({ reorder: d.reorder.length, dormant: d.dormant.length }))
      // Échec silencieux ASSUMÉ : `inv` reste à `null` et les deux tuiles ne s'affichent
      // simplement pas. Elles ne retombent sur AUCUNE valeur — un tableau de bord qui
      // afficherait « 0 à réapprovisionner » sur une requête en échec mentirait.
      .catch(() => {})
  }, [])
  const catTotal = catData.reduce((s, d) => s + (d.value ?? 0), 0)
  // % par catégorie : diviseur = CA total toutes catégories (y compris « Autre ») ;
  // arrondi Math.round puis correction du dernier slice → somme garantie = 100 %.
  const catPcts = (() => {
    if (catTotal <= 0) return catData.map(() => 0)
    const rounded = catData.map(d => Math.round(((d.value ?? 0) / catTotal) * 100))
    if (rounded.length) {
      const sumOthers = rounded.slice(0, -1).reduce((s, p) => s + p, 0)
      rounded[rounded.length - 1] = 100 - sumOthers
    }
    return rounded
  })()

  useEffect(() => {
    dashboardApi.stats()
      .then((data) => {
        if (data) setStats({
          salesToday:        data.salesToday        ?? stats.salesToday,
          transactionsToday: data.transactionsToday ?? stats.transactionsToday,
          salesMonth:        data.salesMonth        ?? stats.salesMonth,
          totalProducts:     data.totalProducts     ?? stats.totalProducts,
          lowStockProducts:  data.lowStockProducts  ?? stats.lowStockProducts,
          activeEmployees:   data.activeEmployees   ?? stats.activeEmployees,
          pendingOrders:     data.pendingOrders     ?? stats.pendingOrders,
          salesTodayTrend:   data.salesTodayTrend ?? null,
          salesMonthTrend:   data.salesMonthTrend ?? null,
        })
        setTopProducts(data?.topProducts ?? [])
        setStockAlerts(data?.stockAlerts ?? [])
        setRecentActivity(data?.recentActivity ?? [])
        // Fusionne les variantes d'une même catégorie (« Épicerie » / « épicerie » /
        // « 🍚 Épicerie ») : clé normalisée = emoji retirés + trim()+toLowerCase(), valeurs
        // additionnées, on garde le nom d'origine du PREMIER match (et son ordre d'apparition).
        const mergedCats: any[] = []
        const catIndex = new Map<string, number>()
        for (const c of (data?.categoryBreakdown ?? [])) {
          const key = normCat(String(c?.name ?? ''))
          const value = Number(c?.value ?? 0)
          const at = catIndex.get(key)
          if (at !== undefined) {
            mergedCats[at].value += value
          } else {
            catIndex.set(key, mergedCats.length)
            mergedCats.push({ ...c, value })
          }
        }
        setCatData(mergedCats.map((c, i) => ({ ...c, color: DONUT_COLORS[i % DONUT_COLORS.length] })))
        // Nouvel ADMIN sans produits ni ventes, non encore onboardé → wizard
        if (
          data.totalProducts === 0 && data.transactionsToday === 0 && data.salesMonth === 0 &&
          user?.role === 'ADMIN' && !localStorage.getItem('habashop_onboarded')
        ) {
          navigate('/onboarding')
        }
      })
      .catch(() => toast.error(lang === 'en' ? 'Data unavailable — please retry' : lang === 'es' ? 'Datos no disponibles — reintenta' : lang === 'it' ? 'Dati non disponibili — riprova' : 'Données indisponibles — réessayer'))
      .finally(() => setKpiLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    dashboardApi.sales(reportPeriod)
      .then((data) => {
        if (data?.sales?.length > 0) {
          // ⚠️ Série TEMPORELLE (un point par date, trié), pas un histogramme par jour de
          // semaine — cf. `buildSalesSeries` dans `dashboardShared` pour le bug d'origine.
          setSalesChart(buildSalesSeries(data.sales, reportPeriod, lang))
        } else {
          setSalesChart([])
        }
      })
      .catch(() => setSalesChart([]))
  }, [reportPeriod, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const dateStr = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', {
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
            fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)', letterSpacing: '-.4px',
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

      {/* Vue globale multi-boutiques (affichée seulement si > 1 boutique) */}
      <ConsolidatedShops />

      {isNewTenant && (
        <div style={{
          background: 'linear-gradient(135deg,rgba(108,71,255,.12),rgba(0,208,132,.08))',
          border: '1px solid rgba(108,71,255,.25)',
          borderRadius: 16, padding: '20px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>🎉</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 4 }}>
              {(() => {
                const prenom = user?.name?.split(' ')[0] ?? ''
                return lang === 'en' ? `Welcome to HabaShop, ${prenom}!`
                     : lang === 'es' ? `Bienvenido a HabaShop, ${prenom}!`
                     : lang === 'it' ? `Benvenuto su HabaShop, ${prenom}!`
                     : `Bienvenue sur HabaShop, ${prenom} !`
              })()}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', lineHeight: 1.6 }}>
              {lang === 'en' ? 'Your shop is ready. Start by adding products then open the register.' : lang === 'es' ? 'Su tienda está lista. Comience agregando sus productos y luego abra la caja.' : lang === 'it' ? 'Il tuo negozio è pronto. Inizia aggiungendo i prodotti poi apri la cassa.' : 'Votre boutique est prête. Commencez par ajouter vos produits puis ouvrez la caisse.'}
            </div>
          </div>
          <button onClick={() => navigate('/app/stock')} className="btn-primary" style={{ flexShrink: 0, fontSize: 'var(--fs-sm)' }}>
            {lang === 'en' ? '+ Add products' : lang === 'es' ? '+ Agregar productos' : lang === 'it' ? '+ Aggiungi prodotti' : '+ Ajouter des produits'}
          </button>
        </div>
      )}

      {/* Résumé actionnable → Rapports (onglet stock) */}
      {inv && (inv.reorder > 0 || inv.dormant > 0) && (
        <button
          onClick={() => navigate('/app/reports')}
          style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%', marginBottom: 14,
            background: 'var(--grad-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
            padding: '12px 16px', cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
          }}
        >
          {inv.reorder > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-sm)', color: 'var(--text2)' }}>
              <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
              <strong style={{ color: 'var(--text)' }}>{inv.reorder}</strong>
              {lang === 'en' ? 'to reorder' : lang === 'es' ? 'para reabastecer' : lang === 'it' ? 'da riordinare' : 'à réapprovisionner'}
            </span>
          )}
          {inv.reorder > 0 && inv.dormant > 0 && <span style={{ color: 'var(--border2)' }}>·</span>}
          {inv.dormant > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-sm)', color: 'var(--text2)' }}>
              <PackageX size={15} style={{ color: 'var(--warn)' }} />
              <strong style={{ color: 'var(--text)' }}>{inv.dormant}</strong>
              {lang === 'en' ? 'dormant' : lang === 'es' ? 'inactivos' : lang === 'it' ? 'dormienti' : 'dormants'}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: 'var(--p3)' }}>
            {lang === 'en' ? 'View report →' : lang === 'es' ? 'Ver informe →' : lang === 'it' ? 'Vedi report →' : 'Voir le rapport →'}
          </span>
        </button>
      )}

      {/* KPI cards */}
      <ResponsiveGrid min={180} gap={12}>
        {kpiLoading ? (
          [0, 1, 2, 3].map(i => (
            <div key={i} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 14 }} />
              <div className="skeleton" style={{ width: '55%', height: 11, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '72%', height: i === 0 ? 28 : 22, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '40%', height: 11 }} />
            </div>
          ))
        ) : ([
          { label: t('kpi_sales_today'),     value: fmt(stats.salesToday),         sub: `${stats.transactionsToday} ${lang === 'en' ? 'transactions' : lang === 'es' ? 'transacciones' : lang === 'it' ? 'transazioni' : 'transactions'}`,  trend: stats.salesTodayTrend, Icon: DollarSign, color: 'var(--p2)',   hero: true  },
          { label: t('kpi_stock'),           value: String(stats.totalProducts),   sub: `${stats.lowStockProducts} ${lang === 'en' ? 'stock alerts' : lang === 'es' ? 'alertas stock' : lang === 'it' ? 'avvisi stock' : 'alertes stock'}`,   trend: null,                  Icon: Package,    color: 'var(--acc)',  hero: false },
          { label: t('kpi_employees'),       value: String(stats.activeEmployees), sub: `${stats.pendingOrders} ${lang === 'en' ? 'pending orders' : lang === 'es' ? 'ped. pendientes' : lang === 'it' ? 'ord. in attesa' : 'cmd. en attente'}`,   trend: null,                  Icon: Users,      color: 'var(--acc2)', hero: false },
          { label: t('kpi_monthly_revenue'), value: fmt(stats.salesMonth),         sub: lang === 'en' ? 'vs last month' : lang === 'es' ? 'vs mes pasado' : lang === 'it' ? 'vs mese scorso' : 'vs mois dernier',                           trend: stats.salesMonthTrend, Icon: TrendingUp, color: 'var(--acc3)', hero: false },
        ].map((k, idx) => {
          const up = k.trend != null && k.trend > 0
          const down = k.trend != null && k.trend < 0
          return (
            <div key={k.label} className="kpi-card kpi-animate" style={{
              background: 'var(--bg2)',
              border: k.hero ? '1px solid var(--border3)' : '1px solid var(--border2)',
              borderRadius: 12, padding: 16,
              position: 'relative', overflow: 'hidden',
              transition: 'all .15s ease',
              animationDelay: `${idx * 60}ms`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'var(--bg3)', color: k.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)',
                }}>
                  <k.Icon size={19} />
                </div>
                {/* Badge tendance RÉELLE (null → pas de badge ; couleurs theme-aware AA) */}
                {k.trend != null && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '3px 9px', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)',
                    background: up ? 'var(--c-green-bg)' : down ? 'var(--c-red-bg)' : 'var(--bg4)',
                    color: up ? 'var(--acc2)' : down ? 'var(--danger)' : 'var(--text3)',
                    border: `1px solid ${up ? 'var(--c-green-border)' : down ? 'var(--c-red-border)' : 'var(--border)'}`,
                  }}>
                    {up ? <TrendingUp size={9} /> : down ? <TrendingDown size={9} /> : null}
                    {k.trend > 0 ? '+' : ''}{k.trend}%
                  </span>
                )}
              </div>
              <div className="kpi-label">{k.label}</div>
              {/* Valeur 24px mono (langage visuel commun POS/Stock) */}
              <div className="kpi-value" style={{ color: k.color, fontSize: 'var(--fs-display)', fontWeight: 'var(--fw-bold)' }}>{k.value}</div>
              <div className="kpi-sub" style={{ marginTop: 4 }}>{k.sub}</div>
            </div>
          )
        }))}
      </ResponsiveGrid>

      {/* Quick actions 2×4 grid */}
      <ResponsiveGrid min={100} gap={8}>
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} type="button"
            onClick={() => navigate(a.path)}
            aria-label={a.label}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12,
              padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
              fontFamily: 'var(--font)',
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border3)'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = 'var(--sh-sm)' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.transform = ''; el.style.boxShadow = '' }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: a.color, color: a.ic, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${a.ic}22` }}>
              <a.Icon size={17} />
            </div>
            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', lineHeight: 1.2, textAlign: 'center' }}>{a.label}</span>
          </button>
        ))}
      </ResponsiveGrid>

      {/* Charts row */}
      <div className="dashboard-charts-grid" style={{ display: 'grid', gap: 12 }}>
        {/* Bar chart — il occupe la colonne large parce que `.dashboard-charts-grid` vaut
            `2fr 1fr` au-delà de 1100px (`index.css:706-708`) et qu'il en est le 1ᵉʳ enfant.
            ⚠️ Une classe `dashboard-chart-wide` accompagnait ce commentaire : elle n'existait
            dans aucune feuille, donc elle n'a jamais rien élargi. Retirée — le mécanisme réel
            est cité ci-dessus, vérifiable en dix secondes. */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(108,71,255,.15)', border: '1px solid rgba(108,71,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p3)' }}>
                <BarChart2 size={15} />
              </div>
              {/* ⚠️ Le titre SUIT la période : figé sur « 7 derniers jours », il contredisait
                  l'état vide dès qu'on passait à 30 jours ou 3 mois. */}
              <span className="panel-title">{salesChartTitle(reportPeriod, lang)}</span>
            </div>
            {/* Options RENDUES depuis `CHART_PERIODS` : le sélecteur ne peut pas offrir une
                période dont les libellés n'existent pas (ce qu'un `as ChartPeriod` autorisait). */}
            <select className="input" style={{ width: 'auto', fontSize: 'var(--fs-label)', minHeight: 34 }}
              value={reportPeriod} onChange={e => { if (isChartPeriod(e.target.value)) setReportPeriod(e.target.value) }}>
              {CHART_PERIODS.map(p => <option key={p} value={p}>{periodOptionLabel(p, lang)}</option>)}
            </select>
          </div>
          <div role="img" aria-label={lang === 'fr' ? 'Graphique des ventes par jour' : lang === 'en' ? 'Daily sales chart' : lang === 'es' ? 'Gráfico de ventas diarias' : 'Grafico vendite giornaliere'}>
          {salesChart.length === 0 ? (
            <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 'var(--fs-sm)', textAlign: 'center', padding: '0 16px' }}>
              {/* ⚠️ Le message nomme la FENÊTRE, il ne dit pas « jamais » — cf. `dashboardShared`. */}
              {noSalesInPeriodLabel(reportPeriod, lang)}
            </div>
          ) : (
          <Suspense fallback={<Skeleton height={190} count={1} radius={12} />}>
            <DashSalesArea data={salesChart} abbr={abbr} tooltip={<CustomTooltip />}
              ticks={pickAxisTicks(salesChart)}
              tickFormatter={(ts: number) => salesPointLabel(new Date(ts), reportPeriod, lang)} />
          </Suspense>
          )}
          </div>
        </div>

        {/* Donut chart */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{lang === 'en' ? 'Revenue by category' : lang === 'es' ? 'Ingresos por categoría' : lang === 'it' ? 'Ricavi per categoria' : 'CA par catégorie'}</span>
          </div>
          {catData.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
              {/* ⚠️ `categoryBreakdown` est scopé au MOIS EN COURS côté serveur — cf. `dashboardShared`. */}
              {noSalesThisMonthLabel(lang)}
            </div>
          ) : (<>
          <div style={{ position: 'relative', margin: '0 -8px', overflow: 'visible' }}>
            <Suspense fallback={<Skeleton height={220} count={1} radius={12} />}>
              <DashCategoryDonut data={catData.map((d, i) => ({ ...d, pct: catPcts[i] }))} colors={DONUT_COLORS} label={makeDonutLabel(catPcts)} tooltip={<CatTooltip />} />
            </Suspense>
            <div style={{
              position: 'absolute', top: 110, left: '50%',
              transform: 'translate(-50%,-50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 2 }}>Total CA</div>
              <div style={{ fontSize: 17, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>
                {abbr(catTotal)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6, padding: '0 4px' }}>
            {catData.map((d, i) => {
              const pct = catPcts[i]
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-caption)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--text2)' }}>{d.name}</span>
                  <div style={{ width: 48, height: 4, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: DONUT_COLORS[i % DONUT_COLORS.length], borderRadius: 99 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-semibold)', color: DONUT_COLORS[i % DONUT_COLORS.length], minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
          </>)}
        </div>
      </div>

      {/* Stock alerts + Activity + Top products */}
      <div className="dash-bottom-grid">

        {/* Stock alerts — poids visuel dominant quand il y a des ruptures */}
        <div className="panel" style={{
          marginBottom: 0,
          ...(stockAlerts.length > 0 ? {
            borderColor: 'var(--danger)',
            boxShadow: '0 0 0 1px var(--danger), 0 8px 28px rgba(255,59,92,.18)',
          } : {}),
        }}>
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
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--acc2)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-regular)' }}>
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
                <div style={{ flex: 1, fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-regular)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: red ? 'var(--danger)' : 'var(--warn)' }}>
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
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-regular)', color: 'var(--text2)', marginBottom: 6 }}>
                  {lang === 'en' ? 'No activity yet' : lang === 'es' ? 'Sin actividad por ahora' : lang === 'it' ? 'Nessuna attività per ora' : 'Aucune activité pour le moment'}
                </div>
                <div style={{ fontSize: 'var(--fs-label)' }}>{emptyHint}</div>
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
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Avatar rond 28px (langage avatars) — pas de nom client dans recentActivity → icône vente */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--p), var(--p2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <ActivityIcon type="sale" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lang === 'en' ? 'Sale' : lang === 'es' ? 'Venta' : lang === 'it' ? 'Vendita' : 'Vente'} #{String(a.id ?? '').slice(-6).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', lineHeight: 1.4 }}>
                    {fmt(a.total ?? 0)} · {payModeLabel(a.paymentMode, lang)} · {ago}
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
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>
                {/* ⚠️ « Top produits DU MOIS » : le vide est celui du MOIS EN COURS — cf. `dashboardShared`. */}
                {noSalesThisMonthLabel(lang)}
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
                    fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color,
                  }}>{i + 1}</div>
                  <span style={{ flex: 1, fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-regular)', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color }}>{fmt(p.ca ?? 0)}</span>
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
