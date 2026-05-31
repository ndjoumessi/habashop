import { describe, it, expect } from 'vitest'
import { ROLE_PERMISSIONS, canAccess, getLandingForRole } from '@/stores/authStore'

// Permissions par rôle — complète rbac.test.ts (qui couvre les cas par rôle) avec la
// MATRICE complète + la prévention d'escalade. Validations de champs (email, requis) vivent
// dans le composant ValidatedInput (non pur) ; statuts/soft-delete + isolation tenant sont
// gérés côté BACKEND (middleware/Prisma) → non testables en logique pure ici. Voir RAPPORT.

const NON_ADMIN_ROLES = ['MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR'] as const
const PRIVILEGED_SLUG = 'users' // gestion des comptes = admin-only (escalade interdite)

describe('ROLE_PERMISSIONS — intégrité de la matrice', () => {
  it("seuls ADMIN et SUPER_ADMIN ont l'accès total '*'", () => {
    expect(ROLE_PERMISSIONS.ADMIN).toBe('*')
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toBe('*')
    for (const r of NON_ADMIN_ROLES) {
      expect(Array.isArray(ROLE_PERMISSIONS[r])).toBe(true)
      expect(ROLE_PERMISSIONS[r]).not.toBe('*')
    }
  })
  it('aucun rôle non-admin ne liste le slug privilégié "users"', () => {
    for (const r of NON_ADMIN_ROLES) {
      expect((ROLE_PERMISSIONS[r] as readonly string[]).includes(PRIVILEGED_SLUG)).toBe(false)
    }
  })
})

describe('canAccess — prévention d\'escalade (slug "users" = admin-only)', () => {
  it('ADMIN / SUPER_ADMIN accèdent à users', () => {
    expect(canAccess('ADMIN', PRIVILEGED_SLUG)).toBe(true)
    expect(canAccess('SUPER_ADMIN', PRIVILEGED_SLUG)).toBe(true)
  })
  it('AUCUN rôle non-admin ne peut accéder à users (escalade bloquée)', () => {
    for (const r of NON_ADMIN_ROLES) expect(canAccess(r, PRIVILEGED_SLUG)).toBe(false)
  })
  it('settings & activity réservés (cashier/comptable n\'y accèdent pas selon la matrice)', () => {
    expect(canAccess('CASHIER', 'settings')).toBe(false)
    expect(canAccess('CASHIER', 'payroll')).toBe(false)   // pas de finance pour la caisse
    expect(canAccess('ACCOUNTANT', 'pos')).toBe(false)    // comptable ≠ caisse
    expect(canAccess('HR', 'pos')).toBe(false)
  })
})

describe('canAccess — robustesse des entrées', () => {
  it('rôle null/undefined/inconnu → toujours refusé', () => {
    expect(canAccess(undefined, 'dashboard')).toBe(false)
    expect(canAccess(null, 'dashboard')).toBe(false)
    expect(canAccess('GUEST' as any, 'dashboard')).toBe(false)
    expect(canAccess('' as any, 'dashboard')).toBe(false)
  })
  it('insensible à la casse', () => {
    expect(canAccess('cashier' as any, 'pos')).toBe(true)
    expect(canAccess('Admin' as any, 'users')).toBe(true)
  })
  it('slug inexistant → refusé même pour un rôle valide non-admin', () => {
    expect(canAccess('MANAGER', 'slug_inexistant')).toBe(false)
    // ... mais ADMIN '*' accède à n'importe quel slug
    expect(canAccess('ADMIN', 'slug_inexistant')).toBe(true)
  })
})

describe('getLandingForRole — landing cohérente avec le 1er accès du rôle', () => {
  it('chaque rôle atterrit sur une page qu\'il peut réellement voir', () => {
    const landings: Record<string, string> = {
      ADMIN: '/app/dashboard', SUPER_ADMIN: '/app/dashboard', MANAGER: '/app/dashboard',
      CASHIER: '/app/pos', ACCOUNTANT: '/app/reports', HR: '/app/hr',
    }
    for (const [role, path] of Object.entries(landings)) {
      expect(getLandingForRole(role as any)).toBe(path)
      const slug = path.replace('/app/', '')
      expect(canAccess(role as any, slug)).toBe(true) // cohérence landing ↔ permission
    }
  })
  it('sans rôle → /login', () => {
    expect(getLandingForRole(undefined)).toBe('/login')
    expect(getLandingForRole(null)).toBe('/login')
  })
})
