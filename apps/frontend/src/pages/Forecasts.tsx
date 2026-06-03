import { useState } from 'react'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { Package, Users, Zap, DollarSign, BarChart2, Lightbulb, MessageSquare, Bot, Copy, RefreshCw, Download, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import EmptyState from '@/components/ui/EmptyState'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { aiApi } from '@/lib/api'

// ── Component ─────────────────────────────────────────────────────────────────

export default function Forecasts() {
  const { lang, currency } = useAppStore()
  void currency
  const fmt = useFormatAmount()

  // ── IA Claude ──────────────────────────────────────────────────────────────
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiData,     setAiData]     = useState<any>(null)
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiType,     setAiType]     = useState<'full'|'stock'|'revenue'|'hr'>('full')
  const [aiError,    setAiError]    = useState<string | null>(null)

  const runAnalysis = async (type: 'full'|'stock'|'revenue'|'hr') => {
    setAiLoading(true)
    setAiError(null)
    setAiType(type)
    setAiAnalysis(null)
    try {
      const result = await aiApi.analyze(type, lang)
      setAiAnalysis(result.analysis)
      setAiData(result.data)
    } catch (err: any) {
      setAiError(err.message ?? 'Erreur IA')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-5 animate-in">

      {/* ── Panel HabaShop AI ────────────────────────────────────── */}
      <div className="panel" style={{
        background:'linear-gradient(135deg,rgba(91,78,232,.08),rgba(124,111,240,.04))',
        border:'1px solid rgba(91,78,232,.2)',
        marginBottom:14,
        padding:0, overflow:'hidden',
      }}>
        {/* Header redesigné */}
        <div style={{
          display:'flex', alignItems:'center',
          gap:14, padding:'20px 24px',
          borderBottom:'1px solid rgba(108,71,255,.15)',
          position:'relative', overflow:'hidden',
        }}>
          <div style={{
            position:'absolute', right:-20, top:-20,
            width:120, height:120, borderRadius:'50%',
            background:'radial-gradient(circle,rgba(108,71,255,.15),transparent 70%)',
            pointerEvents:'none',
          }}/>
          <div style={{
            width:56, height:56, borderRadius:16,
            background:'linear-gradient(135deg,#6C47FF,#A991FF)',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink:0,
            boxShadow:'0 8px 24px rgba(108,71,255,.4)',
            border:'1px solid var(--border)',
          }}><Bot size={28} style={{ color:'#fff' }}/></div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <h2 style={{ fontSize:20, fontWeight:900, color:'var(--text)', margin:0, letterSpacing:'-.3px' }}>
                HabaShop
                <span style={{
                  background:'linear-gradient(135deg,#6C47FF,#A991FF)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  backgroundClip:'text', marginLeft:6,
                }}>AI</span>
              </h2>
              <span style={{
                fontSize:9, fontWeight:800,
                background:'rgba(108,71,255,.2)', color:'var(--p3)',
                border:'1px solid rgba(108,71,255,.3)',
                borderRadius:99, padding:'2px 8px',
                textTransform:'uppercase', letterSpacing:'.6px',
              }}>BETA</span>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:'auto' }}>
                <div style={{
                  width:6, height:6, borderRadius:'50%',
                  background:'var(--acc2)', boxShadow:'0 0 8px var(--acc2)',
                }}/>
                <span style={{ fontSize:10, color:'var(--acc2)', fontWeight:600 }}>
                  {lang === 'en' ? 'Online' : lang === 'es' ? 'En línea' : lang === 'it' ? 'Online' : 'En ligne'}
                </span>
              </div>
              {aiAnalysis && (
                <button aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} className="mini-btn" style={{ marginLeft:8 }} onClick={() => { setAiAnalysis(null); setAiData(null) }}><X size={14}/></button>
              )}
            </div>
            <p style={{ fontSize:12, color:'var(--text3)', margin:0, lineHeight:1.5 }}>
              {lang === 'en' ? 'Your intelligent business assistant — Analyze your sales, stock, finances and get personalized recommendations.' : lang === 'es' ? 'Su asistente comercial inteligente — Analice sus ventas, stock, finanzas y obtenga recomendaciones personalizadas.' : lang === 'it' ? 'Il tuo assistente commerciale intelligente — Analizza vendite, stock, finanze e ottieni raccomandazioni personalizzate.' : 'Votre assistant commercial intelligent — Analysez vos ventes, stock, finances et obtenez des recommandations personnalisées.'}
            </p>
            <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
              {[
                { Icon: BarChart2,   label: lang === 'en' ? 'Sales analysis' : lang === 'es' ? 'Análisis de ventas' : lang === 'it' ? 'Analisi vendite' : 'Analyse ventes' },
                { Icon: Package,     label: lang === 'en' ? 'Stock forecast' : lang === 'es' ? 'Previsión de stock' : lang === 'it' ? 'Previsione stock' : 'Prévisions stock' },
                { Icon: Lightbulb,   label: lang === 'en' ? 'Recommendations' : lang === 'es' ? 'Recomendaciones' : lang === 'it' ? 'Raccomandazioni' : 'Recommandations' },
                { Icon: MessageSquare, label: lang === 'en' ? 'Free chat' : lang === 'es' ? 'Chat libre' : lang === 'it' ? 'Chat libero' : 'Chat libre' },
              ].map((cap, i) => (
                <span key={i} style={{
                  fontSize:10, fontWeight:600, color:'var(--text3)',
                  background:'var(--bg3)', border:'1px solid var(--border)',
                  borderRadius:20, padding:'2px 8px',
                  display:'flex', alignItems:'center', gap:4,
                }}>
                  <cap.Icon size={10} /> {cap.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Boutons types d'analyse redesignés */}
        <ResponsiveGrid min={200} gap={10} style={{ padding: '16px 24px' }}>
          {([
            { id:'full',    Icon: BarChart2,   color:'#6C47FF', label: lang === 'en' ? 'Monthly analysis' : lang === 'es' ? 'Análisis mensual' : lang === 'it' ? 'Analisi mensile' : 'Analyse mensuelle', desc: lang === 'en' ? 'Sales, trends, top products' : lang === 'es' ? 'Ventas, tendencias, top productos' : lang === 'it' ? 'Vendite, tendenze, top prodotti' : 'Ventes, tendances, top produits' },
            { id:'stock',   Icon: Package,     color:'#FF9500', label: lang === 'en' ? 'Stock analysis' : lang === 'es' ? 'Análisis de stock' : lang === 'it' ? 'Analisi stock' : 'Analyse stock', desc: lang === 'en' ? 'Stockouts, orders to place' : lang === 'es' ? 'Agotados, pedidos por hacer' : lang === 'it' ? 'Esauriti, ordini da effettuare' : 'Ruptures, commandes à passer' },
            { id:'revenue', Icon: DollarSign,  color:'#00D084', label: lang === 'en' ? 'Financial analysis' : lang === 'es' ? 'Análisis financiero' : lang === 'it' ? 'Analisi finanziaria' : 'Analyse financière', desc: lang === 'en' ? 'Revenue, expenses, cash flow' : lang === 'es' ? 'Ingresos, gastos, tesorería' : lang === 'it' ? 'Ricavi, spese, liquidità' : 'Revenus, dépenses, trésorerie' },
            { id:'hr',      Icon: Users,       color:'#00B8FF', label: lang === 'en' ? 'Customer analysis' : lang === 'es' ? 'Análisis de clientes' : lang === 'it' ? 'Analisi clienti' : 'Analyse clients', desc: lang === 'en' ? 'Loyalty, segments, behavior' : lang === 'es' ? 'Fidelidad, segmentos, comportamiento' : lang === 'it' ? 'Fedeltà, segmenti, comportamento' : 'Fidélité, segments, comportement' },
          ] as { id: 'full'|'stock'|'revenue'|'hr'; Icon: typeof BarChart2; color: string; label: string; desc: string }[]).map(btn => (
            <button key={btn.id}
              onClick={() => runAnalysis(btn.id)}
              disabled={aiLoading}
              style={{
                display:'flex', alignItems:'flex-start', gap:10, padding:'14px',
                background: aiType === btn.id && aiAnalysis ? `${btn.color}18` : `${btn.color}0D`,
                border: `1px solid ${aiType === btn.id && aiAnalysis ? `${btn.color}40` : `${btn.color}25`}`,
                borderRadius:14, cursor: aiLoading ? 'not-allowed' : 'pointer',
                fontFamily:'var(--font)', transition:'all .15s', textAlign:'left',
                opacity: aiLoading ? .5 : 1,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = `${btn.color}18`
                el.style.borderColor = `${btn.color}40`
                el.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = aiType === btn.id && aiAnalysis ? `${btn.color}18` : `${btn.color}0D`
                el.style.borderColor = aiType === btn.id && aiAnalysis ? `${btn.color}40` : `${btn.color}25`
                el.style.transform = 'none'
              }}
            >
              <div style={{
                width:38, height:38, borderRadius:11,
                background:`${btn.color}18`, border:`1px solid ${btn.color}25`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color: btn.color, flexShrink:0,
              }}><btn.Icon size={18} /></div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', marginBottom:2 }}>{btn.label}</div>
                <div style={{ fontSize:10, color:'var(--text3)', lineHeight:1.4 }}>{btn.desc}</div>
              </div>
            </button>
          ))}
        </ResponsiveGrid>

        {/* Loading */}
        {aiLoading && (
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'24px', margin:'0 24px 16px',
            background:'var(--bg3)',
            borderRadius:12, border:'1px solid var(--border)',
          }}>
            <div style={{
              width:40, height:40, borderRadius:'50%',
              border:'3px solid var(--border)',
              borderTopColor:'var(--p2)',
              animation:'spin 1s linear infinite',
              flexShrink:0,
            }} />
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
                {lang === 'fr' ? '🤖 Claude analyse vos données...'
                  : lang === 'en' ? '🤖 Claude is analyzing your data...'
                  : lang === 'es' ? '🤖 Claude analiza sus datos...'
                  : '🤖 Claude analizza i dati...'}
              </div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>
                {lang === 'en' ? 'Sales, stock, finances, HR — analysis in progress' : lang === 'es' ? 'Ventas, stock, finanzas, RRHH — análisis en curso' : lang === 'it' ? 'Vendite, stock, finanze, HR — analisi in corso' : 'Ventes, stock, finances, RH — analyse en cours'}
              </div>
            </div>
          </div>
        )}

        {/* Erreur */}
        {aiError && !aiLoading && (
          <div style={{
            padding:'14px 16px', margin:'0 24px 16px',
            background:'rgba(232,64,74,.08)', border:'1px solid rgba(232,64,74,.2)',
            borderRadius:10, fontSize:13, color:'var(--danger)',
          }}>
            <AlertCircle size={14} style={{ flexShrink:0 }}/> {aiError}
          </div>
        )}

        {/* Résultat */}
        {aiAnalysis && !aiLoading && (
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'20px 24px', margin:'0 24px 24px' }}>
            {/* KPIs rapides */}
            {aiData && (
              <ResponsiveGrid min={140} gap={10} style={{ marginBottom: 20 }}>
                {[
                  { label: lang === 'en' ? 'Monthly revenue' : lang === 'es' ? 'Ingresos del mes' : lang === 'it' ? 'Ricavi del mese' : 'CA du mois', value:fmt(aiData.totalRevenue), color:'var(--acc2)' },
                  { label: lang === 'en' ? 'Transactions' : lang === 'es' ? 'Transacciones' : lang === 'it' ? 'Transazioni' : 'Transactions',   value:aiData.totalSales,        color:'var(--p2)'  },
                  { label: lang === 'en' ? 'Margin' : lang === 'es' ? 'Margen' : lang === 'it' ? 'Margine' : 'Marge',               value:aiData.margin + ' %',     color: parseFloat(aiData.margin) > 20 ? 'var(--acc2)' : 'var(--acc)' },
                  { label: lang === 'en' ? 'Low stock' : lang === 'es' ? 'Agotados' : lang === 'it' ? 'Esauriti' : 'Ruptures',         value:aiData.lowStockCount,     color: aiData.lowStockCount > 0 ? 'var(--danger)' : 'var(--acc2)' },
                ].map(kpi => (
                  <div key={kpi.label} style={{
                    background:'var(--bg4)', border:'1px solid var(--border)',
                    borderRadius:10, padding:'10px 12px', textAlign:'center',
                  }}>
                    <div style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>{kpi.label}</div>
                    <div style={{ fontSize:16, fontWeight:900, color:kpi.color, fontFamily:'var(--mono)' }}>{kpi.value}</div>
                  </div>
                ))}
              </ResponsiveGrid>
            )}

            {/* Texte analyse */}
            <MarkdownRenderer content={aiAnalysis} />

            {/* Actions */}
            <div style={{ display:'flex', gap:8, marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="mini-btn" style={{ display:'flex', alignItems:'center', gap:5 }} onClick={() => {
                navigator.clipboard.writeText(aiAnalysis)
                toast.success(lang === 'en' ? 'Copied!' : lang === 'es' ? '¡Copiado!' : lang === 'it' ? 'Copiato!' : 'Copié !')
              }}><Copy size={13}/> {lang === 'en' ? 'Copy' : lang === 'es' ? 'Copiar' : lang === 'it' ? 'Copia' : 'Copier'}</button>
              <button className="mini-btn" style={{ display:'flex', alignItems:'center', gap:5 }} onClick={() => runAnalysis(aiType)}>
                <RefreshCw size={13}/> {lang === 'en' ? 'Regenerate' : lang === 'es' ? 'Regenerar' : lang === 'it' ? 'Rigenera' : 'Régénérer'}
              </button>
              <button className="mini-btn" style={{ display:'flex', alignItems:'center', gap:5 }} onClick={() => {
                const blob = new Blob([aiAnalysis], { type:'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `HabaShop-AI-${aiType}-${new Date().toISOString().split('T')[0]}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}><Download size={13}/> {lang === 'en' ? 'Download' : lang === 'es' ? 'Descargar' : lang === 'it' ? 'Scarica' : 'Télécharger'}</button>
            </div>
          </div>
        )}

        {/* État initial */}
        {!aiAnalysis && !aiLoading && !aiError && (
          <div style={{ textAlign:'center', padding:'24px 24px 32px', color:'var(--text3)' }}>
            <Bot size={32} style={{ color:'var(--text3)', marginBottom:12 }}/>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text2)', marginBottom:6 }}>
              {lang === 'fr' ? "Choisissez un type d'analyse"
                : lang === 'en' ? 'Choose an analysis type'
                : lang === 'es' ? 'Elija un tipo de análisis'
                : 'Scegli un tipo di analisi'}
            </div>
            <div style={{ fontSize:12 }}>
              {lang === 'fr' ? 'Claude analysera vos vraies données PostgreSQL'
                : lang === 'en' ? 'Claude will analyze your real PostgreSQL data'
                : lang === 'es' ? 'Claude analizará sus datos reales de PostgreSQL'
                : 'Claude analizzerà i dati reali PostgreSQL'}
            </div>
          </div>
        )}
      </div>

      {/* ── Prévisions automatiques ──────────────────────────────── */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Zap size={14}/> {lang === 'en' ? 'Automatic forecasts' : lang === 'es' ? 'Previsiones automáticas' : lang === 'it' ? 'Previsioni automatiche' : 'Prévisions automatiques'}</span>
        </div>
        <EmptyState
          icon="🔮"
          title={lang === 'en' ? 'No forecasts yet' : lang === 'es' ? 'Aún no hay previsiones' : lang === 'it' ? 'Ancora nessuna previsione' : 'Pas encore de prévisions'}
          message={lang === 'en' ? 'Sales, stock and cash-flow forecasts are generated automatically after 30 days of sales. In the meantime, use HabaShop AI above to analyze your data.' : lang === 'es' ? 'Las previsiones de ventas, stock y tesorería se generan automáticamente tras 30 días de ventas. Mientras tanto, use HabaShop AI arriba para analizar sus datos.' : lang === 'it' ? 'Le previsioni di vendite, stock e liquidità si generano automaticamente dopo 30 giorni di vendite. Nel frattempo, usa HabaShop AI qui sopra per analizzare i tuoi dati.' : 'Les prévisions de ventes, stock et trésorerie se génèrent automatiquement après 30 jours de ventes. En attendant, utilisez HabaShop AI ci-dessus pour analyser vos données.'}
        />
      </div>

    </div>
  )
}
