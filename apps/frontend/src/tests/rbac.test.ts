import { describe, it, expect } from 'vitest'
import { canAccess, getLandingForRole } from '@/stores/authStore'

// RBAC slug-based — sécurité (route guard). Pages omises = refusées.
describe('canAccess', () => {
  it('ADMIN / SUPER_ADMIN → accès total (*)', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      for (const slug of ['dashboard', 'users', 'pos', 'settings', 'nimporte']) {
        expect(canAccess(role, slug)).toBe(true)
      }
    }
  })

  it('MANAGER : large mais PAS users', () => {
    expect(canAccess('MANAGER', 'hr')).toBe(true)
    expect(canAccess('MANAGER', 'reports')).toBe(true)
    expect(canAccess('MANAGER', 'users')).toBe(false)  // gestion users = admin only
  })

  it('CASHIER : POS/stock/clients seulement', () => {
    expect(canAccess('CASHIER', 'pos')).toBe(true)
    expect(canAccess('CASHIER', 'stock')).toBe(true)
    expect(canAccess('CASHIER', 'reports')).toBe(false)
    expect(canAccess('CASHIER', 'hr')).toBe(false)
  })

  it('ACCOUNTANT : finance, pas le POS', () => {
    expect(canAccess('ACCOUNTANT', 'reports')).toBe(true)
    expect(canAccess('ACCOUNTANT', 'payroll')).toBe(true)
    expect(canAccess('ACCOUNTANT', 'pos')).toBe(false)
  })

  it('HR : RH/planning/paie, pas le POS', () => {
    expect(canAccess('HR', 'hr')).toBe(true)
    expect(canAccess('HR', 'payroll')).toBe(true)
    expect(canAccess('HR', 'pos')).toBe(false)
  })

  it('insensible à la casse du rôle', () => {
    expect(canAccess('admin', 'users')).toBe(true)
    expect(canAccess('cashier', 'pos')).toBe(true)
    expect(canAccess('cashier', 'reports')).toBe(false)
  })

  it('rôle absent / inconnu → refusé', () => {
    expect(canAccess(null, 'dashboard')).toBe(false)
    expect(canAccess(undefined, 'dashboard')).toBe(false)
    expect(canAccess('GHOST' as any, 'dashboard')).toBe(false)
  })
})

describe('getLandingForRole', () => {
  it('redirige vers la 1re page autorisée du rôle', () => {
    expect(getLandingForRole('CASHIER')).toBe('/app/pos')
    expect(getLandingForRole('ACCOUNTANT')).toBe('/app/reports')
    expect(getLandingForRole('HR')).toBe('/app/hr')
    expect(getLandingForRole('ADMIN')).toBe('/app/dashboard')
    expect(getLandingForRole('MANAGER')).toBe('/app/dashboard')
  })
  it('sans rôle → /login', () => {
    expect(getLandingForRole(null)).toBe('/login')
    expect(getLandingForRole(undefined)).toBe('/login')
  })
})
