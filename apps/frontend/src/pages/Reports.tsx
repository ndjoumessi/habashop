import { useState, useMemo, useEffect } from 'react'
import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts'
import { Download, TrendingUp, TrendingDown, DollarSign, Receipt, ShoppingCart, BarChart2, CreditCard, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs, exportAccountingExcel } from '@/utils/export'
import { salesApi, expensesApi } from '@/lib/api'

type Period = 'today' | '7days' | '30days' | '3months' | 'year'

const PERIOD_DATA: Record<Period, {
  ca: number; margin: number; transactions: number; avgCart: number
  caEvol: number; marginEvol: number; txEvol: number; cartEvol: number
}> = {
  today:    { ca: 485000,    margin: 142000,   transactions: 23,   avgCart: 21087, caEvol: 12.4,  marginEvol: 8.2,   txEvol: 15.0,  cartEvol: -2.1 },
  '7days':  { ca: 2840000,   margin: 854000,   transactions: 147,  avgCart: 19320, caEvol: 8.7,   marginEvol: 6.5,   txEvol: 5.2,   cartEvol: 3.3  },
  '30days': { ca: 12600000,  margin: 3780000,  transactions: 612,  avgCart: 20588, caEvol: 15.3,  marginEvol: 11.8,  txEvol: 9.4,   cartEvol: 5.4  },
  '3months':{ ca: 34200000,  margin: 10260000, transactions: 1820, avgCart: 18791, caEvol: 22.1,  marginEvol: 18.6,  txEvol: 14.2,  cartEvol: 6.9  },
  year:     { ca: 142000000, margin: 42600000, transactions: 7840, avgCart: 18112, caEvol: 31.5,  marginEvol: 27.2,  txEvol: 22.8,  cartEvol: 7.1  },
}

const CHART_DATA = [
  { day: 'Lun', val: 1840000, h: 55 },
  { day: 'Mar', val: 2150000, h: 65 },
  { day: 'Mer', val: 1620000, h: 49 },
  { day: 'Jeu', val: 2890000, h: 87 },
  { day: 'Ven', val: 3320000, h: 100 },
  { day: 'Sam', val: 2640000, h: 79 },
  { day: 'Dim', val: 1180000, h: 35 },
]

const PAYMENT_MODES = [
  { label: 'Espèces',      pct: 62, color: 'var(--acc2)', amount: 7812000 },
  { label: 'Mobile',       pct: 28, color: 'var(--p2)',   amount: 3528000 },
  { label: 'Carte',        pct: 10, color: 'var(--acc)',  amount: 1260000 },
]

const RADIAN = Math.PI / 180

const TOP_PRODUCTS = [
  { rank: 1, name: '🌾 Riz parfumé 5kg',        ca: 1840000, qty: 408  },
  { rank: 2, name: '🫙 Huile palme 1L',           ca: 1530000, qty: 850  },
  { rank: 3, name: '🍚 Sucre 1kg',                ca: 1292500, qty: 1521 },
  { rank: 4, name: '🍅 Tomate concentrée 800g',   ca: 980000,  qty: 700  },
  { rank: 5, name: '🥛 Lait poudre 400g',         ca: 880000,  qty: 400  },
]

const RECENT_SALES = [
  { ref: 'VNT-2026-148', date: '2026-05-13 14:32', client: 'Marché Central Sandaga',   total: 520000, mode: 'Espèces', items: 6 },
  { ref: 'VNT-2026-147', date: '2026-05-13 11:15', client: 'Super Épicerie du Plateau', total: 215000, mode: 'Mobile',  items: 7 },
  { ref: 'VNT-2026-146', date: '2026-05-13 09:48', client: 'Client direct',             total: 32500,  mode: 'Espèces', items: 2 },
  { ref: 'VNT-2026-145', date: '2026-05-12 16:20', client: 'Boutique Awa Diallo',       total: 87000,  mode: 'Mobile',  items: 3 },
  { ref: 'VNT-2026-144', date: '2026-05-12 14:05', client: 'Client direct',             total: 18500,  mode: 'Espèces', items: 1 },
]

function Trend({ evol }: { evol: number }) {
  const up = evol >= 0
  return (
    <div className={up ? 'trend-up' : 'trend-down'}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{evol} %
    </div>
  )
}

export default function Reports() {
  const { lang, currency } = useConfig()
  void lang
  const fmt = useFormatAmount()

  const [activePayIndex, setActivePayIndex] = useState<number | null>(null)
  const [salesData,      setSalesData]      = useState<any[]>([])

  useEffect(() => {
    salesApi.list()
      .then((d: any) => { if (d?.length) setSalesData(d) })
      .catch(() => {})
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

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props
    return (
      <g>
        <g style={{ filter: `drop-shadow(0 0 12px ${fill}80)` }}>
          <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 8}
            startAngle={startAngle} endAngle={endAngle} fill={fill} />
        </g>
        <text x={cx} y={cy - 14} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 28, fontWeight: 900, fill, fontFamily: 'JetBrains Mono, monospace' }}>
          {(percent * 100).toFixed(0)}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 12, fontWeight: 700, fill: 'rgba(238,238,255,.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '.5px' }}>
          {payload.name}
        </text>
        {payload.amount > 0 && (
          <text x={cx} y={cy + 32} textAnchor="middle"
            style={{ fontSize: 11, fill: 'rgba(238,238,255,.4)', fontFamily: 'JetBrains Mono, monospace' }}>
            {fmt(payload.amount)}
          </text>
        )}
      </g>
    )
  }

  const CustomPayTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{
        background: '#111125', border: `1px solid ${d.color}40`,
        borderRadius: 12, padding: '10px 14px',
        boxShadow: `0 8px 24px rgba(0,0,0,.6), 0 0 0 1px ${d.color}20`, minWidth: 140,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, boxShadow: `0 0 8px ${d.color}`, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#EEEEFF' }}>{d.name}</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: d.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-1px', marginBottom: d.amount > 0 ? 4 : 0 }}>
          {d.value}%
        </div>
        {d.amount > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(238,238,255,.4)', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(d.amount)}</div>
        )}
      </div>
    )
  }

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.08) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 12, fontWeight: 900, fill: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
        {(percent * 100).toFixed(0)}%
      </text>
    )
  }

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
  const [period, setPeriod] = useState<Period>('30days')
  const data = PERIOD_DATA[period]

  const PERIOD_LABELS: Record<Period, string> = {
    today:    t('reports_today'),
    '7days':  t('reports_7days'),
    '30days': t('reports_30days'),
    '3months':t('reports_3months'),
    year:     t('reports_year'),
  }

  const paymentModes = [
    { label: t('reports_cash'),   pct: PAYMENT_MODES[0].pct, color: PAYMENT_MODES[0].color, amount: PAYMENT_MODES[0].amount },
    { label: t('reports_mobile'), pct: PAYMENT_MODES[1].pct, color: PAYMENT_MODES[1].color, amount: PAYMENT_MODES[1].amount },
    { label: t('reports_card'),   pct: PAYMENT_MODES[2].pct, color: PAYMENT_MODES[2].color, amount: PAYMENT_MODES[2].amount },
  ]

  const WEEK_ABBR: Record<string, string[]> = {
    fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
    en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
    it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
  }
  const weekAbbr = WEEK_ABBR[lang] ?? WEEK_ABBR.fr
  const chartData = CHART_DATA.map((d, i) => ({ ...d, day: weekAbbr[i] }))

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
              TOP_PRODUCTS.map(p => [String(p.rank), p.name, String(p.qty), fmt(p.ca)])
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

      {/* Graphique CA + Modes paiement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar chart 7 jours */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{t('reports_chart_week')}</span>
          </div>
          <div className="bar-chart" style={{ height: 140 }}>
            {chartData.map(d => (
              <div key={d.day} className="bar-group">
                <div className="bar" style={{ height: `${d.h}%` }}
                  data-val={fmt(d.val)} />
                <div className="bar-label">{d.day}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-center" style={{ color: 'var(--text3)' }}>
            Semaine du 7 au 13 mai 2026
          </div>
        </div>

        {/* Modes paiement — donut premium */}
        <div className="panel" style={{ marginBottom: 0, background: 'linear-gradient(160deg,#0D0D1C,#111125)' }}>
          <div className="panel-h">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(108,71,255,.15)', border: '1px solid rgba(108,71,255,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><CreditCard size={18} style={{ color:'var(--p3)' }}/></div>
              <div>
                <div className="panel-t">{lang === 'fr' ? 'Répartition paiements' : 'Payment breakdown'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {salesData.length > 0
                    ? `${salesData.length} ${lang === 'fr' ? 'transactions' : 'transactions'}`
                    : lang === 'fr' ? 'Données de démonstration' : 'Demo data'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie
                    activeIndex={activePayIndex ?? undefined}
                    activeShape={renderActiveShape}
                    data={paymentData}
                    cx="50%" cy="50%"
                    innerRadius={68} outerRadius={100}
                    paddingAngle={2} dataKey="value"
                    labelLine={false}
                    label={activePayIndex === null ? renderLabel : undefined}
                    onMouseEnter={(_: any, index: number) => setActivePayIndex(index)}
                    onMouseLeave={() => setActivePayIndex(null)}
                    strokeWidth={0}
                  >
                    {paymentData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        opacity={activePayIndex === null || activePayIndex === index ? 1 : 0.35}
                        style={{ cursor: 'pointer', transition: 'opacity .2s' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPayTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {activePayIndex === null && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  textAlign: 'center', pointerEvents: 'none',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '-1px' }}>
                    {paymentData.length}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    {lang === 'fr' ? 'modes' : 'modes'}
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paymentData.map((item, i) => (
                <div key={i}
                  onMouseEnter={() => setActivePayIndex(i)}
                  onMouseLeave={() => setActivePayIndex(null)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: activePayIndex === i ? `${item.color}12` : 'rgba(255,255,255,.02)',
                    border: `1px solid ${activePayIndex === i ? item.color + '35' : 'rgba(255,255,255,.05)'}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
                    transform: activePayIndex === i ? 'translateX(4px)' : 'none',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', background: item.color,
                      boxShadow: activePayIndex === i ? `0 0 8px ${item.color}` : 'none',
                      flexShrink: 0, transition: 'box-shadow .15s',
                    }} />
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: activePayIndex === i ? 'var(--text)' : 'var(--text2)',
                      transition: 'color .15s',
                    }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: item.color, fontFamily: 'var(--mono)', letterSpacing: '-0.5px' }}>
                      {item.value}%
                    </div>
                    {item.amount > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fmt(item.amount)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top produits + Ventes récentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top 5 */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Trophy size={14}/> {t('reports_top_products')}</span>
          </div>
          <div className="space-y-1">
            {TOP_PRODUCTS.map(p => (
              <div key={p.rank} className="flex items-center gap-3 py-2"
                style={{ borderBottom: p.rank < 5 ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: p.rank === 1 ? 'rgba(240,165,0,.2)' : p.rank === 2 ? 'rgba(136,134,168,.2)' : 'rgba(91,78,232,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  color: p.rank === 1 ? 'var(--acc)' : p.rank === 2 ? 'var(--text2)' : 'var(--p3)',
                }}>#{p.rank}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>{p.qty.toLocaleString('fr-FR')} unités vendues</div>
                </div>
                <div className="td-num text-sm" style={{ color: 'var(--acc2)' }}>{fmt(p.ca)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Ventes récentes */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Receipt size={14}/> Ventes récentes</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">{t('col_ref')}</th><th scope="col">{t('col_client')}</th><th scope="col">Mode</th><th scope="col">{t('col_amount')}</th></tr>
              </thead>
              <tbody>
                {RECENT_SALES.map(s => (
                  <tr key={s.ref}>
                    <td>
                      <div className="td-mono text-xs">{s.ref}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                        {new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="text-xs td-bold">{s.client}</td>
                    <td>
                      <span className={`badge ${
                        s.mode === 'Espèces' ? 'badge-green' :
                        s.mode === 'Mobile'  ? 'badge-violet' : 'badge-blue'
                      }`}>{s.mode}</span>
                    </td>
                    <td className="td-num text-sm" style={{ color: 'var(--acc2)' }}>{fmt(s.total)}</td>
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
