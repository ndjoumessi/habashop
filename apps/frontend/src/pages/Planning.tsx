import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { employeesApi, shiftsApi, leaveRequestsApi } from '@/lib/api'
import { eachDateInclusive } from '@/components/hr/hrShared'
import toast from 'react-hot-toast'
import {
  SHIFT_TYPES, shiftLabel, localeFor, buildT, ymd,
  type ShiftType, type PlanningEmployee,
} from '@/components/planning/planningShared'
import PlanningHeader from '@/components/planning/PlanningHeader'
import ShiftSelector from '@/components/planning/ShiftSelector'
import PlanningFilters from '@/components/planning/PlanningFilters'
import PlanningGrid from '@/components/planning/PlanningGrid'
import PlanningMonth from '@/components/planning/PlanningMonth'
import AssignShiftModal from '@/components/planning/AssignShiftModal'
import PlanningStats from '@/components/planning/PlanningStats'

const cellKey = (empId: string, date: string) => `${empId}_${date}`

export default function Planning() {
  const { lang } = useAppStore()
  const [employees, setEmployees] = useState<PlanningEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<ShiftType>('full')
  // Phase 6-planning : shifts DATÉS via /api/shifts. État maître keyé "empId_YYYY-MM-DD"
  // (lookup O(1), shifts datés — lundi 25/05 ≠ lundi 01/06). `id` gardé pour DELETE.
  // Multi-shift/jour : VALEUR = TABLEAU de shifts (ex. matin + soir le même jour). Choix d'un
  // tableau (vs map par type) car il mappe 1:1 le rendu « N chips empilés dans une case » et la
  // vue dérivée par index de jour ; l'unicité par type est garantie côté ADD (setCell skip-if-present)
  // et côté contrainte SQL @@unique([tenantId,employeeId,date,shiftTypeKey]).
  const [shiftsByDate, setShiftsByDate] = useState<Record<string, { type: ShiftType; id: string }[]>>({})
  // Verrouillage : jours de congé APPROUVÉ (remplace l'ancienne carte localStorage transitoire).
  const [lockedDates, setLockedDates] = useState<Set<string>>(new Set())
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState<ShiftType|'all'>('all')
  const [view, setView] = useState<'week'|'month'>('week')
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

  // Mois affiché (vue mois) : 1er du mois de planningWeek (ancre du sous-titre / « jour hors mois »).
  const monthAnchor = useMemo(() => new Date(planningWeek.getFullYear(), planningWeek.getMonth(), 1), [planningWeek])
  // Grille calendaire 6×7 (42 cases), lundi-first, débordant sur les mois adjacents.
  const monthGridDays = useMemo(() => {
    const first = monthAnchor
    const day = first.getDay()
    const start = new Date(first)
    start.setDate(first.getDate() + (day===0 ? -6 : 1 - day)) // recule au lundi de la 1ʳᵉ semaine
    return Array(42).fill(null).map((_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d })
  }, [monthAnchor])

  // Charge les shifts du/des mois couverts par la plage affichée (semaine OU grille mois). Fusion dans l'état maître.
  const loadWeek = useCallback(async () => {
    const range = view === 'month' ? monthGridDays : weekDays
    const months = [...new Set(range.map(d => ymd(d).slice(0, 7)))] // tous les mois touchés (≤3 en vue mois)
    try {
      const results = await Promise.all(months.map(m => shiftsApi.list(m)))
      // Regroupe les lignes en TABLEAUX par cellule (plusieurs shifts/jour possibles).
      const grouped: Record<string, { type: ShiftType; id: string }[]> = {}
      for (const r of results.flat()) {
        const k = cellKey(String(r.employeeId), String(r.date))
        ;(grouped[k] ??= []).push({ type: r.shiftTypeKey as ShiftType, id: String(r.id) })
      }
      const monthSet = new Set(months)
      setShiftsByDate(prev => {
        const next: Record<string, { type: ShiftType; id: string }[]> = {}
        // Conserve les clés hors des mois rechargés ; remplace celles des mois chargés (gère aussi les suppressions distantes).
        for (const [k, v] of Object.entries(prev)) {
          const date = k.slice(k.lastIndexOf('_') + 1)
          if (!monthSet.has(date.slice(0, 7))) next[k] = v
        }
        for (const [k, v] of Object.entries(grouped)) next[k] = v
        return next
      })
    } catch {
      toast.error(lang === 'en' ? 'Failed to load schedule' : lang === 'es' ? 'Error al cargar la planificación' : lang === 'it' ? 'Caricamento pianificazione fallito' : 'Échec du chargement du planning')
    }
  }, [view, weekDays, monthGridDays, lang])
  useEffect(() => { loadWeek() }, [loadWeek])

  // Vues dérivées indexées par jour (0-6) de la semaine affichée → la grille/filtres/stats
  // restent inchangés (ils consomment shifts[empId][di] / lockedForWeek[empId][di]).
  const { shifts, lockedForWeek } = useMemo(() => {
    const dateToIndex: Record<string, number> = {}
    weekDays.forEach((d, i) => { dateToIndex[ymd(d)] = i })
    const sh: Record<string, Record<number, { type: ShiftType; id: string }[]>> = {}
    const lk: Record<string, Record<number, boolean>> = {}
    const parse = (key: string) => { const i = key.lastIndexOf('_'); return { empId: key.slice(0, i), date: key.slice(i + 1) } }
    for (const [key, arr] of Object.entries(shiftsByDate)) {
      const { empId, date } = parse(key); const di = dateToIndex[date]
      if (di === undefined) continue
      ;(sh[empId] ??= {})[di] = arr
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
        const hasShift = weekDays.some((_,di) => (shifts[e.id]?.[di] ?? []).some(s => s.type === filterStatus))
        if (!hasShift) return false
      }
      return true
    })
  }, [employees, filterDept, filterStatus, shifts, weekDays])

  // AJOUTE un shift d'un type donné à une case (date = weekDays[di]) — n'écrase PAS les autres
  // types déjà posés. Bloqué si verrouillé ; no-op si ce type est déjà présent ; optimiste + ROLLBACK.
  const setCell = (empId: string, di: number, type: ShiftType) => {
    const date = ymd(weekDays[di]); const key = cellKey(empId, date)
    if (lockedDates.has(key)) return
    if ((shiftsByDate[key] ?? []).some(s => s.type === type)) return // type déjà présent → no-op
    setShiftsByDate(p => ({ ...p, [key]: [...(p[key] ?? []), { type, id: '' }] })) // optimiste (id provisoire)
    shiftsApi.upsert({ employeeId: empId, date, shiftTypeKey: type })
      .then(r => setShiftsByDate(p => ({ ...p, [key]: (p[key] ?? []).map(s => (s.type === type && !s.id) ? { type, id: String(r.id) } : s) })))
      .catch(() => {
        setShiftsByDate(p => {
          const arr = (p[key] ?? []).filter(s => !(s.type === type && !s.id)) // retire l'entrée optimiste
          const n = { ...p }; if (arr.length) n[key] = arr; else delete n[key]; return n
        })
        toast.error(lang === 'en' ? 'Save failed' : lang === 'es' ? 'Error al guardar' : lang === 'it' ? 'Salvataggio fallito' : 'Échec de l\'enregistrement')
      })
  }

  // RETIRE un shift : `type` fourni → seulement ce type ; sinon → TOUS les shifts de la case.
  const removeCell = (empId: string, di: number, type?: ShiftType) => {
    const key = cellKey(empId, ymd(weekDays[di]))
    if (lockedDates.has(key)) return
    const prev = shiftsByDate[key]
    if (!prev || prev.length === 0) return
    const toRemove = type ? prev.filter(s => s.type === type) : prev
    if (toRemove.length === 0) return
    setShiftsByDate(p => {
      const remaining = type ? (p[key] ?? []).filter(s => s.type !== type) : []
      const n = { ...p }; if (remaining.length) n[key] = remaining; else delete n[key]; return n
    })
    const ids = toRemove.map(s => s.id).filter(Boolean)
    if (ids.length) Promise.all(ids.map(id => shiftsApi.remove(id))).catch(() => {
      setShiftsByDate(p => ({ ...p, [key]: prev })) // rollback : restaure le tableau complet
      toast.error(lang === 'en' ? 'Delete failed' : lang === 'es' ? 'Error al eliminar' : lang === 'it' ? 'Eliminazione fallita' : 'Échec de la suppression')
    })
  }

  // Clic sur une case pleine → AJOUTE le shift actif (conserve les autres types déjà posés).
  const assignShift = (empId:string, di:number) => setCell(empId, di, activeShift)
  // Double-clic → retire UNIQUEMENT le type actif (les autres shifts de la case restent).
  const clearShift = (empId:string, di:number) => removeCell(empId, di, activeShift)

  // Drag&drop : DÉPLACE le shift du TYPE source précis vers la case cible (upsert cible + delete source).
  // Respecte le verrouillage (source ou cible congé approuvé → ignoré) et ignore les congés.
  const moveShift = (srcEmpId:string, srcDi:number, dstEmpId:string, dstDi:number, type: ShiftType) => {
    if (srcEmpId === dstEmpId && srcDi === dstDi) return
    const srcKey = cellKey(srcEmpId, ymd(weekDays[srcDi]))
    const dstKey = cellKey(dstEmpId, ymd(weekDays[dstDi]))
    if (lockedDates.has(srcKey) || lockedDates.has(dstKey)) return
    const moving = (shiftsByDate[srcKey] ?? []).find(s => s.type === type)
    if (!moving || moving.type === 'leave') return // rien à déplacer / congé non déplaçable
    setCell(dstEmpId, dstDi, moving.type)    // pose ce type à la cible
    removeCell(srcEmpId, srcDi, moving.type) // retire ce type de la source
  }

  // Export CSV de la plage affichée (semaine = 7 jours ; mois = jours du mois). Lit shiftsByDate
  // par date → fonctionne pour les deux vues, multi-shift joint par ' + '.
  const exportCSVPlan = () => {
    const locale = localeFor(lang)
    const T = buildT(lang)
    const days = view === 'month' ? monthGridDays.filter(d => d.getMonth() === monthAnchor.getMonth()) : weekDays
    const rows = [
      [T.employee, ...days.map(d=> d.toLocaleDateString(locale, {weekday:'short',day:'numeric',month:'short'}))],
      ...filtered.map(emp=>[
        emp.name,
        ...days.map(d=>(shiftsByDate[cellKey(emp.id, ymd(d))] ?? []).map(s => `${shiftLabel(s.type, lang)} ${SHIFT_TYPES[s.type].hours}`.trim()).join(' + '))
      ])
    ]
    const csv = '﻿' + rows.map(r=>r.join(';')).join('\r\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`Planning_${ymd(days[0])}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success(lang === 'en' ? '📊 Schedule exported!' : lang === 'es' ? '📊 ¡Planificación exportada!' : lang === 'it' ? '📊 Pianificazione esportata!' : '📊 Planning exporté !')
  }

  // Résumé de la semaine affichée (dérivé de la vue di).
  const weekStats = useMemo(() => {
    const counts: Record<string,number> = {}
    Object.values(shifts).forEach(days => Object.values(days).forEach(arr => arr.forEach(s => { counts[s.type] = (counts[s.type]??0)+1 })))
    return counts
  }, [shifts])
  // Résumé du mois affiché (dates IN-month, hors débordement) à partir de shiftsByDate.
  const monthStats = useMemo(() => {
    const inMonth = new Set(monthGridDays.filter(d => d.getMonth() === monthAnchor.getMonth()).map(ymd))
    const counts: Record<string,number> = {}
    for (const [key, arr] of Object.entries(shiftsByDate)) {
      const date = key.slice(key.lastIndexOf('_') + 1)
      if (!inMonth.has(date)) continue
      arr.forEach(s => { counts[s.type] = (counts[s.type]??0)+1 })
    }
    return counts
  }, [shiftsByDate, monthGridDays, monthAnchor])
  const stats = view === 'month' ? monthStats : weekStats

  // Phase 7 — copie la semaine affichée vers la suivante (mêmes shifts à J+7). Ignore les
  // congés ('leave', pilotés par les demandes) et ne remplace pas un congé approuvé cible.
  const copyWeekToNext = async () => {
    const dateToIndex: Record<string, number> = {}
    weekDays.forEach((d, i) => { dateToIndex[ymd(d)] = i })
    const targetDates = weekDays.map(d => { const t = new Date(d); t.setDate(t.getDate() + 7); return ymd(t) })
    const toCopy: { empId: string; date: string; type: ShiftType }[] = []
    for (const [key, arr] of Object.entries(shiftsByDate)) {
      const i = key.lastIndexOf('_'); const empId = key.slice(0, i); const date = key.slice(i + 1)
      const di = dateToIndex[date]
      if (di === undefined) continue // hors semaine affichée → ignoré
      const targetDate = targetDates[di]
      if (lockedDates.has(cellKey(empId, targetDate))) continue // ne pas écraser un congé approuvé cible
      for (const s of arr) { if (s.type === 'leave') continue; toCopy.push({ empId, date: targetDate, type: s.type }) } // copie TOUS les types de la case
    }
    if (toCopy.length === 0) {
      toast(lang === 'en' ? 'No shift to copy this week' : lang === 'es' ? 'Ningún turno que copiar esta semana' : lang === 'it' ? 'Nessun turno da copiare questa settimana' : 'Aucun shift à copier cette semaine')
      return
    }
    try {
      const created = await Promise.all(toCopy.map(c => shiftsApi.upsert({ employeeId: c.empId, date: c.date, shiftTypeKey: c.type })))
      setShiftsByDate(prev => {
        const next = { ...prev }
        created.forEach((r, idx) => {
          const k = cellKey(toCopy[idx].empId, toCopy[idx].date); const t = toCopy[idx].type
          const arr = next[k] ?? []
          next[k] = arr.some(s => s.type === t)
            ? arr.map(s => s.type === t ? { type: t, id: String(r.id) } : s)
            : [...arr, { type: t, id: String(r.id) }]
        })
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
      <PlanningHeader lang={lang} view={view} setView={setView} weekDays={weekDays} monthAnchor={monthAnchor} planningWeek={planningWeek} setPlanningWeek={setPlanningWeek} onExport={exportCSVPlan} onCopyWeek={copyWeekToNext} />

      {/* Le sélecteur de type ne sert qu'à l'assignation au clic (vue semaine). */}
      {view === 'week' && <ShiftSelector lang={lang} activeShift={activeShift} setActiveShift={setActiveShift} />}

      <PlanningFilters lang={lang} filterDept={filterDept} setFilterDept={setFilterDept} filterStatus={filterStatus} setFilterStatus={setFilterStatus} depts={depts} />

      {view === 'month' ? (
        <PlanningMonth
          lang={lang}
          loading={loading}
          monthGridDays={monthGridDays}
          monthAnchor={monthAnchor}
          shiftsByDate={shiftsByDate}
          filtered={filtered}
          lockedDates={lockedDates}
          onPickDay={(d) => { setPlanningWeek(d); setView('week') }}  // drill : ouvre la semaine du jour cliqué
        />
      ) : (
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
      )}

      {shiftModal && (
        <AssignShiftModal lang={lang} shiftModal={shiftModal} modalShift={modalShift} setModalShift={setModalShift} weekDays={weekDays} onConfirm={confirmShift} onClose={() => setShiftModal(null)} />
      )}

      <PlanningStats lang={lang} stats={stats} />
    </div>
  )
}
