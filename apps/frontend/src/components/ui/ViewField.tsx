import React from 'react'

interface ViewFieldProps {
  label:       string
  value?:      string | number | null
  icon?:       string
  mono?:       boolean
  color?:      string
  editing:     boolean
  fullWidth?:  boolean
  multiline?:  boolean
  emptyLabel?: string
  children:    React.ReactNode
}

export default function ViewField({
  label, value, icon, mono, color,
  editing, fullWidth, multiline, emptyLabel,
  children,
}: ViewFieldProps) {

  const labelStyle: React.CSSProperties = {
    display:'block', fontSize: 'var(--fs-caption)', fontWeight:'var(--fw-bold)',
    textTransform:'uppercase', letterSpacing:'.6px',
    color:'var(--text3)', marginBottom:5,
  }

  const valueSpanStyle: React.CSSProperties = multiline
    ? { flex:1, whiteSpace:'pre-wrap', overflow:'visible' }
    : { flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }

  return (
    <div style={fullWidth ? {gridColumn:'1/-1'} : {}}>
      <label style={labelStyle}>{label}</label>

      {/* ÉDITION : affiche UNIQUEMENT les children */}
      {editing === true && <>{children}</>}

      {/* VISUALISATION : div statique, JAMAIS d'input dans le DOM */}
      {editing !== true && (
        <div style={{
          padding:'9px 13px',
          background:'transparent',
          border:'1px solid var(--border)',
          borderRadius:10,
          fontSize:'var(--fs-sm)', fontWeight:'var(--fw-regular)',
          color: color ?? 'var(--text2)',
          fontFamily: mono ? 'var(--mono)' : 'var(--font)',
          minHeight:40,
          height: multiline ? 'auto' : undefined,
          display:'flex',
          alignItems: multiline ? 'flex-start' : 'center',
          gap:8,
          userSelect:'text', cursor:'default',
          letterSpacing: mono ? '-.2px' : 'normal',
        }}>
          {icon && (
            <span style={{fontSize:'var(--fs-sm)',flexShrink:0,opacity:.7}}>
              {icon}
            </span>
          )}
          <span style={valueSpanStyle}>
            {value !== null && value !== undefined && String(value).trim() !== ''
              ? value
              : (
                <span style={{color:'var(--text4)',fontStyle:'italic',fontSize:'var(--fs-label)'}}>
                  {emptyLabel ?? 'Non renseigné'}
                </span>
              )
            }
          </span>
        </div>
      )}
    </div>
  )
}
