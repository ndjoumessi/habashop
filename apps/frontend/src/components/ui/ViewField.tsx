import React from 'react'

interface ViewFieldProps {
  label:      string
  value?:     string | number | null
  icon?:      string
  mono?:      boolean
  color?:     string
  editing:    boolean   // REQUIS — pas optionnel
  fullWidth?: boolean
  children:   React.ReactNode  // input affiché SEULEMENT si editing=true
}

export default function ViewField({
  label, value, icon, mono, color,
  editing, fullWidth, children,
}: ViewFieldProps) {

  const labelStyle: React.CSSProperties = {
    display:       'block',
    fontSize:      10,
    fontWeight:    800,
    textTransform: 'uppercase',
    letterSpacing: '.6px',
    color:         'var(--text3)',
    marginBottom:  6,
  }

  return (
    <div style={fullWidth ? { gridColumn: '1/-1' } : {}}>
      <label style={labelStyle}>{label}</label>

      {editing ? (
        // ── MODE ÉDITION : affiche l'input ──
        <>{children}</>
      ) : (
        // ── MODE VISUALISATION : texte statique, pas d'input ──
        <div style={{
          padding:      '10px 14px',
          background:   'rgba(255,255,255,.03)',
          border:       '1px solid rgba(255,255,255,.05)',
          borderRadius: 10,
          fontSize:     13,
          fontWeight:   600,
          color:        color ?? 'var(--text)',
          fontFamily:   mono ? 'var(--mono)' : 'var(--font)',
          minHeight:    42,
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          userSelect:   'text',
          cursor:       'default',
        }}>
          {icon && (
            <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
          )}
          <span style={{
            flex:         1,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {value !== null && value !== undefined && value !== ''
              ? value
              : <span style={{ color: 'var(--text4)', fontStyle: 'italic' }}>—</span>
            }
          </span>
        </div>
      )}
    </div>
  )
}
