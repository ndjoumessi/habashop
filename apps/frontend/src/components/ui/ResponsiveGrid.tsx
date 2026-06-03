import React from 'react'

interface ResponsiveGridProps {
  /** Largeur mini d'une colonne (px). La grille passe en `auto-fit` →
   *  autant de colonnes que la largeur le permet, puis 1 seule sur mobile.
   *  C'est le remplaçant des `gridTemplateColumns` fixes inline (cause racine P0-1/P2-5). */
  min?: number
  gap?: number
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

/**
 * Grille responsive unifiée. Remplace les `display:grid; gridTemplateColumns:'1fr 1fr…'`
 * inline : `auto-fit` + `minmax(min(100%, {min}px), 1fr)` s'adapte de N colonnes (desktop)
 * à 1 colonne (mobile) sans media query. Le `min(100%, …)` empêche tout débordement
 * horizontal sur très petits écrans.
 *
 *   <ResponsiveGrid min={220}>…cards…</ResponsiveGrid>   // 2-col form → 1-col mobile
 *   <ResponsiveGrid min={260} gap={12}>…panels…</ResponsiveGrid>
 */
export default function ResponsiveGrid({ min = 240, gap = 12, className, style, children }: ResponsiveGridProps) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
