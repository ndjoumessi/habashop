import { useConfig, useFormatAmount } from '@/stores/appStore'
import { Download, Eye, Check, Zap } from 'lucide-react'
import { MONTHS, monthLabel, roleLabel, statusLabel, STATUS_CFG, EmpAvatar, calcNet } from './payrollShared'
import type { PayRecord } from './payrollShared'

interface Props {
  month: string
  setMonth: (m: string) => void
  filtered: PayRecord[]
  onExportCSV: () => void
  onGenerate: () => void
  onView: (r: PayRecord) => void
  onMarkPaid: (id: number) => void
  onPrintPDF: (r: PayRecord) => void
}

export default function PayrollTable(props: Props) {
  const { month, setMonth, filtered, onExportCSV, onGenerate, onView, onMarkPaid, onPrintPDF } = props
  const { lang } = useConfig()
  const fmt = useFormatAmount()

  return (
    <>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <select className="input" value={month} onChange={e => setMonth(e.target.value)}
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
            <table>
              <thead>
                <tr>
                  <th scope="col">{lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}</th><th scope="col">{lang === 'en' ? 'Role' : lang === 'es' ? 'Puesto' : lang === 'it' ? 'Ruolo' : 'Poste'}</th><th scope="col">{lang === 'en' ? 'Base' : lang === 'es' ? 'Base' : lang === 'it' ? 'Base' : 'Base'}</th>
                  <th scope="col">{lang === 'en' ? 'Bonuses' : lang === 'es' ? 'Primas' : lang === 'it' ? 'Premi' : 'Primes'}</th><th scope="col">{lang === 'en' ? 'Overtime' : lang === 'es' ? 'Horas extra' : lang === 'it' ? 'Straordinari' : 'Heures sup.'}</th><th scope="col">{lang === 'en' ? 'Deductions' : lang === 'es' ? 'Deducciones' : lang === 'it' ? 'Detrazioni' : 'Retenues'}</th>
                  <th scope="col">{lang === 'en' ? 'Absences' : lang === 'es' ? 'Ausencias' : lang === 'it' ? 'Assenze' : 'Absences'}</th><th scope="col">NET</th><th scope="col">{lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'}</th><th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <EmpAvatar r={r} size={30} />
                        <span className="td-bold" style={{ fontSize:12 }}>{r.employee}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text3)' }}>{roleLabel(r.role, lang)}</td>
                    <td className="td-num text-sm">{fmt(r.baseSalary)}</td>
                    <td className="td-num text-sm" style={{ color:r.bonus > 0 ? 'var(--acc2)' : 'var(--text3)' }}>
                      {r.bonus > 0 ? fmt(r.bonus) : '—'}
                    </td>
                    <td className="td-num text-sm" style={{ color:r.overtime > 0 ? 'var(--p2)' : 'var(--text3)' }}>
                      {r.overtime > 0 ? fmt(r.overtime) : '—'}
                    </td>
                    <td className="td-num text-sm" style={{ color:'var(--danger)' }}>
                      {fmt(r.deductions)}
                    </td>
                    <td>
                      {r.absences > 0
                        ? <span style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--danger)' }}>{r.absences}j</span>
                        : <span style={{ fontSize:12, color:'var(--text3)' }}>0</span>
                      }
                    </td>
                    <td className="td-num" style={{ color:'var(--acc2)' }}>{fmt(calcNet(r))}</td>
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
            </table>
          </div>
        )}
      </div>
    </>
  )
}
