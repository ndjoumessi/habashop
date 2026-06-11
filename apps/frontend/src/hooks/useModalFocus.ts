import { useEffect, useRef } from 'react'

// Sélecteur des éléments focusables au clavier (tabindex=-1 exclu)
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Pile des modales ouvertes : seule la modale du dessus piège Tab
// (gère les modales empilées, ex. ConfirmModal au-dessus d'une modale d'édition).
const stack: HTMLElement[] = []

/**
 * Focus management de modale (pattern non invasif) :
 * - au montage : mémorise l'élément actif (déclencheur) puis déplace le focus
 *   dans la modale (élément `initialFocus`, sinon 1er focusable, sinon la box en tabIndex=-1) ;
 * - piège Tab / Shift+Tab à l'intérieur (boucle premier ↔ dernier, liste recalculée
 *   à chaque Tab pour suivre le contenu dynamique) ;
 * - au démontage : restaure le focus sur l'élément déclencheur.
 *
 * Échap reste géré globalement (handler AppLayout qui clique le backdrop du dessus).
 *
 * Usage : `const boxRef = useModalFocus(isOpen)` + `<div ref={boxRef} className="modal-box">…`
 */
export function useModalFocus<T extends HTMLElement = HTMLDivElement>(
  active: boolean = true,
  opts?: { initialFocus?: string },
) {
  const ref = useRef<T>(null)
  const initialFocus = opts?.initialFocus

  useEffect(() => {
    if (!active) return
    const box = ref.current
    if (!box) return

    const opener = document.activeElement as HTMLElement | null
    stack.push(box)

    const isVisible = (el: HTMLElement) => el.getClientRects().length > 0
    const getFocusable = () =>
      Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible)

    // Focus initial — différé d'un tick pour laisser un éventuel autoFocus natif s'exécuter
    const focusTimer = setTimeout(() => {
      if (box.contains(document.activeElement)) return // autoFocus déjà posé dans la modale
      const target =
        (initialFocus ? box.querySelector<HTMLElement>(initialFocus) : null) ?? getFocusable()[0]
      if (target) target.focus()
      else { box.tabIndex = -1; box.focus() }
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (stack[stack.length - 1] !== box) return // une modale plus haute gère le Tab
      const els = getFocusable()
      if (els.length === 0) { e.preventDefault(); return }
      const first = els[0]
      const last = els[els.length - 1]
      const current = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (current === first || !box.contains(current)) { e.preventDefault(); last.focus() }
      } else {
        if (current === last || !box.contains(current)) { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown, true)
      const idx = stack.indexOf(box)
      if (idx !== -1) stack.splice(idx, 1)
      // Restaure le focus sur l'élément déclencheur (s'il est toujours dans le DOM)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [active, initialFocus])

  return ref
}

export default useModalFocus
