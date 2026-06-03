export const Colors = {
  primary:  '#6C47FF',
  primary2: '#8B6FFF',
  primary3: '#A991FF',
  accent:   '#FF9500',
  accent2:  '#00D084',
  accent3:  '#00B8FF',
  danger:   '#FF3B5C',
  warn:     '#FFB800',
  bg:       '#07070F',
  bg2:      '#0D0D1E',
  bg3:      '#12121E',
  bg4:      '#18182A',
  card:     '#0F0F1E',
  border:   'rgba(255,255,255,0.08)',
  border2:  'rgba(255,255,255,0.12)',
  border3:  'rgba(255,255,255,0.18)',
  text:     '#F0F0FF',
  text2:    '#A0A0C0',
  text3:    '#8A8AB0',
  text4:    '#404060',
  white:    '#FFFFFF',
  black:    '#000000',
} as const

// ── Thèmes dynamiques (clair / sombre) ───────────────────────────────────
// `Colors` (au-dessus) reste INCHANGÉ = thème sombre figé, conservé pour les
// usages hors composant (ex. notification widget, couleur de marque). Les
// écrans consomment `C` via useTheme() → C = DarkColors | LightColors.
// DarkColors reprend exactement les valeurs de Colors (rendu identique).
export const DarkColors = {
  primary:  '#6C47FF', primary2: '#8B6FFF', primary3: '#A991FF',
  accent:   '#FF9500', accent2:  '#00D084', accent3:  '#00B8FF',
  danger:   '#FF3B5C', warn:     '#FFB800',
  bg:       '#07070F', bg2:      '#0D0D1E', bg3:      '#12121E', bg4:      '#18182A',
  card:     '#0F0F1E',
  border:   'rgba(255,255,255,0.08)', border2: 'rgba(255,255,255,0.12)', border3: 'rgba(255,255,255,0.18)',
  text:     '#F0F0FF', text2:    '#A0A0C0', text3:    '#8A8AB0', text4:    '#404060',
  white:    '#FFFFFF', black:    '#000000',
} as const

export const LightColors = {
  primary:  '#6C47FF', primary2: '#8B6FFF', primary3: '#5535CC',
  accent:   '#C47300', accent2:  '#008A54', accent3:  '#0087CC',
  danger:   '#CC1F3A', warn:     '#CC8C00',
  bg:       '#F8F8FF', bg2:      '#F0F0FA', bg3:      '#E8E8F5', bg4:      '#E0E0EE',
  card:     '#FFFFFF',
  border:   'rgba(0,0,0,0.08)', border2: 'rgba(0,0,0,0.15)', border3: 'rgba(0,0,0,0.20)',
  text:     '#0A0A1F', text2:    '#303050', text3:    '#606080', text4:    '#6A6A78',
  white:    '#FFFFFF', black:    '#000000',
} as const

// Forme commune (clés identiques entre Dark/Light) — signature de makeStyles(C).
// Valeurs `string` (pas les littéraux `as const`) pour que Dark ET Light soient
// tous deux assignables à ThemeColors (sinon "#5535CC" ≠ "#A991FF").
export type ThemeColors = { readonly [K in keyof typeof DarkColors]: string }

export const Spacing = {
  xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32
} as const

export const BorderRadius = {
  sm:6, md:10, lg:14, xl:18, xxl:24, full:9999
} as const

export const FontSize = {
  xs:11, sm:12, md:14, lg:16, xl:18,
  xxl:22, xxxl:28, hero:36
} as const

export const Shadow = {
  sm: {
    shadowColor:'#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.15, shadowRadius:4, elevation:2,
  },
  md: {
    shadowColor:'#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.2, shadowRadius:8, elevation:4,
  },
  lg: {
    shadowColor:'#000', shadowOffset:{width:0,height:8},
    shadowOpacity:0.3, shadowRadius:16, elevation:8,
  },
  colored: (color: string) => ({
    shadowColor:color, shadowOffset:{width:0,height:4},
    shadowOpacity:0.35, shadowRadius:10, elevation:6,
  }),
} as const

// Applique une opacité à une couleur hex (#RGB ou #RRGGBB) → 'rgba(r, g, b, a)'.
// Évite de recopier à la main des rgba() figés de la primaire/danger (cf. audit Sprint B).
export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
