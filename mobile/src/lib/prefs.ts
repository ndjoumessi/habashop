// Règle PURE des préférences device. La devise/ langue choisies par l'utilisateur sont
// persistées (appStore) ; les valeurs par défaut (tenant.currency) ne s'appliquent QUE
// si l'utilisateur n'a jamais fait de choix manuel.

/**
 * Faut-il aligner la devise d'affichage sur celle du tenant ?
 * NON si l'utilisateur a déjà choisi une devise manuellement (currencyManuallySet=true)
 * → son choix survit aux OTA / re-login. OUI seulement si aucun choix manuel + tenant connu.
 */
export function shouldApplyTenantCurrency(currencyManuallySet: boolean, tenantCurrency?: string | null): boolean {
  return !currencyManuallySet && !!tenantCurrency
}
