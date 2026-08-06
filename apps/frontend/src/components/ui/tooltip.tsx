import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

/**
 * Fournisseur de contexte Radix pour les infobulles.
 *
 * ⚠️ SEUL `TooltipProvider` subsiste, et il ne rend AUCUNE classe — c'est un fournisseur de
 * contexte, rien d'autre. Les trois autres exports de shadcn (`Tooltip`, `TooltipTrigger`,
 * `TooltipContent`) ont été retirés : ils n'étaient importés nulle part, et à eux seuls ils
 * portaient **18 des 20 derniers jetons de classe absents** du CSS livré — des utilitaires
 * Tailwind (`z-50`, `bg-foreground`, `data-open:zoom-in-95`…) qu'aucune règle n'aurait pu
 * honorer, Tailwind n'émettant rien dans ce dépôt (cf. `scripts/classAudit.mjs`).
 *
 * Les écrire à la main aurait été inventer un système de design parallèle pour un composant
 * que personne ne rend. L'infobulle réellement utilisée par le produit est
 * `components/ui/FocusTooltip.tsx`.
 *
 * ⚠️ `main.tsx:5` importe ce fournisseur : ne pas le supprimer sans traiter cet appel.
 */
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

export { TooltipProvider }
