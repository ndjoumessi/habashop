/**
 * Middleware d'authentification JWT.
 * Vérifie le token et injecte `request.tenantId` depuis le payload signé.
 * @throws 401 si le token est absent, invalide ou expiré.
 */
export async function authenticate(request: any, reply: any): Promise<void> {
  try {
    await request.jwtVerify()
    request.tenantId = (request.user)?.tenantId
  } catch {
    reply.code(401).send({ error: 'Non autorisé' })
  }
}
