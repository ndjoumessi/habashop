import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Trophy, Receipt, CreditCard, Wallet, DollarSign } from 'lucide-react'
import { t } from '@/stores/appStore'
import { useThemeColor } from '@/hooks/useThemeColor'
import { RADIAN } from '@/components/reports/reportsShared'
import InventoryInsights from '@/components/reports/InventoryInsights'
import { StockKpis, HrKpis, ClientSegments } from '@/components/reports/ReportsLiveKpis'
import { type PaymentSlice, pctLabel } from '@/components/reports/paymentBreakdown'
import { salePaymentLabel } from '@/lib/salePaymentModes'

interface ReportsTabsProps {
  reportTab: 'ventes' | 'stock' | 'clients' | 'finance' | 'rh'
  fmt: (n: number) => string
  abbr: (n: number) => string
  lang: string
  chartData: any[]
  paymentData: PaymentSlice[]
  activePayIndex: number | null
  setActivePayIndex: (i: number | null) => void
  salesData: any[]
  data: { ca: number; margin: number; transactions: number; avgCart: number; caEvol: number; marginEvol: number; txEvol: number; cartEvol: number }
  topProducts: { rank: number; name: string; qty: number; ca: number }[]
}

// ⚠️ `PAY_LABEL` vivait ici : SIXIÈME réénumération du même domaine, dans le même fichier
// que la cinquième. Elle connaissait `mobile` (que le serveur n'écrit jamais) et ignorait
// `mtn` et `mixed` — d'où les « mixed » et « mtn » bruts, en minuscules, qu'on voyait dans
// « Ventes récentes » : son dernier `: mode` rendait la clé telle quelle. C'est ce résidu
// visible qui a permis de repérer le défaut du camembert, où les mêmes ventes, elles,
// disparaissaient sans laisser de trace.

export default function ReportsTabs({ reportTab, fmt, abbr, lang, chartData, paymentData, activePayIndex, setActivePayIndex, salesData, data, topProducts }: ReportsTabsProps) {
  // Helper i18n local — dérivé de la prop `lang` (et non du store) pour rester cohérent
  // avec le reste du composant, qui lit déjà `lang` partout.
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  // var() non résolu en attribut SVG recharts → couleurs résolues en JS, réactives au thème.
  const gridColor = useThemeColor('--border')
  const tickColor = useThemeColor('--text3', '#888')
  const recentSales = salesData.slice(0, 8).map((s: any) => ({
    ref: `VNT-${String(s.id ?? '').slice(-6).toUpperCase()}`,
    date: s.createdAt,
    client: s.customerId ? (lang === 'en' ? 'Customer' : lang === 'es' ? 'Cliente' : lang === 'it' ? 'Cliente' : 'Client') : (lang === 'en' ? 'Walk-in' : lang === 'es' ? 'Cliente directo' : lang === 'it' ? 'Cliente diretto' : 'Client direct'),
    total: s.total ?? 0,
    // ⚠️ Plus de `?? 'cash'` : un mode absent ne devient pas une vente en espèces sur une
    // ligne d'historique. `salePaymentLabel` rend « — » plutôt qu'un mode qu'on invente.
    mode: salePaymentLabel(s.paymentMode ?? '', lang),
    items: (s.items ?? []).length,
  }))
  /**
   * ⚠️ NE LIT PLUS le `percent` de recharts. C'était le SECOND dénominateur : recharts le
   * calcule en `value / Σ(values rendues)`, donc il ne connaît que les parts dessinées —
   * il renormalisait sur un sous-ensemble et affichait 38 % là où la légende disait 36 %.
   * Le pourcentage vient désormais du `payload`, c'est-à-dire de la MÊME série que la
   * légende, l'infobulle et le PDF. Un dessin, un nombre.
   */
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props
    return (
      <g>
        <g style={{ filter: `drop-shadow(0 0 12px ${fill}80)` }}>
          <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 8}
            startAngle={startAngle} endAngle={endAngle} fill={fill} />
        </g>
        <text x={cx} y={cy - 14} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 28, fontWeight: 'var(--fw-semibold)', fill, fontFamily: 'JetBrains Mono, monospace' }}>
          {pctLabel(payload)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', fill: 'var(--text2)', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '.5px' }}>
          {payload.name}
        </text>
        {payload.amount > 0 && (
          <text x={cx} y={cy + 32} textAnchor="middle"
            style={{ fontSize: 'var(--fs-caption)', fill: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
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
        background: 'var(--card)', border: `1px solid ${d.color}40`,
        borderRadius: 12, padding: '10px 14px',
        boxShadow: `var(--sh-md), 0 0 0 1px ${d.color}20`, minWidth: 140,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, boxShadow: `0 0 8px ${d.color}`, flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{d.name}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-display)', fontWeight: 'var(--fw-semibold)', color: d.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-1px', marginBottom: d.amount > 0 ? 4 : 0 }}>
          {pctLabel(d)}
        </div>
        {d.amount > 0 && (
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(d.amount)}</div>
        )}
      </div>
    )
  }

  // Étiquette DANS la part. Le seuil porte sur notre `pct` (entier, même série que tout le
  // reste) et non sur le `percent` de recharts : une part trop étroite pour porter du texte
  // reste muette ICI, mais elle est toujours dans la légende — masquer n'est pas supprimer.
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, payload }: any) => {
    if ((payload?.pct ?? 0) < 8) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', fill: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
        {payload.pct} %
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
            {/* ⚠️ Un libellé « Semaine du 7 au 13 mai 2026 » était FIGÉ ici (littéral, même
                pas traduit) alors que le graphe est glissant — les 7 derniers jours à partir
                de maintenant (Reports.tsx:163). Il affichait donc une semaine d'il y a trois
                mois sous des données du jour. Retiré : le titre porte déjà la période, et
                la remettre suppose de faire descendre la vraie plage depuis l'endroit où
                `chartData` est calculé — sinon elle redériverait. */}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top:4, right:8, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="areaGradCA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#6C47FF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6C47FF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="day" tick={{ fill:tickColor, fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => abbr(v)} tick={{ fill:tickColor, fontSize:11 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip
                formatter={(v: number) => [fmt(v), lang === 'en' ? 'Revenue' : lang === 'es' ? 'Ingresos' : lang === 'it' ? 'Ricavi' : 'CA']}
                contentStyle={{ background:'var(--card)', border:'1px solid rgba(108,71,255,.3)', borderRadius:10, fontSize:12 }}
                labelStyle={{ color:'var(--text2)', fontWeight:'var(--fw-semibold)' }}
                cursor={{ stroke:'rgba(108,71,255,.3)', strokeWidth:1 }}
              />
              <Area dataKey="val" stroke="#6C47FF" strokeWidth={2.5} fill="url(#areaGradCA)" dot={false} activeDot={{ r:5, fill:'#6C47FF', strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Modes paiement — donut premium */}
        <div className="panel" style={{ marginBottom: 0, background: 'var(--grad-card)' }}>
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(108,71,255,.15)', border: '1px solid rgba(108,71,255,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><CreditCard size={18} style={{ color:'var(--p3)' }}/></div>
              <div>
                <div className="panel-title">{lang === 'en' ? 'Payment breakdown' : lang === 'es' ? 'Desglose de pagos' : lang === 'it' ? 'Ripartizione pagamenti' : 'Répartition paiements'}</div>
                {/* ⚠️ Le repli « Données de démonstration » a sauté avec le camembert
                    inventé qu'il annonçait. Il était MORT depuis longtemps : `Reports.tsx`
                    rend un état vide dès `salesData.length === 0`, 140 lignes plus haut,
                    donc ce composant n'est jamais monté sans ventes. Deux vestiges d'une
                    même croyance, dont l'un aurait resurgi au premier déplacement de la
                    garde — c'est la « justesse empruntée » du § spendGuard.
                    Ce sous-titre porte le DÉNOMINATEUR : il dit sur quoi portent les %. */}
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>
                  {`${salesData.length} ${lang === 'en' ? 'transactions' : lang === 'es' ? 'transacciones' : lang === 'it' ? 'transazioni' : 'transactions'}`}
                </div>
              </div>
            </div>
          </div>
          {/* ⚠️ TROIS états, jamais deux (§ La vérité vacante). Une période sans vente ne
              dessine pas un camembert vide : elle DIT qu'il n'y a rien à répartir. Un
              anneau à zéro part se lit comme un graphique cassé, pas comme une absence. */}
          {paymentData.length === 0 ? (
            <div style={{ padding: '28px 4px', color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
              {i('Aucune vente sur la période — rien à répartir.',
                 'No sales in this period — nothing to break down.',
                 'Sin ventas en el periodo — nada que desglosar.',
                 'Nessuna vendita nel periodo — nulla da ripartire.')}
            </div>
          ) : (
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {/* ⚠️ `dataKey="pct"` — et non un compte brut. Les `pct` somment à 100
                  exactement (plus forts restes), donc l'ANGLE que recharts calcule
                  (`pct / Σpct`) vaut `pct/100` : la géométrie et le chiffre écrit
                  dessus sont le même nombre, par construction et non par chance. */}
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie
                    activeIndex={activePayIndex ?? undefined}
                    activeShape={renderActiveShape}
                    data={paymentData}
                    cx="50%" cy="50%"
                    innerRadius={68} outerRadius={100}
                    paddingAngle={2} dataKey="pct"
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
                  <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '-1px' }}>
                    {paymentData.length}
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    {lang === 'en' ? 'modes' : lang === 'es' ? 'modos' : lang === 'it' ? 'modalità' : 'modes'}
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paymentData.map((item, i) => (
                <div key={i}
                  role="button" tabIndex={0}
                  aria-pressed={activePayIndex === i}
                  aria-label={`${item.name} — ${pctLabel(item)}, ${item.count} ${lang === 'en' ? 'sales' : lang === 'es' ? 'ventas' : lang === 'it' ? 'vendite' : 'ventes'}`}
                  onMouseEnter={() => setActivePayIndex(i)}
                  onMouseLeave={() => setActivePayIndex(null)}
                  /* Équivalent clic/clavier/tactile du highlight hover (le cursor:pointer était inerte) */
                  onClick={() => setActivePayIndex(activePayIndex === i ? null : i)}
                  onFocus={() => setActivePayIndex(i)}
                  onBlur={() => setActivePayIndex(null)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActivePayIndex(activePayIndex === i ? null : i) } }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: activePayIndex === i ? `${item.color}12` : 'var(--bg3)',
                    border: `1px solid ${activePayIndex === i ? item.color + '35' : 'var(--border)'}`,
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
                      fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-regular)',
                      color: activePayIndex === i ? 'var(--text)' : 'var(--text2)',
                      transition: 'color .15s',
                    }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-semibold)', color: item.color, fontFamily: 'var(--mono)', letterSpacing: '-0.5px' }}>
                      {pctLabel(item)}
                    </div>
                    {item.amount > 0 && (
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{fmt(item.amount)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
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
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
                {lang === 'en' ? 'No sales in this period' : lang === 'es' ? 'Sin ventas en el período' : lang === 'it' ? 'Nessuna vendita nel periodo' : 'Aucune vente sur la période'}
              </div>
            ) : topProducts.map(p => (
              <div key={p.rank} className="flex items-center gap-3 py-2"
                style={{ borderBottom: p.rank < topProducts.length ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: p.rank === 1 ? 'rgba(240,165,0,.2)' : p.rank === 2 ? 'rgba(136,134,168,.2)' : 'rgba(91,78,232,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)',
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
            <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Receipt size={14}/> {lang === 'en' ? 'Recent sales' : lang === 'es' ? 'Ventas recientes' : lang === 'it' ? 'Vendite recenti' : 'Ventes récentes'}</span>
          </div>
          <div className="table-wrap data-table">
            <table>
              <thead>
                <tr><th scope="col">{t('col_ref')}</th><th scope="col">{t('col_client')}</th><th scope="col">Mode</th><th scope="col" className="th-num">{t('col_amount')}</th></tr>
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
        <>
        {/* Rapports actionnables v1 — réappro + dormants (vraies données serveur) */}
        <InventoryInsights fmt={fmt} lang={lang} />
        {/* ⚠️ KPI RÉELS (voir ReportsLiveKpis). Ils affichaient auparavant « 142 articles /
            8 420 000 / 7 en rupture » — des littéraux — juste sous le bloc serveur ci-dessus
            qui annonçait « À réapprovisionner : 2 ». Le même écran se contredisait.
            ⚠️ SUPPRIMÉ avec : « Rotation des stocks — Top catégories », 5 catégories dont les
            pourcentages et montants étaient inventés. Aucune source ne les calcule aujourd'hui
            (il faudrait les ventes par catégorie sur la période) — un bloc absent est honnête,
            un bloc inventé ne l'est pas. À rétablir le jour où l'endpoint existe. */}
        <StockKpis fmt={fmt} i={i} />
        </>
      )}

      {/* ── Tab: Clients ── */}
      {/* ⚠️ Segments RÉELS, groupés par le juge unique des paliers (#215).
          Avant : « 45 grossistes / 31 détaillants / 13 directs » = 89 clients inventés (le
          tenant en a 5), et un panneau « Métriques fidélisation » entièrement fabriqué
          (rétention 68 %, panier 125 000, fréquence 2.4×/mois, NPS estimé 67).
          ⚠️ SUPPRIMÉ plutôt que rebranché : la rétention et le panier moyen sont calculés
          sur la page Clients avec une définition précise (fenêtre 90 j) — les recalculer ici
          autrement recréerait deux vérités. Le « NPS estimé » n'a AUCUNE source : aucune
          enquête n'est collectée, ce nombre ne pouvait être qu'inventé. */}
      {reportTab === 'clients' && (
        <ClientSegments fmt={fmt} i={i} lang={lang} />
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
                <span style={{ fontSize:'var(--fs-sm)', color:'var(--text2)' }}>{row.prefix && <span style={{ color:row.color, fontWeight:'var(--fw-regular)', marginRight:6 }}>{row.prefix}</span>}{row.label}</span>
                <span style={{ fontSize:'var(--fs-body)', fontWeight:'var(--fw-bold)', color:row.color, fontFamily:'var(--mono)' }}>{row.value}</span>
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
                <span style={{ fontSize:'var(--fs-sm)', color:'var(--text2)' }}>{r.label}</span>
                <span style={{ fontSize:'var(--fs-lg)', fontWeight:'var(--fw-semibold)', color:r.color, fontFamily:'var(--mono)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: RH ── */}
      {/* ⚠️ KPI RÉELS (effectif + masse salariale des employés ACTIFS, mêmes formules que
          HR.tsx:375-376). Avant : « 8 collaborateurs / 1 036,65 € / 94 % de présence » —
          littéraux — pour un tenant qui a 5 employés et 2 530,65 € de masse salariale.
          ⚠️ SUPPRIMÉ : le bloc « Équipe », qui listait CINQ EMPLOYÉS INVENTÉS (Amara Diallo,
          Fatou Sow, Omar Diop, Aïssatou Ba, Ibrahima Fall) avec salaires et statuts de
          présence fictifs, alors que les vrais employés sont à deux clics. Et le « Taux de
          présence » : les pointages existent (onglet Présences) mais par mois et par
          employé — les agréger demande une décision (période, absences justifiées) qui ne
          se prend pas dans un correctif d'affichage. Absent plutôt qu'inventé. */}
      {reportTab === 'rh' && (
        <HrKpis fmt={fmt} i={i} />
      )}
    </>
  )
}
