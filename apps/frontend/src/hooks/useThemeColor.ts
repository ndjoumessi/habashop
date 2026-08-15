import { useAppStore } from '@/stores/appStore'

// Résout une couleur de thème à passer en ATTRIBUT SVG (stroke=/fill=), où les
// CSS custom properties (var(--x)) ne sont PAS résolues par le navigateur. On lit donc la
// valeur calculée en JS sur :root. Pur + testable (pas de hook).
export function resolveThemeColor(cssVar: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback // garde SSR
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  return v || fallback
}

// Hook : lit `cssVar` sur :root et RE-RÉSOUT à chaque changement de thème/accent — il
// s'abonne à `theme`/`accentColor` du store (applyTheme/applyAccentColor réécrivent les
// vars de :root synchroniquement avant le re-render React), donc le composant graphique
// se re-rend et relit la nouvelle valeur. Pas besoin de MutationObserver.
export function useThemeColor(cssVar: string, fallback = 'rgba(128,128,128,.3)'): string {
  // Abonnements : déclenchent le re-render au changement de thème/accent (valeur non utilisée).
  useAppStore(s => s.theme)
  useAppStore(s => s.accentColor)
  return resolveThemeColor(cssVar, fallback)
}
