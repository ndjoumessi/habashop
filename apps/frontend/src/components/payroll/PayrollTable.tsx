import type React from 'react'
import { useConfig, CURRENCY_DECIMALS } from '@/stores/appStore'
import { Download, Eye, Check, Zap } from 'lucide-react'
import { MONTHS, monthLabel, roleLabel, statusLabel, STATUS_CFG, EmpAvatar, payrollDisplay, fmtDisplay } from './payrollShared'
import type { PayRecord } from './payrollShared'

interface Props {
  month: string
  setMonth: (m: string) => void
  filtered: PayRecord[]
  onExportCSV: () => void
  onGenerate: () => void
  onView: (r: PayRecord) => void
  onMarkPaid: (id: string) => void
  onPrintPDF: (r: PayRecord) => void
}

export default function PayrollTable(props: Props) {
  const { month, setMonth, filtered, onExportCSV, onGenerate, onView, onMarkPaid, onPrintPDF } = props
  const { lang, currency } = useConfig()
  // ⚠️ `payrollDisplay` rend des montants DÉJÀ convertis, cohérents entre eux. On formate donc
  // avec `fmtDisplay`, jamais avec `useFormatAmount()` qui reconvertirait depuis XOF.
  const fmt = (v: number) => fmtDisplay(v, currency)
  const dec = CURRENCY_DECIMALS[currency as keyof typeof CURRENCY_DECIMALS] ?? 2
  const arrondi = (x: number) => Math.round(x * 10 ** dec) / 10 ** dec

  // Une ligne = un détail d'affichage. Les lignes affichées sont la seule vérité de la table.
  const lignes = filtered.map(r => ({ r, d: payrollDisplay(r, currency) }))

  // ⚠️ Totaux = SOMME DES LIGNES AFFICHÉES, jamais la conversion d'une somme XOF. Sinon la
  // ligne TOTAL ne correspond pas à ce qu'on obtient en additionnant la colonne — sur une
  // table de paie, c'est l'objection immédiate du premier employé qui vérifie.
  const totals = lignes.reduce((a, { r, d }) => ({
    base: arrondi(a.base + d.baseSalary), bonus: arrondi(a.bonus + d.bonus),
    overtime: arrondi(a.overtime + d.overtime), deductions: arrondi(a.deductions + d.exceptional),
    absences: a.absences + r.absences, net: arrondi(a.net + d.net),
  }), { base: 0, bonus: 0, overtime: 0, deductions: 0, absences: 0, net: 0 })

  // Séparateurs visuels de groupes de colonnes : avant le groupe Retenues et avant NET.
  const groupSep: React.CSSProperties = { borderLeft: '1px solid var(--border)' }
  // NET = métrique reine : pill verte mono semibold.
  const netPill: React.CSSProperties = {
    display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--r-full)',
    background: 'var(--c-green-bg)', border: '1px solid var(--c-green-border)', color: 'var(--acc2)',
    fontFamily: 'var(--mono)', fontWeight: 'var(--fw-semibold)', fontSize: 12, whiteSpace: 'nowrap',
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <select className="input" value={month} onChange={e => setMonth(e.target.value)}
          aria-label={lang === 'en' ? 'Payroll month' : lang === 'es' ? 'Mes de nómina' : lang === 'it' ? 'Mese di paga' : 'Mois de paie'}
          style={{ width:'auto', minWidth:180 }}>
          {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m, lang)}</option>)}
        </select>
        <div style={{ flex:1 }} />
        <button className="btn btn-ghost btn-sm gap-1.5" onClick={onExportCSV}>
          <Download size={13} /> Export CSV
        </button>
        <button className="btn btn-primary btn-sm gap-1.5" onClick={onGenerate}>
          <Zap size={13} /> {lang === 'en' ? 'Generate monthly payroll' : lang === 'es' ? 'Generar nómina del mes' : lang === 'it' ? 'Genera busta paga del mese' : 'Générer la paie du mois'}
        </button>
      </div>

      {/* Table */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">{lang === 'en' ? 'Payroll' : lang === 'es' ? 'Nómina' : lang === 'it' ? 'Buste paga' : 'Paie'} — {monthLabel(month, lang)}</span>
          <span className="badge badge-gray">{filtered.length} {filtered.length > 1 ? (lang === 'en' ? 'employees' : lang === 'es' ? 'empleados' : lang === 'it' ? 'dipendenti' : 'employés') : (lang === 'en' ? 'employee' : lang === 'es' ? 'empleado' : lang === 'it' ? 'dipendente' : 'employé')}</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'28px 0', color:'var(--text3)', fontSize:13 }}>
            {lang === 'en' ? `No payslips for ${monthLabel(month, lang)}` : lang === 'es' ? `Sin nóminas para ${monthLabel(month, lang)}` : lang === 'it' ? `Nessuna busta paga per ${monthLabel(month, lang)}` : `Aucun bulletin pour ${monthLabel(month, lang)}`}
          </div>
        ) : (
          <div className="table-wrap data-table">
            <table aria-label={`${lang === 'en' ? 'Payroll' : lang === 'es' ? 'Nómina' : lang === 'it' ? 'Buste paga' : 'Paie'} — ${monthLabel(month, lang)}`}>
              <thead>
                <tr>
                  <th scope="col">{lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}</th><th scope="col">{lang === 'en' ? 'Role' : lang === 'es' ? 'Puesto' : lang === 'it' ? 'Ruolo' : 'Poste'}</th><th scope="col">{lang === 'en' ? 'Base' : lang === 'es' ? 'Base' : lang === 'it' ? 'Base' : 'Base'}</th>
                  <th scope="col">{lang === 'en' ? 'Bonuses' : lang === 'es' ? 'Primas' : lang === 'it' ? 'Premi' : 'Primes'}</th><th scope="col">{lang === 'en' ? 'Overtime' : lang === 'es' ? 'Horas extra' : lang === 'it' ? 'Straordinari' : 'Heures sup.'}</th><th scope="col" style={groupSep}>{lang === 'en' ? 'Deductions' : lang === 'es' ? 'Deducciones' : lang === 'it' ? 'Detrazioni' : 'Retenues'}</th>
                  <th scope="col">{lang === 'en' ? 'Absences' : lang === 'es' ? 'Ausencias' : lang === 'it' ? 'Assenze' : 'Absences'}</th><th scope="col" style={groupSep}>NET</th><th scope="col">{lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'}</th><th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ r, d }) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <EmpAvatar r={r} size={30} />
                        <span className="td-bold" style={{ fontSize:12 }}>{r.employee}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text3)' }}>{roleLabel(r.role, lang)}</td>
                    {/* Colonnes intermédiaires rétrogradées (12px, text2/text3) — le NET reste la métrique reine */}
                    <td className="td-num text-sm" style={{ color:'var(--text2)' }}>{fmt(d.baseSalary)}</td>
                    <td className="td-num text-sm" style={{ color:r.bonus > 0 ? 'var(--text2)' : 'var(--text3)' }}>
                      {r.bonus > 0 ? fmt(d.bonus) : '—'}
                    </td>
                    <td className="td-num text-sm" style={{ color:r.overtime > 0 ? 'var(--text2)' : 'var(--text3)' }}>
                      {r.overtime > 0 ? fmt(d.overtime) : '—'}
                    </td>
                    <td className="td-num text-sm" style={{ ...groupSep, color:r.deductions > 0 ? 'var(--danger)' : 'var(--text3)' }}>
                      {r.deductions > 0 ? `− ${fmt(d.exceptional)}` : fmt(d.exceptional)}
                    </td>
                    <td>
                      {r.absences > 0
                        ? <span style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--danger)' }}>{r.absences}j</span>
                        : <span style={{ fontSize:12, color:'var(--text3)' }}>0</span>
                      }
                    </td>
                    <td className="td-num" style={groupSep}>
                      <span style={netPill}>{fmt(d.net)}</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CFG[r.status].cls}`}>{statusLabel(r.status, lang)}</span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button className="btn btn-sm btn-ghost stock-action gap-1" onClick={() => onView(r)}>
                          <Eye size={14} /> {lang === 'en' ? 'View' : lang === 'es' ? 'Ver' : lang === 'it' ? 'Visualizza' : 'Voir'}
                        </button>
                        {(r.status === 'EN ATTENTE' || r.status === 'GÉNÉRÉ') && (
                          <button className="btn btn-sm btn-ghost stock-action gap-1" onClick={() => onMarkPaid(r.id)}>
                            <Check size={14} /> {lang === 'en' ? 'Pay' : lang === 'es' ? 'Pagar' : lang === 'it' ? 'Paga' : 'Payer'}
                          </button>
                        )}
                        <button aria-label={lang === 'en' ? 'Download PDF' : lang === 'es' ? 'Descargar PDF' : lang === 'it' ? 'Scarica PDF' : 'Télécharger le PDF'} className="btn btn-sm btn-ghost stock-action gap-1" onClick={() => onPrintPDF(r)}>
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Ligne de total (fond bg2, valeurs mono) */}
              <tfoot>
                <tr style={{ background:'var(--bg2)', borderTop:'2px solid var(--border)' }}>
                  <td colSpan={2} style={{ fontSize:12, fontWeight:'var(--fw-bold)', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px' }}>
                    Total — {filtered.length} {filtered.length > 1 ? (lang === 'en' ? 'employees' : lang === 'es' ? 'empleados' : lang === 'it' ? 'dipendenti' : 'employés') : (lang === 'en' ? 'employee' : lang === 'es' ? 'empleado' : lang === 'it' ? 'dipendente' : 'employé')}
                  </td>
                  <td className="td-num text-sm" style={{ fontWeight:'var(--fw-semibold)', color:'var(--text2)' }}>{fmt(totals.base)}</td>
                  <td className="td-num text-sm" style={{ fontWeight:'var(--fw-semibold)', color:totals.bonus > 0 ? 'var(--text2)' : 'var(--text3)' }}>{totals.bonus > 0 ? fmt(totals.bonus) : '—'}</td>
                  <td className="td-num text-sm" style={{ fontWeight:'var(--fw-semibold)', color:totals.overtime > 0 ? 'var(--text2)' : 'var(--text3)' }}>{totals.overtime > 0 ? fmt(totals.overtime) : '—'}</td>
                  <td className="td-num text-sm" style={{ ...groupSep, fontWeight:'var(--fw-semibold)', color:totals.deductions > 0 ? 'var(--danger)' : 'var(--text3)' }}>{totals.deductions > 0 ? `− ${fmt(totals.deductions)}` : fmt(totals.deductions)}</td>
                  <td style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:totals.absences > 0 ? 'var(--danger)' : 'var(--text3)' }}>{totals.absences > 0 ? `${totals.absences}j` : '0'}</td>
                  <td className="td-num" style={groupSep}><span style={netPill}>{fmt(totals.net)}</span></td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
