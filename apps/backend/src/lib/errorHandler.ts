import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import * as Sentry from '@sentry/node'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * Handler d'erreur global — extrait de server.ts pour être testable.
 *
 * ⚠️ DURCISSEMENT (audit P1.6) : un 500 ne renvoie plus `error.message` BRUT au client.
 * Le message d'une erreur inattendue (Prisma, DB, exception non gérée) peut divulguer des
 * détails internes (SQL, chemins, parfois des bribes de configuration) → sur les ≥500 on
 * renvoie un message GÉNÉRIQUE, tout en journalisant le vrai côté serveur (log + Sentry).
 *
 * Les 4xx INTENTIONNELS gardent leur message : erreurs de validation zod (message métier
 * utile), P2025 → 404, et les erreurs framework (413/415/429…) dont le message est sûr.
 */
// `error: any` — Fastify passe une erreur non typée (statusCode/code optionnels).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  // Validation zod → 400 au format maison { error, code:'VALIDATION' }.
  if (hasZodFastifySchemaValidationErrors(error)) {
    const first = error.validation?.[0]
    const path = first?.params?.issue?.path?.join('.') || first?.instancePath || ''
    const msg = first?.params?.issue?.message || first?.message || 'Requête invalide'
    return reply.code(400).send({ error: path ? `${path}: ${msg}` : msg, code: 'VALIDATION' })
  }
  // Prisma "record not found" (update/delete scopé tenant → 404, pas 500).
  if (error?.code === 'P2025') {
    return reply.code(404).send({ error: 'Ressource introuvable' })
  }

  const status = error?.statusCode ?? 500
  request.log.error(error) // le vrai message reste journalisé côté serveur, toujours.

  if (status >= 500) {
    Sentry.captureException(error, {
      extra: { url: request.url, method: request.method, tenantId: (request as { tenantId?: string }).tenantId },
    })
    // ⚠️ NE PAS fuiter error.message pour un 500 : message générique côté client.
    return reply.code(status).send({ error: 'Erreur serveur' })
  }

  // 4xx : message framework/intentionnel (sûr) conservé.
  return reply.code(status).send({ error: error?.message ?? 'Requête invalide' })
}
