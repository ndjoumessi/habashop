import { Download, CopyPlus } from 'lucide-react'
import { buildT, localeFor } from './planningShared'

type View = 'week' | 'month'

interface Props {
  lang: string
  view: View
  setView: (v: View) => void
  weekDays: Date[]
  monthAnchor: Date           // date dans le mois affiché (sous-titre vue mois)
  planningWeek: Date
  setPlanningWeek: (d: Date) => void
  onExport: () => void
  onCopyWeek: () => void
}

export default function PlanningHeader({ lang, view, setView, weekDays, monthAnchor, planningWeek, setPlanningWeek, onExport, onCopyWeek }: Props) {
  const T = buildT(lang)
  const locale = localeFor(lang)
  const copyLabel = lang === 'en' ? 'Copy → next' : lang === 'es' ? 'Copiar → sig.' : lang === 'it' ? 'Copia → succ.' : 'Copier → suiv.'

  // Navigation adaptée à la vue : ±7 jours en semaine, ±1 mois en mois.
  const shift = (dir: -1 | 1) => {
    const d = new Date(planningWeek)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + dir * 7)
    setPlanningWeek(d)
  }

  const subtitle = view === 'month'
    ? monthAnchor.toLocaleDateString(locale, { month:'long', year:'numeric' })
    : `${weekDays[0].toLocaleDateString(locale, {day:'numeric',month:'long'})} — ${weekDays[6].toLocaleDateString(locale, {day:'numeric',month:'long',year:'numeric'})}`

  const segBtn = (v: View, label: string): React.CSSProperties => ({
    border:'none', cursor:'pointer', fontSize:12, fontWeight:'var(--fw-semibold)', padding:'6px 14px',
    borderRadius:8, transition:'all .12s',
    background: view===v ? 'var(--p)' : 'transparent',
    color: view===v ? '#fff' : 'var(--text3)',
    boxShadow: view===v ? 'var(--sh-xs)' : 'none',
  })

  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{T.title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        {/* Bascule Semaine / Mois */}
        <div style={{ display:'flex', gap:2, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:10, padding:3 }}>
          <button aria-pressed={view==='week'} style={segBtn('week', T.week)} onClick={()=>setView('week')}>{T.week}</button>
          <button aria-pressed={view==='month'} style={segBtn('month', T.month)} onClick={()=>setView('month')}>{T.month}</button>
        </div>
        <button className="mini-btn" onClick={()=>shift(-1)}>← {T.prev}</button>
        <button className="mini-btn" onClick={()=>setPlanningWeek(new Date())}>{T.today}</button>
        <button className="mini-btn" onClick={()=>shift(1)}>{T.next} →</button>
        {view === 'week' && (
          <button className="mini-btn" onClick={onCopyWeek} title={copyLabel} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <CopyPlus size={12}/> {copyLabel}
          </button>
        )}
        <button className="mini-btn" onClick={onExport} style={{ display:'flex', alignItems:'center', gap:4 }}>
          <Download size={12}/> {T.export}
        </button>
      </div>
    </div>
  )
}
