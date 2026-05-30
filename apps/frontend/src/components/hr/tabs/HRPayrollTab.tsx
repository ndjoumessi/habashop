import { DollarSign, FileText, Gift, TrendingUp } from 'lucide-react'
import { type Employee } from '@/components/hr/hrShared'
import PayrollGrid from './PayrollGrid'
import PayrollPayslips from './PayrollPayslips'
import PayrollBonuses from './PayrollBonuses'
import PayrollHistory from './PayrollHistory'

interface Props {
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  payTab: 'grid' | 'payslip' | 'bonuses' | 'history'; setPayTab: (v: any) => void
  payrollMonth: string; setPayrollMonth: (v: string) => void
  bonuses: Record<string, number>; setBonuses: (v: any) => void
  bonusList: { id: string; empId: string; amount: number; reason: string; date: string }[]; setBonusList: (v: any) => void
  salaryHistory: any[]
  onDeleteSalaryHistory?: (id: string) => void
  generateAllPayslips: () => void
  generatePayslipPDF: (emp: any, data: any) => void
  setSalaryTarget: (v: any) => void; setShowSalaryModal: (b: boolean) => void
}

export default function HRPayrollTab(props: Props) {
  const { fmt, lang, payTab, setPayTab, employees, payrollMonth, setPayrollMonth, bonuses, setBonuses, bonusList, setBonusList, salaryHistory, onDeleteSalaryHistory, generateAllPayslips, generatePayslipPDF, setSalaryTarget, setShowSalaryModal } = props
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Sous-onglets */}
      <div style={{ display:'flex', gap:4, background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:10, padding:4 }}>
        {([
          { id:'grid',    icon:<DollarSign size={13}/>, label: lang === 'en' ? 'Grid' : lang === 'es' ? 'Cuadrícula' : lang === 'it' ? 'Griglia' : 'Grille'     },
          { id:'payslip', icon:<FileText size={13}/>,   label: lang === 'en' ? 'Payslips' : lang === 'es' ? 'Nóminas' : lang === 'it' ? 'Buste paga' : 'Bulletins' },
          { id:'bonuses', icon:<Gift size={13}/>,        label: lang === 'en' ? 'Bonuses' : lang === 'es' ? 'Primas' : lang === 'it' ? 'Premi' : 'Primes'  },
          { id:'history', icon:<TrendingUp size={13}/>, label: lang === 'en' ? 'History' : lang === 'es' ? 'Historial' : lang === 'it' ? 'Cronologia' : 'Historique'  },
        ] as const).map(t => (
          <button key={t.id} type="button"
            onClick={() => setPayTab(t.id)}
            style={{
              flex:1, padding:'7px', borderRadius:8, fontSize:12,
              fontWeight:700, cursor:'pointer', fontFamily:'var(--font)', border:'none',
              background: payTab===t.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'transparent',
              color: payTab===t.id ? '#fff' : 'var(--text3)',
              transition:'all .15s',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            }}>
            {'icon' in t && <span style={{opacity:payTab===t.id?1:.6,display:'flex'}}>{(t as any).icon}</span>}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SOUS-ONGLET GRILLE ── */}
      {payTab === 'grid' && (
        <PayrollGrid
          employees={employees} fmt={fmt} lang={lang}
          payrollMonth={payrollMonth} setPayrollMonth={setPayrollMonth}
          bonuses={bonuses} generateAllPayslips={generateAllPayslips}
          setSalaryTarget={setSalaryTarget} setShowSalaryModal={setShowSalaryModal}
        />
      )}

      {/* ── SOUS-ONGLET BULLETINS ── */}
      {payTab === 'payslip' && (
        <PayrollPayslips
          employees={employees} fmt={fmt} lang={lang}
          payrollMonth={payrollMonth} setPayrollMonth={setPayrollMonth}
          bonuses={bonuses} generateAllPayslips={generateAllPayslips} generatePayslipPDF={generatePayslipPDF}
        />
      )}

      {/* ── SOUS-ONGLET PRIMES ── */}
      {payTab === 'bonuses' && (
        <PayrollBonuses
          employees={employees} fmt={fmt} lang={lang}
          bonuses={bonuses} setBonuses={setBonuses}
          bonusList={bonusList} setBonusList={setBonusList}
          setSalaryTarget={setSalaryTarget} setShowSalaryModal={setShowSalaryModal}
        />
      )}

      {/* ── SOUS-ONGLET HISTORIQUE ── */}
      {payTab === 'history' && (
        <PayrollHistory
          employees={employees} fmt={fmt} lang={lang}
          salaryHistory={salaryHistory} onDeleteSalaryHistory={onDeleteSalaryHistory}
          setSalaryTarget={setSalaryTarget} setShowSalaryModal={setShowSalaryModal}
        />
      )}
    </div>
  )
}
