import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
}

interface FilterSelectProps {
  value: string
  onChange: (v: string) => void
  options: FilterOption[]
  ariaLabel: string
  /** Largeur minimale du trigger (px). */
  minWidth?: number
  /** Icône optionnelle affichée dans le trigger (Lucide). */
  icon?: ReactNode
}

/**
 * Select de filtre custom, tokenisé (design system Daylight) — remplace les
 * <select> natifs pour un menu déroulant cohérent multi-thème (sombre + Mode
 * soleil) : positionnement propre sous le trigger (pas de chevauchement),
 * z-index --z-dropdown, élévation --sh-lg, état sélectionné explicite (tint +
 * coche), fermeture au clic-extérieur / Échap. Purement présentationnel :
 * émet la même `value` que l'ancien <option>, la logique de filtrage en amont
 * est inchangée.
 */
export default function FilterSelect({ value, onChange, options, ariaLabel, minWidth = 150, icon }: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const selected = options.find(o => o.value === value) ?? options[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          minWidth, width: '100%', minHeight: 42, padding: '0 var(--sp-3)',
          background: 'var(--bg4)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)',
          color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 'var(--fs-label)',
          cursor: 'pointer', transition: 'border-color .15s',
        }}
        onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--p2)' }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {icon}{selected?.label}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text3)', flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%',
            zIndex: 'var(--z-dropdown)' as any, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-lg)',
            padding: 4, maxHeight: 320, overflowY: 'auto',
          }}
        >
          {options.map(o => {
            const isSel = o.value === value
            return (
              <button
                key={o.value || '__all'}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  width: '100%', padding: '8px 10px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: isSel ? 'var(--p)' : 'transparent',
                  color: isSel ? '#fff' : 'var(--text2)',
                  fontFamily: 'var(--font)', fontSize: 'var(--fs-label)',
                  fontWeight: isSel ? 'var(--fw-semibold)' : 'var(--fw-regular)',
                  cursor: 'pointer', textAlign: 'left', transition: 'background .12s',
                }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {isSel && <Check size={14} style={{ flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
