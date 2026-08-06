import { Users, DollarSign, Umbrella, TrendingUp } from 'lucide-react'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { summarizeRatings, ratingValue, ratingCaption } from '@/lib/ratingSummary'

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
  const perfSummary = summarizeRatings((employees ?? []).map(e => e?.perf))
  return (
    <ResponsiveGrid min={180} gap={12}>
      {[
        // `color` = HEX LITTÉRAL : concaténé avec une alpha (`${k.color}28`/`18`/`06`/`22`) pour
        // bord + dégradé + fond d'icône. Un `var(--x)` s'y casserait en silence (bord none, dégradé
        // absent — invisible à tsc/tests). Usage direct (`color:k.color`) reste valide avec un hex.
        { icon: <Users size={18}/>,      label: lang === 'en' ? 'Total staff' : lang === 'es' ? 'Plantilla total' : lang === 'it' ? 'Organico totale' : 'Effectif total',      value: `${employees.length}`,    color: '#6C47FF', sub: `${activeCount} ${lang === 'en' ? 'active' : lang === 'es' ? 'activos' : lang === 'it' ? 'attivi' : 'actifs'}` },
        { icon: <DollarSign size={18}/>, label: lang === 'en' ? 'Payroll' : lang === 'es' ? 'Masa salarial' : lang === 'it' ? 'Costo del personale' : 'Masse salariale',          value: fmt(totalPayroll),         color: '#22C77A', sub: lang === 'en' ? 'This month' : lang === 'es' ? 'Este mes' : lang === 'it' ? 'Questo mese' : 'Ce mois' },
        { icon: <Umbrella size={18}/>,   label: lang === 'en' ? 'Pending leaves' : lang === 'es' ? 'Permisos pendientes' : lang === 'it' ? 'Ferie in attesa' : 'Congés en attente', value: `${pendingLeaves}`,        color: pendingLeaves > 0 ? '#F0A500' : '#22C77A', sub: lang === 'en' ? 'to review' : lang === 'es' ? 'por procesar' : lang === 'it' ? 'da elaborare' : 'à traiter' },
        // ⚠️ PERFORMANCE — la moyenne ne se rend JAMAIS sans son effectif évalué.
        // Avant : `.filter(e => e.perf)` n'écartait que `0`, valeur impossible (les notes
        // vont de 1 à 5) — donc il n'écartait rien, et `/(n||1)` rendait « 0,0/5 » sur une
        // liste vide. Le sous-titre était « Top équipe », une félicitation constante.
        { icon: <TrendingUp size={18}/>, label: lang === 'en' ? 'Avg performance' : lang === 'es' ? 'Rendimiento medio' : lang === 'it' ? 'Performance media' : 'Performance moy.',
          value: ratingValue(perfSummary), color: '#FFB020', sub: ratingCaption(perfSummary, lang, 'employes') },
      ].map(k => (
        <div key={k.label} className="panel" style={{ padding: '14px 16px', background: `linear-gradient(135deg,${k.color}18,${k.color}06)`, border: `1px solid ${k.color}28` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>{k.icon}</div>
            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)' }}>{k.label}</span>
          </div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: k.color, lineHeight: 1, fontFamily: 'var(--mono)', letterSpacing: '-0.5px' }}>{k.value}</div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)', marginTop: 4 }}>{k.sub}</div>
        </div>
      ))}
    </ResponsiveGrid>
  )
}
