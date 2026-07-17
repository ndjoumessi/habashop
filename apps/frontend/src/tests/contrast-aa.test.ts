import { describe, it, expect } from 'vitest'
import { THEMES } from '@/stores/appStore'

/**
 * Garde-fou anti-régression de contraste (Vague 3, item 6).
 * Vérifie que chaque paire texte/fond « lue » (text2/text3/text4 × bg/bg2/bg3) de CHAQUE
 * thème respecte le ratio WCAG AA small-text (≥4.5:1). Empêche qu'un futur ajustement de
 * palette réintroduise du texte illisible (cf. --text4 qui échouait partout avant la Vague 1).
 *
 * Résolution = base :root (sombre, depuis index.css) surchargée par THEMES[theme].vars,
 * + le text4 clair (LIGHT_EXTRA_VARS d'appStore) pour les thèmes clairs qui ne le définissent pas.
 */

// Miroir des valeurs :root d'index.css (baseline sombre) — si tu modifies l'un, modifie l'autre.
const BASE: Record<string, string> = {
  '--bg': '#0A0C14', '--bg2': '#0D1019', '--bg3': '#11151F',
  '--text': '#EAEEF6', '--text2': '#AAB2C4', '--text3': '#8E96AA', '--text4': '#868EA2',
}
// LIGHT_EXTRA_VARS['--text4'] d'appStore (appliqué aux thèmes clairs ne définissant pas text4).
const LIGHT_EXTRA_TEXT4 = '#686677'

function lin(c: number) { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
function luminance(hex: string) {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
function ratio(a: string, b: string) {
  const l1 = luminance(a), l2 = luminance(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

type ConcreteTheme = keyof typeof THEMES // 'dark' | 'light' (set réduit — « system » se résout)

function resolve(theme: ConcreteTheme): Record<string, string> {
  const vars = THEMES[theme].vars as Record<string, string>
  const eff = { ...BASE }
  for (const k of Object.keys(eff)) if (vars[k]) eff[k] = vars[k]
  const isLight = theme === 'light'
  if (isLight && !vars['--text4']) eff['--text4'] = LIGHT_EXTRA_TEXT4
  return eff
}

const AA_SMALL = 4.5
const TEXT_TOKENS = ['--text2', '--text3', '--text4'] as const
const BG_TOKENS = ['--bg', '--bg2', '--bg3'] as const

describe('Contraste AA — chaque thème', () => {
  const themes = Object.keys(THEMES) as ConcreteTheme[]

  it('couvre les thèmes concrets déclarés (Sombre + Clair)', () => {
    expect(themes).toContain('dark')
    expect(themes).toContain('light')
  })

  for (const theme of themes) {
    for (const tk of TEXT_TOKENS) {
      for (const bk of BG_TOKENS) {
        it(`${theme} : ${tk} sur ${bk} ≥ 4.5:1`, () => {
          const eff = resolve(theme)
          const r = ratio(eff[tk], eff[bk])
          expect(r, `${theme} ${tk}(${eff[tk]}) / ${bk}(${eff[bk]}) = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(AA_SMALL)
        })
      }
    }
  }
})
