import { useState } from 'react'
import { useConfig } from '@/stores/appStore'
import { ChevronLeft, ChevronRight, Plus, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface EmpBasic { id: number; name: string; role: string; avatar: string; color: string }
type ShiftType = 'J' | 'M' | 'S' | 'N' | 'R' | 'C'

const EMPLOYEES: EmpBasic[] = [
  { id:1, name:'Marie Bakayoko',   role:'Caissière',   avatar:'MB', color:'#6C3FD6' },
  { id:2, name:'Kofi Diallo',      role:'Magasinier',  avatar:'KD', color:'#F59E0B' },
  { id:3, name:'Aminata Touré',    role:'Comptable',   avatar:'AT', color:'#10B981' },
  { id:4, name:'Seydou Koné',      role:'Caissier',    avatar:'SK', color:'#EF4444' },
  { id:5, name:'Fatoumata Ndiaye', role:'Responsable', avatar:'FN', color:'#3B82F6' },
  { id:6, name:'Ibrahim Sow',      role:'Livreur',     avatar:'IS', color:'#8B5CF6' },
]

const SHIFT_CFG: Record<ShiftType, { full: string; hours: string; bg: string; color: string }> = {
  M: { full:'Matin',      hours:'08:00–13:00', bg:'rgba(91,78,232,.2)',   color:'var(--p2)'    },
  S: { full:'Après-midi', hours:'13:00–18:00', bg:'rgba(240,165,0,.2)',  color:'var(--acc)'   },
  J: { full:'Journée',    hours:'08:00–18:00', bg:'rgba(14,196,126,.2)', color:'var(--acc2)'  },
  N: { full:'Nuit',       hours:'20:00–06:00', bg:'rgba(139,92,246,.2)', color:'#A78BFA'      },
  R: { full:'Repos',      hours:'—',           bg:'var(--bg3)',           color:'var(--text3)' },
  C: { full:'Congé',      hours:'—',           bg:'rgba(59,130,246,.2)', color:'#60A5FA'      },
}

const DEFAULT_HOURS: Record<ShiftType, { start: string; end: string }> = {
  M: { start:'08:00', end:'13:00' }, S: { start:'13:00', end:'18:00' },
  J: { start:'08:00', end:'18:00' }, N: { start:'20:00', end:'06:00' },
  R: { start:'—',     end:'—'     }, C: { start:'—',     end:'—'     },
}

const WEEK_DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const SCHEDULE_INIT: Record<number, ShiftType[]> = {
  1: ['J','M','S','J','M','R','R'],
  2: ['J','J','J','M','S','J','R'],
  3: ['M','S','R','M','S','R','R'],
  4: ['S','M','J','S','M','R','R'],
  5: ['C','C','C','C','C','R','R'],
  6: ['R','R','R','R','R','R','R'],
}

const EMP_TOTALS: Record<number, string> = { 1:'40h', 2:'50h', 3:'30h', 4:'40h', 5:'Congé', 6:'Repos' }

const WEEKS = [
  { num:19, label:'Semaine 19 — 7 au 13 Mai 2026',  days:['Lun 7','Mar 8','Mer 9','Jeu 10','Ven 11','Sam 12','Dim 13'] },
  { num:20, label:'Semaine 20 — 14 au 20 Mai 2026', days:['Lun 14','Mar 15','Mer 16','Jeu 17','Ven 18','Sam 19','Dim 20'] },
  { num:21, label:'Semaine 21 — 21 au 27 Mai 2026', days:['Lun 21','Mar 22','Mer 23','Jeu 24','Ven 25','Sam 26','Dim 27'] },
]

function AvatarBadge({ emp, size = 30 }: { emp: EmpBasic; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: emp.color, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#fff', fontSize: size * 0.36, fontWeight: 800,
    }}>{emp.avatar}</div>
  )
}

function ShiftPicker({ value, onChange }: { value: ShiftType; onChange: (s: ShiftType) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {(Object.keys(SHIFT_CFG) as ShiftType[]).map(key => {
        const cfg = SHIFT_CFG[key]
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            padding: '8px 5px', borderRadius: 8, fontWeight: 700, fontSize: 11.5,
            cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'all .15s',
            background: value === key ? cfg.bg : 'var(--bg3)',
            color: value === key ? cfg.color : 'var(--text2)',
            border: `1.5px solid ${value === key ? cfg.color : 'var(--border)'}`,
          }}>{key} · {cfg.full}</button>
        )
      })}
    </div>
  )
}

export default function Planning() {
  const { lang } = useConfig()
  void lang

  const [weekIdx, setWeekIdx]     = useState(1)
  const [schedule, setSchedule]   = useState<Record<number, ShiftType[]>>(SCHEDULE_INIT)
  const [editModal, setEditModal] = useState<{ empId: number; dayIdx: number } | null>(null)
  const [editShift, setEditShift] = useState<ShiftType>('J')
  const [editStart, setEditStart] = useState('08:00')
  const [editEnd,   setEditEnd]   = useState('18:00')
  const [newModal,  setNewModal]  = useState(false)
  const [newEmpId,  setNewEmpId]  = useState<number>(1)
  const [newDayIdx, setNewDayIdx] = useState(0)
  const [newShift,  setNewShift]  = useState<ShiftType>('J')
  const [newStart,  setNewStart]  = useState('08:00')
  const [newEnd,    setNewEnd]    = useState('18:00')
  const [newNotes,  setNewNotes]  = useState('')

  const week    = WEEKS[weekIdx]
  const editEmp = editModal ? EMPLOYEES.find(e => e.id === editModal.empId)! : null

  function openEdit(empId: number, dayIdx: number) {
    const sh = schedule[empId][dayIdx]
    setEditShift(sh); setEditStart(DEFAULT_HOURS[sh].start); setEditEnd(DEFAULT_HOURS[sh].end)
    setEditModal({ empId, dayIdx })
  }
  function handleEditShift(type: ShiftType) {
    setEditShift(type); setEditStart(DEFAULT_HOURS[type].start); setEditEnd(DEFAULT_HOURS[type].end)
  }
  function handleNewShift(type: ShiftType) {
    setNewShift(type); setNewStart(DEFAULT_HOURS[type].start); setNewEnd(DEFAULT_HOURS[type].end)
  }
  function saveEdit() {
    if (!editModal) return
    setSchedule(s => {
      const next = { ...s, [editModal.empId]: [...s[editModal.empId]] }
      next[editModal.empId][editModal.dayIdx] = editShift
      return next
    })
    toast.success('Créneau mis à jour')
    setEditModal(null)
  }
  function saveNew() {
    setSchedule(s => {
      const next = { ...s, [newEmpId]: [...s[newEmpId]] }
      next[newEmpId][newDayIdx] = newShift
      return next
    })
    toast.success('Créneau ajouté')
    setNewModal(false); setNewNotes('')
  }

  const summaryCounts = (Object.keys(SHIFT_CFG) as ShiftType[]).reduce((acc, sh) => {
    acc[sh] = Object.values(schedule).reduce((s, days) => s + days.filter(d => d === sh).length, 0)
    return acc
  }, {} as Record<ShiftType, number>)

  const planned = EMPLOYEES.filter(e => schedule[e.id].some(s => s !== 'R')).length

  const timeCols = editShift !== 'R' && editShift !== 'C'
  const newTimeCols = newShift !== 'R' && newShift !== 'C'

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Semaine courante',    value:`Sem. ${week.num}`, sub: week.label.split('—')[1]?.trim() ?? '', color:'var(--p2)',   icon:'📅' },
          { label:'Employés planifiés',  value:`${planned}/6`,     sub:'1 en congé',                            color:'var(--acc2)', icon:'👥' },
          { label:'Heures totales',      value:'248h',              sub:'Cette semaine',                         color:'var(--acc)',  icon:'⏱️' },
          { label:'Taux de couverture',  value:'92%',               sub:'Objectif : 100%',                       color:'var(--p3)',   icon:'📊' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color, fontSize: 20 }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Planning */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-head">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button className="mini-btn" style={{ padding:'6px 10px' }}
              onClick={() => setWeekIdx(i => Math.max(0, i - 1))} disabled={weekIdx === 0}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight:700, fontSize:14, color:'var(--text)', minWidth:290, textAlign:'center' }}>
              {week.label}
            </span>
            <button className="mini-btn" style={{ padding:'6px 10px' }}
              onClick={() => setWeekIdx(i => Math.min(WEEKS.length - 1, i + 1))} disabled={weekIdx === WEEKS.length - 1}>
              <ChevronRight size={14} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekIdx(1)}>Aujourd'hui</button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => toast('📊 Export planning…')}>
              <Download size={12} /> Exporter
            </button>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setNewModal(true)}>
              <Plus size={12} /> Nouveau créneau
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth:170 }}>Employé</th>
                {week.days.map(d => <th key={d} style={{ textAlign:'center', minWidth:64 }}>{d}</th>)}
                <th style={{ textAlign:'center', minWidth:56 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                      <AvatarBadge emp={emp} size={30} />
                      <div>
                        <div className="td-bold" style={{ fontSize:12 }}>{emp.name}</div>
                        <div style={{ fontSize:10, color:'var(--text3)' }}>{emp.role}</div>
                      </div>
                    </div>
                  </td>
                  {schedule[emp.id].map((sh, di) => {
                    const cfg = SHIFT_CFG[sh]
                    return (
                      <td key={di} style={{ textAlign:'center', padding:'6px 3px' }}>
                        <button onClick={() => openEdit(emp.id, di)}
                          title={`${cfg.full}${cfg.hours !== '—' ? ' · ' + cfg.hours : ''}`}
                          style={{
                            width:44, height:28, borderRadius:7, border:'none',
                            background:cfg.bg, color:cfg.color,
                            fontWeight:800, fontSize:12, fontFamily:'var(--mono)',
                            cursor:'pointer', transition:'all .15s',
                          }}>{sh}</button>
                      </td>
                    )
                  })}
                  <td style={{ textAlign:'center' }}>
                    <span style={{
                      fontSize:11, fontWeight:700, fontFamily:'var(--mono)',
                      color: EMP_TOTALS[emp.id] === 'Repos' ? 'var(--text3)'
                           : EMP_TOTALS[emp.id] === 'Congé' ? '#60A5FA' : 'var(--acc2)',
                    }}>{EMP_TOTALS[emp.id]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Légende */}
        <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', gap:16, flexWrap:'wrap' }}>
          {(Object.entries(SHIFT_CFG) as [ShiftType, typeof SHIFT_CFG[ShiftType]][]).map(([key, cfg]) => (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{
                width:26, height:18, borderRadius:5, background:cfg.bg, color:cfg.color,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontWeight:800, fontSize:11, fontFamily:'var(--mono)',
              }}>{key}</div>
              <span style={{ fontSize:12, color:'var(--text2)' }}>
                {cfg.full}{cfg.hours !== '—' ? ` (${cfg.hours})` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Récapitulatif */}
      <div className="panel" style={{ marginBottom:0 }}>
        <div className="panel-head">
          <span className="panel-title">📋 Récapitulatif hebdomadaire</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:10 }}>
          {(Object.entries(SHIFT_CFG) as [ShiftType, typeof SHIFT_CFG[ShiftType]][]).map(([key, cfg]) => (
            <div key={key} style={{
              background:cfg.bg, borderRadius:10, padding:'13px',
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            }}>
              <div style={{ fontSize:24, fontWeight:800, color:cfg.color, fontFamily:'var(--mono)' }}>
                {summaryCounts[key]}
              </div>
              <div style={{ fontSize:11, fontWeight:600, color:cfg.color }}>{cfg.full}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODAL Modifier créneau ── */}
      {editModal && editEmp && (
        <div className="modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:430 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Modifier le créneau</span>
              <button className="mini-btn" onClick={() => setEditModal(null)}><X size={15} /></button>
            </div>
            <div style={{ padding:'10px 14px', background:'var(--bg3)', borderRadius:10, display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <AvatarBadge emp={editEmp} size={34} />
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{editEmp.name}</div>
                <div style={{ fontSize:12, color:'var(--text3)' }}>
                  {WEEK_DAYS[editModal.dayIdx]} · {week.days[editModal.dayIdx]} Mai 2026
                </div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:7 }}>
                  Type de créneau
                </label>
                <ShiftPicker value={editShift} onChange={handleEditShift} />
              </div>
              {timeCols && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Début</label>
                    <input className="input" type="time" value={editStart}
                      onChange={e => setEditStart(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Fin</label>
                    <input className="input" type="time" value={editEnd}
                      onChange={e => setEditEnd(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setEditModal(null)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={saveEdit}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL Nouveau créneau ── */}
      {newModal && (
        <div className="modal-backdrop" onClick={() => setNewModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <span style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Nouveau créneau</span>
              <button className="mini-btn" onClick={() => setNewModal(false)}><X size={15} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Employé</label>
                <select className="input" value={newEmpId} onChange={e => setNewEmpId(+e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box' }}>
                  {EMPLOYEES.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Jour</label>
                <select className="input" value={newDayIdx} onChange={e => setNewDayIdx(+e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box' }}>
                  {WEEK_DAYS.map((d, i) => <option key={i} value={i}>{d} ({week.days[i]})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:7 }}>Type de créneau</label>
                <ShiftPicker value={newShift} onChange={handleNewShift} />
              </div>
              {newTimeCols && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Début</label>
                    <input className="input" type="time" value={newStart}
                      onChange={e => setNewStart(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Fin</label>
                    <input className="input" type="time" value={newEnd}
                      onChange={e => setNewEnd(e.target.value)}
                      style={{ width:'100%', boxSizing:'border-box' }} />
                  </div>
                </div>
              )}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:5 }}>Notes (optionnel)</label>
                <input className="input" type="text" placeholder="Ex: Remplacement congé"
                  value={newNotes} onChange={e => setNewNotes(e.target.value)}
                  style={{ width:'100%', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setNewModal(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={saveNew}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
