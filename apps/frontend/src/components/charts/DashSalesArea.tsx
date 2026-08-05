import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useThemeColor } from '@/hooks/useThemeColor'

interface Props {
  data: any[]
  abbr: (n: number) => string
  tooltip: React.ReactElement
  /** Graduations explicites (timestamps ms) — la série peut porter ~90 points à 3 mois. */
  ticks?: number[]
  /** Rendu d'une graduation : `ts` → libellé (nom de jour à 7 j, date au-delà). */
  tickFormatter?: (ts: number) => string
}

// Aire « ventes » du Dashboard — isolée dans le chunk `charts` (recharts),
// chargée à la demande via React.lazy pour ne pas bloquer le rendu des KPIs.
export default function DashSalesArea({ data, abbr, tooltip, ticks, tickFormatter }: Props) {
  // var() non résolu en attribut SVG → couleurs résolues en JS, réactives au thème.
  const gridColor = useThemeColor('--border')
  const tickColor = useThemeColor('--text3', '#888')
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D084" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00D084" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        {/* ⚠️ Axe TEMPOREL (`type=number` + `scale=time` sur `ts`), pas catégoriel. En
            catégoriel, recharts espace les points uniformément : onze jours creux occupaient
            la même largeur qu'un seul et la pente mentait. L'abscisse est désormais la durée
            réelle — un trou reste un trou même si un jour manquait à la série. */}
        <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']}
          ticks={ticks} tickFormatter={tickFormatter}
          tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false}
          tickFormatter={v => abbr(v)} />
        <Tooltip content={tooltip} cursor={{ fill: 'rgba(108,71,255,.06)', stroke: 'rgba(108,71,255,.18)', strokeWidth: 1 }} />
        <Area dataKey="ventes" stroke="#00D084" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
