import { FileText } from 'lucide-react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type Employee, roleLabel, deptLabel } from '@/components/hr/hrShared'
// ⚠️ Taux et calcul importés de la SOURCE UNIQUE (`payrollShared`). Ce fichier codait
// `0.08`/`0.05` (ou `0.87`) en dur : 6 fichiers le faisaient, donc 6 endroits à corriger
// au prochain changement de loi — et un oubli aurait produit deux nets pour un salaire.
import { payrollDisplay, fmtDisplay, printBulletin, payRecordFromEmployee, CNSS_RATE, IR_RATE } from '@/components/payroll/payrollShared'
import { useConfig } from '@/stores/appStore'
import { MonthField } from '@/components/ui/DatePicker'

interface Props {
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  payrollMonth: string; setPayrollMonth: (v: string) => void
  bonuses: Record<string, number>
  generateAllPayslips: () => void
}

export default function PayrollPayslips({ employees, fmt: _fmt, lang, payrollMonth, setPayrollMonth, bonuses, generateAllPayslips }: Props) {
  const { currency } = useConfig()
  // ⚠️ Montants DÉJÀ convertis par `payrollDisplay` (total = somme des lignes, net = brut −
  // total) → formatage sans reconversion. Le `fmt` reçu en prop convertirait depuis XOF et
  // ferait diverger cette carte du bulletin PDF d'un centime en devise à décimales.
  const fmt = (v: number) => fmtDisplay(v, currency)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <label style={{ fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)', color:'var(--text3)' }}>
          {lang === 'en' ? 'Period:' : lang === 'es' ? 'Período:' : lang === 'it' ? 'Periodo:' : 'Période :'}
        </label>
        <MonthField
          ariaLabel={lang === 'en' ? 'Payroll period' : lang === 'es' ? 'Período de nómina' : lang === 'it' ? 'Periodo di paga' : 'Période de paie'}
          value={payrollMonth}
          onChange={setPayrollMonth} />
        <button className="topbar-btn"
          style={{ fontSize:'var(--fs-label)', padding:'7px 14px', display:'flex', alignItems:'center', gap:6 }}
          onClick={() => generateAllPayslips()}>
          <FileText size={13}/> {lang === 'en' ? 'Generate all payslips' : lang === 'es' ? 'Generar todas las nóminas' : lang === 'it' ? 'Genera tutte le buste paga' : 'Générer tous les bulletins'}
        </button>
      </div>

      <ResponsiveGrid min={300} gap={12}>
        {employees.filter(e => e.active !== false).map(emp => {
          const brut  = Number(emp.salary)||0
          const bonus = bonuses[String(emp.id)] ?? 0
          const d = payrollDisplay({ baseSalary: brut, bonus, overtime: 0, deductions: 0, absences: 0 }, currency)
          const { cnss, ir, net } = d
          return (
            <div key={emp.id} style={{ background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:14, padding:18, transition:'all .2s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`linear-gradient(135deg,${emp.color??'var(--p)'},${emp.color??'var(--p)'}66)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-body)', fontWeight:'var(--fw-bold)', color:'#fff', flexShrink:0 }}>
                  {emp.avatar ?? '??'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-bold)', color:'var(--text)' }}>{emp.name}</div>
                  <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)' }}>{roleLabel(emp.role, lang)} · {deptLabel(emp.dept, lang)}</div>
                </div>
                <div style={{ fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)', textTransform:'uppercase', background:'rgba(0,208,132,.1)', color:'var(--acc2)', border:'1px solid rgba(0,208,132,.2)', borderRadius:20, padding:'2px 8px' }}>
                  {new Date(payrollMonth+'-01').toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', {month:'short', year:'numeric'})}
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                {[
                  { label: lang === 'en' ? 'Gross salary' : lang === 'es' ? 'Salario bruto' : lang === 'it' ? 'Stipendio lordo' : 'Salaire brut', value: fmt(d.baseSalary), color:'var(--text2)', sign:'' },
                  ...(bonus > 0 ? [{ label: lang === 'en' ? 'Bonus' : lang === 'es' ? 'Prima' : lang === 'it' ? 'Premio' : 'Prime', value: fmt(d.bonus), color:'var(--acc2)', sign:'+' }] : []),
                  { label: `CNSS (${CNSS_RATE * 100}%)`, value: fmt(cnss), color:'var(--danger)', sign:'−' },
                  { label: `IR (${IR_RATE * 100}%)`,     value: fmt(ir),   color:'var(--acc)',    sign:'−' },
                ].map((row, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'var(--fs-label)', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text3)' }}>{row.label}</span>
                    <span style={{ color:row.color, fontFamily:'var(--mono)', fontWeight:'var(--fw-semibold)' }}>{row.sign} {row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'rgba(0,208,132,.06)', border:'1px solid var(--c-green-bg)', borderRadius:10, marginBottom:12 }}>
                <span style={{ fontSize:'var(--fs-sm)', fontWeight:'var(--fw-bold)', color:'var(--text)' }}>
                  {lang === 'en' ? 'NET TO PAY' : lang === 'es' ? 'NETO A PAGAR' : lang === 'it' ? 'NETTO DA PAGARE' : 'NET À PAYER'}
                </span>
                <span style={{ fontSize:'var(--fs-xl)', fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>
                  {fmt(net)}
                </span>
              </div>

              <button className="mini-btn"
                style={{ width:'100%', justifyContent:'center', display:'flex', alignItems:'center', gap:5 }}
                onClick={() => printBulletin(payRecordFromEmployee(emp, bonus, payrollMonth))}>
                <FileText size={13}/> {lang === 'en' ? 'Download payslip' : lang === 'es' ? 'Descargar nómina' : lang === 'it' ? 'Scarica busta paga' : 'Télécharger bulletin'}
              </button>
            </div>
          )
        })}
      </ResponsiveGrid>
    </div>
  )
}
