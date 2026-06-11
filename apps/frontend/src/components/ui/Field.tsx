import React, { useId } from 'react'

interface FieldProps {
  label:     string
  error?:    string
  hint?:     string
  required?: boolean
  children:  React.ReactElement
}

/**
 * Champ de formulaire accessible : associe un `<label htmlFor>` à l'input
 * (id généré), et câble `aria-required`/`aria-invalid`/`aria-describedby`.
 */
export default function Field({ label, error, hint, required, children }: FieldProps) {
  const uid = useId()

  const child = React.cloneElement(children, {
    id: uid,
    'aria-required': required ?? false,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${uid}-error` : hint ? `${uid}-hint` : undefined,
  } as React.HTMLAttributes<HTMLElement>)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={uid} style={{
        display: 'block', fontSize: 11, fontWeight: 'var(--fw-semibold)',
        textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)',
      }}>
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>

      {child}

      {hint && !error && (
        <span id={`${uid}-hint`} style={{ fontSize: 11, color: 'var(--text3)' }}>{hint}</span>
      )}
      {error && (
        <span id={`${uid}-error`} role="alert" style={{
          fontSize: 11, color: 'var(--danger)', fontWeight: 'var(--fw-regular)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>⚠ {error}</span>
      )}
    </div>
  )
}
