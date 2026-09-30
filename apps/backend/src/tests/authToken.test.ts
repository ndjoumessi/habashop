import { describe, it, expect, vi } from 'vitest'
import { signActiveToken, signNoTenantToken, TOKEN_TTL } from '../lib/authToken'

/**
 * FORME DU PAYLOAD JWT — source unique.
 * `signActive` vivait en closure dans `authRoutes` : la route démo aurait dû recopier la
 * forme. Ce verrou juge la FORME du payload, pas l'identifiant de la fonction.
 */
/**
 * ⚠️ Les paramètres du mock sont TYPÉS explicitement. Un `vi.fn(() => 'JETON')` sans
 * paramètres donne un `mock.calls` de type tuple VIDE : `calls[0][0]` ne compile pas sous
 * le `strict: true` du dépôt, alors que vitest, lui, passerait au vert — on aurait livré un
 * test vert et une CI rouge.
 */
function fauxApp() {
  const sign = vi.fn((_payload: Record<string, unknown>, _opts: Record<string, unknown>) => 'JETON')
  return { app: { jwt: { sign } }, sign }
}

describe('authToken', () => {
  it('jeton avec boutique active : tenantId ET activeTenantId portent la même valeur', () => {
    const { app, sign } = fauxApp()
    expect(signActiveToken(app, { userId: 'u1', role: 'ADMIN', tenantId: 'T1' })).toBe('JETON')
    expect(sign).toHaveBeenCalledWith(
      { userId: 'u1', role: 'ADMIN', tenantId: 'T1', activeTenantId: 'T1', isPlatformAdmin: false },
      { expiresIn: TOKEN_TTL },
    )
  })

  it('jeton sans boutique : tenantId ET activeTenantId sont null, pas absents', () => {
    const { app, sign } = fauxApp()
    signNoTenantToken(app, { userId: 'u1', role: 'CASHIER' })
    const payload = sign.mock.calls[0][0]
    expect(payload).toHaveProperty('tenantId', null)
    expect(payload).toHaveProperty('activeTenantId', null)
  })

  it('isPlatformAdmin est TOUJOURS présent — jamais laissé undefined', () => {
    const { app, sign } = fauxApp()
    signActiveToken(app, { userId: 'u1', role: 'ADMIN', tenantId: 'T1' })
    expect(Object.keys(sign.mock.calls[0][0])).toContain('isPlatformAdmin')
  })

  it('les DEUX signatures partagent le même TTL — une divergence se verrait ici', () => {
    const { app, sign } = fauxApp()
    signActiveToken(app, { userId: 'u', role: 'ADMIN', tenantId: 'T' })
    signNoTenantToken(app, { userId: 'u', role: 'ADMIN' })
    expect(sign.mock.calls[0][1]).toEqual(sign.mock.calls[1][1])
  })
})
