import { isUserActive } from '../lib/userStatus'
import { bindActiveTenant } from '../lib/tenantContext'

// Chemins accessibles SANS boutique active (sélection multi-boutiques + dashboard consolidé).
// `request.url` peut contenir une query string → on teste le préfixe du pathname.
function allowsNoActiveTenant(url: string): boolean {
  return url.startsWith('/api/auth/') || url.startsWith('/api/dashboard/consolidated')
}

/**
 * Middleware d'authentification JWT.
 * Vérifie le token, résout la boutique active (`request.tenantId`), rejette les
 * comptes supprimés/désactivés (check léger caché ~30s, cf. `isUserActive`).
 *
 * Multi-boutiques : `activeTenantId` du JWT pilote `request.tenantId`.
 * - JWT récents : `activeTenantId` présent (null si aucune boutique sélectionnée).
 * - JWT anciens (avant multi-boutiques) : retombe sur `tenantId` (rétro-compat).
 * Si aucune boutique active → 400 sur les routes métier (les routes de sélection
 * `/api/auth/*` et le dashboard consolidé restent accessibles).
 *
 * @throws 401 token absent/invalide/expiré ou compte supprimé/inactif ; 400 si aucune boutique active.
 */
export async function authenticate(request, reply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    return reply.code(401).send({ error: 'Non autorisé' })
  }

  const u = request.user
  // Rétro-compat : anciens JWT sans champ activeTenantId → on utilise tenantId.
  const active = u && ('activeTenantId' in u) ? u.activeTenantId : u?.tenantId
  request.tenantId = active ?? null

  // Defense-in-depth (item 8) : renseigne la boutique active dans le store ALS
  // (établi par le hook onRequest) → l'extension Prisma auto-scope les modèles
  // tenant-scopés si un handler oublie `where:{ tenantId }`. `null` si aucune
  // boutique active (sélecteur multi-boutiques, dashboard consolidé) → pas d'injection.
  bindActiveTenant(request.tenantId)

  if (!(await isUserActive(u?.userId))) {
    return reply.code(401).send({ error: 'Compte introuvable' })
  }

  if (!request.tenantId && !allowsNoActiveTenant(String(request.url))) {
    return reply.code(400).send({ error: 'Sélectionnez une boutique', code: 'NO_ACTIVE_TENANT' })
  }
}
