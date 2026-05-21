import type { ReactNode } from 'react'

interface ViewFieldProps {
  label: string
  value?: ReactNode
  editing: boolean
  children?: ReactNode
  className?: string
}

export default function ViewField({ label, value, editing, children, className }: ViewFieldProps) {
  const labelEl = (
    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'var(--text3)', marginBottom:5, textTransform:'uppercase' as const, letterSpacing:'.4px' }}>
      {label}
    </label>
  )
  return (
    <div className={className}>
      {labelEl}
      {editing
        ? children
        : <div style={{ padding:'10px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, fontSize:13, color:'var(--text)', fontWeight:600, minHeight:40, lineHeight:1.5, wordBreak:'break-word' as const }}>
            {value ?? <span style={{ color:'var(--text3)', fontStyle:'italic' }}>—</span>}
          </div>
      }
    </div>
  )
}
