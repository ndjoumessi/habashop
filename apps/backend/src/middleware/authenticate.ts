import { isUserActive } from '../lib/userStatus'

/**
 * Middleware d'authentification JWT.
 * Vérifie le token, injecte `request.tenantId`, puis (durcissement) rejette les
 * comptes supprimés/désactivés via un check léger caché ~30s (cf. `isUserActive`) :
 * un JWT stateless reste sinon valide 7 j après suppression du compte.
 * @throws 401 si token absent/invalide/expiré, ou si le compte est supprimé/inactif.
 */
export async function authenticate(request, reply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    return reply.code(401).send({ error: 'Non autorisé' })
  }
  request.tenantId = (request.user)?.tenantId

  if (!(await isUserActive((request.user)?.userId))) {
    return reply.code(401).send({ error: 'Compte introuvable' })
  }
}
