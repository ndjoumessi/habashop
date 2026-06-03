import { useMemo } from 'react'
import Skeleton from '@/components/ui/skeleton'
import { Users } from 'lucide-react'
import { SHIFT_TYPES, shiftLabel, getDayLabels, ymd, type ShiftType, type PlanningEmployee } from './planningShared'

interface Props {
  lang: string
  loading: boolean
  monthGridDays: Date[]           // 42 cases (6 semaines × 7 jours), lundi-first
  monthAnchor: Date               // date dans le mois affiché (test « jour hors mois »)
  shiftsByDate: Record<string, { type: ShiftType; id: string }[]>
  filtered: PlanningEmployee[]    // employés visibles (respecte les filtres dépt/shift)
  lockedDates: Set<string>        // "empId_date" congé approuvé (accent visuel)
  onPickDay: (d: Date) => void    // clic sur un jour → drill vers la vue semaine
}

export default function PlanningMonth({ lang, loading, monthGridDays, monthAnchor, shiftsByDate, filtered, lockedDates, onPickDay }: Props) {
  const DAY_LABELS = getDayLabels(lang)
  const currentMonth = monthAnchor.getMonth()

  // Agrégat par date : nombre de shifts de chaque type (employés filtrés uniquement).
  const { byDate, leaveDays } = useMemo(() => {
    const allowed = new Set(filtered.map(e => e.id))
    const m: Record<string, Partial<Record<ShiftType, number>>> = {}
    const ld: Record<string, number> = {}
    for (const [key, arr] of Object.entries(shiftsByDate)) {
      const i = key.lastIndexOf('_'); const empId = key.slice(0, i); const date = key.slice(i + 1)
      if (!allowed.has(empId)) continue
      for (const s of arr) { (m[date] ??= {})[s.type] = ((m[date] ??= {})[s.type] ?? 0) + 1 }
    }
    lockedDates.forEach(k => {
      const i = k.lastIndexOf('_'); const empId = k.slice(0, i); const date = k.slice(i + 1)
      if (allowed.has(empId)) ld[date] = (ld[date] ?? 0) + 1
    })
    return { byDate: m, leaveDays: ld }
  }, [shiftsByDate, filtered, lockedDates])

  const todayStr = ymd(new Date())
  const SHIFT_ORDER = Object.keys(SHIFT_TYPES) as ShiftType[]

  return (
    <div style={{ background:'var(--grad-card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
      {loading ? (
        <div style={{ padding:14 }}><Skeleton height={60} count={6} radius={8} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--text3)', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <Users size={16}/> {lang==='en'?'No employees':lang==='es'?'Sin empleados':lang==='it'?'Nessun dipendente':'Aucun employé'}
        </div>
      ) : (
        <>
          {/* En-têtes jours */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'2px solid var(--border)', background:'linear-gradient(135deg,var(--bg4),var(--bg3))' }}>
            {DAY_LABELS.map((d,i)=>(
              <div key={i} style={{ padding:'8px 6px', textAlign:'center', fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.4px', color: (i>=5)?'var(--text4)':'var(--text3)' }}>{d}</div>
            ))}
          </div>
          {/* Grille 6×7 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {monthGridDays.map((day,idx)=>{
              const dateStr = ymd(day)
              const inMonth = day.getMonth() === currentMonth
              const isToday = dateStr === todayStr
              const isWeekend = day.getDay()===0 || day.getDay()===6
              const counts = byDate[dateStr] ?? {}
              const hasAny = SHIFT_ORDER.some(t => counts[t])
              const leaveCount = leaveDays[dateStr] ?? 0
              return (
                <div key={idx}
                  data-testid={`month-day-${dateStr}`}
                  onClick={()=>onPickDay(day)}
                  title={`${day.toLocaleDateString(lang==='en'?'en-US':lang==='es'?'es-ES':lang==='it'?'it-IT':'fr-FR',{weekday:'long',day:'numeric',month:'long'})}`}
                  style={{
                    minHeight:84, padding:'6px 6px 7px', cursor:'pointer',
                    borderRight: (idx%7!==6)?'1px solid var(--border)':'none',
                    borderBottom: (idx<35)?'1px solid var(--border)':'none',
                    background: isToday ? 'rgba(108,71,255,.08)' : (isWeekend && inMonth) ? 'var(--bg3)' : 'transparent',
                    opacity: inMonth ? 1 : .38,
                    transition:'background .1s',
                  }}
                  onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background = isToday?'rgba(108,71,255,.14)':'var(--bg4)' }}
                  onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background = isToday?'rgba(108,71,255,.08)':(isWeekend&&inMonth)?'var(--bg3)':'transparent' }}
                >
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight: isToday?900:700, color: isToday?'var(--p2)':inMonth?'var(--text)':'var(--text3)', fontFamily:'var(--mono)' }}>{day.getDate()}</span>
                    {isToday && <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--p)', boxShadow:'0 0 6px var(--p2)' }}/>}
                  </div>
                  {/* « dots » multi-shift : un pastille colorée par type présent + compteur */}
                  {hasAny ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      {SHIFT_ORDER.map(t=>{
                        const c = counts[t]; if (!c) return null
                        const s = SHIFT_TYPES[t]
                        return (
                          <div key={t} title={shiftLabel(t, lang)} style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ width:7, height:7, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
                            <span style={{ fontSize:11, fontWeight:'var(--fw-semibold)', color:'var(--text3)', fontFamily:'var(--mono)' }}>{c}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : leaveCount>0 ? null : (
                    inMonth && <span style={{ fontSize:11, color:'var(--text4)', opacity:.4 }}>—</span>
                  )}
                </div>
              )
            })}
          </div>
          {/* Légende */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', background:'var(--bg3)', display:'flex', gap:14, flexWrap:'wrap', alignItems:'center' }}>
            {(Object.entries(SHIFT_TYPES) as [ShiftType,any][]).map(([key,s])=>(
              <div key={key} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:s.color }}/>
                <span style={{ color:s.color, fontWeight:600 }}>{shiftLabel(key, lang)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
