import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { employeesApi, shiftsApi, leaveRequestsApi } from '@/lib/api'
import { eachDateInclusive } from '@/components/hr/hrShared'
import toast from 'react-hot-toast'
import {
  SHIFT_TYPES, shiftLabel, localeFor, buildT,
  type ShiftType, type PlanningEmployee,
} from '@/components/planning/planningShared'
import PlanningHeader from '@/components/planning/PlanningHeader'
import ShiftSelector from '@/components/planning/ShiftSelector'
import PlanningFilters from '@/components/planning/PlanningFilters'
import PlanningGrid from '@/components/planning/PlanningGrid'
import AssignShiftModal from '@/components/planning/AssignShiftModal'
import PlanningStats from '@/components/planning/PlanningStats'

// Date locale → "YYYY-MM-DD" (clé Shift backend ; local, pas UTC, pour coller à weekDays).
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const cellKey = (empId: string, date: string) => `${empId}_${date}`

export default function Planning() {
  const { lang } = useAppStore()
  const [employees, setEmployees] = useState<PlanningEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<ShiftType>('full')
  // Phase 6-planning : shifts DATÉS via /api/shifts. État maître keyé "empId_YYYY-MM-DD"
  // (lookup O(1), shifts datés — lundi 25/05 ≠ lundi 01/06). `id` gardé pour DELETE.
  const [shiftsByDate, setShiftsByDate] = useState<Record<string, { type: ShiftType; id: string }>>({})
  // Verrouillage : jours de congé APPROUVÉ (remplace l'ancienne carte localStorage transitoire).
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set())
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState<ShiftType|'all'>('all')
  const [planningWeek, setPlanningWeek] = useState(new Date())
  const [shiftModal, setShiftModal] = useState<{empId:string; di:number; name:string} | null>(null)
  const [modalShift, setModalShift] = useState<ShiftType>('full')

  useEffect(() => {
    employeesApi.list().then((data:any[]) => {
      if (data?.length > 0) setEmployees(data.map((e:any) => ({
        id: e.id, name: e.name??'', role: e.role??'',
        dept: e.department ?? e.dept ?? '', avatar: (e.name??'??').split(' ')
          .map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase(),
        color: e.color??'#6C47FF', isActive: e.active ?? e.isActive ?? e.status !== 'inactive',
      })))
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  // Congés approuvés → jours verrouillés (au montage). eachDateInclusive partagé avec HR/backend.
  useEffect(() => {
    leaveRequestsApi.list('APPROVED').then((rows:any[]) => {
      if (!Array.isArray(rows)) return
      const s = new Set<string>()
      for (const lr of rows) {
        for (const date of eachDateInclusive(String(lr.startDate ?? ''), String(lr.endDate ?? ''))) {
          s.add(cellKey(String(lr.employeeId), date))
        }
      }
      setLockedDates(s)
    }).catch(() => { /* verrouillage best-effort */ })
  }, [])

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

  // Charge les shifts du/des mois couverts par la semaine affichée (fusion dans l'état maître).
  const loadWeek = useCallback(async () => {
    const months = [...new Set([ymd(weekDays[0]).slice(0, 7), ymd(weekDays[6]).slice(0, 7)])]
    try {
      const results = await Promise.all(months.map(m => shiftsApi.list(m)))
      setShiftsByDate(prev => {
        const next = { ...prev }
        for (const r of results.flat()) next[cellKey(String(r.employeeId), String(r.date))] = { type: r.shiftTypeKey as ShiftType, id: String(r.id) }
        return next
      })
    } catch {
      toast.error(lang === 'en' ? 'Failed to load schedule' : lang === 'es' ? 'Error al cargar la planificación' : lang === 'it' ? 'Caricamento pianificazione fallito' : 'Échec du chargement du planning')
    }
  }, [weekDays, lang])
  useEffect(() => { loadWeek() }, [loadWeek])

  // Vues dérivées indexées par jour (0-6) de la semaine affichée → la grille/filtres/stats
  // restent inchangés (ils consomment shifts[empId][di] / lockedForWeek[empId][di]).
  const { shifts, lockedForWeek } = useMemo(() => {
    const dateToIndex: Record<string, number> = {}
    weekDays.forEach((d, i) => { dateToIndex[ymd(d)] = i })
    const sh: Record<string, Record<number, ShiftType>> = {}
    const lk: Record<string, Record<number, boolean>> = {}
    const parse = (key: string) => { const i = key.lastIndexOf('_'); return { empId: key.slice(0, i), date: key.slice(i + 1) } }
    for (const [key, v] of Object.entries(shiftsByDate)) {
      const { empId, date } = parse(key); const di = dateToIndex[date]
      if (di === undefined) continue
      ;(sh[empId] ??= {})[di] = v.type
    }
    lockedDates.forEach(key => {
      const { empId, date } = parse(key); const di = dateToIndex[date]
      if (di === undefined) return
      ;(lk[empId] ??= {})[di] = true
    })
    return { shifts: sh, lockedForWeek: lk }
  }, [shiftsByDate, lockedDates, weekDays])

  const depts = useMemo(()=> [...new Set(employees.map(e=>e.dept).filter(Boolean))], [employees])

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (!e.isActive) return false
      if (filterDept !== 'all' && e.dept !== filterDept) return false
      if (filterStatus !== 'all') {
        const hasShift = weekDays.some((_,di) => shifts[e.id]?.[di] === filterStatus)
        if (!hasShift) return false
      }
      return true
    })
  }, [employees, filterDept, filterStatus, shifts, weekDays])

  // Upsert d'une case (date = weekDays[di]) — bloqué si verrouillé ; optimiste + ROLLBACK atomique.
  const setCell = (empId: string, di: number, type: ShiftType) => {
    const date = ymd(weekDays[di]); const key = cellKey(empId, date)
    if (lockedDates.has(key)) return
    const prev = shiftsByDate[key]
    setShiftsByDate(p => ({ ...p, [key]: { type, id: prev?.id ?? '' } }))
    shiftsApi.upsert({ employeeId: empId, date, shiftTypeKey: type })
      .then(r => setShiftsByDate(p => ({ ...p, [key]: { type, id: String(r.id) } })))
      .catch(() => {
        setShiftsByDate(p => { const n = { ...p }; if (prev) n[key] = prev; else delete n[key]; return n })
        toast.error(lang === 'en' ? 'Save failed' : lang === 'es' ? 'Error al guardar' : lang === 'it' ? 'Salvataggio fallito' : 'Échec de l\'enregistrement')
      })
  }

  const removeCell = (empId: string, di: number) => {
    const key = cellKey(empId, ymd(weekDays[di]))
    if (lockedDates.has(key)) return
    const prev = shiftsByDate[key]
    if (!prev) return
    setShiftsByDate(p => { const n = { ...p }; delete n[key]; return n })
    if (prev.id) shiftsApi.remove(prev.id).catch(() => {
      setShiftsByDate(p => ({ ...p, [key]: prev }))
      toast.error(lang === 'en' ? 'Delete failed' : lang === 'es' ? 'Error al eliminar' : lang === 'it' ? 'Eliminazione fallita' : 'Échec de la suppression')
    })
  }

  const assignShift = (empId:string, di:number) => {
    if (shifts[empId]?.[di] === activeShift) removeCell(empId, di) // re-clic même type → retire
    else setCell(empId, di, activeShift)
  }
  const clearShift = (empId:string, di:number) => removeCell(empId, di)

  // Drag&drop : DÉPLACE le shift source vers la case cible (upsert cible + delete source).
  // Respecte le verrouillage (source ou cible congé approuvé → ignoré) et ignore les congés.
  const moveShift = (srcEmpId:string, srcDi:number, dstEmpId:string, dstDi:number) => {
    if (srcEmpId === dstEmpId && srcDi === dstDi) return
    const srcKey = cellKey(srcEmpId, ymd(weekDays[srcDi]))
    const dstKey = cellKey(dstEmpId, ymd(weekDays[dstDi]))
    if (lockedDates.has(srcKey) || lockedDates.has(dstKey)) return
    const src = shiftsByDate[srcKey]
    if (!src || src.type === 'leave') return // rien à déplacer / congé non déplaçable
    setCell(dstEmpId, dstDi, src.type) // pose à la cible
    removeCell(srcEmpId, srcDi)        // retire de la source
  }

  const exportCSVPlan = () => {
    const locale = localeFor(lang)
    const T = buildT(lang)
    const rows = [
      [T.employee, ...weekDays.map(d=> d.toLocaleDateString(locale, {weekday:'short',day:'numeric',month:'short'}))],
      ...filtered.map(emp=>[
        emp.name,
        ...weekDays.map((_,di)=>{ const s = shifts[emp.id]?.[di]; return s ? `${shiftLabel(s, lang)} ${SHIFT_TYPES[s].hours}` : '' })
      ])
    ]
    const csv = '﻿' + rows.map(r=>r.join(';')).join('\r\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`Planning_${ymd(weekDays[0])}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success(lang === 'en' ? '📊 Schedule exported!' : lang === 'es' ? '📊 ¡Planificación exportada!' : lang === 'it' ? '📊 Pianificazione esportata!' : '📊 Planning exporté !')
  }

  // Résumé de la semaine affichée (dérivé de la vue di).
  const stats = useMemo(() => {
    const counts: Record<string,number> = {}
    Object.values(shifts).forEach(days => Object.values(days).forEach(s => { counts[s] = (counts[s]??0)+1 }))
    return counts
  }, [shifts])

  // Phase 7 — copie la semaine affichée vers la suivante (mêmes shifts à J+7). Ignore les
  // congés ('leave', pilotés par les demandes) et ne remplace pas un congé approuvé cible.
  const copyWeekToNext = async () => {
    const dateToIndex: Record<string, number> = {}
    weekDays.forEach((d, i) => { dateToIndex[ymd(d)] = i })
    const targetDates = weekDays.map(d => { const t = new Date(d); t.setDate(t.getDate() + 7); return ymd(t) })
    const toCopy: { empId: string; date: string; type: ShiftType }[] = []
    for (const [key, v] of Object.entries(shiftsByDate)) {
      const i = key.lastIndexOf('_'); const empId = key.slice(0, i); const date = key.slice(i + 1)
      const di = dateToIndex[date]
      if (di === undefined || v.type === 'leave') continue // hors semaine affichée ou congé → ignoré
      const targetDate = targetDates[di]
      if (lockedDates.has(cellKey(empId, targetDate))) continue // ne pas écraser un congé approuvé cible
      toCopy.push({ empId, date: targetDate, type: v.type })
    }
    if (toCopy.length === 0) {
      toast(lang === 'en' ? 'No shift to copy this week' : lang === 'es' ? 'Ningún turno que copiar esta semana' : lang === 'it' ? 'Nessun turno da copiare questa settimana' : 'Aucun shift à copier cette semaine')
      return
    }
    try {
      const created = await Promise.all(toCopy.map(c => shiftsApi.upsert({ employeeId: c.empId, date: c.date, shiftTypeKey: c.type })))
      setShiftsByDate(prev => {
        const next = { ...prev }
        created.forEach((r, idx) => { next[cellKey(toCopy[idx].empId, toCopy[idx].date)] = { type: toCopy[idx].type, id: String(r.id) } })
        return next
      })
      toast.success(`${toCopy.length} ${lang === 'en' ? 'shifts copied → next week' : lang === 'es' ? 'turnos copiados → próxima semana' : lang === 'it' ? 'turni copiati → settimana succ.' : 'shifts copiés → semaine suivante'}`)
      const next = new Date(planningWeek); next.setDate(next.getDate() + 7); setPlanningWeek(next) // affiche le résultat
    } catch {
      toast.error(lang === 'en' ? 'Copy failed' : lang === 'es' ? 'Error al copiar' : lang === 'it' ? 'Copia fallita' : 'Échec de la copie')
    }
  }

  const confirmShift = () => {
    if (!shiftModal) return
    setCell(shiftModal.empId, shiftModal.di, modalShift)
    toast.success(`${shiftLabel(modalShift, lang)} ${lang === 'en' ? 'assigned → ' : lang === 'es' ? 'asignado a ' : lang === 'it' ? 'assegnato a ' : 'assigné à '}${shiftModal.name}`)
    setShiftModal(null)
  }

  return (
    <div className="animate-in" style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <PlanningHeader lang={lang} weekDays={weekDays} planningWeek={planningWeek} setPlanningWeek={setPlanningWeek} onExport={exportCSVPlan} onCopyWeek={copyWeekToNext} />

      <ShiftSelector lang={lang} activeShift={activeShift} setActiveShift={setActiveShift} />

      <PlanningFilters lang={lang} filterDept={filterDept} setFilterDept={setFilterDept} filterStatus={filterStatus} setFilterStatus={setFilterStatus} depts={depts} />

      <PlanningGrid
        lang={lang}
        loading={loading}
        filtered={filtered}
        weekDays={weekDays}
        shifts={shifts}
        lockedShifts={lockedForWeek}
        activeShift={activeShift}
        onAssign={assignShift}
        onOpenModal={(empId, di, name) => { setModalShift(activeShift); setShiftModal({ empId, di, name }) }}
        onClearShift={clearShift}
        onMoveShift={moveShift}
      />

      {shiftModal && (
        <AssignShiftModal lang={lang} shiftModal={shiftModal} modalShift={modalShift} setModalShift={setModalShift} weekDays={weekDays} onConfirm={confirmShift} onClose={() => setShiftModal(null)} />
      )}

      <PlanningStats lang={lang} stats={stats} />
    </div>
  )
}
