import { prisma } from '../db'
import { redis } from '../redis'

/**
 * Garde SERVEUR des boutiques de démonstration (`Tenant.isDemo`).
 *
 * Les comptes démo sont partagés et leur mot de passe est PUBLIC (dépôt public,
 * bundle JS, README). Retirer le bouton « connexion par rôle » du front réduit la
 * surface mais ne protège RIEN : un `curl` sur /api/auth/login suffit à obtenir un
 * JWT MANAGER/ADMIN valide. La seule protection qui résiste, c'est ce refus côté
 * serveur sur les actions qui coûtent de l'argent (Anthropic, Twilio, Resend) ou
 * qui détruisent des données (suppression de compte/boutique).
 *
 * ⚠️ FAIL-CLOSED : si le statut du tenant est indéterminable (DB/Redis KO), on
 * refuse. Le coût est nul en pratique — les routes gardées ont toutes besoin de la
 * DB pour fonctionner, elles échoueraient de toute façon — alors qu'un fail-open
 * rouvrirait le trou pendant l'incident. Même convention que les webhooks paiement
 * et le gate admin plateforme.
 */

const KEY = (id: string) => `tenant:isDemo:${id}`
const TTL_SECONDS = 60

/** Code renvoyé au client — explicite, jamais un échec obscur. */
export const DEMO_TENANT_FORBIDDEN = 'DEMO_TENANT_FORBIDDEN'

/** true si la boutique est une démo (ou si son statut est indéterminable → fail-closed). */
export async function isDemoTenant(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return true // pas de boutique active → rien à autoriser ici
  try {
    if (redis) {
      try {
        const cached = await redis.get(KEY(tenantId))
        if (cached !== null) return cached === '1'
      } catch {
        /* Redis indisponible → on retombe sur la DB */
      }
    }
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isDemo: true },
    })
    // Tenant introuvable → on refuse (fail-closed) plutôt que d'ouvrir par défaut.
    const demo = t ? t.isDemo === true : true
    if (redis) {
      try { await redis.setex(KEY(tenantId), TTL_SECONDS, demo ? '1' : '0') } catch { /* non bloquant */ }
    }
    return demo
  } catch {
    return true // fail-closed
  }
}

/** Invalide le cache (après bascule du flag) → propagation immédiate. */
export async function invalidateDemoTenant(tenantIds: string[]): Promise<void> {
  if (!redis || tenantIds.length === 0) return
  try { await redis.del(...tenantIds.map(KEY)) } catch { /* non bloquant */ }
}

/**
 * preHandler à poser APRÈS `authenticate` (il lit `request.tenantId`).
 * Refuse l'action sur une boutique de démonstration : 403 + code explicite.
 */
export async function blockDemoTenant(request: any, reply: any): Promise<void> {
  if (await isDemoTenant(request.tenantId)) {
    return reply.code(403).send({
      error: 'Action indisponible sur une boutique de démonstration',
      code: DEMO_TENANT_FORBIDDEN,
    })
  }
}
