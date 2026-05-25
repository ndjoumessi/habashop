import { Users, DollarSign, Umbrella, TrendingUp } from 'lucide-react'

interface HRStatsBarProps {
  employees:    any[]
  activeCount:  number
  totalPayroll: number
  pendingLeaves: number
  fmt:          (n: number) => string
  lang:         string
}

/** Barre de KPIs RH (effectif, masse salariale, congés, performance). Extrait de HR.tsx. */
export default function HRStatsBar({ employees, activeCount, totalPayroll, pendingLeaves, fmt, lang }: HRStatsBarProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
      {[
        { icon: <Users size={18}/>,      label: lang==='fr'?'Effectif total':'Total staff',      value: `${employees.length}`,    color: 'var(--p)', sub: `${activeCount} ${lang==='fr'?'actifs':'active'}` },
        { icon: <DollarSign size={18}/>, label: lang==='fr'?'Masse salariale':'Payroll',          value: fmt(totalPayroll),         color: 'var(--acc2)', sub: lang==='fr'?'Ce mois':'This month' },
        { icon: <Umbrella size={18}/>,   label: lang==='fr'?'Congés en attente':'Pending leaves', value: `${pendingLeaves}`,        color: pendingLeaves > 0 ? '#F0A500' : 'var(--acc2)', sub: lang==='fr'?'à traiter':'to review' },
        { icon: <TrendingUp size={18}/>, label: lang==='fr'?'Performance moy.':'Avg performance', value: `${((employees ?? []).filter(e => e.perf).reduce((s, e) => s + (e.perf ?? 0), 0) / ((employees ?? []).filter(e => e.perf).length || 1)).toFixed(1)}/5`, color: 'var(--acc)', sub: lang==='fr'?'Top équipe':'Top team' },
      ].map(k => (
        <div key={k.label} className="panel" style={{ padding: '14px 16px', background: `linear-gradient(135deg,${k.color}18,${k.color}06)`, border: `1px solid ${k.color}28` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)' }}>{k.label}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{k.sub}</div>
        </div>
      ))}
    </div>
  )
}
