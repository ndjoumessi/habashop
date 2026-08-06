import { useEffect, useState } from 'react'
import Skeleton from '@/components/ui/skeleton'
import { Users, MousePointer2, Lock, GripVertical } from 'lucide-react'
import { deptLabel } from '@/components/hr/hrShared'
import { SHIFT_TYPES, shiftLabel, getDayLabels, buildT } from './planningShared'
import type { ShiftType, PlanningEmployee } from './planningShared'

interface Props {
  lang: string
  loading: boolean
  filtered: PlanningEmployee[]
  weekDays: Date[]
  shifts: Record<string,Record<number,{ type: ShiftType; id: string }[]>>  // multi-shift : TABLEAU par case
  lockedShifts?: Record<string,Record<number,boolean>>  // cellules congé approuvé = non modifiables
  activeShift: ShiftType
  onAssign: (empId: string, di: number) => void
  onOpenModal: (empId: string, di: number, name: string) => void
  onClearShift: (empId: string, di: number) => void
  onMoveShift?: (srcEmpId: string, srcDi: number, dstEmpId: string, dstDi: number, type: ShiftType) => void
}

export default function PlanningGrid(props: Props) {
  const { lang, loading, filtered, weekDays, shifts, lockedShifts, activeShift, onAssign, onOpenModal, onClearShift, onMoveShift } = props
  const T = buildT(lang)
  const DAY_LABELS = getDayLabels(lang)
  const lockedTitle = lang === 'en' ? 'Approved leave — cannot be modified'
    : lang === 'es' ? 'Permiso aprobado — no modificable'
    : lang === 'it' ? 'Congedo approvato — non modificabile'
    : 'Congé approuvé — non modifiable'

  // Accessibilité : « saisie » d'un créneau (clavier Entrée/Espace ou tap sur la poignée) puis
  // dépôt sur une case (Entrée ou tap) — MÊME mutation onMoveShift que le drag&drop HTML5.
  // Échap / re-tap / tap sur la case source = annulation. État partagé clavier + tactile.
  const [grabbed, setGrabbed] = useState<{ empId: string; di: number; type: ShiftType } | null>(null)
  const [announce, setAnnounce] = useState('') // message lecteur d'écran (aria-live polite)
  useEffect(() => { setGrabbed(null) }, [weekDays]) // changement de semaine → sélection caduque

  const cancelGrab = () => { setGrabbed(null); setAnnounce(T.moveCancelled) }

  return (
    <div style={{
      background:'var(--bg2)',
      border:'1px solid var(--border2)',
      borderRadius:12, overflow:'hidden',
    }}>
      {/* Annonce lecteur d'écran (mode déplacement / dépôt / annulation) — visuellement masquée */}
      <div role="status" aria-live="polite" style={{
        position:'absolute', width:1, height:1, margin:-1, padding:0,
        overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap', border:0,
      }}>{announce}</div>
      <div style={{overflowX:'auto'}}>
        <table aria-label={T.title} style={{
          width:'100%', borderCollapse:'collapse', minWidth:720,
        }}>
          <thead>
            <tr style={{
              background:'var(--bg2)',
              borderBottom:'1px solid var(--border)',
            }}>
              <th scope="col" style={{
                padding:'12px 16px', textAlign:'left',
                width:160, fontSize:'var(--fs-caption)', fontWeight:'var(--fw-bold)',
                textTransform:'uppercase', letterSpacing:'.6px',
                color:'var(--text3)',
                position:'sticky', left:0, zIndex:2,
                background:'var(--bg2)',
              }}>
                {T.employee}
              </th>
              {weekDays.map((day,di)=>{
                const isToday = day.toDateString()===new Date().toDateString()
                const isWeekend = day.getDay()===0||day.getDay()===6
                return (
                  <th key={di} scope="col" style={{
                    padding:'10px 6px', textAlign:'center',
                    /* colonne « aujourd'hui » : teinte primaire thémée (lisible dans les 9 thèmes, Soleil inclus) */
                    background: isToday
                      ? 'color-mix(in srgb, var(--p) 12%, transparent)' : 'transparent',
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
                      fontSize:'var(--fs-caption)', fontWeight:'var(--fw-semibold)',
                      color: isWeekend ? 'var(--text4)' : 'var(--text3)',
                      textTransform:'uppercase', letterSpacing:'.4px',
                    }}>
                      {DAY_LABELS[di]}
                    </div>
                    <div style={{
                      fontSize:'var(--fs-lg)', fontWeight:'var(--fw-bold)', marginTop:2,
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
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '8px 14px' }}><Skeleton height={40} count={5} radius={8} /></td></tr>
            ) : filtered.length===0 ? (
              <tr>
                <td colSpan={8} style={{
                  textAlign:'center', padding:'48px',
                  color:'var(--text3)', fontSize:'var(--fs-body)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Users size={16}/> {T.noEmp}</div>
                </td>
              </tr>
            ) : filtered.map((emp,ri)=>(
              /* zebra rgba(255,255,255,.01) supprimée : quasi invisible et illisible en thème clair */
              <tr key={emp.id} style={{
                borderBottom:'1px solid var(--border)',
              }}>
                <td style={{
                  padding:'8px 16px',
                  position:'sticky', left:0, zIndex:1,
                  background:'var(--bg2)',
                  boxShadow:'2px 0 6px rgba(0,0,0,.15)',
                }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:8,
                  }}>
                    <div style={{
                      width:34, height:34, borderRadius:10,
                      background:`linear-gradient(135deg,
                        ${emp.color},${emp.color}66)`,
                      display:'flex', alignItems:'center',
                      justifyContent:'center',
                      fontSize:'var(--fs-caption)', fontWeight:'var(--fw-bold)', color:'#fff',
                      flexShrink:0,
                      boxShadow:`0 2px 8px ${emp.color}35`,
                    }}>
                      {emp.avatar}
                    </div>
                    <div>
                      <div style={{
                        fontSize:'var(--fs-label)', fontWeight:'var(--fw-semibold)',
                        color:'var(--text)', whiteSpace:'nowrap',
                      }}>
                        {emp.name.split(' ')[0]}
                      </div>
                      <div style={{
                        fontSize:'var(--fs-caption)', color:'var(--text3)',
                        whiteSpace:'nowrap',
                      }}>{deptLabel(emp.dept, lang)}</div>
                    </div>
                  </div>
                </td>

                {weekDays.map((_,di)=>{
                  const arr = shifts[emp.id]?.[di] ?? []
                  const hasShifts = arr.length > 0
                  const single = arr.length === 1 ? SHIFT_TYPES[arr[0].type] : null // 1 shift → cellule colorée (look mono-shift conservé)
                  const isLocked = !!lockedShifts?.[emp.id]?.[di]  // congé approuvé → non modifiable
                  const isWeekend = weekDays[di].getDay()===0
                    || weekDays[di].getDay()===6
                  const isToday = weekDays[di].toDateString()===new Date().toDateString()
                  const preview = SHIFT_TYPES[activeShift]
                  const firstName = emp.name.split(' ')[0]
                  const cellDate = `${DAY_LABELS[di]} ${weekDays[di].getDate()}`
                  const isSource = grabbed?.empId === emp.id && grabbed?.di === di
                  const cellLabel = `${firstName}, ${cellDate} — ${hasShifts ? arr.map(sh => shiftLabel(sh.type, lang)).join(', ') : T.emptyCell}${isLocked ? `. ${lockedTitle}` : ''}`
                  // Activation case (clic, tap OU Entrée/Espace) : si un créneau est saisi → dépôt
                  // (même mutation que le drop HTML5) ; sinon comportement existant (modale/assignation).
                  const activateCell = () => {
                    if (grabbed) {
                      if (isSource) { cancelGrab(); return } // dépôt sur la case source = annulation
                      if (isLocked || !onMoveShift) return
                      onMoveShift(grabbed.empId, grabbed.di, emp.id, di, grabbed.type)
                      setGrabbed(null); setAnnounce(T.moved)
                      return
                    }
                    if (isLocked) return  // congé approuvé : assignation bloquée
                    if (!hasShifts) {
                      onOpenModal(emp.id, di, firstName)
                    } else {
                      onAssign(emp.id,di)  // AJOUTE le shift actif (conserve les autres types)
                    }
                  }

                  return (
                    <td key={di} style={{
                      padding:'4px 3px',
                      background: isToday
                        ? 'color-mix(in srgb, var(--p) 4%, transparent)' : 'transparent',
                    }}>
                      <div
                        title={isLocked ? lockedTitle : undefined}
                        role="button"
                        tabIndex={0}
                        aria-label={cellLabel}
                        aria-disabled={isLocked || undefined}
                        data-pcell={`${ri}-${di}`}
                        // Drop target uniquement : on dépose un shift glissé (depuis un chip) sur cette
                        // case (non verrouillée) → le shift de ce TYPE est DÉPLACÉ (upsert cible + delete source).
                        onDragOver={e=>{ if (!isLocked && onMoveShift) e.preventDefault() }}
                        onDrop={e=>{
                          if (isLocked || !onMoveShift) return
                          e.preventDefault()
                          try {
                            const src = JSON.parse(e.dataTransfer.getData('text/plain'))
                            if (src && typeof src.empId === 'string' && typeof src.di === 'number' && typeof src.type === 'string') onMoveShift(src.empId, src.di, emp.id, di, src.type)
                          } catch { /* drop non-shift ignoré */ }
                        }}
                        onClick={activateCell}
                        onKeyDown={e=>{
                          // ignore les touches d'activation venues d'un enfant (poignée <button>)
                          if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Delete' || e.key === 'Backspace') && e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateCell() }
                          else if (e.key === 'Escape') { if (grabbed) cancelGrab() }
                          else if ((e.key === 'Delete' || e.key === 'Backspace') && !grabbed && !isLocked && hasShifts) {
                            e.preventDefault(); onClearShift(emp.id, di) // équivalent clavier du double-clic
                          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                            e.preventDefault()
                            const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
                            const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
                            e.currentTarget.closest('table')?.querySelector<HTMLElement>(`[data-pcell="${ri + dr}-${di + dc}"]`)?.focus()
                          }
                        }}
                        onDoubleClick={()=>{ if (!isLocked) onClearShift(emp.id,di) }}
                        style={{
                          minHeight:58, borderRadius:10,
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          display:'flex', flexDirection:'column',
                          alignItems:'center', justifyContent:'center',
                          gap:3, padding:'4px 2px',
                          /* bordure des chips renforcée (35 → 55) ; week-end vide sur bg3 (rgba noir illisible en Soleil) */
                          border:`1px solid ${single ? `${single.color}55` : 'var(--border)'}`,
                          background: single
                            ? single.bg
                            : isWeekend && !hasShifts
                              ? 'var(--bg3)'
                              : 'var(--bg4)',
                          opacity: isLocked ? .6 : (isWeekend&&!hasShifts ? .5 : 1),
                          transition:'all .1s',
                          userSelect:'none',
                          position:'relative',
                          overflow:'hidden',
                          // mode déplacement : matérialise les cases de dépôt valides (clavier + tactile)
                          boxShadow: grabbed && !isLocked && !isSource ? 'inset 0 0 0 1px var(--p2)' : undefined,
                        }}
                        onMouseEnter={e=>{
                          if (!hasShifts && !isLocked) {
                            const el=e.currentTarget as HTMLElement
                            el.style.background=`${preview.color}18`
                            el.style.borderColor=`${preview.color}40`
                            el.style.transform='scale(1.03)'
                          }
                        }}
                        onMouseLeave={e=>{
                          if (!hasShifts && !isLocked) {
                            const el=e.currentTarget as HTMLElement
                            el.style.background=isWeekend
                              ?'var(--bg3)':'var(--bg4)'
                            el.style.borderColor='var(--border)'
                            el.style.transform='scale(1)'
                          }
                        }}
                      >
                        {isLocked && (
                          <span style={{ position:'absolute', top:2, right:3, display:'flex', color:'var(--text3)', opacity:.85, pointerEvents:'none' }}>
                            <Lock size={9} />
                          </span>
                        )}
                        {hasShifts ? (
                          // Shifts empilés : chaque chip est draggable et porte SON type (drag&drop déplace ce type précis).
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, width:'100%' }}>
                            {arr.map(sh=>{
                              const s = SHIFT_TYPES[sh.type]
                              const draggableChip = !isLocked && !!onMoveShift && sh.type!=='leave'
                              const isGrabbed = !!grabbed && grabbed.empId === emp.id && grabbed.di === di && grabbed.type === sh.type
                              return (
                                <div key={sh.type}
                                  title={shiftLabel(sh.type, lang)}
                                  draggable={draggableChip}
                                  onDragStart={e=>{ e.stopPropagation(); e.dataTransfer.setData('text/plain', JSON.stringify({ empId: emp.id, di, type: sh.type })); e.dataTransfer.effectAllowed='move' }}
                                  onClick={e=>{ if (arr.length>1 && !grabbed) e.stopPropagation() }} // en mode déplacement, laisse le tap atteindre la case (dépôt)
                                  style={{
                                    display:'flex', alignItems:'center', justifyContent:'center', gap:3,
                                    cursor: draggableChip ? 'grab' : 'default',
                                    ...(arr.length>1 ? {
                                      background:`${s.color}1a`, border:`1px solid ${s.color}66`,
                                      borderRadius:6, padding:'1px 5px', width:'100%',
                                    } : null),
                                    // créneau saisi (clavier/tactile) : état visuel de sélection
                                    ...(isGrabbed ? { outline:'2px solid var(--p)', outlineOffset:1, borderRadius:6 } : null),
                                  }}
                                >
                                  <span style={{ color:s.color, display:'flex' }}>{s.icon}</span>
                                  {s.hours && (
                                    <span style={{
                                      fontSize:'var(--fs-caption)', fontWeight:'var(--fw-bold)',
                                      /* heures assombries/éclaircies vers le texte : contraste AA en Mode Soleil sans toucher la palette shifts */
                                      color:`color-mix(in srgb, ${s.color} 72%, var(--text))`,
                                      fontFamily:'var(--mono)',
                                      letterSpacing:'-.3px',
                                      lineHeight:1,
                                    }}>{s.hours}</span>
                                  )}
                                  {/* Poignée de déplacement : cible focusable (Tab) + tactile (tap) — saisit/relâche
                                      le créneau sans passer par le drag HTML5 (inopérant sans souris). */}
                                  {draggableChip && (
                                    <button
                                      type="button"
                                      aria-label={`${T.moveHandle} : ${shiftLabel(sh.type, lang)} — ${firstName}, ${cellDate}`}
                                      aria-pressed={isGrabbed}
                                      onClick={e=>{
                                        e.stopPropagation()
                                        if (isGrabbed) { cancelGrab(); return }
                                        setGrabbed({ empId: emp.id, di, type: sh.type })
                                        setAnnounce(`${shiftLabel(sh.type, lang)} — ${firstName}, ${cellDate}. ${T.moveMode}`)
                                      }}
                                      style={{
                                        display:'flex', alignItems:'center', justifyContent:'center',
                                        // cible tactile élargie (padding 7) SANS casser la mise en page des chips :
                                        // la marge négative compense pour garder la même boîte de layout qu'avant.
                                        background:'transparent', border:'none', padding:7, margin:-6,
                                        cursor:'pointer', color: isGrabbed ? 'var(--p)' : s.color,
                                        opacity: isGrabbed ? 1 : .55, transition:'opacity .12s',
                                      }}
                                    >
                                      <GripVertical size={10}/>
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span style={{
                            fontSize:'var(--fs-xl)', color:'var(--text4)',
                            opacity:.3, fontWeight:'var(--fw-regular)',
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

      {/* Pied — l'ASTUCE DE CLIC, et elle seule.
          ⚠️ La légende des six types de poste a été RETIRÉE : elle répétait à l'identique la
          barre « ASSIGNER : » du haut — mêmes six entrées, mêmes couleurs, et jusqu'aux mêmes
          HORAIRES (`ShiftSelector.tsx:52-56` les affiche déjà). Deux fois la même information
          sur un écran, c'est deux endroits à maintenir et un lecteur qui cherche la différence
          entre les deux. On garde le CONTRÔLE en haut, pas la légende en bas.
          Ce qui reste ici est le seul élément que la barre du haut ne porte pas. */}
      <div style={{
        padding:'8px 16px',
        borderTop:'1px solid var(--border)',
        background:'var(--bg3)',
        display:'flex', alignItems:'center', justifyContent:'flex-end',
      }}>
        <div style={{fontSize:'var(--fs-caption)',color:'var(--text3)', display:'flex', alignItems:'center', gap:4}}>
          <MousePointer2 size={9}/> {T.clearTip}
        </div>
      </div>
    </div>
  )
}
