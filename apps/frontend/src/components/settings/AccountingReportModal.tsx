import { useState, useEffect, useCallback } from 'react'
import { X, FileDown, FileText, TrendingUp, TrendingDown, Scale, Users, RefreshCw, Loader2, BarChart3, AlertTriangle } from 'lucide-react'
import { useConfig, formatInCurrency } from '@/stores/appStore'
import { reportsApi, type AccountingReport } from '@/lib/api'
import { openPDF, htmlKPIs, htmlTable, exportCSV } from '@/utils/export'
import { type L4, makeI } from '@/components/settings/settingsShared'

const localeOf = (lang: string) => lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

// Catégories de dépenses traduites (clé = valeur FR stockée en base ; fallback = brut)
const CAT_T: Record<string, Record<L4, string>> = {
  Loyer:       { fr: 'Loyer', en: 'Rent', es: 'Alquiler', it: 'Affitto' },
  'Énergie':   { fr: 'Énergie', en: 'Energy', es: 'Energía', it: 'Energia' },
  Transport:   { fr: 'Transport', en: 'Transport', es: 'Transporte', it: 'Trasporto' },
  Maintenance: { fr: 'Maintenance', en: 'Maintenance', es: 'Mantenimiento', it: 'Manutenzione' },
  Fournitures: { fr: 'Fournitures', en: 'Supplies', es: 'Suministros', it: 'Forniture' },
  Marketing:   { fr: 'Marketing', en: 'Marketing', es: 'Marketing', it: 'Marketing' },
  Formation:   { fr: 'Formation', en: 'Training', es: 'Formación', it: 'Formazione' },
  Autre:       { fr: 'Autre', en: 'Other', es: 'Otro', it: 'Altro' },
}
const catLabel = (c: string, lang: L4) => CAT_T[c]?.[lang] ?? c

// N derniers mois (valeur 'YYYY-MM', du plus récent au plus ancien)
function lastMonths(n: number): string[] {
  const now = new Date()
  const out: string[] = []
  for (let k = 0; k < n; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export default function AccountingReportModal({ onClose }: { onClose: () => void }) {
  const cfg = useConfig()
  const lang = cfg.lang as L4
  const i = makeI(lang)
  const locale = localeOf(lang)
  const months = lastMonths(12)

  const [month, setMonth]     = useState(months[0])
  const [data, setData]       = useState<AccountingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  // Le backend renvoie déjà les montants dans la devise du tenant (data.currency).
  // On formate SANS reconvertir (≠ useFormatAmount qui convertirait depuis XOF →
  // double conversion). Pour un tenant XOF c'est identique au comportement précédent.
  const money = (n: number) => formatInCurrency(n, data?.currency ?? 'XOF')

  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-').map(Number)
    const label = new Date(y, mo - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  const load = useCallback(async (m: string) => {
    setLoading(true); setError(false)
    try {
      setData(await reportsApi.accounting(m))
    } catch {
      setError(true); setData(null)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load(month) }, [month, load])

  const isEmpty = !!data && data.revenue.total === 0 && data.expenses.total === 0
  const maxCat  = data ? Math.max(1, ...data.expenses.byCategory.map(c => c.amountTtc)) : 1

  const exportPdf = () => {
    if (!data) return
    const kpis = htmlKPIs([
      { label: i('Revenus', 'Revenue', 'Ingresos', 'Ricavi'), value: money(data.revenue.total) },
      { label: i('Dépenses', 'Expenses', 'Gastos', 'Spese'), value: money(data.expenses.total) },
      { label: i('Résultat avant masse salariale', 'Result before payroll', 'Resultado antes de nómina', 'Risultato prima del personale'), value: money(data.resultBeforePayroll) },
      { label: i('Marge', 'Margin', 'Margen', 'Margine'), value: data.margin != null ? `${data.margin.toFixed(1)}%` : '—' },
    ])
    const rows = data.expenses.byCategory.map(c => [catLabel(c.category, lang), money(c.amountTtc)])
    const table = htmlTable(
      [i('Catégorie', 'Category', 'Categoría', 'Categoria'), i('Montant TTC', 'Amount incl. VAT', 'Importe IVA inc.', 'Importo IVA incl.')],
      rows,
      [i('Total dépenses', 'Total expenses', 'Total gastos', 'Totale spese'), money(data.expenses.total)],
    )
    const payrollLine = `${i('Masse salariale (projection — effectif actuel, non historique) : ', 'Payroll (projection — current headcount, not historical): ', 'Masa salarial (proyección — plantilla actual, no histórica): ', 'Massa salariale (proiezione — organico attuale, non storica): ')}${money(data.payroll.total)}`
    const afterLine = data.payroll.total > 0
      ? `<br/>${i('Résultat estimé après paie (estimation, non un résultat réel) : ', 'Estimated result after payroll (estimate, not an actual result): ', 'Resultado estimado tras nómina (estimación, no un resultado real): ', 'Risultato stimato dopo personale (stima, non un risultato reale): ')}${money(data.resultAfterPayrollEstimate)}`
      : ''
    const note = `<p style="color:#666;font-size:12px;margin-top:16px">${payrollLine}${afterLine}</p>`
    openPDF(`${i('Rapport comptable', 'Accounting report', 'Reporte contable', 'Report contabile')} — ${monthLabel(month)}`, kpis + table + note)
  }

  const exportCsvFile = () => {
    if (!data) return
    const rows: (string | number)[][] = [
      [i('Revenus', 'Revenue', 'Ingresos', 'Ricavi'), data.revenue.total],
      [i('Nb ventes', 'Sales count', 'Nº ventas', 'N. vendite'), data.revenue.count],
      [i('Dépenses', 'Expenses', 'Gastos', 'Spese'), data.expenses.total],
      [i('Résultat avant masse salariale', 'Result before payroll', 'Resultado antes de nómina', 'Risultato prima del personale'), data.resultBeforePayroll],
      [i('Marge % (avant paie)', 'Margin % (before payroll)', 'Margen % (antes de nómina)', 'Margine % (prima del personale)'), data.margin != null ? data.margin.toFixed(1) : '—'],
      [i('Masse salariale (projection — effectif actuel)', 'Payroll (projection — current headcount)', 'Masa salarial (proyección — plantilla actual)', 'Massa salariale (proiezione — organico attuale)'), data.payroll.total],
      [i('Résultat estimé après paie (estimation, non réel)', 'Estimated result after payroll (estimate, not actual)', 'Resultado estimado tras nómina (estimación, no real)', 'Risultato stimato dopo personale (stima, non reale)'), data.payroll.total > 0 ? data.resultAfterPayrollEstimate : '—'],
      ['', ''],
      [i('Catégorie de dépense', 'Expense category', 'Categoría de gasto', 'Categoria di spesa'), i('Montant TTC', 'Amount incl. VAT', 'Importe IVA inc.', 'Importo IVA incl.')],
      ...data.expenses.byCategory.map(c => [catLabel(c.category, lang), c.amountTtc] as (string | number)[]),
    ]
    exportCSV(`Comptabilite_${month}`, [i('Rubrique', 'Item', 'Concepto', 'Voce'), i('Valeur', 'Value', 'Valor', 'Valore')], rows)
  }

  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)' }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 620, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px var(--shadow, rgba(0,0,0,.6))' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'color-mix(in srgb, var(--acc2) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={20} color="var(--acc2)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{i('Rapport comptable', 'Accounting report', 'Reporte contable', 'Report contabile')}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i('Revenus, dépenses et résultat du mois', 'Monthly revenue, expenses and result', 'Ingresos, gastos y resultado del mes', 'Ricavi, spese e risultato del mese')}</div>
          </div>
          <select className="input" aria-label={i('Mois', 'Month', 'Mes', 'Mese')} value={month} onChange={e => setMonth(e.target.value)} style={{ width: 'auto', minWidth: 150, fontSize: 13 }}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button type="button" onClick={onClose} aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                {[0, 1, 2, 3].map(k => <div key={k} style={{ height: 70, borderRadius: 12, background: 'var(--bg3)', animation: 'pulse 1.4s infinite' }} />)}
              </div>
              <div style={{ height: 160, borderRadius: 12, background: 'var(--bg3)', animation: 'pulse 1.4s infinite' }} />
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <AlertTriangle size={32} color="var(--danger)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{i('Échec du chargement du rapport', 'Failed to load the report', 'Error al cargar el informe', 'Caricamento del report fallito')}</div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => load(month)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13} /> {i('Réessayer', 'Retry', 'Reintentar', 'Riprova')}
              </button>
            </div>
          ) : isEmpty ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <BarChart3 size={26} color="var(--text3)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{i('Aucune donnée ce mois-ci', 'No data this month', 'Sin datos este mes', 'Nessun dato questo mese')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{i('Aucune vente ni dépense enregistrée pour', 'No sales or expenses recorded for', 'Sin ventas ni gastos registrados para', 'Nessuna vendita o spesa registrata per')} {monthLabel(month)}</div>
            </div>
          ) : data && (
            <>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: i('Revenus', 'Revenue', 'Ingresos', 'Ricavi'), value: money(data.revenue.total), color: 'var(--acc2)', Icon: TrendingUp, sub: `${data.revenue.count} ${i('ventes', 'sales', 'ventas', 'vendite')}` },
                  { label: i('Dépenses', 'Expenses', 'Gastos', 'Spese'), value: money(data.expenses.total), color: 'var(--danger)', Icon: TrendingDown, sub: `${data.expenses.byCategory.length} ${i('catégories', 'categories', 'categorías', 'categorie')}` },
                  { label: i('Résultat avant masse salariale', 'Result before payroll', 'Resultado antes de nómina', 'Risultato prima del personale'), value: money(data.resultBeforePayroll), color: data.resultBeforePayroll >= 0 ? 'var(--acc2)' : 'var(--danger)', Icon: Scale, sub: data.margin != null ? `${i('marge', 'margin', 'margen', 'margine')} ${data.margin.toFixed(1)}%` : '—' },
                  { label: i('Masse salariale', 'Payroll', 'Masa salarial', 'Massa salariale'), value: money(data.payroll.total), color: 'var(--p3)', Icon: Users, sub: i('projection — effectif actuel', 'projection — current headcount', 'proyección — plantilla actual', 'proiezione — organico attuale') },
                ].map(k => (
                  <div key={k.label} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <k.Icon size={13} color={k.color} />
                      <span style={lbl}>{k.label}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: k.color, fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Résultat estimé après paie — masqué si aucune masse salariale (évite le doublon) */}
              {data.payroll.total > 0 && (() => {
                const after = data.resultAfterPayrollEstimate
                const c = after >= 0 ? 'var(--acc2)' : 'var(--danger)'
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 16, borderRadius: 12, background: 'var(--bg3)', border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>
                    <Scale size={18} color={c} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{i('Résultat estimé après paie', 'Estimated result after payroll', 'Resultado estimado tras nómina', 'Risultato stimato dopo personale')}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)', borderRadius: 99, padding: '2px 8px' }}>{i('estimé', 'estimated', 'estimado', 'stimato')}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>{i("Projection basée sur l'effectif actuel, non historique", 'Projection based on current headcount, not historical', 'Proyección basada en la plantilla actual, no histórica', "Proiezione basata sull'organico attuale, non storica")}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--mono)', letterSpacing: '-.5px', color: c, flexShrink: 0 }}>{money(after)}</div>
                  </div>
                )
              })()}

              {/* Ventilation des dépenses */}
              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart3 size={13} color="var(--text3)" />
                <span style={lbl}>{i('Dépenses par catégorie', 'Expenses by category', 'Gastos por categoría', 'Spese per categoria')}</span>
              </div>
              {data.expenses.byCategory.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 0' }}>{i('Aucune dépense ce mois-ci', 'No expenses this month', 'Sin gastos este mes', 'Nessuna spesa questo mese')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {data.expenses.byCategory.map(c => (
                    <div key={c.category}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{catLabel(c.category, lang)}</span>
                        <span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{money(c.amountTtc)}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 99, background: 'var(--bg4)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(2, (c.amountTtc / maxCat) * 100)}%`, borderRadius: 99, background: 'linear-gradient(90deg, var(--p), var(--p2))' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — export */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'var(--bg2)' }}>
          {loading && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}><Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} /> {i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={exportPdf} disabled={!data || isEmpty} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: (!data || isEmpty) ? .5 : 1, cursor: (!data || isEmpty) ? 'not-allowed' : 'pointer' }}>
              <FileText size={13} /> PDF
            </button>
            <button type="button" onClick={exportCsvFile} disabled={!data || isEmpty} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: (!data || isEmpty) ? .5 : 1, cursor: (!data || isEmpty) ? 'not-allowed' : 'pointer' }}>
              <FileDown size={13} /> CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
