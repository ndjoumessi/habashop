import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { integrationStates } from '../lib/integrationStatus'

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
}
