export async function authenticate(request: any, reply: any): Promise<void> {
  try {
    await request.jwtVerify()
    request.tenantId = (request.user)?.tenantId
  } catch {
    reply.code(401).send({ error: 'Non autorisé' })
  }
}
