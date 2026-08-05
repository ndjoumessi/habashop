import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import Skeleton from '@/components/ui/skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Tabs from '@/components/ui/TabBar'
import { useConfig, useFormatAmount, useAbbrevAmount, t } from '@/stores/appStore'
import { Download, TrendingUp, TrendingDown, DollarSign, Receipt, ShoppingCart, CreditCard, Trophy, Package, Users, Wallet, UserCog, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs } from '@/utils/export'
import { writeXlsx } from '@/utils/xlsxWriter'
import { buildReportSheets } from '@/components/reports/reportsExport'
import { salesApi, expensesApi, productsApi, employeesApi } from '@/lib/api'

// ReportsTabs porte les graphes recharts (chunk `charts`) → lazy pour alléger le shell Reports
const ReportsTabs = lazy(() => import('@/components/reports/ReportsTabs'))
import { type Period, Trend } from '@/components/reports/reportsShared'

const WEEK_ABBR: Record<string, string[]> = {
  fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
  en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
  it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
}

export default function Reports() {
  const { lang, currency } = useConfig()
  void lang
  const fmt = useFormatAmount()
  const abbr = useAbbrevAmount()
  const navigate = useNavigate()

  const [activePayIndex, setActivePayIndex] = useState<number | null>(null)
  const [salesData,      setSalesData]      = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    salesApi.list()
      .then((d) => { if (d?.length) setSalesData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {}
    const totals: Record<string, number> = {}
    salesData.forEach((sale: any) => {
      const mode = sale.paymentMode ?? 'cash'
      counts[mode] = (counts[mode] ?? 0) + 1
      totals[mode] = (totals[mode] ?? 0) + (sale.total ?? 0)
    })
    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    if (total === 0) return [
      { name: lang === 'en' ? 'Cash' : lang === 'es' ? 'Efectivo' : lang === 'it' ? 'Contanti' : 'Espèces', value: 62, amount: 0, color: '#00D084' },
      { name: 'Mobile',                             value: 22, amount: 0, color: '#8B6FFF' },
      { name: 'Wave',                               value: 16, amount: 0, color: '#00B8FF' },
      { name: 'Orange Money',                       value:  8, amount: 0, color: '#FF3B5C' },
      { name: lang === 'en' ? 'Card' : lang === 'es' ? 'Tarjeta' : lang === 'it' ? 'Carta' : 'Carte',    value:  5, amount: 0, color: '#FF9500' },
    ]
    return [
      { name: lang === 'en' ? 'Cash' : lang === 'es' ? 'Efectivo' : lang === 'it' ? 'Contanti' : 'Espèces', value: Math.round(((counts.cash   ?? 0) / total) * 100), amount: totals.cash   ?? 0, color: '#00D084' },
      { name: 'Mobile',                            value: Math.round(((counts.mobile ?? 0) / total) * 100), amount: totals.mobile ?? 0, color: '#8B6FFF' },
      { name: 'Wave',                              value: Math.round(((counts.wave   ?? 0) / total) * 100), amount: totals.wave   ?? 0, color: '#00B8FF' },
      { name: 'Orange Money',                      value: Math.round(((counts.orange ?? 0) / total) * 100), amount: totals.orange ?? 0, color: '#FF3B5C' },
      { name: lang === 'en' ? 'Card' : lang === 'es' ? 'Tarjeta' : lang === 'it' ? 'Carta' : 'Carte',   value: Math.round(((counts.card   ?? 0) / total) * 100), amount: totals.card   ?? 0, color: '#FF9500' },
    ].filter(d => d.value > 0)
  }, [salesData, lang])

  const [period,     setPeriod]     = useState<Period>('30days')
  const [reportTab,  setReportTab]  = useState<'ventes' | 'stock' | 'clients' | 'finance' | 'rh'>('ventes')
  // Plage de dates personnalisée ("YYYY-MM-DD") : si from+to renseignés, elle PRIME sur les presets.
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  // Filtres additionnels (locaux) : catégorie produit (Ventes/Stock) + employé (Paie).
  const [filterCat,  setFilterCat]  = useState('')
  const i = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  // Dropdown « Exporter » : état ouvert/fermé + fermeture au clic extérieur.
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e: MouseEvent) => { if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [exportOpen])
  const menuItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: 8,
    cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-regular)', color: 'var(--text)', fontFamily: 'inherit',
  }
  const itemHover = (on: boolean) => (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).style.background = on ? 'var(--bg3)' : 'transparent'
  }

  // Catégories présentes dans les ventes chargées (dropdown filtre catégorie).
  const categories = useMemo(() => {
    const set = new Set<string>()
    salesData.forEach((s: any) => (s.items ?? []).forEach((it: any) => { const c = it.product?.category; if (c) set.add(c) }))
    return [...set].sort()
  }, [salesData])

  // Plage active (ms) : personnalisée si from+to, sinon dérivée du preset.
  const range = useMemo(() => {
    const now = Date.now(); const DAY = 86400000
    if (customFrom && customTo) {
      const from = new Date(`${customFrom}T00:00:00`).getTime()
      const to   = new Date(`${customTo}T23:59:59`).getTime()
      if (Number.isFinite(from) && Number.isFinite(to) && to >= from) return { from, to, custom: true }
    }
    const span = ({ today: DAY, '7days': 7 * DAY, '30days': 30 * DAY, '3months': 90 * DAY, year: 365 * DAY } as Record<Period, number>)[period]
    return { from: now - span, to: now, custom: false }
  }, [period, customFrom, customTo])

  // Export Excel (.xlsx multi-feuilles, sans dépendance) des données BRUTES de la plage active.
  const handleExcelExport = async () => {
    try {
      const [sales, expenses, products, emps] = await Promise.all([
        salesApi.list(), expensesApi.list(), productsApi.list(), employeesApi.list(),
      ])
      const sheets = buildReportSheets({
        lang, currency, range,
        sales: sales ?? [], expenses: expenses ?? [], products: products ?? [], employees: emps ?? [],
        filterCat,
      })
      const fromStr = new Date(range.from).toISOString().slice(0, 10)
      const toStr = new Date(range.to).toISOString().slice(0, 10)
      writeXlsx(`HabaShop_Rapports_${fromStr}_${toStr}`, sheets)
      toast.success(i('Excel téléchargé !', 'Excel downloaded!', '¡Excel descargado!', 'Excel scaricato!'))
    } catch {
      toast.error(i('Échec de l\'export Excel', 'Excel export failed', 'Error al exportar Excel', 'Esportazione Excel fallita'))
    }
  }

  const PERIOD_LABELS: Record<Period, string> = {
    today:    t('reports_today'),
    '7days':  t('reports_7days'),
    '30days': t('reports_30days'),
    '3months':t('reports_3months'),
    year:     t('reports_year'),
  }
  const _loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  // Libellé de période affiché : plage custom si active, sinon le preset.
  const periodLabel = range.custom
    ? `${new Date(range.from).toLocaleDateString(_loc)} → ${new Date(range.to).toLocaleDateString(_loc)}`
    : PERIOD_LABELS[period]

  // KPIs + graphique 7j + top produits calculés depuis les vraies ventes
  // (les items incluent product.buyPrice → vraie marge brute = CA − coût d'achat).
  const { data, chartData, topProducts } = useMemo(() => {
    const now = Date.now(); const DAY = 86400000
    const ts = (s: any) => new Date(s.createdAt).getTime()
    const winLen = range.to - range.from
    const cur  = salesData.filter(s => ts(s) >= range.from && ts(s) <= range.to)
    const prev = salesData.filter(s => ts(s) >= range.from - winLen && ts(s) < range.from)
    const agg = (arr: any[]) => {
      const ca = arr.reduce((s, x) => s + (x.total ?? 0), 0)
      const margin = arr.reduce((s, x) => s + (x.items ?? []).reduce((m: number, it: any) => m + (((it.unitPrice ?? 0) - (it.product?.buyPrice ?? 0)) * (it.qty ?? 0)), 0), 0)
      return { ca, margin, transactions: arr.length, avgCart: arr.length ? Math.round(ca / arr.length) : 0 }
    }
    const c = agg(cur), p = agg(prev)
    const evol = (a: number, b: number) => b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : 0
    const labels = WEEK_ABBR[lang] ?? WEEK_ABBR.fr
    const chart = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * DAY)
      const key = d.toISOString().slice(0, 10)
      const val = salesData.filter(s => new Date(s.createdAt).toISOString().slice(0, 10) === key).reduce((s2, x) => s2 + (x.total ?? 0), 0)
      return { day: labels[(d.getDay() + 6) % 7], val }
    })
    const pmap: Record<string, { name: string; qty: number; ca: number }> = {}
    cur.forEach(s => (s.items ?? []).forEach((it: any) => {
      if (filterCat && (it.product?.category ?? '') !== filterCat) return // filtre catégorie (niveau item)
      const name = it.product?.name ?? (lang === 'en' ? 'Product' : lang === 'es' ? 'Producto' : lang === 'it' ? 'Prodotto' : 'Produit')
      pmap[name] = pmap[name] ?? { name, qty: 0, ca: 0 }
      pmap[name].qty += it.qty ?? 0; pmap[name].ca += it.total ?? 0
    }))
    const top = Object.values(pmap).sort((a, b) => b.ca - a.ca).slice(0, 5).map((p2, idx) => ({ rank: idx + 1, ...p2 }))
    return {
      data: { ...c, caEvol: evol(c.ca, p.ca), marginEvol: evol(c.margin, p.margin), txEvol: evol(c.transactions, p.transactions), cartEvol: evol(c.avgCart, p.avgCart) },
      chartData: chart,
      topProducts: top,
    }
  }, [salesData, range, lang, filterCat])

  const paymentModes = paymentData.map(p => ({ label: p.name, pct: p.value, color: p.color, amount: p.amount }))

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <Skeleton height={56} count={5} />
    </div>
  )

  if (salesData.length === 0) return (
    <div className="space-y-5 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_reports')}</h1>
          <p className="page-subtitle">{periodLabel}</p>
        </div>
      </div>
      <div className="panel">
        <EmptyState
          icon="📊"
          title={lang === 'en' ? 'No data available' : lang === 'es' ? 'Sin datos disponibles' : lang === 'it' ? 'Nessun dato disponibile' : 'Aucune donnée disponible'}
          message={lang === 'en' ? 'Record your first sales to generate reports.' : lang === 'es' ? 'Registre sus primeras ventas para generar informes.' : lang === 'it' ? 'Registra le tue prime vendite per generare report.' : 'Enregistrez vos premières ventes pour générer des rapports.'}
          action={{ label: lang === 'en' ? 'Open the register' : lang === 'es' ? 'Abrir la caja' : lang === 'it' ? 'Apri la cassa' : 'Ouvrir la caisse', onClick: () => navigate('/app/pos') }}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-5 animate-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_reports')}</h1>
          <p className="page-subtitle">{periodLabel}</p>
        </div>
      </div>

      {/* Sélecteur période (presets + plage personnalisée) + exports */}
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => {
          const active = !range.custom && period === p
          return (
            <button key={p}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              aria-pressed={active}
              style={{
                background: active ? 'var(--p)' : 'var(--card)',
                color: active ? '#fff' : 'var(--text2)',
                border: active ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? 'var(--sh-xs)' : 'none',
              }}
              onClick={() => { setCustomFrom(''); setCustomTo(''); setPeriod(p) }}
            >{PERIOD_LABELS[p]}</button>
          )
        })}
        {/* Plage de dates personnalisée */}
        <div className="flex items-center gap-1.5" style={{ padding: '4px 10px', borderRadius: 12, border: `1px solid ${range.custom ? 'var(--p)' : 'var(--border)'}`, background: 'var(--card)' }}>
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>{i('Du', 'From', 'Desde', 'Dal')}</span>
          <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)}
            className="input" style={{ height: 32, width: 'auto', fontSize: 'var(--fs-label)', padding: '2px 8px' }} aria-label={i('Date de début', 'Start date', 'Fecha de inicio', 'Data inizio')} />
          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>{i('au', 'to', 'hasta', 'al')}</span>
          <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)}
            className="input" style={{ height: 32, width: 'auto', fontSize: 'var(--fs-label)', padding: '2px 8px' }} aria-label={i('Date de fin', 'End date', 'Fecha de fin', 'Data fine')} />
          {range.custom && (
            <button onClick={() => { setCustomFrom(''); setCustomTo('') }} title={i('Effacer', 'Clear', 'Borrar', 'Cancella')}
              style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 'var(--fs-md)', lineHeight: 1, padding: '0 2px' }}>×</button>
          )}
        </div>
        {/* Dropdown « Exporter ▾ » — un seul déclencheur, aligné à droite ; 3 options au clic */}
        <div ref={exportRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => setExportOpen(o => !o)}
            aria-haspopup="menu" aria-expanded={exportOpen}>
            <Download size={13} /> {i('Exporter', 'Export', 'Exportar', 'Esporta')}
            <ChevronDown size={13} style={{ transition: 'transform .15s', transform: exportOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {exportOpen && (
            <div role="menu" style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, minWidth: 210,
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: 'var(--sh-xl, 0 12px 32px rgba(0,0,0,.28))', padding: 6,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <button role="menuitem" style={menuItemStyle} onMouseEnter={itemHover(true)} onMouseLeave={itemHover(false)}
                onClick={() => { setExportOpen(false); handleExcelExport() }}>
                <FileSpreadsheet size={15} style={{ color: 'var(--p2)' }} /> {i('Exporter Excel', 'Export Excel', 'Exportar Excel', 'Esporta Excel')}
              </button>
              <button role="menuitem" style={menuItemStyle} onMouseEnter={itemHover(true)} onMouseLeave={itemHover(false)}
                onClick={() => {
                  setExportOpen(false)
                  exportCSV('habashop_rapports',
                    ['Période','CA','Marge','Transactions','Panier moyen'],
                    [[periodLabel, data.ca, data.margin, data.transactions, data.avgCart]]
                  )
                  toast.success('Export CSV téléchargé !')
                }}>
                <FileText size={15} style={{ color: 'var(--acc)' }} /> {i('Exporter CSV', 'Export CSV', 'Exportar CSV', 'Esporta CSV')}
              </button>
              <button role="menuitem" style={menuItemStyle} onMouseEnter={itemHover(true)} onMouseLeave={itemHover(false)}
                onClick={() => {
                  setExportOpen(false)
                  const body = `
                    ${htmlKPIs([
                      { label: t('reports_revenue'),      value: fmt(data.ca) },
                      { label: t('reports_margin'),       value: fmt(data.margin) },
                      { label: t('reports_transactions'), value: String(data.transactions) },
                      { label: t('reports_avg_cart'),     value: fmt(data.avgCart) },
                    ])}
                    <h2>${t('report_pdf_payment')}</h2>
                    ${htmlTable(
                      [t('expenses_mode'), t('reports_transactions'), t('col_amount'), '%'],
                      paymentModes.map(m => [m.label, '—', fmt(m.amount), m.pct + ' %']),
                      [`<strong>${t('common_total')}</strong>`, '—', `<strong>${fmt(paymentModes.reduce((s,m) => s + m.amount, 0))}</strong>`, '100 %']
                    )}
                    <h2>${t('report_pdf_top')}</h2>
                    ${htmlTable(
                      ['#', t('col_product'), t('col_qty'), t('reports_revenue')],
                      topProducts.map(p => [String(p.rank), p.name, String(p.qty), fmt(p.ca)])
                    )}
                  `
                  openPDF(`${t('report_pdf_title')} — ${periodLabel}`, body)
                  toast.success('PDF ouvert !')
                }}>
                <FileText size={15} style={{ color: 'var(--danger)' }} /> {i('Exporter PDF', 'Export PDF', 'Exportar PDF', 'Esporta PDF')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtre catégorie produit ; portée : Top produits + feuilles Ventes/Stock de l'export */}
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input" style={{ width: 'auto', minWidth: 170, height: 36, fontSize: 'var(--fs-label)' }}
          value={filterCat} onChange={e => setFilterCat(e.target.value)} aria-label={i('Filtre catégorie', 'Category filter', 'Filtro categoría', 'Filtro categoria')}>
          <option value="">{i('Toutes les catégories', 'All categories', 'Todas las categorías', 'Tutte le categorie')}</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {filterCat && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterCat('')}>
            {i('Réinitialiser', 'Reset', 'Reiniciar', 'Reimposta')}
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('reports_revenue'),      value: fmt(data.ca),       evol: data.caEvol,     color: 'var(--p2)',   icon: <DollarSign   size={18} /> },
          { label: t('reports_margin'),       value: fmt(data.margin),    evol: data.marginEvol, color: 'var(--acc2)', icon: <TrendingUp   size={18} /> },
          { label: t('reports_transactions'), value: data.transactions.toLocaleString('fr-FR'),evol: data.txEvol,     color: 'var(--acc)',  icon: <Receipt      size={18} /> },
          { label: t('reports_avg_cart'),     value: fmt(data.avgCart),   evol: data.cartEvol,   color: 'var(--p3)',   icon: <ShoppingCart size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub mt-1"><Trend evol={k.evol} /></div>
          </div>
        ))}
      </div>

      {/* 5 content tabs */}
      <Tabs
        variant="pill"
        ariaLabel={lang === 'en' ? 'Report sections' : lang === 'es' ? 'Secciones de informe' : lang === 'it' ? 'Sezioni report' : 'Sections du rapport'}
        value={reportTab}
        onChange={id => setReportTab(id as typeof reportTab)}
        tabs={[
          { id:'ventes',  label: lang === 'en' ? 'Sales' : lang === 'es' ? 'Ventas' : lang === 'it' ? 'Vendite' : 'Ventes',       icon: <ShoppingCart size={13}/> },
          { id:'stock',   label: 'Stock',                                                                                          icon: <Package size={13}/>      },
          { id:'clients', label: lang === 'en' ? 'Customers' : lang === 'es' ? 'Clientes' : lang === 'it' ? 'Clienti' : 'Clients', icon: <Users size={13}/>        },
          { id:'finance', label: lang === 'en' ? 'Finance' : lang === 'es' ? 'Finanzas' : lang === 'it' ? 'Finanza' : 'Finance',   icon: <Wallet size={13}/>       },
          { id:'rh',      label: lang === 'en' ? 'HR' : lang === 'es' ? 'RRHH' : lang === 'it' ? 'HR' : 'RH',                       icon: <UserCog size={13}/>      },
        ]}
      />

      {/* Onglets détaillés */}
      <Suspense fallback={<div style={{ minHeight: 200 }} />}>
        <ReportsTabs
          reportTab={reportTab}
          fmt={fmt} abbr={abbr} lang={lang}
          chartData={chartData}
          paymentData={paymentData}
          activePayIndex={activePayIndex} setActivePayIndex={setActivePayIndex}
          salesData={salesData}
          data={data}
          topProducts={topProducts}
        />
      </Suspense>

    </div>
  )
}
