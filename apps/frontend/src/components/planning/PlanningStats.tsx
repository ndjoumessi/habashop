import { SHIFT_TYPES, shiftLabel } from './planningShared'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import type { ShiftType } from './planningShared'

interface Props {
  lang: string
  stats: Record<string, number>
}

export default function PlanningStats({ lang, stats }: Props) {
  if (Object.keys(stats).length === 0) return null
  return (
    <ResponsiveGrid min={130} gap={8}>
      {(Object.entries(SHIFT_TYPES) as [ShiftType,any][]).map(([key,s])=>{
        const count=stats[key]??0
        if (!count) return null
        return(
          <div key={key} style={{
            background:s.bg,
            border:`1px solid ${s.color}25`,
            borderRadius:12, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:8,
          }}>
            <span style={{ color:s.color, display:'flex', fontSize:20 }}>{s.icon}</span>
            <div>
              <div style={{
                fontSize:11,fontWeight:'var(--fw-semibold)',
                textTransform:'uppercase',
                color:'var(--text3)',
              }}>{shiftLabel(key, lang)}</div>
              <div style={{
                fontSize:20,fontWeight:'var(--fw-bold)',
                color:s.color,fontFamily:'var(--mono)',
              }}>{count}</div>
            </div>
          </div>
        )
      }).filter(Boolean)}
    </ResponsiveGrid>
  )
}
