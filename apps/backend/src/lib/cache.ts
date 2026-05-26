import { redis } from '../redis'

/**
 * Cache helper — get or compute.
 * Non-bloquant : si Redis est absent ou en erreur, on retombe directement
 * sur le calcul (`fn`) sans jamais propager d'exception liée au cache.
 * @param key Clé Redis unique
 * @param ttl TTL en secondes
 * @param fn  Fonction async qui calcule la valeur
 */
export async function getCached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!redis) return fn()

  try {
    const cached = await redis.get(key)
    if (cached) {
      return JSON.parse(cached) as T
    }
  } catch {
    return fn()
  }

  const value = await fn()

  try {
    await redis.setex(key, ttl, JSON.stringify(value))
  } catch {
    /* cache en écriture échoué — non bloquant */
  }

  return value
}

/**
 * Invalide tous les caches analytics d'un tenant (après une mutation).
 */
export async function invalidateTenantCache(tenantId: string): Promise<void> {
  if (!redis || !tenantId) return
  try {
    const keys = await redis.keys(`analytics:${tenantId}:*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch {
    /* invalidation échouée — le TTL finira par expirer le cache */
  }
}
