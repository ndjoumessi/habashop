import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { employeesApi } from '@/lib/api'
import toast from 'react-hot-toast'

const SHIFT_TYPES = {
  morning:   { label:'Matin',      hours:'08:00-13:00', color:'#00B8FF', icon:'☀️',  bg:'rgba(0,184,255,.12)'  },
  afternoon: { label:'Après-midi', hours:'13:00-18:00', color:'#FF9500', icon:'🌤️', bg:'rgba(255,149,0,.12)'   },
  full:      { label:'Journée',    hours:'08:00-18:00', color:'#00D084', icon:'📅',  bg:'rgba(0,208,132,.12)'  },
  night:     { label:'Nuit',       hours:'20:00-06:00', color:'#6C47FF', icon:'🌙',  bg:'rgba(108,71,255,.12)' },
  rest:      { label:'Repos',      hours:'',            color:'#64647A', icon:'☕',  bg:'rgba(100,100,122,.12)'},
  leave:     { label:'Congé',      hours:'',            color:'#FF3B5C', icon:'🏖️', bg:'rgba(255,59,92,.12)'  },
} as const

type ShiftType = keyof typeof SHIFT_TYPES

const STATIC_EMPLOYEES = [
  { id:'1', name:'Aminata Diallo',    role:'Caissière',    dept:'Ventes',    avatar:'AD', color:'#6C47FF', isActive:true },
  { id:'2', name:'Moussa Traoré',     role:'Magasinier',   dept:'Stock',     avatar:'MT', color:'#00D084', isActive:true },
  { id:'3', name:'Fatou Sow',         role:'Comptable',    dept:'Finance',   avatar:'FS', color:'#FF9500', isActive:true },
  { id:'4', name:'Ibrahim Koné',      role:'Livreur',      dept:'Logistique',avatar:'IK', color:'#00B8FF', isActive:true },
  { id:'5', name:'Fatoumata Ndiaye',  role:'Responsable',  dept:'Direction', avatar:'FN', color:'#F472B6', isActive:true },
]

export default function Planning() {
  const { lang } = useAppStore()
  const [employees, setEmployees] = useState(STATIC_EMPLOYEES)
  const [activeShift, setActiveShift] = useState<ShiftType>('full')
  const [shifts, setShifts] = useState<Record<string,Record<number,ShiftType>>>(() => {
    try { return JSON.parse(localStorage.getItem('habashop_shifts') ?? 'null') ?? {} } catch { return {} }
  })
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState<ShiftType|'all'>('all')
  const [planningWeek, setPlanningWeek] = useState(new Date())

  useEffect(() => {
    employeesApi.list().then((data:any[]) => {
      if (data?.length > 0) setEmployees(data.map((e:any) => ({
        id: e.id, name: e.name??'', role: e.role??'',
        dept: e.dept??'', avatar: (e.name??'??').split(' ')
          .map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase(),
        color: e.color??'#6C47FF', isActive: e.isActive!==false,
      })))
    }).catch(()=>{})
  }, [])

  useEffect(() => {
    localStorage.setItem('habashop_shifts', JSON.stringify(shifts))
  }, [shifts])

  const weekDays = useMemo(() => {
    const d = new Date(planningWeek)
    const day = d.getDay()
    const diff = d.getDate() - day + (day===0?-6:1)
    d.setDate(diff)
    return Array(7).fill(null).map((_,i) => {
      const nd = new Date(d)
      nd.setDate(d.getDate()+i)
      return nd
    })
  }, [planningWeek])

  const DAY_LABELS = {
    fr:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
    en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    es:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
    it:['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
  }[lang as 'fr'|'en'|'es'|'it'] ?? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const T = {
    fr:{
      title:'Planning', week:'Semaine', today:'Aujourd\'hui',
      prev:'Préc.', next:'Suiv.', employee:'Employé',
      allDepts:'Tous les départements', allStatus:'Tous les shifts',
      assignTip:'Sélectionnez un type puis cliquez sur une case',
      clearTip:'Double-clic pour effacer',
      export:'Export CSV', stats:'Résumé semaine',
      noEmp:'Aucun employé',
    },
    en:{
      title:'Planning', week:'Week', today:'Today',
      prev:'Prev', next:'Next', employee:'Employee',
      allDepts:'All departments', allStatus:'All shifts',
      assignTip:'Select a type then click a cell',
      clearTip:'Double-click to clear',
      export:'Export CSV', stats:'Week summary',
      noEmp:'No employees',
    },
    es:{
      title:'Planificación', week:'Semana', today:'Hoy',
      prev:'Ant.', next:'Sig.', employee:'Empleado',
      allDepts:'Todos los departamentos', allStatus:'Todos los turnos',
      assignTip:'Seleccione un tipo y haga clic en una celda',
      clearTip:'Doble clic para borrar',
      export:'Exportar CSV', stats:'Resumen semana',
      noEmp:'Sin empleados',
    },
    it:{
      title:'Pianificazione', week:'Settimana', today:'Oggi',
      prev:'Prec.', next:'Succ.', employee:'Dipendente',
      allDepts:'Tutti i reparti', allStatus:'Tutti i turni',
      assignTip:'Seleziona un tipo poi clicca una cella',
      clearTip:'Doppio clic per cancellare',
      export:'Esporta CSV', stats:'Riepilogo settimana',
      noEmp:'Nessun dipendente',
    },
  }[lang as 'fr'|'en'|'es'|'it'] ?? {
    title:'Planning',week:'Week',today:'Today',prev:'Prev',next:'Next',
    employee:'Employee',allDepts:'All depts',allStatus:'All',
    assignTip:'Select type then click',clearTip:'Dbl-click to clear',
    export:'Export',stats:'Summary',noEmp:'No employees',
  }

  const depts = useMemo(()=>
    [...new Set(employees.map(e=>e.dept).filter(Boolean))],
    [employees]
  )

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (!e.isActive) return false
      if (filterDept !== 'all' && e.dept !== filterDept) return false
      if (filterStatus !== 'all') {
        const hasShift = weekDays.some((_,di) =>
          shifts[e.id]?.[di] === filterStatus
        )
        if (!hasShift) return false
      }
      return true
    })
  }, [employees, filterDept, filterStatus, shifts, weekDays])

  const assignShift = (empId:string, di:number) => {
    setShifts(prev => {
      const empShifts = {...(prev[empId]??{})}
      if (empShifts[di] === activeShift) {
        delete empShifts[di]
      } else {
        empShifts[di] = activeShift
      }
      return {...prev, [empId]: empShifts}
    })
  }

  const clearShift = (empId:string, di:number) => {
    setShifts(prev => {
      const empShifts = {...(prev[empId]??{})}
      delete empShifts[di]
      return {...prev, [empId]: empShifts}
    })
  }

  const exportCSVPlan = () => {
    const rows = [
      [T.employee, ...weekDays.map(d=>
        d.toLocaleDateString(lang==='fr'?'fr-FR':'en-US',
          {weekday:'short',day:'numeric',month:'short'})
      )],
      ...filtered.map(emp=>[
        emp.name,
        ...weekDays.map((_,di)=>{
          const s = shifts[emp.id]?.[di]
          return s ? `${SHIFT_TYPES[s].label} ${SHIFT_TYPES[s].hours}` : ''
        })
      ])
    ]
    const csv = '﻿' + rows.map(r=>r.join(';')).join('\r\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url
    a.download=`Planning_${weekDays[0].toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('📊 Planning exporté !')
  }

  const stats = useMemo(() => {
    const counts: Record<string,number> = {}
    Object.values(shifts).forEach(days =>
      Object.values(days).forEach(s => {
        counts[s] = (counts[s]??0)+1
      })
    )
    return counts
  }, [shifts])

  return (
    <div className="animate-in" style={{
      display:'flex', flexDirection:'column', gap:16,
    }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{T.title}</h1>
          <p className="page-subtitle">
            {weekDays[0].toLocaleDateString(lang==='fr'?'fr-FR':'en-US',
              {day:'numeric',month:'long'})}
            {' — '}
            {weekDays[6].toLocaleDateString(lang==='fr'?'fr-FR':'en-US',
              {day:'numeric',month:'long',year:'numeric'})}
          </p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button className="mini-btn"
            onClick={()=>{
              const d=new Date(planningWeek)
              d.setDate(d.getDate()-7)
              setPlanningWeek(d)
            }}>← {T.prev}</button>
          <button className="mini-btn"
            onClick={()=>setPlanningWeek(new Date())}>
            {T.today}
          </button>
          <button className="mini-btn"
            onClick={()=>{
              const d=new Date(planningWeek)
              d.setDate(d.getDate()+7)
              setPlanningWeek(d)
            }}>{T.next} →</button>
          <button className="mini-btn" onClick={exportCSVPlan}>
            ↓ {T.export}
          </button>
        </div>
      </div>

      {/* Sélecteur type de shift */}
      <div style={{
        display:'flex', gap:6, flexWrap:'wrap',
        padding:'12px 16px',
        background:'var(--grad-card)',
        border:'1px solid var(--border)',
        borderRadius:16,
      }}>
        <div style={{
          fontSize:10, fontWeight:800,
          textTransform:'uppercase', letterSpacing:'.6px',
          color:'var(--text3)', alignSelf:'center',
          marginRight:6, flexShrink:0,
        }}>
          {lang==='fr'?'ASSIGNER :':'ASSIGN:'}
        </div>
        {(Object.entries(SHIFT_TYPES) as [ShiftType, typeof SHIFT_TYPES[ShiftType]][])
          .map(([key,s]) => (
          <button key={key} type="button"
            onClick={()=>setActiveShift(key)}
            style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'8px 14px', borderRadius:10,
              border:`1.5px solid ${activeShift===key
                ? s.color : 'var(--border)'}`,
              background: activeShift===key
                ? s.bg : 'transparent',
              cursor:'pointer', fontFamily:'var(--font)',
              fontSize:11, fontWeight:700,
              color: activeShift===key ? s.color : 'var(--text3)',
              transition:'all .12s',
              boxShadow: activeShift===key
                ? `0 3px 10px ${s.color}30` : 'none',
              transform: activeShift===key ? 'scale(1.02)' : 'scale(1)',
            }}>
            <span style={{fontSize:14}}>{s.icon}</span>
            <span>{s.label}</span>
            {s.hours && (
              <span style={{
                fontSize:9, fontFamily:'var(--mono)', opacity:.7,
              }}>{s.hours}</span>
            )}
            {activeShift===key && (
              <span style={{
                fontSize:9, background:'var(--p)',
                color:'#fff', borderRadius:99,
                padding:'1px 5px', fontWeight:800,
              }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{
        display:'flex', gap:8, flexWrap:'wrap',
        alignItems:'center',
      }}>
        <select className="input"
          style={{width:'auto',minWidth:180,height:36,fontSize:12}}
          value={filterDept}
          onChange={e=>setFilterDept(e.target.value)}>
          <option value="all">{T.allDepts}</option>
          {depts.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input"
          style={{width:'auto',minWidth:180,height:36,fontSize:12}}
          value={filterStatus}
          onChange={e=>setFilterStatus(e.target.value as any)}>
          <option value="all">{T.allStatus}</option>
          {(Object.entries(SHIFT_TYPES) as [ShiftType,any][]).map(([k,s])=>(
            <option key={k} value={k}>{s.icon} {s.label}</option>
          ))}
        </select>
        <div style={{
          marginLeft:'auto', fontSize:10,
          color:'var(--text3)', fontStyle:'italic',
        }}>
          💡 {T.assignTip} · {T.clearTip}
        </div>
      </div>

      {/* Grille */}
      <div style={{
        background:'var(--grad-card)',
        border:'1px solid var(--border)',
        borderRadius:16, overflow:'hidden',
      }}>
        <div style={{overflowX:'auto'}}>
          <table style={{
            width:'100%', borderCollapse:'collapse', minWidth:720,
          }}>
            <thead>
              <tr style={{
                background:'linear-gradient(135deg,var(--bg4),var(--bg3))',
                borderBottom:'2px solid var(--border)',
              }}>
                <th style={{
                  padding:'12px 16px', textAlign:'left',
                  width:160, fontSize:10, fontWeight:800,
                  textTransform:'uppercase', letterSpacing:'.6px',
                  color:'var(--text3)',
                }}>
                  {T.employee}
                </th>
                {weekDays.map((day,di)=>{
                  const isToday = day.toDateString()===new Date().toDateString()
                  const isWeekend = day.getDay()===0||day.getDay()===6
                  return (
                    <th key={di} style={{
                      padding:'10px 6px', textAlign:'center',
                      background: isToday
                        ? 'rgba(108,71,255,.12)' : 'transparent',
                      position:'relative',
                    }}>
                      {isToday && (
                        <div style={{
                          position:'absolute', top:0, left:0, right:0,
                          height:2,
                          background:'linear-gradient(90deg,transparent,var(--p),transparent)',
                        }}/>
                      )}
                      <div style={{
                        fontSize:10, fontWeight:700,
                        color: isWeekend ? 'var(--text4)' : 'var(--text3)',
                        textTransform:'uppercase', letterSpacing:'.4px',
                      }}>
                        {DAY_LABELS[di]}
                      </div>
                      <div style={{
                        fontSize:18, fontWeight:900, marginTop:2,
                        color: isToday ? 'var(--p2)'
                          : isWeekend ? 'var(--text3)'
                          : 'var(--text)',
                      }}>
                        {day.getDate()}
                      </div>
                      {isToday && (
                        <div style={{
                          width:5, height:5, borderRadius:'50%',
                          background:'var(--p)',
                          margin:'3px auto 0',
                          boxShadow:'0 0 6px var(--p2)',
                        }}/>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr>
                  <td colSpan={8} style={{
                    textAlign:'center', padding:'48px',
                    color:'var(--text3)', fontSize:14,
                  }}>
                    👥 {T.noEmp}
                  </td>
                </tr>
              ) : filtered.map((emp,ri)=>(
                <tr key={emp.id} style={{
                  borderBottom:'1px solid var(--border)',
                  background: ri%2===0
                    ? 'transparent' : 'rgba(255,255,255,.01)',
                }}>
                  <td style={{padding:'8px 16px'}}>
                    <div style={{
                      display:'flex', alignItems:'center', gap:8,
                    }}>
                      <div style={{
                        width:34, height:34, borderRadius:10,
                        background:`linear-gradient(135deg,
                          ${emp.color},${emp.color}66)`,
                        display:'flex', alignItems:'center',
                        justifyContent:'center',
                        fontSize:11, fontWeight:900, color:'#fff',
                        flexShrink:0,
                        boxShadow:`0 2px 8px ${emp.color}35`,
                      }}>
                        {emp.avatar}
                      </div>
                      <div>
                        <div style={{
                          fontSize:12, fontWeight:700,
                          color:'var(--text)', whiteSpace:'nowrap',
                        }}>
                          {emp.name.split(' ')[0]}
                        </div>
                        <div style={{
                          fontSize:9, color:'var(--text3)',
                          whiteSpace:'nowrap',
                        }}>{emp.dept}</div>
                      </div>
                    </div>
                  </td>

                  {weekDays.map((_,di)=>{
                    const shiftKey = shifts[emp.id]?.[di]
                    const s = shiftKey ? SHIFT_TYPES[shiftKey] : null
                    const isWeekend = weekDays[di].getDay()===0
                      || weekDays[di].getDay()===6
                    const isToday = weekDays[di].toDateString()===new Date().toDateString()
                    const preview = SHIFT_TYPES[activeShift]

                    return (
                      <td key={di} style={{
                        padding:'4px 3px',
                        background: isToday
                          ? 'rgba(108,71,255,.03)' : 'transparent',
                      }}>
                        <div
                          onClick={()=>assignShift(emp.id,di)}
                          onDoubleClick={()=>clearShift(emp.id,di)}
                          style={{
                            minHeight:58, borderRadius:10,
                            cursor:'pointer',
                            display:'flex', flexDirection:'column',
                            alignItems:'center', justifyContent:'center',
                            gap:3, padding:'4px 2px',
                            border:`1px solid ${s
                              ? `${s.color}35`
                              : isWeekend
                                ? 'rgba(255,255,255,.03)'
                                : 'var(--border)'}`,
                            background: s
                              ? s.bg
                              : isWeekend
                                ? 'rgba(0,0,0,.1)'
                                : 'var(--bg4)',
                            opacity: isWeekend&&!s ? .5 : 1,
                            transition:'all .1s',
                            userSelect:'none',
                            position:'relative',
                            overflow:'hidden',
                          }}
                          onMouseEnter={e=>{
                            if (!s) {
                              const el=e.currentTarget as HTMLElement
                              el.style.background=`${preview.color}18`
                              el.style.borderColor=`${preview.color}40`
                              el.style.transform='scale(1.03)'
                            }
                          }}
                          onMouseLeave={e=>{
                            if (!s) {
                              const el=e.currentTarget as HTMLElement
                              el.style.background=isWeekend
                                ?'rgba(0,0,0,.1)':'var(--bg4)'
                              el.style.borderColor=isWeekend
                                ?'rgba(255,255,255,.03)':'var(--border)'
                              el.style.transform='scale(1)'
                            }
                          }}
                        >
                          {s ? (
                            <>
                              <span style={{fontSize:16}}>{s.icon}</span>
                              {s.hours && (
                                <span style={{
                                  fontSize:8, fontWeight:800,
                                  color:s.color,
                                  fontFamily:'var(--mono)',
                                  letterSpacing:'-.3px',
                                  lineHeight:1,
                                }}>{s.hours}</span>
                              )}
                            </>
                          ) : (
                            <span style={{
                              fontSize:20, color:'var(--text4)',
                              opacity:.3, fontWeight:200,
                            }}>+</span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer : légende */}
        <div style={{
          padding:'10px 16px',
          borderTop:'1px solid var(--border)',
          background:'var(--bg3)',
          display:'flex', gap:14, flexWrap:'wrap',
          alignItems:'center',
        }}>
          {(Object.entries(SHIFT_TYPES) as [ShiftType,any][]).map(([key,s])=>(
            <div key={key} style={{
              display:'flex', alignItems:'center', gap:4,
              fontSize:10,
            }}>
              <span>{s.icon}</span>
              <span style={{color:s.color,fontWeight:600}}>{s.label}</span>
              {s.hours&&<span style={{
                color:'var(--text3)',fontFamily:'var(--mono)',fontSize:8,
              }}>{s.hours}</span>}
            </div>
          ))}
          <div style={{marginLeft:'auto',fontSize:9,color:'var(--text3)'}}>
            🖱️ {T.clearTip}
          </div>
        </div>
      </div>

      {/* Stats résumé */}
      {Object.keys(stats).length>0&&(
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',
          gap:8,
        }}>
          {(Object.entries(SHIFT_TYPES) as [ShiftType,any][]).map(([key,s])=>{
            const count=stats[key]??0
            if (!count) return null
            return(
              <div key={key} style={{
                background:s.bg,
                border:`1px solid ${s.color}25`,
                borderRadius:12, padding:'12px 14px',
                display:'flex', alignItems:'center', gap:8,
              }}>
                <span style={{fontSize:20}}>{s.icon}</span>
                <div>
                  <div style={{
                    fontSize:9,fontWeight:700,
                    textTransform:'uppercase',
                    color:'var(--text3)',
                  }}>{s.label}</div>
                  <div style={{
                    fontSize:20,fontWeight:900,
                    color:s.color,fontFamily:'var(--mono)',
                  }}>{count}</div>
                </div>
              </div>
            )
          }).filter(Boolean)}
        </div>
      )}
    </div>
  )
}
