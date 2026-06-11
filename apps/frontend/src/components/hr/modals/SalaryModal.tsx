import { TrendingUp, Gift } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import { type Employee } from '@/components/hr/hrShared'
import SalaryRaiseForm from './SalaryRaiseForm'
import BonusForm from './BonusForm'

interface Props {
  salaryTarget: any
  lang: string
  fmt: (n: number) => string
  employees: Employee[]
  handleConfirmRaise: (empId: string, newSalaryXOF: number, reason: string) => void
  handleConfirmBonus: (empId: string, amountXOF: number, type: string) => void
  onClose: () => void
}

export default function SalaryModal({ salaryTarget, lang, fmt, employees, handleConfirmRaise, handleConfirmBonus, onClose }: Props) {
  const boxRef = useModalFocus<HTMLDivElement>()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={salaryTarget?.mode === 'raise' ? (lang === 'en' ? 'Salary raise' : lang === 'es' ? 'Aumento salarial' : lang === 'it' ? 'Aumento salariale' : 'Augmentation salariale') : (lang === 'en' ? 'Add bonus' : lang === 'es' ? 'Agregar una prima' : lang === 'it' ? 'Aggiungi un premio' : 'Ajouter une prime')} onClick={e => e.target===e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth:400 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ fontSize:15, fontWeight:'var(--fw-semibold)', color:'var(--text)', margin:0, display:'flex', alignItems:'center', gap:8 }}>
            {salaryTarget?.mode === 'raise'
              ? <><TrendingUp size={15} style={{color:'var(--acc2)',flexShrink:0}}/>{lang === 'en' ? 'Salary raise' : lang === 'es' ? 'Aumento salarial' : lang === 'it' ? 'Aumento salariale' : 'Augmentation salariale'}</>
              : <><Gift size={15} style={{color:'var(--acc)',flexShrink:0}}/>{lang === 'en' ? 'Add bonus' : lang === 'es' ? 'Agregar una prima' : lang === 'it' ? 'Aggiungi un premio' : 'Ajouter une prime'}{salaryTarget ? ` — ${salaryTarget.name}` : ''}</>}
          </h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {salaryTarget?.mode === 'raise' ? (
          <SalaryRaiseForm
            emp={salaryTarget}
            lang={lang}
            fmt={fmt}
            onConfirm={(newSalary: number, reason: string) => {
              handleConfirmRaise(String(salaryTarget.id), newSalary, reason)
            }}
            onClose={onClose}
          />
        ) : (
          <BonusForm
            emp={salaryTarget}
            employees={(employees ?? []).filter(e => e.active)}
            lang={lang}
            fmt={fmt}
            onConfirm={(empId: string|'all', amount: number, reason?: string) => {
              handleConfirmBonus(empId, amount, reason ?? '')
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
