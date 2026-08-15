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

// ReportsTabs porte les graphes (chunk `charts`, visx) → lazy pour alléger le shell Reports
const ReportsTabs = lazy(() => import('@/components/reports/ReportsTabs'))
import { type Period, Trend } from '@/components/reports/reportsShared'
import { buildPaymentBreakdown, pctLabel } from '@/components/reports/paymentBreakdown'
import { DateRangeField, PERIOD_LABELS } from '@/components/ui/DatePicker'
import { type IsoDate, presetRange, rangeToMs } from '@/lib/dateRange'
import { fmtDate } from '@/lib/formatDate'

const WEEK_ABBR: Record<string, string[]> = {
  fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
  en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
  it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
}

/** Période affichée à l'ouverture, et cible du bouton « Effacer » du panneau. */
const PRESET_DEFAUT: Period = '30days'

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

  const [reportTab,  setReportTab]  = useState<'ventes' | 'stock' | 'clients' | 'finance' | 'rh'>('ventes')
  /**
   * SÉLECTION DE PÉRIODE — un seul état, trois champs qui bougent ENSEMBLE.
   * `preset` à `null` signifie « plage saisie à la main » ; `from`/`to` sont TOUJOURS
   * renseignés, y compris sous un raccourci. Avant, un preset ne portait aucune date et
   * la plage personnalisée aucun preset : deux sources pour une même période, et le
   * libellé affiché pouvait décrire autre chose que ce qui était filtré.
   */
  const [sel, setSel] = useState<{ preset: Period | null; from: IsoDate; to: IsoDate }>(
    () => ({ preset: PRESET_DEFAUT, ...presetRange(PRESET_DEFAUT) }),
  )
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

  /**
   * Plage active en millisecondes, DÉRIVÉE de la sélection — plus aucun calcul de bornes ici.
   *
   * ⚠️ Les bornes sont des JOURS CIVILS COMPLETS (minuit → 23:59:59.999), pas `now − N jours`.
   * L'ancien calcul soustrayait une durée à l'instant courant : « 30 derniers jours » ouvert
   * à 14 h 32 démarrait à 14 h 32, et les ventes du matin du 30ᵉ jour tombaient hors période.
   * Le même rapport rendait donc deux chiffres différents selon l'heure d'ouverture.
   */
  const range = useMemo(() => {
    const ms = rangeToMs({ from: sel.from, to: sel.to })
      // Plage inexploitable (saisie clavier en cours, année à un chiffre) : on retombe sur
      // le raccourci par défaut plutôt que sur une période vide qui afficherait « 0 vente ».
      ?? rangeToMs(presetRange(PRESET_DEFAUT))!
    return { from: ms.from, to: ms.to, custom: sel.preset === null }
  }, [sel])

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

  /**
   * Libellé de période : le raccourci s'il y en a un, sinon les deux dates.
   *
   * ⚠️ Les libellés viennent de `DatePicker` (source unique, 4 langues) et NON plus des
   * clés `reports_*` : le panneau et le sous-titre nommaient la même période avec deux
   * jeux de chaînes, qui n'avaient aucune raison de rester d'accord.
   * ⚠️ `fmtDate`, pas `toLocaleDateString` — cf. `lib/formatDate.ts` (décalage d'un jour
   * en fuseau négatif).
   */
  const periodLabel = sel.preset
    ? PERIOD_LABELS[lang][sel.preset]
    : `${fmtDate(sel.from)} → ${fmtDate(sel.to)}`

  // KPIs + graphique 7j + top produits calculés depuis les vraies ventes
  // (les items incluent product.buyPrice → vraie marge brute = CA − coût d'achat).
  /**
   * Ventes de la PÉRIODE ACTIVE — la population de référence de tout l'onglet.
   *
   * ⚠️ QUATRIÈME dénominateur, mesuré le 2026-08-07 et plus grave que les trois autres :
   * le panneau de paiement lisait `salesData` (les 50 ventes chargées, toutes dates
   * confondues) alors que les KPI juste au-dessus lisent la période. Sur `demo-tenant-001`
   * la carte « Transactions » affichait **8** pendant que le camembert annonçait
   * « 50 transactions » ; sur `demo-tenant-002`, **0** contre 50 — une carte à zéro à côté
   * d'un camembert qui répartit cinquante ventes avec assurance. Le sélecteur de période
   * du haut de page n'agissait tout simplement pas sur ce panneau.
   *
   * Le dénominateur retenu est donc **les ventes de la période sélectionnée**, partout :
   * c'est celui que le commerçant a choisi, et le seul qu'il puisse recouper d'une carte
   * à l'autre.
   */
  const ventesPeriode = useMemo(() => {
    const ts = (s: any) => new Date(s.createdAt).getTime()
    return salesData.filter(s => ts(s) >= range.from && ts(s) <= range.to)
  }, [salesData, range])

  // Répartition des paiements — UNE seule série d'entiers sommant à 100, exhaustive.
  // Le pourquoi (deux dénominateurs, modes avalés, repli fabriqué) vit dans
  // `components/reports/paymentBreakdown.ts` : c'est là que la règle est écrite et testée.
  const paymentData = useMemo(() => buildPaymentBreakdown(ventesPeriode, lang), [ventesPeriode, lang])

  const { data, chartData, topProducts } = useMemo(() => {
    const now = Date.now(); const DAY = 86400000
    const ts = (s: any) => new Date(s.createdAt).getTime()
    const winLen = range.to - range.from
    const cur  = ventesPeriode
    const prev = salesData.filter(s => ts(s) >= range.from - winLen && ts(s) < range.from)
    const agg = (arr: any[]) => {
      const ca = arr.reduce((s, x) => s + (x.total ?? 0), 0)
      const margin = arr.reduce((s, x) => s + (x.items ?? []).reduce((m: number, it: any) => m + (((it.unitPrice ?? 0) - (it.product?.buyPrice ?? 0)) * (it.qty ?? 0)), 0), 0)
      // `avgCart` ici = TICKET MOYEN réel (CA ÷ nombre de ventes de la période).
      // ⚠️ À ne pas confondre avec `Customers.tsx` `avgCart`, qui estime une dépense par
      // achat à partir d'une fréquence PROJETÉE. Les deux portaient le même libellé
      // « Panier moyen » ; ils portent désormais deux noms distincts.
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
  }, [salesData, ventesPeriode, range, lang, filterCat])

  // Tableau « Répartition paiements » du PDF imprimé. ⚠️ Il lit la MÊME série que l'écran :
  // c'était la TROISIÈME surface à porter son propre calcul, et la seule qui imprimait un
  // total. Son pied disait « 100 % » en littéral pendant que ses lignes sommaient à 96 %,
  // et son total en argent excluait les modes avalés — 11 535 XOF de ventes réelles
  // absentes du total d'un document imprimé (mesuré sur demo-tenant-001 le 2026-08-07).
  // La colonne « transactions » affichait « — » alors que le compte est connu.
  const paymentModes = paymentData

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
        {/* UN SEUL contrôle : raccourcis + plage + calendrier. Avant, les 5 boutons de
            raccourci et les 2 champs Du/au étaient deux contrôles concurrents sur la même
            grandeur — on pouvait avoir un raccourci « actif » à l'écran et une plage
            personnalisée réellement appliquée. */}
        <DateRangeField
          from={sel.from}
          to={sel.to}
          preset={sel.preset}
          presetParDefaut={PRESET_DEFAUT}
          onChange={setSel}
          ariaLabel={i('Période du rapport', 'Report period', 'Período del informe', 'Periodo del report')}
        />
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
                      paymentModes.map(m => [m.name, String(m.count), fmt(m.amount), pctLabel(m)]),
                      [
                        `<strong>${t('common_total')}</strong>`,
                        `<strong>${paymentModes.reduce((s, m) => s + m.count, 0)}</strong>`,
                        `<strong>${fmt(paymentModes.reduce((s, m) => s + m.amount, 0))}</strong>`,
                        // Le total se CONSTATE. Les parts étant exhaustives, il vaut 100 —
                        // mais c'est la somme qui le dit, pas un littéral qui l'affirme.
                        `<strong>${paymentModes.reduce((s, m) => s + m.pct, 0)} %</strong>`,
                      ]
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
      {/* ⚠️ `salesData={ventesPeriode}`, PAS `salesData` : le sous-titre du camembert porte
          le dénominateur (« N transactions ») et « Ventes récentes » liste des ventes. Les
          alimenter avec les 50 ventes chargées, toutes dates confondues, remettait la
          contradiction mesurée — KPI « 0 transactions » à côté d'un camembert répartissant
          50 ventes. Le voisin immédiat, « Top produits », était déjà sur la période. */}
      <Suspense fallback={<div style={{ minHeight: 200 }} />}>
        <ReportsTabs
          reportTab={reportTab}
          fmt={fmt} abbr={abbr} lang={lang}
          chartData={chartData}
          paymentData={paymentData}
          activePayIndex={activePayIndex} setActivePayIndex={setActivePayIndex}
          salesData={ventesPeriode}
          data={data}
          topProducts={topProducts}
        />
      </Suspense>

    </div>
  )
}
