import { describe, it, expect, vi, beforeEach } from 'vitest'

// ⚠️ DURCISSEMENT audit P1.6 : un 500 ne renvoie plus error.message BRUT au client
// (fuite d'infos internes Prisma/DB). Les 4xx intentionnels gardent leur message.

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }))

import { errorHandler } from '../lib/errorHandler'
import * as Sentry from '@sentry/node'

function fakeReplyRequest() {
  const captured: { code?: number; body?: unknown } = {}
  const reply = {
    code(c: number) { captured.code = c; return reply },
    send(b: unknown) { captured.body = b; return reply },
  }
  const request = { url: '/x', method: 'POST', log: { error: vi.fn() }, tenantId: 'T' }
  return { captured, reply, request }
}

beforeEach(() => vi.clearAllMocks())

describe('errorHandler — un 500 ne fuite jamais error.message', () => {
  it('erreur 500 avec message sensible → « Erreur serveur » générique (message MASQUÉ)', () => {
    const { captured, reply, request } = fakeReplyRequest()
    const err = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432 — password=hunter2'), { statusCode: 500 })
    errorHandler(err, request as never, reply as never)
    expect(captured.code).toBe(500)
    expect(captured.body).toEqual({ error: 'Erreur serveur' })
    expect(JSON.stringify(captured.body)).not.toContain('hunter2')
    expect(JSON.stringify(captured.body)).not.toContain('ECONNREFUSED')
  })

  it('erreur SANS statusCode (défaut 500) → générique aussi', () => {
    const { captured, reply, request } = fakeReplyRequest()
    errorHandler(new Error('Prisma: Unique constraint failed on the fields: (`x`)'), request as never, reply as never)
    expect(captured.code).toBe(500)
    expect(captured.body).toEqual({ error: 'Erreur serveur' })
  })

  it('un 500 est capturé par Sentry (le vrai message reste tracé côté serveur)', () => {
    const { reply, request } = fakeReplyRequest()
    const err = Object.assign(new Error('boom interne'), { statusCode: 500 })
    errorHandler(err, request as never, reply as never)
    expect(Sentry.captureException).toHaveBeenCalledWith(err, expect.anything())
    expect(request.log.error).toHaveBeenCalledWith(err)
  })

  it('erreur 4xx INTENTIONNELLE (413) → message framework conservé', () => {
    const { captured, reply, request } = fakeReplyRequest()
    const err = Object.assign(new Error('Request body is too large'), { statusCode: 413 })
    errorHandler(err, request as never, reply as never)
    expect(captured.code).toBe(413)
    expect(captured.body).toEqual({ error: 'Request body is too large' })
    expect(Sentry.captureException).not.toHaveBeenCalled() // pas un 500
  })

  it('Prisma P2025 → 404 « Ressource introuvable » (comportement préservé)', () => {
    const { captured, reply, request } = fakeReplyRequest()
    errorHandler(Object.assign(new Error('x'), { code: 'P2025' }), request as never, reply as never)
    expect(captured.code).toBe(404)
    expect(captured.body).toEqual({ error: 'Ressource introuvable' })
  })
})
