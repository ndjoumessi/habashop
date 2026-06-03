import React from 'react'

type Variant = 'ghost' | 'surface' | 'solid'

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** OBLIGATOIRE : nom accessible (aria-label) + tooltip natif (title). Règle la dette
   *  des boutons icon-only sans nom accessible d'un coup. */
  label: string
  icon: React.ReactNode
  variant?: Variant
  /** Teinte danger (rouge) pour les actions destructrices. */
  danger?: boolean
  /** État actif (toggle). */
  active?: boolean
}

const BASE: React.CSSProperties = {
  // Hit-area ≥44px intégrée (WCAG 2.5.5) — plus besoin de la régler à chaque appel.
  minWidth: 44, minHeight: 44, width: 44, height: 44,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, borderRadius: 'var(--r-md)', cursor: 'pointer',
  transition: 'all .15s', fontFamily: 'var(--font)', padding: 0,
}

/**
 * Bouton icône unifié : hit-area 44px garantie + `label` requis (aria-label + title).
 * Remplace les `.btn-icon` / `.icon-btn` éparpillés et leurs tailles ad hoc.
 *
 *   <IconButton label={t('edit')} icon={<Pencil size={16} />} onClick={…} />
 *   <IconButton label={t('delete')} icon={<Trash2 size={16} />} danger onClick={…} />
 */
export default function IconButton({
  label, icon, variant = 'ghost', danger = false, active = false, style, ...rest
}: IconButtonProps) {
  const color = danger ? 'var(--danger)' : active ? 'var(--p2)' : 'var(--text3)'
  const bg =
    variant === 'solid'   ? 'var(--bg4)'
    : variant === 'surface' ? 'var(--bg3)'
    : active ? 'var(--bg3)' : 'transparent'
  const border = variant === 'ghost' && !active ? '1px solid transparent' : '1px solid var(--border)'

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      style={{ ...BASE, background: bg, border, color, ...style }}
      onMouseEnter={e => { if (variant === 'ghost') (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; (e.currentTarget as HTMLElement).style.color = danger ? 'var(--danger)' : 'var(--text)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = bg; (e.currentTarget as HTMLElement).style.color = color }}
      {...rest}
    >
      {icon}
    </button>
  )
}
