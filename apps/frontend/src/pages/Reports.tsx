import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Skeleton from '@/components/ui/skeleton'
import EmptyState from '@/components/ui/EmptyState'
import { useConfig, useFormatAmount, useAbbrevAmount, t } from '@/stores/appStore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Download, TrendingUp, TrendingDown, DollarSign, Receipt, ShoppingCart, BarChart2, CreditCard, Trophy, Package, Users, Wallet, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs, exportAccountingExcel } from '@/utils/export'
import { salesApi, expensesApi } from '@/lib/api'

import ReportsTabs from '@/components/reports/ReportsTabs'
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
      .then((d: any) => { if (d?.length) setSalesData(d) })
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
      { name: lang === 'fr' ? 'Espèces' : 'Cash', value: 62, amount: 0, color: '#00D084' },
      { name: 'Mobile',                             value: 22, amount: 0, color: '#8B6FFF' },
      { name: 'Wave',                               value: 16, amount: 0, color: '#00B8FF' },
      { name: 'Orange Money',                       value:  8, amount: 0, color: '#FF3B5C' },
      { name: lang === 'fr' ? 'Carte' : 'Card',    value:  5, amount: 0, color: '#FF9500' },
    ]
    return [
      { name: lang === 'fr' ? 'Espèces' : 'Cash', value: Math.round(((counts.cash   ?? 0) / total) * 100), amount: totals.cash   ?? 0, color: '#00D084' },
      { name: 'Mobile',                            value: Math.round(((counts.mobile ?? 0) / total) * 100), amount: totals.mobile ?? 0, color: '#8B6FFF' },
      { name: 'Wave',                              value: Math.round(((counts.wave   ?? 0) / total) * 100), amount: totals.wave   ?? 0, color: '#00B8FF' },
      { name: 'Orange Money',                      value: Math.round(((counts.orange ?? 0) / total) * 100), amount: totals.orange ?? 0, color: '#FF3B5C' },
      { name: lang === 'fr' ? 'Carte' : 'Card',   value: Math.round(((counts.card   ?? 0) / total) * 100), amount: totals.card   ?? 0, color: '#FF9500' },
    ].filter(d => d.value > 0)
  }, [salesData, lang])

  const handleAccountingExport = async () => {
    const period2 = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })
    try {
      const [sales, expenses] = await Promise.all([salesApi.list(), expensesApi.list()])
      exportAccountingExcel({ sales: sales ?? [], expenses: expenses ?? [], period: period2, shopName: 'HabaShop', currency }, fmt)
      toast.success('📊 Export comptable téléchargé !')
    } catch {
      exportAccountingExcel({ sales: [], expenses: [], period: period2, shopName: 'HabaShop', currency }, fmt)
      toast.success('📊 Export téléchargé')
    }
  }
  const [period,     setPeriod]     = useState<Period>('30days')
  const [reportTab,  setReportTab]  = useState<'ventes' | 'stock' | 'clients' | 'finance' | 'rh'>('ventes')

  const PERIOD_LABELS: Record<Period, string> = {
    today:    t('reports_today'),
    '7days':  t('reports_7days'),
    '30days': t('reports_30days'),
    '3months':t('reports_3months'),
    year:     t('reports_year'),
  }

  // KPIs + graphique 7j + top produits calculés depuis les vraies ventes
  // (les items incluent product.buyPrice → vraie marge brute = CA − coût d'achat).
  const { data, chartData, topProducts } = useMemo(() => {
    const now = Date.now(); const DAY = 86400000
    const span = ({ today: DAY, '7days': 7*DAY, '30days': 30*DAY, '3months': 90*DAY, year: 365*DAY } as Record<Period, number>)[period]
    const ts = (s: any) => new Date(s.createdAt).getTime()
    const cur  = salesData.filter(s => ts(s) >= now - span)
    const prev = salesData.filter(s => ts(s) >= now - 2*span && ts(s) < now - span)
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
      const name = it.product?.name ?? (lang === 'fr' ? 'Produit' : 'Product')
      pmap[name] = pmap[name] ?? { name, qty: 0, ca: 0 }
      pmap[name].qty += it.qty ?? 0; pmap[name].ca += it.total ?? 0
    }))
    const top = Object.values(pmap).sort((a, b) => b.ca - a.ca).slice(0, 5).map((p2, i) => ({ rank: i + 1, ...p2 }))
    return {
      data: { ...c, caEvol: evol(c.ca, p.ca), marginEvol: evol(c.margin, p.margin), txEvol: evol(c.transactions, p.transactions), cartEvol: evol(c.avgCart, p.avgCart) },
      chartData: chart,
      topProducts: top,
    }
  }, [salesData, period, lang])

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
          <p className="page-subtitle">{PERIOD_LABELS[period]}</p>
        </div>
      </div>
      <div className="panel">
        <EmptyState
          icon="📊"
          title={lang === 'fr' ? 'Aucune donnée disponible' : 'No data available'}
          message={lang === 'fr' ? 'Enregistrez vos premières ventes pour générer des rapports.' : 'Record your first sales to generate reports.'}
          action={{ label: lang === 'fr' ? 'Ouvrir la caisse' : 'Open the register', onClick: () => navigate('/app/pos') }}
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
          <p className="page-subtitle">{PERIOD_LABELS[period]}</p>
        </div>
      </div>

      {/* Sélecteur période + exports */}
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button key={p}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: period === p ? 'var(--p)' : 'var(--card)',
              color: period === p ? '#fff' : 'var(--text2)',
              border: period === p ? 'none' : '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: period === p ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
            }}
            onClick={() => setPeriod(p)}
          >{PERIOD_LABELS[p]}</button>
        ))}
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={handleAccountingExport}>
          <BarChart2 size={13}/> {lang === 'fr' ? 'Excel comptable' : 'Accounting Excel'}
        </button>
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
          exportCSV('habashop_rapports',
            ['Période','CA','Marge','Transactions','Panier moyen'],
            [[PERIOD_LABELS[period], data.ca, data.margin, data.transactions, data.avgCart]]
          )
          toast.success('📊 Export CSV téléchargé !')
        }}>
          <Download size={13} /> {t('btn_export')} CSV
        </button>
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => {
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
          openPDF(`${t('report_pdf_title')} — ${PERIOD_LABELS[period]}`, body)
          toast.success('📄 PDF ouvert !')
        }}>
          <Download size={13} /> {t('btn_export')} PDF
        </button>
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
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {([
          { id:'ventes',  label: lang === 'fr' ? 'Ventes'   : 'Sales',    Icon: ShoppingCart },
          { id:'stock',   label: lang === 'fr' ? 'Stock'    : 'Stock',    Icon: Package      },
          { id:'clients', label: lang === 'fr' ? 'Clients'  : 'Customers',Icon: Users        },
          { id:'finance', label: lang === 'fr' ? 'Finance'  : 'Finance',  Icon: Wallet       },
          { id:'rh',      label: lang === 'fr' ? 'RH'       : 'HR',       Icon: UserCog      },
        ] as { id: typeof reportTab; label: string; Icon: typeof ShoppingCart }[]).map(tab => (
          <button key={tab.id} onClick={() => setReportTab(tab.id)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 16px', borderRadius:99, fontSize:13, fontWeight:700,
              fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
              background: reportTab === tab.id ? 'var(--p)' : 'var(--card)',
              color:      reportTab === tab.id ? '#fff'     : 'var(--text2)',
              border:     reportTab === tab.id ? 'none'     : '1px solid var(--border)',
              boxShadow:  reportTab === tab.id ? '0 4px 14px rgba(91,78,232,.35)' : 'none',
            }}>
            <tab.Icon size={13}/> {tab.label}
          </button>
        ))}
      </div>

      {/* Onglets détaillés */}
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

    </div>
  )
}
