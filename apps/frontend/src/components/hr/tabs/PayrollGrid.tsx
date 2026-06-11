import { Download, FileText, DollarSign, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { useConfig, convertFromXOF } from '@/stores/appStore'
import { type Employee, EmpAvatar, roleLabel } from '@/components/hr/hrShared'

// Taux légaux appliqués partout dans la paie (cf. payroll-calc) — source unique pour calculs ET libellés
const CNSS_RATE = 0.08
const IR_RATE = 0.05

interface Props {
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  payrollMonth: string; setPayrollMonth: (v: string) => void
  bonuses: Record<string, number>
  generateAllPayslips: () => void
  setSalaryTarget: (v: any) => void; setShowSalaryModal: (b: boolean) => void
}

export default function PayrollGrid({ employees, fmt, lang, payrollMonth, setPayrollMonth, bonuses, generateAllPayslips, setSalaryTarget, setShowSalaryModal }: Props) {
  const { currency } = useConfig()
  return (
    <>
      {/* Contrôles */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input className="input" type="month"
          style={{ width:'auto' }}
          value={payrollMonth}
          onChange={e => setPayrollMonth(e.target.value)} />
        <button className="btn btn-sm" onClick={() => {
          const BOM = '﻿'
          const activeEmps = (employees ?? []).filter(e => e.active)
          // Montants stockés en base XOF → convertis vers la devise d'affichage (pattern reportsExport)
          const cv = (xof: number) => Math.round(convertFromXOF(xof ?? 0, currency) * 100) / 100
          const rows = [
            [
              lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé',
              lang === 'en' ? 'Role' : lang === 'es' ? 'Rol' : lang === 'it' ? 'Ruolo' : 'Rôle',
              `${lang === 'en' ? 'Gross' : lang === 'es' ? 'Bruto' : lang === 'it' ? 'Lordo' : 'Brut'} (${currency})`,
              `${lang === 'en' ? 'Bonus' : lang === 'es' ? 'Prima' : lang === 'it' ? 'Premio' : 'Prime'} (${currency})`,
              `CNSS ${CNSS_RATE * 100}% (${currency})`, `IR ${IR_RATE * 100}% (${currency})`,
              `${lang === 'en' ? 'Net' : lang === 'es' ? 'Neto' : lang === 'it' ? 'Netto' : 'Net'} (${currency})`,
            ],
            ...activeEmps.map(emp => {
              const brut  = emp.salary
              const bonus = bonuses[String(emp.id)] ?? 0
              const total = brut + bonus
              const cnss  = Math.round(total * CNSS_RATE)
              const ir    = Math.round(total * IR_RATE)
              const net   = total - cnss - ir
              return [emp.name, roleLabel(emp.role, lang), cv(brut), cv(bonus), cv(cnss), cv(ir), cv(net)]
            }),
          ]
          const csv = BOM + rows.map(r => r.join(';')).join('\r\n')
          const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `Paie_${payrollMonth}.csv`; a.click()
          URL.revokeObjectURL(url)
          toast.success(lang === 'en' ? '📊 Payroll export downloaded!' : lang === 'es' ? '📊 ¡Exportación de nómina descargada!' : lang === 'it' ? '📊 Esportazione buste paga scaricata!' : '📊 Export paie téléchargé !')
        }}><Download size={14} /> CSV</button>
        <button className="btn btn-primary btn-sm"
          onClick={() => generateAllPayslips()}
          style={{display:'flex',alignItems:'center',gap:5}}>
          <FileText size={13} /> {lang === 'en' ? 'All payslips' : lang === 'es' ? 'Todas las nóminas' : lang === 'it' ? 'Tutte le buste paga' : 'Tous les bulletins'}
        </button>
      </div>

      {/* KPIs paie */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {[
          { label: lang === 'en' ? 'Gross payroll' : lang === 'es' ? 'Masa salarial bruta' : lang === 'it' ? 'Costo del personale lordo' : 'Masse salariale brute', value: fmt(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)), color:'var(--p2)' },
          { label: 'CNSS (8%)', value: fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.08)), color:'var(--danger)' },
          { label: lang === 'en' ? 'Net to pay' : lang === 'es' ? 'Neto a pagar' : lang === 'it' ? 'Netto da pagare' : 'Net à payer', value: fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.92)), color:'var(--acc2)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:'var(--fw-semibold)', textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:20, fontWeight:'var(--fw-bold)', color:k.color, fontFamily:'var(--mono)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tableau paie */}
      <div className="panel">
        <div className="panel-h">
          <span className="panel-t" style={{display:'flex',alignItems:'center',gap:6}}>
            <DollarSign size={14}/> {lang === 'en' ? 'Payroll detail' : lang === 'es' ? 'Detalle de nómina' : lang === 'it' ? 'Dettaglio busta paga' : 'Détail de la paie'}{' — '}
            {new Date(payrollMonth+'-01').toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR',{month:'long',year:'numeric'})}
          </span>
          <button className="btn btn-primary btn-sm"
            onClick={() => { setShowSalaryModal(true); setSalaryTarget(null) }}>
            + {lang === 'en' ? 'Collective bonus' : lang === 'es' ? 'Prima colectiva' : lang === 'it' ? 'Premio collettivo' : 'Prime collective'}
          </button>
        </div>
        <div className="table-wrap data-table">
          <table>
            <thead>
              <tr>
                <th scope="col">{lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'}</th>
                <th scope="col" style={{textAlign:'right'}}>{lang === 'en' ? 'GROSS' : lang === 'es' ? 'BRUTO' : lang === 'it' ? 'LORDO' : 'BRUT'}</th>
                <th scope="col" style={{textAlign:'right'}}>{lang === 'en' ? 'BONUS' : lang === 'es' ? 'PRIMA' : lang === 'it' ? 'PREMIO' : 'PRIME'}</th>
                <th scope="col" style={{textAlign:'right'}}>CNSS 8%</th>
                <th scope="col" style={{textAlign:'right'}}>IR 5%</th>
                <th scope="col" style={{textAlign:'right'}}>{lang === 'en' ? 'NET' : lang === 'es' ? 'NETO' : lang === 'it' ? 'NETTO' : 'NET'}</th>
                <th scope="col" style={{textAlign:'center'}}>{lang === 'en' ? 'ACTIONS' : lang === 'es' ? 'ACCIONES' : lang === 'it' ? 'AZIONI' : 'ACTIONS'}</th>
              </tr>
            </thead>
            <tbody>
              {(employees ?? []).filter(e => e.active).map(emp => {
                const empId = String(emp.id)
                const brut  = Number(emp.salary)||0
                const bonus = bonuses[empId] ?? 0
                const total = brut + bonus
                const cnss  = Math.round(total * 0.08)
                const ir    = Math.round(total * 0.05)
                const net   = total - cnss - ir
                return (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <EmpAvatar emp={emp} size={32} />
                        <div>
                          <div style={{ fontWeight:'var(--fw-semibold)', fontSize:13 }}>{emp.name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)' }}>{roleLabel(emp.role, lang)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:'var(--fw-semibold)' }}>{fmt(brut)}</td>
                    <td style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                        <span style={{ fontFamily:'var(--mono)', fontSize:12, color: bonus>0 ? 'var(--acc2)' : 'var(--text3)' }}>
                          {bonus>0 ? `+${fmt(bonus)}` : '—'}
                        </span>
                        <button type="button"
                          onClick={() => { setSalaryTarget(emp); setShowSalaryModal(true) }}
                          style={{ width:20, height:20, borderRadius:5, background:'rgba(0,208,132,.1)', border:'1px solid rgba(0,208,132,.2)', cursor:'pointer', fontSize:11, color:'var(--acc2)', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                      </div>
                    </td>
                    <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--danger)', fontSize:12 }}>− {fmt(cnss)}</td>
                    <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc)', fontSize:12 }}>− {fmt(ir)}</td>
                    <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:'var(--fw-bold)', color:'var(--acc2)' }}>{fmt(net)}</td>
                    <td style={{ textAlign:'center' }}>
                      <button className="btn btn-sm" style={{ fontSize:11, padding:'3px 8px', display:'flex', alignItems:'center', gap:4 }}
                        onClick={() => { setSalaryTarget({...emp, mode:'raise'}); setShowSalaryModal(true) }}>
                        <TrendingUp size={11}/> {lang === 'en' ? 'Raise' : lang === 'es' ? 'Aumentar' : lang === 'it' ? 'Aumenta' : 'Augmenter'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'var(--bg4)' }}>
                <td style={{ fontWeight:'var(--fw-bold)', color:'var(--text)', padding:'12px 14px' }}>{lang === 'en' ? 'TOTAL' : lang === 'es' ? 'TOTAL' : lang === 'it' ? 'TOTALE' : 'TOTAL'}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:'var(--fw-bold)', color:'var(--p2)', padding:'12px 14px' }}>{fmt(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0))}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc2)', padding:'12px 14px' }}>{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--danger)', padding:'12px 14px' }}>− {fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.08))}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc)', padding:'12px 14px' }}>− {fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.05))}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:'var(--fw-bold)', fontSize:15, color:'var(--acc2)', padding:'12px 14px' }}>{fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.87))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}
