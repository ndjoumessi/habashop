/**
 * RACCOURCI DE CONNEXION DÉMO — derrière un drapeau, comme sur le web.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `app/(auth)/login.tsx` portait `DEMO_PASSWORD = 'demo1234'` et cinq boutons de
 * connexion **sans aucune condition** : ils partaient dans CHAQUE build, y compris
 * celui du store. Le web, lui, gate le même raccourci depuis longtemps derrière
 * `VITE_DEMO_MODE`, et `verify:demo-flag` inspecte le `dist/` livré pour le prouver.
 *
 * L'asymétrie n'était écrite nulle part : `CLAUDE.md` affirmait que le raccourci
 * démo est gaté, sans préciser que cela ne valait que pour le web. *Une règle qui
 * décrit une plateforme et se lit comme une règle générale est une règle fausse.*
 *
 * ⚠️ CE N'EST PAS LA SÉCURITÉ, et il ne faut pas le lire comme tel. Le mot de passe
 * démo est PUBLIC (dépôt public, README, SETUP.md), et ce sont les tenants `isDemo`
 * qui bornent le coût côté SERVEUR (403 sur toute dépense externe). Ce drapeau
 * empêche seulement qu'un commerçant réel voie des boutons de connexion démo.
 *
 * ⚠️ DÉFAUT = ÉTEINT. Variable absente ⇒ `undefined === '1'` ⇒ `false`. Un défaut
 * allumé serait exactement le défaut qu'on corrige.
 */

/**
 * ⚠️ LA VARIABLE DOIT APPARAÎTRE EN TOUTES LETTRES.
 *
 * Expo inline les `EXPO_PUBLIC_*` **textuellement** au bundling : c'est une
 * substitution de chaîne, pas une lecture d'environnement à l'exécution. Un accès
 * calculé (`process.env[clef]`) ne serait jamais remplacé, et rendrait `undefined`
 * dans tous les builds — un drapeau qui ne peut pas s'allumer.
 */
export const DEMO_MODE: boolean = process.env.EXPO_PUBLIC_DEMO_MODE === '1'

/**
 * ⚠️ Séparé de `DEMO_MODE` pour rester TESTABLE. `DEMO_MODE` dépend de ce que babel
 * a inliné au bundling ; `resolveDemoMode` prend sa valeur en argument, donc un test
 * peut exercer la règle sans dépendre de l'environnement de build. Même découpage
 * que `normalizeAppUrl(raw)` / `appUrl()` dans `src/lib/appUrl.ts`.
 */
export function resolveDemoMode(raw: unknown): boolean {
  return raw === '1'
}

/** Mot de passe commun des comptes démo seedés. PUBLIC — cf. l'avertissement ci-dessus. */
export const DEMO_PASSWORD = 'demo1234'

/** Les 5 comptes démo de `demo-tenant-001`, seedés côté backend. */
export const DEMO_ACCOUNTS = [
  { label: 'Admin',     email: 'admin@habashop.com' },
  { label: 'Manager',   email: 'manager@habashop.com' },
  { label: 'Caissier',  email: 'cashier@habashop.com' },
  { label: 'Comptable', email: 'accountant@habashop.com' },
  { label: 'RH',        email: 'hr@habashop.com' },
] as const
