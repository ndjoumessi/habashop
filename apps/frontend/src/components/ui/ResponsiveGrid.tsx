import React from 'react'

interface ResponsiveGridProps {
  /**
   * `fit` (défaut) : les colonnes vides s'effondrent, les éléments s'ÉTIRENT — ce
   * qu'il faut pour un formulaire. `fill` : les colonnes vides restent, les éléments
   * gardent leur taille — ce qu'il faut pour une grille d'articles.
   */
  mode?: 'fit' | 'fill'
  /** Largeur mini d'une colonne (px). La grille passe en `auto-fit` →
   *  autant de colonnes que la largeur le permet, puis 1 seule sur mobile.
   *  C'est le remplaçant des `gridTemplateColumns` fixes inline (cause racine P0-1/P2-5). */
  min?: number
  gap?: number
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
  /** A11y optionnel : `role="list"` + nom accessible quand la grille est une LISTE
   *  d'éléments (ex. cartes produit). Additif — omis = grille purement visuelle inchangée. */
  role?: string
  'aria-label'?: string
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
export default function ResponsiveGrid({ min = 240, gap = 12, mode = 'fit', className, style, children, role, 'aria-label': ariaLabel }: ResponsiveGridProps) {
  return (
    <div
      className={className}
      role={role}
      aria-label={ariaLabel}
      style={{
        display: 'grid',
        /**
         * ⚠️ `auto-fit` ÉTIRE, `auto-fill` NON — et la différence ne se voit que
         * quand il reste PEU d'éléments.
         *
         * `auto-fit` EFFONDRE les colonnes vides : deux tuiles sur une rangée qui
         * en tiendrait douze absorbent toute la largeur. OBSERVÉ le 2026-08-12 sur
         * la caisse filtrée par catégorie — deux cartes larges de 900 px avec un
         * émoji de 38 px flottant dans le vide.
         *
         * `auto-fill` GARDE les colonnes vides, qui absorbent l'espace : les tuiles
         * conservent leur taille dessinée et la rangée se termine par du blanc.
         *
         * Défaut inchangé à `fit` : sur les ~50 appels de ce composant, la quasi
         * totalité sont des FORMULAIRES en modale, où un champ DOIT remplir sa
         * colonne. N'activer `fill` que sur une grille d'ARTICLES en nombre
         * variable, dont la tuile a une taille dessinée.
         */
        gridTemplateColumns: `repeat(auto-${mode}, minmax(min(100%, ${min}px), 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
