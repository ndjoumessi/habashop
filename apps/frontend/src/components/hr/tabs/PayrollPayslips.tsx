import { FileText } from 'lucide-react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type Employee, roleLabel, deptLabel } from '@/components/hr/hrShared'
// ⚠️ Taux et calcul importés de la SOURCE UNIQUE (`payrollShared`). Ce fichier codait
// `0.08`/`0.05` (ou `0.87`) en dur : 6 fichiers le faisaient, donc 6 endroits à corriger
// au prochain changement de loi — et un oubli aurait produit deux nets pour un salaire.
import { payrollBreakdown, CNSS_RATE, IR_RATE } from '@/components/payroll/payrollShared'

interface Props {
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  payrollMonth: string; setPayrollMonth: (v: string) => void
  bonuses: Record<string, number>
  generateAllPayslips: () => void
  generatePayslipPDF: (emp: any, data: any) => void
}

export default function PayrollPayslips({ employees, fmt, lang, payrollMonth, setPayrollMonth, bonuses, generateAllPayslips, generatePayslipPDF }: Props) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <label style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--text3)' }}>
          {lang === 'en' ? 'Period:' : lang === 'es' ? 'Período:' : lang === 'it' ? 'Periodo:' : 'Période :'}
        </label>
        <input className="input" type="month"
          style={{ width:'auto' }}
          value={payrollMonth}
          onChange={e => setPayrollMonth(e.target.value)} />
        <button className="topbar-btn"
          style={{ fontSize:12, padding:'7px 14px', display:'flex', alignItems:'center', gap:6 }}
          onClick={() => generateAllPayslips()}>
          <FileText size={13}/> {lang === 'en' ? 'Generate all payslips' : lang === 'es' ? 'Generar todas las nóminas' : lang === 'it' ? 'Genera tutte le buste paga' : 'Générer tous les bulletins'}
        </button>
      </div>

      <ResponsiveGrid min={300} gap={12}>
        {employees.filter(e => e.active !== false).map(emp => {
          const brut  = Number(emp.salary)||0
          const bonus = bonuses[String(emp.id)] ?? 0
          const { cnss, ir, net } = payrollBreakdown({ baseSalary: brut, bonus, overtime: 0, deductions: 0, absences: 0 })
          return (
            <div key={emp.id} style={{ background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:14, padding:18, transition:'all .2s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`linear-gradient(135deg,${emp.color??'var(--p)'},${emp.color??'var(--p)'}66)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:'var(--fw-bold)', color:'#fff', flexShrink:0 }}>
                  {emp.avatar ?? '??'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:'var(--fw-bold)', color:'var(--text)' }}>{emp.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{roleLabel(emp.role, lang)} · {deptLabel(emp.dept, lang)}</div>
                </div>
                <div style={{ fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', background:'rgba(0,208,132,.1)', color:'var(--acc2)', border:'1px solid rgba(0,208,132,.2)', borderRadius:20, padding:'2px 8px' }}>
                  {new Date(payrollMonth+'-01').toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', {month:'short', year:'numeric'})}
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                {[
                  { label: lang === 'en' ? 'Gross salary' : lang === 'es' ? 'Salario bruto' : lang === 'it' ? 'Stipendio lordo' : 'Salaire brut', value: fmt(brut), color:'var(--text2)', sign:'' },
                  ...(bonus > 0 ? [{ label: lang === 'en' ? 'Bonus' : lang === 'es' ? 'Prima' : lang === 'it' ? 'Premio' : 'Prime', value: fmt(bonus), color:'var(--acc2)', sign:'+' }] : []),
                  { label: 'CNSS (8%)', value: fmt(cnss), color:'var(--danger)', sign:'−' },
                  { label: 'IR (5%)',   value: fmt(ir),   color:'var(--acc)',    sign:'−' },
                ].map((row, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text3)' }}>{row.label}</span>
                    <span style={{ color:row.color, fontFamily:'var(--mono)', fontWeight:'var(--fw-semibold)' }}>{row.sign} {row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'rgba(0,208,132,.06)', border:'1px solid var(--c-green-bg)', borderRadius:10, marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:'var(--fw-bold)', color:'var(--text)' }}>
                  {lang === 'en' ? 'NET TO PAY' : lang === 'es' ? 'NETO A PAGAR' : lang === 'it' ? 'NETTO DA PAGARE' : 'NET À PAYER'}
                </span>
                <span style={{ fontSize:20, fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>
                  {fmt(net)}
                </span>
              </div>

              <button className="mini-btn"
                style={{ width:'100%', justifyContent:'center', display:'flex', alignItems:'center', gap:5 }}
                onClick={() => generatePayslipPDF(emp, { brut, bonus, cnss, ir, net, month: payrollMonth })}>
                <FileText size={13}/> {lang === 'en' ? 'Download payslip' : lang === 'es' ? 'Descargar nómina' : lang === 'it' ? 'Scarica busta paga' : 'Télécharger bulletin'}
              </button>
            </div>
          )
        })}
      </ResponsiveGrid>
    </div>
  )
}
