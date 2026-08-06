import type { Prisma } from '@prisma/client'

/**
 * TENANTS DE FIXTURE — démonstration, E2E, interne plateforme.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * La console Ops annonçait « 3 boutiques inscrites, toutes ont démarré ». MESURÉ le
 * 2026-08-06, ces trois-là étaient :
 *
 *   demo-tenant-001   isDemo=true    952 ventes de démonstration
 *   demo-tenant-002   isDemo=true    893 ventes de démonstration
 *   e2e-tenant        —               63 ventes de fixture Playwright
 *
 * **Zéro client réel.** Un tableau de bord qui affiche trois quand il y a zéro est pire
 * qu'inutile : il donne un chiffre auquel on va se fier pour décider. Un qui affiche zéro
 * est utile — c'est le bon résultat.
 *
 * ─── COMMENT ON DÉCIDE ───────────────────────────────────────────────────────
 * Par PROPRIÉTÉ, jamais par une liste d'identifiants écrite à la main (on sait où ça
 * mène : la liste vieillit, le prochain tenant de test n'y figure pas, et le chiffre
 * redevient faux en silence).
 *
 *   `isPlatform` — colonne existante, tenants internes de l'éditeur
 *   `isDemo`     — colonne existante, boutiques de démonstration publiques
 *   `id` préfixé `e2e-` — CONVENTION, vérifiée par `fixtureTenant.test.ts` contre la base
 *                de production : aucun tenant réel ne doit porter ce préfixe, et le seed
 *                E2E (`scripts/seed-e2e-tenant.ts`) ne travaille que dans ce périmètre.
 *
 * ⚠️ POURQUOI PAS UN DRAPEAU `isFixture` EN BASE, qui serait plus propre : le poser sur
 * `e2e-tenant` serait une MUTATION d'un tenant existant, interdite (§ Vérification en
 * PROD). La convention d'ID est le seul moyen de décider sans écrire en base. Le jour où
 * un tenant de fixture est créé, il suffit de le nommer `e2e-…` ou de poser `isDemo`.
 */

/** Préfixe d'identifiant réservé aux tenants de test automatisé. */
export const E2E_ID_PREFIX = 'e2e-'

export interface TenantFixtureShape {
  id: string
  isDemo?: boolean | null
  isPlatform?: boolean | null
}

/** Ce tenant est-il une fixture (démo, E2E, interne) plutôt qu'un client ? */
export function isFixtureTenant(t: TenantFixtureShape): boolean {
  return !!t.isPlatform || !!t.isDemo || t.id.startsWith(E2E_ID_PREFIX)
}

/**
 * Clause Prisma sélectionnant les seuls tenants CLIENTS.
 *
 * ⚠️ Employée par TOUS les agrégats de la console : boutiques, comptes, CA, MRR. Une
 * métrique qui l'oublierait recompterait les fixtures et contredirait les autres.
 */
export const CLIENT_TENANTS_WHERE: Prisma.TenantWhereInput = {
  isPlatform: false,
  isDemo: false,
  NOT: { id: { startsWith: E2E_ID_PREFIX } },
}

/** Clause inverse — pour COMPTER les fixtures écartées et le dire à l'écran. */
export const FIXTURE_TENANTS_WHERE: Prisma.TenantWhereInput = {
  OR: [
    { isPlatform: true },
    { isDemo: true },
    { id: { startsWith: E2E_ID_PREFIX } },
  ],
}

/** Même clause, à travers une relation `tenant` (Sale, User, Product…). */
export const VIA_CLIENT_TENANT = { tenant: CLIENT_TENANTS_WHERE }
