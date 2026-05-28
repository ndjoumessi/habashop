import { useState, useEffect, Fragment } from 'react'
import { Download, Plus, Users, DollarSign, FileText, TrendingUp, TrendingDown, Clock, Umbrella, CheckCircle, XCircle, AlertTriangle, Gift, Trash2, BarChart3, Calendar, CheckCheck, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { bonusesApi } from '@/lib/api'
import { type Employee, type LeaveRequest, DEPT_COLORS, LEAVE_STATUS_CFG, EmpAvatar, displayDate, toInputDate, roleLabel, deptLabel, contractLabel, attendStatusLabel, leaveStatusLabel } from '@/components/hr/hrShared'

// Couleur de badge selon la raison de la prime
function bonusReasonColor(reason: string): { bg: string; border: string; text: string } {
  const r = (reason || '').toLowerCase()
  if (r.includes('performance')) return { bg: 'rgba(0,208,132,.12)', border: 'rgba(0,208,132,.25)', text: 'var(--acc2)' }
  if (r.includes('fête') || r.includes('fete') || r.includes('holiday') || r.includes('fiesta') || r.includes('festa')) return { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.25)', text: 'var(--warn)' }
  return { bg: 'rgba(108,71,255,.12)', border: 'rgba(108,71,255,.25)', text: 'var(--p3)' }
}

// Couleur de badge selon la raison d'augmentation salariale (bg + text pour badge pilule)
function raiseReasonColor(reason: string): { bg: string; border: string; text: string } {
  const r = (reason || '').toLowerCase()
  if (r.includes('promotion') || r.includes('promoción') || r.includes('promozione')) return { bg: 'rgba(108,71,255,.12)', border: 'rgba(108,71,255,.25)', text: 'var(--p)' }
  if (r.includes('ancien') || r.includes('senior') || r.includes('antigü') || r.includes('anzian')) return { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.25)', text: '#F59E0B' }
  if (r.includes('ajust') || r.includes('adjust')) return { bg: 'rgba(99,102,241,.12)', border: 'rgba(99,102,241,.25)', text: '#6366F1' }
  if (r.includes('augment') || r.includes('aumento') || r.includes('increase') || r.includes('raise')) return { bg: 'rgba(0,200,83,.12)', border: 'rgba(0,200,83,.25)', text: '#00C853' }
  return { bg: 'var(--bg3)', border: 'var(--border)', text: 'var(--text2)' }
}

interface HRTabsProps {
  tab: string
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
  setSelectedContract: (e: any) => void; setShowContractDetailModal: (b: boolean) => void
  setContractForm: (v: any) => void; setShowNewContractModal: (b: boolean) => void
  attendance: Record<string, { in: string | null; out: string | null; status: 'present' | 'absent' | 'late' | 'half' }>; setAttendance: (v: any) => void
  attendanceDate: string; setAttendanceDate: (v: string) => void
  pendingLeaves: number
  leaves: LeaveRequest[]
  setLeaveForm: (v: any) => void; setShowLeaveModal: (b: boolean) => void
  handleLeaveAction: (id: number, status: 'approved' | 'refused') => void
}

export default function HRTabs({ tab, employees, fmt, lang, payTab, setPayTab, payrollMonth, setPayrollMonth, bonuses, setBonuses, bonusList, setBonusList, salaryHistory, onDeleteSalaryHistory, generateAllPayslips, generatePayslipPDF, setSalaryTarget, setShowSalaryModal, setSelectedContract, setShowContractDetailModal, setContractForm, setShowNewContractModal, attendance, setAttendance, attendanceDate, setAttendanceDate, pendingLeaves, leaves, setLeaveForm, setShowLeaveModal, handleLeaveAction }: HRTabsProps) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' && window.innerWidth < 880)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setIsMobile(window.innerWidth < 880)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [expandedEmpBonuses, setExpandedEmpBonuses] = useState<Set<string>>(new Set())
  const toggleExpandEmp = (empId: string) => setExpandedEmpBonuses(prev => {
    const next = new Set(prev)
    if (next.has(empId)) next.delete(empId); else next.add(empId)
    return next
  })
  const deleteOneBonus = (bonusId: string, empId: string, amount: number) => {
    setBonusList((prev: any[]) => prev.filter(b => b.id !== bonusId))
    setBonuses((prev: Record<string, number>) => {
      const next = { ...prev }
      const remaining = (next[empId] ?? 0) - amount
      if (remaining <= 0.0001) delete next[empId]
      else next[empId] = remaining
      return next
    })
    if (!bonusId.startsWith('local-')) bonusesApi.delete(bonusId).catch(() => {})
    toast.success(i('Prime supprimée', 'Bonus removed', 'Prima eliminada', 'Premio eliminato'))
  }
  return (
    <>
      {tab === 'contracts' && (
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
      )}

      {tab === 'payroll' && (
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
                  const rows = [
                    [
                      lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé',
                      lang === 'en' ? 'Role' : lang === 'es' ? 'Rol' : lang === 'it' ? 'Ruolo' : 'Rôle',
                      lang === 'en' ? 'Gross' : lang === 'es' ? 'Bruto' : lang === 'it' ? 'Lordo' : 'Brut',
                      lang === 'en' ? 'Bonus' : lang === 'es' ? 'Prima' : lang === 'it' ? 'Premio' : 'Prime',
                      'CNSS 8%', 'IR 5%',
                      lang === 'en' ? 'Net' : lang === 'es' ? 'Neto' : lang === 'it' ? 'Netto' : 'Net',
                    ],
                    ...activeEmps.map(emp => {
                      const brut  = emp.salary
                      const bonus = bonuses[String(emp.id)] ?? 0
                      const total = brut + bonus
                      const cnss  = Math.round(total * 0.08)
                      const ir    = Math.round(total * 0.05)
                      const net   = total - cnss - ir
                      return [emp.name, roleLabel(emp.role, lang), brut, bonus, cnss, ir, net]
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
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>{k.label}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:k.color, fontFamily:'var(--mono)' }}>{k.value}</div>
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
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'}</th>
                        <th scope="col" style={{textAlign:'right'}}>{lang === 'en' ? 'GROSS' : lang === 'es' ? 'BRUTO' : lang === 'it' ? 'LORDO' : 'BRUT'}</th>
                        <th scope="col" style={{textAlign:'right'}}>{lang === 'en' ? 'BONUS' : lang === 'es' ? 'PRIMA' : lang === 'it' ? 'PREMIO' : 'PRIME'}</th>
                        <th scope="col" style={{textAlign:'right'}}>CNSS 8%</th>
                        <th scope="col" style={{textAlign:'right'}}>IR 5%</th>
                        <th scope="col" style={{textAlign:'right'}}>NET</th>
                        <th scope="col" style={{textAlign:'center'}}>ACTIONS</th>
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
                                  <div style={{ fontWeight:700, fontSize:13 }}>{emp.name}</div>
                                  <div style={{ fontSize:10, color:'var(--text3)' }}>{roleLabel(emp.role, lang)}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:700 }}>{fmt(brut)}</td>
                            <td style={{ textAlign:'right' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                                <span style={{ fontFamily:'var(--mono)', fontSize:12, color: bonus>0 ? 'var(--acc2)' : 'var(--text3)' }}>
                                  {bonus>0 ? `+${fmt(bonus)}` : '—'}
                                </span>
                                <button type="button"
                                  onClick={() => { setSalaryTarget(emp); setShowSalaryModal(true) }}
                                  style={{ width:20, height:20, borderRadius:5, background:'rgba(0,208,132,.1)', border:'1px solid rgba(0,208,132,.2)', cursor:'pointer', fontSize:10, color:'var(--acc2)', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                              </div>
                            </td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--danger)', fontSize:12 }}>− {fmt(cnss)}</td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc)', fontSize:12 }}>− {fmt(ir)}</td>
                            <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:900, color:'var(--acc2)' }}>{fmt(net)}</td>
                            <td style={{ textAlign:'center' }}>
                              <button className="btn btn-sm" style={{ fontSize:10, padding:'3px 8px', display:'flex', alignItems:'center', gap:4 }}
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
                        <td style={{ fontWeight:800, color:'var(--text)', padding:'12px 14px' }}>TOTAL</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:800, color:'var(--p2)', padding:'12px 14px' }}>{fmt(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc2)', padding:'12px 14px' }}>{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--danger)', padding:'12px 14px' }}>− {fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.08))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', color:'var(--acc)', padding:'12px 14px' }}>− {fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.05))}</td>
                        <td style={{ textAlign:'right', fontFamily:'var(--mono)', fontWeight:900, fontSize:15, color:'var(--acc2)', padding:'12px 14px' }}>{fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.87))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── SOUS-ONGLET BULLETINS ── */}
          {payTab === 'payslip' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--text3)' }}>
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

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
                {employees.filter(e => e.active !== false).map(emp => {
                  const brut  = Number(emp.salary)||0
                  const bonus = bonuses[String(emp.id)] ?? 0
                  const total = brut + bonus
                  const cnss  = Math.round(total * 0.08)
                  const ir    = Math.round(total * 0.05)
                  const net   = total - cnss - ir
                  return (
                    <div key={emp.id} style={{ background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:14, padding:18, transition:'all .2s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                        <div style={{ width:40, height:40, borderRadius:11, background:`linear-gradient(135deg,${emp.color??'var(--p)'},${emp.color??'var(--p)'}66)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff', flexShrink:0 }}>
                          {emp.avatar ?? '??'}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{emp.name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)' }}>{roleLabel(emp.role, lang)} · {deptLabel(emp.dept, lang)}</div>
                        </div>
                        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', background:'rgba(0,208,132,.1)', color:'var(--acc2)', border:'1px solid rgba(0,208,132,.2)', borderRadius:20, padding:'2px 8px' }}>
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
                          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                            <span style={{ color:'var(--text3)' }}>{row.label}</span>
                            <span style={{ color:row.color, fontFamily:'var(--mono)', fontWeight:600 }}>{row.sign} {row.value}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'rgba(0,208,132,.06)', border:'1px solid var(--c-green-bg)', borderRadius:10, marginBottom:12 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>
                          {lang === 'en' ? 'NET TO PAY' : lang === 'es' ? 'NETO A PAGAR' : lang === 'it' ? 'NETTO DA PAGARE' : 'NET À PAYER'}
                        </span>
                        <span style={{ fontSize:20, fontWeight:900, color:'var(--acc2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>
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
              </div>
            </div>
          )}

          {/* ── SOUS-ONGLET PRIMES ── */}
          {payTab === 'bonuses' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button className="topbar-btn"
                  onClick={() => { setSalaryTarget(null); setShowSalaryModal(true) }}>
                  + {lang === 'en' ? 'New bonus' : lang === 'es' ? 'Nueva prima' : lang === 'it' ? 'Nuovo premio' : 'Nouvelle prime'}
                </button>
              </div>

              <div className="panel">
                <div className="panel-h">
                  <span className="panel-t" style={{display:'flex',alignItems:'center',gap:6}}><Gift size={14}/> {lang === 'en' ? 'Monthly bonuses' : lang === 'es' ? 'Primas del mes' : lang === 'it' ? 'Premi del mese' : 'Primes du mois'}</span>
                  <span style={{ fontSize:12, color:'var(--text3)' }}>
                    {lang === 'en' ? 'Total:' : lang === 'es' ? 'Total:' : lang === 'it' ? 'Totale:' : 'Total :'}{' '}
                    <strong style={{ color:'var(--acc2)' }}>{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}</strong>
                  </span>
                </div>

                {Object.keys(bonuses).length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><Gift size={36} style={{color:'var(--text4)'}}/></div>
                    <div style={{ fontSize:14, fontWeight:600 }}>
                      {lang === 'en' ? 'No bonuses this month' : lang === 'es' ? 'Sin primas este mes' : lang === 'it' ? 'Nessun premio questo mese' : 'Aucune prime ce mois'}
                    </div>
                    <div style={{ fontSize:12, marginTop:6 }}>
                      {lang === 'en' ? 'Click "+ New bonus" to add one' : lang === 'es' ? 'Haz clic en "+ Nueva prima" para agregar' : lang === 'it' ? 'Clicca su "+ Nuovo premio" per aggiungerne' : 'Cliquez sur "+ Nouvelle prime" pour en ajouter'}
                    </div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'}</th>
                          <th scope="col">{lang === 'en' ? 'AMOUNT' : lang === 'es' ? 'IMPORTE' : lang === 'it' ? 'IMPORTO' : 'MONTANT'}</th>
                          <th scope="col">{lang === 'en' ? '% OF SALARY' : lang === 'es' ? '% DEL SALARIO' : lang === 'it' ? '% DELLO STIPENDIO' : '% DU SALAIRE'}</th>
                          <th scope="col">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(bonuses).map(([empId, amount]) => {
                          const emp = employees.find(e => String(e.id) === empId)
                          if (!emp) {
                            return (
                              <tr key={empId} style={{ opacity: 0.6 }}>
                                <td colSpan={3}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <div style={{ width:30, height:30, borderRadius:8, background:'rgba(255,59,92,.12)', border:'1px solid rgba(255,59,92,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'var(--danger)' }}>⚠️</div>
                                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                                      <span style={{ fontSize:12, fontWeight:700, color:'var(--text2)' }}>
                                        {lang === 'en' ? 'Unknown employee' : lang === 'es' ? 'Empleado desconocido' : lang === 'it' ? 'Dipendente sconosciuto' : 'Employé inconnu'}
                                        {' '}— +{fmt(amount)}
                                      </span>
                                      <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>ID: {empId}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <button className="mini-btn"
                                    style={{ fontSize:10, padding:'3px 8px', color:'var(--danger)', borderColor:'rgba(255,59,92,.2)', display:'flex', alignItems:'center', gap:4 }}
                                    title={lang === 'en' ? 'Delete orphan bonuses for this id' : lang === 'es' ? 'Eliminar primas huérfanas de este id' : lang === 'it' ? 'Elimina premi orfani per questo id' : 'Supprimer les primes orphelines de cet id'}
                                    onClick={() => {
                                      const nb = {...bonuses}
                                      delete nb[empId]
                                      setBonuses(nb)
                                      const ids = bonusList.filter(b => b.empId === empId).map(b => b.id)
                                      setBonusList((prev: any[]) => prev.filter(b => b.empId !== empId))
                                      ids.forEach(id => { if (!id.startsWith('local-')) bonusesApi.delete(id).catch(()=>{}) })
                                      toast.success(lang === 'en' ? 'Orphan bonuses removed' : lang === 'es' ? 'Primas huérfanas eliminadas' : lang === 'it' ? 'Premi orfani eliminati' : 'Primes orphelines supprimées')
                                    }}>
                                    <Trash2 size={11}/> {lang === 'en' ? 'Remove' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'}
                                  </button>
                                </td>
                              </tr>
                            )
                          }
                          const pct = Number(emp.salary) > 0 ? Math.round((amount/Number(emp.salary))*100) : 0
                          const isExpanded = expandedEmpBonuses.has(empId)
                          const empBonuses = bonusList
                            .filter(b => b.empId === empId)
                            .slice()
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          return (
                            <Fragment key={empId}>
                              <tr>
                                <td>
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <button type="button"
                                      onClick={() => toggleExpandEmp(empId)}
                                      title={isExpanded ? i('Masquer le détail', 'Hide details', 'Ocultar detalles', 'Nascondi dettagli') : i('Voir le détail', 'Show details', 'Ver detalles', 'Mostra dettagli')}
                                      style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text3)', padding:2, display:'flex', alignItems:'center' }}>
                                      {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                    </button>
                                    <div style={{ width:30, height:30, borderRadius:8, background:`${emp.color??'var(--p)'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:emp.color??'var(--p)' }}>
                                      {emp.avatar ?? '??'}
                                    </div>
                                    <span style={{ fontWeight:700, fontSize:13 }}>{emp.name}</span>
                                    <span style={{ fontSize:10, color:'var(--text3)', background:'var(--bg3)', padding:'2px 6px', borderRadius:99 }}>{empBonuses.length}</span>
                                  </div>
                                </td>
                                <td style={{ fontFamily:'var(--mono)', color:'var(--acc2)', fontWeight:800 }}>+{fmt(amount)}</td>
                                <td>
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <div style={{ flex:1, height:6, background:'var(--bg5)', borderRadius:99, overflow:'hidden', maxWidth:100 }}>
                                      <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:'linear-gradient(90deg,var(--acc2),var(--p2))', borderRadius:99 }} />
                                    </div>
                                    <span style={{ fontSize:11, color:'var(--acc2)', fontFamily:'var(--mono)', fontWeight:700 }}>{pct}%</span>
                                  </div>
                                </td>
                                <td>
                                  <button className="mini-btn"
                                    style={{ fontSize:10, padding:'3px 8px', color:'var(--danger)', borderColor:'rgba(255,59,92,.2)', display:'flex', alignItems:'center', gap:4 }}
                                    onClick={() => {
                                      const nb = {...bonuses}
                                      delete nb[empId]
                                      setBonuses(nb)
                                      const ids = bonusList.filter(b => b.empId === empId).map(b => b.id)
                                      setBonusList(prev => prev.filter(b => b.empId !== empId))
                                      ids.forEach(id => { if (!id.startsWith('local-')) bonusesApi.delete(id).catch(()=>{}) })
                                      toast.success(lang === 'en' ? 'Bonus removed' : lang === 'es' ? 'Prima eliminada' : lang === 'it' ? 'Premio eliminato' : 'Prime supprimée')
                                    }}>
                                    <Trash2 size={11}/> {lang === 'en' ? 'Remove' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && empBonuses.map(b => {
                                const rc = bonusReasonColor(b.reason)
                                const d = b.date ? new Date(b.date).toLocaleDateString(
                                  lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR',
                                  { day:'2-digit', month:'short', year:'numeric' }) : '—'
                                return (
                                  <tr key={b.id} style={{ background:'var(--bg3)' }}>
                                    <td style={{ paddingLeft:32 }}>
                                      <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text2)' }}>
                                        <Calendar size={11} style={{ color:'var(--text3)' }} />
                                        <span>{d}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--acc2)', fontWeight:700 }}>+{fmt(b.amount)}</span>
                                    </td>
                                    <td>
                                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:rc.bg, border:`1px solid ${rc.border}`, color:rc.text }}>
                                        {b.reason || '—'}
                                      </span>
                                    </td>
                                    <td>
                                      <button type="button"
                                        title={i('Supprimer cette prime', 'Delete this bonus', 'Eliminar esta prima', 'Elimina questo premio')}
                                        aria-label={i('Supprimer cette prime', 'Delete this bonus', 'Eliminar esta prima', 'Elimina questo premio')}
                                        onClick={() => deleteOneBonus(b.id, empId, b.amount)}
                                        style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text3)', padding:4, borderRadius:6, display:'flex', alignItems:'center' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,59,92,.08)' }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                        <Trash2 size={12}/>
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {Object.keys(bonuses).length > 0 && (
                <div style={{ padding:'14px 18px', background:'rgba(0,208,132,.05)', border:'1px solid var(--c-green-bg)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                      <BarChart3 size={14} style={{color:'var(--acc2)',flexShrink:0}}/> {lang === 'en' ? 'Impact on payroll' : lang === 'es' ? 'Impacto en la masa salarial' : lang === 'it' ? 'Impatto sul costo del personale' : 'Impact sur la masse salariale'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {lang === 'en'
                        ? `${Object.keys(bonuses).length} employee(s) with bonus`
                        : lang === 'es'
                        ? `${Object.keys(bonuses).length} empleado(s) con prima`
                        : lang === 'it'
                        ? `${Object.keys(bonuses).length} dipendente(i) con premio`
                        : `${Object.keys(bonuses).length} employé(s) avec prime`}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:22, fontWeight:900, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                      +{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{lang === 'en' ? 'Total bonuses' : lang === 'es' ? 'Total primas' : lang === 'it' ? 'Totale premi' : 'Total primes'}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SOUS-ONGLET HISTORIQUE ── */}
          {payTab === 'history' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {salaryHistory.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', textAlign:'center', background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:20 }}>
                  <div style={{ width:72, height:72, borderRadius:20, background:'rgba(108,71,255,.1)', border:'1px solid rgba(108,71,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}><TrendingUp size={32} style={{color:'var(--p2)'}}/></div>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:8 }}>
                    {lang === 'en' ? 'No salary revisions yet' : lang === 'es' ? 'Sin revisiones salariales' : lang === 'it' ? 'Nessuna revisione salariale' : 'Aucune révision salariale'}
                  </div>
                  <div style={{ fontSize:13, color:'var(--text3)', maxWidth:300, lineHeight:1.6 }}>
                    {lang === 'en' ? 'Salary increases and revisions will appear here with their complete history.' : lang === 'es' ? 'Los aumentos y revisiones salariales aparecerán aquí con su historial completo.' : lang === 'it' ? 'Gli aumenti e le revisioni salariali appariranno qui con la cronologia completa.' : 'Les augmentations et révisions salariales apparaîtront ici avec leur historique complet.'}
                  </div>
                  <button className="topbar-btn"
                    style={{ marginTop:20, display:'flex', alignItems:'center', gap:6 }}
                    onClick={() => {
                      if (employees.length > 0) {
                        setSalaryTarget({ ...employees[0], mode:'raise' })
                        setShowSalaryModal(true)
                      }
                    }}>
                    <TrendingUp size={14}/> {lang === 'en' ? 'First salary revision' : lang === 'es' ? 'Primera revisión salarial' : lang === 'it' ? 'Prima revisione salariale' : 'Première révision salariale'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Timeline zigzag — cards alternées gauche/droite (colonne unique sur mobile) */}
                  <div style={{ position:'relative', padding:'20px 0', paddingLeft: isMobile ? 20 : 0 }}>
                    {/* Axe central */}
                    <div style={{
                      position:'absolute',
                      left: isMobile ? 12 : '50%',
                      top:0, bottom:0,
                      width:2, background:'var(--border)',
                      transform: isMobile ? 'none' : 'translateX(-50%)',
                    }}/>

                    {(() => {
                      const sorted = salaryHistory
                        .slice()
                        .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
                      return sorted.map((h, idx) => {
                      const emp   = employees.find(e => String(e.id) === (h.empId ?? (h as any).employeeId))
                      const diff  = (h.newSalary ?? 0) - (h.oldSalary ?? 0)
                      const pct   = Number(h.oldSalary) > 0
                        ? ((diff / Number(h.oldSalary)) * 100) : 0
                      const isUp  = diff >= 0
                      const date  = h.date || (h as any).createdAt
                        ? new Date(h.date || (h as any).createdAt).toLocaleDateString(
                            lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR',
                            { day:'numeric', month:'long', year:'numeric' }
                          )
                        : '—'
                      const reasonClr = raiseReasonColor(h.reason ?? '')
                      const isLeft = !isMobile && idx % 2 === 0
                      const initials = emp?.avatar ?? (emp ? emp.name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase() : '?')

                      return (
                        <div key={h.id ?? idx} style={{
                          display:'flex',
                          justifyContent: isMobile ? 'flex-start' : (isLeft ? 'flex-end' : 'flex-start'),
                          paddingLeft:  isMobile ? 12 : (isLeft ? 0 : 'calc(50% + 24px)'),
                          paddingRight: isMobile ? 0  : (isLeft ? 'calc(50% + 24px)' : 0),
                          marginBottom: 32,
                          position:'relative',
                        }}>
                          {/* Point sur l'axe */}
                          <div style={{
                            position:'absolute',
                            left: isMobile ? 12 : '50%',
                            top: 24,
                            transform:'translate(-50%, 0)',
                            width:14, height:14,
                            borderRadius:'50%',
                            background: isUp ? '#00C853' : 'var(--danger)',
                            border:'3px solid var(--bg)',
                            zIndex:1,
                            boxShadow: `0 0 0 3px ${isUp ? 'rgba(0,200,83,.2)' : 'rgba(255,59,92,.2)'}`,
                          }}/>

                          {/* Card */}
                          <div style={{
                            background:'var(--card)',
                            border:'1px solid var(--border)',
                            borderRadius:16,
                            padding:'16px 20px',
                            width:'calc(100% - 16px)',
                            maxWidth: 380,
                            boxShadow:'var(--sh-xs)',
                            position:'relative',
                          }}>
                            {/* Flèche vers l'axe */}
                            <div style={{
                              position:'absolute',
                              top: 20,
                              ...(isMobile
                                ? { left: -19, borderRight: '8px solid var(--border)' }
                                : isLeft
                                  ? { right: -8, borderLeft: '8px solid var(--border)' }
                                  : { left: -8, borderRight: '8px solid var(--border)' }
                              ),
                              width: 0, height: 0,
                              borderTop: '8px solid transparent',
                              borderBottom: '8px solid transparent',
                            }}/>

                            {/* Header : avatar + nom + badge type */}
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                              <div style={{
                                width:36, height:36, borderRadius:'50%',
                                background: emp?.color ?? 'var(--p)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:13, fontWeight:700, color:'#fff',
                                flexShrink:0,
                              }}>
                                {initials}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{
                                  fontWeight:700, fontSize:14,
                                  color:'var(--text)',
                                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                }}>
                                  {emp?.name ?? i('Employé inconnu', 'Unknown', 'Desconocido', 'Sconosciuto')}
                                </div>
                                {emp && (emp.role || emp.dept) && (
                                  <div style={{ fontSize:11, color:'var(--text2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    {emp.role ? roleLabel(emp.role, lang) : ''}
                                    {emp.role && emp.dept ? ' · ' : ''}
                                    {emp.dept ? deptLabel(emp.dept, lang) : ''}
                                  </div>
                                )}
                              </div>
                              <span style={{
                                fontSize:10, fontWeight:700,
                                padding:'3px 8px', borderRadius:99,
                                background: reasonClr.bg,
                                color: reasonClr.text,
                                border: `1px solid ${reasonClr.border}`,
                                flexShrink:0,
                                whiteSpace:'nowrap',
                              }}>
                                {h.reason || i('Augmentation', 'Increase', 'Aumento', 'Aumento')}
                              </span>
                            </div>

                            {/* Date */}
                            <div style={{
                              fontSize:11, color:'var(--text3)',
                              marginBottom:10,
                              display:'flex', alignItems:'center', gap:4,
                            }}>
                              <Calendar size={11} />
                              {date}
                            </div>

                            {/* Salaires ancien → nouveau */}
                            <div style={{
                              display:'flex', alignItems:'center',
                              gap:8, marginBottom:10,
                              fontSize:14,
                            }}>
                              <span style={{
                                color:'var(--text3)',
                                textDecoration:'line-through',
                                fontFamily:'var(--mono)',
                              }}>
                                {fmt(h.oldSalary)}
                              </span>
                              <span style={{ color:'var(--text2)' }}>→</span>
                              <span style={{
                                fontWeight:900, color:'var(--text)',
                                fontFamily:'var(--mono)',
                                fontSize:16,
                              }}>
                                {fmt(h.newSalary)}
                              </span>
                            </div>

                            {/* Delta */}
                            <div style={{
                              display:'flex', alignItems:'center',
                              gap:6, marginBottom: h.reason ? 8 : 0,
                            }}>
                              {isUp
                                ? <TrendingUp size={14} color="#00C853" />
                                : <TrendingDown size={14} color="var(--danger)" />}
                              <span style={{
                                fontSize:13, fontWeight:700,
                                color: isUp ? '#00C853' : 'var(--danger)',
                                fontFamily:'var(--mono)',
                              }}>
                                {isUp ? '+' : ''}{fmt(diff)} ({isUp ? '+' : ''}{pct.toFixed(1)}%)
                              </span>
                            </div>

                            {/* Raison en italique */}
                            {h.reason && (
                              <div style={{
                                fontSize:12, color:'var(--text2)',
                                fontStyle:'italic', marginBottom:8,
                              }}>
                                "{h.reason}"
                              </div>
                            )}

                            {/* Bouton supprimer */}
                            {onDeleteSalaryHistory && h.id && (
                              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
                                <button
                                  type="button"
                                  onClick={() => onDeleteSalaryHistory(h.id!)}
                                  title={i('Supprimer la révision salariale', 'Delete salary revision', 'Eliminar revisión salarial', 'Elimina revisione salariale')}
                                  aria-label={i('Supprimer la révision salariale', 'Delete salary revision', 'Eliminar revisión salarial', 'Elimina revisione salariale')}
                                  style={{
                                    color:'var(--danger)', cursor:'pointer',
                                    background:'none', border:'none',
                                    display:'flex', alignItems:'center', gap:4,
                                    fontSize:11, opacity:0.7,
                                    padding:'8px 12px', minHeight:44,
                                    borderRadius:8,
                                    fontFamily:'var(--font)',
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                                >
                                  <Trash2 size={11} />
                                  {i('Supprimer', 'Delete', 'Eliminar', 'Elimina')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                    })()}
                  </div>

                  {/* Stats résumé en bas */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',
                    gap:10, marginTop:4,
                  }}>
                    {[
                      {
                        label: lang === 'en' ? 'Revisions' : lang === 'es' ? 'Revisiones' : lang === 'it' ? 'Revisioni' : 'Révisions',
                        value: salaryHistory.length,
                        icon: <FileText size={16} />, color:'var(--p2)',
                      },
                      {
                        label: lang === 'en' ? 'Employees' : lang === 'es' ? 'Empleados' : lang === 'it' ? 'Dipendenti' : 'Employés',
                        value: new Set(salaryHistory.map(h => h.empId)).size,
                        icon: <Users size={16} />, color:'var(--acc3)',
                      },
                      {
                        label: lang === 'en' ? 'Avg raise' : lang === 'es' ? 'Aumento medio' : lang === 'it' ? 'Aumento medio' : 'Hausse moy.',
                        value: (() => {
                          const pcts = salaryHistory.map(h =>
                            Number(h.oldSalary) > 0
                              ? ((h.newSalary - h.oldSalary) / h.oldSalary) * 100
                              : 0
                          )
                          const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length
                          return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`
                        })(),
                        icon: <TrendingUp size={16} />, color:'var(--acc2)',
                      },
                      {
                        label: lang === 'en' ? 'Total impact' : lang === 'es' ? 'Impacto total' : lang === 'it' ? 'Impatto totale' : 'Impact total',
                        value: fmt(salaryHistory.reduce((s, h) => s + (h.newSalary - h.oldSalary), 0)),
                        icon: <DollarSign size={16} />, color:'var(--warn)',
                      },
                    ].map(k => (
                      <div key={k.label} style={{
                        background:'var(--grad-card)',
                        border:'1px solid var(--border)',
                        borderRadius:12, padding:'12px 14px',
                        display:'flex', alignItems:'center', gap:10,
                        transition:'all .15s',
                      }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'
                          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                          ;(e.currentTarget as HTMLElement).style.transform = 'none'
                        }}
                      >
                        <div style={{
                          width:34, height:34, borderRadius:10,
                          background:'rgba(255,255,255,.04)',
                          display:'flex', alignItems:'center',
                          justifyContent:'center', color:k.color,
                          flexShrink:0,
                        }}>{k.icon}</div>
                        <div>
                          <div style={{
                            fontSize:9, fontWeight:700,
                            textTransform:'uppercase', letterSpacing:'.5px',
                            color:'var(--text3)', marginBottom:2,
                          }}>{k.label}</div>
                          <div style={{
                            fontSize:16, fontWeight:900,
                            color:k.color, fontFamily:'var(--mono)',
                            letterSpacing:'-.5px',
                          }}>{k.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'pointage' && (() => {
        const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
          present: { label: lang === 'en' ? 'Present' : lang === 'es' ? 'Presente' : lang === 'it' ? 'Presente' : 'Présent',  color:'var(--acc2)', bg:'rgba(0,208,132,.1)',  icon:<CheckCircle size={11}/> },
          late:    { label: lang === 'en' ? 'Late' : lang === 'es' ? 'Retraso' : lang === 'it' ? 'Ritardo' : 'Retard',      color:'#F59E0B', bg:'rgba(245,158,11,.1)', icon:<Clock size={11}/> },
          absent:  { label: lang === 'en' ? 'Absent' : lang === 'es' ? 'Ausente' : lang === 'it' ? 'Assente' : 'Absent',    color:'#EF4444', bg:'rgba(239,68,68,.1)',  icon:<XCircle size={11}/> },
          half:    { label: lang === 'en' ? 'Half' : lang === 'es' ? 'Media jornada' : lang === 'it' ? 'Mezza giornata' : 'Mi-temps',    color:'#3B82F6', bg:'rgba(59,130,246,.1)', icon:<AlertTriangle size={11}/> },
        }

        const dayEmp = employees.filter(e => e.active !== false)
        const todayKey = attendanceDate

        const countByStatus = (s: string) => dayEmp.filter(e => (attendance[`${String(e.id)}_${todayKey}`]?.status ?? 'absent') === s).length
        const presentCount = countByStatus('present') + countByStatus('late') + countByStatus('half')

        const exportAttendanceCSV = () => {
          const rows = dayEmp.map(e => {
            const key = `${String(e.id)}_${todayKey}`
            const a = attendance[key]
            return [e.name, roleLabel(e.role, lang), attendStatusLabel(a?.status ?? 'absent', lang), a?.in ?? '—', a?.out ?? '—']
          })
          const lines = [['Employé','Poste','Statut','Arrivée','Départ'], ...rows]
          const csv = lines.map(r => r.join(';')).join('\n')
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `pointage_${todayKey}.csv`; a.click()
          URL.revokeObjectURL(url)
        }

        const markAllPresent = () => {
          const now = new Date()
          const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
          const updates: typeof attendance = {}
          dayEmp.forEach(e => {
            const key = `${String(e.id)}_${todayKey}`
            updates[key] = { in: hhmm, out: null, status: 'present' }
          })
          setAttendance(prev => ({ ...prev, ...updates }))
        }

        const setEmpField = (empId: string, field: 'in'|'out'|'status', value: string) => {
          const key = `${empId}_${todayKey}`
          setAttendance(prev => ({
            ...prev,
            [key]: { ...(prev[key] ?? { in: null, out: null, status: 'absent' }), [field]: value },
          }))
        }

        return (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Header toolbar */}
            <div className="panel" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:16, fontWeight:800, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                <Clock size={16}/> {lang === 'en' ? 'Attendance sheet' : lang === 'es' ? 'Hoja de asistencia' : lang === 'it' ? 'Foglio presenze' : 'Feuille de présence'}
              </span>
              <input type="date" className="input" value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
                style={{ width:150, height:34, fontSize:13 }} />
              <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                <button className="btn btn-sm" onClick={markAllPresent} style={{display:'flex',alignItems:'center',gap:5}}>
                  <CheckCheck size={13}/> {lang === 'en' ? 'All present' : lang === 'es' ? 'Todos presentes' : lang === 'it' ? 'Tutti presenti' : 'Tous présents'}
                </button>
                <button className="btn btn-sm" onClick={exportAttendanceCSV} style={{display:'flex',alignItems:'center',gap:5}}>
                  <Download size={13}/> CSV
                </button>
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                { icon:<CheckCircle size={20}/>, label:lang === 'en' ? 'Present' : lang === 'es' ? 'Presentes' : lang === 'it' ? 'Presenti' : 'Présents',  count:presentCount,          color:'var(--acc2)', hex:'var(--acc2)' },
                { icon:<Clock size={20}/>,       label:lang === 'en' ? 'Late' : lang === 'es' ? 'Retrasos' : lang === 'it' ? 'Ritardi' : 'Retards',      count:countByStatus('late'), color:'#F59E0B', hex:'#F59E0B' },
                { icon:<XCircle size={20}/>,     label:lang === 'en' ? 'Absent' : lang === 'es' ? 'Ausentes' : lang === 'it' ? 'Assenti' : 'Absents',    count:countByStatus('absent'),color:'#EF4444', hex:'#EF4444' },
                { icon:<AlertTriangle size={20}/>,label:lang === 'en' ? 'Half-day' : lang === 'es' ? 'Media jornada' : lang === 'it' ? 'Mezza giornata' : 'Mi-temps', count:countByStatus('half'), color:'#3B82F6', hex:'#3B82F6' },
              ].map(k => (
                <div key={k.label} className="panel" style={{ padding:'12px 14px', position:'relative', overflow:'hidden', background:`linear-gradient(135deg,${k.hex}18,${k.hex}06)`, border:`1px solid ${k.hex}28` }}>
                  <div style={{ position:'absolute', top:-16, right:-16, width:64, height:64, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}20 0%,transparent 70%)`, pointerEvents:'none' }} />
                  <div style={{ color:k.color, marginBottom:6, display:'flex' }}>{k.icon}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:k.color, fontFamily:'var(--mono)' }}>{k.count}</div>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginTop:2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Employee rows */}
            <div className="panel" style={{ overflow:'hidden', padding:0 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 110px 110px', gap:0, padding:'10px 16px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)' }}>
                <span>{lang === 'en' ? 'Employee' : lang === 'es' ? 'Empleado' : lang === 'it' ? 'Dipendente' : 'Employé'}</span>
                <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Status' : lang === 'es' ? 'Estado' : lang === 'it' ? 'Stato' : 'Statut'}</span>
                <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Arrival' : lang === 'es' ? 'Llegada' : lang === 'it' ? 'Arrivo' : 'Arrivée'}</span>
                <span style={{ textAlign:'center' }}>{lang === 'en' ? 'Departure' : lang === 'es' ? 'Salida' : lang === 'it' ? 'Uscita' : 'Départ'}</span>
                <span style={{ textAlign:'center' }}>Actions</span>
              </div>
              {dayEmp.map((emp, i) => {
                const key = `${String(emp.id)}_${todayKey}`
                const a = attendance[key] ?? { in: null, out: null, status: 'absent' as const }
                const sc = STATUS_CONFIG[a.status]
                return (
                  <div key={emp.id} style={{
                    display:'grid', gridTemplateColumns:'1fr 90px 90px 110px 110px',
                    alignItems:'center', gap:0,
                    padding:'10px 16px',
                    borderBottom: i < dayEmp.length-1 ? '1px solid var(--border)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'var(--bg4)',
                  }}>
                    {/* Employé */}
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:`${emp.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:emp.color, flexShrink:0 }}>
                        {emp.avatar}
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{emp.name.split(' ')[0]}</div>
                        <div style={{ fontSize:10, color:'var(--text3)' }}>{roleLabel(emp.role, lang)}</div>
                      </div>
                    </div>
                    {/* Statut badge */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background:sc.bg, color:sc.color, display:'inline-flex', alignItems:'center', gap:4 }}>
                        {sc.icon} {attendStatusLabel(a.status, lang)}
                      </span>
                    </div>
                    {/* Heure arrivée */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <input type="time" className="input" value={a.in ?? ''}
                        onChange={e => setEmpField(String(emp.id), 'in', e.target.value)}
                        style={{ width:80, height:30, fontSize:12, textAlign:'center', padding:'0 4px' }} />
                    </div>
                    {/* Heure départ */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <input type="time" className="input" value={a.out ?? ''}
                        onChange={e => setEmpField(String(emp.id), 'out', e.target.value)}
                        style={{ width:80, height:30, fontSize:12, textAlign:'center', padding:'0 4px' }} />
                    </div>
                    {/* Boutons statut */}
                    <div style={{ display:'flex', justifyContent:'center', gap:4 }}>
                      {(['present','late','absent','half'] as const).map(s => (
                        <button key={s} type="button"
                          onClick={() => setEmpField(String(emp.id), 'status', s)}
                          title={STATUS_CONFIG[s].label}
                          style={{
                            width:26, height:26, borderRadius:6, border:'none', cursor:'pointer',
                            background: a.status === s ? STATUS_CONFIG[s].bg : 'var(--bg3)',
                            color: STATUS_CONFIG[s].color,
                            outline: a.status === s ? `1.5px solid ${STATUS_CONFIG[s].color}` : 'none',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                          {STATUS_CONFIG[s].icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary footer */}
            <div className="panel" style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>
                {lang === 'en' ? 'Day of' : lang === 'es' ? 'Día del' : lang === 'it' ? 'Giornata del' : 'Journée du'} <strong style={{ color:'var(--text)' }}>{new Date(attendanceDate + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR', { weekday:'long', day:'numeric', month:'long' })}</strong>
              </span>
              <span style={{ fontSize:12, color:'var(--text3)', marginLeft:'auto' }}>
                {presentCount}/{dayEmp.length} {lang === 'en' ? 'present' : lang === 'es' ? 'presentes' : lang === 'it' ? 'presenti' : 'présents'} · {dayEmp.length > 0 ? Math.round(presentCount/dayEmp.length*100) : 0}% {lang === 'en' ? 'attendance rate' : lang === 'es' ? 'de asistencia' : lang === 'it' ? 'di presenza' : 'de présence'}
              </span>
            </div>
          </div>
        )
      })()}

      {tab === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingLeaves > 0 && (
            <div style={{ padding: '14px 16px', background: 'rgba(240,165,0,.1)', border: '1px solid rgba(240,165,0,.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} style={{ color: 'var(--acc)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--acc)' }}>
                {pendingLeaves} demande{pendingLeaves > 1 ? 's' : ''} de congé en attente de validation
              </span>
            </div>
          )}

          <div className="panel">
            <div className="panel-h">
              <span className="panel-t" style={{ display:'flex', alignItems:'center', gap:6 }}><Umbrella size={14}/> {lang === 'en' ? 'Leave requests' : lang === 'es' ? 'Solicitudes de permiso' : lang === 'it' ? 'Richieste di permesso' : 'Demandes de congés'}</span>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setLeaveForm({ empId: 0, type: lang === 'en' ? 'Annual leave' : lang === 'es' ? 'Permiso anual' : lang === 'it' ? 'Ferie annuali' : 'Congé annuel', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '' })
                setShowLeaveModal(true)
              }}>
                <Plus size={14} /> {lang === 'en' ? 'New request' : lang === 'es' ? 'Nueva solicitud' : lang === 'it' ? 'Nuova richiesta' : 'Nouvelle demande'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(leaves ?? []).map(leave => {
                const emp = (employees ?? []).find(e => e.id === leave.empId || Number(e.id) === leave.empId)
                const displayName = emp?.name ?? leave.empName ?? '—'
                const statusCfg = LEAVE_STATUS_CFG[leave.status]
                return (
                  <div key={leave.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, flexWrap: 'wrap' }}>
                    {emp && <EmpAvatar emp={emp} size={38} />}
                    {!emp && (
                      <div style={{ width:38, height:38, borderRadius:'50%', background:'#6C47FF22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'var(--p)', flexShrink:0 }}>
                        {displayName.slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{displayName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        {leave.type} · {leave.from} → {leave.to} · <strong>{leave.days}j</strong>
                      </div>
                      {leave.motif && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>"{leave.motif}"</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, whiteSpace: 'nowrap' }}>
                      {leaveStatusLabel(leave.status, lang)}
                    </span>
                    {leave.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(14,196,126,.15)', border: '1px solid rgba(14,196,126,.3)', color: 'var(--acc2)' }}
                          onClick={() => handleLeaveAction(leave.id, 'approved')}>
                          ✓ {lang === 'en' ? 'Approve' : lang === 'es' ? 'Aprobar' : lang === 'it' ? 'Approva' : 'Approuver'}
                        </button>
                        <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(232,64,74,.12)', border: '1px solid rgba(232,64,74,.25)', color: 'var(--danger)' }}
                          onClick={() => handleLeaveAction(leave.id, 'refused')}>
                          ✕ {lang === 'en' ? 'Reject' : lang === 'es' ? 'Rechazar' : lang === 'it' ? 'Rifiuta' : 'Refuser'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {(leaves ?? []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: 14 }}>
                  {lang === 'en' ? 'No leave requests' : lang === 'es' ? 'Sin solicitudes de permiso' : lang === 'it' ? 'Nessuna richiesta di permesso' : 'Aucune demande de congé'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
