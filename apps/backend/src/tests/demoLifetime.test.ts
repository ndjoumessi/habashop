import { describe, it, expect } from 'vitest'
import {
  DEMO_ID_PREFIX, DEMO_TTL_DAYS,
  demoExpiryFrom, newDemoTenantId, isEphemeralDemoId,
} from '../lib/demoLifetime'

/**
 * DURÉE DE VIE D'UNE DÉMO JETABLE.
 *
 * ⚠️ Le test qui compte est le DERNIER : les démos PERMANENTES (`demo-tenant-001/002`) et
 * `e2e-tenant` ne portent pas ce préfixe, donc le préfixe seul ne doit JAMAIS suffire à
 * décider d'une suppression. C'est `demoExpiresAt` non nul qui décide (cf. demoPurge).
 */
describe('demoLifetime', () => {
  it('l’échéance est à J+7 de l’instant fourni — jamais de `new Date()` implicite', () => {
    const t0 = new Date('2026-10-01T12:00:00.000Z')
    expect(demoExpiryFrom(t0).toISOString()).toBe('2026-10-08T12:00:00.000Z')
  })

  it('DEMO_TTL_DAYS est la SEULE source du délai', () => {
    const t0 = new Date('2026-10-01T00:00:00.000Z')
    const ecartJours = (demoExpiryFrom(t0).getTime() - t0.getTime()) / 86_400_000
    expect(ecartJours).toBe(DEMO_TTL_DAYS)
  })

  it('un identifiant neuf porte le préfixe et n’est jamais deux fois le même', () => {
    const a = newDemoTenantId()
    const b = newDemoTenantId()
    expect(a.startsWith(DEMO_ID_PREFIX)).toBe(true)
    expect(a).not.toBe(b)
  })

  it('reconnaît ses propres identifiants', () => {
    expect(isEphemeralDemoId(newDemoTenantId())).toBe(true)
  })

  it('⚠️ NE reconnaît PAS les démos permanentes ni le tenant E2E', () => {
    for (const id of ['demo-tenant-001', 'demo-tenant-002', 'e2e-tenant']) {
      expect(isEphemeralDemoId(id), `${id} ne doit pas être vu comme une démo jetable`).toBe(false)
    }
  })
})
