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
          // cards stats sur surface neutre (bg2 + border fine) — la couleur reste portée par l'icône et le compteur
          <div key={key} style={{
            background:'var(--bg2)',
            border:'1px solid var(--border2)',
            borderRadius:12, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:8,
          }}>
            <span style={{ color:s.color, display:'flex', fontSize:'var(--fs-xl)' }}>{s.icon}</span>
            <div>
              <div style={{
                fontSize:'var(--fs-caption)',fontWeight:'var(--fw-semibold)',
                textTransform:'uppercase',
                color:'var(--text3)',
              }}>{shiftLabel(key, lang)}</div>
              <div style={{
                fontSize:'var(--fs-xl)',fontWeight:'var(--fw-bold)',
                color:s.color,fontFamily:'var(--mono)',
              }}>{count}</div>
            </div>
          </div>
        )
      }).filter(Boolean)}
    </ResponsiveGrid>
  )
}
