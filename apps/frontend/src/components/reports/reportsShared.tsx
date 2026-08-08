import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * ⚠️ SOURCE UNIQUE — le domaine des périodes vit dans `lib/dateRange.ts`, aux côtés des
 * BORNES qui en dérivent (`presetRange`). Le redéclarer ici avait un coût concret : le
 * jour où un raccourci s'ajoute, le type et les bornes divergent en silence, et le
 * `Record<Period, …>` qui devait rougir reste complet sur l'ancien domaine.
 */
export type { Period } from '@/lib/dateRange'

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
