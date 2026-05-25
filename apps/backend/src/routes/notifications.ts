import type { FastifyInstance } from 'fastify'

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
  app.get('/api/ws', { websocket: true }, (connection: any, req: any) => {
    const sock = connection.socket
    // Auth : le navigateur ne peut pas poser d'en-tête sur un WebSocket → token en query.
    const token = (req.query?.token as string) || (req.headers?.authorization?.replace(/^Bearer\s+/i, ''))
    let payload: any
    try {
      payload = app.jwt.verify(token)
    } catch {
      try { sock.send(JSON.stringify({ type: 'error', data: { message: 'unauthorized' } })) } catch {}
      sock.close(1008, 'unauthorized')
      return
    }
    const { tenantId, userId } = payload as any
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
