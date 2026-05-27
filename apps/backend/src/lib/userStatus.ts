import { prisma } from '../db'
import { redis } from '../redis'

/**
 * Statut "léger" d'un user (deletedAt / isActive) pour le durcissement auth.
 * Caché ~30s dans Redis (si dispo) ; à défaut, check DB direct à chaque appel.
 * Un compte supprimé est donc rejeté au pire 30s après suppression — sauf
 * invalidation explicite (cf. `invalidateUserStatus`), qui rend l'effet immédiat.
 */

const KEY = (id: string) => `user:status:${id}`
const TTL_SECONDS = 30

/** true si le user existe, n'est pas supprimé (deletedAt null) et est actif. */
export async function isUserActive(userId: string): Promise<boolean> {
  try {
    if (redis) {
      try {
        const cached = await redis.get(KEY(userId))
        if (cached !== null) return cached === '1'
      } catch {
        /* Redis indisponible → on retombe sur la DB */
      }
    }
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, isActive: true },
    })
    const ok = !!u && u.deletedAt === null && u.isActive === true
    if (redis) {
      try { await redis.setex(KEY(userId), TTL_SECONDS, ok ? '1' : '0') } catch { /* non bloquant */ }
    }
    return ok
  } catch {
    // Fail-open : le durcissement ne doit JAMAIS casser l'auth sur un incident DB.
    return true
  }
}

/** Invalide le cache de statut (après suppression) → propagation immédiate du rejet. */
export async function invalidateUserStatus(userIds: string[]): Promise<void> {
  if (!redis || userIds.length === 0) return
  try { await redis.del(...userIds.map(KEY)) } catch { /* non bloquant */ }
}
