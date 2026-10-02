import { DarkColors, LightColors } from '@/constants/theme'

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

// ── Bandeau « session expirée » de l'écran de connexion ──────────────────────
// Fond teinté `withAlpha(warn, 0.12)` par-dessus la carte. ⚠️ Le texte y est en
// `text`, pas en `warn` : mesuré le 2026-10-02, `warn` sur ce fond rend 2,55:1 en
// thème CLAIR. Le signal passe par le fond et la bordure, jamais au prix de la lecture.
describe('bandeau session expirée — lisible dans les deux thèmes', () => {
  function melange(fg: string, bg: string, a: number): string {
    const h = (x: string) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16))
    const [fr, fg2, fb] = h(fg)
    const [br, bg3, bb] = h(bg)
    const m = [fr * a + br * (1 - a), fg2 * a + bg3 * (1 - a), fb * a + bb * (1 - a)]
    return '#' + m.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
  }
  for (const [nom, P] of [['sombre', DarkColors], ['clair', LightColors]] as const) {
    it(`thème ${nom} — texte du bandeau ≥ AA`, () => {
      const fond = melange(P.warn, P.card, 0.12)
      expect(contrast(P.text, fond)).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }
  // Contrôle discriminant : la couleur qu'on a ÉCARTÉE échoue bien en clair.
  it('`warn` sur ce fond échouerait en thème clair — c’est pourquoi on ne l’emploie pas', () => {
    const fond = melange(LightColors.warn, LightColors.card, 0.12)
    expect(contrast(LightColors.warn, fond)).toBeLessThan(AA_NORMAL)
  })
})
