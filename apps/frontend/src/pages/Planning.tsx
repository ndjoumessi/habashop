import { useState } from 'react'
import { useConfig, t } from '@/stores/appStore'
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Role = 'Gérant' | 'Caissier' | 'Magasinier' | 'Livreur' | 'Agent'

interface EmpRef { id: string; name: string; role: Role }
interface Shift   { id: string; empId: string; day: string; start: string; end: string; note: string }
interface EditTarget { empId: string; day: string; shift: Shift | null }

const EMPLOYEES: EmpRef[] = [
  { id: '1', name: 'Mamadou Diallo',  role: 'Gérant'     },
  { id: '2', name: 'Fatou Ndiaye',    role: 'Caissier'   },
  { id: '3', name: 'Ibrahima Mbaye',  role: 'Magasinier' },
  { id: '4', name: 'Aminata Sow',     role: 'Caissier'   },
  { id: '5', name: 'Moussa Thiam',    role: 'Livreur'    },
  { id: '6', name: 'Cheikh Fall',     role: 'Magasinier' },
  { id: '7', name: 'Aïda Ba',         role: 'Agent'      },
]

const ROLE_STYLE: Record<Role, { bg: string; color: string }> = {
  'Gérant':     { bg: 'rgba(91,78,232,0.13)',  color: 'var(--p2)'   },
  'Caissier':   { bg: 'rgba(14,196,126,0.13)', color: 'var(--acc2)' },
  'Magasinier': { bg: 'rgba(240,165,0,0.13)',  color: 'var(--acc)'  },
  'Livreur':    { bg: 'rgba(139,92,246,0.13)', color: 'var(--p3)'   },
  'Agent':      { bg: 'rgba(136,134,168,0.13)',color: 'var(--text2)'},
}

let _uid = 100
const uid = () => String(++_uid)

const SHIFTS_INIT: Shift[] = [
  // Mamadou — Gérant, Mon-Sat
  { id: uid(), empId: '1', day: '2026-05-11', start: '08:00', end: '17:00', note: '' },
  { id: uid(), empId: '1', day: '2026-05-12', start: '08:00', end: '17:00', note: '' },
  { id: uid(), empId: '1', day: '2026-05-13', start: '08:00', end: '17:00', note: '' },
  { id: uid(), empId: '1', day: '2026-05-14', start: '08:00', end: '17:00', note: '' },
  { id: uid(), empId: '1', day: '2026-05-15', start: '08:00', end: '17:00', note: '' },
  { id: uid(), empId: '1', day: '2026-05-16', start: '09:00', end: '14:00', note: 'Demi-journée' },
  // Fatou — Caissier, alternance matin/après-midi
  { id: uid(), empId: '2', day: '2026-05-11', start: '08:00', end: '16:00', note: '' },
  { id: uid(), empId: '2', day: '2026-05-12', start: '12:00', end: '20:00', note: '' },
  { id: uid(), empId: '2', day: '2026-05-13', start: '08:00', end: '16:00', note: '' },
  { id: uid(), empId: '2', day: '2026-05-14', start: '12:00', end: '20:00', note: '' },
  { id: uid(), empId: '2', day: '2026-05-15', start: '08:00', end: '16:00', note: '' },
  { id: uid(), empId: '2', day: '2026-05-16', start: '08:00', end: '14:00', note: '' },
  // Ibrahima — Magasinier, tôt le matin
  { id: uid(), empId: '3', day: '2026-05-11', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '3', day: '2026-05-12', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '3', day: '2026-05-13', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '3', day: '2026-05-14', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '3', day: '2026-05-15', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '3', day: '2026-05-16', start: '07:00', end: '12:00', note: '' },
  // Aminata — congé, pas de créneau
  // Moussa — Livreur, journée
  { id: uid(), empId: '5', day: '2026-05-11', start: '09:00', end: '18:00', note: '' },
  { id: uid(), empId: '5', day: '2026-05-12', start: '09:00', end: '18:00', note: '' },
  { id: uid(), empId: '5', day: '2026-05-13', start: '09:00', end: '18:00', note: '' },
  { id: uid(), empId: '5', day: '2026-05-14', start: '09:00', end: '18:00', note: '' },
  { id: uid(), empId: '5', day: '2026-05-15', start: '09:00', end: '18:00', note: '' },
  { id: uid(), empId: '5', day: '2026-05-16', start: '09:00', end: '14:00', note: '' },
  // Cheikh — Magasinier, absent Jeu-Ven
  { id: uid(), empId: '6', day: '2026-05-11', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '6', day: '2026-05-12', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '6', day: '2026-05-13', start: '07:00', end: '15:00', note: '' },
  { id: uid(), empId: '6', day: '2026-05-16', start: '07:00', end: '12:00', note: '' },
  // Aïda — Agent, très tôt
  { id: uid(), empId: '7', day: '2026-05-11', start: '06:00', end: '12:00', note: '' },
  { id: uid(), empId: '7', day: '2026-05-12', start: '06:00', end: '12:00', note: '' },
  { id: uid(), empId: '7', day: '2026-05-13', start: '06:00', end: '12:00', note: '' },
  { id: uid(), empId: '7', day: '2026-05-14', start: '06:00', end: '12:00', note: '' },
  { id: uid(), empId: '7', day: '2026-05-15', start: '06:00', end: '12:00', note: '' },
  { id: uid(), empId: '7', day: '2026-05-16', start: '06:00', end: '10:00', note: '' },
]

const TODAY = '2026-05-14'
const MONTHS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam']

function getWeekDays(offset: number) {
  const base = new Date('2026-05-11T00:00:00')
  return [0,1,2,3,4,5].map(i => {
    const d = new Date(base)
    d.setDate(d.getDate() + offset * 7 + i)
    const iso = d.toISOString().split('T')[0]
    return { date: iso, label: `${DAY_NAMES[i]} ${d.getDate()}`, short: DAY_NAMES[i], dayNum: d.getDate(), month: d.getMonth() }
  })
}

function weekLabel(days: ReturnType<typeof getWeekDays>) {
  const f = days[0], l = days[5]
  if (f.month === l.month)
    return `${f.dayNum} – ${l.dayNum} ${MONTHS[f.month]} ${new Date(f.date).getFullYear()}`
  return `${f.dayNum} ${MONTHS[f.month]} – ${l.dayNum} ${MONTHS[l.month]} ${new Date(f.date).getFullYear()}`
}

function duration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - sh * 60 - sm) / 60
}

function fmtH(h: number) {
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h${String(min).padStart(2,'0')}` : `${hrs}h`
}

const BLANK_SHIFT = { start: '08:00', end: '17:00', note: '' }

export default function Planning() {
  const { lang } = useConfig()
  void lang
  const [shifts, setShifts]       = useState<Shift[]>(SHIFTS_INIT)
  const [weekOffset, setWeekOff]  = useState(0)
  const [editTarget, setEdit]     = useState<EditTarget | null>(null)
  const [form, setForm]           = useState(BLANK_SHIFT)

  const weekDays   = getWeekDays(weekOffset)
  const weekDates  = new Set(weekDays.map(d => d.date))
  const weekShifts = shifts.filter(s => weekDates.has(s.day))

  const totalHours  = weekShifts.reduce((acc, s) => acc + duration(s.start, s.end), 0)
  const todayEmpIds = new Set(shifts.filter(s => s.day === TODAY).map(s => s.empId))
  const coverageSlots = EMPLOYEES.length * 6
  const coveredSlots  = weekShifts.length

  function openAdd(empId: string, day: string) {
    setForm(BLANK_SHIFT)
    setEdit({ empId, day, shift: null })
  }

  function openEdit(shift: Shift) {
    setForm({ start: shift.start, end: shift.end, note: shift.note })
    setEdit({ empId: shift.empId, day: shift.day, shift })
  }

  function saveShift() {
    if (!editTarget) return
    if (duration(form.start, form.end) <= 0) {
      toast.error('L\'heure de fin doit être après le début'); return
    }
    if (editTarget.shift) {
      setShifts(prev => prev.map(s =>
        s.id === editTarget.shift!.id ? { ...s, ...form } : s
      ))
      toast.success('✅ Créneau mis à jour')
    } else {
      const emp = EMPLOYEES.find(e => e.id === editTarget.empId)!
      setShifts(prev => [...prev, { id: uid(), empId: editTarget.empId, day: editTarget.day, ...form }])
      toast.success(`✅ Créneau ajouté pour ${emp.name}`)
    }
    setEdit(null)
  }

  function deleteShift(shiftId: string) {
    setShifts(prev => prev.filter(s => s.id !== shiftId))
    setEdit(null)
    toast('🗑️ Créneau supprimé')
  }

  const editEmp = editTarget ? EMPLOYEES.find(e => e.id === editTarget.empId) : null
  const editDay = editTarget ? weekDays.find(d => d.date === editTarget.day) : null

  return (
    <div className="space-y-5 animate-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Créneaux cette semaine', value: weekShifts.length.toString(),               color: 'var(--p2)',   icon: '📅' },
          { label: 'Heures planifiées',      value: fmtH(totalHours),                           color: 'var(--acc2)', icon: '⏱️' },
          { label: 'Présents aujourd\'hui',  value: `${todayEmpIds.size} / ${EMPLOYEES.length}`, color: 'var(--acc)',  icon: '✅' },
          { label: 'Taux de couverture',     value: `${Math.round((coveredSlots/coverageSlots)*100)}%`, color: 'var(--p3)', icon: '📊' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-icon-w" style={{ color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Navigation semaine */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOff(w => w - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold" style={{ color: 'var(--text)', minWidth: 180, textAlign: 'center' }}>
              📅 {weekLabel(weekDays)}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOff(w => w + 1)}>
              <ChevronRight size={16} />
            </button>
            {weekOffset !== 0 && (
              <button className="btn btn-ghost btn-sm text-xs" onClick={() => setWeekOff(0)}
                style={{ color: 'var(--p2)' }}>
                Semaine actuelle
              </button>
            )}
          </div>

          {/* Légende rôles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(Object.entries(ROLE_STYLE) as [Role, { bg: string; color: string }][]).map(([role, s]) => (
              <span key={role} className="flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: s.bg, color: s.color, fontWeight: 600 }}>
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Grille planning */}
        <div className="table-wrap" style={{ marginTop: 0 }}>
          <table style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 160 }} />
              {weekDays.map(d => <col key={d.date} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Employé</th>
                {weekDays.map(d => (
                  <th key={d.date} style={{
                    textAlign: 'center',
                    color:      d.date === TODAY ? 'var(--p2)' : 'var(--text2)',
                    fontWeight: d.date === TODAY ? 900 : 600,
                    background: d.date === TODAY ? 'rgba(91,78,232,0.06)' : undefined,
                  }}>
                    <div>{d.label}</div>
                    {d.date === TODAY && (
                      <div style={{ fontSize: 9, color: 'var(--p3)', marginTop: 1, fontWeight: 700 }}>
                        AUJOURD'HUI
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES.map(emp => {
                const style = ROLE_STYLE[emp.role]
                return (
                  <tr key={emp.id}>
                    <td style={{ padding: '6px 12px' }}>
                      <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{emp.name}</div>
                      <div className="text-xs mt-0.5 font-semibold" style={{ color: style.color }}>{emp.role}</div>
                    </td>
                    {weekDays.map(d => {
                      const shift = shifts.find(s => s.empId === emp.id && s.day === d.date)
                      const isToday = d.date === TODAY
                      return (
                        <td key={d.date} style={{
                          padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle',
                          background: isToday ? 'rgba(91,78,232,0.04)' : undefined,
                        }}>
                          {shift ? (
                            <button
                              onClick={() => openEdit(shift)}
                              style={{
                                background: style.bg, color: style.color,
                                border: `1.5px solid ${style.color}`,
                                borderRadius: 10, padding: '5px 6px', cursor: 'pointer',
                                fontFamily: 'inherit', width: '100%',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                              }}
                              title="Modifier le créneau"
                            >
                              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                                {shift.start} – {shift.end}
                              </span>
                              <span style={{ fontSize: 10, opacity: 0.75 }}>
                                {fmtH(duration(shift.start, shift.end))}
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openAdd(emp.id, d.date)}
                              style={{
                                background: 'transparent',
                                border: '1.5px dashed var(--border)',
                                borderRadius: 10, padding: '8px 6px', cursor: 'pointer',
                                color: 'var(--text3)', fontFamily: 'inherit', width: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0.5, transition: 'opacity .2s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                              title="Ajouter un créneau"
                            >
                              <Plus size={12} />
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg3)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <span className="text-xs font-bold" style={{ color: 'var(--text2)' }}>
                    Total heures
                  </span>
                </td>
                {weekDays.map(d => {
                  const dayShifts = shifts.filter(s => s.day === d.date)
                  const dayHours  = dayShifts.reduce((acc, s) => acc + duration(s.start, s.end), 0)
                  const isToday   = d.date === TODAY
                  return (
                    <td key={d.date} style={{
                      textAlign: 'center', padding: '8px 4px',
                      background: isToday ? 'rgba(91,78,232,0.08)' : undefined,
                    }}>
                      {dayHours > 0 ? (
                        <span className="badge badge-blue font-black" style={{ fontFamily: 'var(--mono)' }}>
                          {fmtH(dayHours)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>–</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Modal créneau ── */}
      {editTarget && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setEdit(null)}>
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  {editTarget.shift ? '✏️ Modifier le créneau' : '➕ Nouveau créneau'}
                </h3>
                {editEmp && editDay && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                    <span style={{ color: ROLE_STYLE[editEmp.role].color, fontWeight: 700 }}>{editEmp.name}</span>
                    {' · '}{editDay.label}
                  </p>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}><X size={14} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text3)' }}>Heure de début</label>
                <input className="input text-sm" type="time" value={form.start}
                  onChange={e => setForm(p => ({ ...p, start: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text3)' }}>Heure de fin</label>
                <input className="input text-sm" type="time" value={form.end}
                  onChange={e => setForm(p => ({ ...p, end: e.target.value }))} />
              </div>
            </div>

            {form.start && form.end && duration(form.start, form.end) > 0 && (
              <div className="mb-3 p-3 rounded-xl flex items-center gap-3"
                style={{ background: 'var(--bg3)' }}>
                <span className="text-xs" style={{ color: 'var(--text3)' }}>Durée</span>
                <span className="badge badge-blue font-black" style={{ fontFamily: 'var(--mono)' }}>
                  {fmtH(duration(form.start, form.end))}
                </span>
                <span className="text-xs" style={{ color: 'var(--text3)', marginLeft: 'auto' }}>
                  {form.start} → {form.end}
                </span>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--text3)' }}>Note (optionnelle)</label>
              <input className="input text-sm" type="text" placeholder="ex : Demi-journée, Fermeture…"
                value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 justify-center" onClick={saveShift}>
                ✅ {editTarget.shift ? 'Enregistrer' : t('btn_add')}
              </button>
              {editTarget.shift && (
                <button className="btn btn-ghost" style={{ color: 'var(--danger)' }}
                  onClick={() => deleteShift(editTarget.shift!.id)}>
                  <Trash2 size={14} />
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('btn_cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
