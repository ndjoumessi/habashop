import { Anneau, type EtiquetteAnneau } from './primitives'

interface Props {
  data: any[]
  colors: string[]
  label: EtiquetteAnneau
  tooltip: React.ReactElement
}

/**
 * Donut « CA par catégorie » du Dashboard — chunk `charts`, chargé à la demande.
 *
 * ⚠️ Migré de recharts vers visx le 2026-08-15 (107 808 → voir le commit). Les CONTRATS
 * sont inchangés : `label` reçoit toujours `{cx,cy,midAngle,innerRadius,outerRadius,index}`
 * et `tooltip` toujours `{active,payload}` — `makeDonutLabel` et `CatTooltip` n'ont pas
 * bougé d'une ligne. On change la plomberie, pas les formules d'affichage.
 */
export default function DashCategoryDonut({ data, colors, label, tooltip }: Props) {
  return (
    <Anneau data={data} colors={colors} hauteur={220}
      innerRadius={68} outerRadius={108} dataKey="value"
      label={label} tooltip={tooltip} />
  )
}
