import { TrendingUp, TrendingDown } from 'lucide-react'

export type Period = 'today' | '7days' | '30days' | '3months' | 'year'

export const RADIAN = Math.PI / 180

export function Trend({ evol }: { evol: number }) {
  const up = evol >= 0
  return (
    <div className={up ? 'trend-up' : 'trend-down'}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{evol} %
    </div>
  )
}
