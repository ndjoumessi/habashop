import { Info } from 'lucide-react'
import { deptLabel } from '@/components/hr/hrShared'
import { SHIFT_TYPES, shiftLabel, buildT } from './planningShared'
import type { ShiftType } from './planningShared'

interface Props {
  lang: string
  filterDept: string
  setFilterDept: (v: string) => void
  filterStatus: ShiftType | 'all'
  setFilterStatus: (v: ShiftType | 'all') => void
  depts: string[]
}

export default function PlanningFilters({ lang, filterDept, setFilterDept, filterStatus, setFilterStatus, depts }: Props) {
  const T = buildT(lang)

  return (
    <div style={{
      display:'flex', gap:8, flexWrap:'wrap',
      alignItems:'center',
    }}>
      <select className="input"
        style={{width:'auto',minWidth:180,height:36,fontSize:12}}
        value={filterDept}
        onChange={e=>setFilterDept(e.target.value)}>
        <option value="all">{T.allDepts}</option>
        {depts.map(d=><option key={d} value={d}>{deptLabel(d, lang)}</option>)}
      </select>
      <select className="input"
        style={{width:'auto',minWidth:180,height:36,fontSize:12}}
        value={filterStatus}
        onChange={e=>setFilterStatus(e.target.value as any)}>
        <option value="all">{T.allStatus}</option>
        {(Object.entries(SHIFT_TYPES) as [ShiftType,any][]).map(([k])=>(
          <option key={k} value={k}>{shiftLabel(k, lang)}</option>
        ))}
      </select>
      <div style={{
        marginLeft:'auto', fontSize:10,
        color:'var(--text3)', fontStyle:'italic',
      }}>
        <Info size={11}/> {T.assignTip} · {T.clearTip}
      </div>
    </div>
  )
}
