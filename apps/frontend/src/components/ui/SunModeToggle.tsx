import { Sun } from 'lucide-react'
import { useConfig, type Theme } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import FocusTooltip from './FocusTooltip'

/** Mémorise le thème d'avant le mode soleil pour y revenir au 2ᵉ tap (survit au reload). */
const PREV_KEY = 'habashop_sun_prev'

/**
 * Bouton ☀️ du header : bascule en un tap vers le thème « Mode soleil » (clair haut-contraste,
 * étal extérieur) depuis n'importe quel écran, et restaure le thème précédent au 2ᵉ tap.
 * Différenciateur terrain (plein soleil) — cohérent avec le même mode côté mobile.
 */
export default function SunModeToggle() {
  const { theme, updateConfig } = useConfig()
  const { i } = useI18n()
  const on = theme === 'soleil'

  const label = on
    ? i('Quitter le mode soleil', 'Exit sun mode', 'Salir del modo sol', 'Esci dalla modalità sole')
    : i('Mode soleil (plein air)', 'Sun mode (outdoor)', 'Modo sol (exterior)', 'Modalità sole (esterno)')

  const toggle = () => {
    if (on) {
      const prev = (localStorage.getItem(PREV_KEY) as Theme) || 'gold'
      updateConfig({ theme: prev })
    } else {
      localStorage.setItem(PREV_KEY, theme)
      updateConfig({ theme: 'soleil' })
    }
  }

  return (
    <FocusTooltip label={label} placement="bottom">
      <button
        className="icon-btn"
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={on}
        style={{
          color: on ? 'var(--warn)' : 'var(--text3)',
          background: on ? 'color-mix(in srgb, var(--warn) 16%, transparent)' : 'var(--bg3)',
          borderColor: on ? 'var(--warn)' : 'var(--border)',
        }}
      >
        <Sun size={16} />
      </button>
    </FocusTooltip>
  )
}
