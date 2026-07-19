import { describe, it, expect } from 'vitest'
import { canAccess, getLandingForRole, landingFor } from '@/stores/authStore'

// ⚠️ PREUVE anti-régression de la coquille opérateur (#étape 1).
// Le dépouillement de l'interface opérateur se fait sur `isPlatformAdmin`, JAMAIS sur le
// rôle. Ce test verrouille le fait qu'un ADMIN COMMERÇANT garde ses accès — c'est la
// régression facile à introduire (masquer par rôle) et invisible jusqu'à la plainte client.
describe('coquille opérateur — aucune régression du rôle ADMIN commerçant', () => {
  it('un ADMIN commerçant conserve api-docs, intégrations et utilisateurs', () => {
    for (const slug of ['api-docs', 'integrations', 'users']) {
      expect(canAccess('ADMIN', slug)).toBe(true)
      expect(canAccess('SUPER_ADMIN', slug)).toBe(true)
    }
  })

  it('landingFor : le critère isPlatformAdmin prime EN PARALLÈLE du rôle, sans le remplacer', () => {
    // Opérateur SaaS → console, quel que soit son rôle tenant.
    expect(landingFor({ role: 'ADMIN', isPlatformAdmin: true })).toBe('/admin')
    expect(landingFor({ role: 'CASHIER', isPlatformAdmin: true })).toBe('/admin')
    // Commerçant (pas opérateur) → app commerçant, logique de rôle INTACTE.
    expect(landingFor({ role: 'ADMIN', isPlatformAdmin: false })).toBe('/app/dashboard')
    expect(landingFor({ role: 'CASHIER', isPlatformAdmin: false })).toBe('/app/pos')
    expect(landingFor({ role: 'ADMIN' })).toBe('/app/dashboard') // flag absent = commerçant
  })

  it('getLandingForRole (basé rôle) reste INCHANGÉ', () => {
    expect(getLandingForRole('ADMIN')).toBe('/app/dashboard')
    expect(getLandingForRole('CASHIER')).toBe('/app/pos')
  })
})
