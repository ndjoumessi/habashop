import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { authenticateAdmin } from '../middleware/superAdmin'
import { integrationStates } from '../lib/integrationStatus'
import { resendAccountStatus } from '../lib/spend/resendClient'

/**
 * GET /api/integrations/status — état RÉEL des intégrations commerçant.
 *
 * Consommé par `pages/Integrations.tsx`, qui affichait jusqu'ici un `status:'connected'`
 * écrit en dur dans le dépôt (cf. `lib/integrationStatus.ts` pour le pourquoi).
 *
 * ⚠️ Lecture seule, aucun secret ne sort : on renvoie un état à trois valeurs, jamais le
 * nom ni la valeur d'une variable d'environnement.
 */
export async function integrationStatusRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/integrations/status', { preHandler: [authenticate] }, async () => ({
    states: integrationStates(),
  }))

  /**
   * GET /api/admin/integrations/resend — état MESURÉ du compte d'expédition.
   *
   * ⚠️ PLATEFORME, PAS COMMERÇANT — `authenticateAdmin`, donc `isPlatformAdmin`, et
   * JAMAIS le rôle `SUPER_ADMIN` (rôle INTERNE au tenant : y gater serait la fuite
   * inter-tenants déjà corrigée, cf. `adminPlatformIsolation.test.ts`).
   *
   * Le choix du public est le cœur de cette route, pas un détail d'autorisation. Le
   * compte Resend appartient à HabaShop, pas au commerçant : son quota, ses domaines et
   * sa réputation d'expédition sont de la STACK. C'est exactement la raison pour
   * laquelle `OPS_CATS` est exclu de la page commerçant — « aucun intérêt commerçant, et
   * ça publierait la stack à tous les clients ». Le panneau supprimé enfreignait cette
   * règle en plus d'inventer ses chiffres : il affichait le quota mensuel de la
   * PLATEFORME sur un écran de boutique.
   *
   * ⚠️ Aucun secret ne sort — ni la clé, ni le nom d'une variable d'environnement. On
   * renvoie des noms de domaine (publics par nature, lisibles dans tout en-tête reçu) et
   * un état de vérification. Et AUCUNE adresse de destinataire : cf. l'en-tête de
   * `resendAccountStatus`, on ne relaie pas `emails.list`.
   */
  app.get('/api/admin/integrations/resend', { preHandler: authenticateAdmin }, async () =>
    resendAccountStatus(),
  )
}
