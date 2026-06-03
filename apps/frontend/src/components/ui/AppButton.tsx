import React from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'ghost' | 'danger'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Affiche un spinner et désactive le bouton. État de chargement homogène
   *  (remplace les spinners ad hoc + le `disabled` manuel). */
  loading?: boolean
  leftIcon?: React.ReactNode
  fullWidth?: boolean
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn btn-primary',
  ghost: 'btn btn-ghost',
  danger: 'btn btn-danger',
}

/**
 * Bouton applicatif avec état `loading` intégré. S'appuie sur les classes `.btn*`
 * existantes (suit les thèmes) et ajoute un spinner + `disabled` cohérents.
 *
 *   <Button loading={saving} onClick={save}>{t('save')}</Button>
 *   <Button variant="danger" leftIcon={<Trash2 size={14} />}>{t('delete')}</Button>
 */
export default function Button({
  variant = 'primary', loading = false, leftIcon, fullWidth, disabled,
  className, style, children, ...rest
}: ButtonProps) {
  return (
    <button
      className={`${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        ...(fullWidth ? { width: '100%' } : {}),
        ...style,
      }}
      {...rest}
    >
      {loading
        ? <Loader2 size={15} style={{ animation: 'spin .7s linear infinite' }} aria-hidden="true" />
        : leftIcon}
      {children}
    </button>
  )
}
