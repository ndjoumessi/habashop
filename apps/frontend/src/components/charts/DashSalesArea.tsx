import { Aire } from './primitives'
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

/**
 * Aire « ventes » du Dashboard — chunk `charts`, chargée à la demande.
 *
 * ⚠️ Migrée de recharts vers visx le 2026-08-15. L'AXE RESTE TEMPOREL : `ts` est numérique,
 * donc l'abscisse est la durée RÉELLE. En catégoriel, onze jours creux occuperaient la même
 * largeur qu'un seul et la pente mentirait — c'est un défaut déjà corrigé une fois, et la
 * migration ne devait pas le rouvrir. Le contrat de `tooltip` est inchangé.
 */
export default function DashSalesArea({ data, abbr, tooltip, ticks, tickFormatter }: Props) {
  // var() non résolu en attribut SVG → couleurs résolues en JS, réactives au thème.
  const gridColor = useThemeColor('--border')
  const tickColor = useThemeColor('--text3', '#888')
  return (
    <Aire data={data} xKey="ts" yKey="ventes" hauteur={190}
      couleur="#00D084" degradeId="areaGrad" abbr={abbr}
      ticks={ticks} tickFormatter={tickFormatter} tooltip={tooltip}
      gridColor={gridColor} tickColor={tickColor} />
  )
}
