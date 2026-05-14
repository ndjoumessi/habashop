import { useState } from 'react'
import { useConfig } from '@/stores/appStore'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

interface EmpBasic { id: number; name: string; role: string; avatar: string; color: string }
type ShiftKey = 'M' | 'S' | 'J' | 'N' | 'R' | 'C'

const EMPLOYEES: EmpBasic[] = [
  { id:1, name:'Marie Bakayoko',   role:'Caissière',   avatar:'MB', color:'#6C3FD6' },
  { id:2, name:'Kofi Diallo',      role:'Magasinier',  avatar:'KD', color:'#F59E0B' },
  { id:3, name:'Aminata Touré',    role:'Comptable',   avatar:'AT', color:'#10B981' },
  { id:4, name:'Seydou Koné',      role:'Caissier',    avatar:'SK', color:'#EF4444' },
  { id:5, name:'Fatoumata Ndiaye', role:'Responsable', avatar:'FN', color:'#3B82F6' },
  { id:6, name:'Ibrahim Sow',      role:'Livreur',     avatar:'IS', color:'#8B5CF6' },
]

const SHIFTS = {
  M: {
    label:'Matin', hours:'08:00–13:00',
    bg:'rgba(99,102,241,.15)', color:'#818CF8',
    border:'rgba(99,102,241,.3)', short:'M',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      </svg>
    ),
  },
  S: {
    label:'Après-midi', hours:'13:00–18:00',
    bg:'rgba(245,158,11,.15)', color:'#FCD34D',
    border:'rgba(245,158,11,.3)', short:'AM',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M17 12a5 5 0 1 1-10 0"/>
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2"/>
      </svg>
    ),
  },
  J: {
    label:'Journée', hours:'08:00–18:00',
    bg:'rgba(16,185,129,.15)', color:'#34D399',
    border:'rgba(16,185,129,.3)', short:'J',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  N: {
    label:'Nuit', hours:'20:00–06:00',
    bg:'rgba(139,92,246,.15)', color:'#A78BFA',
    border:'rgba(139,92,246,.3)', short:'N',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    ),
  },
  R: {
    label:'Repos', hours:'—',
    bg:'rgba(148,163,184,.08)', color:'#64748B',
    border:'rgba(148,163,184,.15)', short:'R',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/>
      </svg>
    ),
  },
  C: {
    label:'Congé', hours:'—',
    bg:'rgba(59,130,246,.15)', color:'#60A5FA',
    border:'rgba(59,130,246,.3)', short:'C',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12h.01"/>
      </svg>
    ),
  },
} satisfies Record<ShiftKey, { label:string; hours:string; bg:string; color:string; border:string; short:string; icon:JSX.Element }>

const SHIFT_HOURS: Record<ShiftKey, { start: string; end: string }> = {
  M: { start:'08:00', end:'13:00' }, S: { start:'13:00', end:'18:00' },
  J: { start:'08:00', end:'18:00' }, N: { start:'20:00', end:'06:00' },
  R: { start:'',      end:''      }, C: { start:'',      end:''      },
}

const SCHEDULE_INIT: Record<number, Record<number, ShiftKey>> = {
  1: { 0:'J', 1:'M', 2:'S', 3:'J', 4:'M', 5:'R', 6:'R' },
  2: { 0:'J', 1:'J', 2:'J', 3:'M', 4:'S', 5:'J', 6:'R' },
  3: { 0:'M', 1:'S', 2:'R', 3:'M', 4:'S', 5:'R', 6:'R' },
  4: { 0:'S', 1:'M', 2:'J', 3:'S', 4:'M', 5:'R', 6:'R' },
  5: { 0:'C', 1:'C', 2:'C', 3:'C', 4:'C', 5:'R', 6:'R' },
  6: { 0:'R', 1:'R', 2:'R', 3:'R', 4:'R', 5:'R', 6:'R' },
}

const DAY_LABELS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function getWeekDays(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calculateTotalHours(empSchedule: Record<number, string>): number {
  const hours: Record<string, number> = { M: 5, S: 5, J: 10, N: 10, R: 0, C: 0 }
  return Object.values(empSchedule).reduce((total, shift) => total + (hours[shift] ?? 0), 0)
}

interface EditState { emp: EmpBasic; dayIdx: number; day: Date }

export default function Planning() {
  const { lang } = useConfig()
  void lang

  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedule, setSchedule]       = useState<Record<number, Record<number, ShiftKey>>>(SCHEDULE_INIT)

  const [editModal, setEditModal] = useState<EditState | null>(null)
  const [editShift, setEditShift] = useState<ShiftKey>('J')
  const [editStart, setEditStart] = useState('08:00')
  const [editEnd,   setEditEnd]   = useState('18:00')

  const [newModal,  setNewModal]  = useState(false)
  const [newEmpId,  setNewEmpId]  = useState<number>(1)
  const [newDayIdx, setNewDayIdx] = useState(0)
  const [newShift,  setNewShift]  = useState<ShiftKey>('J')
  const [newStart,  setNewStart]  = useState('08:00')
  const [newEnd,    setNewEnd]    = useState('18:00')

  const weekDays = getWeekDays(currentDate)
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d) }
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d) }
  const goToday  = () => setCurrentDate(new Date())

  function openEditShift(emp: EmpBasic, dayIdx: number, day: Date, sk: ShiftKey) {
    setEditShift(sk)
    setEditStart(SHIFT_HOURS[sk].start)
    setEditEnd(SHIFT_HOURS[sk].end)
    setEditModal({ emp, dayIdx, day })
  }

  function handleEditShift(sk: ShiftKey) {
    setEditShift(sk)
    setEditStart(SHIFT_HOURS[sk].start)
    setEditEnd(SHIFT_HOURS[sk].end)
  }

  function handleNewShift(sk: ShiftKey) {
    setNewShift(sk)
    setNewStart(SHIFT_HOURS[sk].start)
    setNewEnd(SHIFT_HOURS[sk].end)
  }

  function saveEdit() {
    if (!editModal) return
    setSchedule(prev => ({
      ...prev,
      [editModal.emp.id]: { ...prev[editModal.emp.id], [editModal.dayIdx]: editShift },
    }))
    toast.success('Créneau mis à jour')
    setEditModal(null)
  }

  function saveNew() {
    setSchedule(prev => ({
      ...prev,
      [newEmpId]: { ...prev[newEmpId], [newDayIdx]: newShift },
    }))
    toast.success('Créneau créé')
    setNewModal(false)
  }

  const weekNum      = getWeekNumber(weekDays[0])
  const totalHoursAll = EMPLOYEES.reduce((s, e) => s + calculateTotalHours(schedule[e.id] ?? {}), 0)
  const plannedCount  = EMPLOYEES.filter(e => Object.values(schedule[e.id] ?? {}).some(v => v !== 'R' && v !== 'C')).length
  const coveragePct   = Math.round(plannedCount / EMPLOYEES.length * 100)

  const summaryCounts = (Object.keys(SHIFTS) as ShiftKey[]).reduce((acc, sk) => {
    acc[sk] = Object.values(schedule).reduce(
      (s, empSch) => s + Object.values(empSch).filter(v => v === sk).length, 0)
    return acc
  }, {} as Record<ShiftKey, number>)

  const showEditTimes = editShift !== 'R' && editShift !== 'C'
  const showNewTimes  = newShift  !== 'R' && newShift  !== 'C'

  return (
    <div className="animate-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Semaine',            value:`Semaine ${weekNum}`, sub:`${formatDate(weekDays[0])} — ${formatDate(weekDays[6])}`, color:'var(--p2)',   icon:'📅' },
          { label:'Employés planifiés', value:`${plannedCount}/6`,  sub:'1 en congé',                                              color:'var(--acc2)', icon:'👥' },
          { label:'Heures totales',     value:`${totalHoursAll}h`,  sub:'Cette semaine',                                           color:'var(--acc)',  icon:'⏱️' },
          { label:'Taux de couverture', value:`${coveragePct} %`,   sub:'Objectif : 100 %',                                        color:'var(--p3)',   icon:'📊' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color:k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color:k.color, fontSize:18 }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Navigation semaine */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'var(--card)', border:'1px solid var(--border)',
        borderRadius:14, padding:'14px 20px',
      }}>
        <button onClick={prevWeek} style={{
          display:'flex', alignItems:'center', gap:6,
          background:'var(--bg3)', border:'1px solid var(--border)',
          borderRadius:9, padding:'8px 14px', cursor:'pointer',
          color:'var(--text2)', fontSize:13, fontWeight:600, fontFamily:'var(--font)', transition:'all .15s',
        }}>← Précédente</button>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--text)', letterSpacing:'-.3px' }}>
            Semaine {weekNum}
          </div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
            {formatDate(weekDays[0])} — {formatDate(weekDays[6])}
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={goToday} style={{
            background:'rgba(91,78,232,.15)', border:'1px solid rgba(91,78,232,.3)',
            borderRadius:9, padding:'8px 14px', cursor:'pointer',
            color:'var(--p2)', fontSize:13, fontWeight:600, fontFamily:'var(--font)',
          }}>📅 Aujourd'hui</button>
          <button onClick={nextWeek} style={{
            display:'flex', alignItems:'center', gap:6,
            background:'var(--bg3)', border:'1px solid var(--border)',
            borderRadius:9, padding:'8px 14px', cursor:'pointer',
            color:'var(--text2)', fontSize:13, fontWeight:600, fontFamily:'var(--font)', transition:'all .15s',
          }}>Suivante →</button>
        </div>
      </div>

      {/* Légende — icônes SVG */}
      <div style={{
        display:'flex', gap:8, flexWrap:'wrap',
        background:'var(--card)', border:'1px solid var(--border)',
        borderRadius:12, padding:'12px 16px',
      }}>
        {(Object.entries(SHIFTS) as [ShiftKey, typeof SHIFTS[ShiftKey]][]).map(([key, s]) => (
          <div key={key} style={{
            display:'flex', alignItems:'center', gap:6,
            background:s.bg, border:`1px solid ${s.border}`, borderRadius:8, padding:'5px 12px',
          }}>
            <div style={{ color:s.color }}>{s.icon}</div>
            <span style={{ fontSize:11, fontWeight:700, color:s.color }}>{s.label}</span>
            {s.hours !== '—' && <span style={{ fontSize:10, color:'var(--text3)' }}>{s.hours}</span>}
          </div>
        ))}
      </div>

      {/* Panel planning */}
      <div className="panel" style={{ padding:0, overflow:'hidden', marginBottom:0 }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid var(--border)',
        }}>
          <span className="panel-t">📅 Planning Hebdomadaire</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="mini-btn" onClick={() => toast('📊 Export planning…')}>📊 Exporter</button>
            <button className="topbar-btn" onClick={() => setNewModal(true)}>+ Nouveau créneau</button>
          </div>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr style={{ background:'var(--bg3)' }}>
                <th style={{
                  padding:'12px 16px', textAlign:'left', width:200,
                  fontSize:10.5, fontWeight:700, color:'var(--text3)',
                  textTransform:'uppercase', letterSpacing:'.6px',
                  borderBottom:'1px solid var(--border)',
                  position:'sticky', left:0, background:'var(--bg3)', zIndex:2,
                }}>Employé</th>

                {weekDays.map((day, i) => {
                  const isToday   = day.toDateString() === new Date().toDateString()
                  const isWeekend = i >= 5
                  return (
                    <th key={i} style={{
                      padding:'10px 8px', textAlign:'center', minWidth:90,
                      fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px',
                      color: isToday ? 'var(--p2)' : isWeekend ? 'var(--text3)' : 'var(--text2)',
                      borderBottom:'1px solid var(--border)',
                      borderLeft: isToday ? '2px solid var(--p2)' : '1px solid var(--border)',
                      background: isToday ? 'rgba(91,78,232,.08)' : 'var(--bg3)',
                    }}>
                      <div>{DAY_LABELS[i]}</div>
                      <div style={{ fontSize:14, fontWeight:800, marginTop:2, color: isToday ? 'var(--p2)' : 'var(--text)' }}>
                        {day.getDate()}
                      </div>
                      <div style={{ fontSize:9, marginTop:1, color:'var(--text3)' }}>
                        {day.toLocaleString('fr', { month:'short' })}
                      </div>
                    </th>
                  )
                })}

                <th style={{
                  padding:'10px 8px', textAlign:'center', minWidth:70,
                  fontSize:10.5, fontWeight:700, color:'var(--text3)',
                  textTransform:'uppercase', letterSpacing:'.5px',
                  borderBottom:'1px solid var(--border)',
                  borderLeft:'2px solid var(--border)', background:'var(--bg3)',
                }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES.map((emp, empIdx) => {
                const empSch = schedule[emp.id] ?? {}
                const totalH = calculateTotalHours(empSch)
                const baseBg = empIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)'
                return (
                  <tr key={emp.id}
                    style={{ borderBottom:'1px solid var(--border)', background:baseBg, transition:'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,78,232,.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = baseBg)}
                  >
                    {/* Sticky employee cell */}
                    <td style={{
                      padding:'12px 16px',
                      position:'sticky', left:0, zIndex:1,
                      background:'var(--card)', borderRight:'1px solid var(--border)',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{
                          width:34, height:34, borderRadius:'50%', flexShrink:0,
                          background:emp.color, display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:12, fontWeight:800, color:'#fff',
                          boxShadow:`0 3px 10px ${emp.color}44`,
                        }}>{emp.avatar}</div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{emp.name}</div>
                          <div style={{ fontSize:10.5, color:'var(--text3)' }}>{emp.role}</div>
                        </div>
                      </div>
                    </td>

                    {/* Shift cells — icônes SVG */}
                    {weekDays.map((day, dayIdx) => {
                      const sk    = (empSch[dayIdx] ?? 'R') as ShiftKey
                      const shift = SHIFTS[sk]
                      const isToday = day.toDateString() === new Date().toDateString()
                      return (
                        <td key={dayIdx}
                          onClick={() => openEditShift(emp, dayIdx, day, sk)}
                          style={{
                            padding:'7px 5px', textAlign:'center', cursor:'pointer',
                            background: isToday ? 'rgba(91,78,232,.04)' : 'transparent',
                            borderLeft: isToday ? '2px solid rgba(91,78,232,.2)' : '1px solid var(--border)',
                          }}>
                          <div style={{
                            display:'inline-flex', flexDirection:'column', alignItems:'center', gap:3,
                            background:shift.bg, border:`1px solid ${shift.border}`,
                            borderRadius:9, padding:'7px 10px', minWidth:58, transition:'all .15s',
                            cursor:'pointer',
                          }}>
                            <div style={{ color:shift.color }}>{shift.icon}</div>
                            <span style={{ fontSize:10, fontWeight:800, color:shift.color }}>{shift.short}</span>
                            <span style={{ fontSize:8.5, color:'var(--text3)', whiteSpace:'nowrap' }}>
                              {sk !== 'R' && sk !== 'C' ? shift.hours.split('–')[0] : '—'}
                            </span>
                          </div>
                        </td>
                      )
                    })}

                    {/* Total column */}
                    <td style={{
                      padding:'8px', textAlign:'center',
                      borderLeft:'2px solid var(--border)',
                      fontFamily:'var(--mono)', fontWeight:700, fontSize:13,
                      color: totalH > 40 ? 'var(--acc)' : totalH === 0 ? 'var(--text3)' : 'var(--text)',
                    }}>
                      {totalH > 0 ? `${totalH}h` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer résumé — icônes SVG */}
        <div style={{
          padding:'14px 20px', borderTop:'1px solid var(--border)',
          background:'var(--bg3)', display:'flex', gap:8, flexWrap:'wrap',
        }}>
          {(Object.entries(SHIFTS) as [ShiftKey, typeof SHIFTS[ShiftKey]][]).map(([key, s]) => (
            <div key={key} style={{
              display:'flex', alignItems:'center', gap:7,
              background:s.bg, border:`1px solid ${s.border}`, borderRadius:8, padding:'6px 12px',
            }}>
              <div style={{ color:s.color }}>{s.icon}</div>
              <span style={{ fontSize:11, fontWeight:700, color:s.color }}>{s.label}</span>
              <span style={{
                background:'rgba(255,255,255,.15)', borderRadius:20,
                padding:'1px 8px', fontSize:11, fontWeight:800, color:s.color,
              }}>{summaryCounts[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODAL Modifier créneau ── */}
      {editModal && (
        <div className="modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:490 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Modifier le créneau</span>
              <button className="mini-btn" onClick={() => setEditModal(null)}><X size={15} /></button>
            </div>

            <div style={{
              padding:'12px 14px', background:'var(--bg3)', borderRadius:10,
              display:'flex', alignItems:'center', gap:12, marginBottom:18,
            }}>
              <div style={{
                width:42, height:42, borderRadius:'50%', flexShrink:0,
                background:editModal.emp.color, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, fontWeight:800, color:'#fff',
                boxShadow:`0 3px 12px ${editModal.emp.color}55`,
              }}>{editModal.emp.avatar}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{editModal.emp.name}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                  {editModal.day.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
                </div>
              </div>
            </div>

            <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:10 }}>
              Type de créneau
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:16 }}>
              {(Object.entries(SHIFTS) as [ShiftKey, typeof SHIFTS[ShiftKey]][]).map(([key, s]) => (
                <div key={key} onClick={() => handleEditShift(key)} style={{
                  background:s.bg, borderRadius:12, padding:'14px 10px', textAlign:'center', cursor:'pointer',
                  border:`1.5px solid ${editShift === key ? s.color : s.border}`,
                  boxShadow: editShift === key ? `0 6px 20px ${s.color}44` : 'none',
                  transform: editShift === key ? 'scale(1.04)' : 'scale(1)',
                  transition:'all .2s',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                }}>
                  <div style={{ color:s.color }}>{s.icon}</div>
                  <div style={{ fontSize:12, fontWeight:800, color:s.color }}>{s.label}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{s.hours}</div>
                </div>
              ))}
            </div>

            {showEditTimes && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Début</label>
                  <input className="input" type="time" value={editStart}
                    onChange={e => setEditStart(e.target.value)} style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Fin</label>
                  <input className="input" type="time" value={editEnd}
                    onChange={e => setEditEnd(e.target.value)} style={{ width:'100%', boxSizing:'border-box' }} />
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setEditModal(null)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={saveEdit}>✅ Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Nouveau créneau ── */}
      {newModal && (
        <div className="modal-backdrop" onClick={() => setNewModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Nouveau créneau</span>
              <button className="mini-btn" onClick={() => setNewModal(false)}><X size={15} /></button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Employé */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:8 }}>Employé</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:7 }}>
                  {EMPLOYEES.map(emp => (
                    <div key={emp.id} onClick={() => setNewEmpId(emp.id)} style={{
                      display:'flex', alignItems:'center', gap:8, padding:'9px 11px',
                      borderRadius:10, cursor:'pointer', transition:'all .15s',
                      border:`1.5px solid ${newEmpId === emp.id ? emp.color : 'var(--border)'}`,
                      background: newEmpId === emp.id ? `${emp.color}18` : 'var(--bg3)',
                    }}>
                      <div style={{
                        width:26, height:26, borderRadius:'50%', flexShrink:0,
                        background:emp.color, display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:9, fontWeight:800, color:'#fff',
                      }}>{emp.avatar}</div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>{emp.name.split(' ')[0]}</div>
                        <div style={{ fontSize:9.5, color:'var(--text3)' }}>{emp.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jour */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:8 }}>Jour</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {weekDays.map((day, i) => {
                    const isWeekend = i >= 5
                    const sel = newDayIdx === i
                    return (
                      <button key={i} onClick={() => setNewDayIdx(i)} style={{
                        padding:'7px 12px', borderRadius:9, fontSize:12, fontWeight:600,
                        cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                        border: sel ? '1.5px solid var(--p2)' : '1.5px solid var(--border)',
                        background: sel ? 'rgba(91,78,232,.18)' : isWeekend ? 'rgba(148,163,184,.06)' : 'var(--bg3)',
                        color: sel ? 'var(--p2)' : isWeekend ? 'var(--text3)' : 'var(--text2)',
                      }}>
                        <div>{DAY_LABELS[i]}</div>
                        <div style={{ fontSize:10, marginTop:1 }}>{day.getDate()}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Type créneau — icônes SVG */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:8 }}>Type de créneau</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
                  {(Object.entries(SHIFTS) as [ShiftKey, typeof SHIFTS[ShiftKey]][]).map(([key, s]) => (
                    <div key={key} onClick={() => handleNewShift(key)} style={{
                      background:s.bg, borderRadius:12, padding:'12px 8px', textAlign:'center', cursor:'pointer',
                      border:`1.5px solid ${newShift === key ? s.color : s.border}`,
                      boxShadow: newShift === key ? `0 6px 20px ${s.color}44` : 'none',
                      transform: newShift === key ? 'scale(1.04)' : 'scale(1)',
                      transition:'all .2s',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                    }}>
                      <div style={{ color:s.color }}>{s.icon}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:s.color }}>{s.label}</div>
                      <div style={{ fontSize:9.5, color:'var(--text3)' }}>{s.hours}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Horaires */}
              {showNewTimes && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Début</label>
                    <input className="input" type="time" value={newStart}
                      onChange={e => setNewStart(e.target.value)} style={{ width:'100%', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Fin</label>
                    <input className="input" type="time" value={newEnd}
                      onChange={e => setNewEnd(e.target.value)} style={{ width:'100%', boxSizing:'border-box' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setNewModal(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={saveNew}>✅ Créer le créneau</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
