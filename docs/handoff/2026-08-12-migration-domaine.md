# Migration vers un domaine propre — inventaire MESURÉ et ordre d'exécution

> Écrit le 2026-08-12, avant l'achat du domaine. **Tout ce qui suit a été compté, pas
> listé de mémoire** — un périmètre écrit à la main est faux dès qu'on ajoute un fichier.
> Recompter avant d'exécuter : `grep -rl "habashop.vercel.app" apps mobile legal .github`

## Ce qui rend cette migration SÛRE — à lire en premier

⚠️ **L'ancien domaine ne meurt pas.** Vercel conserve `habashop.vercel.app` quand on
ajoute un domaine propre ; Railway conserve `habashop-production.up.railway.app`. Les
deux servent **en même temps**. Cette migration se fait donc **par ajout**, jamais par
remplacement — on n'est jamais dans un état où plus rien ne répond.

Corollaire : **rien n'oblige à tout faire le même jour**, et l'ordre ci-dessous n'est
contraignant que sur un point (le CORS, § Piège nº 1).

## L'état de départ, compté

| | Nombre | Risque |
|---|---|---|
| Fichiers portant `habashop.vercel.app` | **51** | — |
| dont specs E2E (`process.env.X ?? défaut`) | 23 | **nul** — surchargeables |
| dont tests unitaires | 3 | nul |
| dont documentation | 14 | nul |
| **dont CODE ou CONFIGURATION** | **~15** | **c'est là que tout se joue** |

## Les surfaces qui CASSENT si on les oublie

| Fichier | Ce qui arrive si on l'oublie |
|---|---|
| `apps/backend/src/server.ts:122` | ⚠️ **LE PLUS DANGEREUX.** L'origine autorisée par CORS est en DUR. Le front sur le nouveau domaine → **toutes les requêtes API bloquées**, application vide. Cf. Piège nº 1. |
| `apps/frontend/.env:8` | Défaut de `VITE_APP_URL` (fichier **suivi par git**). Si l'environnement Vercel n'est pas posé, le build retombe ici — `canonical` et `og:url` pointent l'ancien domaine, et un canonical faux **désindexe**. |
| `apps/frontend/src/lib/appUrl.ts:5` | Liens user-facing du front (Privacy ×4, PublicCatalog ×2). |
| `apps/frontend/scripts/gen-seo.mjs:29` | `sitemap.xml` et `robots.txt` — produits au build, hors pipeline Vite. |
| `mobile/src/lib/appUrl.ts:23` | Liens imprimés par l'app mobile. |
| `apps/frontend/src/components/settings/SectionCatalog.tsx:45` | Repli quand `window` est absent — l'URL de catalogue proposée au commerçant. |
| `apps/frontend/src/pages/Integrations.tsx:226-227` | Console Ops : `endpoint` déclaré + `pingUrl` réellement sondée. |
| `mobile/assets/feature_graphic.svg` | ⚠️ **L'URL est CUITE dans le visuel Play Store** (1024×500). À re-rendre ET **re-téléverser** à la console — ce n'est pas un fichier de code, c'est un asset de fiche. |

**Sans effet, à ne pas confondre avec les précédents** : `schema.prisma:68` (commentaire),
`admin.ts:259` (adresse e-mail FACTICE `test@…`, déjà exemptée par `appUrlSource.test.ts`),
`ci.yml:316` (ligne de résumé), `playwright.config.ts` et les 23 specs (surchargeables).

## Ce que je ne peux PAS faire — quatre plateformes

| Plateforme | Geste | Qui |
|---|---|---|
| Cloudflare | déléguer les NS, brancher `img.` sur R2 | **Nelson** |
| Vercel | ajouter le domaine au projet | **Nelson** |
| Railway | `FRONTEND_URL` | Nelson (ou moi, ce n'est pas un secret) |
| EAS | `EXPO_PUBLIC_APP_URL` | Nelson ⚠️ **jamais posée à ce jour** (mesuré) — donc le mobile tourne sur le repli littéral |
| Google Play | URL de politique + visuel | **Nelson** — ⚠️ déclenche une **revue** |

## Ordre d'exécution

**Phase 0 — le domaine.** Achat, puis délégation des serveurs de noms à Cloudflare (la
zone doit être dans le compte qui porte le bucket). Quelques heures de propagation.
⚠️ **Garder la racine pour l'application** : brancher R2 sur `img.` ou `cdn.`.

**Phase 1 — R2 (indépendante, sans risque).** Bucket → Settings → Public access →
Connect a custom domain, puis `railway variables --set "R2_PUBLIC_BASE_URL=https://img.…"`.
Vérifier par `CONFIRM=1 … railway run npx tsx prisma/verify-r2-e2e.ts` — seule chose qui
prouve que le domaine SERT les octets. ⚠️ À faire **tant que le bucket est vide** : après,
les URL déjà en base restent sur l'ancien domaine et le nettoyage ne les reconnaît plus.

**Phase 2 — l'application.** Dans CET ordre :

1. Ajouter le domaine sur Vercel (les deux servent alors).
2. ⚠️ **CORS D'ABORD** — ajouter la nouvelle origine dans `server.ts`, **en gardant
   l'ancienne**, et déployer. Cf. Piège nº 1.
3. `FRONTEND_URL` sur Railway · `VITE_APP_URL` sur Vercel.
4. Les 3 `DEFAULT_APP_URL` + `apps/frontend/.env` + `Integrations.tsx` + `SectionCatalog.tsx`.
5. Déployer, puis `npm run verify:seo-urls --workspace=apps/frontend` — il inspecte le
   `dist/` LIVRÉ : c'est lui qui attrape un `canonical` resté sur l'ancien domaine.
6. Ne retirer l'ancienne origine du CORS que **plus tard**, une fois tout stabilisé.

**Phase 3 — mobile.** `eas env:create --environment preview --name EXPO_PUBLIC_APP_URL`.
⚠️ Une variable `EXPO_PUBLIC_*` est **inlinée au bundling** : il faut une nouvelle OTA
pour qu'elle prenne effet, pas seulement la poser.

**Phase 4 — Play Store.** Re-rendre `feature_graphic.svg`, le téléverser, et corriger
l'URL de politique de confidentialité. ⚠️ **Revue de plusieurs jours** — à lancer en
dernier, quand les URL sont stables et vivantes.

## Les pièges

**Nº 1 — le CORS en dur, et l'ordre qu'il impose.** `server.ts` autorise
`https://habashop.vercel.app` en littéral, plus `FRONTEND_URL`. Si l'on change
`FRONTEND_URL` **avant** d'ajouter la nouvelle origine, le front servi depuis le nouveau
domaine voit **toutes** ses requêtes refusées : écran vide, aucune erreur parlante.
Ajouter d'abord, retirer bien après.

**Nº 2 — deux URL de politique de confidentialité coexistent, toutes deux VIVANTES**
(vérifié, HTTP 200) : `https://habashop.vercel.app/privacy` et
`https://ndjoumessi.github.io/habashop/legal/`. La documentation cite les deux à des
endroits différents. ⚠️ **Il faut lire Play Console pour savoir laquelle est déclarée** —
je ne peux pas. Casser celle-là, c'est risquer le retrait de la fiche.

**Nº 3 — l'URL de l'API est un SECOND axe**, à ne pas mélanger. Quatre replis
`VITE_API_URL ?? 'https://habashop-production.up.railway.app'`
(`notificationStore`, `useOnlineStatus`, `OpsInfrastructure`, `verify-sw-routes`) plus
`APIDocs.tsx` qui l'AFFICHE à l'écran. Migrer l'API vers `api.…` est un chantier séparé,
avec son propre CORS et son propre risque. **Ne pas le faire le même jour.**

**Nº 4 — `apps/frontend/.env` est suivi par git.** Y mettre la bonne valeur est
nécessaire (c'est le repli du build) mais **jamais suffisant** : c'est l'environnement
Vercel qui décide. Et si la variable manque au build, Vite livre le littéral
`%VITE_APP_URL%` — un canonical cassé, pire que l'ancienne URL.

## Vérifications, après chaque phase

```bash
npm run verify:seo-urls --workspace=apps/frontend   # dist/ livré : aucun marqueur non substitué
npm run verify:sw-routes --workspace=apps/frontend  # l'ordre des règles SW survit au changement d'hôte
CONFIRM=1 VERIFY_DATABASE_URL=… railway run npx tsx apps/backend/prisma/verify-r2-e2e.ts
```

Et le contrôle qui compte le plus, à faire sur l'artefact SERVI et non sur la source :

```bash
curl -s https://LE-NOUVEAU-DOMAINE/ | grep -oE '<link rel="canonical"[^>]*>'
```
