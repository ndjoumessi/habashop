export async function authenticateAdmin(request: any, reply: any): Promise<void> {
  try {
    await request.jwtVerify()
    if ((request.user).role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Accès refusé — SUPER_ADMIN requis' })
    }
  } catch {
    reply.code(401).send({ error: 'Non autorisé' })
  }
}
