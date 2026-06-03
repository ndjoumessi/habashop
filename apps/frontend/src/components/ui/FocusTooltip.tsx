import React, { useId, useState } from 'react'

interface FocusTooltipProps {
  label: string
  children: React.ReactElement
  /** Position du tooltip par rapport au trigger. */
  placement?: 'top' | 'bottom'
}

/**
 * Tooltip accessible au CLAVIER (pas souris-only) : s'affiche au survol ET au focus
 * (onFocus/onBlur remontent du trigger via React), se ferme à Échap. Le contenu est
 * lié au trigger par `aria-describedby` pour les lecteurs d'écran. Thémé var(--card).
 *
 *   <FocusTooltip label={hint}><button …>FR</button></FocusTooltip>
 */
export default function FocusTooltip({ label, children, placement = 'top' }: FocusTooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  const child = React.cloneElement(children, {
    'aria-describedby': open ? id : undefined,
  })

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
    >
      {child}
      {open && (
        <div
          role="tooltip"
          id={id}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(placement === 'top' ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 99999,
            boxShadow: 'var(--sh-xs)',
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}
