import React, { useRef } from 'react'

export interface TabItem<T extends string = string> {
  id: T
  label: React.ReactNode
  icon?: React.ReactNode
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** `pill` = pastilles autonomes (Reports/Expenses) · `segmented` = barre pleine largeur (Orders/HR). */
  variant?: 'pill' | 'segmented'
  ariaLabel?: string
}

/**
 * Barre d'onglets unifiée + responsive. Sous 768px (ou si trop d'onglets), la rangée
 * défile horizontalement (scroll-x, scrollbar masquée) au lieu de casser/wrapper.
 * Accessible clavier : role=tablist/tab, flèches ←/→ pour naviguer, Home/End.
 * Le `variant` préserve les deux styles historiques (pastilles vs segmenté plein).
 */
export default function Tabs<T extends string = string>({
  tabs, value, onChange, variant = 'pill', ariaLabel,
}: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const segmented = variant === 'segmented'

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next >= 0) {
      e.preventDefault()
      onChange(tabs[next].id)
      refs.current[next]?.focus()
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="tabs-scroll"
      style={{
        display: 'flex', gap: segmented ? 4 : 6,
        ...(segmented ? { background: 'var(--bg3)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' } : {}),
      }}
    >
      {tabs.map((tab, idx) => {
        const on = value === tab.id
        return (
          <button
            key={tab.id}
            ref={el => { refs.current[idx] = el }}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            type="button"
            onClick={() => onChange(tab.id)}
            onKeyDown={e => onKey(e, idx)}
            style={segmented ? {
              flex: '1 1 auto', minWidth: 'fit-content', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 12px', borderRadius: 9, fontSize: 'var(--fs-sm)',
              fontWeight: on ? 700 : 500, fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all .15s',
              background: on ? 'linear-gradient(135deg,rgba(108,71,255,.18),rgba(0,184,255,.08))' : 'transparent',
              border: on ? '1px solid rgba(108,71,255,.28)' : '1px solid transparent',
              color: on ? 'var(--p2)' : 'var(--text3)',
            } : {
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              padding: '7px 16px', borderRadius: 99, fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)',
              fontFamily: 'var(--font)', cursor: 'pointer', transition: 'all .15s',
              background: on ? 'var(--p)' : 'var(--card)',
              color: on ? '#fff' : 'var(--text2)',
              border: on ? '1px solid transparent' : '1px solid var(--border)',
              boxShadow: on ? '0 4px 14px rgba(91,78,232,.35)' : 'none',
            }}
          >
            {tab.icon}{tab.label}
          </button>
        )
      })}
    </div>
  )
}
