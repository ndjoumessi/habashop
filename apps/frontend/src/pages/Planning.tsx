import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/stores/appStore'
import { employeesApi } from '@/lib/api'
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

export default function Planning() {
  const { lang } = useAppStore()
  const [employees, setEmployees] = useState<PlanningEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeShift, setActiveShift] = useState<ShiftType>('full')
  const [shifts, setShifts] = useState<Record<string,Record<number,ShiftType>>>(() => {
    try { return JSON.parse(localStorage.getItem('habashop_shifts') ?? 'null') ?? {} } catch { return {} }
  })
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState<ShiftType|'all'>('all')
  const [planningWeek, setPlanningWeek] = useState(new Date())
  const [shiftModal, setShiftModal] = useState<{empId:string; di:number; name:string} | null>(null)
  const [modalShift, setModalShift] = useState<ShiftType>('full')

  useEffect(() => {
    employeesApi.list().then((data:any[]) => {
      if (data?.length > 0) setEmployees(data.map((e:any) => ({
        id: e.id, name: e.name??'', role: e.role??'',
        dept: e.dept??'', avatar: (e.name??'??').split(' ')
          .map((n:string)=>n[0]??'').join('').slice(0,2).toUpperCase(),
        color: e.color??'#6C47FF', isActive: e.isActive!==false,
      })))
    }).catch(()=>{}).finally(()=>setLoading(false))
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
    const locale = localeFor(lang)
    const T = buildT(lang)
    const rows = [
      [T.employee, ...weekDays.map(d=>
        d.toLocaleDateString(locale, {weekday:'short',day:'numeric',month:'short'})
      )],
      ...filtered.map(emp=>[
        emp.name,
        ...weekDays.map((_,di)=>{
          const s = shifts[emp.id]?.[di]
          return s ? `${shiftLabel(s, lang)} ${SHIFT_TYPES[s].hours}` : ''
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
    toast.success(lang === 'en' ? '📊 Schedule exported!' : lang === 'es' ? '📊 ¡Planificación exportada!' : lang === 'it' ? '📊 Pianificazione esportata!' : '📊 Planning exporté !')
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

  const confirmShift = () => {
    if (!shiftModal) return
    setShifts(prev => ({
      ...prev,
      [shiftModal.empId]: { ...(prev[shiftModal.empId]??{}), [shiftModal.di]: modalShift }
    }))
    toast.success(`${shiftLabel(modalShift, lang)} ${lang === 'en' ? 'assigned → ' : lang === 'es' ? 'asignado a ' : lang === 'it' ? 'assegnato a ' : 'assigné à '}${shiftModal.name}`)
    setShiftModal(null)
  }

  return (
    <div className="animate-in" style={{
      display:'flex', flexDirection:'column', gap:16,
    }}>
      <PlanningHeader
        lang={lang}
        weekDays={weekDays}
        planningWeek={planningWeek}
        setPlanningWeek={setPlanningWeek}
        onExport={exportCSVPlan}
      />

      <ShiftSelector lang={lang} activeShift={activeShift} setActiveShift={setActiveShift} />

      <PlanningFilters
        lang={lang}
        filterDept={filterDept} setFilterDept={setFilterDept}
        filterStatus={filterStatus} setFilterStatus={setFilterStatus}
        depts={depts}
      />

      <PlanningGrid
        lang={lang}
        loading={loading}
        filtered={filtered}
        weekDays={weekDays}
        shifts={shifts}
        activeShift={activeShift}
        onAssign={assignShift}
        onOpenModal={(empId, di, name) => { setModalShift(activeShift); setShiftModal({ empId, di, name }) }}
        onClearShift={clearShift}
      />

      {shiftModal && (
        <AssignShiftModal
          lang={lang}
          shiftModal={shiftModal}
          modalShift={modalShift}
          setModalShift={setModalShift}
          weekDays={weekDays}
          onConfirm={confirmShift}
          onClose={() => setShiftModal(null)}
        />
      )}

      <PlanningStats lang={lang} stats={stats} />
    </div>
  )
}
