import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * ⚠️ CONTRASTE DES PASTILLES TEINTÉES (#193) — ce que `contrast-aa.test.ts` ne pouvait PAS voir.
 *
 * Celui-ci ne teste que les paires de TEXTE LU (`text2/3/4` × `bg/bg2/bg3`) : des couleurs
 * OPAQUES sur des fonds OPAQUES. Les pastilles, elles, posent un texte coloré sur un fond
 * TRANSLUCIDE (`rgba(…, .1)`) qui se composite sur la surface en dessous. Aucune des deux
 * couleurs déclarées ne dit ce que l'œil reçoit — le garde regardait donc à côté, et les
 * 7 paires étaient sous AA en clair sans que rien ne rougisse.
 *
 * ⚠️ LE FOND COMPTE, ET IL EST UN DÉGRADÉ. Les pastilles vivent dans `.panel`, dont le fond
 * est `--grad-card` (un `linear-gradient`), pas `--card`. Mesuré sur `--card` (blanc uni),
 * on trouve 5 échecs ; sur la PIRE extrémité du dégradé réel, 7. Le fond supposé changeait
 * la réponse — d'où le calcul sur les deux extrémités et la rétention du pire cas.
 *
 * ⚠️ Ce test lit `index.css`, il ne recopie pas les valeurs : recopier ferait un test qui
 * valide sa propre copie et resterait vert pendant que la feuille de style dérive.
 */

const CSS = readFileSync(join(__dirname, '..', 'index.css'), 'utf-8')

const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
const rgbOf = (hex: string) => {
  const m = hex.replace('#', '')
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]
}
const lum = (hex: string) => { const [r, g, b] = rgbOf(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
const ratio = (a: string, b: string) => {
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
/** Fond translucide `rgba(r,g,b,a)` aplati sur une surface opaque. */
const composite = (tint: [number, number, number], alpha: number, bg: string) => {
  const b = rgbOf(bg)
  return '#' + tint.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}

/** Extrémités du `--grad-card` de chaque thème : la surface RÉELLE sous une pastille. */
const PANEL_STOPS = {
  dark:  ['#121724', '#161C2B'],  // index.css   :root  --grad-card
  light: ['#F7F5FF', '#EEEAFF'],  // appStore    LIGHT_EXTRA_VARS --grad-card
}

/** Fond teinté déclaré pour chaque pastille, lu dans la feuille de style. */
function tintOf(cls: string): [number, number, number] {
  const re = new RegExp(`\\.badge-${cls}[^{]*\\{[^}]*background:\\s*rgba\\((\\d+),(\\d+),(\\d+),\\s*\\.1\\)`)
  const m = CSS.match(re)
  if (!m) throw new Error(`fond teinté introuvable pour .badge-${cls}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Couleur de texte : la règle claire si elle existe, sinon la règle de base (sombre). */
function textOf(cls: string, theme: 'dark' | 'light'): string {
  if (theme === 'light') {
    const m = CSS.match(new RegExp(`\\[data-theme="light"\\][^{]*\\.badge-${cls}\\b[^{]*\\{[^}]*color:\\s*(#[0-9A-Fa-f]{6})`))
    if (m) return m[1]
  }
  const m = CSS.match(new RegExp(`\\.badge-${cls}[^{]*\\{[^}]*color:\\s*(#[0-9A-Fa-f]{6}|var\\(--[a-z0-9]+\\))`))
  if (!m) throw new Error(`couleur de texte introuvable pour .badge-${cls}`)
  return m[1].startsWith('#') ? m[1] : TOKENS[theme][m[1]] ?? (() => { throw new Error(`token non résolu : ${m[1]}`) })()
}

/** Tokens résolus par thème (index.css :root · appStore THEMES). */
const TOKENS: Record<'dark' | 'light', Record<string, string>> = {
  dark:  { 'var(--acc2)': '#22C77A', 'var(--danger)': '#FF5C72', 'var(--warn)': '#FFC53D', 'var(--acc3)': '#4F86F0', 'var(--p3)': '#A991FF', 'var(--text3)': '#8E96AA' },
  light: { 'var(--acc2)': '#059669', 'var(--danger)': '#FF5C72', 'var(--warn)': '#FFC53D', 'var(--acc3)': '#4F86F0', 'var(--p3)': '#6C47FF', 'var(--text3)': '#626976' },
}

const PILLS = ['green', 'red', 'amber', 'blue', 'violet', 'teal', 'gray']

describe('Contraste AA — pastilles teintées sur fond composité (#193)', () => {
  it('les 7 pastilles sont bien lues dans la feuille de style (garde anti-scan-vide)', () => {
    // Sans ceci, un sélecteur cassé ferait 0 itération : aucune assertion, donc VERT.
    expect(PILLS.map(tintOf)).toHaveLength(7)
  })

  for (const theme of ['dark', 'light'] as const) {
    for (const cls of PILLS) {
      it(`${theme} : .badge-${cls} ≥ 4.5:1 sur la PIRE extrémité du panneau`, () => {
        const tint = tintOf(cls)
        const text = textOf(cls, theme)
        const worst = Math.min(...PANEL_STOPS[theme].map(stop => ratio(text, composite(tint, 0.1, stop))))
        expect(
          Number(worst.toFixed(2)),
          `${theme} .badge-${cls} : texte ${text} sur fond composité → ${worst.toFixed(2)}:1 (< 4.5). ` +
          `Assombrir/éclaircir le TEXTE, pas le fond — cf. le bloc [data-theme="light"] d'index.css.`,
        ).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
