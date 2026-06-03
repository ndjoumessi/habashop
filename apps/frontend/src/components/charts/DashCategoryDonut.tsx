import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: any[]
  colors: string[]
  label: any
  tooltip: React.ReactElement
}

// Donut « CA par catégorie » du Dashboard — isolé dans le chunk `charts`,
// chargé à la demande via React.lazy.
export default function DashCategoryDonut({ data, colors, label, tooltip }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data} cx="50%" cy="50%"
          innerRadius={68} outerRadius={108}
          stroke="none" paddingAngle={2}
          dataKey="value"
          label={label} labelLine={false}
        >
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip content={tooltip} wrapperStyle={{ zIndex: 9999, pointerEvents: 'none' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
