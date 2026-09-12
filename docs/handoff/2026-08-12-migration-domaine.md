# Migration vers un domaine propre — inventaire MESURÉ et ordre d'exécution

> Écrit le 2026-08-12, avant l'achat du domaine. **Tout ce qui suit a été compté, pas
> listé de mémoire** — un périmètre écrit à la main est faux dès qu'on ajoute un fichier.
>
> ## ⚠️ MISE À JOUR DU 2026-09-12 — trois choses ont changé, dont une qui BLOQUE la phase 0
>
> **(a) `habashop.com` N'EST PAS DISPONIBLE.** Mesuré : `Creation Date: 2001-04-25`, registrar
> Key-Systems GmbH, serveurs de noms `domaindiscount24`, enregistrement A vers `193.158.2.130`.
> Le domaine appartient à un tiers depuis vingt-cinq ans. **La phase 0 ne commence donc pas par
> un achat, mais par un CHOIX de nom.** ⚠️ Ce dépôt contient déjà une trace de la confusion :
> `apps/frontend/.env.production:2` avertit « NE PAS remettre api.habashop.com : ce domaine ne
> résout pas » — quelqu'un l'avait câblé en supposant qu'il était à nous, et la prod ne marchait
> que parce que la variable Vercel écrasait le fichier. *Vérifier la propriété d'un domaine AVANT
> d'écrire son nom quelque part.*
>
> **(b) Le PIÈGE Nº 1 EST DISSOUS** — le CORS n'est plus en dur, cf. § Piège nº 1 réécrit.
>
> **(c) La bascule du dépôt est OUTILLÉE** : `node scripts/migrer-domaine.mjs --to https://…`
> (simulation par défaut, `--appliquer` pour écrire). Périmètre **dérivé** de `git grep`,
> 11 ancres **assertées**, exemptions **nommées** ; il **échoue** sur un fichier non classé.
>
> Recompter reste la première chose à faire : `git grep -l "habashop.vercel.app"`.

## Ce qui rend cette migration SÛRE — à lire en premier

⚠️ **L'ancien domaine ne meurt pas.** Vercel conserve `habashop.vercel.app` quand on
ajoute un domaine propre ; Railway conserve `habashop-production.up.railway.app`. Les
deux servent **en même temps**. Cette migration se fait donc **par ajout**, jamais par
remplacement — on n'est jamais dans un état où plus rien ne répond.

Corollaire : **rien n'oblige à tout faire le même jour**, et l'ordre ci-dessous n'est
contraignant que sur un point (le CORS, § Piège nº 1).

## L'état de départ, compté

Recompté le **2026-09-12** sur les fichiers **suivis par git** (le comptage du 2026-08-12
balayait aussi `dist/`, d'où l'écart) :

| | 2026-08-12 | 2026-09-12 | Risque |
|---|---|---|---|
| Fichiers portant `habashop.vercel.app` (dépôt entier) | 51 | **57** | — |
| dont specs E2E + config (`process.env.X ?? défaut`) | 23 | 23 | **nul** — surchargeables |
| dont tests unitaires / méta-tests | 3 | 4 | nul — ils jugent l'ÉGALITÉ, pas la valeur |
| dont documentation | 14 | 19 | nul — et une partie **DATE** l'hôte historique |
| **dont CODE, CONFIGURATION ou CONTRAT** | ~15 | **11 ancres** | **c'est là que tout se joue** |

⚠️ **Le total monte alors que le travail baisse** : ce qui compte n'est pas le nombre de
mentions, c'est le nombre de **surfaces qui décident**. Les 11 sont désormais nommées et
réécrites par le script.

## Les surfaces qui CASSENT si on les oublie

| Fichier | Ce qui arrive si on l'oublie |
|---|---|
| ~~`apps/backend/src/server.ts:122`~~ | ✅ **TRAITÉ le 2026-09-12** — la liste vit dans `lib/corsOrigins.ts` et se pose par variable. Ce n'est plus une surface de code. Cf. Piège nº 1. |
| `apps/frontend/.env:8` | Défaut de `VITE_APP_URL` (fichier **suivi par git**). Si l'environnement Vercel n'est pas posé, le build retombe ici — `canonical` et `og:url` pointent l'ancien domaine, et un canonical faux **désindexe**. |
| `apps/frontend/src/lib/appUrl.ts:5` | Liens user-facing du front (Privacy ×4, PublicCatalog ×2). |
| `apps/frontend/scripts/gen-seo.mjs:29` | `sitemap.xml` et `robots.txt` — produits au build, hors pipeline Vite. |
| `mobile/src/lib/appUrl.ts:23` | Liens imprimés par l'app mobile. |
| `apps/frontend/src/components/settings/SectionCatalog.tsx:45` | Repli quand `window` est absent — l'URL de catalogue proposée au commerçant. |
| `apps/frontend/src/pages/Integrations.tsx:226-227` | Console Ops : `endpoint` déclaré + `pingUrl` réellement sondée. |
| `legal/terms.html:59` | ⚠️ **ABSENTE de l'inventaire du 2026-08-12** — trouvée le 09-12. Les CGU **DÉSIGNENT le service** par cette URL, dans un texte contractuel accepté à l'inscription. |
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

**Phase 0 — CHOISIR, puis acheter.** ⚠️ `habashop.com` est pris depuis 2001 (mesuré le
2026-09-12) : il faut d'abord arrêter un nom **disponible**, et le vérifier avant de l'écrire
où que ce soit. Puis achat, puis délégation des serveurs de noms à Cloudflare (la zone doit
être dans le compte qui porte le bucket). Quelques heures de propagation.
⚠️ **Garder la racine pour l'application** : brancher R2 sur `img.` ou `cdn.`.
⚠️ **Le nom décide aussi de l'e-mail** : c'est ce domaine qu'on vérifie chez Resend, et sans
domaine vérifié l'expédition reste sur la réputation partagée `resend.dev` — ce qui bloque
aussi la vérification du canal Google Play.

**Phase 1 — R2 (indépendante, sans risque).** Bucket → Settings → Public access →
Connect a custom domain, puis `railway variables --set "R2_PUBLIC_BASE_URL=https://img.…"`.
Vérifier par `CONFIRM=1 … railway run npx tsx prisma/verify-r2-e2e.ts` — seule chose qui
prouve que le domaine SERT les octets. ⚠️ À faire **tant que le bucket est vide** : après,
les URL déjà en base restent sur l'ancien domaine et le nettoyage ne les reconnaît plus.

**Phase 2 — l'application.** Dans CET ordre :

1. `railway variables --set "CORS_EXTRA_ORIGINS=https://LE-NOUVEAU"` — **d'abord, et sans
   redéploiement de code.** L'API accepte alors la future origine avant qu'elle n'existe.
2. Ajouter le domaine sur Vercel (les deux servent alors).
3. `FRONTEND_URL` sur Railway · `VITE_APP_URL` sur Vercel.
4. `node scripts/migrer-domaine.mjs --to https://LE-NOUVEAU` puis `--appliquer` — les 11 ancres
   de code, de configuration et de contrat, en une fois. Relire le diff : il est petit.
5. Déployer, puis `npm run verify:seo-urls --workspace=apps/frontend` — il inspecte le
   `dist/` LIVRÉ : c'est lui qui attrape un `canonical` resté sur l'ancien domaine.
6. Ne retirer l'ancienne origine (`LEGACY_APP_ORIGIN`) que **plus tard**, une fois tout
   stabilisé — et c'est alors la seule étape qui demande encore un déploiement de code.

⚠️ **Les étapes 1 et 3 ne sont plus soudées.** C'est tout le gain : on peut s'arrêter, vérifier,
reprendre le lendemain, sans fenêtre où le front neuf parle à une API qui le refuse.

**Phase 3 — mobile.** `eas env:create --environment preview --name EXPO_PUBLIC_APP_URL`.
⚠️ Une variable `EXPO_PUBLIC_*` est **inlinée au bundling** : il faut une nouvelle OTA
pour qu'elle prenne effet, pas seulement la poser.

**Phase 4 — Play Store.** Re-rendre `feature_graphic.svg`, le téléverser, et corriger
l'URL de politique de confidentialité. ⚠️ **Revue de plusieurs jours** — à lancer en
dernier, quand les URL sont stables et vivantes.

## Les pièges

**Nº 1 — ✅ DISSOUS le 2026-09-12, et un second défaut trouvé au passage.**

*Avant :* `server.ts` autorisait le littéral plus `FRONTEND_URL`, et rien d'autre. La seule
façon d'autoriser la nouvelle origine était de basculer `FRONTEND_URL` — la variable qui change
aussi tous les liens d'e-mail. Les deux gestes étaient donc **soudés**, et les faire dans le
mauvais ordre donnait un écran vide sans erreur parlante.

*Maintenant :* `lib/corsOrigins.ts` est la source unique, et **`CORS_EXTRA_ORIGINS`** autorise la
nouvelle origine **sans redéploiement et sans toucher `FRONTEND_URL`**. On pose la variable, on
bascule quand on veut. L'ancienne origine reste autorisée en dur : la migration est un AJOUT.

⚠️ **Le second défaut, latent depuis toujours et jamais déclenché faute de migration** :
`FRONTEND_URL` avait **deux lecteurs qui ne normalisaient pas pareil**. `lib/appUrl.ts` retire la
barre oblique finale ; `server.ts` poussait la valeur **brute** dans la liste CORS. Poser
`FRONTEND_URL=https://app.exemple.com/` — la forme qu'on copie depuis une barre d'adresse —
donnait donc des **e-mails justes** et une **application morte** : le navigateur envoie
`Origin: https://app.exemple.com`, sans barre, aucune correspondance, tout refusé. C'était le
jumeau non traité de `appBaseUrl`, sur le chemin le plus sensible du jour J. Les deux lectures
sont désormais épinglées l'une à l'autre par `corsOrigins.test.ts` (15 tests, **3 sabotages
vérifiés**, assertions sur la **réponse HTTP réelle** et non sur la logique rejouée).

⚠️ **Un rejet se DIT.** Une entrée malformée (schéma oublié, chemin, joker) produit exactement le
même écran vide qu'un oubli : elle ressort dans les logs au démarrage au lieu d'être écartée en
silence. ⚠️ **Aucun joker, délibérément** : `*.vercel.app` ouvrirait l'API du commerçant au site
de n'importe quel utilisateur de Vercel. Les prévisualisations de PR restent donc hors CORS.

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
