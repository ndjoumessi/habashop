import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { blockDemoTenant } from '../middleware/demoTenant'
import { deleteAccount, AccountDeletionError } from '../services/accountDeletion'

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.delete('/api/account/me', {
    preHandler: [authenticate, blockDemoTenant],
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour', // 3 tentatives / heure / IP (anti-bruteforce sur la suppression)
        errorResponseBuilder: (_req: any, context: any) => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(context.after / 60000)} minute(s).`,
          retryAfter: context.after,
        }),
      },
    },
  }, async (request, reply) => {
    const { userId } = request.user
    const { confirmation, password } = (request.body ?? {}) as { confirmation?: string; password?: string }

    // 1. Vérifier le mot de passe (bcrypt)
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.code(401).send({ error: 'Compte introuvable' })

    const valid = await bcrypt.compare(password ?? '', user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Mot de passe incorrect' })

    // 2. Vérifier le texte de confirmation exact
    if (confirmation !== 'SUPPRIMER') {
      return reply.code(400).send({ error: 'Confirmation invalide (taper « SUPPRIMER »)' })
    }

    // 3. Le service décide seul user vs tenant (et invalide le cache de statut).
    //    Pas de refresh token à révoquer (JWT stateless) → la déconnexion est faite côté mobile.
    try {
      const { scope } = await deleteAccount(userId)
      return reply.code(200).send({ deleted: true, scope })
    } catch (e) {
      if (e instanceof AccountDeletionError) {
        if (e.code === 'ALREADY_DELETED') return reply.code(410).send({ error: 'Compte déjà supprimé' })
        return reply.code(404).send({ error: 'Compte introuvable' }) // USER_NOT_FOUND
      }
      throw e
    }
  })

  // Activité de sécurité de SON PROPRE compte. Strictement `userId` courant :
  // aucun paramètre ne permet de viser un autre utilisateur.
  // ⚠️ L'échec REMONTE (pas de `catch → []`) : un journal de sécurité qui affiche
  // une liste vide sur erreur affirme qu'il ne s'est rien passé.
  app.get('/api/account/security-activity', { preHandler: authenticate }, async (request) => {
    const { userId } = request.user
    const events = await prisma.userAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, description: true, ip: true, severity: true, createdAt: true },
    })
    return events
  })
}
