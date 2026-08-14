import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TYPE_CFG, TYPE_CFG_MAP, getMapCfg } from '@/components/customers/customersShared'

/**
 * LOT 2 — UNE SEULE COULEUR PAR PALIER CLIENT, ET ELLE DOIT POUVOIR S'AFFICHER.
 *
 * ── Défaut 1 : la classe et la couleur désignaient deux familles ───────────────────────
 * `Semi-gros` portait `badge-blue` avec la couleur `#F59E0B` (AMBRE) ; `Détail` portait
 * `badge-gray` avec `#3B82F6` (BLEU). Sur la page Clients, `CustomersList` peint la pastille
 * via `cls` et `CustomersStats` peint le chiffre via `color` — l'un au-dessus de l'autre.
 * Le même palier apparaissait donc en deux couleurs sur le même écran.
 *
 * ── Défaut 2, plus grave : la couleur ne s'affichait pas du tout ────────────────────────
 * `TYPE_CFG_MAP.color` valait `'var(--p)'`. MESURÉ dans un vrai moteur le 2026-08-15 :
 *   · injectée dans le SVG data-URI de `createMarkerIcon`, elle rend un pixel
 *     rgba(0,0,0,249) — NOIR (témoin `#6C47FF` → rgba(108,71,255,249)). Le SVG chargé comme
 *     image est un document isolé : la variable CSS de la page n'y existe pas. TOUS les
 *     marqueurs de la carte Clients étaient noirs — le code couleur ne codait rien.
 *   · concaténée (`${cfg.color}44`), elle rend `border: 0px none` et `background-image: none`.
 *
 * ⚠️ POURQUOI CE FICHIER ET PAS UN SCANNEUR. `noVarInConcatenatedColor.test.ts` ne suit que
 * les objets littéraux parcourus par `.map` dans le MÊME fichier, et il DÉCLARE sa limite :
 * « un objet importé d'un autre module passe AU TRAVERS ». La limite était écrite, connue,
 * et sans conséquence supposée — c'est exactement par là que le défaut est passé. La parade
 * principale n'est donc pas ce test mais le type `CouleurTier` (`` `#${string}` ``), qui rend
 * l'erreur INEXPRIMABLE : `tsc` refuse `'var(--p)'` (TS2322, vérifié par sabotage).
 * Ce fichier garde ce que le type ne peut pas dire : l'ACCORD entre les surfaces.
 */

const SRC = join(__dirname, '..')

/** Famille de couleur d'un `#hex`, par la teinte dominante — jamais par un nom recopié. */
function famille(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max - min < 30) return 'gris'
  if (r === max && g > b) return g > r * 0.6 ? 'amber' : 'red'
  if (r === max) return b > r * 0.6 ? 'violet' : 'red'
  if (g === max) return 'green'
  return b > r * 1.3 && r > b * 0.45 ? 'violet' : 'blue'
}

describe('couleur de palier — la classe et la valeur désignent la même famille', () => {
  it('CONTRÔLE POSITIF — le classificateur sait distinguer les familles', () => {
    // Sans ce cas, une fonction qui rendrait toujours la même chaîne ferait passer tout le
    // reste : chaque paire « concorderait » en ne comparant rien.
    expect(famille('#10B981')).toBe('green')
    expect(famille('#3B82F6')).toBe('blue')
    expect(famille('#F59E0B')).toBe('amber')
    expect(famille('#7C6FF0')).toBe('violet')
    expect(famille('#888888')).toBe('gris')
  })

  it('chaque palier : `cls` et `color` désignent la même famille', () => {
    const desaccords = Object.entries(TYPE_CFG)
      .map(([tier, cfg]) => ({ tier, cls: cfg.cls.replace('badge-', ''), vue: famille(cfg.color) }))
      .filter(x => x.cls !== x.vue)
    expect(desaccords).toEqual([])
  })

  it('COUVERTURE — les quatre paliers sont bien jugés', () => {
    // Une table vidée ou renommée rendrait « 0 désaccord » : vérité vacante.
    expect(Object.keys(TYPE_CFG).sort()).toEqual(['Détail', 'Fidèle', 'Grossiste', 'Semi-gros'])
  })
})

describe('couleur de palier — SOURCE UNIQUE, la carte ne réécrit rien', () => {
  it('TYPE_CFG_MAP lit sa couleur dans TYPE_CFG', () => {
    for (const tier of Object.keys(TYPE_CFG) as (keyof typeof TYPE_CFG)[]) {
      expect({ tier, c: TYPE_CFG_MAP[tier].color }).toEqual({ tier, c: TYPE_CFG[tier].color })
    }
  })

  it('⚠️ toute couleur de palier est un #hex LITTÉRAL — un var() y est mort', () => {
    // Le type l'impose déjà ; ce cas garde le jour où quelqu'un élargirait le type ou
    // passerait par un `as`. Un `as` vers une union éteint la seule parade automatique.
    const fautifs: string[] = []
    for (const [tier, cfg] of Object.entries(TYPE_CFG)) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(cfg.color)) fautifs.push(`TYPE_CFG.${tier} = ${cfg.color}`)
    }
    for (const [tier, cfg] of Object.entries(TYPE_CFG_MAP)) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(cfg.color)) fautifs.push(`TYPE_CFG_MAP.${tier} = ${cfg.color}`)
    }
    expect(fautifs).toEqual([])
  })

  it('le repli de getMapCfg rend une couleur affichable, pas `undefined`', () => {
    // `getMapCfg` retombe sur `Détail` pour un type inconnu. Un repli qui rendrait undefined
    // ferait produire `fill="undefined"` au SVG — noir, comme le var().
    expect(getMapCfg('Palier Inconnu').color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

// ── Le CSS mort ne doit pas revenir ───────────────────────────────────────────────────
function fichiersSrc(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'tests') fichiersSrc(p, acc) }
    else if (e.endsWith('.tsx') || e.endsWith('.ts')) acc.push(p)
  }
  return acc
}

describe('règles CSS supprimées — elles étaient MORTES, elles le restent', () => {
  const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')
  const FICHIERS = fichiersSrc(SRC)

  it('COUVERTURE — le balayage lit bien src/', () => {
    expect(FICHIERS.length).toBeGreaterThan(150)
  })

  it('`.stat-chip`, `.tabs-bar`, `.tab-btn` et `.btn-success` ne sont ni définies ni rendues', () => {
    // ⚠️ Les DEUX sens comptent. Réintroduire la règle sans consommateur reconstitue du CSS
    // mort ; réintroduire un consommateur sans la règle rend un élément sans style — et
    // `verify:classes`, qui inspecte le dist/, échouerait sur ce second cas seulement.
    for (const c of ['stat-chip', 'tabs-bar', 'tab-btn', 'btn-success']) {
      const dansCss = new RegExp(`\\.${c}[\\s,.:{]`).test(CSS)
      const rendu = FICHIERS.filter(f => readFileSync(f, 'utf8').includes(c))
      expect({ c, dansCss, rendu: rendu.map(f => f.replace(SRC, 'src')) })
        .toEqual({ c, dansCss: false, rendu: [] })
    }
  })

  it('DISCRIMINANT — `.tabs-scroll`, elle, est VIVANTE et conservée', () => {
    // Sans ce cas, supprimer tout le bloc des onglets passerait le test précédent, et le
    // défilement horizontal des onglets sous 768px disparaîtrait en silence.
    expect(/\.tabs-scroll[\s,.:{]/.test(CSS)).toBe(true)
    expect(FICHIERS.some(f => readFileSync(f, 'utf8').includes('tabs-scroll'))).toBe(true)
  })
})
