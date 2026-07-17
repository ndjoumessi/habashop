import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

// Vérifie le CONTRAT du rate-limit global de server.ts, sans booter tout le serveur :
// mêmes options (global:true, plafond bas ici pour tester vite) + exemption par route.
async function buildApp(max: number) {
  const app = Fastify({ bodyLimit: 4 * 1024 * 1024 })
  await app.register(rateLimit, { global: true, max, timeWindow: '1 minute' })
  app.get('/limited', async () => ({ ok: true }))                                   // soumis au global
  app.get('/webhook', { config: { rateLimit: false } }, async () => ({ ok: true })) // exempté (webhook/IPN)
  app.get('/health', { config: { rateLimit: false } }, async () => ({ ok: true }))  // exempté (monitoring)
  app.post('/echo', async (req) => ({ size: JSON.stringify(req.body).length }))       // teste bodyLimit
  await app.ready()
  return app
}

describe('Rate-limit global (contrat server.ts)', () => {
  it('une route ordinaire est plafonnée → 429 au-delà du max', async () => {
    const app = await buildApp(3)
    const codes: number[] = []
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({ method: 'GET', url: '/limited', remoteAddress: '10.0.0.1' })
      codes.push(r.statusCode)
    }
    expect(codes.slice(0, 3)).toEqual([200, 200, 200])
    expect(codes.slice(3)).toEqual([429, 429]) // au-delà du plafond → rejet
  })

  it('les routes exemptées (webhook, health) ne sont JAMAIS plafonnées', async () => {
    const app = await buildApp(2)
    for (let i = 0; i < 10; i++) {
      const w = await app.inject({ method: 'GET', url: '/webhook', remoteAddress: '10.0.0.2' })
      const h = await app.inject({ method: 'GET', url: '/health',  remoteAddress: '10.0.0.2' })
      expect(w.statusCode).toBe(200)
      expect(h.statusCode).toBe(200)
    }
  })
})

describe('bodyLimit (4 Mo)', () => {
  it('accepte un corps JSON ~2,7 Mo (photo employé base64) et rejette >4 Mo (413)', async () => {
    const app = await buildApp(1000)
    // ~2,7 Mo : équivalent d'une photo 2 Mo encodée base64 → doit passer.
    const ok = await app.inject({
      method: 'POST', url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ photo: 'x'.repeat(2.7 * 1024 * 1024) }),
    })
    expect(ok.statusCode).toBe(200)
    // >4 Mo : dépasse la borne → 413.
    const tooBig = await app.inject({
      method: 'POST', url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ photo: 'x'.repeat(4.2 * 1024 * 1024) }),
    })
    expect(tooBig.statusCode).toBe(413)
  })
})
