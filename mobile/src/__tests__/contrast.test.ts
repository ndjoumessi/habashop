import { DarkColors, LightColors, SoleilColors } from '@/constants/theme'

// ── Garde-fou contraste WCAG (Vague 3) ────────────────────────────────────────
// Vérifie que chaque tier de texte « lu » respecte le ratio AA (4.5:1) sur les
// surfaces où il s'affiche, dans LES DEUX palettes. Empêche la régression du fix
// contraste de la Vague 1 (text3 sombre #606080 → #8A8AB0). text4 = décor → exclu.

// Luminance relative sRGB (formule WCAG 2.x).
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

// Ratio de contraste entre deux couleurs (≥1).
function contrast(fg: string, bg: string): number {
  const a = luminance(fg)
  const b = luminance(bg)
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

const AA_NORMAL = 4.5
const TEXT_TIERS = ['text', 'text2', 'text3'] as const   // tiers de TEXTE lu (text4 = décor)
const SURFACES = ['bg', 'bg2', 'bg3', 'card'] as const    // fonds où le texte s'affiche

describe('Contraste WCAG AA — paires texte/fond (Dark + Light)', () => {
  const palettes = [
    ['Dark', DarkColors],
    ['Light', LightColors],
    ['Soleil', SoleilColors],
  ] as const

  for (const [name, palette] of palettes) {
    for (const tier of TEXT_TIERS) {
      for (const surface of SURFACES) {
        it(`${name}: ${tier} sur ${surface} ≥ ${AA_NORMAL}:1`, () => {
          const ratio = contrast(palette[tier], palette[surface])
          expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL)
        })
      }
    }
  }

  // Sanity-check de la fonction : noir/blanc = 21:1.
  it('noir/blanc = 21:1', () => {
    expect(Math.round(contrast('#000000', '#FFFFFF'))).toBe(21)
  })
})
