import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { isUserActive } from '../lib/userStatus'
import { decideWsAuth } from '../lib/wsAuth'

// Sockets actifs regroupés par tenant : un broadcast ne touche que la boutique concernée.
const tenantSockets = new Map<string, Set<any>>()

export function notifyTenant(tenantId: string, event: { type: string; data?: any }): void {
  const set = tenantSockets.get(tenantId)
  if (!set || set.size === 0) return
  const msg = JSON.stringify(event)
  for (const sock of set) {
    try { sock.send(msg) } catch { /* socket fermé */ }
  }
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // Enregistre / met à jour le token push Expo d'un appareil (app mobile).
  app.post('/api/notifications/token', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId, userId } = request.user
    const { token, platform, deviceId } = request.body as { token?: string; platform?: string; deviceId?: string }
    if (!token?.trim()) return reply.code(400).send({ error: 'Token requis' })
    const saved = await prisma.pushToken.upsert({
      where: { token },
      create: { token, platform: platform ?? 'unknown', deviceId: deviceId ?? null, tenantId, userId },
      update: { tenantId, userId, platform: platform ?? 'unknown', deviceId: deviceId ?? null },
    })
    return { success: true, id: saved.id }
  })

  // Désenregistre le token push de cet appareil (appelé au logout mobile).
  app.delete('/api/notifications/token', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user
    const { token } = request.body as { token?: string }
    if (!token?.trim()) return reply.code(400).send({ error: 'Token requis' })
    await prisma.pushToken.deleteMany({ where: { token, userId } })
    return { success: true }
  })

  // @fastify/websocket v11 (Fastify 5) : le handler reçoit directement la
  // WebSocket en 1er argument (avant : un SocketStream avec `.socket`).
  app.get('/api/ws', { websocket: true }, async (socket: any, req: any) => {
    const sock = socket
    const closeUnauthorized = (message: string) => {
      try { sock.send(JSON.stringify({ type: 'error', data: { message } })) } catch {}
      sock.close(1008, message)
    }
    // Auth : le navigateur ne peut pas poser d'en-tête sur un WebSocket → token en query.
    const token = (req.query?.token as string) || (req.headers?.authorization?.replace(/^Bearer\s+/i, ''))
    const auth = decideWsAuth(token, (t) => app.jwt.verify(t))
    if (!auth.ok) { closeUnauthorized('unauthorized'); return }
    const { tenantId, userId } = auth
    // Parité avec l'auth HTTP : un JWT reste valide 7 j après suppression/désactivation
    // du compte → on rejette les comptes inactifs ici aussi (check caché ~30s).
    if (!(await isUserActive(userId))) { closeUnauthorized('account-inactive'); return }
    if (!tenantSockets.has(tenantId)) tenantSockets.set(tenantId, new Set())
    tenantSockets.get(tenantId)!.add(sock)
    try { sock.send(JSON.stringify({ type: 'connected', data: { userId, tenantId } })) } catch {}

    const ping = setInterval(() => {
      try { sock.send(JSON.stringify({ type: 'ping' })) } catch {}
    }, 30000)

    sock.on('close', () => {
      clearInterval(ping)
      const set = tenantSockets.get(tenantId)
      if (set) { set.delete(sock); if (set.size === 0) tenantSockets.delete(tenantId) }
    })
    sock.on('error', () => { try { sock.close() } catch {} })
  })
}
