import type { FastifyRequest } from 'fastify'

/**
 * Contexte boutique absent sur une route tenant-scopée.
 *
 * ⚠️ Cette branche est INATTEIGNABLE en exploitation normale : le garde
 * `authenticate` renvoie 400 `NO_ACTIVE_TENANT` avant tout handler métier
 * (seuls `/api/auth/*` et `/api/dashboard/consolidated` en sont exemptés, et
 * aucun n'utilise ce helper). Elle existe en DÉFENSE EN PROFONDEUR : si une
 * route tenant-scopée est un jour montée sans le garde, on veut une erreur
 * explicite et tracée plutôt qu'un `null` transmis silencieusement à Prisma —
 * c'est-à-dire une requête NON SCOPÉE, donc une lecture ou une écriture
 * potentiellement cross-tenant.
 */
export class TenantContextMissingError extends Error {
  readonly code = 'TENANT_CONTEXT_MISSING'
  readonly statusCode = 500

  constructor(route: string) {
    super(`Contexte boutique absent (${route})`)
    this.name = 'TenantContextMissingError'
  }
}

/**
 * Renvoie la boutique du JWT en `string` non-nullable.
 *
 * `JWTPayload.tenantId` est `string | null` (null tant qu'aucune boutique n'est
 * sélectionnée en multi-boutiques), alors que les `where: { tenantId }` de Prisma
 * attendent `string | undefined`. Ce helper porte le rétrécissement UNE fois,
 * au lieu d'un `!` par site — qui tairait l'avertissement sans rien vérifier.
 *
 * Lit `request.user.tenantId`, c'est-à-dire EXACTEMENT la source déjà utilisée
 * par les handlers : le helper est un changement de typage, pas de comportement.
 * ⚠️ La convergence vers `request.tenantId` (boutique ACTIVE résolue par
 * `authenticate`, motif W2) est un correctif distinct, à faire dans sa propre PR ;
 * elle se fera alors ici, en une ligne, plutôt que sur chaque site d'appel.
 */
export function getTenantId(request: FastifyRequest): string {
  const tenantId = request.user?.tenantId
  if (!tenantId) {
    // Route seule (motif `/api/sales/:id`), jamais l'URL complète : pas de PII en journal.
    const route = `${request.method} ${request.routeOptions?.url ?? 'route inconnue'}`
    console.error(`[tenant-context] TENANT_CONTEXT_MISSING — ${route}`)
    throw new TenantContextMissingError(route)
  }
  return tenantId
}

/**
 * Renvoie la BOUTIQUE ACTIVE en `string` non-nullable.
 *
 * Lit `request.tenantId` — la boutique active résolue par `authenticate`
 * (`active ?? null`, motif W2), typée `string | undefined` sur `FastifyRequest`
 * mais `string | null` au runtime. Le check truthy couvre les DEUX (`undefined`
 * comme `null`).
 *
 * ⚠️ CHAMP DISTINCT de `getTenantId`, qui lit `request.user.tenantId` (rétro-compat
 * des anciens JWT). Les deux coexistent à cause de la divergence W2 documentée ;
 * `request.tenantId` est le champ CORRECT (boutique active explicite), `request.user`
 * la source héritée. Ce helper est la couture de la future convergence : quand tous
 * les sites liront la boutique active, `getTenantId` s'alignera dessus ici, en un
 * point.
 *
 * Même défense en profondeur que `getTenantId` : la branche absente est inatteignable
 * derrière le garde `NO_ACTIVE_TENANT`, mais lève plutôt que de transmettre un
 * scope vide à un traitement à coût (OCR) ou à Prisma.
 */
export function getActiveTenantId(request: FastifyRequest): string {
  const tenantId = request.tenantId
  if (!tenantId) {
    const route = `${request.method} ${request.routeOptions?.url ?? 'route inconnue'}`
    console.error(`[tenant-context] TENANT_CONTEXT_MISSING (active) — ${route}`)
    throw new TenantContextMissingError(route)
  }
  return tenantId
}
