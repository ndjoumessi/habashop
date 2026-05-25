import { Download, Plus, Users, DollarSign, FileText, TrendingUp, Clock, Umbrella, CheckCircle, XCircle, AlertTriangle, Gift, Trash2, BarChart3, Calendar, CheckCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { bonusesApi } from '@/lib/api'
import { type Employee, type LeaveRequest, DEPT_COLORS, LEAVE_STATUS_CFG, EmpAvatar, displayDate, toInputDate } from '@/components/hr/hrShared'

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

export default function HRTabs({ tab, employees, fmt, lang, payTab, setPayTab, payrollMonth, setPayrollMonth, bonuses, setBonuses, bonusList, setBonusList, salaryHistory, generateAllPayslips, generatePayslipPDF, setSalaryTarget, setShowSalaryModal, setSelectedContract, setShowContractDetailModal, setContractForm, setShowNewContractModal, attendance, setAttendance, attendanceDate, setAttendanceDate, pendingLeaves, leaves, setLeaveForm, setShowLeaveModal, handleLeaveAction }: HRTabsProps) {
  return (
    <>
      {tab === 'contracts' && (
        <div className="panel">
          <div className="panel-h" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span className="panel-t" style={{ display:'flex', alignItems:'center', gap:6 }}><FileText size={14}/> {lang === 'fr' ? 'Contrats en cours' : 'Active contracts'}</span>
            <button className="btn btn-primary btn-sm" onClick={() => { setContractForm({ empId: '', type: 'CDI', hiredAt: new Date().toISOString().split('T')[0], contractEnd: '', salary: 0, role: '', dept: 'Ventes' }); setShowNewContractModal(true) }}>
              <Plus size={14} /> {lang === 'fr' ? 'Nouveau contrat' : 'New contract'}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Employé</th>
                  <th scope="col">Département</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Type</th>
                  <th scope="col">Date début</th>
                  <th scope="col">Date fin</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Salaire brut</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Statut</th>
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
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: deptColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: deptColor, fontWeight: 600 }}>{emp.dept}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: emp.type === 'CDI' ? 'rgba(108,71,255,.15)' : 'rgba(14,196,126,.12)',
                          color: emp.type === 'CDI' ? 'var(--p2)' : 'var(--acc2)',
                        }}>{emp.type}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {displayDate(emp.hiredAt, lang==='fr'?'fr-FR':'en-US')}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {emp.type === 'CDI' ? (
                          <span style={{ color:'var(--acc2)', fontWeight:600 }}>{lang==='fr'?'Indéterminé':'Permanent'}</span>
                        ) : emp.endAt ? (
                          <span style={{ color: isExpiringSoon ? 'var(--danger)' : 'var(--text2)', fontWeight: isExpiringSoon ? 700 : 400 }}>
                            {isExpiringSoon && <AlertTriangle size={11} style={{display:'inline',verticalAlign:'middle',marginRight:3,flexShrink:0}} />}{displayDate(emp.endAt, lang==='fr'?'fr-FR':'en-US')}
                          </span>
                        ) : (
                          <span style={{ color:'var(--acc)', fontWeight:600 }}>{lang==='fr'?'À définir':'To define'}</span>
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
              { id:'grid',    icon:<DollarSign size={13}/>, label: lang==='fr' ? 'Grille'     : 'Grid'     },
              { id:'payslip', icon:<FileText size={13}/>,   label: lang==='fr' ? 'Bulletins'  : 'Payslips' },
              { id:'bonuses', icon:<Gift size={13}/>,        label: lang==='fr' ? 'Primes'     : 'Bonuses'  },
              { id:'history', icon:<TrendingUp size={13}/>, label: lang==='fr' ? 'Historique' : 'History'  },
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
                    ['Employé','Rôle','Brut','Prime','CNSS 8%','IR 5%','Net'],
                    ...activeEmps.map(emp => {
                      const brut  = emp.salary
                      const bonus = bonuses[String(emp.id)] ?? 0
                      const total = brut + bonus
                      const cnss  = Math.round(total * 0.08)
                      const ir    = Math.round(total * 0.05)
                      const net   = total - cnss - ir
                      return [emp.name, emp.role, brut, bonus, cnss, ir, net]
                    }),
                  ]
                  const csv = BOM + rows.map(r => r.join(';')).join('\r\n')
                  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `Paie_${payrollMonth}.csv`; a.click()
                  URL.revokeObjectURL(url)
                  toast.success('📊 Export paie téléchargé !')
                }}><Download size={14} /> CSV</button>
                <button className="btn btn-primary btn-sm"
                  onClick={() => generateAllPayslips()}
                  style={{display:'flex',alignItems:'center',gap:5}}>
                  <FileText size={13} /> {lang === 'fr' ? 'Tous les bulletins' : 'All payslips'}
                </button>
              </div>

              {/* KPIs paie */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[
                  { label: lang==='fr' ? 'Masse salariale brute' : 'Gross payroll', value: fmt(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)), color:'var(--p2)' },
                  { label: 'CNSS (8%)', value: fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.08)), color:'var(--danger)' },
                  { label: lang==='fr' ? 'Net à payer' : 'Net to pay', value: fmt(Math.round(employees.filter(e=>e.active).reduce((s,e)=>s+(Number(e.salary)||0),0)*0.92)), color:'var(--acc2)' },
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
                    <DollarSign size={14}/> {lang==='fr' ? 'Détail de la paie' : 'Payroll detail'}{' — '}
                    {new Date(payrollMonth+'-01').toLocaleDateString(lang==='fr'?'fr-FR':'en-US',{month:'long',year:'numeric'})}
                  </span>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => { setShowSalaryModal(true); setSalaryTarget(null) }}>
                    + {lang==='fr' ? 'Prime collective' : 'Collective bonus'}
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{lang==='fr'?'EMPLOYÉ':'EMPLOYEE'}</th>
                        <th scope="col" style={{textAlign:'right'}}>{lang==='fr'?'BRUT':'GROSS'}</th>
                        <th scope="col" style={{textAlign:'right'}}>{lang==='fr'?'PRIME':'BONUS'}</th>
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
                                  <div style={{ fontSize:10, color:'var(--text3)' }}>{emp.role}</div>
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
                                <TrendingUp size={11}/> {lang==='fr'?'Augmenter':'Raise'}
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
                  {lang==='fr' ? 'Période :' : 'Period:'}
                </label>
                <input className="input" type="month"
                  style={{ width:'auto' }}
                  value={payrollMonth}
                  onChange={e => setPayrollMonth(e.target.value)} />
                <button className="topbar-btn"
                  style={{ fontSize:12, padding:'7px 14px', display:'flex', alignItems:'center', gap:6 }}
                  onClick={() => generateAllPayslips()}>
                  <FileText size={13}/> {lang==='fr' ? 'Générer tous les bulletins' : 'Generate all payslips'}
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
                          <div style={{ fontSize:11, color:'var(--text3)' }}>{emp.role} · {emp.dept}</div>
                        </div>
                        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', background:'rgba(0,208,132,.1)', color:'var(--acc2)', border:'1px solid rgba(0,208,132,.2)', borderRadius:20, padding:'2px 8px' }}>
                          {new Date(payrollMonth+'-01').toLocaleDateString(lang==='fr'?'fr-FR':'en-US', {month:'short', year:'numeric'})}
                        </div>
                      </div>

                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                        {[
                          { label: lang==='fr'?'Salaire brut':'Gross salary', value: fmt(brut), color:'var(--text2)', sign:'' },
                          ...(bonus > 0 ? [{ label: lang==='fr'?'Prime':'Bonus', value: fmt(bonus), color:'var(--acc2)', sign:'+' }] : []),
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
                          {lang==='fr' ? 'NET À PAYER' : 'NET TO PAY'}
                        </span>
                        <span style={{ fontSize:20, fontWeight:900, color:'var(--acc2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>
                          {fmt(net)}
                        </span>
                      </div>

                      <button className="mini-btn"
                        style={{ width:'100%', justifyContent:'center', display:'flex', alignItems:'center', gap:5 }}
                        onClick={() => generatePayslipPDF(emp, { brut, bonus, cnss, ir, net, month: payrollMonth })}>
                        <FileText size={13}/> {lang==='fr' ? 'Télécharger bulletin' : 'Download payslip'}
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
                  + {lang==='fr' ? 'Nouvelle prime' : 'New bonus'}
                </button>
              </div>

              <div className="panel">
                <div className="panel-h">
                  <span className="panel-t" style={{display:'flex',alignItems:'center',gap:6}}><Gift size={14}/> {lang==='fr' ? 'Primes du mois' : 'Monthly bonuses'}</span>
                  <span style={{ fontSize:12, color:'var(--text3)' }}>
                    {lang==='fr' ? 'Total :' : 'Total:'}{' '}
                    <strong style={{ color:'var(--acc2)' }}>{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}</strong>
                  </span>
                </div>

                {Object.keys(bonuses).length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)' }}>
                    <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}><Gift size={36} style={{color:'var(--text4)'}}/></div>
                    <div style={{ fontSize:14, fontWeight:600 }}>
                      {lang==='fr' ? 'Aucune prime ce mois' : 'No bonuses this month'}
                    </div>
                    <div style={{ fontSize:12, marginTop:6 }}>
                      {lang==='fr' ? 'Cliquez sur "+ Nouvelle prime" pour en ajouter' : 'Click "+ New bonus" to add one'}
                    </div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{lang==='fr'?'EMPLOYÉ':'EMPLOYEE'}</th>
                          <th scope="col">{lang==='fr'?'MONTANT':'AMOUNT'}</th>
                          <th scope="col">{lang==='fr'?'% DU SALAIRE':'% OF SALARY'}</th>
                          <th scope="col">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(bonuses).map(([empId, amount]) => {
                          const emp = employees.find(e => String(e.id) === empId)
                          if (!emp) return null
                          const pct = Number(emp.salary) > 0 ? Math.round((amount/Number(emp.salary))*100) : 0
                          return (
                            <tr key={empId}>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <div style={{ width:30, height:30, borderRadius:8, background:`${emp.color??'var(--p)'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:emp.color??'var(--p)' }}>
                                    {emp.avatar ?? '??'}
                                  </div>
                                  <span style={{ fontWeight:700, fontSize:13 }}>{emp.name}</span>
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
                                    toast.success(lang==='fr' ? 'Prime supprimée' : 'Bonus removed')
                                  }}>
                                  <Trash2 size={11}/> {lang==='fr' ? 'Supprimer' : 'Remove'}
                                </button>
                              </td>
                            </tr>
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
                      <BarChart3 size={14} style={{color:'var(--acc2)',flexShrink:0}}/> {lang==='fr' ? 'Impact sur la masse salariale' : 'Impact on payroll'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {lang==='fr'
                        ? `${Object.keys(bonuses).length} employé(s) avec prime`
                        : `${Object.keys(bonuses).length} employee(s) with bonus`}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:22, fontWeight:900, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                      +{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{lang==='fr' ? 'Total primes' : 'Total bonuses'}</div>
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
                    {lang==='fr' ? 'Aucune révision salariale' : 'No salary revisions yet'}
                  </div>
                  <div style={{ fontSize:13, color:'var(--text3)', maxWidth:300, lineHeight:1.6 }}>
                    {lang==='fr'
                      ? 'Les augmentations et révisions salariales apparaîtront ici avec leur historique complet.'
                      : 'Salary increases and revisions will appear here with their complete history.'}
                  </div>
                  <button className="topbar-btn"
                    style={{ marginTop:20, display:'flex', alignItems:'center', gap:6 }}
                    onClick={() => {
                      if (employees.length > 0) {
                        setSalaryTarget({ ...employees[0], mode:'raise' })
                        setShowSalaryModal(true)
                      }
                    }}>
                    <TrendingUp size={14}/> {lang==='fr' ? 'Première révision salariale' : 'First salary revision'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Timeline verticale enrichie */}
                  <div style={{
                    display:'flex', flexDirection:'column', gap:0,
                    position:'relative',
                  }}>
                    {/* Ligne verticale centrale */}
                    <div style={{
                      position:'absolute',
                      left:28, top:20, bottom:20,
                      width:2,
                      background:'linear-gradient(180deg,var(--p),var(--p2),var(--acc2))',
                      borderRadius:99,
                      opacity:.3,
                    }}/>

                    {[...salaryHistory].reverse().map((h, i) => {
                      const emp   = employees.find(e => String(e.id) === (h.empId ?? (h as any).employeeId))
                      const diff  = h.newSalary - h.oldSalary
                      const pct   = Number(h.oldSalary) > 0
                        ? ((diff / Number(h.oldSalary)) * 100) : 0
                      const isPos = diff >= 0
                      const date  = h.date
                        ? new Date(h.date).toLocaleDateString(
                            lang === 'fr' ? 'fr-FR' : 'en-US',
                            { day:'numeric', month:'short', year:'numeric' }
                          )
                        : '—'

                      return (
                        <div key={i} style={{
                          display:'flex', gap:0,
                          alignItems:'stretch',
                        }}>
                          {/* Colonne gauche : point */}
                          <div style={{
                            width:58, flexShrink:0,
                            display:'flex', flexDirection:'column',
                            alignItems:'center',
                            position:'relative',
                          }}>
                            <div style={{
                              width:18, height:18,
                              borderRadius:'50%', flexShrink:0,
                              marginTop:20,
                              background: isPos
                                ? 'linear-gradient(135deg,var(--acc2),var(--p2))'
                                : 'linear-gradient(135deg,var(--danger),var(--warn))',
                              boxShadow: isPos
                                ? '0 0 12px rgba(0,208,132,.5)'
                                : '0 0 12px rgba(255,59,92,.5)',
                              border:'2px solid var(--bg)',
                              zIndex:1,
                              display:'flex', alignItems:'center',
                              justifyContent:'center',
                              fontSize:9, color:'#fff', fontWeight:900,
                            }}>
                              {isPos ? '↑' : '↓'}
                            </div>
                          </div>

                          {/* Carte principale */}
                          <div style={{
                            flex:1, marginBottom:12,
                            background:'var(--grad-card)',
                            border:`1px solid ${isPos
                              ? 'rgba(0,208,132,.15)' : 'rgba(255,59,92,.15)'}`,
                            borderRadius:16,
                            overflow:'hidden',
                            transition:'all .2s',
                          }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'
                              ;(e.currentTarget as HTMLElement).style.boxShadow =
                                isPos ? '0 4px 20px rgba(0,208,132,.1)' : '0 4px 20px rgba(255,59,92,.1)'
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'none'
                              ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                            }}
                          >
                            {/* Bande couleur haut */}
                            <div style={{
                              height:3,
                              background: isPos
                                ? 'linear-gradient(90deg,var(--acc2),var(--p2)33)'
                                : 'linear-gradient(90deg,var(--danger),var(--warn)33)',
                            }}/>

                            <div style={{
                              padding:'14px 18px',
                              display:'flex', alignItems:'center',
                              gap:14, flexWrap:'wrap',
                            }}>
                              {/* Avatar employé */}
                              <div style={{
                                width:42, height:42, borderRadius:12,
                                flexShrink:0,
                                background:`${emp?.color ?? 'var(--p)'}22`,
                                border:`2px solid ${emp?.color ?? 'var(--p)'}33`,
                                display:'flex', alignItems:'center',
                                justifyContent:'center',
                                fontSize:14, fontWeight:900,
                                color:emp?.color ?? 'var(--p)',
                                boxShadow:`0 2px 8px ${emp?.color ?? 'var(--p)'}25`,
                              }}>
                                {emp?.avatar ?? '??'}
                              </div>

                              {/* Infos employé */}
                              <div style={{ flex:1, minWidth:140 }}>
                                <div style={{
                                  fontSize:14, fontWeight:800,
                                  color:'var(--text)', marginBottom:3,
                                }}>
                                  {emp?.name ?? (lang === 'fr' ? 'Employé' : 'Employee')}
                                </div>
                                <div style={{
                                  display:'flex', alignItems:'center',
                                  gap:6, flexWrap:'wrap',
                                }}>
                                  <span style={{ fontSize:10, color:'var(--text3)', display:'inline-flex', alignItems:'center', gap:3 }}>
                                    <Calendar size={9}/> {date}
                                  </span>
                                  {h.reason && (
                                    <span style={{
                                      fontSize:10, fontWeight:600,
                                      background:'rgba(108,71,255,.1)',
                                      color:'var(--p3)',
                                      border:'1px solid rgba(108,71,255,.15)',
                                      borderRadius:99, padding:'1px 7px',
                                    }}>
                                      {h.reason}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Évolution salaire */}
                              <div style={{
                                display:'flex', flexDirection:'column',
                                alignItems:'flex-end', gap:4,
                              }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                  <span style={{
                                    fontSize:13, color:'var(--text3)',
                                    fontFamily:'var(--mono)',
                                    textDecoration:'line-through',
                                    opacity:.6,
                                  }}>
                                    {fmt(h.oldSalary)}
                                  </span>
                                  <div style={{ width:24, height:1, background:'var(--border2)' }}/>
                                  <span style={{
                                    fontSize:16, fontWeight:900,
                                    color:'var(--text)',
                                    fontFamily:'var(--mono)',
                                    letterSpacing:'-.5px',
                                  }}>
                                    {fmt(h.newSalary)}
                                  </span>
                                </div>

                                {/* Badge % */}
                                <div style={{
                                  display:'inline-flex',
                                  alignItems:'center', gap:5,
                                  padding:'4px 12px',
                                  background: isPos
                                    ? 'rgba(0,208,132,.1)'
                                    : 'rgba(255,59,92,.1)',
                                  border:`1px solid ${isPos
                                    ? 'rgba(0,208,132,.2)' : 'rgba(255,59,92,.2)'}`,
                                  borderRadius:99,
                                }}>
                                  <span style={{ fontSize:11 }}>{isPos ? '↗' : '↘'}</span>
                                  <span style={{
                                    fontSize:13, fontWeight:900,
                                    color: isPos ? 'var(--acc2)' : 'var(--danger)',
                                    fontFamily:'var(--mono)',
                                  }}>
                                    {isPos ? '+' : ''}{pct.toFixed(1)}%
                                  </span>
                                  <span style={{
                                    fontSize:11,
                                    color: isPos ? 'var(--acc2)' : 'var(--danger)',
                                    opacity:.75,
                                  }}>
                                    ({isPos ? '+' : ''}{fmt(Math.abs(diff))})
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Barre progression */}
                            <div style={{ padding:'0 18px 14px' }}>
                              <div style={{
                                height:4,
                                background:'rgba(255,255,255,.06)',
                                borderRadius:99, overflow:'hidden',
                              }}>
                                <div style={{
                                  height:'100%',
                                  width:`${Math.min(100, Math.abs(pct) * 1.5)}%`,
                                  background: isPos
                                    ? 'linear-gradient(90deg,var(--acc2),var(--p2))'
                                    : 'linear-gradient(90deg,var(--danger),var(--warn))',
                                  borderRadius:99,
                                  transition:'width .6s ease',
                                  boxShadow: isPos
                                    ? '0 0 8px rgba(0,208,132,.4)'
                                    : '0 0 8px rgba(255,59,92,.4)',
                                }}/>
                              </div>
                              <div style={{
                                display:'flex', justifyContent:'space-between',
                                marginTop:4,
                              }}>
                                <span style={{ fontSize:9, color:'var(--text4)' }}>
                                  {lang === 'fr' ? 'Évolution' : 'Evolution'}
                                </span>
                                <span style={{
                                  fontSize:9, fontFamily:'var(--mono)',
                                  color: isPos ? 'var(--acc2)' : 'var(--danger)',
                                  fontWeight:700,
                                }}>
                                  {isPos ? '+' : ''}{pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Stats résumé en bas */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',
                    gap:10, marginTop:4,
                  }}>
                    {[
                      {
                        label: lang === 'fr' ? 'Révisions' : 'Revisions',
                        value: salaryHistory.length,
                        icon: <FileText size={16} />, color:'var(--p2)',
                      },
                      {
                        label: lang === 'fr' ? 'Employés' : 'Employees',
                        value: new Set(salaryHistory.map(h => h.empId)).size,
                        icon: <Users size={16} />, color:'var(--acc3)',
                      },
                      {
                        label: lang === 'fr' ? 'Hausse moy.' : 'Avg raise',
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
                        label: lang === 'fr' ? 'Impact total' : 'Total impact',
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
          present: { label: lang==='fr'?'Présent':'Present',  color:'var(--acc2)', bg:'rgba(0,208,132,.1)',  icon:<CheckCircle size={11}/> },
          late:    { label: lang==='fr'?'Retard':'Late',      color:'#F59E0B', bg:'rgba(245,158,11,.1)', icon:<Clock size={11}/> },
          absent:  { label: lang==='fr'?'Absent':'Absent',    color:'#EF4444', bg:'rgba(239,68,68,.1)',  icon:<XCircle size={11}/> },
          half:    { label: lang==='fr'?'Mi-temps':'Half',    color:'#3B82F6', bg:'rgba(59,130,246,.1)', icon:<AlertTriangle size={11}/> },
        }

        const dayEmp = employees.filter(e => e.active !== false)
        const todayKey = attendanceDate

        const countByStatus = (s: string) => dayEmp.filter(e => (attendance[`${String(e.id)}_${todayKey}`]?.status ?? 'absent') === s).length
        const presentCount = countByStatus('present') + countByStatus('late') + countByStatus('half')

        const exportAttendanceCSV = () => {
          const rows = dayEmp.map(e => {
            const key = `${String(e.id)}_${todayKey}`
            const a = attendance[key]
            return [e.name, e.role, a?.status ?? 'absent', a?.in ?? '—', a?.out ?? '—']
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
                <Clock size={16}/> {lang==='fr'?'Feuille de présence':'Attendance sheet'}
              </span>
              <input type="date" className="input" value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
                style={{ width:150, height:34, fontSize:13 }} />
              <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                <button className="btn btn-sm" onClick={markAllPresent} style={{display:'flex',alignItems:'center',gap:5}}>
                  <CheckCheck size={13}/> {lang==='fr'?'Tous présents':'All present'}
                </button>
                <button className="btn btn-sm" onClick={exportAttendanceCSV} style={{display:'flex',alignItems:'center',gap:5}}>
                  <Download size={13}/> CSV
                </button>
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              {[
                { icon:<CheckCircle size={20}/>, label:lang==='fr'?'Présents':'Present',  count:presentCount,          color:'var(--acc2)', hex:'var(--acc2)' },
                { icon:<Clock size={20}/>,       label:lang==='fr'?'Retards':'Late',      count:countByStatus('late'), color:'#F59E0B', hex:'#F59E0B' },
                { icon:<XCircle size={20}/>,     label:lang==='fr'?'Absents':'Absent',    count:countByStatus('absent'),color:'#EF4444', hex:'#EF4444' },
                { icon:<AlertTriangle size={20}/>,label:lang==='fr'?'Mi-temps':'Half-day', count:countByStatus('half'), color:'#3B82F6', hex:'#3B82F6' },
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
                <span>{lang==='fr'?'Employé':'Employee'}</span>
                <span style={{ textAlign:'center' }}>{lang==='fr'?'Statut':'Status'}</span>
                <span style={{ textAlign:'center' }}>Arrivée</span>
                <span style={{ textAlign:'center' }}>Départ</span>
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
                        <div style={{ fontSize:10, color:'var(--text3)' }}>{emp.role}</div>
                      </div>
                    </div>
                    {/* Statut badge */}
                    <div style={{ display:'flex', justifyContent:'center' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background:sc.bg, color:sc.color, display:'inline-flex', alignItems:'center', gap:4 }}>
                        {sc.icon} {sc.label}
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
                {lang==='fr'?'Journée du':'Day of'} <strong style={{ color:'var(--text)' }}>{new Date(attendanceDate + 'T00:00:00').toLocaleDateString(lang==='fr'?'fr-FR':'en-US', { weekday:'long', day:'numeric', month:'long' })}</strong>
              </span>
              <span style={{ fontSize:12, color:'var(--text3)', marginLeft:'auto' }}>
                {presentCount}/{dayEmp.length} {lang==='fr'?'présents':'present'} · {dayEmp.length > 0 ? Math.round(presentCount/dayEmp.length*100) : 0}% {lang==='fr'?'de présence':'attendance rate'}
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
              <span className="panel-t" style={{ display:'flex', alignItems:'center', gap:6 }}><Umbrella size={14}/> {lang === 'fr' ? 'Demandes de congés' : 'Leave requests'}</span>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setLeaveForm({ empId: 0, type: lang === 'fr' ? 'Congé annuel' : 'Annual leave', startDate: new Date().toISOString().split('T')[0], endDate: '', notes: '' })
                setShowLeaveModal(true)
              }}>
                <Plus size={14} /> {lang === 'fr' ? 'Nouvelle demande' : 'New request'}
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
                      {statusCfg.label}
                    </span>
                    {leave.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(14,196,126,.15)', border: '1px solid rgba(14,196,126,.3)', color: 'var(--acc2)' }}
                          onClick={() => handleLeaveAction(leave.id, 'approved')}>
                          ✓ {lang === 'fr' ? 'Approuver' : 'Approve'}
                        </button>
                        <button style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: 'rgba(232,64,74,.12)', border: '1px solid rgba(232,64,74,.25)', color: 'var(--danger)' }}
                          onClick={() => handleLeaveAction(leave.id, 'refused')}>
                          ✕ {lang === 'fr' ? 'Refuser' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {(leaves ?? []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)', fontSize: 14 }}>
                  {lang === 'fr' ? 'Aucune demande de congé' : 'No leave requests'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
