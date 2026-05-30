import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  data: any[]
  abbr: (n: number) => string
  tooltip: React.ReactElement
}

// Aire « ventes » du Dashboard — isolée dans le chunk `charts` (recharts),
// chargée à la demande via React.lazy pour ne pas bloquer le rendu des KPIs.
export default function DashSalesArea({ data, abbr, tooltip }: Props) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00D084" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00D084" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false}
          tickFormatter={v => abbr(v)} />
        <Tooltip content={tooltip} cursor={{ fill: 'rgba(108,71,255,.06)', stroke: 'rgba(108,71,255,.18)', strokeWidth: 1 }} />
        <Area dataKey="ventes" stroke="#00D084" strokeWidth={2.5} fill="url(#areaGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
