# Démo jetable en libre-service — plan d'implémentation

> **Pour un agent exécutant :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont en cases à
> cocher (`- [ ]`).

**But** : un visiteur de la vitrine obtient en un clic sa propre boutique de démonstration
peuplée, détruite automatiquement au bout de 7 jours.

**Architecture** : une route publique `POST /api/demo/start` crée `Tenant` (`isDemo: true`,
`demoExpiresAt`) + utilisateur éphémère + jeu de données, en une transaction, et renvoie un JWT
à la forme exacte de `/api/auth/register`. Un cron quotidien supprime **durement** les tenants
dont `demoExpiresAt` est dépassé, dans un ordre de suppression **dérivé du DMMF Prisma**.

**Pile** : Fastify 5 · Prisma · zod (`fastify-type-provider-zod`) · vitest · React 18 + Zustand.

**Spec** : [`docs/handoff/2026-10-01-demo-jetable-et-guide-design.md`](2026-10-01-demo-jetable-et-guide-design.md) — le plan argumente depuis elle, lisez les deux.

## Contraintes globales

- `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` **avant toute commande** (le Node
  par défaut est v10 et casse tout).
- Toute commande composée commence par `set -euo pipefail`, tout est entre guillemets.
- `npx tsc --noEmit` **jamais pipé** (`$?` serait celui de `tail`) et **jamais depuis la racine**
  (aucun `tsconfig.json` racine) — toujours depuis le workspace concerné.
- Le backend se valide par **`npm run build --workspace=apps/backend`**, pas par `tsc --noEmit` :
  le contexte Docker est `apps/backend` SEUL. **Aucun `import` statique hors d'`apps/backend`
  depuis `src/`** — une fixture partagée se lit à l'EXÉCUTION (`readFileSync`).
- Les deux lints sont des **cliquets** : tout nouvel avertissement casse la CI. On retire
  l'avertissement qu'on a introduit ; on ne relève jamais le plafond.
- Tout verrou est vérifié **dans les deux sens** (`npm run sabotage -- <fichier>` /
  `npm run sabotage:restore`), et le sabotage est **copié** depuis le fichier de production
  (`git show HEAD:<fichier>`), jamais retapé de mémoire.
- Aucune mutation d'un tenant existant, aucun envoi réel (Twilio/Anthropic/Resend) pour
  « prouver que ça marche ».
- `console.*` interdit en commit — `logger.log/warn` côté front ; côté back, `console` est admis
  dans les services/crons existants (motif en place).

## Points de vigilance de revue

Cinq classes d'entrée que la spec implique et qu'aucune tâche n'exerçait dans ma première
rédaction. Chacune a reçu son test, dans la tâche qui détient le code.

1. **Un jeton de démo dont le tenant a été purgé** — JWT encore valide et signé, tenant
   introuvable. Attendu : retour à la vitrine, jamais un formulaire de connexion qu'un visiteur
   de démo ne peut pas remplir. ⚠️ **Vérifié en lisant `authenticate` : le backend rend déjà un
   401 propre** (`isUserActive` ne trouve plus l'utilisateur purgé) — **aucune modification
   serveur n'est nécessaire**, c'est la destination du front qui est fausse. → **T7, étapes 1 et 5**
2. **Échec en cours de transaction de création** (jeu de données partiel). Attendu : rollback
   complet, aucun tenant orphelin en base. → **T4, étape 7**
3. **Redis indisponible pendant le comptage du plafond global.** Attendu : **fail-OPEN tracé** —
   un incident Redis ne doit pas fermer la vitrine ; le plafond par IP de `@fastify/rate-limit`
   borne toujours. Même asymétrie assumée que le garde de dépense. → **T4, étape 11**
4. **Double clic sur le bouton** de la vitrine. Attendu : une seule requête ; le bouton est
   éteint **pendant la requête en vol seulement** (exemption nommée de `landingClaims`). → **T8, étape 3**
5. **Purge interrompue à mi-parcours** (timeout, redéploiement). Attendu : la passe suivante
   reprend et termine — `demoExpiresAt` reste dépassé, donc la sélection retrouve le tenant. → **T6, étape 5**

---

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `apps/backend/src/lib/authToken.ts` *(créé)* | **source unique** de la forme du payload JWT |
| `apps/backend/src/lib/demoLifetime.ts` *(créé)* | préfixe d'id, TTL, calcul d'échéance |
| `apps/backend/src/lib/demoDataset.ts` *(créé)* | le jeu de données de démonstration |
| `apps/backend/src/lib/tenantPurge.ts` *(créé)* | dérivation DMMF : ordre + clauses `where` |
| `apps/backend/src/routes/demo.ts` *(créé)* | `POST /api/demo/start` |
| `apps/backend/src/services/demoPurge.ts` *(créé)* | la passe de purge, testable hors serveur |
| `apps/backend/prisma/schema.prisma` *(modifié)* | colonne `demoExpiresAt` |
| `apps/backend/src/routes/auth.ts` *(modifié)* | consomme `authToken.ts` |
| `apps/backend/src/server.ts` *(modifié)* | enregistre la route + le cron |
| `apps/frontend/src/lib/api.ts` *(modifié)* | `demoApi.start()` |
| `apps/frontend/src/stores/authStore.ts` *(modifié)* | `adoptSession` + `startDemo` |
| `apps/frontend/src/components/landing/LandingHero.tsx` *(modifié)* | bouton secondaire |
| `apps/frontend/src/components/landing/landingShared.ts` *(modifié)* | libellés ×4 langues |
| `apps/frontend/src/components/layout/DemoBanner.tsx` *(créé)* | bandeau d'échéance |

---

### Tâche 1 : `lib/authToken.ts` — source unique de la forme du payload JWT

**Pourquoi d'abord** : `signActive` est aujourd'hui une **closure locale** dans `authRoutes`
(`auth.ts:78`). La route démo doit signer le même jeton ; recopier la forme du payload créerait
un jumeau, et un jumeau de payload d'authentification est la pire catégorie — il divergerait en
silence, et c'est `authenticate` qui paierait.

**Fichiers**
- Créer : `apps/backend/src/lib/authToken.ts`
- Modifier : `apps/backend/src/routes/auth.ts` (closures `signActive` / `signNoTenant`, l.77-82)
- Test : `apps/backend/src/tests/authToken.test.ts`

**Interfaces**
- Produit : `signActiveToken(app, { userId, role, tenantId, isPlatformAdmin? }): string` ·
  `signNoTenantToken(app, { userId, role, isPlatformAdmin? }): string` ·
  `type JwtSigner = { jwt: { sign(payload: object, opts: object): string } }`
- Consommé par : T4 (`routes/demo.ts`)

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/backend/src/tests/authToken.test.ts
import { describe, it, expect, vi } from 'vitest'
import { signActiveToken, signNoTenantToken, TOKEN_TTL } from '../lib/authToken'

/**
 * FORME DU PAYLOAD JWT — source unique.
 * `signActive` vivait en closure dans `authRoutes` : la route démo aurait dû recopier la
 * forme. Ce verrou juge la FORME du payload, pas l'identifiant de la fonction.
 */
function fauxApp() {
  const sign = vi.fn(() => 'JETON')
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
    const payload = sign.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toHaveProperty('tenantId', null)
    expect(payload).toHaveProperty('activeTenantId', null)
  })

  it('isPlatformAdmin est TOUJOURS présent — jamais laissé undefined', () => {
    const { app, sign } = fauxApp()
    signActiveToken(app, { userId: 'u1', role: 'ADMIN', tenantId: 'T1' })
    expect(Object.keys(sign.mock.calls[0][0] as object)).toContain('isPlatformAdmin')
  })

  it('les DEUX signatures partagent le même TTL — une divergence se verrait ici', () => {
    const { app, sign } = fauxApp()
    signActiveToken(app, { userId: 'u', role: 'ADMIN', tenantId: 'T' })
    signNoTenantToken(app, { userId: 'u', role: 'ADMIN' })
    expect(sign.mock.calls[0][1]).toEqual(sign.mock.calls[1][1])
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/authToken.test.ts
```
Attendu : ÉCHEC — `Failed to resolve import "../lib/authToken"`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// apps/backend/src/lib/authToken.ts
/**
 * FORME DU PAYLOAD JWT — SOURCE UNIQUE.
 *
 * ⚠️ Toute route qui émet un jeton passe par ici. La forme vivait en closure locale dans
 * `authRoutes` ; une seconde route d'émission (la démo en libre-service) aurait dû la
 * recopier, et un payload d'authentification recopié divergerait en silence — c'est
 * `authenticate` qui en paierait le prix, pas l'émetteur.
 *
 * ⚠️ `tenantId` et `activeTenantId` portent la MÊME valeur sur un jeton à boutique active.
 * Ce n'est pas une redondance : `getTenantId()` lit le premier (JWT, hérité) et
 * `getActiveTenantId()` le second (boutique résolue) — deux champs, deux helpers, et les
 * confondre casse les routes platform-scopées (cf. CLAUDE.md § Multi-boutiques).
 */

/** Durée de vie d'un jeton. Identique pour les deux formes — une divergence serait un piège. */
export const TOKEN_TTL = '7d'

/** Le minimum que l'on exige d'une instance Fastify : le décorateur @fastify/jwt. */
export interface JwtSigner {
  jwt: { sign(payload: object, opts: object): string }
}

export interface ActiveTokenClaims {
  userId: string
  role: string
  tenantId: string
  isPlatformAdmin?: boolean
}

export interface NoTenantTokenClaims {
  userId: string
  role: string
  isPlatformAdmin?: boolean
}

/** Jeton AVEC boutique active (mono-boutique, ou après bascule). */
export function signActiveToken(app: JwtSigner, c: ActiveTokenClaims): string {
  return app.jwt.sign(
    {
      userId: c.userId,
      role: c.role,
      tenantId: c.tenantId,
      activeTenantId: c.tenantId,
      isPlatformAdmin: c.isPlatformAdmin ?? false,
    },
    { expiresIn: TOKEN_TTL },
  )
}

/** Jeton SANS boutique active — le front affiche le sélecteur avant d'entrer. */
export function signNoTenantToken(app: JwtSigner, c: NoTenantTokenClaims): string {
  return app.jwt.sign(
    {
      userId: c.userId,
      role: c.role,
      tenantId: null,
      activeTenantId: null,
      isPlatformAdmin: c.isPlatformAdmin ?? false,
    },
    { expiresIn: TOKEN_TTL },
  )
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/authToken.test.ts
```
Attendu : 4 tests PASS.

- [ ] **Étape 5 : brancher `auth.ts` sur le helper**

Dans `apps/backend/src/routes/auth.ts`, remplacer les deux closures (l.77-82) par :

```ts
  // Forme du payload : `lib/authToken.ts` (source unique — cf. son en-tête).
  const signActive = (userId: string, role: string, tenantId: string, isPlatformAdmin = false) =>
    signActiveToken(app, { userId, role, tenantId, isPlatformAdmin })
  const signNoTenant = (userId: string, role: string, isPlatformAdmin = false) =>
    signNoTenantToken(app, { userId, role, isPlatformAdmin })
```

et ajouter l'import en tête :

```ts
import { signActiveToken, signNoTenantToken } from '../lib/authToken'
```

⚠️ Les closures sont **conservées** : les 3 sites d'appel existants (l.142, 228, 292) gardent
leur arité positionnelle. Changer leur signature en même temps qu'on extrait la forme mêlerait
deux modifications sur le chemin d'authentification — *une surface à la fois*.

- [ ] **Étape 6 : la suite backend complète doit rester verte**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run
```
Attendu : tout PASS. Les tests d'authentification existants exercent les 3 sites d'appel — ce
sont eux qui prouvent que l'extraction n'a rien changé.

- [ ] **Étape 7 : vérifier le verrou dans les deux sens**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage -- apps/backend/src/lib/authToken.ts
```
Dans la copie sabotée, retirer `activeTenantId: c.tenantId` de `signActiveToken`, puis :
```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/authToken.test.ts
```
Attendu : ÉCHEC (au moins 1 rouge). Puis restaurer et confirmer le retour au vert :
```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage:restore
cd apps/backend && npx vitest run src/tests/authToken.test.ts
```

- [ ] **Étape 8 : build backend (le contexte Docker décide, pas tsc)**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run build --workspace=apps/backend
```

- [ ] **Étape 9 : commit**

```bash
set -euo pipefail
git add apps/backend/src/lib/authToken.ts apps/backend/src/tests/authToken.test.ts apps/backend/src/routes/auth.ts
git commit -m "refactor(auth): la forme du payload JWT devient une source unique

\`signActive\` était une closure locale d'\`authRoutes\` : la route de démo en
libre-service aurait dû recopier la forme du payload. Un jumeau de payload
d'authentification divergerait en silence, et c'est \`authenticate\` qui le
paierait — pas l'émetteur.

Les closures sont conservées, arité inchangée : une surface à la fois.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 2 : colonne `demoExpiresAt` + `lib/demoLifetime.ts`

**Pourquoi ces deux ensemble** : la colonne n'a aucun sens sans la règle qui la remplit, et la
règle n'est testable que si la colonne existe. Un reviewer ne peut pas accepter l'une sans
l'autre.

**Fichiers**
- Modifier : `apps/backend/prisma/schema.prisma` (modèle `Tenant`)
- Créer : `apps/backend/prisma/migrations/20261001120000_tenant_demo_expires_at/migration.sql`
- Créer : `apps/backend/src/lib/demoLifetime.ts`
- Test : `apps/backend/src/tests/demoLifetime.test.ts`

**Interfaces**
- Produit : `DEMO_ID_PREFIX = 'demo-tmp-'` · `DEMO_TTL_DAYS = 7` ·
  `demoExpiryFrom(now: Date): Date` · `newDemoTenantId(): string` ·
  `isEphemeralDemoId(id: string): boolean`
- Consommé par : **T4** (`newDemoTenantId`, `demoExpiryFrom`) et **T10 étape 7**
  (`isEphemeralDemoId`, comme garde de périmètre du script de suppression manuelle).
  ⚠️ **T6 n'en consomme RIEN** — et c'est le point : la purge décide sur la colonne, pas sur le
  nom. `isEphemeralDemoId` existe pour le garde-fou humain, pas pour la sélection automatique.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/backend/src/tests/demoLifetime.test.ts
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
 * décider d'une suppression. C'est `demoExpiresAt` non nul qui décide (cf. T5).
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
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoLifetime.test.ts
```
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : écrire l'implémentation**

```ts
// apps/backend/src/lib/demoLifetime.ts
import { randomUUID } from 'crypto'

/**
 * DÉMOS JETABLES — identité et durée de vie.
 *
 * ⚠️ Le préfixe d'identifiant sert à LIRE (journaux, console Ops), jamais à décider d'une
 * suppression. C'est `Tenant.demoExpiresAt` non nul et dépassé qui autorise la purge : les
 * démos permanentes (`demo-tenant-001/002`) et `e2e-tenant` portent `null`, donc sont
 * impurgeables PAR CONSTRUCTION. Décider sur le nom rouvrirait le trou que la colonne ferme.
 */

/** Préfixe réservé aux démos créées en libre-service. */
export const DEMO_ID_PREFIX = 'demo-tmp-'

/** Durée de vie, en jours. Décision de Nelson du 2026-10-01. */
export const DEMO_TTL_DAYS = 7

const MS_PAR_JOUR = 24 * 60 * 60 * 1000

/**
 * Échéance d'une démo créée à `now`.
 * ⚠️ `now` est un PARAMÈTRE : un `new Date()` implicite rendrait la fonction intestable
 * (convention du dépôt sur toute date « maintenant »).
 */
export function demoExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + DEMO_TTL_DAYS * MS_PAR_JOUR)
}

/** Identifiant d'une démo neuve. */
export function newDemoTenantId(): string {
  return `${DEMO_ID_PREFIX}${randomUUID()}`
}

/** Cet identifiant est-il celui d'une démo JETABLE (et non d'une démo permanente) ? */
export function isEphemeralDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX)
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoLifetime.test.ts
```
Attendu : 5 tests PASS.

- [ ] **Étape 5 : ajouter la colonne au schéma**

Dans `apps/backend/prisma/schema.prisma`, modèle `Tenant`, à côté de `isDemo` :

```prisma
  /// Échéance d'une démo JETABLE (libre-service). `null` = pas une démo jetable.
  /// ⚠️ La purge ne supprime QUE les tenants dont cette colonne est non nulle et dépassée :
  /// `demo-tenant-001/002` et `e2e-tenant` portent `null`, donc sont impurgeables par
  /// construction — protégés par une propriété, pas par une liste de noms.
  demoExpiresAt DateTime?

  @@index([demoExpiresAt])
```

⚠️ Placer l'`@@index` avec les autres attributs de bloc du modèle, pas au milieu des champs.

- [ ] **Étape 6 : écrire la migration additive**

```sql
-- apps/backend/prisma/migrations/20261001120000_tenant_demo_expires_at/migration.sql
-- Additive, sans perte : la colonne est nullable et sans défaut.
-- `IF NOT EXISTS` — convention du dépôt : la base de PROD peut déjà l'avoir reçue par
-- `prisma db push` avant que la migration ne soit enregistrée.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMP(3);

-- Index partiel : seules les démos jetables portent une valeur, la purge ne lit qu'elles.
CREATE INDEX IF NOT EXISTS "Tenant_demoExpiresAt_idx"
  ON "Tenant"("demoExpiresAt") WHERE "demoExpiresAt" IS NOT NULL;
```

- [ ] **Étape 7 : appliquer sur la base PROD (⚠️ `DATABASE_URL` = PROD Railway)**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx prisma db push
```
⚠️ **`db push` uniquement** — jamais `migrate dev`, jamais `migrate reset`, jamais `seed`.
L'ajout est additif, donc sans perte. Puis enregistrer la migration comme appliquée :
```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx prisma migrate resolve --applied 20261001120000_tenant_demo_expires_at
```

- [ ] **Étape 8 : vérifier en LECTURE SEULE que la colonne existe et que personne ne la porte**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx tsx -e "
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const n = await p.tenant.count({ where: { demoExpiresAt: { not: null } } })
const total = await p.tenant.count()
console.log('tenants portant une échéance de démo :', n, '/', total)
if (n !== 0) { console.error('❌ inattendu : un tenant existant porte déjà une échéance'); process.exit(1) }
await p.\$disconnect()
"
```
Attendu : `0 / <total>`. **Lecture seule** — aucun `PATCH`, aucune mutation.

- [ ] **Étape 9 : build backend + commit**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run build --workspace=apps/backend
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations apps/backend/src/lib/demoLifetime.ts apps/backend/src/tests/demoLifetime.test.ts
git commit -m "feat(demo): Tenant.demoExpiresAt — la colonne qui rend la purge sûre par construction

La purge ne sélectionnera que les tenants dont cette colonne est non nulle ET
dépassée. Conséquence : demo-tenant-001/002 et e2e-tenant portent null, donc
sont impurgeables PAR CONSTRUCTION — protégés par une propriété, jamais par
une liste de noms qui vieillirait.

Le préfixe d'identifiant demo-tmp- sert à LIRE, jamais à décider.

Migration additive (nullable, sans défaut), db push sur la prod, 0 tenant
existant touché — vérifié en lecture seule.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 3 : `lib/demoDataset.ts` — le jeu de données, au-delà des seuils qui masquent

**Pourquoi ce n'est pas un détail** : ⚠️ `demo-tenant-001` a **exactement 6 catégories**, or le
camembert « CA par catégorie » en affiche 6 — le reliquat « Autres » y était donc **toujours
nul**, et le défaut, réel sur `demo-002`, restait invisible. *Une démonstration calée sur la
valeur limite ne démontre rien : elle masque.* Ce jeu de données doit **dépasser** les seuils.

**Fichiers**
- Créer : `apps/backend/src/lib/demoDataset.ts`
- Test : `apps/backend/src/tests/demoDataset.test.ts`

**Interfaces**
- Consomme : rien (module pur ; l'écriture est passée en paramètre)
- Produit : `DEMO_CATEGORIES: readonly string[]` (9 entrées) ·
  `buildDemoDataset(tx: DemoTx, o: { tenantId: string; cashierId: string; now: Date }): Promise<void>` ·
  `type DemoTx` = le sous-ensemble de `TxClient` réellement utilisé
- Consommé par : T4 (`routes/demo.ts`)

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/backend/src/tests/demoDataset.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildDemoDataset, DEMO_CATEGORIES } from '../lib/demoDataset'

/**
 * JEU DE DONNÉES DE DÉMONSTRATION — les SEUILS sont l'objet du test, pas le volume.
 *
 * ⚠️ `demo-tenant-001` a EXACTEMENT 6 catégories et le camembert « CA par catégorie » en
 * affiche 6 : le reliquat « Autres » y valait toujours 0, donc le défaut y était invisible.
 * Un jeu calé sur la valeur limite ne démontre rien. On exige STRICTEMENT plus.
 */

/** Faux client de transaction : enregistre ce qui est écrit, modèle par modèle. */
function fauxTx() {
  const ecrit: Record<string, any[]> = {}
  const modele = (nom: string) => ({
    create: vi.fn(async ({ data }: any) => { (ecrit[nom] ??= []).push(data); return { ...data, id: `${nom}-${(ecrit[nom]).length}` } }),
    createMany: vi.fn(async ({ data }: any) => { (ecrit[nom] ??= []).push(...data); return { count: data.length } }),
  })
  return {
    ecrit,
    tx: {
      product: modele('product'), customer: modele('customer'), supplier: modele('supplier'),
      employee: modele('employee'), sale: modele('sale'), saleItem: modele('saleItem'),
      expense: modele('expense'),
    } as any,
  }
}

const options = { tenantId: 'demo-tmp-x', cashierId: 'u-demo', now: new Date('2026-10-01T10:00:00.000Z') }

describe('buildDemoDataset', () => {
  it('⚠️ STRICTEMENT plus de 6 catégories — 6 est la valeur limite qui masque le reliquat', () => {
    expect(new Set(DEMO_CATEGORIES).size).toBeGreaterThan(6)
  })

  it('écrit effectivement dans les 7 modèles attendus — un générateur muet serait vert sinon', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    for (const m of ['product', 'customer', 'supplier', 'employee', 'sale', 'saleItem', 'expense']) {
      expect(ecrit[m]?.length ?? 0, `aucune écriture dans ${m}`).toBeGreaterThan(0)
    }
  })

  it('les produits couvrent TOUTES les catégories annoncées', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const vues = new Set(ecrit.product.map((p: any) => p.category))
    expect([...DEMO_CATEGORIES].every(c => vues.has(c))).toBe(true)
  })

  it('⚠️ une partie des employés est NON évaluée — sinon l’état « — » est inatteignable', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const nonEvalues = ecrit.employee.filter((e: any) => e.perf === null || e.perf === undefined)
    expect(nonEvalues.length).toBeGreaterThan(0)
    expect(nonEvalues.length).toBeLessThan(ecrit.employee.length) // ni tous, ni aucun
  })

  it('les ventes couvrent PLUSIEURS mois — un seul mois laisse les rapports de période vides', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const mois = new Set(ecrit.sale.map((s: any) => (s.createdAt as Date).toISOString().slice(0, 7)))
    expect(mois.size).toBeGreaterThanOrEqual(3)
  })

  it('aucune vente n’est postérieure à `now` — une démo ne montre pas l’avenir', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    for (const s of ecrit.sale) expect((s.createdAt as Date).getTime()).toBeLessThanOrEqual(options.now.getTime())
  })

  it('plusieurs modes de paiement sont représentés — le camembert de répartition doit avoir des parts', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    expect(new Set(ecrit.sale.map((s: any) => s.paymentMode)).size).toBeGreaterThanOrEqual(3)
  })

  it('DÉTERMINISTE : deux passes au même `now` produisent le même jeu', async () => {
    const a = fauxTx(); await buildDemoDataset(a.tx, options)
    const b = fauxTx(); await buildDemoDataset(b.tx, options)
    expect(JSON.stringify(b.ecrit.sale)).toBe(JSON.stringify(a.ecrit.sale))
  })

  it('chaque vente porte au moins une ligne, et son total est la somme de ses lignes', async () => {
    const { tx, ecrit } = fauxTx()
    await buildDemoDataset(tx, options)
    const parVente = new Map<string, number>()
    for (const li of ecrit.saleItem) parVente.set(li.saleId, (parVente.get(li.saleId) ?? 0) + li.total)
    expect(parVente.size).toBe(ecrit.sale.length)
    for (const [, somme] of parVente) expect(somme).toBeGreaterThan(0)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoDataset.test.ts
```
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : écrire l'implémentation**

```ts
// apps/backend/src/lib/demoDataset.ts
/**
 * JEU DE DONNÉES D'UNE DÉMO JETABLE.
 *
 * ⚠️ Les VOLUMES sont choisis pour DÉPASSER les seuils qui masquent les défauts, pas pour
 * faire joli. `demo-tenant-001` a exactement 6 catégories, or le camembert « CA par
 * catégorie » en affiche 6 : le reliquat « Autres » y valait toujours 0, et le défaut réel
 * sur `demo-002` y restait invisible. On en met NEUF.
 *
 * ⚠️ DÉTERMINISTE : un générateur congruentiel à graine fixe, jamais `Math.random`. Un jeu
 * qui change à chaque appel rend les verrous instables et une anomalie irreproductible.
 *
 * ⚠️ Boutique SÉNÉGALAISE (XOF, TVA 18 %) : les démos restent ouest-africaines. Ne pas
 * « aligner » sur le marché par défaut camerounais — une démo sénégalaise sous un défaut
 * produit camerounais est la meilleure preuve que le multi-pays fonctionne.
 */

/** ⚠️ NEUF catégories — 6 est la valeur limite qui rendait le reliquat toujours nul. */
export const DEMO_CATEGORIES = [
  'Boissons', 'Épicerie', 'Hygiène', 'Entretien', 'Céréales',
  'Conserves', 'Frais', 'Snacks', 'Papeterie',
] as const

/** Le sous-ensemble de `TxClient` réellement utilisé — rien de plus, pour rester mockable. */
export interface DemoTx {
  product:  { create(a: { data: Record<string, unknown> }): Promise<{ id: string }> }
  customer: { create(a: { data: Record<string, unknown> }): Promise<{ id: string }> }
  supplier: { create(a: { data: Record<string, unknown> }): Promise<{ id: string }> }
  employee: { create(a: { data: Record<string, unknown> }): Promise<{ id: string }> }
  sale:     { create(a: { data: Record<string, unknown> }): Promise<{ id: string }> }
  saleItem: { createMany(a: { data: Record<string, unknown>[] }): Promise<{ count: number }> }
  expense:  { create(a: { data: Record<string, unknown> }): Promise<{ id: string }> }
}

export interface DemoDatasetOptions {
  tenantId: string
  /** `User.id` du compte éphémère — `Sale.cashierId` est une FK requise vers `User`. */
  cashierId: string
  /** Instant de référence. ⚠️ Paramètre, jamais `new Date()` implicite. */
  now: Date
}

/** Générateur congruentiel — déterministe, graine fixe. Pas de `Math.random`. */
function alea(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x1_0000_0000
  }
}

const MOIS_D_HISTORIQUE = 4
const PRODUITS_PAR_CATEGORIE = 4
const VENTES = 180
const MODES = ['cash', 'mobile_money', 'card', 'mtn_momo'] as const

export async function buildDemoDataset(tx: DemoTx, o: DemoDatasetOptions): Promise<void> {
  const r = alea(20261001)

  // ── Fournisseurs ───────────────────────────────────────────────────────────
  for (const nom of ['Grossiste Sandaga', 'Dakar Distribution', 'Coopérative Thiès']) {
    await tx.supplier.create({ data: { tenantId: o.tenantId, name: nom, phone: null, email: null } })
  }

  // ── Produits : 9 catégories × 4 = 36 ───────────────────────────────────────
  const produits: { id: string; sellPrice: number }[] = []
  for (const [ic, categorie] of DEMO_CATEGORIES.entries()) {
    for (let k = 0; k < PRODUITS_PAR_CATEGORIE; k++) {
      const buyPrice  = 250 + Math.round(r() * 20) * 125
      const sellPrice = buyPrice + 100 + Math.round(r() * 12) * 50
      const p = await tx.product.create({
        data: {
          tenantId: o.tenantId,
          sku: `DEMO-${String(ic + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`,
          name: `${categorie} — article ${k + 1}`,
          category: categorie,
          buyPrice, sellPrice,
          stockQty: 4 + Math.round(r() * 120),
          stockMin: 5,
          taxRate: 18, // ⚠️ TVA sénégalaise ; la valeur du tenant est dérivée du pays côté route
          emoji: '📦',
        },
      })
      produits.push({ id: p.id, sellPrice })
    }
  }

  // ── Clients ────────────────────────────────────────────────────────────────
  // ⚠️ AUCUNE donnée personnelle plausible : noms de fantaisie, téléphone et e-mail NULS.
  // Le balayage PII hebdomadaire signale toute coordonnée réelle dans une démo — on ne lui
  // en fournit pas, et un prospect n'a rien à apprendre d'un faux numéro.
  const clients: string[] = []
  for (const nom of ['Cliente A', 'Client B', 'Boutique C', 'Restaurant D', 'Cliente E']) {
    const c = await tx.customer.create({
      data: { tenantId: o.tenantId, name: nom, type: r() > 0.6 ? 'wholesale' : 'retail', phone: null, email: null },
    })
    clients.push(c.id)
  }

  // ⚠️⚠️ CE BLOC EST PÉRIMÉ — NE PAS LE RECOPIER. Tel que planifié ci-dessous, il écrivait des
  // MÉTIERS dans le champ `name` (« Caissier 1 », « Gérante »), un `role: 'Gérant'` absent de
  // `ROLE_LABELS` et du `ROLE_T` de la paie, un `dept: 'Vente'` au singulier quand les trois
  // tables du front portent `'Ventes'`, et un `avatar` numéroté qui court-circuite les
  // initiales. Corrigé le 2026-10-01 — la forme qui fait foi est dans
  // `apps/backend/src/lib/demoDataset.ts`, verrouillée par `demoDataset.test.ts`.
  // Le plan reste ci-dessous tel qu'il a été écrit : c'est le registre de ce qui a été prévu.

  // ── Employés — ⚠️ une partie NON évaluée (`perf: null`) ────────────────────
  // Une démonstration qui note tout le monde ne montre jamais l'état vide, et c'est
  // précisément l'état que `ratingSummary` doit rendre en « — » plutôt qu'en « 0,0/5 ».
  const equipe = [
    { name: 'Caissier 1', role: 'Caissier', dept: 'Vente',   salary: 90_000,  perf: 4 },
    { name: 'Caissier 2', role: 'Caissier', dept: 'Vente',   salary: 90_000,  perf: null },
    { name: 'Magasinier', role: 'Magasinier', dept: 'Stock', salary: 110_000, perf: 3 },
    { name: 'Gérante',    role: 'Gérant',   dept: 'Direction', salary: 180_000, perf: null },
  ]
  for (const [k, e] of equipe.entries()) {
    await tx.employee.create({
      data: {
        tenantId: o.tenantId, name: e.name, role: e.role, dept: e.dept, type: 'CDI',
        salary: e.salary, perf: e.perf, avatar: String(k + 1),
        hiredAt: new Date(o.now.getTime() - (200 + k * 90) * 86_400_000),
        phone: null, email: null,
      },
    })
  }

  // ── Ventes sur 4 mois ──────────────────────────────────────────────────────
  const fenetreMs = MOIS_D_HISTORIQUE * 30 * 86_400_000
  for (let v = 0; v < VENTES; v++) {
    const createdAt = new Date(o.now.getTime() - Math.floor(r() * fenetreMs))
    const nbLignes = 1 + Math.floor(r() * 4)
    const lignes: Record<string, unknown>[] = []
    let total = 0
    for (let l = 0; l < nbLignes; l++) {
      const p = produits[Math.floor(r() * produits.length)]
      const qty = 1 + Math.floor(r() * 5)
      const ligneTotal = p.sellPrice * qty
      total += ligneTotal
      lignes.push({ productId: p.id, qty, unitPrice: p.sellPrice, total: ligneTotal })
    }
    const avecClient = r() > 0.55
    const vente = await tx.sale.create({
      data: {
        tenantId: o.tenantId,
        cashierId: o.cashierId,
        // ⚠️ `total` est la SOMME des lignes. Un total découplé des lignes est l'ancien
        // « trust client total », refusé par l'intégrité prix serveur-autoritaire.
        total,
        paymentMode: MODES[Math.floor(r() * MODES.length)],
        clientType: avecClient ? 'retail' : 'retail',
        customerId: avecClient ? clients[Math.floor(r() * clients.length)] : null,
        createdAt,
      },
    })
    await tx.saleItem.createMany({ data: lignes.map(l => ({ ...l, saleId: vente.id })) })
  }

  // ── Dépenses ───────────────────────────────────────────────────────────────
  for (const [k, libelle] of ['Loyer', 'Électricité', 'Transport', 'Emballages'].entries()) {
    await tx.expense.create({
      data: {
        tenantId: o.tenantId, label: libelle, category: 'Charges',
        amount: 15_000 + k * 20_000,
        date: new Date(o.now.getTime() - (k + 1) * 15 * 86_400_000),
      },
    })
  }
}
```

⚠️ **Avant de lancer le test** : vérifier les champs requis d'`Expense` et de `Supplier` contre
`prisma/schema.prisma` (`label`/`category`/`amount`/`date` pour l'un, `name` pour l'autre) et
corriger les noms si le schéma diffère. `tsc` le dira à l'étape 5 — le faux `DemoTx` du test
n'utilise pas les types Prisma, donc **lui ne le dira pas**.

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoDataset.test.ts
```
Attendu : 9 tests PASS.

- [ ] **Étape 5 : typecheck (c'est lui qui juge la conformité au schéma)**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx tsc --noEmit
```
⚠️ Sans pipe — `$?` après `| tail` serait celui de `tail`. Attendu : 0 erreur.

- [ ] **Étape 6 : sabotage — ramener les catégories à 6 (la valeur limite historique)**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage -- apps/backend/src/lib/demoDataset.ts
```
Retirer `'Snacks', 'Papeterie', 'Frais'` de `DEMO_CATEGORIES`, puis relancer le test.
Attendu : ÉCHEC sur « STRICTEMENT plus de 6 catégories ». Puis :
```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage:restore
cd apps/backend && npx vitest run src/tests/demoDataset.test.ts
```

- [ ] **Étape 7 : second sabotage — évaluer TOUS les employés**

Même procédure ; remplacer les deux `perf: null` par `perf: 4`.
Attendu : ÉCHEC sur « une partie des employés est NON évaluée ». Restaurer.

- [ ] **Étape 8 : commit**

```bash
set -euo pipefail
git add apps/backend/src/lib/demoDataset.ts apps/backend/src/tests/demoDataset.test.ts
git commit -m "feat(demo): jeu de données de démonstration, au-delà des seuils qui masquent

NEUF catégories, pas six. demo-tenant-001 en a exactement six, or le
camembert « CA par catégorie » en affiche six : le reliquat « Autres » y
valait toujours 0 et le défaut, réel sur demo-002, y était invisible. Une
démonstration calée sur la valeur limite ne démontre rien, elle masque.

Une partie des employés reste NON évaluée (perf null) : sinon l'état « — »
de ratingSummary est inatteignable dans la démo.

Déterministe (générateur congruentiel à graine fixe, pas Math.random) pour
que les verrous soient stables et une anomalie reproductible. Aucune
coordonnée personnelle plausible : téléphone et e-mail nuls.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 4 : `routes/demo.ts` — `POST /api/demo/start`

**Fichiers**
- Créer : `apps/backend/src/routes/demo.ts`
- Créer : `apps/backend/src/lib/demoQuota.ts`
- Modifier : `apps/backend/src/server.ts` (enregistrement de la route)
- Test : `apps/backend/src/tests/demoSelfServe.test.ts`

**Interfaces**
- Consomme : `signActiveToken` (T1) · `DEMO_ID_PREFIX`, `newDemoTenantId`, `demoExpiryFrom` (T2) ·
  `buildDemoDataset` (T3) · `vatRateOrZero` (`lib/vatRate`) · `isCurrencyZoneConflict`,
  `currencyZoneError` (`lib/currencyZone`)
- Produit : `demoRoutes(app: FastifyInstance): Promise<void>` ·
  `DEMO_QUOTA_EXCEEDED = 'DEMO_QUOTA_EXCEEDED'` ·
  `reserveDemoSlot(): Promise<{ ok: boolean; failOpen: boolean }>` (dans `lib/demoQuota.ts`)
- Réponse : `{ token, user, tenant }` — **la forme exacte de `/api/auth/register`**, afin
  qu'`authStore` n'ait aucun cas particulier.

**La locale de la démo** : `SN` / `XOF`, `vatRate` **dérivé** par `vatRateOrZero('SN')` (= 18).
⚠️ Ne PAS écrire `18` en dur : le taux se dérive du pays, c'est la règle qui a rattrapé les
19,25 % camerounais. Et ⚠️ ne pas aligner sur le marché par défaut (CM/XAF) — les démos
restent ouest-africaines.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/backend/src/tests/demoSelfServe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * DÉMO JETABLE EN LIBRE-SERVICE — on monte le VRAI handler ; seuls `db`, le quota et le
 * signeur sont mockés. On juge la DONNÉE ÉCRITE, pas le code HTTP.
 */
const { db, quota, signer, dataset } = vi.hoisted(() => ({
  db: { $transaction: vi.fn(), tenant: { create: vi.fn() }, user: { create: vi.fn() }, userTenant: { create: vi.fn() } },
  quota: { reserveDemoSlot: vi.fn(async () => ({ ok: true, failOpen: false })) },
  signer: { signActiveToken: vi.fn(() => 'JETON-DEMO') },
  dataset: { buildDemoDataset: vi.fn(async () => {}), DEMO_CATEGORIES: [] as string[] },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../lib/demoQuota', () => ({ ...quota, DEMO_QUOTA_EXCEEDED: 'DEMO_QUOTA_EXCEEDED' }))
vi.mock('../lib/authToken', () => signer)
vi.mock('../lib/demoDataset', () => dataset)
vi.mock('../services/email', () => ({ sendWelcomeEmail: vi.fn(async () => {}) }))

import { demoRoutes } from '../routes/demo'
import { sendWelcomeEmail } from '../services/email'
import { DEMO_ID_PREFIX } from '../lib/demoLifetime'

/** Le `data` du dernier `tenant.create` — c'est la donnée écrite qu'on juge. */
const dernierTenant = () => db.tenant.create.mock.calls.at(-1)?.[0]?.data as Record<string, any>

async function app() {
  const a = Fastify()
  a.setValidatorCompiler(validatorCompiler)
  // ⚠️ Le harnais monte Fastify SANS @fastify/jwt : `app.jwt` n'existe pas. Le handler passe
  // par `signActiveToken(app, …)`, qui est mocké — c'est pour cela qu'il est un module et
  // non une closure (cf. T1).
  a.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, b: string, d) => d(null, b ? JSON.parse(b) : {}))
  await a.register(demoRoutes)
  await a.ready()
  return a
}

beforeEach(() => {
  vi.clearAllMocks()
  quota.reserveDemoSlot.mockResolvedValue({ ok: true, failOpen: false })
  // La transaction exécute réellement le callback avec le client mocké.
  db.$transaction.mockImplementation(async (cb: any) => cb(db))
  db.tenant.create.mockImplementation(async ({ data }: any) => ({ ...data }))
  db.user.create.mockImplementation(async ({ data }: any) => ({ id: 'u-demo', ...data }))
  db.userTenant.create.mockResolvedValue({})
})

describe('POST /api/demo/start', () => {
  it('crée un tenant isDemo, préfixé, avec une échéance', async () => {
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBe(201)
    const t = dernierTenant()
    expect(t.isDemo).toBe(true)
    expect(String(t.id).startsWith(DEMO_ID_PREFIX)).toBe(true)
    expect(t.demoExpiresAt).toBeInstanceOf(Date)
  })

  it('⚠️ le taux de TVA est DÉRIVÉ du pays, jamais un littéral', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const t = dernierTenant()
    const { vatRateOrZero } = await import('../lib/vatRate')
    expect(t.vatRate).toBe(vatRateOrZero(t.country))
  })

  it('⚠️ le couple pays/devise respecte la zone franc CFA', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const t = dernierTenant()
    const { isCurrencyZoneConflict } = await import('../lib/currencyZone')
    expect(isCurrencyZoneConflict(t.country, t.currency)).toBe(false)
  })

  it('⚠️ les démos restent OUEST-africaines — pas le marché par défaut camerounais', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(dernierTenant().currency).toBe('XOF')
  })

  it('⚠️ AUCUN e-mail n’est émis — le compte n’a pas d’adresse réelle', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('l’e-mail du compte éphémère n’est pas routable', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const u = db.user.create.mock.calls.at(-1)?.[0]?.data as Record<string, any>
    expect(String(u.email)).toMatch(/@demo\.local$/)
    expect(String(u.passwordHash).length).toBeGreaterThan(20) // haché, jamais vide
  })

  it('renvoie la forme de /api/auth/register : token + user + tenant', async () => {
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    const c = r.json()
    expect(Object.keys(c).sort()).toEqual(['tenant', 'token', 'user'])
    expect(c.token).toBe('JETON-DEMO')
    expect(c.tenant.demoExpiresAt).toBeTruthy() // le front affiche l'échéance SERVEUR
  })

  it('le jeu de données est écrit DANS la transaction, avec le cashier créé', async () => {
    await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(dataset.buildDemoDataset).toHaveBeenCalledTimes(1)
    expect(dataset.buildDemoDataset.mock.calls[0][1]).toMatchObject({ cashierId: 'u-demo' })
  })

  // ── Vigilance 2 : échec en cours de transaction ────────────────────────────
  it('⚠️ un échec du jeu de données fait ÉCHOUER la requête — pas de tenant à moitié peuplé', async () => {
    dataset.buildDemoDataset.mockRejectedValueOnce(new Error('disque plein'))
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    // La transaction porte le rollback ; ce qu'on vérifie ici, c'est qu'on ne répond
    // JAMAIS 201 avec une démo incomplète.
    expect(r.statusCode).not.toBe(201)
  })

  // ── Plafond global ────────────────────────────────────────────────────────
  it('plafond atteint → 429 avec un code explicite, jamais un 500', async () => {
    quota.reserveDemoSlot.mockResolvedValue({ ok: false, failOpen: false })
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBe(429)
    expect(r.json().code).toBe('DEMO_QUOTA_EXCEEDED')
    expect(db.tenant.create).not.toHaveBeenCalled() // rien n'est écrit sur un refus
  })

  // ── Vigilance 3 : Redis indisponible ──────────────────────────────────────
  it('⚠️ Redis KO → fail-OPEN : la démo passe (le plafond par IP borne toujours)', async () => {
    quota.reserveDemoSlot.mockResolvedValue({ ok: true, failOpen: true })
    const r = await (await app()).inject({ method: 'POST', url: '/api/demo/start' })
    expect(r.statusCode).toBe(201)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoSelfServe.test.ts
```
Attendu : ÉCHEC — `routes/demo` introuvable.

- [ ] **Étape 3 : écrire `lib/demoQuota.ts`**

```ts
// apps/backend/src/lib/demoQuota.ts
import { redis } from '../redis'
import * as Sentry from '@sentry/node'

/**
 * PLAFOND GLOBAL de créations de démos par jour.
 *
 * ⚠️ C'est LUI qui borne la croissance de la base. Le plafond par IP de `@fastify/rate-limit`
 * est volontairement généreux : le CGNAT ouest-africain fait partager une IP à des boutiques
 * sans lien, et les caisses d'un même magasin sortent par la même adresse. Un plafond serré
 * par IP refuserait des visiteurs légitimes — c'est la raison pour laquelle la rafale du
 * garde de dépense est par TENANT, pas par IP.
 *
 * ⚠️ Lu À L'APPEL (ajustable sans redéploiement), et SANS `|| <défaut>` : `Number('0') || 200`
 * rendrait la désactivation inopérante.
 *
 * ⚠️ FAIL-OPEN TRACÉ si Redis est indisponible. Asymétrie assumée, la même que le garde de
 * dépense : un incident Redis ne doit pas fermer la vitrine, et le plafond par IP tient
 * toujours. Le fail-open est SIGNALÉ — un fail-open muet rendrait l'absence de plafond
 * indistinguable d'un plafond respecté.
 */

export const DEMO_QUOTA_EXCEEDED = 'DEMO_QUOTA_EXCEEDED'

const DEFAUT_PAR_JOUR = 200

/** Plafond courant. `undefined`/`''` → défaut ; `'0'` → zéro (désactivation effective). */
export function demoQuotaPerDay(env = process.env): number {
  const brut = (env.DEMO_QUOTA_PER_DAY ?? '').trim()
  if (brut === '') return DEFAUT_PAR_JOUR
  const n = Number(brut)
  return Number.isFinite(n) && n >= 0 ? n : DEFAUT_PAR_JOUR
}

const cle = (jour: string) => `demo:start:${jour}`

/**
 * Réserve un créneau de création.
 * @returns `ok` — la création est autorisée · `failOpen` — décidée sans Redis (à tracer)
 */
export async function reserveDemoSlot(now = new Date()): Promise<{ ok: boolean; failOpen: boolean }> {
  const plafond = demoQuotaPerDay()
  if (plafond === 0) return { ok: false, failOpen: false } // désactivation explicite
  if (!redis) {
    Sentry.captureMessage('[demo-quota] FAIL-OPEN — Redis absent, plafond global non appliqué', { level: 'warning' })
    return { ok: true, failOpen: true }
  }
  try {
    const k = cle(now.toISOString().slice(0, 10))
    const n = await redis.incr(k)
    if (n === 1) await redis.expire(k, 48 * 3600)
    return { ok: n <= plafond, failOpen: false }
  } catch (e) {
    Sentry.captureMessage('[demo-quota] FAIL-OPEN — Redis en échec, plafond global non appliqué', {
      level: 'warning', extra: { erreur: String(e) },
    })
    return { ok: true, failOpen: true }
  }
}
```

- [ ] **Étape 4 : écrire `routes/demo.ts`**

```ts
// apps/backend/src/routes/demo.ts
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import { signActiveToken } from '../lib/authToken'
import { newDemoTenantId, demoExpiryFrom } from '../lib/demoLifetime'
import { buildDemoDataset } from '../lib/demoDataset'
import { reserveDemoSlot, DEMO_QUOTA_EXCEEDED } from '../lib/demoQuota'
import { vatRateOrZero } from '../lib/vatRate'
import { DEFAULT_PLAN_ON_SIGNUP } from '../lib/plans'

/**
 * DÉMO JETABLE EN LIBRE-SERVICE — `POST /api/demo/start`, publique.
 *
 * ⚠️ Le prospect n'entre JAMAIS dans une démo partagée. Il obtient son propre tenant, sans
 * mot de passe publié et sans autre visiteur dedans. C'est ce qui permet de ne pas armer le
 * déclencheur du CLAUDE.md (« le premier prospect envoyé sur la démo ») : `demo1234` reste
 * hors du bundle et `verify:demo-flag` reste intact.
 *
 * ⚠️ Aucune donnée n'est demandée au visiteur ⇒ AUCUNE PII collectée. L'adresse du compte est
 * synthétique et non routable, donc aucun e-mail ne peut partir — y compris celui de
 * bienvenue que `register` envoie.
 *
 * ⚠️ `isDemo: true` apporte GRATUITEMENT les deux protections : refus serveur sur tout ce qui
 * coûte ou détruit (`blockDemoTenant`, fail-closed) et exclusion des agrégats de la console
 * Ops (`CLIENT_TENANTS_WHERE` décide par propriété). Ne rien réimplémenter.
 */

/** Locale de la démo. ⚠️ OUEST-africaine — ne pas aligner sur le marché par défaut (CM/XAF). */
const DEMO_COUNTRY = 'SN'
const DEMO_CURRENCY = 'XOF'

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/demo/start', {
    config: {
      rateLimit: {
        // ⚠️ GÉNÉREUX À DESSEIN : CGNAT ouest-africain — une IP est partagée par des
        // visiteurs sans lien. Le vrai garde est le plafond GLOBAL (`demoQuota`).
        max: 20,
        timeWindow: '1 hour',
        errorResponseBuilder: (_req: unknown, context: { ttl?: number }) => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Trop de démos ouvertes depuis cette connexion. Réessayez dans ${Math.max(1, Math.ceil((context.ttl ?? 0) / 60000))} minute(s).`,
          code: DEMO_QUOTA_EXCEEDED,
        }),
      },
    },
  }, async (_request, reply) => {
    const creneau = await reserveDemoSlot()
    if (!creneau.ok) {
      return reply.code(429).send({
        error: 'Le nombre de démonstrations ouvertes aujourd’hui est atteint. Créez votre boutique — l’essai est gratuit.',
        code: DEMO_QUOTA_EXCEEDED,
      })
    }

    const now = new Date()
    const tenantId = newDemoTenantId()

    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: 'Boutique de démonstration',
          currency: DEMO_CURRENCY,
          country: DEMO_COUNTRY,
          // ⚠️ DÉRIVÉ du pays, jamais un littéral : c'est la règle qui a rattrapé les
          // 19,25 % camerounais facturés à 18 % par le `@default(18)` du schéma.
          vatRate: vatRateOrZero(DEMO_COUNTRY),
          plan: DEFAULT_PLAN_ON_SIGNUP,
          status: 'trial',
          isActive: true,
          isDemo: true,
          trialEnds: demoExpiryFrom(now),
          demoExpiresAt: demoExpiryFrom(now),
        },
      })
      const user = await tx.user.create({
        data: {
          name: 'Visiteur démo',
          // Non routable : rien ne peut partir vers cette adresse.
          email: `demo-${randomUUID()}@demo.local`,
          // Mot de passe ALÉATOIRE, jamais affiché, jamais journalisé — la session passe
          // par le JWT rendu ci-dessous, pas par une connexion ultérieure.
          passwordHash: await bcrypt.hash(randomUUID(), 12),
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      })
      await tx.userTenant.create({ data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' } })
      // ⚠️ DANS la transaction : une démo à moitié peuplée se lit comme un produit cassé.
      // Si ceci lève, tout est annulé et l'appelant reçoit une erreur — jamais un 201.
      await buildDemoDataset(tx as never, { tenantId: tenant.id, cashierId: user.id, now })
      return { tenant, user }
    }, { timeout: 30_000 })

    const token = signActiveToken(app, { userId: user.id, role: user.role, tenantId: tenant.id })

    return reply.code(201).send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopName: tenant.name, isPlatformAdmin: false },
      // `demoExpiresAt` voyage jusqu'au front : le bandeau affiche l'échéance SERVEUR,
      // jamais un « 7 jours » recalculé côté client.
      tenant,
    })
  })
}
```

- [ ] **Étape 5 : enregistrer la route dans `server.ts`**

À côté de l'enregistrement de `publicRoutes` :

```ts
  await app.register(demoRoutes)
```
et l'import en tête : `import { demoRoutes } from './routes/demo'`.

- [ ] **Étape 6 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoSelfServe.test.ts
```
Attendu : 12 tests PASS.

- [ ] **Étape 7 : sabotage — remplacer le taux dérivé par `18` en dur**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage -- apps/backend/src/routes/demo.ts
```
Remplacer `vatRate: vatRateOrZero(DEMO_COUNTRY)` par `vatRate: 18`.
⚠️ **Le test doit rougir même si 18 est la bonne VALEUR pour SN** : il compare à
`vatRateOrZero(t.country)`, donc un littéral juste par coïncidence passerait — relire
l'assertion et la corriger si elle laisse passer. *Un critère qui laisse passer son propre
déclencheur est faux, pas prudent.*
Puis restaurer et confirmer le vert.

- [ ] **Étape 8 : sabotage — envoyer l'e-mail de bienvenue**

Ajouter `sendWelcomeEmail({ to: user.email, shopName: tenant.name, ownerName: 'x', plan: 'starter' })`
après la transaction. Attendu : ÉCHEC sur « AUCUN e-mail n'est émis ». Restaurer.

- [ ] **Étape 9 : typecheck + build + suite complète**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx tsc --noEmit && npx vitest run
cd /Users/nelson/Documents/Projets/habashop && npm run build --workspace=apps/backend
```

- [ ] **Étape 10 : commit**

```bash
set -euo pipefail
git add apps/backend/src/routes/demo.ts apps/backend/src/lib/demoQuota.ts apps/backend/src/tests/demoSelfServe.test.ts apps/backend/src/server.ts
git commit -m "feat(demo): POST /api/demo/start — une démo jetable par visiteur

Le prospect n'entre jamais dans une démo partagée : il obtient son propre
tenant, sans mot de passe publié. C'est ainsi qu'on ne déclenche pas la
réouverture inscrite au CLAUDE.md — demo1234 reste hors du bundle.

Aucune donnée demandée ⇒ aucune PII collectée, adresse non routable, donc
aucun e-mail ne PEUT partir (vérifié par assertion, SDK mocké).

isDemo: true apporte gratuitement le refus serveur sur ce qui coûte ou
détruit, et l'exclusion des agrégats Ops — rien n'est réimplémenté.

Plafond par IP généreux (CGNAT ouest-africain) ; le garde réel est le
plafond global, en fail-OPEN TRACÉ si Redis tombe — un incident Redis ne
doit pas fermer la vitrine.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 5 : `lib/tenantPurge.ts` — ordre et clauses DÉRIVÉS du DMMF

**⚠️ Tâche la plus risquée du plan. Le code ci-dessous a été PROTOTYPÉ ET EXÉCUTÉ contre le
schéma réel** (30 modèles) avant d'être écrit ici — il ne repose sur aucune supposition. Deux
résultats à connaître :

- **28 modèles** sont atteignables depuis `Tenant`, et **`UserAuditLog` est le seul exclu**
  (zéro champ relationnel — un audit de sécurité survit à la suppression du compte).
- ⚠️ **Trier par « profondeur minimale jusqu'à `Tenant` » est FAUX** : `UserTenant` et `User`
  sont tous deux à `d=1`, mais `UserTenant` détient une FK vers `User`. Mesuré — l'ordre de
  déclaration **viole 21 arêtes**. Il faut un vrai tri topologique (Kahn), enfants d'abord.

**Fichiers**
- Créer : `apps/backend/src/lib/tenantPurge.ts`
- Test : `apps/backend/src/tests/tenantPurge.test.ts`

**Interfaces**
- Produit : `TENANT_ROOT = 'Tenant'` · `purgePlan(): PurgeStep[]` où
  `PurgeStep = { model: string; delegate: string; where(tenantId: string): object }` ·
  `hardDeleteTenant(tx: PurgeTx, tenantId: string): Promise<Record<string, number>>`
- Consommé par : T6 (`services/demoPurge.ts`)

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/backend/src/tests/tenantPurge.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { purgePlan, hardDeleteTenant, TENANT_ROOT } from '../lib/tenantPurge'

/**
 * ORDRE DE SUPPRESSION DÉRIVÉ — assertions de COUVERTURE, pas d'exécution.
 *
 * ⚠️ Le critère « porte un champ `tenantId` » est FAUX et ce test le prouve : StockTransfer
 * porte fromTenantId/toTenantId, SaleItem et PurchaseOrderItem n'ont aucun champ tenant et
 * pointent leur parent en Restrict. Les trois sont nommés ci-dessous.
 */

const plan = purgePlan()
const noms = plan.map(e => e.model)
const rang = new Map(noms.map((n, k) => [n, k]))

/** Arêtes enfant → parent, relues depuis le DMMF (la même source que le code testé). */
const liens = new Map(Prisma.dmmf.datamodel.models.map(m => [m.name, m.fields
  .filter(f => f.kind === 'object' && (f.relationFromFields ?? []).length > 0)
  .map(f => f.type)]))

describe('purgePlan', () => {
  it('COUVERTURE : le plan n’est pas vide et couvre l’essentiel du schéma', () => {
    // Un `walk()` cassé rendrait une liste vide, donc un vert qui ne garde rien.
    expect(plan.length).toBeGreaterThanOrEqual(28)
  })

  it('⚠️ contient les TROIS cas que le critère `tenantId` ratait', () => {
    for (const m of ['StockTransfer', 'SaleItem', 'PurchaseOrderItem']) {
      expect(noms, `${m} absent du plan → le tenant.delete() échouerait`).toContain(m)
    }
  })

  it('⚠️ n’inclut PAS `UserAuditLog` — un audit de sécurité survit à la suppression', () => {
    expect(noms).not.toContain('UserAuditLog')
  })

  it('n’inclut pas `Tenant` lui-même (supprimé à part, en dernier)', () => {
    expect(noms).not.toContain(TENANT_ROOT)
  })

  it('TOUTE arête enfant → parent place l’enfant AVANT le parent', () => {
    const violations: string[] = []
    for (const n of noms) for (const cible of liens.get(n) ?? []) {
      if (cible === TENANT_ROOT || !rang.has(cible)) continue
      if (rang.get(n)! > rang.get(cible)!) violations.push(`${n} après ${cible}`)
    }
    expect(violations).toEqual([])
  })

  it('TÉMOIN NÉGATIF : l’ordre de déclaration VIOLE des arêtes — le tri n’est pas décoratif', () => {
    const declare = Prisma.dmmf.datamodel.models.map(m => m.name).filter(n => rang.has(n))
    const rangNaif = new Map(declare.map((n, k) => [n, k]))
    let violations = 0
    for (const n of declare) for (const cible of liens.get(n) ?? []) {
      if (cible === TENANT_ROOT || !rangNaif.has(cible)) continue
      if (rangNaif.get(n)! > rangNaif.get(cible)!) violations++
    }
    // Mesuré sur le schéma du 2026-10-01 : 21. On exige « > 0 » pour ne pas figer un nombre.
    expect(violations).toBeGreaterThan(0)
  })

  it('les modèles à FK tenant directe ciblent le scalaire ; StockTransfer en OR sur ses DEUX', () => {
    const sale = plan.find(e => e.model === 'Sale')!
    expect(sale.where('T1')).toEqual({ tenantId: 'T1' })
    const st = plan.find(e => e.model === 'StockTransfer')!
    expect(st.where('T1')).toEqual({ OR: [{ fromTenantId: 'T1' }, { toTenantId: 'T1' }] })
  })

  it('les modèles SANS champ tenant passent par une relation imbriquée', () => {
    const poi = plan.find(e => e.model === 'PurchaseOrderItem')!
    expect(poi.where('T1')).toEqual({ order: { tenantId: 'T1' } })
  })
})

describe('hardDeleteTenant', () => {
  it('supprime dans l’ordre du plan, puis le tenant EN DERNIER', async () => {
    const appels: string[] = []
    const tx: any = { tenant: { delete: vi.fn(async () => { appels.push('Tenant'); return {} }) } }
    for (const e of plan) {
      tx[e.delegate] = { deleteMany: vi.fn(async ({ where }: any) => { appels.push(e.model); expect(where).toBeTruthy(); return { count: 0 } }) }
    }
    await hardDeleteTenant(tx, 'T1')
    expect(appels.at(-1)).toBe('Tenant')
    expect(appels.slice(0, -1)).toEqual(plan.map(e => e.model))
  })

  it('⚠️ le mock APPLIQUE le filtre : un `where` sans le tenant serait détecté', async () => {
    const tx: any = { tenant: { delete: vi.fn(async () => ({})) } }
    for (const e of plan) {
      tx[e.delegate] = {
        deleteMany: vi.fn(async ({ where }: any) => {
          // Le tenant doit apparaître quelque part dans la clause — sinon on supprimerait
          // les lignes de TOUT LE MONDE. Un mock qui ignore ses arguments laisserait
          // passer exactement ce défaut.
          expect(JSON.stringify(where)).toContain('T1')
          return { count: 0 }
        }),
      }
    }
    await hardDeleteTenant(tx, 'T1')
  })

  it('rend le compte de lignes supprimées par modèle — un ménage se mesure', async () => {
    const tx: any = { tenant: { delete: vi.fn(async () => ({})) } }
    for (const e of plan) tx[e.delegate] = { deleteMany: vi.fn(async () => ({ count: 2 })) }
    const compte = await hardDeleteTenant(tx, 'T1')
    expect(Object.values(compte).every(n => n === 2)).toBe(true)
    expect(Object.keys(compte).length).toBe(plan.length)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/tenantPurge.test.ts
```
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : écrire l'implémentation** *(logique prototypée et exécutée le 2026-10-01)*

```ts
// apps/backend/src/lib/tenantPurge.ts
import { Prisma } from '@prisma/client'

/**
 * SUPPRESSION DURE D'UN TENANT — ordre et clauses DÉRIVÉS du DMMF Prisma.
 *
 * ⚠️ DISTINCT de `services/accountDeletion.ts`, et les deux ne doivent PAS être fondus.
 * `accountDeletion` est un soft delete + anonymisation : il CONSERVE délibérément les données
 * transactionnelles pour les obligations comptables. L'employer pour une démo laisserait un
 * tenant anonymisé par visiteur en base, à vie — la croissance ne serait pas bornée, ce qui
 * est précisément ce que la durée de vie de 7 jours doit garantir. Chacune répond à une
 * obligation que l'autre n'a pas.
 *
 * ⚠️ Les relations `tenant` n'ont presque aucun `onDelete: Cascade` (défaut Prisma =
 * `Restrict`) : `prisma.tenant.delete()` seul ÉCHOUE sur un tenant peuplé. NE PAS poser de
 * `Cascade` par migration — cela changerait le comportement pour un CLIENT RÉEL, dont
 * l'effacement en cascade des écritures comptables serait un dégât.
 *
 * ⚠️ LE CRITÈRE N'EST PAS « porte un champ `tenantId` ». Mesuré sur le schéma réel, trois
 * modèles contournent ce critère :
 *     StockTransfer      → porte `fromTenantId` / `toTenantId`
 *     SaleItem           → aucun champ tenant, `sale Sale` en Restrict
 *     PurchaseOrderItem  → aucun champ tenant, `order PurchaseOrder` en Restrict
 * C'est l'angle mort « Forme » : le scan serait vert parce qu'il cherche ce qui ne PEUT PAS
 * exister. Le critère est l'ATTEIGNABILITÉ par clé étrangère depuis `Tenant`.
 *
 * ⚠️ Et trier par « profondeur minimale jusqu'à Tenant » est FAUX AUSSI : `UserTenant` et
 * `User` sont tous deux à d=1, mais `UserTenant` détient une FK vers `User`. Mesuré :
 * l'ordre de déclaration viole 21 arêtes. D'où le tri topologique (Kahn), enfants d'abord.
 *
 * ⚠️ `UserAuditLog` n'a AUCUNE clé étrangère — délibérément : un audit de sécurité survit à
 * la suppression du compte. Il est donc structurellement hors du sous-graphe. Ne pas
 * « compléter » la purge en l'y ajoutant.
 */

export const TENANT_ROOT = 'Tenant'

export interface PurgeStep {
  /** Nom du modèle Prisma (`SaleItem`). */
  model: string
  /** Nom du délégué sur le client (`saleItem`). */
  delegate: string
  /** Clause ciblant les lignes de ce tenant. */
  where(tenantId: string): object
}

/** Le minimum exigé d'un client de transaction — indexable, pour rester mockable. */
export type PurgeTx = Record<string, { deleteMany(a: { where: object }): Promise<{ count: number }> }> & {
  tenant: { delete(a: { where: { id: string } }): Promise<unknown> }
}

interface Lien { champ: string; cible: string; fks: string[] }

const delegateDe = (model: string) => model.charAt(0).toLowerCase() + model.slice(1)

/** Arêtes ENFANT → PARENT : ce côté détient la FK (`relationFromFields` non vide). */
function liensParModele(): Map<string, Lien[]> {
  return new Map(Prisma.dmmf.datamodel.models.map(m => [m.name, m.fields
    .filter(f => f.kind === 'object' && (f.relationFromFields ?? []).length > 0)
    .map(f => ({ champ: f.name, cible: f.type, fks: [...(f.relationFromFields ?? [])] }))]))
}

/**
 * Plan de suppression : les modèles atteignables depuis `Tenant`, triés enfants d'abord.
 * @throws si le graphe présente un cycle — échec BRUYANT plutôt qu'une purge partielle muette.
 */
export function purgePlan(): PurgeStep[] {
  const modeles = Prisma.dmmf.datamodel.models
  const liens = liensParModele()

  // ── Atteignabilité depuis Tenant (transitive) ───────────────────────────────
  const atteignable = new Set<string>([TENANT_ROOT])
  for (let bouge = true; bouge;) {
    bouge = false
    for (const m of modeles) {
      if (atteignable.has(m.name)) continue
      if ((liens.get(m.name) ?? []).some(l => atteignable.has(l.cible))) { atteignable.add(m.name); bouge = true }
    }
  }
  const cibles = [...atteignable].filter(n => n !== TENANT_ROOT)

  // ── Profondeur minimale (sert aux clauses imbriquées, PAS au tri) ───────────
  const prof = new Map<string, number>([[TENANT_ROOT, 0]])
  for (let bouge = true; bouge;) {
    bouge = false
    for (const n of cibles) {
      const d = (liens.get(n) ?? []).map(l => prof.get(l.cible)).filter((x): x is number => x !== undefined)
      if (!d.length) continue
      const best = Math.min(...d) + 1
      if (prof.get(n) !== best) { prof.set(n, best); bouge = true }
    }
  }

  // ── Tri topologique (Kahn) sur enfant → parent : in-degré = nombre d'enfants ─
  const inDeg = new Map<string, number>(cibles.map(n => [n, 0]))
  for (const n of cibles) for (const l of liens.get(n) ?? []) {
    if (l.cible !== TENANT_ROOT && inDeg.has(l.cible)) inDeg.set(l.cible, inDeg.get(l.cible)! + 1)
  }
  const file = cibles.filter(n => inDeg.get(n) === 0)
  const ordre: string[] = []
  while (file.length) {
    const n = file.shift()!
    ordre.push(n)
    for (const l of liens.get(n) ?? []) {
      if (l.cible === TENANT_ROOT || !inDeg.has(l.cible)) continue
      inDeg.set(l.cible, inDeg.get(l.cible)! - 1)
      if (inDeg.get(l.cible) === 0) file.push(l.cible)
    }
  }
  if (ordre.length !== cibles.length) {
    throw new Error(`[tenantPurge] cycle de clés étrangères — non triés : ${cibles.filter(n => !ordre.includes(n)).join(', ')}`)
  }

  /** Clause ciblant les lignes du tenant. Récursion sur les parents de profondeur MINIMALE
   *  → strictement décroissante, donc terminaison garantie. */
  const clause = (nom: string, id: string): object => {
    const directs = (liens.get(nom) ?? []).filter(l => l.cible === TENANT_ROOT).flatMap(l => l.fks)
    if (directs.length === 1) return { [directs[0]]: id }
    if (directs.length > 1) return { OR: directs.map(f => ({ [f]: id })) }
    const d = prof.get(nom)!
    const via = (liens.get(nom) ?? []).filter(l => prof.get(l.cible) === d - 1)
    if (via.length === 1) return { [via[0].champ]: clause(via[0].cible, id) }
    return { OR: via.map(l => ({ [l.champ]: clause(l.cible, id) })) }
  }

  return ordre.map(model => ({ model, delegate: delegateDe(model), where: (id: string) => clause(model, id) }))
}

/**
 * Supprime DUREMENT toutes les lignes d'un tenant, puis le tenant.
 * @returns le nombre de lignes supprimées par modèle — un ménage se MESURE, il ne s'affirme pas.
 */
export async function hardDeleteTenant(tx: PurgeTx, tenantId: string): Promise<Record<string, number>> {
  const compte: Record<string, number> = {}
  for (const etape of purgePlan()) {
    const delegue = tx[etape.delegate]
    if (!delegue) throw new Error(`[tenantPurge] délégué Prisma absent : ${etape.delegate}`)
    const { count } = await delegue.deleteMany({ where: etape.where(tenantId) })
    compte[etape.model] = count
  }
  await tx.tenant.delete({ where: { id: tenantId } })
  return compte
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/tenantPurge.test.ts
```
Attendu : 11 tests PASS. ⚠️ Si « COUVERTURE » échoue avec `plan.length === 0`, le DMMF n'est
pas chargé — regénérer le client : `npx prisma generate`.

- [ ] **Étape 5 : sabotage — revenir au critère FAUX (`tenantId` comme critère)**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage -- apps/backend/src/lib/tenantPurge.ts
```
Dans `purgePlan`, remplacer le calcul d'`atteignable` par le critère naïf :
```ts
  const cibles = modeles.filter(m => m.fields.some(f => f.name === 'tenantId')).map(m => m.name)
```
Attendu : ÉCHEC sur « contient les TROIS cas que le critère `tenantId` ratait ». Restaurer.

- [ ] **Étape 6 : sabotage — remplacer le tri topologique par la profondeur**

Remplacer le bloc Kahn par un tri sur `prof` décroissante. Attendu : ÉCHEC sur « TOUTE arête
enfant → parent place l'enfant AVANT le parent ». ⚠️ C'est LE sabotage décisif : c'est ce
défaut exact que j'avais écrit dans la première version de la spec. Restaurer.

- [ ] **Étape 7 : typecheck + build + commit**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx tsc --noEmit
cd /Users/nelson/Documents/Projets/habashop && npm run build --workspace=apps/backend
git add apps/backend/src/lib/tenantPurge.ts apps/backend/src/tests/tenantPurge.test.ts
git commit -m "feat(demo): suppression dure d'un tenant, ordre dérivé du DMMF

DEUX critères naïfs sont faux, et les deux sont verrouillés :

1. « les modèles portant un tenantId » rate TROIS cas — StockTransfer porte
   fromTenantId/toTenantId, SaleItem et PurchaseOrderItem n'ont aucun champ
   tenant et pointent leur parent en Restrict. Angle mort « Forme » : le scan
   cherchait ce qui ne peut pas exister. Critère = atteignabilité par FK.

2. trier par profondeur minimale jusqu'à Tenant est faux aussi — UserTenant et
   User sont tous deux à d=1, mais UserTenant détient une FK vers User. Mesuré :
   l'ordre de déclaration viole 21 arêtes. D'où Kahn, enfants d'abord.

UserAuditLog est structurellement hors du sous-graphe (aucune FK, délibéré :
un audit de sécurité survit à la suppression du compte) et doit le rester.

DISTINCT d'accountDeletion, qui est un soft delete conservant les écritures
comptables : les fondre laisserait un tenant par visiteur en base à vie.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 6 : `services/demoPurge.ts` + cron

**Fichiers**
- Créer : `apps/backend/src/services/demoPurge.ts`
- Modifier : `apps/backend/src/server.ts` (bloc des `setInterval`, ~l.318-348)
- Test : `apps/backend/src/tests/demoPurge.test.ts`

**Interfaces**
- Consomme : `hardDeleteTenant` (T5) — **et RIEN de `demoLifetime`** : la sélection porte sur
  `isDemo` + `demoExpiresAt`, jamais sur le préfixe d'identifiant. Décider sur le nom rouvrirait
  le trou que la colonne ferme.
- Produit : `runDemoPurge(now?: Date): Promise<{ examines: number; supprimes: number; echecs: number }>`

⚠️ **Pas de marqueur idempotent en base, et c'est raisonné** : la sélection porte sur
l'échéance, donc la purge est idempotente **par nature** — une seconde passe ne trouve plus
rien, et une passe interrompue est reprise par la suivante. Ajouter un marqueur « par
convention » serait du code qui ne protège de rien.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/backend/src/tests/demoPurge.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * PURGE DES DÉMOS JETABLES.
 *
 * ⚠️ LE TEST DÉCISIF est « un tenant à `demoExpiresAt` nul n'est JAMAIS sélectionné » :
 * c'est lui qui protège demo-tenant-001/002 et e2e-tenant. Ils sont protégés par une
 * PROPRIÉTÉ (colonne nulle), pas par une liste de noms qui vieillirait.
 *
 * ⚠️ Le mock APPLIQUE le filtre `where` : un `mockResolvedValue([…])` rendrait la même liste
 * quel que soit le filtre, et resterait vert même si le code cessait d'envoyer la condition
 * d'échéance — un vert qui décrit un monde qui n'existe pas.
 */
const { db, purge, sentry } = vi.hoisted(() => ({
  db: { tenant: { findMany: vi.fn() }, $transaction: vi.fn() },
  purge: { hardDeleteTenant: vi.fn(async () => ({ Sale: 3 })) },
  sentry: { captureMessage: vi.fn(), captureException: vi.fn() },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../lib/tenantPurge', async (orig) => ({ ...(await orig() as object), ...purge }))
vi.mock('@sentry/node', () => sentry)

import { runDemoPurge } from '../services/demoPurge'

const MAINTENANT = new Date('2026-10-20T03:00:00.000Z')

/** Base simulée : le `findMany` APPLIQUE réellement le filtre reçu. */
function seed(tenants: { id: string; demoExpiresAt: Date | null; isDemo: boolean }[]) {
  db.tenant.findMany.mockImplementation(async ({ where }: any) => tenants.filter(t => {
    if (where.isDemo !== undefined && t.isDemo !== where.isDemo) return false
    const cond = where.demoExpiresAt
    if (cond?.not === null && t.demoExpiresAt === null) return false
    if (cond?.lt !== undefined && !(t.demoExpiresAt !== null && t.demoExpiresAt < cond.lt)) return false
    return true
  }).map(t => ({ id: t.id })))
}

beforeEach(() => {
  vi.clearAllMocks()
  purge.hardDeleteTenant.mockResolvedValue({ Sale: 3 })
  db.$transaction.mockImplementation(async (cb: any) => cb(db))
})

describe('runDemoPurge', () => {
  it('supprime une démo jetable dont l’échéance est dépassée', async () => {
    seed([{ id: 'demo-tmp-a', demoExpiresAt: new Date('2026-10-10T00:00:00Z'), isDemo: true }])
    const r = await runDemoPurge(MAINTENANT)
    expect(r.supprimes).toBe(1)
    expect(purge.hardDeleteTenant).toHaveBeenCalledWith(expect.anything(), 'demo-tmp-a')
  })

  it('ne touche PAS une démo jetable encore valide', async () => {
    seed([{ id: 'demo-tmp-b', demoExpiresAt: new Date('2026-10-25T00:00:00Z'), isDemo: true }])
    const r = await runDemoPurge(MAINTENANT)
    expect(r.supprimes).toBe(0)
    expect(purge.hardDeleteTenant).not.toHaveBeenCalled()
  })

  it('⚠️ DÉCISIF : un tenant à `demoExpiresAt` NUL n’est jamais sélectionné', async () => {
    seed([
      { id: 'demo-tenant-001', demoExpiresAt: null, isDemo: true },
      { id: 'demo-tenant-002', demoExpiresAt: null, isDemo: true },
      { id: 'e2e-tenant',      demoExpiresAt: null, isDemo: false },
    ])
    const r = await runDemoPurge(MAINTENANT)
    expect(r.supprimes).toBe(0)
    expect(purge.hardDeleteTenant).not.toHaveBeenCalled()
  })

  it('⚠️ le filtre exige EXPLICITEMENT une échéance non nulle et dépassée', async () => {
    seed([])
    await runDemoPurge(MAINTENANT)
    const where = db.tenant.findMany.mock.calls[0][0].where
    expect(where.demoExpiresAt).toMatchObject({ not: null, lt: MAINTENANT })
    expect(where.isDemo).toBe(true)
  })

  it('un échec sur une démo n’empêche pas les suivantes, et il est COMPTÉ', async () => {
    seed([
      { id: 'demo-tmp-x', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true },
      { id: 'demo-tmp-y', demoExpiresAt: new Date('2026-10-02T00:00:00Z'), isDemo: true },
    ])
    purge.hardDeleteTenant.mockRejectedValueOnce(new Error('FK'))
    const r = await runDemoPurge(MAINTENANT)
    expect(r.examines).toBe(2)
    expect(r.supprimes).toBe(1)
    expect(r.echecs).toBe(1)
  })

  it('⚠️ un échec PART en Sentry — un console.error seul n’atteint personne', async () => {
    seed([{ id: 'demo-tmp-z', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true }])
    purge.hardDeleteTenant.mockRejectedValueOnce(new Error('FK'))
    await runDemoPurge(MAINTENANT)
    expect(sentry.captureException).toHaveBeenCalled()
  })

  // ── Vigilance 5 : passe interrompue ───────────────────────────────────────
  it('⚠️ IDEMPOTENTE : une passe interrompue est reprise par la suivante', async () => {
    const restants = [{ id: 'demo-tmp-w', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true }]
    seed(restants)
    purge.hardDeleteTenant.mockRejectedValueOnce(new Error('timeout'))
    const p1 = await runDemoPurge(MAINTENANT)
    expect(p1.echecs).toBe(1)
    // Le tenant est toujours là, échéance toujours dépassée → la passe suivante le retrouve.
    const p2 = await runDemoPurge(MAINTENANT)
    expect(p2.supprimes).toBe(1)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoPurge.test.ts
```

- [ ] **Étape 3 : écrire l'implémentation**

```ts
// apps/backend/src/services/demoPurge.ts
import { prisma } from '../db'
import { hardDeleteTenant, type PurgeTx } from '../lib/tenantPurge'
import * as Sentry from '@sentry/node'

/**
 * PURGE DES DÉMOS JETABLES — passe quotidienne.
 *
 * ⚠️ La sélection exige `demoExpiresAt` NON NUL et DÉPASSÉ. Les démos permanentes
 * (`demo-tenant-001/002`) et `e2e-tenant` portent `null` : elles sont impurgeables PAR
 * CONSTRUCTION. Ne jamais remplacer cette condition par un test sur le nom ou le préfixe —
 * une liste de noms vieillit, une propriété non.
 *
 * ⚠️ IDEMPOTENTE par nature : la condition porte sur l'échéance, donc une seconde passe ne
 * trouve plus rien et une passe interrompue est reprise par la suivante. Pas de marqueur en
 * base — il ne protégerait de rien.
 *
 * ⚠️ Un ménage s'ASSERTE sur le COMPTE, il n'est jamais « best-effort » : la passe rend
 * examinés / supprimés / échecs, et les échecs partent en Sentry (un `console.error` seul
 * est un signal que personne ne reçoit).
 */
export async function runDemoPurge(now = new Date()): Promise<{ examines: number; supprimes: number; echecs: number }> {
  const expirees = await prisma.tenant.findMany({
    where: {
      isDemo: true,
      // ⚠️ Les DEUX conditions sont nécessaires : `not: null` protège les démos
      // permanentes, `lt` borne aux échues.
      demoExpiresAt: { not: null, lt: now },
    },
    select: { id: true },
  })

  let supprimes = 0
  let echecs = 0
  for (const t of expirees) {
    try {
      await prisma.$transaction(async (tx) => { await hardDeleteTenant(tx as unknown as PurgeTx, t.id) }, { timeout: 60_000 })
      supprimes++
    } catch (e) {
      echecs++
      // ⚠️ On continue : un échec sur une démo ne doit pas bloquer les autres.
      console.error(`[demo-purge] échec sur ${t.id}:`, e)
      Sentry.captureException(e, { extra: { tenantId: t.id, etape: 'demo-purge' } })
    }
  }

  const resume = `[demo-purge] ${expirees.length} examinée(s), ${supprimes} supprimée(s), ${echecs} échec(s)`
  if (echecs > 0) console.warn(resume)
  else console.log(resume)

  return { examines: expirees.length, supprimes, echecs }
}
```

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx vitest run src/tests/demoPurge.test.ts
```
Attendu : 7 tests PASS.

- [ ] **Étape 5 : brancher le cron dans `server.ts`**

À la suite des `setInterval` existants (après celui du balayage PII) :

```ts
  // Purge des démos jetables — une passe par jour, 3 h du matin.
  // ⚠️ Pas de marqueur idempotent : la sélection porte sur l'échéance, donc la passe est
  // idempotente par nature (cf. en-tête de `services/demoPurge.ts`).
  setInterval(() => {
    const now = new Date()
    if (now.getHours() !== 3 || now.getMinutes() > 5) return
    runDemoPurge().catch(err => console.error('❌ Cron purge démos:', err))
  }, 5 * 60 * 1000)
```
et l'import : `import { runDemoPurge } from './services/demoPurge'`.

⚠️ Vérifier le pas réel des `setInterval` voisins et l'aligner — la garde `getMinutes() > 5`
suppose un pas de 5 minutes. Un pas plus long ferait **manquer la fenêtre**, et la purge ne
tournerait jamais sans que rien ne le signale.

- [ ] **Étape 6 : sabotage — retirer `not: null` du filtre**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run sabotage -- apps/backend/src/services/demoPurge.ts
```
Remplacer `demoExpiresAt: { not: null, lt: now }` par `demoExpiresAt: { lt: now }`.
Attendu : ÉCHEC sur « DÉCISIF : un tenant à `demoExpiresAt` NUL n'est jamais sélectionné »
**et** sur « le filtre exige EXPLICITEMENT ». Restaurer.

- [ ] **Étape 7 : typecheck + suite complète + build + commit**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && npx tsc --noEmit && npx vitest run
cd /Users/nelson/Documents/Projets/habashop && npm run build --workspace=apps/backend
git add apps/backend/src/services/demoPurge.ts apps/backend/src/tests/demoPurge.test.ts apps/backend/src/server.ts
git commit -m "feat(demo): purge quotidienne des démos jetables

La sélection exige demoExpiresAt NON NUL et dépassé. demo-tenant-001/002 et
e2e-tenant portent null : impurgeables par construction, protégés par une
propriété et non par une liste de noms. Sabotage vérifié — retirer « not:
null » fait rougir deux tests.

Idempotente par nature : la condition porte sur l'échéance, donc une passe
interrompue est reprise par la suivante. Pas de marqueur en base, il ne
protégerait de rien.

Le ménage s'asserte sur le compte (examinés/supprimés/échecs) et les échecs
partent en Sentry — un console.error seul n'atteint personne.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 7 : front — `demoApi.start()` + `authStore.startDemo`

**Fichiers**
- Modifier : `apps/frontend/src/lib/api.ts` (ajout de `demoApi`)
- Modifier : `apps/frontend/src/stores/authStore.ts` (`adoptSession` + `startDemo`)
- Test : `apps/frontend/src/tests/demoSession.test.ts`

**Interfaces**
- Produit : `demoApi.start(): Promise<{ token: string; user: AuthUser; tenant: Tenant }>` ·
  `useAuthStore.getState().startDemo(): Promise<void>` · `isDemoSession(): boolean`
- Consommé par : T8 (bouton), T9 (bandeau)

⚠️ **`register` et `startDemo` seraient des jumeaux** — même séquence : stocker le jeton,
poser le tenant, renseigner `tenants`/`activeTenantId`, normaliser le rôle. On extrait
`adoptSession` et les DEUX l'appellent. Un jumeau de session divergerait sur la normalisation
du rôle, et c'est elle qui empêche un rôle inconnu de devenir un rôle deviné.

⚠️ **Vigilance 1 — la démo purgée.** Le backend rend un **401 propre** (`authenticate` appelle
`isUserActive`, qui ne trouve plus l'utilisateur), donc **aucune modification backend n'est
nécessaire** — vérifié en lisant le middleware. Mais l'intercepteur 401 du front efface le
jeton et redirige vers `/login`, ce qui est la **mauvaise destination** : un visiteur de démo
n'a pas de compte. `startDemo` pose donc un drapeau `habashop_demo_session` en `localStorage`,
et l'intercepteur 401 redirige vers `/?demo=expiree` quand il est présent.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// apps/frontend/src/tests/demoSession.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  demoApi: { start: vi.fn() },
  authApi: { login: vi.fn(), register: vi.fn(), switchTenant: vi.fn(), me: vi.fn() },
  tenantApi: { get: vi.fn() },
}))

import { useAuthStore, isDemoSession } from '@/stores/authStore'
import { demoApi } from '@/lib/api'

const REPONSE = {
  token: 'JETON-DEMO',
  user: { id: 'u1', name: 'Visiteur démo', email: 'demo-x@demo.local', role: 'ADMIN', shopName: 'Boutique de démonstration', isPlatformAdmin: false },
  tenant: { id: 'demo-tmp-1', name: 'Boutique de démonstration', currency: 'XOF', plan: 'starter', logo: null, address: null, demoExpiresAt: '2026-10-08T12:00:00.000Z' },
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.getState().logout()
  ;(demoApi.start as any).mockResolvedValue(REPONSE)
})

describe('startDemo', () => {
  it('ouvre une session authentifiée et stocke le jeton', async () => {
    await useAuthStore.getState().startDemo()
    expect(localStorage.getItem('habashop_token')).toBe('JETON-DEMO')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('marque la session comme une DÉMO — c’est ce drapeau qui évite /login au 401', async () => {
    await useAuthStore.getState().startDemo()
    expect(isDemoSession()).toBe(true)
  })

  it('⚠️ une session NORMALE n’est pas marquée comme démo', () => {
    expect(isDemoSession()).toBe(false)
  })

  it('logout efface le marquage de démo', async () => {
    await useAuthStore.getState().startDemo()
    useAuthStore.getState().logout()
    expect(isDemoSession()).toBe(false)
  })

  it('⚠️ un rôle inconnu retombe sur le MOINS privilégié, jamais sur un rôle deviné', async () => {
    ;(demoApi.start as any).mockResolvedValue({ ...REPONSE, user: { ...REPONSE.user, role: 'SORCIER' } })
    await useAuthStore.getState().startDemo()
    expect(useAuthStore.getState().user?.role).toBe('CASHIER')
  })

  it('l’échéance SERVEUR est conservée telle quelle — jamais recalculée côté client', async () => {
    await useAuthStore.getState().startDemo()
    const { useAppStore } = await import('@/stores/appStore')
    expect((useAppStore.getState().tenant as any)?.demoExpiresAt).toBe('2026-10-08T12:00:00.000Z')
  })

  it('une erreur réseau ne laisse PAS une session à moitié ouverte', async () => {
    ;(demoApi.start as any).mockRejectedValue(new Error('réseau'))
    await expect(useAuthStore.getState().startDemo()).rejects.toThrow()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(localStorage.getItem('habashop_token')).toBeNull()
    expect(isDemoSession()).toBe(false)
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/demoSession.test.ts
```

- [ ] **Étape 3 : ajouter `demoApi` dans `lib/api.ts`**

À côté des autres `*Api` :

```ts
export const demoApi = {
  /** Ouvre une démo jetable. Aucun paramètre : le visiteur ne saisit rien. */
  start: () => request<{ token: string; user: any; tenant: any }>('/api/demo/start', { method: 'POST' }),
}
```
⚠️ Aligner le nom du helper (`request`/`api`/`http`) sur celui réellement utilisé par les
autres `*Api` du fichier.

- [ ] **Étape 4 : extraire `adoptSession` et ajouter `startDemo` dans `authStore.ts`**

```ts
/** Clé du marquage de session de démonstration. */
const CLE_DEMO = 'habashop_demo_session'

/** La session courante est-elle une démo jetable ? Lue par l'intercepteur 401. */
export function isDemoSession(): boolean {
  try { return localStorage.getItem(CLE_DEMO) === '1' } catch { return false }
}
```

Dans le store, une fabrique partagée par `register` et `startDemo` :

```ts
      /**
       * Adopte une session fraîchement émise par le serveur.
       * ⚠️ `register` et `startDemo` partagent CETTE fonction : deux copies divergeraient
       * sur la normalisation du rôle, et c'est elle qui empêche un rôle inconnu de devenir
       * un rôle deviné.
       */
      adoptSession: (token, user, tenant) => {
        localStorage.setItem('habashop_token', token)
        useAppStore.getState().setTenant(tenant ?? null)
        useAppStore.getState().resetCashierSession()
        useAppStore.getState().clearCart()
        set({
          user: { ...user, role: isKnownRole(user.role) ? user.role : 'CASHIER' },
          token, isAuthenticated: true, isLoading: false,
          tenants: tenant
            ? [{ id: tenant.id, name: tenant.name, currency: tenant.currency, plan: tenant.plan, logo: tenant.logo ?? null, address: tenant.address ?? null, role: 'ADMIN' }]
            : [],
          activeTenantId: tenant?.id ?? null,
        })
      },

      startDemo: async () => {
        set({ isLoading: true, error: null })
        try {
          const { token, user, tenant } = await demoApi.start()
          ;(useAuthStore.getState() as any).adoptSession(token, user, tenant)
          // ⚠️ APRÈS l'adoption : si celle-ci lève, on ne veut pas d'un marquage orphelin.
          try { localStorage.setItem(CLE_DEMO, '1') } catch { /* stockage indisponible : sans effet */ }
        } catch (err: any) {
          set({ error: err.message, isLoading: false })
          throw err
        }
      },
```

Dans `logout`, ajouter : `try { localStorage.removeItem(CLE_DEMO) } catch { /* sans effet */ }`

Puis **remplacer le corps de `register`** par un appel à `adoptSession` (la séquence y est
aujourd'hui recopiée, l.135-152). ⚠️ Déclarer `adoptSession` et `startDemo` dans `AuthState`.

- [ ] **Étape 5 : rediriger le 401 d'une démo vers la vitrine, pas vers `/login`**

Dans l'intercepteur 401 de `lib/api.ts` :

```ts
  // ⚠️ Un visiteur de démo n'a PAS de compte : l'envoyer sur /login après l'expiration de
  // sa démo lui présente un formulaire qu'il ne peut pas remplir. Le backend rend un 401
  // propre (authenticate → isUserActive ne trouve plus l'utilisateur purgé).
  if (isDemoSession()) {
    localStorage.removeItem('habashop_demo_session')
    window.location.href = '/?demo=expiree'
    return
  }
```
⚠️ Placer ce bloc **avant** la redirection existante vers `/login`, et importer `isDemoSession`
depuis `@/stores/authStore`. ⚠️ Vérifier qu'il n'introduit pas de cycle d'import
`api.ts` ↔ `authStore.ts` ; si `tsc` ou vitest le signale, déplacer `isDemoSession` et
`CLE_DEMO` dans `src/lib/demoSession.ts` et l'importer des deux côtés.

- [ ] **Étape 6 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/demoSession.test.ts
```
Attendu : 7 tests PASS.

- [ ] **Étape 7 : sabotage — supprimer la normalisation du rôle dans `adoptSession`**

Remplacer par `user`. Attendu : ÉCHEC sur « un rôle inconnu retombe sur le MOINS privilégié ».
Restaurer. ⚠️ Ce sabotage prouve du même coup que `register` et `startDemo` partagent bien la
fonction : **un seul** sabotage doit faire rougir les deux chemins.

- [ ] **Étape 8 : suite front complète + typecheck + commit**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx tsc --noEmit && npx vitest run
git add apps/frontend/src/lib/api.ts apps/frontend/src/stores/authStore.ts apps/frontend/src/tests/demoSession.test.ts
git commit -m "feat(demo): adoptSession partagée + startDemo côté front

register et startDemo étaient des jumeaux en germe : même séquence de prise
de session. Une seule fonction, et le sabotage de la normalisation du rôle
fait rougir les deux chemins — c'est elle qui empêche un rôle inconnu de
devenir un rôle deviné.

Un visiteur de démo purgée recevait un 401 propre du backend (aucune
modification serveur nécessaire, vérifié dans authenticate) mais était
envoyé sur /login — un formulaire qu'il ne peut pas remplir. Il repart
désormais vers la vitrine.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 8 : front — bouton « Essayer la démo » dans le hero

**Fichiers**
- Modifier : `apps/frontend/src/components/landing/landingShared.ts` (clé `cta_demo`, **4 blocs**)
- Modifier : `apps/frontend/src/components/landing/LandingHero.tsx` (l.68-92, zone des CTA)
- Test : `apps/frontend/src/tests/demoEntry.test.tsx`

**Interfaces**
- Consomme : `useAuthStore().startDemo` (T7) · `lp.cta_demo`
- Le hero reçoit déjà `navigate` en props ; il faut y **ajouter** `onDemo: () => void`, câblé
  dans `LandingPage.tsx`. ⚠️ Ne pas appeler le store depuis `LandingHero` : les composants de
  la vitrine reçoivent leurs actions en props (motif du fichier).

⚠️ **Le bouton n'est JAMAIS désactivé par une validation** — il n'a aucun champ à valider. Il
l'est **pendant la requête en vol seulement** (anti double-soumission), ce qui est l'exemption
nommée de `landingClaims.test.ts`. Un bouton éteint par la validation gronde avant l'erreur, ne
dit pas ce qui manque, et n'affiche **aucune infobulle au toucher**.

- [ ] **Étape 1 : écrire le test qui échoue**

```tsx
// apps/frontend/src/tests/demoEntry.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LandingHero from '@/components/landing/LandingHero'
import { LP } from '@/components/landing/landingShared'

/**
 * ENTRÉE DE LA DÉMO DEPUIS LA VITRINE.
 *
 * ⚠️ On rend le VRAI composant et on juge le DOM RENDU, pas la source : le masquage
 * conditionnel est du CSS, et la source dit ce qui est écrit, pas ce qui est affiché.
 */
const i = (fr: string) => fr

function monter(onDemo = vi.fn(), demoEnCours = false) {
  const utils = render(
    <LandingHero lp={LP.fr} i={i as any} navigate={vi.fn()} onDemo={onDemo} demoEnCours={demoEnCours} />,
  )
  return { onDemo, ...utils }
}

describe('bouton de démo du hero', () => {
  it('le bouton est présent et porte le libellé de la langue courante', () => {
    monter()
    expect(screen.getByRole('button', { name: new RegExp(LP.fr.cta_demo, 'i') })).toBeTruthy()
  })

  it('un clic déclenche l’ouverture de la démo', () => {
    const { onDemo } = monter()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(LP.fr.cta_demo, 'i') }))
    expect(onDemo).toHaveBeenCalledTimes(1)
  })

  // ── Vigilance 4 : double clic ─────────────────────────────────────────────
  it('⚠️ pendant la requête, le bouton est éteint — une seule démo par double clic', () => {
    const { onDemo } = monter(vi.fn(), true)
    const b = screen.getByRole('button', { name: /démo/i }) as HTMLButtonElement
    expect(b.disabled).toBe(true)
    fireEvent.click(b)
    expect(onDemo).not.toHaveBeenCalled()
  })

  it('⚠️ HORS requête, il n’est JAMAIS éteint — aucune validation ne le gouverne', () => {
    monter(vi.fn(), false)
    expect((screen.getByRole('button', { name: /démo/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('le CTA principal « Créer ma boutique » reste présent et premier', () => {
    monter()
    const boutons = screen.getAllByRole('button').map(b => b.textContent ?? '')
    expect(boutons.some(t => t.includes(LP.fr.cta1))).toBe(true)
    expect(boutons.findIndex(t => t.includes(LP.fr.cta1)))
      .toBeLessThan(boutons.findIndex(t => t.includes(LP.fr.cta_demo)))
  })

  it('⚠️ le libellé existe dans les QUATRE langues et aucune n’est vide', () => {
    for (const langue of ['fr', 'en', 'es', 'it'] as const) {
      expect((LP as any)[langue].cta_demo, `cta_demo manquant en ${langue}`).toBeTruthy()
      expect(String((LP as any)[langue].cta_demo).trim().length).toBeGreaterThan(0)
    }
  })

  it('⚠️ les quatre libellés sont DISTINCTS — un copier-coller du français se verrait ici', () => {
    const vus = new Set(['fr', 'en', 'es', 'it'].map(l => (LP as any)[l].cta_demo))
    expect(vus.size).toBeGreaterThan(1)
  })
})
```

⚠️ Vérifier le nom réel de l'export des libellés dans `landingShared.ts` (`LP`, `LANDING_T`,
`T`…) et l'aligner dans le test **et** dans l'import.

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/demoEntry.test.tsx
```

- [ ] **Étape 3 : ajouter la clé dans les QUATRE blocs de `landingShared.ts`**

À côté de `cta1` / `cta2`, dans chaque bloc de langue :

```ts
    cta_demo: 'Essayer la démo',          // bloc fr
    cta_demo: 'Try the demo',             // bloc en
    cta_demo: 'Probar la demo',           // bloc es
    cta_demo: 'Prova la demo',            // bloc it
```
⚠️ Les **quatre**, jamais un binaire FR/EN — et ajouter le champ au type `LandingT`, sinon
`tsc` refusera les trois autres blocs.

- [ ] **Étape 4 : ajouter le bouton dans `LandingHero.tsx`**

Élargir les props :

```ts
interface Props {
  lp: LandingT
  i: (fr: string, en: string, es: string, it: string) => string
  navigate: (to: string) => void
  /** Ouvre une démo jetable. Fournie par `LandingPage` — le hero n'appelle pas le store. */
  onDemo: () => void
  /** Requête en vol : le bouton s'éteint le temps de l'aller-retour (anti double-soumission). */
  demoEnCours: boolean
}
```

Après le bouton `cta2` (l.81-92) :

```tsx
            <button type="button" onClick={onDemo}
              /* ⚠️ `disabled` UNIQUEMENT pendant la requête en vol — exemption nommée de
                 `landingClaims.test.ts`. Aucune validation ne gouverne ce bouton : il n'a
                 aucun champ à remplir, et un bouton éteint par la validation gronde avant
                 l'erreur sans dire ce qui manque. */
              disabled={demoEnCours}
              aria-busy={demoEnCours}
              style={{
                padding: '13px 22px', minHeight: 'var(--touch-min)', borderRadius: 12,
                background: 'transparent', border: `1px solid ${D.border2}`,
                color: D.text, fontSize: 'var(--fs-body)', fontWeight: 700,
                fontFamily: FONT, cursor: demoEnCours ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                opacity: demoEnCours ? 0.6 : 1, transition: 'opacity .15s, background .15s',
              }}
            >
              <Play size={16} strokeWidth={2.6} aria-hidden="true" />
              {demoEnCours ? i('Ouverture…', 'Opening…', 'Abriendo…', 'Apertura…') : lp.cta_demo}
            </button>
```
Ajouter `Play` à l'import `lucide-react` du fichier. ⚠️ Icônes Lucide uniquement, pas d'emoji.

- [ ] **Étape 5 : câbler dans `LandingPage.tsx`**

```tsx
  const [demoEnCours, setDemoEnCours] = useState(false)
  const ouvrirDemo = async () => {
    setDemoEnCours(true)
    try {
      await useAuthStore.getState().startDemo()
      navigate('/app/dashboard')
    } catch (e: any) {
      // ⚠️ On NOMME l'échec — un bouton qui ne répond pas laisse le visiteur sans information.
      toast.error(e?.message ?? i('Impossible d’ouvrir la démo. Créez votre boutique, l’essai est gratuit.',
        'Could not open the demo. Create your shop — the trial is free.',
        'No se pudo abrir la demo. Cree su tienda: la prueba es gratuita.',
        'Impossibile aprire la demo. Crea il tuo negozio: la prova è gratuita.'))
      setDemoEnCours(false)
    }
  }
```
et passer `onDemo={ouvrirDemo} demoEnCours={demoEnCours}` à `<LandingHero …/>`.
⚠️ Ne pas remettre `setDemoEnCours(false)` en cas de succès : la navigation démonte le
composant, et le remettre à `false` avant ferait clignoter le bouton.

- [ ] **Étape 6 : lancer le test + la suite front COMPLÈTE**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run
```
⚠️ **Suite complète obligatoire** : ce commit touche la landing, donc
`landing.anchor.test.tsx` (qui fige le H1 du hero) et `landingClaims.test.ts` doivent être
exercés.

- [ ] **Étape 7 : vérifier le rendu à 390 px — le DOM, pas la source**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npm run e2e:density
```
⚠️ Le budget de largeur du hero à 390 px est **serré** et déjà mesuré. Si le bouton déborde ou
s'enroule, **corriger la CONTRAINTE** (empiler les CTA en colonne sous 480 px), jamais
raccourcir le libellé — et se rappeler que l'espagnol et l'italien rallongent.

- [ ] **Étape 8 : sabotage — éteindre le bouton par autre chose que la requête**

Remplacer `disabled={demoEnCours}` par `disabled={demoEnCours || !lp.cta_demo}`.
Attendu : `landingClaims.test.ts` doit rougir (désactivation hors requête en vol). Si ce
n'est pas le cas, **c'est le verrou qu'il faut corriger**, pas le sabotage : sa règle vise la
forme « éteint parce qu'un champ n'est pas rempli ». Restaurer.

- [ ] **Étape 9 : commit**

```bash
set -euo pipefail
git add apps/frontend/src/components/landing/LandingHero.tsx apps/frontend/src/components/landing/landingShared.ts apps/frontend/src/pages/LandingPage.tsx apps/frontend/src/tests/demoEntry.test.tsx
git commit -m "feat(demo): bouton « Essayer la démo » en second rang du hero

Là où le visiteur décide, sans concurrencer l'inscription qui reste
l'objectif : le CTA principal passe toujours en premier, vérifié sur le DOM
rendu et non sur la source.

Éteint PENDANT la requête seulement (anti double-soumission) — jamais par une
validation : le bouton n'a aucun champ à remplir, et un bouton éteint gronde
avant l'erreur sans dire ce qui manque, sans infobulle au toucher.

Libellé dans les quatre langues, et les quatre sont distincts — un
copier-coller du français fait rougir le verrou.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 9 : front — bandeau d'échéance de la démo

**Fichiers**
- Créer : `apps/frontend/src/components/layout/DemoBanner.tsx`
- Modifier : `apps/frontend/src/components/layout/AppLayout.tsx` (insertion du bandeau)
- Test : `apps/frontend/src/tests/demoBanner.test.tsx`

⚠️ **L'échéance vient du SERVEUR** (`tenant.demoExpiresAt`), jamais d'un « +7 jours » recalculé
côté client. Un champ recalculé est un champ déclaré : il ne peut pas être faux, donc il ne
prouve rien — et il mentirait dès que le TTL serveur changerait.

⚠️ **`fmtDate()` de `lib/formatDate.ts`**, jamais `new Date(iso).toLocaleDateString()` : ce
dernier décale le jour d'un cran en fuseau négatif (le 05 s'affiche « 04 »).

- [ ] **Étape 1 : écrire le test qui échoue**

```tsx
// apps/frontend/src/tests/demoBanner.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DemoBanner from '@/components/layout/DemoBanner'

describe('DemoBanner', () => {
  it('affiche l’échéance SERVEUR, formatée jj/mm/aaaa', () => {
    render(<DemoBanner demoExpiresAt="2026-10-08T12:00:00.000Z" maintenant={new Date('2026-10-01T12:00:00.000Z')} />)
    expect(screen.getByText(/08\/10\/2026/)).toBeTruthy()
  })

  it('⚠️ sans échéance, le bandeau ne s’affiche PAS — pas de bandeau sur une vraie boutique', () => {
    const { container } = render(<DemoBanner demoExpiresAt={null} maintenant={new Date()} />)
    expect(container.textContent?.trim()).toBe('')
  })

  it('⚠️ une échéance illisible n’affiche AUCUNE date plutôt qu’une date fausse', () => {
    render(<DemoBanner demoExpiresAt="pas-une-date" maintenant={new Date('2026-10-01T12:00:00.000Z')} />)
    expect(screen.queryByText(/NaN|Invalid/i)).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy() // le bandeau se dit quand même démo
  })

  it('dit qu’il s’agit d’une démonstration, pas seulement une date', () => {
    render(<DemoBanner demoExpiresAt="2026-10-08T12:00:00.000Z" maintenant={new Date('2026-10-01T12:00:00.000Z')} />)
    expect(screen.getByRole('status').textContent).toMatch(/démonstration|demo/i)
  })

  it('⚠️ une démo DÉJÀ expirée le dit — et ne prétend pas expirer dans le futur', () => {
    render(<DemoBanner demoExpiresAt="2026-09-01T12:00:00.000Z" maintenant={new Date('2026-10-01T12:00:00.000Z')} />)
    expect(screen.getByRole('status').textContent).toMatch(/expirée|expired/i)
  })

  it('porte un `role=status` — le changement d’état est annoncé aux lecteurs d’écran', () => {
    render(<DemoBanner demoExpiresAt="2026-10-08T12:00:00.000Z" maintenant={new Date('2026-10-01T12:00:00.000Z')} />)
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })
})
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/demoBanner.test.tsx
```

- [ ] **Étape 3 : écrire le composant**

```tsx
// apps/frontend/src/components/layout/DemoBanner.tsx
import { FlaskConical } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { fmtDate } from '@/lib/formatDate'

interface Props {
  /** `Tenant.demoExpiresAt` tel que le SERVEUR l'a rendu. `null` = pas une démo jetable. */
  demoExpiresAt: string | null | undefined
  /** ⚠️ Injectable : jamais de `new Date()` littéral dans le rendu (convention du dépôt). */
  maintenant?: Date
}

/**
 * Bandeau d'une démo jetable.
 *
 * ⚠️ L'échéance vient du SERVEUR. Un « +7 jours » recalculé côté client serait un champ
 * DÉCLARÉ : il ne pourrait pas être faux, donc il ne prouverait rien — et il mentirait dès
 * que le TTL serveur changerait.
 *
 * ⚠️ Une échéance illisible n'affiche AUCUNE date : mieux vaut un bandeau sans date qu'une
 * date fausse. Le bandeau se dit quand même « démonstration », parce que c'est vrai.
 */
export default function DemoBanner({ demoExpiresAt, maintenant = new Date() }: Props) {
  const { i } = useI18n()
  if (!demoExpiresAt) return null

  const echeance = new Date(demoExpiresAt)
  const lisible = !Number.isNaN(echeance.getTime())
  const expiree = lisible && echeance.getTime() <= maintenant.getTime()

  const texte = !lisible
    ? i('Boutique de démonstration', 'Demo shop', 'Tienda de demostración', 'Negozio dimostrativo')
    : expiree
      ? i('Démonstration expirée', 'Demo expired', 'Demostración caducada', 'Dimostrazione scaduta')
      : i(
          `Démonstration — expire le ${fmtDate(demoExpiresAt)}`,
          `Demo — expires on ${fmtDate(demoExpiresAt)}`,
          `Demostración — caduca el ${fmtDate(demoExpiresAt)}`,
          `Dimostrazione — scade il ${fmtDate(demoExpiresAt)}`,
        )

  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', fontSize: 'var(--fs-sm)', fontWeight: 600,
      background: expiree ? 'var(--c-red-bg)' : 'var(--c-amber-bg)',
      borderBottom: `1px solid ${expiree ? 'var(--c-red-border)' : 'var(--c-amber-border)'}`,
      color: 'var(--text)',
    }}>
      <FlaskConical size={15} strokeWidth={2.3} aria-hidden="true" />
      <span>{texte}</span>
    </div>
  )
}
```

- [ ] **Étape 4 : insérer dans `AppLayout.tsx`**

Au-dessus du contenu, en lisant le tenant du store :

```tsx
      <DemoBanner demoExpiresAt={(tenant as any)?.demoExpiresAt ?? null} />
```
⚠️ Vérifier le nom réel du sélecteur de tenant dans `AppLayout` et l'employer ; ajouter
`demoExpiresAt?: string | null` au type `Tenant` du front plutôt que de laisser un `as any`
définitif.

- [ ] **Étape 5 : lancer le test, vérifier qu'il passe**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run src/tests/demoBanner.test.tsx
```
Attendu : 6 tests PASS.

- [ ] **Étape 6 : sabotage — recalculer l'échéance côté client**

Remplacer le corps par un `+7 jours` depuis `maintenant`. Attendu : ÉCHEC sur « affiche
l'échéance SERVEUR » **et** sur « une démo DÉJÀ expirée le dit ». Restaurer.

- [ ] **Étape 7 : contraste AA sur les deux thèmes + suite complète + commit**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend && npx vitest run && npx tsc --noEmit
git add apps/frontend/src/components/layout/DemoBanner.tsx apps/frontend/src/components/layout/AppLayout.tsx apps/frontend/src/tests/demoBanner.test.tsx apps/frontend/src/lib/api.ts
git commit -m "feat(demo): bandeau d'échéance, date du SERVEUR

Un « +7 jours » recalculé côté client serait un champ déclaré : il ne
pourrait pas être faux, donc ne prouverait rien, et mentirait dès que le TTL
serveur changerait.

Une échéance illisible n'affiche AUCUNE date — mieux vaut un bandeau sans
date qu'une date fausse ; le bandeau se dit quand même démonstration, parce
que c'est vrai. fmtDate, jamais toLocaleDateString (qui décale le jour d'un
cran en fuseau négatif).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 10 : vérification de bout en bout, bump de version, déploiement

- [ ] **Étape 1 : rituel complet, les DEUX workspaces**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend  && npx tsc --noEmit && npx vitest run
cd ../frontend   && npx tsc --noEmit && npx vitest run
cd /Users/nelson/Documents/Projets/habashop
npm run lint --workspaces
npm run build --workspace=apps/backend
npm run build --workspace=apps/frontend
```
⚠️ Les deux lints sont des cliquets : **zéro nouvel avertissement**. S'il y en a, les retirer —
ne jamais relever le plafond.

- [ ] **Étape 2 : les gardes d'artefact**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/frontend
npm run verify:demo-flag
npm run verify:sw-routes
npm run verify:seo-urls
npm run verify:classes
```
⚠️ **`verify:demo-flag` doit rester VERT** : ce chantier ne met aucun mot de passe démo dans le
bundle. S'il rougit, c'est que quelque chose a introduit `demo1234` — c'est le signal, pas un
inconvénient.

- [ ] **Étape 3 : bump de version à la racine**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm version minor --no-git-tag-version
npm run build --workspace=apps/backend   # régénère src/version.generated.ts
git add package.json package-lock.json apps/backend/src/version.generated.ts
```
⚠️ **Fonctionnalité visible ⇒ `minor`.** Et `version.generated.ts` doit être **commité** : en
Docker, `gen-version` ne trouve pas la racine et no-op, c'est le fichier commité qui fait foi.

- [ ] **Étape 4 : lockfile Docker si une dépendance backend a bougé**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run lock:backend
```
Aucune dépendance n'est ajoutée par ce plan — mais si `npm run build --workspace=apps/backend`
a modifié `apps/backend/package.json`, cette commande est obligatoire.

- [ ] **Étape 5 : commit et push**

```bash
set -euo pipefail
git commit -m "chore(release): démo jetable en libre-service

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```
⚠️ **Après le push : NE RIEN LANCER.** `main` auto-déploie sur les DEUX plateformes. Ne pas
lancer `vercel --prod`, ne pas lancer `railway up --ci` — c'est redondant et ça brûle le quota.

- [ ] **Étape 6 : vérifier le déploiement (ne pas le provoquer)**

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npm run smoke:version --workspace=apps/backend
```
⚠️ Le smoke reste **vert si le déploiement n'a pas eu lieu** quand la version n'a pas bougé —
ici elle a bougé, donc il mord. Vérifier aussi un déploiement Vercel `● Ready` **postérieur**
au merge.

- [ ] **Étape 7 : preuve en production — LECTURE SEULE, puis tenant JETABLE**

La démo jetable **est** le motif du tenant jetable autorisé : on en ouvre une, on la regarde,
on la détruit.

L'URL de l'API se lit dans `apps/frontend/.env.production` (`VITE_API_URL`) — ne pas la
recopier ici, ce plan se périmerait. **Et on MESURE la durée**, c'est le point ouvert §5.2 de
la spec :

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
API=$(grep -E '^VITE_API_URL=' apps/frontend/.env.production | cut -d= -f2- | tr -d '"' | sed 's#/*$##')
curl -s -o /tmp/demo-start.json -w "durée totale : %{time_total}s · code : %{http_code}\n" \
  -X POST "$API/api/demo/start"
head -c 400 /tmp/demo-start.json
```
⚠️ **Au-delà de ~4 s, le bouton ne tient plus** : un visiteur abandonne. Si la mesure dépasse,
réduire `VENTES` dans `demoDataset.ts` et **re-mesurer** — ne pas répondre avant que le jeu
soit complet (une démo à moitié remplie se lit comme un produit cassé), et ne pas se contenter
de supposer que c'est rapide.
Puis, **en lecture seule**, vérifier que le tenant créé porte bien `isDemo`, `demoExpiresAt`,
`vatRate = 18`, `currency = XOF`, et compter ses lignes. Enfin, le détruire en appelant
`runDemoPurge` avec un `now` postérieur à son échéance, **sur ce seul tenant** :

```bash
set -euo pipefail
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd apps/backend && CONFIRM=1 npx tsx -e "
import { PrismaClient } from '@prisma/client'
import { hardDeleteTenant } from './src/lib/tenantPurge'
import { isEphemeralDemoId } from './src/lib/demoLifetime'
if (process.env.CONFIRM !== '1') { console.error('CONFIRM=1 requis'); process.exit(1) }
const id = process.env.TENANT_ID
if (!isEphemeralDemoId(id ?? '')) { console.error('❌ périmètre : demo-tmp- uniquement'); process.exit(1) }
const p = new PrismaClient()
const avant = await p.tenant.count({ where: { id } })
const compte = await p.\$transaction(async (tx) => hardDeleteTenant(tx as never, id), { timeout: 60000 })
const apres = await p.tenant.count({ where: { id } })
console.log({ avant, apres, compte })
if (avant !== 1 || apres !== 0) { console.error('❌ état final inattendu'); process.exit(1) }
await p.\$disconnect()
"
```
⚠️ **Périmètre EN DUR sur le préfixe `demo-tmp-` + `CONFIRM=1`** : la règle du ménage sur tenant
réel. Et l'**état final est vérifié** — une suppression silencieuse est une suppression non
prouvée.

⚠️ **Aucune mutation d'un tenant existant, aucun envoi réel** à aucun moment de cette étape.
