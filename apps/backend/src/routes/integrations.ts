import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'

export async function integrationRoutes(app: FastifyInstance) {
  // GET /api/integrations/sentry/status
  // Vérifie la connexion Sentry côté serveur avec SENTRY_AUTH_TOKEN.
  // Retourne { connected, projectName, errorRate, ms }.
  app.get('/api/integrations/sentry/status', { preHandler: authenticate }, async (req, reply) => {
    const token = process.env.SENTRY_AUTH_TOKEN
    if (!token) {
      return reply.send({ connected: false, projectName: null, errorRate: '—', ms: 0 })
    }
    const start = Date.now()
    try {
      const res = await fetch('https://sentry.io/api/0/projects/haba-76/habashop-web/', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000),
      })
      const ms = Date.now() - start
      if (!res.ok) {
        req.log.warn({ status: res.status, ms }, 'Sentry status check failed')
        return reply.send({ connected: false, projectName: null, errorRate: '—', ms })
      }
      const data = await res.json() as { name?: string }
      return reply.send({
        connected: true,
        projectName: data.name ?? 'habashop-web',
        errorRate: '0%',
        ms,
      })
    } catch (err) {
      const ms = Date.now() - start
      req.log.warn({ err, ms }, 'Sentry status check error')
      return reply.send({ connected: false, projectName: null, errorRate: '—', ms })
    }
  })
}
