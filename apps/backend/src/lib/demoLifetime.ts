import { randomUUID } from 'crypto'

/**
 * DÉMOS JETABLES — identité et durée de vie.
 *
 * ⚠️ Le préfixe d'identifiant sert à LIRE (journaux, console Ops) et à borner le périmètre
 * d'un script de suppression MANUELLE — jamais à décider d'une suppression automatique.
 * C'est `Tenant.demoExpiresAt` non nul et dépassé qui autorise la purge : les démos
 * permanentes (`demo-tenant-001/002`) et `e2e-tenant` portent `null`, donc sont
 * impurgeables PAR CONSTRUCTION. Décider sur le nom rouvrirait le trou que la colonne ferme.
 */

/** Préfixe réservé aux démos créées en libre-service. */
export const DEMO_ID_PREFIX = 'demo-tmp-'

/** Durée de vie, en jours. Décision de Nelson du 2026-10-01. */
export const DEMO_TTL_DAYS = 7

const MS_PAR_JOUR = 24 * 60 * 60 * 1000

/**
 * Échéance d'une démo créée à `now`.
 * ⚠️ `now` est un PARAMÈTRE : un `new Date()` implicite rendrait la fonction intestable
 * (convention du dépôt sur toute date « maintenant »).
 */
export function demoExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + DEMO_TTL_DAYS * MS_PAR_JOUR)
}

/** Identifiant d'une démo neuve. */
export function newDemoTenantId(): string {
  return `${DEMO_ID_PREFIX}${randomUUID()}`
}

/** Cet identifiant est-il celui d'une démo JETABLE (et non d'une démo permanente) ? */
export function isEphemeralDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX)
}
