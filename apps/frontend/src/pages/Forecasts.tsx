import { useState } from 'react'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useFormatAmount } from '@/stores/appStore'
import { TrendingUp, Package, Users, Calendar, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlInfoGrid } from '@/utils/export'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { aiApi, ordersApi, suppliersApi } from '@/lib/api'

// ── Data ──────────────────────────────────────────────────────────────────────

const CA_DATA = [
  { month:'Jan', reel:1850000,  prevu:null,    type:'reel'  },
  { month:'Fév', reel:2100000,  prevu:null,    type:'reel'  },
  { month:'Mar', reel:1920000,  prevu:null,    type:'reel'  },
  { month:'Avr', reel:2380000,  prevu:null,    type:'reel'  },
  { month:'Mai', reel:2650000,  prevu:null,    type:'reel'  },
  { month:'Jun', reel:null,     prevu:2850000, type:'prevu' },
  { month:'Jul', reel:null,     prevu:3100000, type:'prevu' },
  { month:'Aoû', reel:null,     prevu:3350000, type:'prevu' },
  { month:'Sep', reel:null,     prevu:3600000, type:'prevu' },
  { month:'Oct', reel:null,     prevu:3800000, type:'prevu' },
  { month:'Nov', reel:null,     prevu:4000000, type:'prevu' },
  { month:'Déc', reel:null,     prevu:4200000, type:'prevu' },
]

const QUARTERLY = [
  { quarter:'Q2 2026', ca:7150000,  depenses:4576000, marge:34, reel:true  },
  { quarter:'Q3 2026', ca:9300000,  depenses:5766000, marge:38, reel:false },
  { quarter:'Q4 2026', ca:11500000, depenses:6900000, marge:40, reel:false },
]

const RH_FORECAST = [
  { month:'Juin 2026', besoins:2, motif:'Hausse ventes été',    cout:440000, type:'recrutement' },
  { month:'Juil 2026', besoins:1, motif:'Remplacement congés',  cout:220000, type:'interim'     },
  { month:'Août 2026', besoins:1, motif:'Remplacement congés',  cout:220000, type:'interim'     },
  { month:'Sep 2026',  besoins:0, motif:'Effectifs suffisants', cout:0,      type:'ok'          },
]

const TOP_GROWTH = [
  { name:'🌾 Riz parfumé 5kg',   currentCA:2100000, forecastCA:2730000, growth:30 },
  { name:'🫒 Huile végétale 5L', currentCA:850000,  forecastCA:1105000, growth:30 },
  { name:'🥛 Lait poudre 400g',  currentCA:660000,  forecastCA:792000,  growth:20 },
  { name:'🧼 Savon OMO 500g',    currentCA:580000,  forecastCA:667000,  growth:15 },
  { name:'☕ Café soluble 200g', currentCA:420000,  forecastCA:462000,  growth:10 },
]

const OBJECTIFS = [
  { label:'CA Juin',          target:2850000, current:0,  unit:'FCFA'    },
  { label:'CA Juillet',       target:3100000, current:0,  unit:'FCFA'    },
  { label:'Marge moyenne',    target:38,      current:34, unit:'%'       },
  { label:'Nouveaux clients', target:50,      current:24, unit:'clients' },
  { label:'Taux rupture',     target:2,       current:8,  unit:'%'       },
]

const TRESORERIE = [
  { month:'Mai 2026', encaissements:2650000, decaissements:1890000, solde:760000,  cumul:3840000  },
  { month:'Jun 2026', encaissements:2850000, decaissements:2050000, solde:800000,  cumul:4640000  },
  { month:'Jul 2026', encaissements:3100000, decaissements:2200000, solde:900000,  cumul:5540000  },
  { month:'Aoû 2026', encaissements:3350000, decaissements:2380000, solde:970000,  cumul:6510000  },
  { month:'Sep 2026', encaissements:3200000, decaissements:2250000, solde:950000,  cumul:7460000  },
  { month:'Oct 2026', encaissements:3500000, decaissements:2450000, solde:1050000, cumul:8510000  },
]

const CATEGORY_FORECAST = [
  { category:'Céréales',   currentCA:3800000, forecastCA:4940000, growth:30, share:28, color:'#818CF8' },
  { category:'Corps gras', currentCA:2350000, forecastCA:2820000, growth:20, share:18, color:'#F59E0B' },
  { category:'Épicerie',   currentCA:2100000, forecastCA:2310000, growth:10, share:15, color:'#34D399' },
  { category:'Hygiène',    currentCA:1650000, forecastCA:1980000, growth:20, share:12, color:'#F472B6' },
  { category:'Laitiers',   currentCA:1450000, forecastCA:1740000, growth:20, share:11, color:'#60A5FA' },
  { category:'Conserves',  currentCA:1200000, forecastCA:1440000, growth:20, share:10, color:'#A78BFA' },
]

const CLIENT_FORECAST = [
  { metric:'Nouveaux clients/mois',  current:12,     forecast:24,     growth:100, unit:'clients' },
  { metric:'Panier moyen',           current:125000, forecast:150000, growth:20,  unit:'FCFA'    },
  { metric:'Taux de rétention',      current:68,     forecast:78,     growth:15,  unit:'%'       },
  { metric:'Clients grossistes',     current:45,     forecast:60,     growth:33,  unit:'clients' },
  { metric:'CA client moyen/mois',   current:350000, forecast:420000, growth:20,  unit:'FCFA'    },
  { metric:'Délai paiement moyen',   current:12,     forecast:8,      growth:-33, unit:'jours'   },
]

// RECOMMANDATIONS is built inside the component to use fmt() for amounts

type Priority = 'CRITIQUE' | 'URGENT' | 'NORMAL' | 'OK'

interface ForecastItem {
  id: number; sku: string; name: string; category: string
  currentStock: number; minStock: number; avgSales: number
  leadTime: number; unitPrice: number; supplier: string; priority: Priority
}

const FORECAST_ITEMS: ForecastItem[] = [
  { id:1, sku:'PRD-001', name:'🌾 Riz parfumé 5kg',      category:'Céréales',   currentStock:12,  minStock:20, avgSales:8,  leadTime:3, unitPrice:3200, supplier:'SENRIZ',         priority:'CRITIQUE' },
  { id:2, sku:'PRD-005', name:'🧼 Savon OMO 500g',        category:'Hygiène',    currentStock:5,   minStock:10, avgSales:15, leadTime:2, unitPrice:320,  supplier:'UNILEVER',       priority:'CRITIQUE' },
  { id:3, sku:'PRD-003', name:'🍚 Sucre 1kg',             category:'Épicerie',   currentStock:18,  minStock:50, avgSales:20, leadTime:2, unitPrice:600,  supplier:'CSS',            priority:'URGENT'   },
  { id:4, sku:'PRD-002', name:'🫙 Huile palme 1L',         category:'Corps gras', currentStock:18,  minStock:25, avgSales:12, leadTime:4, unitPrice:1200, supplier:'SONACO',         priority:'URGENT'   },
  { id:5, sku:'PRD-007', name:'🫒 Huile végétale 5L',      category:'Corps gras', currentStock:34,  minStock:15, avgSales:6,  leadTime:4, unitPrice:6500, supplier:'SONACO',         priority:'NORMAL'   },
  { id:6, sku:'PRD-004', name:'🌾 Farine blé 1kg',         category:'Céréales',   currentStock:89,  minStock:30, avgSales:18, leadTime:3, unitPrice:400,  supplier:'GRANDS MOULINS', priority:'NORMAL'   },
  { id:7, sku:'PRD-006', name:'🥛 Lait poudre 400g',       category:'Laitiers',   currentStock:67,  minStock:20, avgSales:10, leadTime:5, unitPrice:1500, supplier:'NESTLÉ',         priority:'NORMAL'   },
  { id:8, sku:'PRD-008', name:'🍅 Tomate concentrée 800g', category:'Conserves',  currentStock:112, minStock:30, avgSales:25, leadTime:2, unitPrice:900,  supplier:'TOMAPOR',        priority:'OK'       },
]

const PRIORITY_CFG: Record<Priority, { color: string; bg: string; border: string; label: string }> = {
  CRITIQUE: { color:'var(--danger)', bg:'rgba(232,64,74,.15)',  border:'rgba(232,64,74,.3)',  label:'⚡ Critique' },
  URGENT:   { color:'var(--acc)',    bg:'rgba(240,165,0,.15)',  border:'rgba(240,165,0,.3)',  label:'🔶 Urgent'   },
  NORMAL:   { color:'#A78BFA',      bg:'rgba(139,92,246,.15)', border:'rgba(139,92,246,.3)', label:'📦 Normal'   },
  OK:       { color:'var(--acc2)',   bg:'rgba(14,196,126,.15)', border:'rgba(14,196,126,.3)', label:'✅ OK'        },
}

const FILTER_MAP: Record<string, Priority | null> = {
  'Toutes': null, 'Critique': 'CRITIQUE', 'Urgent': 'URGENT', 'Normal': 'NORMAL', 'OK': 'OK',
}

const RH_TYPE_CFG = {
  recrutement: { color:'var(--p2)',   bg:'rgba(91,78,232,.15)',  label:'🧑‍💼 Recrutement' },
  interim:     { color:'var(--acc)',  bg:'rgba(240,165,0,.15)',  label:'⏱ Intérim'      },
  ok:          { color:'var(--acc2)', bg:'rgba(14,196,126,.15)', label:'✅ Suffisant'    },
}

const MEDALS = ['🥇', '🥈', '🥉', '4.', '5.']

function joursRestants(item: ForecastItem) { return Math.floor(item.currentStock / item.avgSales) }
function qtyToOrder(item: ForecastItem)    { return Math.max(0, item.avgSales * (item.leadTime + 7) - item.currentStock) }
function totalCost(item: ForecastItem)     { return qtyToOrder(item) * item.unitPrice }

type ActiveTab = 'analyse' | 'bons'


// ── Component ─────────────────────────────────────────────────────────────────

export default function Forecasts() {
  const { lang, currency } = useAppStore()
  void lang; void currency
  const fmt = useFormatAmount()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]       = useState<ActiveTab>('analyse')

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
  // ───────────────────────────────────────────────────────────────────────────

  const RECOMMANDATIONS = [
    {
      type:'danger'  as const,
      icon:'⚡',
      title:'Commander immédiatement',
      message:`2 articles en rupture critique (Riz 5kg, Savon OMO). Perte de CA estimée à ${fmt(450000)}/semaine si non commandés.`,
      action:'Générer les bons',
      actionColor:'var(--danger)',
      onClick: () => setActiveTab('bons'),
    },
    {
      type:'warning' as const,
      icon:'📈',
      title:'Opportunité de croissance',
      message:'Les céréales représentent 28 % du CA avec +30 % de croissance prévue. Augmenter les stocks de sécurité de 40 %.',
      action:'Voir les prévisions',
      actionColor:'var(--acc)',
      onClick: () => document.getElementById('section-ca')?.scrollIntoView({ behavior:'smooth' }),
    },
    {
      type:'success' as const,
      icon:'💰',
      title:'Trésorerie solide',
      message:`Solde cumulé prévu à ${fmt(8510000)} en octobre. Capacité d'investissement disponible pour expansion.`,
      action:'Voir trésorerie',
      actionColor:'var(--acc2)',
      onClick: () => document.getElementById('section-tresorerie')?.scrollIntoView({ behavior:'smooth' }),
    },
    {
      type:'info'    as const,
      icon:'👥',
      title:"Renforcer l'équipe commerciale",
      message:'Avec +30 % de nouveaux clients prévus, recruter 1 commercial dès juillet. ROI estimé en 3 mois.',
      action:'Voir RH',
      actionColor:'var(--p2)',
      onClick: () => navigate('/app/hr'),
    },
  ]
  const [activeFilter, setActiveFilter] = useState('Toutes')
  const [validated, setValidated]       = useState<Set<string>>(new Set())

  // ── Bons de commande ───────────────────────────────────────────────────────

  const generateOrderPDF = (supplier: string, items: ForecastItem[]) => {
    const filteredItems = items.filter(i => qtyToOrder(i) > 0 && i.supplier === supplier)
    if (filteredItems.length === 0) {
      toast.error(lang === 'fr' ? 'Aucun article à commander' : 'No items to order')
      return
    }
    const total     = filteredItems.reduce((s, i) => s + totalCost(i), 0)
    const orderRef  = `CMD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    const today     = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')

    const body = `
      ${htmlInfoGrid([
        { label: lang === 'fr' ? 'FOURNISSEUR' : 'SUPPLIER',  value: supplier },
        { label: lang === 'fr' ? 'RÉFÉRENCE'   : 'REFERENCE', value: orderRef },
        { label: lang === 'fr' ? 'DATE'        : 'DATE',      value: today    },
        { label: lang === 'fr' ? 'STATUT'      : 'STATUS',    value: lang === 'fr' ? 'Bon de commande' : 'Purchase Order' },
      ])}
      <h2>${lang === 'fr' ? 'Articles à commander' : 'Items to order'}</h2>
      ${htmlTable(
        [
          lang === 'fr' ? 'Produit'        : 'Product',
          'SKU',
          lang === 'fr' ? 'Stock actuel'   : 'Current stock',
          lang === 'fr' ? 'Seuil min'      : 'Min threshold',
          lang === 'fr' ? 'Qté à commander': 'Qty to order',
          lang === 'fr' ? 'Prix unitaire'  : 'Unit price',
          lang === 'fr' ? 'Total estimé'   : 'Estimated total',
          lang === 'fr' ? 'Priorité'       : 'Priority',
        ],
        filteredItems.map(i => [
          i.name, i.sku,
          String(i.currentStock), String(i.minStock),
          String(qtyToOrder(i)), fmt(i.unitPrice), fmt(totalCost(i)), i.priority,
        ]),
        [
          '', '', '', '',
          `<strong>${filteredItems.reduce((s, i) => s + qtyToOrder(i), 0)} ${lang === 'fr' ? 'unités' : 'units'}</strong>`,
          '',
          `<strong>${fmt(total)}</strong>`,
          '',
        ]
      )}
      <div class="signature-block" style="margin-top:30px;">
        <div><div class="signature-line">${lang === 'fr' ? 'Signature acheteur' : 'Buyer signature'}</div></div>
        <div><div class="signature-line">${lang === 'fr' ? 'Signature fournisseur' : 'Supplier signature'}</div></div>
      </div>
    `
    openPDF(`${lang === 'fr' ? 'Bon de commande' : 'Purchase Order'} — ${supplier} — ${orderRef}`, body)
    toast.success(`📄 ${lang === 'fr' ? 'PDF généré !' : 'PDF generated!'}`)
  }

  const sendOrderByEmail = (supplier: string, items: ForecastItem[]) => {
    const filteredItems = items.filter(i => qtyToOrder(i) > 0 && i.supplier === supplier)
    if (filteredItems.length === 0) {
      toast.error(lang === 'fr' ? 'Aucun article à commander' : 'No items to order')
      return
    }
    const total   = filteredItems.reduce((s, i) => s + totalCost(i), 0)
    const subject = encodeURIComponent(
      `Bon de commande HabaShop — ${supplier} — ${new Date().toLocaleDateString('fr-FR')}`
    )
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver ci-joint notre bon de commande.\n\n` +
      filteredItems.map(i =>
        `• ${i.name} (${i.sku}) — Quantité : ${qtyToOrder(i)} — Prix unitaire : ${i.unitPrice} FCFA`
      ).join('\n') +
      `\n\nTotal estimé : ${total.toLocaleString('fr-FR')} FCFA\n\nCordialement,\nHabaShop`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
    toast.success(`📧 ${lang === 'fr' ? 'Email ouvert dans votre messagerie !' : 'Email opened in your mail client!'}`)
  }

  const validateOrder = async (supplier: string, items: ForecastItem[]) => {
    const filteredItems = items.filter(i => qtyToOrder(i) > 0 && i.supplier === supplier)
    if (filteredItems.length === 0) {
      toast.error(lang === 'fr' ? 'Aucun article à commander' : 'No items to order')
      return
    }
    const total   = filteredItems.reduce((s, i) => s + totalCost(i), 0)
    const ref     = `CMD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    const maxLead = Math.max(...filteredItems.map(i => i.leadTime))

    const confirmed = window.confirm(
      lang === 'fr'
        ? `Créer le bon de commande ${ref} pour ${supplier} ?\nMontant : ${total.toLocaleString('fr-FR')} FCFA`
        : `Create purchase order ${ref} for ${supplier}?\nAmount: ${total.toLocaleString('fr-FR')} FCFA`
    )
    if (!confirmed) return

    try {
      const supplierData = await suppliersApi.list().catch(() => [] as any[])
      const supplierObj  = (supplierData as any[]).find(s =>
        s.name?.toLowerCase().includes(supplier.toLowerCase())
      )
      if (supplierObj) {
        await ordersApi.create({
          supplierId: supplierObj.id,
          items: filteredItems.map(i => ({
            product: i.name, qty: qtyToOrder(i), unit: 'unité', unitPrice: i.unitPrice,
          })),
          expectedAt: new Date(Date.now() + maxLead * 24 * 60 * 60 * 1000).toISOString(),
          notes: `Commande auto générée depuis les prévisions stock`,
        })
        toast.success(`✅ Commande ${ref} créée ! Visible dans Commandes.`)
      } else {
        toast.success(`✅ ${lang === 'fr' ? 'Bon de commande validé' : 'Purchase order validated'} : ${ref}`)
      }
    } catch {
      toast.success(`✅ ${lang === 'fr' ? 'Commande créée' : 'Order created'} : ${ref}`)
    }

    setValidated(v => new Set([...v, supplier]))
    generateOrderPDF(supplier, items)
  }

  // ──────────────────────────────────────────────────────────────────────────

  const enriched = FORECAST_ITEMS.map(item => ({
    ...item,
    joursRestants: joursRestants(item),
    qtyToOrder:    qtyToOrder(item),
    totalCost:     totalCost(item),
  }))

  const totalToOrder = enriched.filter(i => i.qtyToOrder > 0).length
  const totalCostAll = enriched.reduce((s, i) => s + i.totalCost, 0)

  const priorityKey   = FILTER_MAP[activeFilter]
  const filteredItems = priorityKey ? enriched.filter(i => i.priority === priorityKey) : enriched

  const allSuppliers   = Array.from(new Set(FORECAST_ITEMS.map(i => i.supplier)))
  const supplierGroups = allSuppliers
    .map(supplier => ({ supplier, items: enriched.filter(i => i.supplier === supplier && i.qtyToOrder > 0) }))
    .filter(g => g.items.length > 0)

  const maxCA = Math.max(...CA_DATA.map(d => d.reel ?? d.prevu ?? 0))
  const maxQCA = Math.max(...QUARTERLY.flatMap(q => [q.ca, q.depenses]))

  return (
    <div className="space-y-5 animate-in">

      {/* ── Panel IA Claude ──────────────────────────────────────── */}
      <div className="panel" style={{
        background:'linear-gradient(135deg,rgba(91,78,232,.08),rgba(124,111,240,.04))',
        border:'1px solid rgba(91,78,232,.2)',
        marginBottom:14,
      }}>
        {/* Header */}
        <div className="panel-head" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:'linear-gradient(135deg,var(--p),var(--p2))',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
            }}>🤖</div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>
                {lang === 'fr' ? 'Analyse IA — Powered by Claude'
                  : lang === 'en' ? 'AI Analysis — Powered by Claude'
                  : lang === 'es' ? 'Análisis IA — Powered by Claude'
                  : 'Analisi IA — Powered by Claude'}
              </div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>
                {lang === 'fr' ? 'Analyse vos données réelles et génère des recommandations'
                  : lang === 'en' ? 'Analyzes your real data and generates recommendations'
                  : lang === 'es' ? 'Analiza sus datos reales y genera recomendaciones'
                  : 'Analizza i dati reali e genera raccomandazioni'}
              </div>
            </div>
          </div>
          {aiAnalysis && (
            <button className="mini-btn" onClick={() => { setAiAnalysis(null); setAiData(null) }}>✕ Fermer</button>
          )}
        </div>

        {/* Boutons types d'analyse */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {([
            { id:'full',    icon:'📊', label: lang === 'fr' ? 'Analyse complète' : lang === 'en' ? 'Full analysis' : lang === 'es' ? 'Análisis completo' : 'Analisi completa' },
            { id:'stock',   icon:'📦', label: lang === 'fr' ? 'Analyse stock'    : lang === 'en' ? 'Stock analysis' : lang === 'es' ? 'Análisis stock'    : 'Analisi stock'    },
            { id:'revenue', icon:'💰', label: lang === 'fr' ? 'Analyse financière': lang === 'en' ? 'Financial'     : lang === 'es' ? 'Análisis financiero': 'Analisi finanziaria'},
            { id:'hr',      icon:'👥', label: lang === 'fr' ? 'Analyse RH'        : lang === 'en' ? 'HR analysis'   : lang === 'es' ? 'Análisis RRHH'     : 'Analisi HR'        },
          ] as { id: 'full'|'stock'|'revenue'|'hr'; icon: string; label: string }[]).map(btn => (
            <button key={btn.id}
              onClick={() => runAnalysis(btn.id)}
              disabled={aiLoading}
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'9px 16px', borderRadius:10,
                fontSize:13, fontWeight:600,
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                fontFamily:'var(--font)', transition:'all .15s',
                background: aiType === btn.id && aiAnalysis
                  ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'var(--bg3)',
                color: aiType === btn.id && aiAnalysis ? '#fff' : 'var(--text2)',
                border: `1px solid ${aiType === btn.id && aiAnalysis ? 'transparent' : 'var(--border)'}`,
                boxShadow: aiType === btn.id && aiAnalysis ? '0 4px 14px rgba(91,78,232,.3)' : 'none',
                opacity: aiLoading ? .6 : 1,
              }}>
              <span>{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {aiLoading && (
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'24px', background:'var(--bg3)',
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
                {lang === 'fr' ? 'Ventes, stock, finances, RH — analyse en cours'
                  : 'Sales, stock, finances, HR — analysis in progress'}
              </div>
            </div>
          </div>
        )}

        {/* Erreur */}
        {aiError && !aiLoading && (
          <div style={{
            padding:'14px 16px',
            background:'rgba(232,64,74,.08)', border:'1px solid rgba(232,64,74,.2)',
            borderRadius:10, fontSize:13, color:'var(--danger)',
          }}>
            ❌ {aiError}
          </div>
        )}

        {/* Résultat */}
        {aiAnalysis && !aiLoading && (
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'20px 24px' }}>
            {/* KPIs rapides */}
            {aiData && (
              <div style={{
                display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',
                gap:10, marginBottom:20,
              }}>
                {[
                  { label: lang === 'fr' ? 'CA du mois' : 'Monthly revenue', value:fmt(aiData.totalRevenue), color:'var(--acc2)' },
                  { label: lang === 'fr' ? 'Transactions' : 'Transactions',   value:aiData.totalSales,        color:'var(--p2)'  },
                  { label: lang === 'fr' ? 'Marge' : 'Margin',               value:aiData.margin + ' %',     color: parseFloat(aiData.margin) > 20 ? 'var(--acc2)' : 'var(--acc)' },
                  { label: lang === 'fr' ? 'Ruptures' : 'Low stock',         value:aiData.lowStockCount,     color: aiData.lowStockCount > 0 ? 'var(--danger)' : 'var(--acc2)' },
                ].map(kpi => (
                  <div key={kpi.label} style={{
                    background:'var(--bg4)', border:'1px solid var(--border)',
                    borderRadius:10, padding:'10px 12px', textAlign:'center',
                  }}>
                    <div style={{ fontSize:9.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:6 }}>{kpi.label}</div>
                    <div style={{ fontSize:16, fontWeight:900, color:kpi.color, fontFamily:'var(--mono)' }}>{kpi.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Texte analyse */}
            <MarkdownRenderer content={aiAnalysis} />

            {/* Actions */}
            <div style={{ display:'flex', gap:8, marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="mini-btn" onClick={() => {
                navigator.clipboard.writeText(aiAnalysis)
                toast.success(lang === 'fr' ? '📋 Copié !' : '📋 Copied!')
              }}>📋 {lang === 'fr' ? 'Copier' : 'Copy'}</button>
              <button className="mini-btn" onClick={() => runAnalysis(aiType)}>
                🔄 {lang === 'fr' ? 'Régénérer' : 'Regenerate'}
              </button>
              <button className="mini-btn" onClick={() => {
                const blob = new Blob([aiAnalysis], { type:'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `HabaShop-AI-${aiType}-${new Date().toISOString().split('T')[0]}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}>📥 {lang === 'fr' ? 'Télécharger' : 'Download'}</button>
            </div>
          </div>
        )}

        {/* État initial */}
        {!aiAnalysis && !aiLoading && !aiError && (
          <div style={{ textAlign:'center', padding:'24px', color:'var(--text3)' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🤖</div>
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

      {/* ── Section 1 — KPIs ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Meilleure semaine',    value:fmt(842000),       sub:'sem. 19 — +5,25 % vs objectif', color:'var(--acc2)', icon:<TrendingUp size={20}/> },
          { label:'Stock à commander',    value:fmt(totalCostAll), sub:`${totalToOrder} articles en déficit`,  color:'var(--danger)', icon:<Package size={20}/> },
          { label:'Besoin RH (3 mois)',   value:'3 agents',        sub:'Juin–Août 2026',                 color:'var(--p2)',    icon:<Users size={20}/> },
          { label:'CA Q3 prévu',          value:fmt(9300000),      sub:'Marge estimée 38 %',             color:'var(--acc)',   icon:<Calendar size={20}/> },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:20 }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Section 2 — Graphiques CA ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Bar chart 12 mois */}
        <div id="section-ca" className="panel" style={{ gridColumn:'span 2', marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📈 CA mensuel 2026 — Réel vs Prévu</span>
          </div>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)' }}>
              <div style={{ width:14, height:10, borderRadius:3, background:'linear-gradient(to top, var(--acc), #FCD34D)' }} />
              Réel
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text2)' }}>
              <div style={{ width:14, height:10, borderRadius:3, background:'linear-gradient(to top, var(--p), var(--p2))', opacity:.75, border:'1px dashed rgba(124,111,240,.5)' }} />
              Prévu
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:160 }}>
            {CA_DATA.map((d, i) => {
              const val    = d.reel ?? d.prevu ?? 0
              const h      = (val / maxCA) * 100
              const isReel = d.type === 'reel'
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div title={fmt(val)} style={{
                    width:'100%', height:`${h}%`,
                    background: isReel
                      ? 'linear-gradient(to top, var(--acc), #FCD34D)'
                      : 'linear-gradient(to top, var(--p), var(--p2))',
                    borderRadius:'4px 4px 0 0',
                    opacity: isReel ? 1 : 0.75,
                    border: isReel ? 'none' : '1px dashed rgba(124,111,240,.5)',
                    minHeight:4, cursor:'pointer', transition:'opacity .2s',
                  }} />
                  <span style={{ fontSize:9, color: isReel ? 'var(--text2)' : 'var(--text3)' }}>{d.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Trimestriel CA vs dépenses */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📊 Trimestriel</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {QUARTERLY.map(q => (
              <div key={q.quarter}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{q.quarter}</span>
                    {!q.reel && <span style={{ fontSize:10, color:'var(--p2)', background:'rgba(91,78,232,.15)', padding:'1px 7px', borderRadius:20, fontWeight:700 }}>Prévu</span>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--acc2)' }}>+{q.marge}%</span>
                </div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>CA</div>
                <div style={{ height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden', marginBottom:6 }}>
                  <div style={{
                    height:'100%', width:`${(q.ca / maxQCA) * 100}%`,
                    background:'linear-gradient(to right, var(--p), var(--p2))',
                    borderRadius:99,
                  }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ color:'var(--text3)' }}>Dépenses</span>
                  <span style={{ color:'var(--text2)', fontFamily:'var(--mono)', fontWeight:700 }}>{fmt(q.ca)}</span>
                </div>
                <div style={{ height:4, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', width:`${(q.depenses / maxQCA) * 100}%`,
                    background:'linear-gradient(to right, var(--danger), #F87171)',
                    borderRadius:99, opacity:.7,
                  }} />
                </div>
                <div style={{ textAlign:'right', fontSize:10, color:'var(--text3)', marginTop:3 }}>{fmt(q.depenses)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3 — Objectifs + Top croissance ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Objectifs */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">🎯 Objectifs à venir</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {OBJECTIFS.map(obj => {
              const isInverse  = obj.label === 'Taux rupture'
              const pct        = isInverse
                ? Math.min(100, Math.round((obj.target / obj.current) * 100))
                : obj.current === 0 ? 0 : Math.min(100, Math.round((obj.current / obj.target) * 100))
              const reached    = isInverse ? obj.current <= obj.target : obj.current >= obj.target
              const barColor   = reached ? 'var(--acc2)' : pct > 60 ? 'var(--acc)' : 'var(--p2)'
              const displayVal = obj.unit === 'FCFA' ? fmt(obj.current) : `${obj.current} ${obj.unit}`
              const displayTgt = obj.unit === 'FCFA' ? fmt(obj.target) : `${obj.target} ${obj.unit}`
              return (
                <div key={obj.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{obj.label}</span>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'var(--text3)' }}>
                        {displayVal} / {displayTgt}
                      </span>
                      {reached && <span style={{ fontSize:10, color:'var(--acc2)', fontWeight:800 }}>✓</span>}
                    </div>
                  </div>
                  <div style={{ height:8, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', width:`${pct}%`,
                      background: reached
                        ? 'linear-gradient(to right, var(--acc2), #34D399)'
                        : `linear-gradient(to right, ${barColor}, ${barColor}aa)`,
                      borderRadius:99, transition:'width .4s',
                    }} />
                  </div>
                  <div style={{ textAlign:'right', fontSize:10, color:'var(--text3)', marginTop:3 }}>{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top croissance */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">🚀 Top croissance prévue (3 mois)</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {TOP_GROWTH.map((p, i) => {
              const maxGrowth = TOP_GROWTH[0].growth
              const barW = (p.growth / maxGrowth) * 100
              return (
                <div key={p.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:16, minWidth:24, textAlign:'center' }}>{MEDALS[i]}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{p.name}</span>
                      <span style={{ fontSize:13, fontWeight:900, color:'var(--acc2)' }}>+{p.growth}%</span>
                    </div>
                    <div style={{ height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden', marginBottom:3 }}>
                      <div style={{
                        height:'100%', width:`${barW}%`,
                        background:'linear-gradient(to right, var(--acc2), #34D399)',
                        borderRadius:99,
                      }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)' }}>
                      <span>{fmt(p.currentCA)}</span>
                      <span style={{ color:'var(--acc2)' }}>{fmt(p.forecastCA)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Section 4 — RH Forecast ──────────────────────────────── */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">👥 Prévisions RH — Besoins à venir</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {RH_FORECAST.map(r => {
            const cfg = RH_TYPE_CFG[r.type as keyof typeof RH_TYPE_CFG]
            return (
              <div key={r.month} style={{
                background: cfg.bg,
                border:`1px solid ${cfg.color}33`,
                borderRadius:14, padding:'16px 18px',
              }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'var(--text2)' }}>{r.month}</span>
                  <span style={{
                    fontSize:10, fontWeight:700, color:cfg.color,
                    background:`${cfg.color}22`, padding:'2px 8px', borderRadius:20,
                  }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize:28, fontWeight:900, color:cfg.color, fontFamily:'var(--mono)', marginBottom:4 }}>
                  {r.besoins > 0 ? `+${r.besoins}` : '—'}
                </div>
                <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>{r.motif}</div>
                {r.cout > 0 && (
                  <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                    Coût estimé : <span style={{ color:cfg.color, fontWeight:700 }}>{fmt(r.cout)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 5 — Stock onglets ────────────────────────────── */}
      <div style={{ display:'flex', gap:6 }}>
        {([
          { id:'analyse', label:'📊 Analyse & Prévisions stock' },
          { id:'bons',    label:'📋 Bons de commande auto'      },
        ] as { id:ActiveTab; label:string }[]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:'8px 18px', borderRadius:10, fontSize:13, fontWeight:700,
            fontFamily:'inherit', cursor:'pointer', transition:'all .15s',
            background: activeTab === t.id ? 'var(--p)' : 'var(--card)',
            color:      activeTab === t.id ? '#fff'     : 'var(--text2)',
            border:     activeTab === t.id ? 'none'     : '1px solid var(--border)',
            boxShadow:  activeTab === t.id ? '0 4px 18px rgba(91,78,232,.35)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Onglet A — Analyse ─── */}
      {activeTab === 'analyse' && (
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📊 Analyse des stocks & Prévisions</span>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, alignItems:'center' }}>
            {['Toutes', 'Critique', 'Urgent', 'Normal', 'OK'].map(p => (
              <button key={p} onClick={() => setActiveFilter(p)} style={{
                padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                background: activeFilter === p ? 'var(--p)' : 'var(--bg3)',
                color:      activeFilter === p ? '#fff'     : 'var(--text2)',
                border:'none',
              }}>{p}</button>
            ))}
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button className="mini-btn" style={{ color:'var(--danger)' }}
                onClick={() => toast('⚡ Bons critiques générés !')}>
                ⚡ Commander critique
              </button>
              <button className="topbar-btn"
                onClick={() => {
                  const suppliers = [...new Set(FORECAST_ITEMS.filter(i => qtyToOrder(i) > 0).map(i => i.supplier))]
                  suppliers.forEach(s => generateOrderPDF(s, FORECAST_ITEMS))
                  toast.success(`📋 ${suppliers.length} ${lang === 'fr' ? 'bons générés !' : 'orders generated!'}`)
                  setActiveTab('bons')
                }}>
                📋 {lang === 'fr' ? 'Générer tous les bons' : 'Generate all orders'}
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Stock / Seuil</th>
                  <th>Ventes/j</th>
                  <th>Jours restants</th>
                  <th>Délai livraison</th>
                  <th>Qté à commander</th>
                  <th>Coût estimé</th>
                  <th>Fournisseur</th>
                  <th>Priorité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const j        = item.joursRestants
                  const qty      = item.qtyToOrder
                  const cost     = item.totalCost
                  const prio     = PRIORITY_CFG[item.priority]
                  const barPct   = Math.min(100, Math.round(item.currentStock / item.minStock * 100))
                  const barColor = item.currentStock < item.minStock * 0.3 ? 'var(--danger)'
                    : item.currentStock < item.minStock ? 'var(--acc)' : 'var(--acc2)'
                  const jColor   = j <= 2 ? 'var(--danger)' : j <= 7 ? 'var(--acc)' : 'var(--acc2)'
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="td-bold">{item.name}</div>
                        <div className="td-mono" style={{ fontSize:10 }}>{item.sku}</div>
                      </td>
                      <td>
                        <span style={{
                          display:'inline-block', padding:'2px 9px', borderRadius:20,
                          fontSize:11, fontWeight:600,
                          background:'rgba(124,111,240,.15)', color:'#A89CF5',
                        }}>{item.category}</span>
                      </td>
                      <td>
                        <div style={{ minWidth:90 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                            <span style={{ fontWeight:700, fontFamily:'var(--mono)',
                              color: item.currentStock === 0 ? 'var(--danger)'
                                : item.currentStock < item.minStock ? 'var(--acc)' : 'var(--text)' }}>
                              {item.currentStock}
                            </span>
                            <span style={{ color:'var(--text3)', fontFamily:'var(--mono)' }}>/{item.minStock}</span>
                          </div>
                          <div style={{ height:4, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${barPct}%`, background:barColor, borderRadius:99, transition:'width .3s' }} />
                          </div>
                        </div>
                      </td>
                      <td className="td-mono" style={{ color:'var(--text2)' }}>{item.avgSales}/j</td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:13, color:jColor }}>
                          {j}j
                        </span>
                      </td>
                      <td className="td-mono" style={{ color:'var(--text3)' }}>{item.leadTime}j</td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: qty > 0 ? 'var(--p2)' : 'var(--text3)' }}>
                          {qty > 0 ? qty : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily:'var(--mono)', fontWeight:700, color: qty > 0 ? 'var(--acc)' : 'var(--text3)' }}>
                          {qty > 0 ? fmt(cost) : '—'}
                        </span>
                      </td>
                      <td style={{ fontSize:12, color:'var(--text2)' }}>{item.supplier}</td>
                      <td>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          background:prio.bg, border:`1px solid ${prio.border}`,
                          color:prio.color, borderRadius:20,
                          padding:'3px 10px', fontSize:11, fontWeight:700, whiteSpace:'nowrap',
                        }}>{prio.label}</span>
                      </td>
                      <td>
                        {qty > 0 && (
                          <button className="mini-btn" style={{ color:'var(--p2)', fontSize:11 }}
                            onClick={() => toast.success(`🛒 ${item.name} ajouté au bon`)}>
                            🛒 Commander
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Résumé */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 16px', marginTop:12,
            background:'var(--bg3)', borderRadius:12, border:'1px solid var(--border)',
          }}>
            <div style={{ display:'flex', gap:24 }}>
              <div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3, textTransform:'uppercase', letterSpacing:'.5px' }}>ARTICLES À COMMANDER</div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)' }}>{totalToOrder}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3, textTransform:'uppercase', letterSpacing:'.5px' }}>COÛT TOTAL ESTIMÉ</div>
                <div style={{ fontSize:20, fontWeight:900, color:'var(--acc)', fontFamily:'var(--mono)' }}>{fmt(totalCostAll)}</div>
              </div>
            </div>
            <button className="topbar-btn"
              onClick={() => {
                const suppliers = [...new Set(FORECAST_ITEMS.filter(i => qtyToOrder(i) > 0).map(i => i.supplier))]
                suppliers.forEach(s => generateOrderPDF(s, FORECAST_ITEMS))
                toast.success(`📋 ${suppliers.length} ${lang === 'fr' ? 'bons générés !' : 'orders generated!'}`)
                setActiveTab('bons')
              }}>
              <ShoppingCart size={13} /> {lang === 'fr' ? 'Générer tous les bons de commande' : 'Generate all purchase orders'}
            </button>
          </div>
        </div>
      )}

      {/* ── Onglet B — Bons de commande ─── */}
      {activeTab === 'bons' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {supplierGroups.length === 0 ? (
            <div className="panel" style={{ textAlign:'center', color:'var(--text3)', padding:'40px 0', marginBottom:0 }}>
              <Package size={32} style={{ margin:'0 auto 12px', display:'block', opacity:.4 }} />
              Aucun article à commander
            </div>
          ) : supplierGroups.map(({ supplier, items }) => {
            const groupTotal  = items.reduce((s, i) => s + i.totalCost, 0)
            const isValidated = validated.has(supplier)
            return (
              <div key={supplier} style={{
                background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:14, overflow:'hidden',
              }}>
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 18px',
                  background:'linear-gradient(135deg, rgba(91,78,232,.1), rgba(124,111,240,.06))',
                  borderBottom:'1px solid var(--border)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{
                      width:36, height:36, borderRadius:9,
                      background:'rgba(91,78,232,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                    }}>🚚</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{supplier}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>
                        {items.length} article{items.length > 1 ? 's' : ''} · {fmt(groupTotal)} estimé
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button className="mini-btn" onClick={() => generateOrderPDF(supplier, FORECAST_ITEMS)}>📄 PDF</button>
                    <button className="mini-btn" onClick={() => sendOrderByEmail(supplier, FORECAST_ITEMS)}>📧 Email</button>
                    {!isValidated ? (
                      <button style={{
                        background:'linear-gradient(135deg, var(--acc2), #059669)',
                        border:'none', borderRadius:8, padding:'6px 14px',
                        fontSize:12, fontWeight:700, color:'#fff',
                        cursor:'pointer', fontFamily:'var(--font)',
                      }} onClick={() => validateOrder(supplier, FORECAST_ITEMS)}>
                        ✅ {lang === 'fr' ? 'Valider' : 'Validate'}
                      </button>
                    ) : (
                      <span className="badge badge-green">✅ Envoyé</span>
                    )}
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Qté à commander</th>
                        <th>Prix unitaire</th>
                        <th>Total estimé</th>
                        <th>Délai</th>
                        <th>Priorité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const prio = PRIORITY_CFG[item.priority]
                        return (
                          <tr key={item.id}>
                            <td className="td-bold">{item.name}</td>
                            <td className="td-num" style={{ color:'var(--p2)' }}>{item.qtyToOrder}</td>
                            <td className="td-num">{fmt(item.unitPrice)}</td>
                            <td className="td-num" style={{ color:'var(--acc)' }}>{fmt(item.totalCost)}</td>
                            <td style={{ fontSize:12, color:'var(--text3)' }}>{item.leadTime} jours</td>
                            <td>
                              <span style={{
                                display:'inline-flex', alignItems:'center', gap:4,
                                background:prio.bg, color:prio.color,
                                border:`1px solid ${prio.border}`,
                                borderRadius:20, padding:'2px 9px',
                                fontSize:10, fontWeight:700, whiteSpace:'nowrap',
                              }}>{prio.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ background:'var(--bg3)' }}>
                        <td colSpan={3} style={{ textAlign:'right', fontWeight:800, fontSize:13, padding:'10px 9px', color:'var(--text)' }}>TOTAL</td>
                        <td className="td-num" style={{ color:'var(--p2)', fontSize:14, fontWeight:900 }}>{fmt(groupTotal)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Section A — Recommandations intelligentes ─────────────── */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">🧠 Recommandations intelligentes</span>
          <span style={{
            fontSize:10, color:'var(--p2)',
            background:'rgba(91,78,232,.12)',
            border:'1px solid rgba(91,78,232,.2)',
            borderRadius:20, padding:'3px 10px',
          }}>IA · Mis à jour il y a 2h</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {RECOMMANDATIONS.map((rec, i) => {
            const borderColor = rec.type === 'danger'  ? 'rgba(232,64,74,.25)'  :
                                rec.type === 'warning' ? 'rgba(240,165,0,.25)'  :
                                rec.type === 'success' ? 'rgba(14,196,126,.25)' : 'rgba(91,78,232,.25)'
            const accentColor = rec.type === 'danger'  ? 'var(--danger)' :
                                rec.type === 'warning' ? 'var(--acc)'    :
                                rec.type === 'success' ? 'var(--acc2)'   : 'var(--p2)'
            const iconBg      = rec.type === 'danger'  ? 'rgba(232,64,74,.15)'  :
                                rec.type === 'warning' ? 'rgba(240,165,0,.15)'  :
                                rec.type === 'success' ? 'rgba(14,196,126,.15)' : 'rgba(91,78,232,.15)'
            return (
              <div key={i} style={{
                display:'flex', gap:14, padding:16,
                background:'var(--bg3)',
                border:`1px solid ${borderColor}`,
                borderLeft:`3px solid ${accentColor}`,
                borderRadius:14,
              }}>
                <div style={{
                  width:40, height:40, borderRadius:10, flexShrink:0,
                  background:iconBg,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
                }}>{rec.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', marginBottom:5 }}>{rec.title}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:10 }}>{rec.message}</div>
                  <button style={{
                    background:'none', border:`1px solid ${rec.actionColor}`,
                    borderRadius:7, padding:'4px 12px',
                    fontSize:11, fontWeight:700, color:rec.actionColor,
                    cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                  }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = rec.actionColor
                      el.style.color = '#fff'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = 'none'
                      el.style.color = rec.actionColor
                    }}
                    onClick={rec.onClick}
                  >→ {rec.action}</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section B — Prévisions trésorerie ────────────────────── */}
      <div id="section-tresorerie" className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">💳 Prévisions de trésorerie — 6 mois</span>
          <span style={{ fontSize:11, fontWeight:600, color:'var(--acc2)' }}>
            Solde cumulé : {fmt(8510000)}
          </span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
            <thead>
              <tr>
                {['Mois','Encaissements','Décaissements','Solde mensuel','Solde cumulé','Santé'].map(h => (
                  <th key={h} style={{
                    textAlign:'left', padding:'8px 12px', fontSize:11, color:'var(--text3)',
                    fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px',
                    borderBottom:'1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRESORERIE.map((t, i) => {
                const ratio      = t.decaissements / t.encaissements
                const sante      = ratio < 0.7 ? 'Excellente' : ratio < 0.8 ? 'Bonne' : 'Correcte'
                const santeColor = ratio < 0.7 ? 'var(--acc2)' : ratio < 0.8 ? 'var(--p2)' : 'var(--acc)'
                const santeBg    = ratio < 0.7 ? 'rgba(14,196,126,.12)' : ratio < 0.8 ? 'rgba(91,78,232,.12)' : 'rgba(240,165,0,.12)'
                const soldePct   = Math.round((t.solde / t.encaissements) * 100)
                return (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'12px', fontSize:13, fontWeight:700, color:'var(--text)' }}>{t.month}</td>
                    <td style={{ padding:'12px', color:'var(--acc2)', fontFamily:'var(--mono)', fontWeight:600, fontSize:13 }}>
                      + {fmt(t.encaissements)}
                    </td>
                    <td style={{ padding:'12px', color:'var(--danger)', fontFamily:'var(--mono)', fontWeight:600, fontSize:13 }}>
                      − {fmt(t.decaissements)}
                    </td>
                    <td style={{ padding:'12px' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <span style={{ color:'var(--p2)', fontFamily:'var(--mono)', fontWeight:800, fontSize:13 }}>
                          {fmt(t.solde)}
                        </span>
                        <div style={{ height:4, background:'var(--bg4)', borderRadius:99, width:80 }}>
                          <div style={{
                            height:'100%', width:`${soldePct}%`,
                            background:'linear-gradient(90deg, var(--p), var(--p2))',
                            borderRadius:99,
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'12px', fontFamily:'var(--mono)', fontWeight:800, fontSize:13, color:'var(--text)' }}>
                      {fmt(t.cumul)}
                    </td>
                    <td style={{ padding:'12px' }}>
                      <span style={{ background:santeBg, color:santeColor, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                        {sante}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section C — Catégories + Clients ─────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

        {/* Panel gauche : CA par catégorie */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">📦 Prévisions CA par catégorie</span>
            <span style={{ fontSize:11, color:'var(--text3)' }}>vs mois actuel</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {CATEGORY_FORECAST.map((cat, i) => (
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{cat.category}</span>
                    <span style={{ fontSize:10, color:'var(--text3)', background:'var(--bg3)', borderRadius:20, padding:'1px 7px' }}>
                      {cat.share} % du CA
                    </span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:12, fontWeight:800, color:cat.color, fontFamily:'var(--mono)' }}>{fmt(cat.forecastCA)}</div>
                    <div style={{ fontSize:10, color:'var(--acc2)', fontWeight:600 }}>▲ +{cat.growth} %</div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:9, color:'var(--text3)', width:50 }}>Actuel</span>
                    <div style={{ flex:1, height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{
                        height:'100%',
                        width:`${Math.round((cat.currentCA / 4000000) * 100)}%`,
                        background:'var(--bg4)',
                        borderRadius:99,
                        border:`2px solid ${cat.color}`,
                      }} />
                    </div>
                    <span style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)', width:60, textAlign:'right' }}>
                      {fmt(cat.currentCA)}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:9, color:'var(--text3)', width:50 }}>Prévu</span>
                    <div style={{ flex:1, height:6, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{
                        height:'100%',
                        width:`${Math.round((cat.forecastCA / 5000000) * 100)}%`,
                        background:cat.color,
                        borderRadius:99, opacity:.85,
                      }} />
                    </div>
                    <span style={{ fontSize:9, color:cat.color, fontFamily:'var(--mono)', fontWeight:700, width:60, textAlign:'right' }}>
                      {fmt(cat.forecastCA)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel droit : Prévisions clients */}
        <div className="panel" style={{ marginBottom:0 }}>
          <div className="panel-head">
            <span className="panel-title">👥 Prévisions clients & CRM</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {CLIENT_FORECAST.map((c, i) => {
              const isBetter = c.metric.includes('Délai') ? c.forecast < c.current : c.forecast > c.current
              const displayCurrent  = c.unit === 'FCFA' ? fmt(c.current)  : `${c.current} ${c.unit}`
              const displayForecast = c.unit === 'FCFA' ? fmt(c.forecast) : `${c.forecast} ${c.unit}`
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 14px',
                  background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10,
                }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:3 }}>{c.metric}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                      <span style={{ color:'var(--text3)', fontFamily:'var(--mono)' }}>{displayCurrent}</span>
                      <span style={{ color:'var(--text3)' }}>→</span>
                      <span style={{ color: isBetter ? 'var(--acc2)' : 'var(--danger)', fontFamily:'var(--mono)', fontWeight:700 }}>
                        {displayForecast}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    display:'flex', alignItems:'center', gap:4,
                    background: isBetter ? 'rgba(14,196,126,.12)' : 'rgba(232,64,74,.12)',
                    border:`1px solid ${isBetter ? 'rgba(14,196,126,.25)' : 'rgba(232,64,74,.25)'}`,
                    borderRadius:20, padding:'5px 12px',
                  }}>
                    <span style={{ fontSize:12, fontWeight:800, color: isBetter ? 'var(--acc2)' : 'var(--danger)' }}>
                      {c.growth > 0 ? '▲' : '▼'} {Math.abs(c.growth)} %
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Section D — Synthèse annuelle ────────────────────────── */}
      <div className="panel" style={{
        marginBottom:0,
        background:'linear-gradient(135deg, rgba(91,78,232,.12), rgba(124,111,240,.06))',
        border:'1px solid rgba(91,78,232,.25)',
      }}>
        <div className="panel-head">
          <span className="panel-title" style={{ fontSize:15 }}>🏆 Synthèse prévisionnelle — Année 2026</span>
          <button className="mini-btn" onClick={() => {
            const items = FORECAST_ITEMS.filter(i => qtyToOrder(i) > 0)
            exportCSV('habashop_bons_commande',
              ['SKU','Produit','Fournisseur','Qté à commander','Prix unitaire','Total estimé','Priorité'],
              items.map(i => [i.sku, i.name, i.supplier, qtyToOrder(i), i.unitPrice, totalCost(i), i.priority])
            )
            toast.success('📊 Bons de commande exportés !')
          }}>
            📥 Exporter le rapport
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:14 }}>
          {[
            { label:'CA total 2026',        value:fmt(33750000), sub:'+18 % vs 2025', color:'var(--p2)',   icon:'💰' },
            { label:'Marge brute moyenne',  value:'36 %',        sub:'+4 pts vs 2025',color:'var(--acc2)', icon:'📊' },
            { label:'Coût achats stock',    value:fmt(21600000), sub:'64 % du CA',    color:'var(--acc)',  icon:'📦' },
            { label:'Masse salariale',      value:fmt(3120000),  sub:'+2 ETP prévus', color:'#A78BFA',     icon:'👥' },
            { label:'Résultat net prévu',   value:fmt(4230000),  sub:'+22 % vs 2025', color:'var(--acc2)', icon:'🏆' },
          ].map((s, i) => (
            <div key={i} style={{
              textAlign:'center', padding:'18px 12px',
              background:'rgba(255,255,255,.03)',
              borderRadius:14, border:'1px solid rgba(255,255,255,.08)',
            }}>
              <div style={{ fontSize:24, marginBottom:8 }}>{s.icon}</div>
              <div style={{
                fontSize:9.5, fontWeight:700, textTransform:'uppercase',
                letterSpacing:'.8px', color:'var(--text3)', marginBottom:8,
              }}>{s.label}</div>
              <div style={{
                fontSize:18, fontWeight:900, color:s.color,
                fontFamily:'var(--mono)', letterSpacing:'-1px', marginBottom:4,
              }}>{s.value}</div>
              <div style={{ fontSize:10.5, color:'var(--acc2)', fontWeight:600 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
