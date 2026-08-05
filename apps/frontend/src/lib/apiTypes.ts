/**
 * Types de FRONTIÈRE transverses (#185) — pour les surfaces qui n'ont pas de module
 * `*Shared` de domaine : compte, facturation, journal d'audit.
 *
 * ⚠️ Chacun est dérivé de la réponse RÉELLE du handler (objet littéral construit, ou `select`
 * Prisma explicite), jamais du modèle supposé. Quand le handler fait un `select`, le type
 * NE DOIT PAS annoncer les colonnes non sélectionnées : elles ne sont pas sur le fil.
 */

/**
 * `GET /api/account/security-activity` — ⚠️ `select` EXPLICITE côté serveur (6 champs).
 * Le modèle `UserAuditLog` en porte davantage ; les annoncer ici ferait lire `undefined`.
 */
export interface ApiSecurityEvent {
  id: string
  action: string
  description: string
  ip: string | null
  severity: string
  createdAt: string
}

/**
 * `GET /api/audit-logs` — modèle `AuditLog` complet + `include` du NOM de l'utilisateur seul.
 * ⚠️ `user` peut être présent avec un seul champ : l'`include` est `{ user: { select: { name } } }`.
 */
export interface ApiAuditLog {
  id: string
  tenantId: string
  userId: string
  module: string
  action: string
  description: string
  ip: string | null
  severity: string
  createdAt: string
  user: { name: string } | null
}

/** Demande de plan en attente, telle que RECONSTRUITE par le handler (7 champs, pas le modèle). */
export interface ApiPendingPlanRequest {
  id: string
  plan: string
  period: string
  /** ⚠️ En XOF — console de facturation, cf. § Règles devise (exception plateforme). */
  amount: number
  paymentMethod: string
  status: string
  createdAt: string
}

/** `GET /api/billing/status` — objet littéral construit par le handler, pas un modèle. */
export interface ApiBillingStatus {
  plan: string
  /** ⚠️ `suspended` FORCÉ si l'essai est échu, même si la colonne dit autre chose. */
  status: string
  trialDaysLeft: number
  isTrialExpired: boolean
  planActivatedAt: string | null
  hasPendingRequest: boolean
  pendingRequest: ApiPendingPlanRequest | null
  canUpgrade: boolean
  canContinue: boolean
}

/** Corps de `POST /api/billing/request-plan`. */
export type PlanRequestWrite = {
  plan: string
  period?: string
  paymentMethod?: string
}
