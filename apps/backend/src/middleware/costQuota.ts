import { authorizeSpend, resolveTenantSpendInfo, tenantSpendState } from '../lib/spend/spendGuard'
import type { SpendKind } from '../lib/spend/spendGuard'

/**
 * Pré-refus RAPIDE sur les routes à coût — il ne COMPTE plus rien.
 *
 * La comptabilité vit désormais au point de dépense (`lib/spend/*`), là où le message
 * part et l'appel Claude se fait. Ce middleware ne sert plus qu'à renvoyer un code HTTP
 * propre AVANT que le handler ne travaille (parse multipart, requêtes DB, construction
 * de prompt) quand la boutique est de toute façon refusée : démo, essai échu, suspendue.
 *
 * Conséquence de ce déplacement : un refus de rôle, un fichier trop lourd (413), un
 * format refusé (415) ou une clé absente (503) ne consomment plus rien — ils n'atteignent
 * jamais le point de dépense. Le compteur est exact par construction, ce qui a rendu
 * inutiles le hook `refundQuotaHook` et le marqueur `request.__quotaKey` (supprimés).
 */

export { QUOTA_EXCEEDED, TRIAL_EXPIRED, TENANT_INACTIVE, DEMO_TENANT_FORBIDDEN } from '../lib/spend/spendGuard'
export type { SpendKind }

/**
 * Override de rate-limit des routes à coût — borne le rayon d'abus, y compris pendant
 * un fail-open Redis du quota. `max` et `keyGenerator` sont des fonctions, donc relues
 * à chaque requête (ajustable par env sans redéploiement).
 */
export const COST_ROUTE_RATE_LIMIT = {
  max: () => Number(process.env.COST_RATE_LIMIT_MAX) || 10,
  timeWindow: '1 minute',
}

/**
 * preHandler à poser APRÈS `authenticate`. Ne consomme aucun quota : il rejette
 * seulement ce qui est refusé quel que soit le nombre d'appels restants.
 */
export function costQuota(_kind: SpendKind) {
  return async function costQuotaHandler(request: any, reply: any): Promise<void> {
    const tenantId = request.tenantId
    if (!tenantId) return // `authenticate` a déjà tranché (400 NO_ACTIVE_TENANT)

    let info
    try {
      info = await resolveTenantSpendInfo(tenantId)
    } catch {
      return // indisponibilité DB : le point de dépense tranchera (fail-closed there)
    }

    const state = tenantSpendState(info)
    if (!state.ok) {
      return reply.code(403).send({ error: state.message, code: state.code })
    }
  }
}

export { authorizeSpend }
