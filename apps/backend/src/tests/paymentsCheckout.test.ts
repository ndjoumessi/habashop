import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

// Valide UNIQUEMENT la couche de validation zod des checkouts (body {plan, period}).
// Les services externes sont mockés : un body invalide est rejeté AVANT tout appel.
vi.mock('../db', () => ({ prisma: { planRequest: { create: vi.fn() } } }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn((req: any, _reply: any, done: () => void) => {
    req.user = { userId: 'u1', tenantId: 't1', role: 'ADMIN' }; req.tenantId = 't1'; done()
  }),
}))
vi.mock('../services/wave', () => ({ createWaveCheckout: vi.fn(), verifyWaveWebhook: vi.fn() }))
vi.mock('../services/orangeMoney', () => ({ createOMPayment: vi.fn(), verifyOrangeWebhook: vi.fn() }))
vi.mock('../services/email', () => ({ sendUpgradeConfirmation: vi.fn() }))

import { paymentRoutes } from '../routes/payments'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  // Reproduit le formatage des erreurs zod de server.ts (→ { error, code:'VALIDATION' }).
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const first = error.validation?.[0]
      const path = first?.params?.issue?.path?.join('.') || first?.instancePath || ''
      const msg = first?.params?.issue?.message || first?.message || 'Requête invalide'
      return reply.code(400).send({ error: path ? `${path}: ${msg}` : msg, code: 'VALIDATION' })
    }
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(paymentRoutes)
  await app.ready()
  return app
}

describe('POST /api/payments/{wave,orange}/checkout — validation body', () => {
  for (const provider of ['wave', 'orange']) {
    it(`${provider} : body vide → 400 VALIDATION`, async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'POST', url: `/api/payments/${provider}/checkout`, payload: {} })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('VALIDATION')
    })

    it(`${provider} : plan présent mais inconnu → 400 (garde sémantique du handler)`, async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'POST', url: `/api/payments/${provider}/checkout`, payload: { plan: 'inconnu', period: 'monthly' } })
      // Le schéma laisse passer (strings non vides) ; le handler rejette via PRICES.
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toMatch(/Plan invalide/)
    })
  }
})
