import { useState, Fragment } from 'react'
import { Gift, Trash2, BarChart3, Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { bonusesApi } from '@/lib/api'
import { type Employee } from '@/components/hr/hrShared'

// Couleur de badge selon la raison de la prime
function bonusReasonColor(reason: string): { bg: string; border: string; text: string } {
  const r = (reason || '').toLowerCase()
  if (r.includes('performance')) return { bg: 'rgba(0,208,132,.12)', border: 'rgba(0,208,132,.25)', text: 'var(--acc2)' }
  if (r.includes('fête') || r.includes('fete') || r.includes('holiday') || r.includes('fiesta') || r.includes('festa')) return { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.25)', text: 'var(--warn)' }
  return { bg: 'rgba(108,71,255,.12)', border: 'rgba(108,71,255,.25)', text: 'var(--p3)' }
}

interface Props {
  employees: Employee[]
  fmt: (n: number) => string
  lang: string
  bonuses: Record<string, number>; setBonuses: (v: any) => void
  bonusList: { id: string; empId: string; amount: number; reason: string; date: string }[]; setBonusList: (v: any) => void
  setSalaryTarget: (v: any) => void; setShowSalaryModal: (b: boolean) => void
}

export default function PayrollBonuses({ employees, fmt, lang, bonuses, setBonuses, bonusList, setBonusList, setSalaryTarget, setShowSalaryModal }: Props) {
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
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
            <div style={{ fontSize:14, fontWeight:'var(--fw-semibold)' }}>
              {lang === 'en' ? 'No bonuses this month' : lang === 'es' ? 'Sin primas este mes' : lang === 'it' ? 'Nessun premio questo mese' : 'Aucune prime ce mois'}
            </div>
            <div style={{ fontSize:12, marginTop:6 }}>
              {lang === 'en' ? 'Click "+ New bonus" to add one' : lang === 'es' ? 'Haz clic en "+ Nueva prima" para agregar' : lang === 'it' ? 'Clicca su "+ Nuovo premio" per aggiungerne' : 'Cliquez sur "+ Nouvelle prime" pour en ajouter'}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table aria-label={lang === 'en' ? 'Monthly bonuses' : lang === 'es' ? 'Primas del mes' : lang === 'it' ? 'Premi del mese' : 'Primes du mois'}>
              <thead>
                <tr>
                  <th scope="col">{lang === 'en' ? 'EMPLOYEE' : lang === 'es' ? 'EMPLEADO' : lang === 'it' ? 'DIPENDENTE' : 'EMPLOYÉ'}</th>
                  <th scope="col">{lang === 'en' ? 'AMOUNT' : lang === 'es' ? 'IMPORTE' : lang === 'it' ? 'IMPORTO' : 'MONTANT'}</th>
                  <th scope="col">{lang === 'en' ? '% OF SALARY' : lang === 'es' ? '% DEL SALARIO' : lang === 'it' ? '% DELLO STIPENDIO' : '% DU SALAIRE'}</th>
                  <th scope="col">{lang === 'en' ? 'ACTIONS' : lang === 'es' ? 'ACCIONES' : lang === 'it' ? 'AZIONI' : 'ACTIONS'}</th>
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
                              <span style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--text2)' }}>
                                {lang === 'en' ? 'Unknown employee' : lang === 'es' ? 'Empleado desconocido' : lang === 'it' ? 'Dipendente sconosciuto' : 'Employé inconnu'}
                                {' '}— +{fmt(amount)}
                              </span>
                              <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>ID: {empId}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <button className="mini-btn"
                            style={{ fontSize:11, padding:'3px 8px', color:'var(--danger)', borderColor:'rgba(255,59,92,.2)', display:'flex', alignItems:'center', gap:4 }}
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
                            <div style={{ width:30, height:30, borderRadius:8, background:`${emp.color??'var(--p)'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:'var(--fw-bold)', color:emp.color??'var(--p)' }}>
                              {emp.avatar ?? '??'}
                            </div>
                            <span style={{ fontWeight:'var(--fw-semibold)', fontSize:13 }}>{emp.name}</span>
                            <span style={{ fontSize:11, color:'var(--text3)', background:'var(--bg3)', padding:'2px 6px', borderRadius:99 }}>{empBonuses.length}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily:'var(--mono)', color:'var(--acc2)', fontWeight:'var(--fw-bold)' }}>+{fmt(amount)}</td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1, height:6, background:'var(--bg5)', borderRadius:99, overflow:'hidden', maxWidth:100 }}>
                              <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:'linear-gradient(90deg,var(--acc2),var(--p2))', borderRadius:99 }} />
                            </div>
                            <span style={{ fontSize:11, color:'var(--acc2)', fontFamily:'var(--mono)', fontWeight:'var(--fw-semibold)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <button className="mini-btn"
                            style={{ fontSize:11, padding:'3px 8px', color:'var(--danger)', borderColor:'rgba(255,59,92,.2)', display:'flex', alignItems:'center', gap:4 }}
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
                              <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--acc2)', fontWeight:'var(--fw-semibold)' }}>+{fmt(b.amount)}</span>
                            </td>
                            <td>
                              <span style={{ fontSize:11, fontWeight:'var(--fw-semibold)', padding:'2px 8px', borderRadius:99, background:rc.bg, border:`1px solid ${rc.border}`, color:rc.text }}>
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
            <div style={{ fontSize:12, fontWeight:'var(--fw-semibold)', color:'var(--text)', marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
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
            <div style={{ fontSize:22, fontWeight:'var(--fw-bold)', color:'var(--acc2)', fontFamily:'var(--mono)' }}>
              +{fmt(Object.values(bonuses).reduce((s,v)=>s+v,0))}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{lang === 'en' ? 'Total bonuses' : lang === 'es' ? 'Total primas' : lang === 'it' ? 'Totale premi' : 'Total primes'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
