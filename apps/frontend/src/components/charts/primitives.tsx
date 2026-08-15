import { useState, useRef, useEffect, useCallback, type ReactElement, cloneElement } from 'react'
import { Pie, AreaClosed, LinePath } from '@visx/shape'
import { scaleLinear } from '@visx/scale'

/**
 * PRIMITIVES DE GRAPHIQUE — visx, en remplacement de recharts.
 *
 * ── Pourquoi ────────────────────────────────────────────────────────────────────────
 * MESURÉ le 2026-08-15 sur le `dist/` livré : le chunk `charts` pesait **107 808 o gz**
 * pour DEUX formes de graphique (un anneau, une aire) sur TROIS points d'appel. Le
 * plancher visx pour la même chose, React externalisé, a été mesuré à **28 404 o gz**.
 *
 * ── Le choix de conception qui compte ───────────────────────────────────────────────
 * ⚠️ **Les CONTRATS de recharts sont conservés à l'identique** : le renderer d'étiquettes
 * reçoit toujours `{cx, cy, midAngle, innerRadius, outerRadius, index}` (midAngle en
 * DEGRÉS, 0° à 3 h, sens trigonométrique) et l'infobulle toujours `{active, payload}` avec
 * `payload[0].payload` = la ligne de données. Résultat : `makeDonutLabel`, `CatTooltip`,
 * `CustomTooltip` et `CustomPayTooltip` ne changent pas d'une ligne.
 *
 * Ce sont des graphiques d'ARGENT. Une migration qui réécrit en même temps la plomberie
 * et les formules d'affichage rend toute régression indémêlable. On change UNE chose.
 *
 * ⚠️ CONVERSION D'ANGLE, la seule subtilité : visx compte en RADIANS depuis midi, sens
 * horaire ; recharts en DEGRÉS depuis 3 h, sens trigonométrique. Position visx d'un angle
 * `a` : `(cx + r·sin a, cy − r·cos a)`. Position recharts d'un angle `m` :
 * `(cx + r·cos m, cy − r·sin m)`. Il faut donc `sin a = cos m` et `cos a = sin m`, soit
 * **m = 90° − a**. Écrit ici plutôt que déduit à chaque lecture.
 */

/** Largeur observée d'un conteneur — remplace `ResponsiveContainer`. */
export function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [largeur, setLargeur] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // ⚠️ `ResizeObserver` est absent de jsdom : les tests le stubbent déjà (cf.
    // `paymentBreakdown.test.tsx`). On ne mesure alors rien, et c'est voulu — jsdom ne
    // fait aucune mise en page, la GÉOMÉTRIE se vérifie avec Playwright.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setLargeur(Math.round(e.contentRect.width)))
    ro.observe(el)
    setLargeur(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return { ref, largeur }
}

type LigneTooltip = { name: string; value: number; payload: Record<string, unknown>; color?: string }
/** Injecte le contrat recharts `{active, payload}` dans l'élément d'infobulle fourni. */
function rendreInfobulle(tooltip: ReactElement | undefined, lignes: LigneTooltip[] | null, label?: unknown) {
  if (!tooltip || !lignes?.length) return null
  return cloneElement(tooltip as ReactElement<Record<string, unknown>>, { active: true, payload: lignes, label })
}

/** Position flottante de l'infobulle, bornée au conteneur. */
function Flottant({ x, y, largeur, children }: { x: number; y: number; largeur: number; children: React.ReactNode }) {
  return (
    <div data-testid="chart-tooltip" style={{
      position: 'absolute', left: Math.min(Math.max(x + 12, 0), Math.max(largeur - 180, 0)), top: y + 12,
      zIndex: 9999, pointerEvents: 'none',
    }}>{children}</div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNEAU
// ─────────────────────────────────────────────────────────────────────────────
export type EtiquetteAnneau = (a: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; index: number
}) => React.ReactNode

export function Anneau({
  data, colors, innerRadius, outerRadius, hauteur, dataKey = 'value', padAngle = 0.02,
  label, tooltip, activeIndex, onActive, colorKey, centre, halo,
}: {
  data: Record<string, unknown>[]
  colors: string[]
  innerRadius: number
  outerRadius: number
  hauteur: number
  dataKey?: string
  padAngle?: number
  label?: EtiquetteAnneau
  tooltip?: ReactElement
  /** Secteur mis en avant (remplace `activeShape` de recharts). */
  activeIndex?: number | null
  onActive?: (i: number | null) => void
  /** Couleur portée par la LIGNE de données plutôt que par le tableau `colors`. */
  colorKey?: string
  /** Contenu SVG au centre, rendu quand un secteur est actif (ex-`activeShape`). */
  centre?: (i: number) => React.ReactNode
  /** Halo sur le secteur actif — `drop-shadow` de l'ancien `renderActiveShape`. */
  halo?: boolean
}) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  const [survol, setSurvol] = useState<{ i: number; x: number; y: number } | null>(null)
  const L = largeur || outerRadius * 2
  const cx = L / 2, cy = hauteur / 2

  const valeur = useCallback((d: Record<string, unknown>) => Number(d[dataKey]) || 0, [dataKey])
  const teinte = (i: number) =>
    (colorKey ? String(data[i]?.[colorKey] ?? '') : '') || colors[i % colors.length]
  const actifCourant = activeIndex ?? survol?.i ?? null

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: hauteur }} data-testid="chart-donut">
      <svg width={L} height={hauteur} role="presentation">
        <g transform={`translate(${cx},${cy})`}>
          <Pie data={data} pieValue={valeur} outerRadius={outerRadius} innerRadius={innerRadius}
            padAngle={padAngle} startAngle={0} endAngle={Math.PI * 2}>
            {pie => pie.arcs.map((arc, i) => {
              const actif = actifCourant === i
              // ⚠️ Estompe les AUTRES quand un secteur est actif — comportement de l'ancien
              // `Cell opacity`. Aucun secteur actif ⇒ tous à pleine opacité.
              const opacite = actifCourant === null || actif ? 1 : 0.35
              // ⚠️ Le secteur ACTIF grossit — équivalent d'`activeShape`/`Sector` de recharts.
              const chemin = pie.path.innerRadius(actif ? innerRadius - 4 : innerRadius)
                                     .outerRadius(actif ? outerRadius + 8 : outerRadius)(arc)
              return (
                <path key={i} d={chemin ?? undefined} data-testid="donut-sector"
                  fill={teinte(i)} stroke="none" opacity={opacite}
                  style={{ cursor: 'pointer', transition: 'opacity .2s',
                           filter: actif && halo ? `drop-shadow(0 0 12px ${teinte(i)}80)` : undefined }}
                  onMouseMove={e => setSurvol({ i, x: e.clientX - (ref.current?.getBoundingClientRect().left ?? 0), y: e.clientY - (ref.current?.getBoundingClientRect().top ?? 0) })}
                  onMouseLeave={() => { setSurvol(null); onActive?.(null) }}
                  onMouseEnter={() => onActive?.(i)} />
              )
            })}
          </Pie>
          {centre && actifCourant !== null && <g style={{ pointerEvents: 'none' }}>{centre(actifCourant)}</g>}
          {label && actifCourant === null && (
            <Pie data={data} pieValue={valeur} outerRadius={outerRadius} innerRadius={innerRadius} padAngle={padAngle}>
              {pie => pie.arcs.map((arc, i) => {
                // m = 90° − a  (cf. en-tête). `cx`/`cy` valent 0 : on est déjà dans le `translate`.
                const aDeg = ((arc.startAngle + arc.endAngle) / 2) * 180 / Math.PI
                const noeud = label({ cx: 0, cy: 0, midAngle: 90 - aDeg, innerRadius, outerRadius, index: i })
                return noeud ? <g key={i}>{noeud}</g> : null
              })}
            </Pie>
          )}
        </g>
      </svg>
      {survol && (
        <Flottant x={survol.x} y={survol.y} largeur={L}>
          {rendreInfobulle(tooltip, [{
            name: String(data[survol.i]?.name ?? ''), value: valeur(data[survol.i]),
            payload: data[survol.i], color: teinte(survol.i),
          }])}
        </Flottant>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AIRE
// ─────────────────────────────────────────────────────────────────────────────
export function Aire({
  data, xKey, yKey, hauteur, couleur, degradeId, abbr, ticks, tickFormatter,
  tooltip, gridColor, tickColor, margeGauche = 38,
}: {
  data: Record<string, unknown>[]
  /** Clé de l'abscisse. NUMÉRIQUE (timestamp) → axe temporel ; sinon catégoriel. */
  xKey: string
  yKey: string
  hauteur: number
  couleur: string
  degradeId: string
  abbr: (n: number) => string
  ticks?: number[]
  tickFormatter?: (v: number) => string
  tooltip?: ReactElement
  gridColor: string
  tickColor: string
  margeGauche?: number
}) {
  const { ref, largeur } = useLargeur<HTMLDivElement>()
  const [survol, setSurvol] = useState<{ i: number; x: number; y: number } | null>(null)
  const L = largeur || 320
  const M = { haut: 8, droite: 8, bas: 22, gauche: margeGauche }
  const l = Math.max(L - M.gauche - M.droite, 10)
  const h = Math.max(hauteur - M.haut - M.bas, 10)

  const xs = data.map(d => Number(d[xKey]))
  const ys = data.map(d => Number(d[yKey]) || 0)
  /**
   * ⚠️ AXE TEMPOREL, PAS CATÉGORIEL — invariant repris de recharts et load-bearing.
   * En catégoriel, les points sont espacés uniformément : onze jours creux occupaient la
   * même largeur qu'un seul et **la pente mentait**. L'abscisse est la durée RÉELLE, donc
   * un trou reste un trou. `xTemporel` est vrai dès que l'abscisse est numérique.
   */
  const xTemporel = xs.every(v => Number.isFinite(v))
  const xMin = xTemporel ? Math.min(...xs) : 0
  const xMax = xTemporel ? Math.max(...xs) : Math.max(data.length - 1, 1)
  const sx = scaleLinear({ domain: [xMin, xMax || 1], range: [0, l] })
  const sy = scaleLinear({ domain: [0, Math.max(...ys, 1)], range: [h, 0], nice: true })
  const px = (d: Record<string, unknown>, i: number) => sx(xTemporel ? Number(d[xKey]) : i)
  const py = (d: Record<string, unknown>) => sy(Number(d[yKey]) || 0)

  const graduationsY = sy.ticks(4)
  const graduationsX = ticks ?? (xTemporel ? sx.ticks(Math.min(data.length, 6)) : data.map((_, i) => i))

  const auSurvol = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.target as SVGRectElement).getBoundingClientRect()
    const xr = e.clientX - r.left
    let best = 0, dist = Infinity
    data.forEach((d, i) => { const dd = Math.abs(px(d, i) - xr); if (dd < dist) { dist = dd; best = i } })
    setSurvol({ i: best, x: xr + M.gauche, y: py(data[best]) })
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: hauteur }} data-testid="chart-area">
      <svg width={L} height={hauteur} role="presentation">
        <defs>
          <linearGradient id={degradeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={couleur} stopOpacity={0.35} />
            <stop offset="100%" stopColor={couleur} stopOpacity={0} />
          </linearGradient>
        </defs>
        <g transform={`translate(${M.gauche},${M.haut})`}>
          {graduationsY.map(t => (
            <g key={t}>
              <line x1={0} x2={l} y1={sy(t)} y2={sy(t)} stroke={gridColor} strokeDasharray="3 3" />
              <text x={-6} y={sy(t)} textAnchor="end" dominantBaseline="central"
                fontSize={11} fill={tickColor} data-testid="axe-y-tick">{abbr(t)}</text>
            </g>
          ))}
          {data.length > 1 && (
            <>
              <AreaClosed data={data} x={px} y={py} yScale={sy} fill={`url(#${degradeId})`} stroke="none" />
              <LinePath data={data} x={px} y={py} stroke={couleur} strokeWidth={2.5} fill="none" />
            </>
          )}
          {graduationsX.map((t, k) => (
            <text key={k} x={xTemporel ? sx(t) : sx(k)} y={h + 16} textAnchor="middle"
              fontSize={11} fill={tickColor} data-testid="axe-x-tick">
              {tickFormatter ? tickFormatter(t) : String(data[k]?.[xKey] ?? t)}
            </text>
          ))}
          {survol && (
            <line x1={px(data[survol.i], survol.i)} x2={px(data[survol.i], survol.i)} y1={0} y2={h}
              stroke="rgba(108,71,255,.35)" strokeWidth={1} />
          )}
          {survol && <circle cx={px(data[survol.i], survol.i)} cy={py(data[survol.i])} r={5} fill={couleur} />}
          <rect width={l} height={h} fill="transparent"
            onMouseMove={auSurvol} onMouseLeave={() => setSurvol(null)} />
        </g>
      </svg>
      {survol && (
        <Flottant x={survol.x} y={survol.y} largeur={L}>
          {rendreInfobulle(tooltip, [{
            name: yKey, value: Number(data[survol.i][yKey]) || 0, payload: data[survol.i],
          }], data[survol.i][xKey])}
        </Flottant>
      )}
    </div>
  )
}
