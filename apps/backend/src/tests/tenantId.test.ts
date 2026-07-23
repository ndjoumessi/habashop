import { describe, it, expect, vi, afterEach } from 'vitest'
import type { FastifyRequest } from 'fastify'
import { getTenantId, TenantContextMissingError } from '../lib/tenantId'

// Fabrique une requête minimale : seuls `user`, `method` et `routeOptions` sont lus.
function req(tenantId: string | null | undefined, route = '/api/sales'): FastifyRequest {
  return {
    user: tenantId === undefined ? undefined : { tenantId },
    method: 'GET',
    routeOptions: { url: route },
  } as unknown as FastifyRequest
}

describe('getTenantId', () => {
  afterEach(() => vi.restoreAllMocks())

  // ── Sens 1 : le cas nominal PASSE ──
  it('renvoie le tenantId quand il est présent', () => {
    expect(getTenantId(req('tenant-abc'))).toBe('tenant-abc')
  })

  it('renvoie un `string` (le rétrécissement est réel, pas un cast)', () => {
    const id: string = getTenantId(req('tenant-abc'))
    expect(typeof id).toBe('string')
  })

  // ── Sens 2 : la branche de défense en profondeur LÈVE bien ──
  // Sans ces cas, la doc affirmerait une propriété de sûreté que rien n'exerce.
  it.each([
    ['null (aucune boutique active)', null],
    ['undefined (champ absent du JWT)', undefined],
  ])('lève TENANT_CONTEXT_MISSING quand tenantId vaut %s', (_label, value) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => getTenantId(req(value))).toThrow(TenantContextMissingError)
    try {
      getTenantId(req(value))
    } catch (e) {
      expect((e as TenantContextMissingError).code).toBe('TENANT_CONTEXT_MISSING')
      expect((e as TenantContextMissingError).statusCode).toBe(500)
    }
  })

  it('lève aussi quand `request.user` est absent (route montée sans le garde)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => getTenantId(req(undefined))).toThrow(TenantContextMissingError)
  })

  it('ne renvoie JAMAIS une chaîne vide (elle passerait un `where` non scopé)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => getTenantId(req(''))).toThrow(TenantContextMissingError)
  })

  // ── Journalisation : tracée, mais sans PII ──
  it('journalise la route seule, jamais l’URL complète ni de données utilisateur', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => getTenantId(req(null, '/api/sales/:id/invoice'))).toThrow()
    const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('TENANT_CONTEXT_MISSING')
    expect(logged).toContain('/api/sales/:id/invoice')
    expect(logged).not.toMatch(/\?|token|Bearer/)
  })
})
