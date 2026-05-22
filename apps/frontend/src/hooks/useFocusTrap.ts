import { useEffect, useRef } from 'react'

export function useFocusTrap(isOpen: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !ref.current) return

    const el = ref.current
    const focusable = el.querySelectorAll<HTMLElement>(
      'button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    const prevFocused = document.activeElement as HTMLElement
    first?.focus()

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        el.dispatchEvent(new CustomEvent('modal-close', { bubbles: true }))
        return
      }
      if (e.key !== 'Tab') return
      if (!focusable.length) { e.preventDefault(); return }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      prevFocused?.focus()
    }
  }, [isOpen])

  return ref
}
