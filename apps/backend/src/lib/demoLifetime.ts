import { randomUUID } from 'crypto'

/**
 * DÉMOS JETABLES — identité et durée de vie.
 *
 * ⚠️ Le préfixe d'identifiant sert à LIRE — journaux, console Ops —, JAMAIS à décider d'une
 * suppression. C'est `Tenant.demoExpiresAt` non nul et dépassé qui autorise la purge
 * (`services/demoPurge.ts`), et la garde au point de destruction lit la même colonne
 * (`lib/tenantPurge.ts` → `hardDeleteTenant`). Les démos permanentes
 * (`demo-tenant-001/002`) et `e2e-tenant` portent `null`, donc sont impurgeables PAR
 * CONSTRUCTION. Décider sur le nom rouvrirait le trou que la colonne ferme.
 *
 * ⚠️ La version précédente de ce commentaire justifiait le préfixe par « borner le périmètre
 * d'un script de suppression MANUELLE ». Ce script n'existe pas. C'est la règle
 * « le COMMENTAIRE QUI INVENTE UN REPLI » : une affirmation qui sert de justification à autre
 * chose doit citer un `fichier:ligne`, ou disparaître. Les deux références ci-dessus sont
 * vérifiables en dix secondes.
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

/**
 * Cet identifiant est-il celui d'une démo JETABLE (et non d'une démo permanente) ?
 *
 * ⚠️ Employé UNIQUEMENT pour lire et journaliser. La décision de supprimer se prend sur
 * `Tenant.demoExpiresAt`, jamais ici : un préfixe se recopie, une colonne non.
 */
export function isEphemeralDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX)
}
