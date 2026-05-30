import { FileText, Plus, AlertTriangle } from 'lucide-react'
import { type Employee, DEPT_COLORS, EmpAvatar, displayDate, toInputDate, roleLabel, deptLabel, contractLabel } from '@/components/hr/hrShared'

interface Props {
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  setSelectedContract: (e: any) => void; setShowContractDetailModal: (b: boolean) => void
  setContractForm: (v: any) => void; setShowNewContractModal: (b: boolean) => void
}

export default function HRContractsTab({ employees, fmt, lang, setSelectedContract, setShowContractDetailModal, setContractForm, setShowNewContractModal }: Props) {
  return (
    <div className="panel">
      <div className="panel-h" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span className="panel-t" style={{ display:'flex', alignItems:'center', gap:6 }}><FileText size={14}/> {lang === 'en' ? 'Active contracts' : lang === 'es' ? 'Contratos vigentes' : lang === 'it' ? 'Contratti in corso' : 'Contrats en cours'}</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setContractForm({ empId: '', type: 'CDI', hiredAt: new Date().toISOString().split('T')[0], contractEnd: '', salary: 0, role: '', dept: 'Ventes' }); setShowNewContractModal(true) }}>
          <Plus size={14} /> {lang === 'en' ? 'New contract' : lang === 'es' ? 'Nuevo contrato' : lang === 'it' ? 'Nuovo contratto' : 'Nouveau contrat'}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}</th>
              <th scope="col">{lang === 'en' ? 'Department' : lang === 'es' ? 'Departamento' : lang === 'it' ? 'Dipartimento' : 'Département'}</th>
              <th scope="col" style={{ textAlign: 'center' }}>{lang === 'en' ? 'Type' : lang === 'es' ? 'Tipo' : lang === 'it' ? 'Tipo' : 'Type'}</th>
              <th scope="col">{lang === 'en' ? 'Start date' : lang === 'es' ? 'Fecha inicio' : lang === 'it' ? 'Data inizio' : 'Date début'}</th>
              <th scope="col">{lang === 'en' ? 'End date' : lang === 'es' ? 'Fecha fin' : lang === 'it' ? 'Data fine' : 'Date fin'}</th>
              <th scope="col" style={{ textAlign: 'right' }}>{lang === 'en' ? 'Gross salary' : lang === 'es' ? 'Salario bruto' : lang === 'it' ? 'Stipendio lordo' : 'Salaire brut'}</th>
              <th scope="col" style={{ textAlign: 'center' }}>{lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'}</th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map(emp => {
              const deptColor = DEPT_COLORS[emp.dept] ?? emp.color
              const isExpiringSoon = emp.type === 'CDD' && emp.endAt
                ? (() => {
                    const iso = toInputDate(emp.endAt)
                    if (!iso) return false
                    const diff = (new Date(iso).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    return diff <= 30 && diff >= 0
                  })()
                : false
              return (
                <tr key={emp.id} onClick={() => { setSelectedContract(emp); setShowContractDetailModal(true) }} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <EmpAvatar emp={emp} size={32} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{roleLabel(emp.role, lang)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: deptColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: deptColor, fontWeight: 600 }}>{deptLabel(emp.dept, lang)}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: emp.type === 'CDI' ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                      color: emp.type === 'CDI' ? 'var(--p2)' : 'var(--acc2)',
                    }}>{contractLabel(emp.type, lang)}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {displayDate(emp.hiredAt, lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR')}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {emp.type === 'CDI' ? (
                      <span style={{ color:'var(--acc2)', fontWeight:600 }}>{lang === 'en' ? 'Permanent' : lang === 'es' ? 'Indefinido' : lang === 'it' ? 'Indeterminato' : 'Indéterminé'}</span>
                    ) : emp.endAt ? (
                      <span style={{ color: isExpiringSoon ? 'var(--danger)' : 'var(--text2)', fontWeight: isExpiringSoon ? 700 : 400 }}>
                        {isExpiringSoon && <AlertTriangle size={11} style={{display:'inline',verticalAlign:'middle',marginRight:3,flexShrink:0}} />}{displayDate(emp.endAt, lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR')}
                      </span>
                    ) : (
                      <span style={{ color:'var(--acc)', fontWeight:600 }}>{lang === 'en' ? 'To define' : lang === 'es' ? 'Por definir' : lang === 'it' ? 'Da definire' : 'À définir'}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(emp.salary)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: emp.active ? 'rgba(14,196,126,.12)' : 'var(--bg3)',
                      color: emp.active ? 'var(--acc2)' : 'var(--text3)',
                    }}>
                      {emp.active ? '✓ Actif' : '○ Inactif'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
