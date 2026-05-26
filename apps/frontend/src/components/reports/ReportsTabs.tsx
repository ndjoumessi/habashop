import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Trophy, Receipt, CreditCard, Package, Users, TrendingUp, Wallet, DollarSign, UserCog } from 'lucide-react'
import { t } from '@/stores/appStore'
import { RADIAN } from '@/components/reports/reportsShared'

interface ReportsTabsProps {
  reportTab: 'ventes' | 'stock' | 'clients' | 'finance' | 'rh'
  fmt: (n: number) => string
  abbr: (n: number) => string
  lang: string
  chartData: any[]
  paymentData: { name: string; value: number; amount: number; color: string }[]
  activePayIndex: number | null
  setActivePayIndex: (i: number | null) => void
  salesData: any[]
  data: { ca: number; margin: number; transactions: number; avgCart: number; caEvol: number; marginEvol: number; txEvol: number; cartEvol: number }
  topProducts: { rank: number; name: string; qty: number; ca: number }[]
}

const PAY_LABEL = (mode: string, lang: string) =>
  mode === 'cash' ? (lang === 'en' ? 'Cash' : lang === 'es' ? 'Efectivo' : lang === 'it' ? 'Contanti' : 'Espèces') :
  mode === 'mobile' ? 'Mobile' : mode === 'wave' ? 'Wave' : mode === 'orange' ? 'Orange' :
  mode === 'card' ? (lang === 'en' ? 'Card' : lang === 'es' ? 'Tarjeta' : lang === 'it' ? 'Carta' : 'Carte') : mode

export default function ReportsTabs({ reportTab, fmt, abbr, lang, chartData, paymentData, activePayIndex, setActivePayIndex, salesData, data, topProducts }: ReportsTabsProps) {
  const recentSales = salesData.slice(0, 8).map((s: any) => ({
    ref: `VNT-${String(s.id ?? '').slice(-6).toUpperCase()}`,
    date: s.createdAt,
    client: s.customerId ? (lang === 'en' ? 'Customer' : lang === 'es' ? 'Cliente' : lang === 'it' ? 'Cliente' : 'Client') : (lang === 'en' ? 'Walk-in' : lang === 'es' ? 'Cliente directo' : lang === 'it' ? 'Cliente diretto' : 'Client direct'),
    total: s.total ?? 0,
    mode: PAY_LABEL(s.paymentMode ?? 'cash', lang),
    items: (s.items ?? []).length,
  }))
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

  return (
    <>
      {/* ── Tab: Ventes ── */}
      {reportTab === 'ventes' && (<>

      {/* AreaChart + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* AreaChart 7 jours */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <span className="panel-title">{t('reports_chart_week')}</span>
            <span style={{ fontSize:11, color:'var(--text3)' }}>Semaine du 7 au 13 mai 2026</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top:4, right:8, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="areaGradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#6C47FF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6C47FF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill:'var(--text3)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => abbr(v)} tick={{ fill:'var(--text3)', fontSize:10 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip
                formatter={(v: number) => [fmt(v), lang === 'en' ? 'Revenue' : lang === 'es' ? 'Ingresos' : lang === 'it' ? 'Ricavi' : 'CA']}
                contentStyle={{ background:'#111125', border:'1px solid rgba(108,71,255,.3)', borderRadius:10, fontSize:12 }}
                labelStyle={{ color:'var(--text2)', fontWeight:700 }}
                cursor={{ stroke:'rgba(108,71,255,.3)', strokeWidth:1 }}
              />
              <Area dataKey="val" stroke="#6C47FF" strokeWidth={2.5} fill="url(#areaGradCA)" dot={false} activeDot={{ r:5, fill:'#6C47FF', strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
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
                <div className="panel-t">{lang === 'en' ? 'Payment breakdown' : lang === 'es' ? 'Desglose de pagos' : lang === 'it' ? 'Ripartizione pagamenti' : 'Répartition paiements'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {salesData.length > 0
                    ? `${salesData.length} ${lang === 'en' ? 'transactions' : lang === 'es' ? 'transacciones' : lang === 'it' ? 'transazioni' : 'transactions'}`
                    : lang === 'en' ? 'Demo data' : lang === 'es' ? 'Datos de demostración' : lang === 'it' ? 'Dati dimostrativi' : 'Données de démonstration'}
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
                    {lang === 'en' ? 'modes' : lang === 'es' ? 'modos' : lang === 'it' ? 'modalità' : 'modes'}
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
            {topProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
                {lang === 'en' ? 'No sales in this period' : lang === 'es' ? 'Sin ventas en el período' : lang === 'it' ? 'Nessuna vendita nel periodo' : 'Aucune vente sur la période'}
              </div>
            ) : topProducts.map(p => (
              <div key={p.rank} className="flex items-center gap-3 py-2"
                style={{ borderBottom: p.rank < topProducts.length ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: p.rank === 1 ? 'rgba(240,165,0,.2)' : p.rank === 2 ? 'rgba(136,134,168,.2)' : 'rgba(91,78,232,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  color: p.rank === 1 ? 'var(--acc)' : p.rank === 2 ? 'var(--text2)' : 'var(--p3)',
                }}>#{p.rank}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>{p.qty.toLocaleString('fr-FR')} {lang === 'en' ? 'units sold' : lang === 'es' ? 'unidades vendidas' : lang === 'it' ? 'unità vendute' : 'unités vendues'}</div>
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
                {recentSales.map(s => (
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
      </>)}

      {/* ── Tab: Stock ── */}
      {reportTab === 'stock' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { label: lang === 'en' ? 'Items in stock' : lang === 'es' ? 'Artículos en stock' : lang === 'it' ? 'Articoli in stock' : 'Articles en stock',   value:'142',        color:'var(--acc2)', sub: lang === 'en' ? 'active SKUs' : lang === 'es' ? 'SKU activos' : lang === 'it' ? 'SKU attivi' : 'références actives'   },
            { label: lang === 'en' ? 'Total stock value' : lang === 'es' ? 'Valor stock total' : lang === 'it' ? 'Valore stock totale' : 'Valeur stock total', value:fmt(8420000), color:'var(--p2)',   sub: lang === 'en' ? 'purchase cost' : lang === 'es' ? 'costo de compra' : lang === 'it' ? 'costo d\'acquisto' : 'coût d\'achat' },
            { label: lang === 'en' ? 'Out of stock' : lang === 'es' ? 'Artículos agotados' : lang === 'it' ? 'Articoli esauriti' : 'Articles en rupture',      value:'7',          color:'var(--danger)', sub: lang === 'en' ? 'urgent reorder' : lang === 'es' ? 'pedir con urgencia' : lang === 'it' ? 'da ordinare con urgenza' : 'à commander en urgence' },
          ].map(k => (
            <div key={k.label} className="kpi-card" style={{ borderTop:`3px solid ${k.color}` }}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
          <div className="panel lg:col-span-3" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Package size={14}/> {lang === 'en' ? 'Stock rotation — Top categories' : lang === 'es' ? 'Rotación de stock — Top categorías' : lang === 'it' ? 'Rotazione stock — Top categorie' : 'Rotation des stocks — Top catégories'}</span>
            </div>
            {[
              { cat:'Céréales',   pct:82, val:fmt(2180000), color:'#818CF8' },
              { cat:'Corps gras', pct:67, val:fmt(1640000), color:'#F59E0B' },
              { cat:'Épicerie',   pct:74, val:fmt(1290000), color:'#34D399' },
              { cat:'Hygiène',    pct:55, val:fmt(980000),  color:'#F472B6' },
              { cat:'Laitiers',   pct:61, val:fmt(870000),  color:'#60A5FA' },
            ].map(row => (
              <div key={row.cat} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', width:100, flexShrink:0 }}>{row.cat}</span>
                <div style={{ flex:1, height:8, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${row.pct}%`, background:row.color, borderRadius:99, opacity:.85 }} />
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:row.color, width:36, textAlign:'right' }}>{row.pct}%</span>
                <span style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--text2)', width:80, textAlign:'right' }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Clients ── */}
      {reportTab === 'clients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Users size={14}/> {lang === 'en' ? 'Customer segments' : lang === 'es' ? 'Segmentos de clientes' : lang === 'it' ? 'Segmenti clienti' : 'Segments clients'}</span>
            </div>
            {[
              { label: lang === 'en' ? 'Wholesalers' : lang === 'es' ? 'Mayoristas' : lang === 'it' ? 'Grossisti' : 'Grossistes',  count:45,  ca:fmt(8400000), color:'#6C47FF', pct:52 },
              { label: lang === 'en' ? 'Retailers' : lang === 'es' ? 'Minoristas' : lang === 'it' ? 'Dettaglianti' : 'Détaillants',    count:31,  ca:fmt(4200000), color:'#00B8FF', pct:26 },
              { label: lang === 'en' ? 'Direct' : lang === 'es' ? 'Directos' : lang === 'it' ? 'Diretti' : 'Clients directs',       count:13,  ca:fmt(3600000), color:'#00D084', pct:22 },
            ].map(seg => (
              <div key={seg.label} style={{ padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:seg.color }} />
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{seg.label}</span>
                    <span style={{ fontSize:11, color:'var(--text3)', background:'var(--bg3)', padding:'1px 8px', borderRadius:20 }}>{seg.count} clients</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, color:seg.color, fontFamily:'var(--mono)' }}>{seg.ca}</span>
                </div>
                <div style={{ height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${seg.pct}%`, background:seg.color, borderRadius:99 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><TrendingUp size={14}/> {lang === 'en' ? 'Loyalty metrics' : lang === 'es' ? 'Métricas de fidelización' : lang === 'it' ? 'Metriche fidelizzazione' : 'Métriques fidélisation'}</span>
            </div>
            {[
              { label: lang === 'en' ? 'Retention rate' : lang === 'es' ? 'Tasa de retención' : lang === 'it' ? 'Tasso di fidelizzazione' : 'Taux de rétention',   value:'68 %',    color:'var(--acc2)' },
              { label: lang === 'en' ? 'Avg. basket' : lang === 'es' ? 'Ticket medio' : lang === 'it' ? 'Scontrino medio' : 'Panier moyen',       value:fmt(125000), color:'var(--p2)'  },
              { label: lang === 'en' ? 'Purchase freq.' : lang === 'es' ? 'Frec. compra' : lang === 'it' ? 'Freq. acquisto' : 'Achat fréquence',    value:'2.4×/mois', color:'var(--acc)' },
              { label: lang === 'en' ? 'Estimated NPS' : lang === 'es' ? 'NPS estimado' : lang === 'it' ? 'NPS stimato' : 'NPS estimé',     value:'67',      color:'#A78BFA'    },
            ].map(m => (
              <div key={m.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>{m.label}</span>
                <span style={{ fontSize:16, fontWeight:900, color:m.color, fontFamily:'var(--mono)' }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Finance ── */}
      {reportTab === 'finance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Wallet size={14}/> {lang === 'en' ? 'P&L summary' : lang === 'es' ? 'Cuenta de resultados simplificada' : lang === 'it' ? 'Conto economico semplificato' : 'Compte de résultat simplifié'}</span>
            </div>
            {[
              { label: lang === 'en' ? 'Revenue' : lang === 'es' ? 'Facturación' : lang === 'it' ? 'Fatturato' : 'Chiffre d\'affaires',      value:fmt(data.ca),     color:'var(--acc2)', prefix:'+' },
              { label: lang === 'en' ? 'Cost of sales' : lang === 'es' ? 'Costo de ventas' : lang === 'it' ? 'Costo del venduto' : 'Coût des ventes',value:fmt(Math.round(data.ca * 0.62)), color:'var(--danger)', prefix:'-' },
              { label: lang === 'en' ? 'Gross margin' : lang === 'es' ? 'Margen bruto' : lang === 'it' ? 'Margine lordo' : 'Marge brute', value:fmt(data.margin), color:'var(--p2)', prefix:'=' },
              { label: lang === 'en' ? 'Op. expenses' : lang === 'es' ? 'Gastos op.' : lang === 'it' ? 'Spese op.' : 'Charges d\'exploit.', value:fmt(Math.round(data.margin * 0.58)), color:'var(--acc)', prefix:'-' },
              { label: lang === 'en' ? 'Net income' : lang === 'es' ? 'Resultado neto' : lang === 'it' ? 'Risultato netto' : 'Résultat net',   value:fmt(Math.round(data.margin * 0.42)), color:'var(--acc2)', prefix:'=' },
            ].map((row, i) => (
              <div key={row.label} style={{
                display:'flex', justifyContent:'space-between', padding:'12px 0',
                borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                borderTop: i === 4 ? '2px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>{row.prefix && <span style={{ color:row.color, fontWeight:900, marginRight:6 }}>{row.prefix}</span>}{row.label}</span>
                <span style={{ fontSize:14, fontWeight:800, color:row.color, fontFamily:'var(--mono)' }}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><DollarSign size={14}/> {lang === 'en' ? 'Key financial ratios' : lang === 'es' ? 'Ratios financieros clave' : lang === 'it' ? 'Indici finanziari chiave' : 'Ratios financiers clés'}</span>
            </div>
            {[
              { label: lang === 'en' ? 'Gross margin %' : lang === 'es' ? 'Margen bruto %' : lang === 'it' ? 'Margine lordo %' : 'Taux de marge brute',  value:`${Math.round((data.margin / data.ca) * 100)} %`, color:'var(--acc2)' },
              { label: lang === 'en' ? 'Net margin %' : lang === 'es' ? 'Margen neto %' : lang === 'it' ? 'Margine netto %' : 'Taux de marge nette',    value:`${Math.round((data.margin * 0.42 / data.ca) * 100)} %`, color:'var(--p2)'  },
              { label: lang === 'en' ? 'Avg. basket' : lang === 'es' ? 'Ticket medio' : lang === 'it' ? 'Scontrino medio' : 'Panier moyen',     value:fmt(data.avgCart),  color:'var(--acc)'  },
              { label: lang === 'en' ? 'Transactions' : lang === 'es' ? 'Transacciones' : lang === 'it' ? 'Transazioni' : 'Transactions',    value:String(data.transactions), color:'var(--text2)' },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>{r.label}</span>
                <span style={{ fontSize:18, fontWeight:900, color:r.color, fontFamily:'var(--mono)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: RH ── */}
      {reportTab === 'rh' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { label: lang === 'en' ? 'Total staff' : lang === 'es' ? 'Plantilla total' : lang === 'it' ? 'Organico totale' : 'Effectif total',   value:'8',         color:'var(--p2)',    sub: lang === 'en' ? 'employees' : lang === 'es' ? 'colaboradores' : lang === 'it' ? 'collaboratori' : 'collaborateurs' },
            { label: lang === 'en' ? 'Payroll total' : lang === 'es' ? 'Masa salarial' : lang === 'it' ? 'Costo del personale' : 'Masse salariale', value:fmt(680000), color:'var(--acc)',   sub: lang === 'en' ? 'per month' : lang === 'es' ? 'por mes' : lang === 'it' ? 'al mese' : 'par mois' },
            { label: lang === 'en' ? 'Attendance' : lang === 'es' ? 'Asistencia' : lang === 'it' ? 'Presenza' : 'Taux présence',    value:'94 %',      color:'var(--acc2)', sub: lang === 'en' ? 'this month' : lang === 'es' ? 'este mes' : lang === 'it' ? 'questo mese' : 'ce mois' },
          ].map(k => (
            <div key={k.label} className="kpi-card" style={{ borderTop:`3px solid ${k.color}` }}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color:k.color }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
          <div className="panel lg:col-span-3" style={{ marginBottom:0 }}>
            <div className="panel-head">
              <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><UserCog size={14}/> {lang === 'en' ? 'Team' : lang === 'es' ? 'Equipo' : lang === 'it' ? 'Squadra' : 'Équipe'}</span>
            </div>
            {[
              { nom:'Amara Diallo',  poste: lang === 'en' ? 'Manager' : lang === 'es' ? 'Gerente' : lang === 'it' ? 'Manager' : 'Manager',     dept: lang === 'en' ? 'Management' : lang === 'es' ? 'Dirección' : lang === 'it' ? 'Direzione' : 'Direction', salaire:fmt(180000), status:'Présent' },
              { nom:'Fatou Sow',     poste: lang === 'en' ? 'Cashier' : lang === 'es' ? 'Cajera' : lang === 'it' ? 'Cassiera' : 'Caissière',     dept:'POS',   salaire:fmt(85000),  status:'Présent' },
              { nom:'Omar Diop',     poste: lang === 'en' ? 'Warehouse' : lang === 'es' ? 'Almacenero' : lang === 'it' ? 'Magazziniere' : 'Magasinier',   dept: lang === 'en' ? 'Stock' : lang === 'es' ? 'Stock' : lang === 'it' ? 'Stock' : 'Stock',  salaire:fmt(80000),  status:'Présent' },
              { nom:'Aïssatou Ba',   poste: lang === 'en' ? 'Accountant' : lang === 'es' ? 'Contable' : lang === 'it' ? 'Contabile' : 'Comptable',  dept: lang === 'en' ? 'Finance' : lang === 'es' ? 'Finanzas' : lang === 'it' ? 'Finanza' : 'Finance', salaire:fmt(120000), status: lang === 'en' ? 'Leave' : lang === 'es' ? 'Permiso' : lang === 'it' ? 'Permesso' : 'Congé'  },
              { nom:'Ibrahima Fall', poste: lang === 'en' ? 'Delivery' : lang === 'es' ? 'Repartidor' : lang === 'it' ? 'Fattorino' : 'Livreur',    dept: lang === 'en' ? 'Logistics' : lang === 'es' ? 'Logística' : lang === 'it' ? 'Logistica' : 'Logistique', salaire:fmt(75000),  status:'Présent' },
            ].map(emp => (
              <div key={emp.nom} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:'var(--p3)' }}>{emp.nom[0]}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{emp.nom}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{emp.poste} · {emp.dept}</div>
                </div>
                <span style={{ fontSize:13, fontWeight:700, fontFamily:'var(--mono)', color:'var(--text2)' }}>{emp.salaire}</span>
                <span style={{
                  padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700,
                  background: emp.status === 'Présent' || emp.status === 'Present' ? 'rgba(14,196,126,.15)' : 'rgba(240,165,0,.15)',
                  color:       emp.status === 'Présent' || emp.status === 'Present' ? 'var(--acc2)' : 'var(--acc)',
                }}>{emp.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
