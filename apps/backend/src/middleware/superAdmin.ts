import type { FastifyRequest, FastifyReply } from 'fastify'

// Gate PLATEFORME (super-admin SaaS) pour /api/admin/* et les crons WhatsApp de test.
// ⚠️ Gate sur isPlatformAdmin (propriété per-user signée serveur), JAMAIS sur le rôle
// tenant : SUPER_ADMIN est un rôle INTERNE au tenant (suppression tenant, notifs) et
// gater dessus laissait tout propriétaire de boutique lire les données de TOUS les tenants.
// Absent des anciens JWT → undefined → 403 (fail-closed). Les admins plateforme doivent
// se reconnecter après ce déploiement pour obtenir le claim.
export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
    if ((request.user).isPlatformAdmin !== true) {
      return reply.code(403).send({ error: 'Accès refusé — administrateur plateforme requis' })
    }
  } catch {
    reply.code(401).send({ error: 'Non autorisé' })
  }
}
