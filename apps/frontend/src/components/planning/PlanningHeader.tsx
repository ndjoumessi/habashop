import { Download } from 'lucide-react'
import { buildT, localeFor } from './planningShared'

interface Props {
  lang: string
  weekDays: Date[]
  planningWeek: Date
  setPlanningWeek: (d: Date) => void
  onExport: () => void
}

export default function PlanningHeader({ lang, weekDays, planningWeek, setPlanningWeek, onExport }: Props) {
  const T = buildT(lang)
  const locale = localeFor(lang)

  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{T.title}</h1>
        <p className="page-subtitle">
          {weekDays[0].toLocaleDateString(locale, {day:'numeric',month:'long'})}
          {' — '}
          {weekDays[6].toLocaleDateString(locale, {day:'numeric',month:'long',year:'numeric'})}
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
        <button className="mini-btn" onClick={onExport} style={{ display:'flex', alignItems:'center', gap:4 }}>
          <Download size={12}/> {T.export}
        </button>
      </div>
    </div>
  )
}
