import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  open:          boolean
  title:         string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  danger?:       boolean
  onConfirm:     () => void
  onCancel:      () => void
}

/**
 * Modale de confirmation accessible (remplace window.confirm) :
 * role="dialog" + aria-modal, focus initial sur Annuler, focus-trap + Escape.
 */
export default function ConfirmModal({
  open, title, message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return
    const cancel = el.querySelector<HTMLElement>('[data-cancel]')
    cancel?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key !== 'Tab') return
      const els = el.querySelectorAll<HTMLElement>('button,[href],input,[tabindex]:not([tabindex="-1"])')
      const first = els[0]; const last = els[els.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="dialog" aria-modal="true"
      aria-labelledby="confirm-title" aria-describedby="confirm-message"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div ref={ref} className="modal-box" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', margin: '0 auto 16px',
          background: danger ? 'var(--c-red-bg)' : 'var(--c-purple-bg)',
          border: `1.5px solid ${danger ? 'var(--c-red-border)' : 'var(--c-purple-border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }} aria-hidden="true">{danger ? '⚠️' : '❓'}</div>
        <h3 id="confirm-title" style={{ fontSize: 16, fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
        <p id="confirm-message" style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button data-cancel onClick={onCancel} className="mini-btn" style={{ flex: 1, justifyContent: 'center' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px',
            background: danger
              ? 'var(--grad-danger)'
              : 'linear-gradient(135deg,var(--p),var(--p2))',
            border: 'none', borderRadius: 10, color: '#fff',
            fontSize: 13, fontWeight: 'var(--fw-semibold)', cursor: 'pointer', fontFamily: 'var(--font)',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
