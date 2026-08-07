# HabaShop — Guide Claude Code

SaaS de gestion commerciale multi-tenant **et multi-boutiques** (boutiques/superettes, Afrique de l'Ouest). **Monorepo unique `habashop`** : web (npm workspaces `apps/*`) + `mobile/` (Expo, hors workspaces) + `legal/` (pages légales).

## Stack

- **Frontend** (`apps/frontend`) : React 18 + TS + Vite 8 + vitest 4, Zustand (persisté localStorage), React Router 7 (API déclarative classique — BrowserRouter/Routes/Route + hooks ; migré depuis 6.30 pour les CVE open-redirect, quasi drop-in), Lucide, recharts, jsbarcode (EAN-13/EAN-8/UPC-A), @zxing (scan), qrcode+html2canvas (fidélité), jspdf (étiquettes thermiques, **import dynamique**), cmdk (GlobalSearch), Playwright E2E, Sentry (org **haba-76** / projet **habashop-web**), PWA vite-plugin-pwa 1.x. Chunks `charts`/`barcode`/`canvas`/`pdf` EXCLUS du precache (runtime CacheFirst `lazy-chunks-cache`) — préserver si on touche `vite.config.ts`. ⚠️ **Cache SW = premier match gagne** (`workbox-routing/Router.js` `findMatchingRoute`) : une règle enregistrée après une règle plus large est **MORTE**. C'est arrivé — `products-cache` (SWR 7 j) n'a **jamais tourné en prod**, occultée par la règle `/api/`, alors que tout lecteur de la config y lisait la politique de cache du catalogue POS (supprimée ; SWR servirait un prix périmé même en ligne et rapide, or pour un prix de caisse la fraîcheur en ligne prime — `NetworkFirst` n'y retombe qu'au-delà du délai réseau). La règle API matche désormais le **chemin `/api/`, pas l'hôte** (l'hôte en dur mourait en silence si l'API déménageait — cf. `.env.production`). Garde CI : `npm run verify:sw-routes --workspace=apps/frontend` inspecte le **`dist/sw.js` livré** et échoue si une règle est inatteignable ou si une URL tombe sur le mauvais cache (invisible pour tsc/tests/revue : la source est valide, c'est l'ORDRE dans l'artefact qui tue). Vérifié dans les deux sens.
- **Backend** (`apps/backend`) : Fastify 5 + Prisma + PostgreSQL (Railway), bcryptjs + JWT, Resend, pdfkit, twilio, `@anthropic-ai/sdk ^0.96.0` (OCR Vision), `@fastify/multipart`, `@fastify/rate-limit` (**global**), **validation déclarative zod** (`fastify-type-provider-zod`, `validatorCompiler` global — cf. § Sécurité).
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, **base XOF**), multi-langues (fr/en/es/it).

## Structure du repo (monorepo)

Un seul repo `ndjoumessi/habashop` depuis juillet 2026 — fusion de `habashop-mobile` et `habashop-legal` via `git subtree` (historique préservé) :

- `apps/frontend`, `apps/backend` → **web** (workspaces racine `apps/*` + `packages/*`).
- `mobile/` → **app Expo** (ex-`habashop-mobile`). **Hors workspaces npm** : `package.json` + `package-lock.json` propres → `npm ci` à lancer *dans* `mobile/`. Builds/OTA EAS depuis `mobile/` (`cd mobile && eas update --branch preview`). Projet EAS inchangé (`projectId e7399d7a-…`, canal `preview`). ⚠️ **AVANT de toucher `mobile/`, lire `mobile/CLAUDE.md`** (+ `mobile/AGENTS.md`) : il porte les contraintes propres à la plateforme, invisibles depuis ce fichier — **SDK 54, ne PAS upgrader vers 56** · crash natif Fabric `addViewAt` sur modales empilées (parade : rendu à la demande) · ne pas supprimer `app/index.tsx` · **swap temporaire `app.json` 1.5.0→1.4.3 pour un OTA** vers l'**appareil de TEST** (canal `preview`) — ⚠️ **ne PAS transposer à la prod** : le **seul build store** (`1f6bf56f-…`) est en runtime 1.2.0 — et **AUCUNE installation réelle n'existe** (1 seul `PushToken` en prod, sur `demo-tenant-001`, l'appareil de test ; mesuré 2026-08-06), le canal `production` n'est lié à **aucune** branche, et `main` a franchi des ruptures **natives** qu'une OTA ne porte pas (#187, #188) · polices `@expo-google-fonts` non livrables par OTA · `app/` = routes uniquement, la logique pure va dans `src/lib/`.
- `docs/modules.md` → **la référence par module** (Produits, Codes-barres, Étiquettes, Abonnements, Facture PDF, Audit, Multi-boutiques, Admin plateforme, RH…) : endpoints, schémas, composants, verrous. Sortie d'ici pour alléger le contexte chargé à chaque session — **à ouvrir dès qu'on touche l'un de ces modules** ; ce fichier n'en garde que les règles transverses (§ Modules — index).
- `docs/lessons/` → **le POURQUOI des chantiers clos** (raisonnement intégral, mesures, tentatives ratées) sorti de ce fichier pour l'alléger. Ces pages ne sont PAS de l'archive : elles sont citées 📖 depuis la règle correspondante et **sont à lire avant de retoucher la surface concernée**.
- `legal/` → **pages légales** (ex-`habashop-legal`). Publiées via `.github/workflows/pages.yml` sur **`https://ndjoumessi.github.io/habashop/legal/`** (suppression compte : `.../legal/account-deletion.html`). ⚠️ URL référencée dans Google Play Console.

## Commandes courantes

**⚠️ Node défaut = v10 → casse tout.** Toujours en premier (vaut pour dev, tests, builds ET déploiements) :
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

⚠️ **TOUTE commande composée commence par `set -euo pipefail`, et TOUT est entre guillemets.**
Consigne de Nelson du 2026-08-07, après **cinq faux zéros en vingt-quatre heures** — cinq
formes différentes, toutes rendant une sortie vide qui se lit comme un résultat propre :

| Forme | Ce qui s'est passé |
|---|---|
| `--include=*.ts` non quoté | zsh a mangé le glob → « 0 correspondance » sur trois workspaces |
| `for f in $CIBLES` | zsh ne découpe PAS une variable non quotée → « 0/15 fichiers » |
| `xargs grep -nP` | `xargs` appelle le `grep` **BSD** (sans `-P`), pas l'`ugrep` du shell → erreur affichée, **exit 0**, sortie vide |
| `cd apps/backend` déjà appliqué | chemins relatifs non résolus → « aucune occurrence dans les fichiers de paie », faux |
| `cd apps/frontend` en échec | la commande suivante a tourné dans le MAUVAIS répertoire, et son résultat plausible a failli être rendu |

`set -e` fait qu'un `cd` en échec **interrompt** au lieu de laisser la suite s'exécuter ailleurs ;
`pipefail` fait qu'une commande qui échoue dans un pipe fait échouer le pipe (c'est le
`npx tsc | tail` qui rendait « exit=0 » sur deux erreurs de type). Les quatre gardes sont
**vérifiées dans ce shell**, pas supposées.

⚠️ **PIÈGE D'ADOPTION, mesuré** : sous `set -e`, un `grep` **sans correspondance** sort en 1 et
**interrompt le script** — or « rien trouvé » est parfois la bonne réponse. Écrire alors
`n=$(grep … | wc -l || true)`. ⚠️ Et ce `|| true` rend à nouveau possible le masquage d'un scan
cassé : **le contrôle positif reste obligatoire** — la commande doit d'abord trouver un cas
qu'on sait présent.

⚠️ **`set -e` est DÉSACTIVÉ dans un contexte dont le statut est testé** — `( cmd ) || echo …`,
`if cmd`, `cmd && …`. Une vérification de `set -e` écrite sous cette forme ne mesure rien :
c'est arrivé au premier essai ci-dessus, et le test annonçait le contraire de la réalité.

```bash
npm run dev                                  # front (5173) + back (3001) via concurrently — ou --workspace=apps/backend pour l'API seule
cd apps/frontend && npx vitest run           # tests front COMPLETS (requis avant push landing/login/thème)
cd apps/backend  && npx vitest run           # tests back
npx vitest run src/tests/foo.test.ts         # un seul fichier — depuis le workspace concerné (idem front src/**/*.test.ts*)
cd mobile && npm ci && npx jest              # tests MOBILE (hors workspaces npm → npm ci DANS mobile/) ; un fichier : npx jest src/…/foo.test.ts
cd apps/frontend && npm run e2e              # Playwright live prod (tenant e2e) ; un spec : npx playwright test e2e/pos.spec.ts
npx tsc --noEmit                             # typecheck — dans chaque workspace touché
npm run lint --workspaces                    # eslint front+back (⚠️ back = cliquet --max-warnings, cf. § CI)
```

Vérifications qui inspectent l'ARTEFACT livré ou la PROD — un test unitaire ne peut pas les remplacer (cf. § Versionnage, § Conventions) :
```bash
npm run verify:sw-routes  --workspace=apps/frontend   # ordre des règles du dist/sw.js livré (une règle occultée = morte)
npm run verify:demo-flag  --workspace=apps/frontend   # demo1234 absent du dist/ prod
npm run verify:seo-urls   --workspace=apps/frontend   # dist/ livré : aucun %VITE_*% non substitué (canonical cassé = désindexation)
npm run verify:classes    --workspace=apps/frontend   # dist/ livré (JS compris) : aucune classe atteignable absente — tailwind n'émet RIEN
npm run smoke:version     --workspace=apps/backend    # /health DÉPLOYÉ == version source (après CHAQUE déploiement back)
npm run test:integration  --workspace=apps/backend    # vitest.integration.config.ts — LECTURE SEULE contre la prod (CI sur main)
```

⚠️ `README.md` est **daté** (Fastify 4, 7 thèmes, 22/8 tests, « vercel depuis apps/frontend »…) — en cas de conflit, **ce fichier fait foi**.

## Déploiement

**Frontend Vercel** — **auto-déploiement prod sur push `main`** (vérifié 2026-07-19, Settings → Git : Production suit `main`). **NE PAS lancer `vercel --prod` manuel** — c'est redondant et ça consomme le quota (cf. § « Après un merge » ci-dessous).

⚠️ **Vercel exécute le `npm run build` du workspace front** (Root Directory `apps/frontend`), pas un `vite build` nu — **vérifié en prod le 2026-07-29** : `/sitemap.xml` et `/robots.txt`, produits par l'étape `gen-seo.mjs` ajoutée APRÈS `vite build`, sont bien servis en 200 avec l'URL substituée. Une étape ajoutée au script `build` tourne donc en production ; ne pas la déplacer dans un hook que Vercel n'appellerait pas.

**Backend Railway** — service `habashop`, projet `grateful-happiness`. **Auto-deploy GitHub sur push `main`.** Après déploiement : `npm run smoke:version --workspace=apps/backend` (le `/health` DÉPLOYÉ doit renvoyer la version racine — cf. § Versionnage).

### ⚠️ APRÈS UN MERGE : ne rien lancer. Vérifier, c'est tout.

`main` auto-déploie **sur les DEUX** plateformes. Donc après un merge :

- **NE PAS** lancer `railway up --ci` · **NE PAS** lancer `vercel --prod`.
- **VÉRIFIER** : `/health` (version + build id) côté back · un déploiement `● Ready` **plus récent que le merge** côté front.

Le geste manuel **double le déploiement** — deux redémarrages de conteneur au lieu d'un — et **brûle le quota Vercel** (free-tier = 100 déploiements/jour). Mesuré le 2026-07-23 : la prod servait déjà la version neuve **17 s** après le push, alors que le `railway up --ci` lancé « pour forcer » était encore en build ; il a produit un **second** déploiement du même commit. Le lag « ~20-25 min » qui justifiait le forçage n'a pas été observé.

Repli d'URGENCE seulement, si l'auto-deploy est *démontré* cassé (pas supposé lent) : `railway up --ci` depuis la racine · `vercel --prod --yes` depuis la **racine** (jamais `apps/frontend` → path doublé = échec).

**Déploiement couplé** : le push `main` déclenche les deux auto-deploys. Si le backend introduit une rupture d'API, l'ordre n'est pas garanti — vérifier que le back sert bien la version neuve **avant** de conclure que le front est bon.

⚠️ **Vercel — la PROD s'auto-déploie sur push `main`** (vérifié 2026-07-19). L'ancienne inférence « prod = manuelle » (basée sur PR #49 : déploiements prod sans métadonnée git) était **FAUSSE** : ces prod-là venaient bien du CLI **parce qu'on lançait `vercel --prod` en plus**, pas parce que l'auto-deploy manquait ; l'absence de prod après certains merges venait du **QUOTA épuisé**, pas d'une config absente. Donc : **rien à lancer à la main** — au prochain push sur `main` (quota revenu), la prod part seule. Le rôle de Claude = **VÉRIFIER** (`vercel ls --prod` → un déploiement **plus récent que le merge** et `Ready`), jamais conclure « déployé » sans ça, et **ne JAMAIS relancer `vercel --prod`**. **Free-tier = 100 déploiements/jour.**

#### Modèle de déploiement RÉEL (mesuré 2026-07-28 : 12 déploiements, 5 merges, 5 PR)

| Événement | Effet | État |
|---|---|---|
| Push sur `main` | **1 déploiement prod** (auto, back Railway + front Vercel) | ✅ conforme, **zéro geste manuel** (5/5) |
| Push sur une branche **AVEC une PR** | **1 preview Vercel** — **PAR CONCEPTION** de l'intégration GitHub de Vercel, **indépendant** du branch tracking. Un **force-push** (rebase) en coûte **une de plus** | 7/7 portaient un `githubPrId` ; 2 des 5 PR en ont consommé 2 |
| Branche **SANS PR** | **0 preview** — « All unassigned branches » est bien désactivé | 0/12 branches orphelines n'a déployé |

⚠️ **Le réglage n'est PAS cassé — ne plus chercher un réglage à réparer.** L'ancienne cible
« 1 prod par merge, **zéro preview**, zéro geste manuel » était une **erreur de doc** : elle
confondait le **branch tracking** (désactivé, et qui tient) avec les **previews de PR** (créées
par conception). Aucun geste ne rend « zéro preview » atteignable par ce levier.

**Les previews de PR ont une VALEUR** : chaque build de PR prouve que le front **compile** avec
le changement — signal que la CI unitaire ne donne pas. Les supprimer coûterait cette garantie.

**Rituel commit** : `npx tsc --noEmit` (0) → `npm test` (verts) → `npm run build` (OK) **dans les DEUX workspaces** → commit/push `main`. Git : push direct sur `main`, pas de feature branch.

⚠️ **`tsc --noEmit` NE SUFFIT PAS à valider le backend — c'est `npm run build --workspace=apps/backend` qui décide du déploiement.** Le contexte Docker est `apps/backend` SEUL (`COPY src`+`scripts`+`prisma`+`package*.json`+`tsconfig.json`) : `docs/` n'y est PAS, et l'image lance `tsc` sur tout `src/`, **tests compris**. Un `import x from '../../../../docs/shared-fixtures/….json'` compile donc en local — où le monorepo entier est présent — puis casse le déploiement Railway en **TS2307**, invisible pour tsc local, la suite ET la revue (la source est valide, c'est le CONTEXTE qui diffère). Vécu le 2026-08-05 (#91be7af7, prod figée sur le commit précédent pendant 20 min). **Toute fixture partagée se lit à l'EXÉCUTION** — `readFileSync(join(__dirname, '..', …))` — jamais par `import` : un chemin runtime n'est pas résolu par tsc, donc le build passe et le test ne s'exécute simplement pas dans l'image. C'était déjà la convention des 7 autres jumeaux (`csvInjection`, `payrollNetShared`, `barcodeShared`…), elle n'était juste écrite nulle part. Verrou : **`dockerContextImports.test.ts`** (back) échoue si un fichier de `src/` importe statiquement hors d'`apps/backend` — la frontière gardée est le CONTEXTE DE BUILD, pas un répertoire particulier. ⚠️ Ce méta-test s'est épinglé lui-même au premier tir (sa contre-preuve écrivait le motif en toutes lettres) : un scanneur doit survivre à son propre scan. Même famille que le smoke de version — **un test unitaire ne voit pas une régression d'ENVIRONNEMENT**.

⚠️ **Et `$?` après un pipe n'est PAS celui de `tsc`.** `npx tsc --noEmit 2>&1 | tail -20` rend le statut de `tail`, donc **0** alors que tsc sort en 2 : mesuré le 2026-08-05, deux erreurs de type affichées sous un « exit=0 ». Annoncer « tsc 0 » depuis une commande pipée ne prouve rien — lancer sans pipe, ou lire `${PIPESTATUS[0]}`. ⚠️ Depuis la RACINE, `npx tsc --noEmit` ne vérifie **rien du tout** (aucun `tsconfig.json` racine) : il imprime son aide et sort en 1. Toujours depuis le workspace concerné.

**CI** (`.github/workflows/ci.yml`, Node 22) : tsc + **lint** + tests unitaires sur les deux workspaces, build front avec **garde de taille de bundle < 100 Ko gz** (`index-*.js`), scan de secrets en dur ; sur `main` uniquement : tests d'intégration (lecture seule contre la PROD) et E2E Playwright. ⚠️ **Le lint backend est un CLIQUET** : `--max-warnings 323` = l'état actuel, donc tout NOUVEL avertissement casse la CI. Ne pas relever le plafond pour faire passer un commit — corriger, ou l'abaisser quand on nettoie (descendu de 333 → 327 au fil de l'item 10, puis → 325 en extrayant le handler d'erreur, → 323 en typant l'export CSV par Prisma ; chaque suppression d'`any` abaisse le plafond d'autant). (Il était à 200 pour 333 avertissements réels : la CI ne lançait pas le lint, l'échec passait inaperçu.) ⚠️ **Le front a AUSSI un cliquet** (`--max-warnings 208`), et il a été FRANCHI le 2026-08-06 : `da31e7a9` a fait passer le compte de 209 à **210**, par une `() => {}` vide dans un test qu'il ajoutait — la CI de `main` a échoué à l'étape « Lint » du job frontend pendant **6 h et 5 commits**. Corrigé **par le bas**, jamais en relevant le plafond.

⚠️ **UN CLIQUET CONTRAINT LA SOMME, PAS L'INTRODUCTION** — et c'est la leçon la plus chère de cet épisode. « Lint au cliquet » ne prouve **PAS** qu'aucun avertissement n'a été ajouté : il prouve que le TOTAL n'a pas monté. Le premier correctif l'a soldé en supprimant deux imports morts (`CNSS_RATE`/`IR_RATE` dans `NewContractModal`) qui n'avaient rien à voir — le chiffre redevenait juste, **la fonction vide restait**, et deux nettoyages légitimes avaient été dépensés pour payer une dette qu'ils n'avaient pas creusée. Un cliquet soldé par une coupe ailleurs cesse de mesurer ce qu'il devait mesurer, et le budget de nettoyage part sans que rien ne soit nettoyé.

**Règle : on retire l'avertissement QU'ON A INTRODUIT**, puis on abaisse le plafond de ce qu'on a nettoyé **par ailleurs** — jamais l'inverse, jamais en compensant. La comptabilité se tient en deux colonnes séparées, et elle s'écrit :

| | Δ | Plafond |
|---|---|---|
| état avant `da31e7a9` | — | **209** |
| régression introduite (`() => {}` vide, `integrationsRendered.test.tsx:94`) | +1 | 210 → **rouge** |
| ↳ **remboursée** : `new Promise<never>(() => { /* jamais résolue */ })` | −1 | retour à 209 |
| nettoyage **indépendant** : 2 imports morts de `NewContractModal` | −2 | **207** |

Solde net identique à un « −1 » global, mais les deux mouvements ne disent pas la même chose : le premier répare, le second progresse. Confondus, on croit avoir nettoyé alors qu'on a seulement remboursé.

### ⚠️ L'ALARME QUI NE PEUT PAS SONNER — et qui se déclare VERTE

Ce n'est pas le cliquet franchi qui compte, c'est que l'échec soit **passé inaperçu 6 h et 5 commits**. Cause racine, mesurée le 2026-08-06 : le job `notify-failure` faisait

```bash
if [ -z "$DISCORD_WEBHOOK" ]; then echo "absent — skip"; exit 0; fi
```

et le dépôt n'a **AUCUN secret** (`gh api repos/…/actions/secrets` → `total_count: 0`). L'étape sortait donc en 0, et la page du run affichait une **coche VERTE** à côté de « Notify on failure » — sur un run rouge où personne n'avait été prévenu. Un fail-open **non tracé** rend l'absence de canal indistinguable d'une alerte envoyée : c'est le motif « une pastille qui ne peut pas rougir ne prouve rien » (§ Console Ops) appliqué à la CI elle-même.

Corrigé : secret absent → `::error::` **+ `exit 1`**. ⚠️ Le job ne tourne que `if: failure()` — le faire échouer ne rend aucun run vert rouge ; il rend seulement lisible, sur un run déjà rouge, que l'alerte n'est pas partie. Ajouté au passage : `--fail-with-body` sur le `curl` (sans lui, un webhook **révoqué** sortait en 0 sur un 404 — aussi silencieux que le secret absent, pour la même raison), et les métadonnées passent par des variables `env:` + `jq` au lieu d'être interpolées dans le corps du `run:` (une branche portant un guillemet cassait le JSON, ou s'y injectait ; vérifié avec `main"; rm -rf /`, correctement échappé).

⚠️ **Le motif ne se répète PAS ici — vérifié, pas supposé.** `DISCORD_WEBHOOK` est le **seul** `secrets.*` de `ci.yml` et `pages.yml`, et l'unique `exit 0` sur secret absent. Les deux `continue-on-error: true` (npm audit) sont d'une autre nature : **délibérés, nommés « non bloquant », et l'étape reste visiblement en échec**. Ne pas les « corriger » par analogie.

**Règle générale : un garde qui ne peut pas échouer n'est pas un garde.** Tout `exit 0`, `|| true` ou `continue-on-error` sur l'ABSENCE d'une configuration doit soit échouer, soit émettre un `::error::`/`::warning::` — jamais réussir en silence. Et cela vaut d'abord pour les gardes qui surveillent les autres gardes : c'est là que le vert coûte le plus cher.

### ⚠️ CI ROUGE ≠ CODE FAUTIF — lire l'exécution AVANT d'accuser le dépôt

Le 2026-08-06, `main` a porté **5 runs rouges**. Deux causes **indépendantes** s'y superposaient, et les confondre a produit deux diagnostics faux d'affilée :

| Runs | Cause | Signe qui la distingue |
|---|---|---|
| 2 (`da31e7a9`, `2f510eb4`) | **notre code** — cliquet lint franchi | les étapes ont TOURNÉ, `Lint` en `failure` |
| 3 (`a5bfb27f`, `702bdf1a`, `9f967714`) | **panne GitHub Actions** | **0 étape exécutée**, annulation après **15 min pile** — aucun runner obtenu |

**Le discriminant est `steps.length`, pas la conclusion.** Un job `cancelled` avec zéro étape n'a rien jugé : il n'a jamais démarré.

```bash
gh api repos/<o>/<r>/actions/runs/<id>/jobs \
  -q '.jobs[] | "\(.name) \(.conclusion) étapes=\(.steps|length)"'
gh api /repos/<o>/<r>/actions/workflows -q '.workflows[].state'   # active ≠ désactivé
curl -s https://www.githubstatus.com/api/v2/summary.json | jq '.components[]|select(.name=="Actions")'
```

Incident réel : `Actions · critical`, ouvert **15h22 UTC** — soit **une minute avant** notre dernier run complet. Ses formulations décrivent nos trois symptômes mot pour mot : « *failing to start* » (runs créés, 0 étape), « *queued jobs may time out* » (les 15 min), « *delayed in starting* » (deux pushs sans aucun run créé, sur **aucune branche**).

⚠️ **Ma piste « minutes Actions épuisées » était structurellement IMPOSSIBLE, et je l'ai proposée sans vérifier une ligne de `gh api /repos/…`** : ce dépôt est **PUBLIC**, donc les minutes runner standard y sont **gratuites et illimitées**. Une hypothèse qui envoie chercher dans la facturation coûte le temps de quelqu'un d'autre — **vérifier la visibilité du dépôt AVANT de suspecter un quota**. L'ordre correct est : (1) le run a-t-il exécuté des étapes ? (2) les workflows sont-ils `active` ? (3) githubstatus. La facturation vient en dernier, et seulement sur un dépôt privé.

⚠️ **Pendant une panne Actions, repousser ne sert à rien** — aucun run n'est créé, et un `git push` de plus n'en déclenche pas. Attendre la résolution, puis **relancer les étapes manquées en local et RENDRE le résultat** (§ ci-dessous), plutôt que de supposer qu'elles passent. ✅ **`mobile/` est COUVERT** depuis #163 par un job dédié `unit-tests-mobile` (`tsc` + la suite jest) : `mobile/` ayant son propre lockfile, il fait son `npm ci` **dans** `mobile/` (`cache-dependency-path: mobile/package-lock.json`), il n'est PAS servi par le `npm ci` racine. ⚠️ **AUCUN filtre de chemin, délibérément** : restreindre à `mobile/**` rouvrirait le trou qu'on ferme — une fixture partagée vit dans `docs/`, pas dans `mobile/`, et ne déclencherait donc pas le job. MESURÉ : install à froid **28 s**, suite **5 s**.

### ⚠️ Vérification en PROD — trois formes autorisées, pas une de plus

**Un correctif de dépense ne se valide pas en dépensant.** La preuve en production se fait **UNIQUEMENT** par :
- **(a) lecture seule** — `GET`, requête Prisma `findMany`/`findUnique`, `curl` sur une route non mutante ;
- **(b) assertion sur la DÉCISION du garde, SDK mocké** — `expect(messages.create).not.toHaveBeenCalled()` ; c'est un test, pas un appel réseau ;
- **(c) tenant JETABLE** créé pour la vérification puis **détruit** (cf. le motif `verif-guard-tmp` : écriture directe en base, aucun e-mail émis, suppression immédiate + état final vérifié).

**JAMAIS** : muter l'état d'un tenant existant (`PATCH` sur `ownerPhone`, `enableAutoWhatsApp`, `status`…), ni déclencher un envoi/appel réel (Twilio, Anthropic, Resend) pour « prouver que ça marche ».

**Deux incidents réels à l'origine de la règle** (2026-07-22) :
1. Un « contrôle positif » sur `POST /api/whatsapp/send-ticket` a **réellement expédié** un message WhatsApp facturé vers le `ownerPhone` de la démo. L'endpoint choisi pour prouver qu'un garde laisse passer était… un endpoint qui envoie.
2. Un `PATCH /api/tenant` exploratoire a mis `enableAutoWhatsApp=true` sur `demo-tenant-001` (remis à `false` ensuite). Vérifier un garde ne justifie pas de modifier la configuration d'une boutique réelle.

**Corollaire — le smoke de version ne prouve pas un déploiement.** `npm run smoke:version` compare la version, donc reste **vert quand le déploiement n'a pas eu lieu** si la version n'a pas bougé (vu 2 fois : `railway up` avait échoué après « Failed to stream build logs »). Preuve réelle = **`uptime` de `/api/health-extended` remis à zéro** (poller jusqu'à ce qu'il redescende), ou une réponse dont le contenu a changé.

## Versionnage ⚠️ SOURCE UNIQUE

**La version PRODUIT vit dans UN SEUL endroit : `version` du `package.json` RACINE** — ⚠️ **ne PAS recopier le numéro ici** (ce fichier se périmerait à chaque bump ; il l'a été) : lire la racine. Tout affichage/retour de version en dérive — **jamais de littéral en dur** (on a eu 6 versions divergentes : admin 2.6.0, /health 2.1.0, /health-extended 2.3.0, /api/docs 2.0.0, sidebar 1.0.0…).
- **Web** : injectée au build par Vite (`vite.config.ts` lit `../../package.json` racine) → `__APP_VERSION__` (brut, ex. « 2.9.0 ») + `__BUILD_SHORT__` (« v2.9.0 · JJ/MM », sidebar) + `__BUILD_ID__` (horodatage+SHA, `title`/Réglages). `AdminDashboard` utilise `__APP_VERSION__`. ⚠️ NE PAS lire `apps/frontend/package.json` (resté à 1.0.0).
- **Backend** : version **BAKÉE** dans `src/version.generated.ts` (`BAKED_APP_VERSION`, **committé**) ; `getAppVersion()` (`src/lib/version.ts`) le renvoie → `/health`, `/api/health-extended`, `/api/docs` alignés. Le `prebuild` (`scripts/gen-version.mjs`) le **régénère depuis la racine en dev/local** (où la racine existe). ⚠️ **En Docker le contexte = `apps/backend` seul** (`Dockerfile`, `COPY src`+`COPY scripts`) → gen-version ne trouve PAS la racine et **no-op** : le fichier **committé fait foi**. Donc **au bump de version, régénérer + committer `version.generated.ts`** (lancer `npm run build --workspace=apps/backend`). ⚠️ **NE PAS revenir à une lecture runtime** du `package.json` racine (absent de l'image slim → `/health` = `0.0.0-unknown`, bug corrigé). Le walk FS ne subsiste qu'en repli dev/local.
- **Garde** : méta-tests `versionSource.test.ts` (front + back + **mobile**) — échouent si un semver entre guillemets réapparaît dans `src/` (même principe que le méta-test quiet zones), **commentaires inclus** ; `version.generated.ts` (bakée) est exclu du scan. Un repli non-semver (`'0.0.0-unknown'`, `'unknown'`) est toléré. ⚠️ **LEÇON** : ce méta-test prouve la **SOURCE** (la logique lit la racine), PAS le **chemin réel déployé** — il restait vert alors que la prod renvoyait `0.0.0-unknown` (même motif que le test qui figeait le séparateur de facture sans exercer le rendu). D'où le **smoke post-déploiement** : `npm run smoke:version --workspace=apps/backend` (ou `node apps/backend/scripts/smoke-deployed-version.mjs`) **après chaque déploiement backend** → échoue si le `/health` DÉPLOYÉ ≠ version source. Un test unitaire ne peut pas voir une régression d'environnement runtime.
- **QUAND bumper** (sinon la version se fige comme les `package.json` se sont figés à 1.0.0) : **à chaque release fonctionnelle visible**, éditer la racine avant déploiement — `npm version <patch|minor|major> --no-git-tag-version` à la racine (patch = fix, minor = feature, major = rupture). Fait partie du rituel de release.
- **Mobile = piste SÉPARÉE, NE PAS aligner** ⚠️ : `mobile/app.json` `version` (1.5.0) pilote le `runtimeVersion` (policy `appVersion`) → c'est un **paramètre fonctionnel de l'OTA**, pas un numéro d'affichage. L'aligner sur la version produit **casserait la continuité OTA** (les installs existantes ne recevraient plus les updates jusqu'à réinstallation). Réglages mobile affiche `Constants.expoConfig.version` (= app.json) : c'est **intentionnel**, ne pas « corriger » cette divergence. Repli quand la version est indisponible = **`'unknown'`** (jamais un faux semver — un repli qui affirme une version fausse est pire qu'un champ absent). Le méta-test `versionSource.test.ts` couvre aussi `mobile/src`.

## Pièges critiques

- **`DATABASE_URL` = DB PROD Railway.** JAMAIS `migrate dev/reset/seed` sans confirmation. `prisma db push` OK pour ajouts sans data loss. Migration additive : `ADD COLUMN IF NOT EXISTS` + `prisma migrate resolve --applied`.
- **`apps/frontend/.env` tracké par git** → JAMAIS de secret. `.env.local` gitignored (`SENTRY_AUTH_TOKEN` build-side).
- **Logs Railway** : `railway logs` = stream infini → `railway logs --deployment --lines N --json`.
- **Sonder un job CI — attendre sur `status`, JAMAIS sur `conclusion`** ⚠️ : GitHub renvoie `conclusion: ""` (**chaîne VIDE**, pas `null`) tant qu'un run/job est `in_progress`. Or le `//` de jq ne se déclenche que sur `null`/`false` — MESURÉ : `'{"conclusion":"","other":null}' | jq '.conclusion // "DEFAUT"'` rend `""`, quand `.other // "DEFAUT"` rend bien `DEFAUT`. Une boucle qui teste `.conclusion // "-"` sort donc **au premier tour** et annonce « terminé » sur un job qui tourne encore (arrivé sur l'E2E du merge #174 : sonde verte, rien d'observé). Motif : poller `status == "completed"`, **puis** lire `conclusion` — c'est la variante CI du « mock qui ignore ses arguments », un vert qui décrit un monde qui n'existe pas.
- **Co-édition** : "file modified since read" = prompt parallèle → `git status`/`git log`, réconcilier, re-`tsc`.
- **`appStore` partialize** : `...rest` persiste tout → exclure états session (`cart`, `cashier*`) ou resetter dans authStore login/logout.
- **Secrets API** = état React éphémère — JAMAIS localStorage.
- **PII** : numéros téléphone jamais dans les logs Railway.

## Structure frontend

```
src/
  pages/         # 1 fichier par écran. ⚠️ /privacy = route PUBLIQUE (Google Play) ; pages légales hébergées désormais sous legal/ → Pages
  components/    # par domaine — souvent un *Shared.tsx par domaine
  stores/        # appStore.ts (lang, currency, tenant, caisse, cart)
                 # authStore.ts (user, token, tenants[], activeTenantId, switchTenant, ROLE_PERMISSIONS + canAccess slug)
  i18n/index.ts  # t() : { fr, en, es, it }, 575+ clés
  lib/api.ts     # tous les *Api
  components/ui/ # ResponsiveGrid, IconButton, Tabs/TabBar, AppButton,
                 # FocusTooltip, Skeleton, FilterSelect — voir README.md
```

## i18n — convention CRUCIALE

**Utilise le mécanisme déjà présent dans le fichier** :
1. `i(fr, en, es, it)` via `useI18n()` — standard nouveau code.
2. Ternaire inline 4-langues — TOUJOURS les 4 (jamais binaire FR/EN).
3. `t('key')` → `src/i18n/index.ts` ; nouvelle clé = dans les 4 blocs.

Helpers : `makeI(lang)` (settings), `pick(lang, obj)`.
**Pattern data traduites** : `Record<string, Record<lang, string>>` + `xxxLabel(value, lang)` — valeur FR = clé. Cf. `hrShared.tsx`, `posShared.tsx`. Ne pas toucher les chaînes FR dans les data.
**NE PAS traduire** : marques, codes devises (XOF/EUR/FCFA), enums API, pays. PDF hors périmètre.

## Conventions de code

- **Montants** : `useFormatAmount()`/`fmt()` — jamais formatage manuel.
- **Icônes** : Lucide uniquement (pas d'emoji UI), `cursor:pointer` + transitions.
- **Couleurs** : `var(--)` systématiquement. Exceptions : palettes sémantiques, Google Maps, PDF, `.public-scope`, `#fff` boutons colorés, défs thème. ⚠️ FS macOS : ne pas créer `Button.tsx`/`Tabs.tsx`/`Tooltip.tsx` (collision shadcn minuscules).
- **Branding / thème** : logo **« Sac + H »** = composant `components/ui/LogoMark.tsx` (SVG, violet `#6C47FF` + or) — utilisé Sidebar/Login/PWA/SelectShop/Landing. Assets dans `public/` + `mobile/assets/` (source éditable : `../habashop-brand/`). **Mode sombre = « NKONI »** (bleu-noir `#0A0C14`, cartes `#121724`, or `#FFB020`, `--border3` glow violet sur cartes clés, CTA `--grad-p` violet→bleu). Police UI = **Geist** (`@fontsource-variable/geist`, `--font`) ; mono = JetBrains.
- **Thèmes = 3 seulement** (`appStore.ts` `Theme='dark'|'light'|'system'`, défaut `dark`) : **Sombre (NKONI)** / **Clair** / **Système**. `system` n'a pas de palette → `resolveTheme()` le résout en dark/light selon `prefers-color-scheme` (+ listener `matchMedia` réactif) ; `applyTheme` pose `body.className=theme-<resolved>`. `THEMES` ne contient QUE `dark`+`light` ; `THEME_OPTIONS` = les 3 options du sélecteur (`SectionLang`). **Fallback gracieux** : thème persisté obsolète (ancien `darker/midnight/forest/ocean/sunset/gold/soleil`) → `merge` retombe sur `dark` (`VALID_THEMES`). Détection clair côté JS = `isThemeLight(theme)` (résout `system`), **pas** `t==='light'`. Sélecteur d'accent (6 pastilles `ACCENT_PAIRS`) conservé. `THEMES.dark.vars` **doit rester synchro** avec le `:root` sombre d'`index.css` (sinon `applyTheme` réintroduit l'ancien fond) ; miroir `BASE` de `contrast-aa.test.ts` idem. *(Mobile aligné : 3 thèmes aussi, cf. #19.)*
- **Login** (`pages/LoginPage.tsx`) — refonte 2026-07 : **formulaire héros**, 100 % tokens `var(--)` (le dégradé `#0F0A2E` en dur a sauté → le thème Clair fonctionne), volet gauche = accroche + aperçu POS + capacités factuelles, CTA unique **désactivé tant qu'un champ est vide**, erreur INLINE (`role=status` + `aria-live`) avec focus rendu à l'e-mail, version issue de `__APP_VERSION__`. Sélecteurs stables **`data-testid="login-email/login-password/login-submit"`** — E2E en dépend. Lien « ← Retour à l'accueil » + logo cliquable → `/`. ⚠️ **RETIRÉS et à ne pas réintroduire** : « Déployé dans 150+ pays » (faux), badges SSL/TLS (page + pied), liste de fonctionnalités génériques. `login.anchor.test.tsx` fige leur ABSENCE.
- **Raccourci démo par rôle** : vit dans `components/login/DemoRoleLogin.tsx`, rendu **UNIQUEMENT** si `VITE_DEMO_MODE === '1'`. ⚠️ Le `import()` doit rester DANS la branche (`DEMO_MODE ? lazy(…) : null`) : un `lazy(() => import(…))` inconditionnel laisse Rollup émettre le chunk et **livre `demo1234` en prod**. Garde : `npm run verify:demo-flag --workspace=apps/frontend` grep le `dist/` livré — à valider dans les DEUX sens (prod = absent, `VITE_DEMO_MODE=1` = présent, sinon le grep ne prouve rien). Ceci n'est PAS la sécurité (cf. § Garde de dépense).
- **Landing hero** (`components/landing/LandingHero.tsx`) : **split 2 colonnes** (texte / carte aperçu produit), **100 % tokens CSS** (`var(--…)` + `color-mix`, theme-aware) — pas la palette `D` hex. H1 unique, mot d'accent en `--p2`. `< 900px` → colonne unique. `LandingNav` masque « Connexion » `< 640px` (`.lp-nav-login`).
- **Graisses** : `--fw-regular/--fw-semibold/--fw-bold` uniquement. Exclusions : PDF, SVG Maps, `.public-scope`.
- **Toasts** : sans emoji. Mutations clés → `announce(msg)` (`@/lib/announce`) + `toast.success`.
- **Modales** : `useModalFocus<HTMLDivElement>()` + `ref` sur `.modal-box` + `role="dialog"`/`aria-modal`/`aria-label`. ⚠️ `aria-grabbed`/`aria-dropeffect` = dépréciés.
- **Pills de statut** : tokens `--c-{green,orange,blue,red,amber}-bg/-border`, `--r-full`, 12px semibold.
- **Logs** : `logger.log/warn` (`@/lib/logger`, filtre DEV) — pas de `console.*` en commit.
- **Éditions masse multi-octets/emoji** : script Python ou tsx, pas `sed`.
- **Édition scriptée d'un fichier** ⚠️ : tout `replace()` doit **asserter que l'ancre existe** (`assert s.count(old) == 1`). Sans ça, une ancre inexacte fait un **no-op silencieux** — le script affiche « ✓ » et rien n'a changé. C'est ainsi que le compteur de tests backend est resté faux pendant 4 PR : l'ancre portait un `- ` que le fichier n'a pas (la mention est en milieu de phrase).
- **Sabotage d'un verrou** ⚠️ — **passe par le script, il n'y a plus de procédure à retenir** :
  ```bash
  npm run sabotage -- <fichier…>    # instantané HORS du dépôt, puis on casse librement
  npm run sabotage:status           # y a-t-il un sabotage en cours ? (code de sortie non nul)
  npm run sabotage:restore          # restaure DEPUIS LA COPIE + vérifie octet par octet
  ```
  Ce qui suit n'est plus une consigne, c'est l'**explication** du script. `git checkout <f>` restaure depuis HEAD : pendant la vérification d'un verrou le correctif n'est PAS commité, donc il est **effacé**. L'instantané vit dans `os.tmpdir()` — invisible pour `git status`, incommitable, et hors d'atteinte d'un `checkout`. Un second instantané est **refusé** (un sabotage interrompu dont on restaurerait la copie plus tard écraserait du travail plus récent). La restauration **vérifie et le DIT** : une restauration silencieuse est une restauration non prouvée.
  ⚠️ **Pourquoi un script plutôt qu'une règle** : ce piège était écrit **deux fois** dans ce fichier, et il a été commis **trois fois dans la même session par l'auteur de ces deux avertissements** — la troisième en relisant le paragraphe qui l'interdit. **Quand une règle documentée est violée trois fois par le même acteur, ce n'est plus la règle qu'il faut corriger.** Verrou : `sabotageScript.test.ts` (8) — il exécute le vrai script sur de vrais fichiers, compare les octets, et exerce le cas « instantané déjà présent ».
- **Specs prescriptives** : si instruction ≠ code réel → réconcilie et continue. Questions réservées aux choix irréversibles.
- **Refactor transverse** ⚠️ : unifier N points d'appel dans un module unique fait perdre ce que chaque appelant distinguait, si le module ne remonte pas TOUTE leur information (statuts, codes d'erreur, détail par élément). Un goulot ne doit pas être un entonnoir. Corollaire éprouvé : **une surface à la fois, revue entre chaque** — trois refactors enchaînés sur le même code ont produit à chaque tour des régressions plus graves que ce qu'ils réparaient.
- **Test qui grep du texte source** (`expect(src).toContain(…)`) : prouve la SOURCE, pas le comportement. Il passe au rouge sur un simple reformatage et reste vert si le bloc devient inatteignable. Préférer l'injection de la route avec les dépendances mockées et l'assertion sur l'effet (cf. `redactPhone.test.ts`). Tout verrou doit être vérifié **dans les deux sens** : on le casse volontairement pour prouver qu'il détecte.
- **Mock qui ignore ses arguments** ⚠️ : un `mockResolvedValue([…])` rend la même liste quel que soit le `where`/filtre reçu — le test reste **vert même si le code n'envoie plus le filtre**, en décrivant un monde qui n'existe pas. Faire APPLIQUER le filtre par le mock (cf. `salesHonoredFilter.test.ts`, `stockAlertChannels.test.ts`). Corollaire pour les méta-tests qui scannent l'arborescence : asserter que le **scan couvre des fichiers** — un `walk()` cassé rend une liste vide, donc un vert qui ne garde rien.

## État fonctionnel

### POS / Ventes
- **Paiements** : cash/wave/orange/mtn/card. **Mixte** : `Sale.cashAmount/mobileMoneyAmount/cardAmount`, `|somme−total|≤1` + ≥2 modes. Helper `lib/paymentSplit.ts`.
- **Idempotence** : `idempotencyKey` (`@@unique([tenantId,idempotencyKey])`), P2002 gérée.
- **Remboursement** : `POST /api/sales/:id/refund`, motif requis, restock optionnel, idempotent 409, `refunded` exclu CA + retire points.
- **Anti-survente** : backend `400 INSUFFICIENT_STOCK` (garde AVANT tx, décrément atomique). Front : `confirmSale` surface l'erreur + refetch stock. Tuile rupture grisée `opacity .45`. 4 tests `overselling.test.ts`.
- **Scan douchette (« keyboard wedge »)** ⚠️ — chemin de scan PRIMAIRE en boutique, plus courant que la caméra. La douchette est un CLAVIER : elle tape dans le champ de recherche POS. `looksLikeScannedInput` (`components/pos/wedgeScan.ts`) tranche scan vs recherche par **deux voies** — la **forme** (code canonique valide, jugé par `lib/barcode.ts`, jamais une regex locale) et la **vitesse** (≤ 30 ms/car sur ≥ 4 car, ce qui rattrape les étiquettes CODE128-sur-SKU). Le champ est **vidé AVANT de résoudre** : sinon, en cas d'échec, la grille resterait filtrée sur le code — vide et muette, l'incident même qu'on ferme (#148).
  - **Sans terminateur** (#161) : certaines douchettes n'envoient pas Entrée. Le champ tranche alors sur l'**INACTIVITÉ** (`WEDGE_IDLE_MS` 60 ms après la dernière touche), avec `elapsed` figé de la 1re à la **DERNIÈRE touche** — jamais jusqu'au déclenchement, sinon le délai diluerait la cadence sous le seuil.
  - ⚠️ **Le tir sur inactivité n'a le droit d'utiliser QUE la vitesse** (`looksLikeScannerBurst`), **jamais** `looksLikeScannedInput`. **MESURÉ** sur 10 000 EAN-13 à somme de contrôle correcte : **10,0 % ont un préfixe de 12 caractères qui est un UPC-A VALIDE** — la collision tombe *exactement* à 12 (une chance sur dix que la somme retombe juste), donc restreindre à « ≥ 12 car » ne servirait à rien. Un caissier qui RECOPIE un code marque des pauses : s'il s'arrête après le 12ᵉ chiffre, la voie forme validerait le code **partiel**, viderait le champ et ajouterait **un AUTRE produit** au panier — une erreur d'ARGENT, silencieuse, une fois sur dix. Ne pas « simplifier » les deux prédicats en un seul.
  - **La recopie manuelle reste servie par ENTRÉE**, où la saisie est finie *par construction* — c'est l'appui qui dit « j'ai fini », pas une horloge. C'est la réponse au résiduel, et elle est délibérée.
  - **Deux gardes REDONDANTES** annulent le minuteur après Entrée (`onKeyDown` + `resetTyping`) : retirer une seule des deux laisse la suite **verte** (vérifié) — ceinture et bretelles sur un double-ajout au panier.
  - Verrous : `wedgeScan.test.ts` (25, invariant PUR) + **`pos-wedge-wiring.test.tsx`** (10, **câblage** — monte le VRAI `POS.tsx` avec faux timers ; 3 sabotages). ⚠️ L'invariant pur ne peut RIEN dire du câblage (minuteur posé/annulé) : il faut les deux. **Limite assumée** : la saisie exige le focus du champ — une capture clavier au niveau `document` volerait les touches aux autres champs et modales.
- **Intégrité prix — SERVEUR-autoritaire** ⚠️ (`sales.ts`) 📖 *raisonnement complet, expositions mesurées et justification des bornes : `docs/lessons/integrite-prix-pos.md`* :
  - Le prix soumis n'est facturé **QUE** s'il correspond au tarif **DÉCLARÉ par la ligne** (`items[].clientType` ∈ `retail|semi|wholesale`, résolu palier+promo à la qté par `expectedPrice`). Sinon = **divergence** → on facture le prix serveur de ce tarif. Défaut rétro-compatible `retail`. Accepter « un tarif quelconque » **n'est pas** vérifier un prix (c'était l'ancien `legitimatePrices`, qui laissait un client détail payer le tarif de gros en silence).
  - ⚠️ **Le tarif est porté par la LIGNE, pas par la vente** — un panier monté en Détail puis basculé en Grossiste garde légitimement ses prix détail. `toSaleItemPayload(cart)` (`saleReconcile.ts`) **ne reçoit pas** le tarif sélectionné : l'erreur est rendue inécrivable, ne pas « réparer » cette signature.
  - **Produit inconnu du catalogue → 400 `UNKNOWN_PRODUCT`** (sans prix serveur, rien à comparer). Total = **Σ lignes serveur** − remise − fidélité, **TVA serveur** (`tenant.vatRate` + `posVatIncluded`). La déviation légitime (abîmé/négo) passe par la **remise manuelle**, déjà tracée : le panier n'offre AUCUN champ d'édition de prix de ligne.
  - **REJEU HORS-LIGNE HONORÉ (option A, voie 1)** ⚠️ : `honored = offlineReplay && staleCatalogAt !== null` — **DEUX conditions cumulatives**, et l'ORDRE du bloc est load-bearing (la qualification se calcule AVANT la décision ; l'inverse honorerait sur le seul drapeau — `tsc` le refuse, TS2448). `offlineReplay` est posé **UNIQUEMENT** par la file mobile (`saleReplay.ts`) : sans lui, le chemin en ligne direct est **exactement** celui de #145 (re-tarification + `reconcileSaleTotal` alerte le caissier au comptoir). ⚠️ **`clientCreatedAt`, `REPLAY_THRESHOLD_MS` et `honorClientPrice` sont SUPPRIMÉS** — cette branche dormante honorait **n'importe quel** prix sur un simple horodatage antidaté (1 F pour un produit à 1300), sans borne ni appartenance à un tarif. L'option A ne « ouvre » donc pas une porte : elle **remplace une porte grande ouverte et non gardée par une porte étroite et surveillée**. Ne pas ré-adosser un honneur à une horloge client — `salesPriceIntegrity.test.ts` échoue si on le refait.
  - **Le drapeau est FALSIFIABLE — vecteur assumé et BORNÉ** : un caissier forgeant `offlineReplay:true` ne peut faire passer qu'un prix qui **était réellement celui de son tarif DÉCLARÉ il y a moins de 48 h**. Il ne peut pas inventer un montant : le gain maximal est le delta d'un vrai changement de prix récent, sur les seuls produits concernés. Aucun signal non falsifiable de « c'était hors-ligne » n'existe (`idempotencyKey` ne porte pas le temps, l'horloge client n'est jamais transmise, un jeton pré-signé serait rejouable). La protection est donc le **CADRE** (`staleCatalogAt`, fait serveur) **+ la TRACE** : toute divergence écrit `submittedPrice`/`catalogPrice`/`staleCatalogAt` + `SaleItem.pricingHonored` + `Sale.priceDivergence=true` (audit a posteriori, `GET /api/sales?priceDivergence=true`).
  - **BORNES, et ce qui se passe dehors** : fenêtre **48 h** (2× le TTL du cache SW) et **profondeur 1** (deux changements rapprochés perdent le plus ancien). Hors bornes — ou tarif non qualifié, ou vente mixte partiellement qualifiée — le serveur **re-tarife** et le mobile écrit une **entrée durable `repriced`** (« à vérifier », distincte de `rejected` « à ressaisir » : la vente EXISTE, la confondre la ferait compter deux fois). **Jamais un honneur par défaut** : hors bornes = re-tarifer + avertir.
  - **Qualification « tarif précédent »** (Chantier B PR1) : `Product.previousPricing` + `pricingChangedAt` instantanéisent le jeu de tarifs sortant à chaque écriture qui change RÉELLEMENT un prix ; `SaleItem.staleCatalogAt` porte la qualification. **DEUX conditions cumulatives** : prix soumis ∈ tarifs précédents **du tarif déclaré** ET `now − pricingChangedAt ≤ STALE_CATALOG_WINDOW_MS` (48 h). Sans la borne, l'audit exonérerait une vraie fraude. Profondeur 1 ⇒ non concluant = `null`, **jamais une affirmation d'innocence**. **N'influence RIEN de ce qui est facturé.** Serveur-autoritaire (colonnes hors de la liste blanche `PRODUCT_UPDATE`, non forgeables). ⚠️ **Toute nouvelle colonne de prix sur `Product` DOIT être ajoutée à `PRICING_FIELDS`** (`utils/pricing.ts`), sinon un changement cesse d'être instantanéisé.
  - **UI d'audit** (ADMIN seul, `canAuditPrices`, historique POS) : **une source unique `priceGapLevel(rows)`** alimente badge + détail + sous-filtres → **QUATRE** niveaux, par ordre de PRUDENCE — `look` ambre (en ligne, inexpliqué) · **`honored` ambre « à vérifier »** (montant encaissé facturé tel quel au rejeu) · `previous` bleu (le tarif venait de changer, serveur re-tarifé) · `offline` gris (ventes historiques d'avant l'option A). ⚠️ **`honored` ne doit JAMAIS retomber dans le bleu** : là-bas le serveur a corrigé, donc l'argent est juste et le bleu se lit « fait établi » ; ici **l'argent a bougé** — il n'y a rien à établir, il y a une caisse à vérifier. Une trace stockée que personne ne regarde ne protège personne : c'est toute la contrepartie de l'option A. **Biais de PRUDENCE** : une vente mêlant expliqué et inexpliqué reste `look`. Deux sous-filtres distincts : **« À regarder »** (affinage CLIENT — le serveur ne sait pas ce qu'il « n'explique pas ») et **« Écarts honorés »**, ce dernier résolu **CÔTÉ SERVEUR** via `GET /api/sales?pricingHonored=true` (`items: { some: { pricingHonored: true } }`). ⚠️ Filtrer les honorés côté client ne verrait que la page de 50 ventes : un écart honoré de quelques jours deviendrait **introuvable**, et une trace qu'on ne peut pas retrouver ne protège personne. Verrou : `salesHonoredFilter.test.ts` (6, sabotage « filtre ignoré » vérifié). Vocabulaire **factuel** — « écart de prix », jamais « suspect »/« fraude ».
  - Verrous : `salesTariffIntention.test.ts` (11, **4 sabotages**) · `salesPriceIntegrity.test.ts` (rejoue la requête forgée + **la porte dormante refermée**) · `staleCatalogDivergence.test.ts` (10, **3 sabotages**) · **`offlineReplayHonor.test.ts`** (11, **5 sabotages** : honorer sans drapeau · honorer sans qualification · honorer sur un autre tarif · ordre inversé — rouge à `tsc` ET aux tests · ligne honorée non marquée) · mobile **`saleReplay.test.ts`** (10, **3 sabotages** : réponse jetée · drapeau absent · motif fondu dans `rejected`) · front `cartTariff.test.ts` / `saleReconcile.test.ts` (**2 sabotages**) / `priceGapLevel.test.ts` (22, **2 sabotages**).
- **Réconciliation du total encaissé** ⚠️ (Chantier B (c)) : `confirmSale` **capture** la réponse de `POST /api/sales` (elle était JETÉE). Le serveur étant autoritaire sur le prix, une re-tarification facture un autre montant que celui encaissé → **caisse courte sans cause explicable**. `reconcileSaleTotal(serverTotal, netTotal)` (`components/pos/saleReconcile.ts`, tolérance **1** comme le paiement mixte) dit au caissier **combien réclamer ou rendre** tant que le client est au comptoir (toast 15 s + `announce`).
  - `authoritativeTotal` alimente **le ticket imprimé ET le reçu WhatsApp** (les deux affichaient le total CLIENT ; le reçu WhatsApp envoyait même le BRUT). Il transite par une **`ref`** (`billedTotalRef`), pas un state, et `printTicket` garde sa **signature à zéro argument** — sinon `onPrint={printTicket}` passerait l'événement en 1er argument.
  - ⚠️ **`Number(null) === 0`** : sans filtre d'absence explicite (`readTotal`), un total serveur absent déclenchait « rendre 1 000 F » sur une vente saine et imprimait un ticket à **0**. Une absence de donnée doit rester une absence.
  - **Effet de bord utile** : une alerte sur une vente au tarif courant signale une **dérive des miroirs front/back** (TVA `computePosVat`, fidélité) — c'est un signal, pas un faux positif à museler. Verrou : `saleReconcile.test.ts` (11, sabotage vérifié). Aucun appel réseau ajouté au chemin critique. *(Prévenir AVANT l'encaissement = décision produit ouverte.)*
- **Session caisse** : `cashierIsOpen = requireCashier ? cashierOpen : !cashierForcedClosed` — sélecteur `useCashierIsOpen()` partout. `cashierForcedClosed` persisté ; `cashierOpen/Fund/Tx/CA`+`cart` exclus de partialize. `requireCashier` refetché au montage POS. Montants caisse XOF → `fmt()`. ⚠️ `onClick={() => confirmSale()}` jamais `onClick={confirmSale}` (event = JSON circulaire).

### Paiements mobiles

| Provider | Service | Env clés |
|---|---|---|
| **MTN MoMo** (CM) | `services/mtnMomo.ts` — polling 3s×40 | `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS=1` |
| **Campay/Orange** (CM) | `services/campay.ts` — token 55min, HMAC webhook fail-closed | `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS=1` (montant forcé 10 XAF) |
| **PayDunya** (SN/UEMOA) | `services/paydunya.ts` | `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS=1` |

**Flux POS** : polling → `confirmSale(mtnRef?, campayRef?, paydunyaRef?)`. Si PayDunya configuré, Wave+Orange → overlay QR `POSPaydunyaOverlay` (3s×100=5min). `isPaydunyaMode = paydunyaOk && (wave||orange)`.
**PayDunya** : `response_code:'00'` = succès, IPN = SHA-512(MASTER_KEY) fail-closed, réconciliation only. 16 tests.
**Campay carte** : `/api/get_payment_link/` (underscore), QR noir/blanc opaque. Sandbox : référence `SANDBOX-CARD-{ts}`.
**Stats** : `GET /api/payments/today-stats` (par `*Reference`, UTC, refunded exclus). Étendre `computePaymentStats` pour tout nouveau provider.
**⚠️ Sécurité sandbox** : `IS_SANDBOX` OK pour URL/devise, INTERDIT pour auto-approbation. Toujours `_SANDBOX_AUTO_SUCCESS=1` **explicite** + flag **inline dans le handler** (pas constante module → tests process.env inefficaces).

### UI POS/fidélité/onboarding — item 11 (maquettes) ⚠️
Refonte 2026-07 fidèle aux **maquettes faisant foi** `docs/ux-mockups/0N-*.view.html` (+ `docs/SPECS_UX_pos_fidelite_onboarding.md` en complément). À préserver :
- **POS plein écran** : classe `.pos-fullbleed` sur le wrapper → neutralise padding/scroll de `.page-content` (sinon débordement ~2×padding, CTA coupé). Colonnes grid `1.6fr / minmax(270px,1fr)` ; **< 900px** = vue panier dédiée (feuille défilante).
- **Header POS unique** : icône Store + nom boutique · pill « Caisse ouverte » **cliquable = modale de clôture** · recherche avec l'icône code-barres **dans le champ** (max 360px, hit-area 44px, réutilise `handleScan` — PAS de duplication) **gatée sur `posEnableScanner`** ; placeholder **honnête** : « …ou scanner » seulement si scan activé, sinon « Rechercher… » (pas de fausse promesse) · Historique en icône · badge réseau **uniquement hors-ligne**. ⚠️ Le « Scanner » du **panier** est le scanner de **carte fidélité** (QR `HABA-CUST:`, `POSCustomerSelector`) — fonction DISTINCTE du scan produit, ne pas confondre / fusionner.
- **Panier SANS modes de paiement** : la sélection vit dans la **feuille d'encaissement** (`POSModals` showModal) — Total à payer or + « dont TVA », tuiles 3×2 (Mixte pointillée, offline → cash-only), `POSCashField` (extrait, testable : clamp négatif, raccourcis Exact/arrondis dynamiques via `totalDisplay` **+ décimales devise** — pas 1000/5000 hors XOF, cf. `currencyDecimals`, « Rendu monnaie »), PayDunya = bouton brandé → overlay. Tuiles catalogue : prix = **montant or + suffixe devise séparés** (`amountLabel`/`curSuffix`, pas `fmt()` entier) ; stock bas = bordure `--warn` + point. **Prix barré (référence) UNIQUEMENT si `showStrikePrice(ref, eff)=ref>eff`** (helper `posShared`) — sinon « 2 800 2 800 » quand le tarif de gros retombe sur le prix détail. Modale remise : suffixe = symbole devise dynamique (`currencySymbol`), pas « F » figé ; icône type = Coins/Percent. **Mention tarif actif** discrète au-dessus de la grille (« Tarif Grossiste/Demi-gros appliqué », `--p2`) affichée hors Détail — le sélecteur de tarif est loin à droite.
- **Clôture caisse (maquette 03)** : ventilation par mode = ventes du JOUR via `salesApi.list` (lecture seule, repli CA session hors-ligne) ; **espèces attendues = fond + ventes ESPÈCES** (pas le CA tous modes) ; écart coloré par **MAGNITUDE** via `gapLevel` unique (écran ET rapport imprimé) : |é|≤1 XOF vert · < max(500 XOF, 5%) ambre · sinon rouge, surplus comme manque. Rapport imprimé : **TOUTE interpolation via `esc()`** (anti-XSS — `cashierName` = donnée utilisateur). `TicketZModal` (Z serveur, MANAGER+) inchangé.
- **Onboarding (maquette 05)** : tokens NKONI (plus de `public-scope`), 5 étapes à icônes, « Passer pour l'instant » partout (jamais bloquant), **payload défensif** (champs vides non envoyés — un skip n'écrase rien). `shopType` = UI only (non envoyé).
- **Captures maquette↔impl** : scripts `apps/frontend/e2e/pos-item11*.shot.mjs` (⚠️ `serviceWorkers:'block'` sinon le SW court-circuite `page.route` ; sorties `e2e/screenshots/item11/`). BillingBanner : masquée sur `/app/pos` + garde `status` malformé (anti « undefined jour(s) »).

### Fidélité
Backend autoritaire : `loyaltyDiscount = total × tierPct` (plafond 50%), `sale.total = NET`. Front envoie BRUT + `customerId` — **ne PAS envoyer le net** (double remise). QR carte = `HABA-CUST:<id>`, noir/blanc opaque, **aucune crypto**. `LoyaltyCardDigital` (maquette 04) : carte hero **teintée par palier** (couleurs FIXES — artefact PNG exporté, pas du chrome thémé), paliers actuel/prochain (remises/seuils tenant), activité = `loyaltyApi.get().history` (LoyaltyTransactions serveur).

### Paie ⚠️ — bulletins PERSISTÉS, instantané GELÉ

📖 *POURQUOI intégral (les deux règles de retenues incompatibles — 150 000 imprimé contre 130 500 affiché —, les trois temps de la correction de conversion, le verrou tout négatif aveugle au « zéro fois », les cas dorés chiffrés) : `docs/lessons/paie-conversion-et-gel.md`* — **à lire AVANT** de toucher `payrollShared`, `utils/payroll.ts`, `payrollDisplay`, `PayrollGrid`, `PayrollPayslips`, `printBulletin` ou l'une des 5 surfaces d'affichage.

**Modèle `Payroll`** (`@@unique([tenantId, employeeId, month])`) + `GET /api/payroll?month=YYYY-MM`, `POST /api/payroll/generate`, `PATCH /api/payroll/:id`. Rôles = **miroir exact** de `ROLE_PERMISSIONS['payroll']` côté front (ADMIN, SUPER_ADMIN, MANAGER, ACCOUNTANT, HR ; CASHIER exclu) — un serveur PLUS STRICT que l'UI ne protège rien, il produit des boutons visibles qui renvoient 403. **Génération IDEMPOTENTE** (`skipDuplicates` + contrainte d'unicité) : rejouer ne duplique pas et ne réécrit AUCUN bulletin existant. `paidAt` est posé par le **serveur** (une date de versement doit être vérifiable, pas déclarée par le navigateur) et **effacé** si le statut repasse hors « PAYÉ ». `PayRecord` est identifié par `employeeId` (cuid), **jamais par un index de tableau** — c'était `i + 1`, donc « marquer payé » visait une POSITION et un changement d'ordre payait le mauvais bulletin.

⚠️ **INSTANTANÉ GELÉ — c'est l'INVERSE de la règle Abonnements**, et c'est délibéré. Un abonnement ne stocke aucun total (« au tarif du jour ») ; un bulletin de paie FIGE `baseSalary/bonus/overtime/deductions/absences/net` **et le nom de l'employé** au moment de la génération. Une augmentation en août ne doit pas réécrire ce qui a été versé en juin — sinon la paie passée devient irrécupérable et l'export comptable ment rétroactivement. Ne jamais « simplifier » en joignant `Employee.salary` à l'affichage. ⚠️ **`Payroll.cnss` et `Payroll.ir` sont GELÉS** comme `net` : ils dépendent de taux **légaux**, donc les recalculer à l'affichage rejouerait un bulletin passé au barème du jour. Geler `baseSalary` sans geler `cnss` ne suffit pas. (La pénalité d'absence, elle, se redérive des champs gelés + la constante de 26 jours.)

⚠️ **`month` = clé ISO `YYYY-MM`, JAMAIS le libellé d'écran** (« Juillet 2026 »). Une clé qui dépend de la langue d'affichage rend les données illisibles au changement de locale et fait écrire des mois incompatibles à deux tenants en langues différentes. Conversion côté front (`monthKey`, rend `null` sur l'irreconnaissable — **jamais un mois par défaut**, un repli silencieux écrirait la paie sur le mauvais mois) ; le serveur **refuse** tout le reste en 400.

**Retenues ⚠️ SOURCE UNIQUE `payrollShared.payrollBreakdown`** (miroir back `utils/payroll.ts`, cas partagés `payroll-net-cases.json`) : **CNSS 8 % + IR 5 % assis sur le BRUT** (base+primes+heures sup), **tous deux DÉDUITS** ; `deductions` = retenues **EXCEPTIONNELLES** (avance, casse) qui s'**AJOUTENT** aux cotisations ; pénalité d'absence = `round(absences × base / 26)`. ⚠️ **Les taux ne vivent QUE dans `CNSS_RATE`/`IR_RATE`** — jamais en dur, jamais dans un libellé i18n (un taux écrit dans la chaîne redevient faux dans 4 langues au premier changement de loi).

⚠️ **CONVERTIR UNE FOIS — `payrollDisplay(record, currency)` puis `fmtDisplay`.** Le calcul vit en XOF, l'affichage peut être à 2 décimales : convertir chaque ligne PUIS le total séparément donne un bulletin **qui ne s'additionne pas**. **Règle : total = SOMME des lignes arrondies · net = brut − total**, gains inclus. Les valeurs rendues sont **DÉJÀ CONVERTIES** → `useFormatAmount`/`formatAmount`/`convertFromXOF`/`convertAmount` sont **INTERDITS** sur toute surface de paie (double conversion), et `payrollBreakdown` (XOF) n'est plus utilisé pour afficher. **Les 5 surfaces y passent** : page Paie (table + KPI + totaux), bulletin PDF, modale bulletin, cartes RH `PayrollPayslips`, grille RH `PayrollGrid`. ⚠️ **Un local qui porte des XOF se suffixe `Xof`** — deux locaux de même nom et d'unités différentes ont coûté une soustraction d'euros à des francs CFA.

⚠️ **UN SEUL générateur de bulletin : `printBulletin`** (l'onglet RH passe par l'adaptateur `payRecordFromEmployee` + `labelFromMonthKey`). Ne pas recréer un template : le méta-test rougit si un fichier consommant le détail de paie ouvre un document. **Logo — `LogoMark` est la seule source.**

**Verrous** : `payrollPersistence.test.ts` (20, dont augmentation-postérieure et bulletin-déjà-payé) · `payrollDisplayCoherence.test.ts` (12, cas doré + les 6 devises, 2 sabotages) · `payrollConvertOnce.test.ts` (15, règle POSITIVE incluse — *un verrou tout négatif est aveugle au « zéro fois »* — 5 sabotages inline + 2 réels) · `payrollFrozenNet.test.ts` · `payrollNetShared.test.ts` (jumeaux front/back sur le fixture) · `payroll-calc.test.ts`. **Sabotages vérifiés dans les deux sens** : ancien taux côté front seul → 8 rouges ; déduction retirée côté back seul → 8 rouges.

### Modules — index

📖 **Référence complète par module : `docs/modules.md`** (endpoints, schémas, composants, verrous,
et le POURQUOI de chaque décision) — **à ouvrir dès qu'on touche l'un d'eux**. Ci-dessous, uniquement
les règles **transverses** : celles qu'on enfreint sans même travailler sur le module concerné.

- **Codes-barres** ⚠️ : RÈGLE CANONIQUE UNIQUE `src/lib/barcode.ts`, **3 miroirs** (back/mobile/front, à l'identique) testés contre `docs/shared-fixtures/barcode-cases.json`. **Toute** logique barcode y passe — méta-test (`barcode.test.ts` front) échoue si une regex `\d{13}` locale réapparaît ailleurs. Jamais de strip des zéros de tête (casse le round-trip scan) ; `matchesScannedCode` (scan→panier) n'accepte **jamais** une sous-chaîne.
- **Étiquettes** ⚠️ : **EAN-13/EAN-8 uniquement**, JAMAIS de CODE128-sur-SKU (code non standard = piège caisse). Prix en **noir gras** sur les deux gabarits (Avery + thermique), jamais le violet écran. Quiet zones ≥10 modules via `quietZonePx`.
- **Facture PDF** ⚠️ : **DEUX générateurs vivants** — backend pdfkit (`lib/invoicePdf.ts`, LA vraie facture) et devis frontend (`utils/export.ts generateInvoice`). **Corriger les DEUX.** Tout montant imprimé passe par `pdfSafeSpaces()` / `printableAmount()` (U+202F absent de WinAnsi → « 8 /500 »), toute donnée dynamique par `escHtml()`.
- **Audit** ⚠️ : **TOUTE écriture d'audit passe par `writeAudit(label, promise)`** (fail-open mais TRACÉ). Exception : les 3 sites en `$transaction` propagent. Méta-test `auditWriteConvention.test.ts`. `UserAuditLog` est **hors boutique et SANS FK vers User** — un audit de sécurité survit à la suppression du compte.
- **Multi-boutiques** ⚠️ : **DEUX champs tenant, DEUX helpers** (`lib/tenantId.ts`) — `request.user.tenantId` (JWT, hérité) → `getTenantId()` ; `request.tenantId` (boutique ACTIVE résolue par `authenticate`) → `getActiveTenantId()`. Ne pas les confondre : sur une route platform-scopée, `user.tenantId` est légitimement nullable et `getTenantId` lèverait à tort. Appeler **APRÈS** les gardes 400/403.
- **Admin PLATEFORME** ⚠️ : `User.isPlatformAdmin` est le **SEUL** critère d'accès à `/api/admin/*`. **JAMAIS gater sur le rôle `SUPER_ADMIN`** — rôle INTERNE au tenant, y gater = fuite inter-tenants (P0 corrigé, `adminPlatformIsolation.test.ts`). Symétriquement, ne jamais masquer le commerçant **par le rôle** : le dépouillement de l'interface se fait sur `isPlatformAdmin`.
- **Expiration de promo** ⚠️ : helper pur **`isPromotionActive(hasPromotion, promotionEnd, now)`**, miroir back (`utils/pricing.ts`) ↔ front (`lib/pricing.ts`), cas partagés `promotion-active-cases.json`, `now` **injecté**. Échéance inclusive au jour calendaire **UTC**. ✅ **Miroir MOBILE (`posStore.ts`) ALIGNÉ et désormais ENFORCED** — `mobile/src/__tests__/promotionActiveShared.test.ts` exerce `isPromotionActive` sur les 9 cas partagés et tourne en CI depuis #163. *(Ce fichier a longtemps affirmé le miroir « PAS aligné » : c'était FAUX — il l'était, il n'était simplement pas enforced. Une dette d'exécution lue comme une dette de code.)*
- **Abonnements** : **aucun total n'est stocké** (dérivé de `product.sellPrice` → « au tarif du jour ») et **aucune colonne de fréquence** n'existe (`dayOfWeek` impose l'hebdo) — ne pas promettre en UI ce que le modèle ne porte pas.
- **Commandes** ⚠️ : **`PurchaseOrder` ne représente QUE des commandes FOURNISSEUR** — `supplierId` y est une FK obligatoire, et il n'existe ni `clientName`, ni `clientPhone`, ni colonne `type`. Les **commandes CLIENT de l'écran sont donc LOCALES et ÉPHÉMÈRES** (décision produit du 2026-07-29, #171) : aucun appel serveur n'est émis pour elles. Avant, il l'était — sans `supplierId` — et se faisait refuser en **400 systématique**, dont le caissier ne voyait qu'un « Échec de la création ». La persistance des commandes client est une **dette backend** (colonnes + zod), pas un oubli du front.
  - ⚠️ **ASYMÉTRIE écriture/lecture** : on ENVOIE `items[].product`, le serveur range en `items[].productName` (le handler mappe). Passer par **`toOrderPayload`** — envoyer les lignes du formulaire telles quelles (`{id,name,price,qty,emoji}`) est exactement ce qui a cassé la création : **0 commande en base** jusqu'au 2026-07-29, avec `tsc` vert parce que `create` prenait `any`.
  - **Frontière dans la frontière** : `GET /api/orders` fait `include: { items: true, supplier: true }` → le `supplier` reçu est la ligne Prisma **brute** (`ApiSupplier` : `categories` en CHAÎNE, `leadTime` camelCase), pas l'interface `Supplier` du front. Le `POST`, lui, fait `include: { items: true }` **sans** supplier → sa réponse est plus étroite (`Omit<ApiOrder,'supplier'>`).
  - Verrous : test **JUMEAU** sur `docs/shared-fixtures/order-create-cases.json` — le front prouve que `toOrderPayload` produit le cas nominal, le back que le zod l'accepte et refuse les formes cassées ; plus `ordersApiTypes.test.ts` (accès fantôme = **TS2339**, comparaison hors union = **TS2367**).
- **Sidebar / permissions** : zone quotidienne épinglée + 4 groupes d'intention ; en-têtes masqués si aucune entrée `canAccess`. Pas de badge factice (seul Stock en a un, réel).

### Tests
- ⚠️ **Un compteur de tests écrit ici se périme au commit suivant** — celui du mobile a menti deux fois le 2026-07-31 (261 puis 267, dans la même journée), et un chiffre faux dans un fichier qui fait autorité coûte plus qu'un chiffre absent : on le recopie. **Ne pas réinscrire de total ; lancer la suite.** *(Plus AUCUN total ici : les 4 compteurs mobile sont tombés en #190, les 2 front/back au commit suivant — le garde-fou d'accessibilité venait de faire passer le front de 747 à 749, moins de 24 h après la mesure. La commande fait foi, elle ne se périme pas.)*
- **Front : `cd apps/frontend && npx vitest run`** (helpers purs + anchor tests + contraste AA sur les 2 thèmes concrets dark+light). Lancer **`vitest run` COMPLET** avant tout push touchant landing/login/thème (`landing.anchor.test.tsx` fige le H1 du hero). **Back : `cd apps/backend && npx vitest run`** (prisma mocké `vi.mock('../db')`, routes via `app.inject()`, mock `authenticate` via `vi.hoisted`). ⚠️ **`strict: true` COMPLET côté backend** (`apps/backend/tsconfig.json`, item 10 fini backend — `strictNullChecks` était déjà on, les 21 erreurs restantes résiduelles — `noImplicitAny` params + `err` unknown dans les catch — ont été corrigées) : verrou prouvé (une régression de nullité/typage casse tsc/CI). **Frontend AUSSI `strict: true`** (102 erreurs résolues, surtout par typage des états de formulaire — `StockForm`/`CatForm`/`LabelConfig`/`CustomerForm`/`ContractForm`/`LeaveForm`/`DiscountForm` définis dans les modules partagés et threadés dans les props `form`/`setForm` — plutôt que des `any` mécaniques ; 2 vrais bugs de type révélés au passage : union `averyPreset` incomplète, config d'impression A4 vs thermique). Filet global `src/tests/setup/mockPaidSdks.ts` (`setupFiles`) : aucun test unitaire ne parle à un SDK payant (Anthropic/Twilio/Resend) — un `vi.mock` local garde précédence. **Mobile : `cd mobile && npx jest`** (`cd mobile && npx jest`, cf. § Commandes) — **en CI depuis #163** (job `unit-tests-mobile`). ⚠️ Certains tests montent une route avec un `total` DÉCOUPLÉ des lignes (ancien « trust client total ») → cassés par l'intégrité prix serveur-autoritaire ; envoyer des lignes qui somment au total voulu (cf. `loyalty.test.ts`). **Cas PARTAGÉS backend↔mobile↔frontend (anti-dérive)** via `docs/shared-fixtures/*.json` lus par les tests jumeaux des différents côtés — modifier la règle d'un côté sans l'autre fait échouer le test : `loyalty-discount-cases.json` (`computeLoyaltyDiscount` : arrondi/plafond 50 %/remise manuelle) ; `barcode-cases.json` (`normalizeBarcode`/`isValidBarcode`/`barcodeMatches`/`matchesScannedCode` — canonicalisation, recherche, résolution scan) ; `csv-injection-cases.json` (`sanitizeCsv` front↔back — cf. § Injection CSV) ; `payroll-net-cases.json` (`payrollBreakdown` front↔back — le front l'AFFICHE, le back le FIGE en base, cf. § Paie). ⚠️ Codes-barres : **méta-test** (front `barcode.test.ts`) échoue si une regex `\d{13}` locale réapparaît hors de `lib/barcode.ts` ; les 3 rendus (vignette écran + Avery + thermique) ont un test qui verrouille les **quiet zones ≥10 modules** ; PDF étiquettes non grep-ables → mocker jsbarcode/jsPDF et capturer les options (cf. `exportLabels`/`thermalLabel`/`barcodeVignette`). OCR : `vi.hoisted()` + classe constructeur. **PDF pdfkit non grep-able** (buffer binaire) → tester présence/absence de texte en **mockant pdfkit** et capturant les `.text()` (cf. `invoiceBilledTo.test.ts`). ⚠️ Route avec `schema` zod → `app.setValidatorCompiler(validatorCompiler)` avant `register` (cf. § Sécurité). Isolation cross-tenant : `tenantIsolation.test.ts` (mock Prisma tenant-aware).
- **MSISDN — UNE règle de nettoyage, DEUX politiques** ⚠️ : `lib/msisdn.ts`, **jumeaux front/back à l'identique**, cas partagés `docs/shared-fixtures/msisdn-cases.json`. Il existait deux fonctions HOMONYMES `normalizeCameroonPhone` (POS.tsx → MTN, campayPayment.ts → Campay) : **8 entrées sur 20 divergeaient**, sur deux axes qu'il fallait séparer avant de fusionner — sans quoi « fusionner » revenait à choisir au hasard le comportement d'un des deux appelants. (a) **Ponctuation, accidentel** : le back retirait le point et faisait `trim()`, pas le front (« 699.000.001 » accepté d'un côté, refusé de l'autre) → on prend le SUR-ENSEMBLE. (b) **Périmètre géographique, DÉLIBÉRÉ** : MTN accepte 8–15 chiffres de tout pays parce que son bac à sable utilise des numéros ÉTRANGERS (46733123453 = Suède), Campay ne dessert que le Cameroun. Aplatir cassait forcément un côté — permissif : Campay expédie un numéro français à une API qui ne sait pas le traiter, en silence ; strict : le flux de test MTN meurt. D'où `normalizeMsisdn(raw, policy)` avec `policy` **sans valeur par défaut** (le compilateur force chaque futur appelant à choisir, comme le `owner` de `resolveRecipient`). ⚠️ **La politique est verrouillée AU POINT D'APPEL**, pas seulement dans le module : basculer POS en `'cm-only'` laissait toute la suite VERTE (sabotage S20) et aurait tué le bac à sable MTN en silence — un invariant garanti sur le module ne dit rien de ce que l'appelant en demande. 6 sabotages vérifiés (aplatissement dans les deux sens, régression de ponctuation, jumeau qui bouge seul, politique retournée à chaque point d'appel). ⚠️ **Les DEUX routes normalisent côté SERVEUR** — `campayPayment.ts` (`cm-only`) et `mtnPayment.ts` (`international`). MTN ne le faisait PAS : son zod ne vérifiait que `min(1)` et le numéro partait tel que le client l'envoyait, la normalisation n'existant que dans `POS.tsx`. **La garde du navigateur n'est pas une garde** : un appel direct à l'API passait. Un numéro irrécupérable rend **400 `PHONE_INVALID`** et le SDK n'est jamais appelé ; le numéro n'apparaît pas dans le message (PII, cf. `redactPhone`). Le verrou énumère les routes NOMMÉMENT et échoue si une route de `routes/` appelle `normalizeMsisdn` sans figurer dans la liste — un 3ᵉ prestataire ne peut pas entrer en douce. ⚠️ **La FORME du refus est verrouillée aussi** : corps unique `phoneInvalidBody(policy)` (`lib/payments/providerConfig.ts`), **message DÉRIVÉ de la politique** — écrit à la main, un « format Cameroun attendu » survivrait à un passage en `international` et dirait au commerçant l'inverse de ce que la route accepte. Les deux routes avaient déjà divergé dessus (`{ error }` nu vs `{ error, code }`) : verrouiller la politique sans verrouiller le refus laissait l'écart revenir par l'autre bout.
- **Tests qui FIGENT au lieu d'affirmer** ⚠️ — purge du 2026-08-06, **−58 cas** (back 1119→1083, front 989→978). Mécanisme : *le test décrit ce que le code FAIT au lieu d'affirmer ce qu'il DOIT faire*. Invisible tant que le comportement est juste ; le jour où il devient faux, **le test protège le défaut**. **UN TEST QUI N'AFFIRME RIEN SE SUPPRIME, IL NE SE RÉPARE PAS** : le réparer invente une couverture que personne n'a demandée sur un code que personne n'a jugé prioritaire de tester ; le supprimer rend le chiffre honnête. **Critère de succès d'une telle purge : le total DOIT baisser.** Signature la plus grave, et elle n'était dans aucune liste : un cas qui ne touche la production **par aucun moyen** — ni import, ni `readFileSync`, ni `app.inject`, ni `render`. `routes.test.ts` en comptait 28 sur 36 (`expect(typeof q.where.email).toBe('string')` pour « Prisma protège injection SQL ») ; `auth.test.ts` contenait `it('true is true')` ; `mtn-normalize.test.ts` validait une **copie manuelle** de `normalizeCameroonPhone`, assumée en commentaire — sur le numéro qui REÇOIT un paiement MTN (extraite depuis dans `lib/msisdn.ts`, la copie supprimée ; les 19 cas repassent verts contre la vraie, donc elles n'avaient PAS encore divergé). Le tort n'est pas de rater une régression : c'est que **le TITRE dissuade d'écrire le vrai test** (« l'isolation multi-tenant ? c'est déjà couvert » — elle l'est, mais par `tenantIsolation.test.ts`, pas par eux).
  - ⚠️ **DEUX LIMITES DE LA DÉTECTION, à ne pas laisser croire couvertes.** (1) Le critère « ne touche pas la production » est **structurel** : un test qui importe un symbole puis assert à côté de la plaque passe au travers — les 14 cas de `components.test.tsx` utilisant `formatInCurrency` n'ont PAS été vérifiés sur ce point. **66 était un PLANCHER, pas un total.** (2) La signature « libellé figé deux fois » n'a **pas** été balayée largement : distinguer « libellé que le test OBSERVE » de « libellé que le test IMPOSE » demande une heuristique qu'on n'a pas ; un balayage naïf rend des centaines de faux positifs (chaque `getByText('Enregistrer')` légitime).
  - ⚠️ **LE REPROCHE ANTICIPÉ — suite directe du CTA désactivé, et il avait survécu.** On avait retiré l'EMPÊCHEMENT (bouton éteint), pas le REPROCHE. `ValidatedInput` posait `touched` sur tout `blur` : or les modales **autofocusent leur premier champ**, donc le simple fait de cliquer ailleurs affichait « Ce champ est requis » sur un champ que l'utilisateur n'avait jamais choisi de visiter. ⚠️ **La description initiale disait « au montage » — MESURÉ, c'est FAUX** : au montage le message est absent, il apparaît au premier `blur`. Corriger le symptôme décrit aurait manqué la cause. Désormais `touched` exige une SAISIE réelle (ou une valeur préexistante) ; la soumission reste couverte par le refus explicite des modales. Verrou : `hrContractDomain.test.ts` (sabotage vérifié).
  - ⚠️ **Le bandeau « modifications non sauvegardées » ne s'affiche que s'il y a EU modification** — il l'affirmait dès l'ouverture du mode édition, avant tout changement. Une alerte qui crie toujours n'alerte plus quand elle devient vraie : deux états distincts (« Mode édition » / « … — modifications non sauvegardées »), comparés à un instantané pris à l'entrée en édition.
  - **Méta-règle en place** (`landingClaims.test.ts`) : **aucun CTA de soumission désactivé par la VALIDATION**, sur tout `src/` (publiques ET authentifiées). Un bouton éteint gronde avant l'erreur, ne dit pas ce qui manque, et n'affiche **aucune infobulle au toucher** — sur mobile il n'explique rien. Exemptions NOMMÉES : requête en vol (`loading`/`saving`/`scanning`…, anti double-soumission), sélecteurs CSS `:disabled`, déclarations de type, champs de saisie, relais `disabled={disabled}`. ⚠️ La règle vise la **forme** « éteint parce qu'un CHAMP n'est pas rempli » : élargir à toute désactivation noyait le défaut sous les **capacités** indisponibles (panier vide, hors-ligne, stock épuisé), qui sont légitimes — il n'y a rien à « nommer » qui manque. Sabotages vérifiés dans les DEUX sens.
- **E2E Playwright** : live prod sur **tenant dédié `e2e-tenant`** (EUR, `requireCashier=true`, compte `e2e@habashop.com` SUPER_ADMIN mono-boutique) — issue #5 close. Fixtures **statiques** via `apps/backend/scripts/seed-e2e-tenant.ts` (idempotent, guard `E2E_SEED=1` + scope `e2e-tenant`, **manuel** ; jamais demo/prod). Fixtures **datées** (ventes du jour → `dashboard-donut`) créées par API dans `auth.setup` (`e2e/helpers/fixtures.ts`, **pas de secret DB** en repo public). `auth.setup` login `e2e@` ; `e2e/helpers/preconditions.ts` + `test.skip` conditionnels = garde-fou (0 skip nominal). `storageState` `e2e/.auth/user.json`, `workers:1`. **Smoke : navigation par clic** (pas `page.goto` après login → logout cold-start). **BASE surchargeable** : `playwright.config` + chaque spec lisent `E2E_BASE`/`PAYROLL_BASE`/`POS_BASE`/`STOCK_BASE`/`PAGES_BASE`/`DASH_BASE`/`CUST_BASE`/`HR_BASE`/`REPORTS_BASE`/`SETTINGS_BASE` (défaut prod) → pour valider un build local, `vite preview` + **tout** mettre sur `http://localhost:PORT` (sinon cross-origin : auth locale ≠ site prod → redirection login). API prod (build) = `https://habashop-production.up.railway.app` (Railway, cold-start ~lent, free-tier).
- **A11y** : `useModalFocus` (34 modales), `announce()` (8 domaines), skip-link, `*:focus-visible`, `prefers-reduced-motion`.

## Règles devise / montants ⚠️

- **Tout XOF en base.** `fmt()`/`useFormatAmount()` convertissent XOF→devise. **Ne JAMAIS pré-convertir** (= double conversion).
- **Exception** : valeurs déjà en devise tenant (`pointsPerAmount`, remises fidélité, valeur carte) → `formatInCurrency` SANS conversion.
- **Exception — console PLATEFORME** ⚠️ (`AdminDashboard`, #165) : CA par boutique, montants de demandes de plan et prix des plans sont tarifés en **XOF** (Wave / Orange Money) et s'affichent en **FCFA**, jamais dans la devise d'affichage du super-admin. `useFormatAmount()` y convertirait à des taux externes et rendrait un chiffre qui n'est celui de personne — un opérateur réglé en EUR lisait « Starter — 15,09 €/mois » au lieu de « 9 900 FCFA ». Ces montants ne sont **pas** en devise-tenant : le convertisseur per-viewer n'a rien à y faire. Verrous : `adminXof.test.ts` (méta-test, interdit le RETOUR de `useFormatAmount` dans le fichier) **+** `adminXof.behaviour.test.tsx` (4 — monte le VRAI `AdminDashboard` avec le VRAI `appStore` en EUR ; ⚠️ ne PAS mocker `@/stores/appStore`, ce serait un vert qui ne prouve rien). Sabotage vérifié : 1 rouge au méta-test, 3 au comportemental.
- **Pages publiques** : `convertAmount` + `formatInCurrency` (fonctions pures — pas le hook).
- **Devise affichage = per-device** ; `setTenant` n'adopte `tenant.currency` qu'au changement de boutique.
- Saisie formulaires : devise affichage → `toXOF()` au submit. Suffixe = `CURRENCY_SYMBOLS`.
- Agrégats CA : `Sale.total`, bornes `new Date(y,m,1)` serveur, refunded exclus.

## Pièges techniques

### Frontend
- **QR/barcode** : noir sur blanc opaque (jamais `var(--text)`/`transparent`).
- **`transform` sur ancêtre** → casse `position:fixed`. Animer opacité seule.
- **`applyAccentColor()`** écrase `--p/--p2/--p3` via `ACCENT_PAIRS` (plus de verrouillage `body.className` depuis le retrait de `gold`/`soleil`). Détection clair = **`isThemeLight(theme)`** d'appStore (résout `system`), jamais une comparaison littérale à `'light'`/`'soleil'`.
- **Date « now »** : param injectable défaut `new Date()` — jamais de littéral `new Date('...')`.
- **Dates AFFICHÉES** : `fmtDate()` de `lib/formatDate.ts` (jj/mm/aaaa, convention fr). Parse par **découpage de chaîne**, jamais `new Date(iso).toLocaleDateString()` qui décale le jour d'un cran en fuseau négatif (le 05 s'affiche « 04 »). Jamais l'ISO brut `{e.date}`.
- **SVG + `var()`** : `fill="var(--…)"` ne résout pas → `style={{color}}` + `fill="currentColor"`.
- **`var(--)` + alpha concaténée = MORT ⚠️** : `` `${x.hex}28` `` avec `x.hex='var(--p)'` rend `var(--p)28` = couleur INVALIDE → la propriété retombe à sa valeur initiale (`border:none`, fond transparent), **invisible à tsc ET aux tests**. Un champ couleur concaténé avec une alpha reste un **`#hex` littéral** (8-chiffres, PAS `color-mix` — compat WebView Android), jamais tokenisé en `var(--…)`. Verrou AST : `noVarInConcatenatedColor.test.ts` (résout `${obj.champ}NN` → tableau `.map` → échoue si `champ` y vaut une chaîne `var(--`). Bug trouvé à l'écran, pas par les gates (2026-08-01, #211/#212).
- **Polling** : closure stale → `useRef` pour valeur courante. Logique succès dans `useEffect([status])` séparé.
- **Google Maps** : re-init via compteur `mapVersion` (state) + `key={mapVersion}` sur div.
- **IDs employés** : cuid string — jamais `Number(id)`.
- **% recharts** : `p.percent` undefined au survol → UNE source de vérité dans les données. Palette : `% COLORS.length`.
- **Découpe composant** : test ancrage d'abord (rendu + interactions), puis découpe identique.

### E2E Playwright
- SW PWA court-circuite `page.route()` → `serviceWorkers: 'block'`.
- Caméra @zxing : `--use-fake-device-for-media-stream` + `--use-fake-ui-for-media-stream`.
- Pas de `page.reload()` (→ logout). Seeder via `page.addInitScript`.
- Tooltip donut recharts : `page.mouse.move` sur rayon inner/outerRadius.

### Backend
- **Crons** : `setInterval` + garde fenêtre-temps + marqueur idempotent en base. Les boucles de notification vivent dans **`services/notificationCrons.ts`** — extraites de `server.ts` (qui appelle `start()` au chargement, donc était INTESTABLE : c'est ce qui a laissé #154 s'installer sans être vu).
- **Crons multi-canaux — CHAQUE canal porte SA garde** ⚠️ : la boucle d'alerte stock sert e-mail + push + SMS. Elle a absorbé **trois canaux en deux mois**, chacun ajouté SOUS un garde écrit pour le précédent (#154) : `notifEmailStock` dans le `where` du `findMany` tenant, et `if (!admin?.email) continue` avant les trois dispatches. Couper les alertes **par e-mail** coupait donc aussi le **SMS** et le **push**, en silence — alors que `SectionNotif` présente les bascules comme indépendantes et que `sms.ts` annonce le SMS gardé par `notifSmsStock`+`ownerPhone` seulement. **Deux règles** : (a) le `where` de sélection des tenants ne filtre QUE l'activité du tenant, **jamais une préférence de canal** (elle en exclurait tous les autres) ; (b) un garde qui ne concerne qu'un canal reste **local à ce canal** — pas de `continue` avant les dispatches. Verrou : `stockAlertChannels.test.ts` (7 tests, **4 sabotages vérifiés**, dont un qui échoue si le PROCHAIN canal — `notifSmsSales`, annoncé — est remis dans le `where`).
- **Webhooks** : HMAC-SHA256 raw body, `timingSafeEqual`, **fail-closed partout** (Wave inclus : `wave.ts` `if (!secret) return false`). Reste à poser `WAVE_WEBHOOK_SECRET` en prod.
- **Tests PDF** : signature `%PDF` + taille >500o.

### ⚠️ `as '…'|'…'` — LE CAST QUI RÉTRÉCIT DÉSACTIVE LA SEULE PARADE AUTOMATIQUE

Le § suivant dit que la parade contre l'arité est le `Record` exhaustif, parce que **le
compilateur rougit là où aucun test ne le fera**. Un `as` vers une union de littéraux
**éteint exactement cette parade** : ce n'est pas une annotation, c'est une affirmation
que `tsc` a été prié d'accepter sans la vérifier. Le ternaire avale dans son `else` ; le
cast avale tout court.

**MESURÉ le 2026-08-06** — `Employee.type` était typé `'CDI' | 'CDD'` alors que
`CONTRACT_LABELS`, **trente lignes plus bas dans le même fichier**, en libellait CINQ, que
`schema.prisma` porte `type String` (aucun enum) et que le zod backend est
`z.string().optional()`. Le type ne décrivait pas la donnée : il décrivait ce que le plus
pauvre des trois formulaires savait offrir. Deux dégâts, tous deux SILENCIEUX — l'alerte
d'échéance testait `type === 'CDD'`, donc un **Stage daté n'était jamais signalé** ; et
`NewContractModal` **jetait `endAt`** pour tout type autre que CDD.

⚠️ **Le cast n'était pas encore passé en PRODUCTION** (base : CDI 8 · CDD 2 · rien d'autre)
— parce qu'aucun tenant client n'existe et que les seeds n'écrivent que CDI/CDD. Le chemin,
lui, était ouvert : deux des trois écrans proposaient les cinq valeurs. **Un défaut latent
se mesure au CHEMIN, pas au contenu de la table.**

**Balayage des trois cibles : 12 casts, dont UN seul défaut.** La distinction est nette et
un scanner naïf s'y trompe :

| Forme | Verdict |
|---|---|
| `'medium' as 'small'\|'medium'\|'large'` (Stock, POS) | **ÉLARGIT** un littéral pour l'inférence de `useState` — idiome correct |
| `mimeType as 'image/jpeg'\|…` (`invoiceOcr:52`) | **correct** : précédé de `if (IMAGE_TYPES.includes(mimeType))`, garde runtime que TS ne sait pas inférer |
| `(t.priceMode === 'HT' ? 'HT' : 'TTC') as 'TTC'\|'HT'` | redondant, l'expression a déjà ce type |
| `lang as 'fr'\|'en'\|'es'\|'it'` (planningShared) | rétrécit, mais **gardé** par un `?? [repli]` |
| `contractForm.type as 'CDI'\|'CDD'` | **LE DÉFAUT** — supprimé |

✅ **Le cas `posDefaultPayment` est TRAITÉ — et « inatteignable » était FAUX.** Premier
diagnostic : « aucun écran n'écrit ce champ, il vaut toujours `'cash'` ». L'historique dit
l'inverse — `Settings.tsx:646` (commit `1e519fca`, **2026-05-20 → 05-24**) offrait un
sélecteur à CINQ options sous un `as 'cash'|'card'|'mobile'` :

```
déclaré au type     cash · card · mobile
offert à l'écran    cash · card · wave · orange · mobile      ← le cast mentait DANS LES DEUX SENS
accepté par le POS  cash · card · wave · orange · mtn
```

⚠️ **Et `appStore` est PERSISTÉ en localStorage** (`partialize` garde ce champ dans `...rest`) :
un commerçant ayant choisi « 📱 Mobile » pendant ces quatre jours l'a **toujours dans son
navigateur**, et le POS lui pré-sélectionnait une tuile inexistante. L'écran a disparu quatre
jours plus tard — la valeur est devenue inatteignable **en écriture**, jamais **en lecture**.
**Un champ persisté n'a pas de domaine « actuel » : il a l'union de tous ceux qu'il a eus.**
Chercher qui écrit AUJOURD'HUI ne suffit pas ; il faut `git log -S` sur le champ.

Corrigé : `POS_PAY_MODES` / `PosPayMode` dans `appStore`, les deux casts de `POS.tsx`
supprimés, et **`resolvePosPayMode(raw: unknown)` appelée par `merge`** — même forme de
repli gracieux que `VALID_THEMES`. **DÉCISION PRODUIT : `'mobile'` → `'cash'`, jamais vers un
prestataire** ; le commerçant a choisi « Mobile » quand l'écran ne demandait pas lequel, en
désigner un à sa place inventerait sa décision, et la disponibilité réelle dépend de la config
SERVEUR du tenant, pas de l'appareil. ⚠️ Domaine tenu **DISTINCT** de `PaymentMethodId`
(paiement d'ABONNEMENT : `wave|orange_money|mtn_money|virement|card`) — se ressemblent,
diffèrent, et les fondre perdrait ce que chacun distingue.

Verrou : `posPayModeDomain.test.ts` (6, **5 sabotages**), périmètre DÉRIVÉ des tuiles rendues.
⚠️ **Son sabotage décisif est passé VERT au premier tir** : le test rejouait la règle de repli
à l'identique au lieu d'appeler celle du store, donc « `'mobile'` → `'wave'` » ne le touchait
pas. D'où l'extraction en fonction NOMMÉE, exercée telle quelle — *une règle réécrite dans un
test ne prouve rien de ce que le code fait.*

**Règle : élargir le type, jamais caster.** Un `as` vers une union de littéraux n'est
acceptable que (a) pour ÉLARGIR un littéral, ou (b) immédiatement après une garde runtime
qui l'établit — et alors la garde se cite à côté. Verrou : `hrContractDomain.test.ts`
(11, **5 sabotages vérifiés**), qui juge la FORME et non l'identifiant.

⚠️ **Un test qui NOMME le défaut le protège.** `hrmodals.anchor` cherchait
`getByLabelText('Nom complet *')` : il figeait donc le DOUBLE marqueur de champ requis
(`ValidatedInput` rend déjà son propre `*`) et serait devenu un frein à sa correction. Il
dérive désormais (`/^Nom complet/`). Même motif que `signup.anchor` figeant « Sénégal ».

### Arité des ternaires ⚠️ — la parade est le `Record`, PAS un scanner

**MESURÉ le 2026-08-06** sur 425 fichiers de production (web + API + mobile) : **1 268
chaînes** de ternaires portant sur un domaine typé, dont **1 211 exhaustives**. Le motif
`x === 'litéral' ? A : B` est donc massivement CORRECT — 57 chaînes seulement avalaient
≥ 2 valeurs, et après lecture il ne restait que **25 défauts réels**.

⚠️ **NE PAS écrire de verrou-scanner sur ce motif.** Décision prise après mesure, pas par
principe : à 95 % de justes, un scanner crie au loup et se fait désarmer. Surtout, la seule
liaison qu'il puisse faire à bas coût — **par NOM DE VARIABLE** — s'est révélée FAUSSE au
cours de la mesure elle-même : `e.status` (statut de dépense, PAYÉ/EN ATTENTE, cardinalité 2)
était attribué au domaine des statuts de tenant, `alert.level` à `priceGapLevel`, `filterStatus`
aux statuts de `PlanRequest`. Des ternaires **binaires corrects sur un domaine binaire**,
comptés comme défauts. **La seule liaison sûre est par les LITTÉRAUX testés** : la chaîne
appartient au domaine D si *tous* ses littéraux appartiennent à D.

⚠️ **Second piège de mesure : la QUEUE d'une chaîne ressemble à un binaire.**
`lang === 'en' ? … : lang === 'es' ? … : lang === 'it' ? … : fr` produit quatre
correspondances, dont la dernière semble binaire. Sans regroupement par offsets d'expression :
**1 366 faux positifs**. Regrouper d'abord, juger ensuite.

**La parade est le `Record<Domaine, …>`** — `tsc` échoue si une valeur est ajoutée sans être
décrite, ce que le ternaire ne peut pas faire (son `else` avale silencieusement). À poser
**uniquement là où le domaine GRANDIRA** :
- **`paymentMethod`** — `lib/paymentMethods.ts`, jumeaux front/back + fixture partagée
  `docs/shared-fixtures/payment-methods.json`. Il y avait **TROIS** implémentations avec
  quatre divergences (UpgradePlan ignorait `card` et donnait `#00B3FF` à Wave quand
  `--brand-wave` vaut `#1B9AF5` · email.ts collait le pictogramme DANS le libellé ·
  AdminDashboard rendait le champ BRUT — « virement », « mtn_money » — au-delà de deux
  marques). `offeredInTunnel` distingue ce qu'on PROPOSE de ce qu'on sait NOMMER, exactement
  comme `purchasable`/`billable` du catalogue de plans.
- **`payMode` mobile** — `mobile/src/lib/paymentLabel.ts`. Les deux reçus (`printReceipt.ts`,
  `whatsappTicket.ts`) portaient la MÊME chaîne à trois branches sur un domaine de cinq :
  une vente **MTN MoMo s'imprimait « Carte »** sur le document remis à l'acheteur. ⚠️ Chemin
  mesuré : `posStore.PaymentMode` du mobile ne contient pas `mtn`, le défaut semblait donc
  inatteignable — il ne l'est pas, `app/(app)/sales/index.tsx` réimprime depuis
  `sale.paymentMode`, une vente RELUE DU SERVEUR (encaissée sur le web).
- **`Sale.paymentMode` WEB** — `apps/frontend/src/lib/salePaymentModes.ts`, jumeau de
  `mobile/src/lib/paymentLabel.ts`, fixture `docs/shared-fixtures/sale-payment-modes.json`.
  **CINQUIÈME et SIXIÈME instances du même domaine, dans le même fichier**, deux jours après
  la correction mobile ci-dessus — la preuve que corriger un jumeau ne ferme rien tant que la
  SOURCE n'existe pas. Les deux erreurs étaient **symétriques**, et c'est ce qui les rendait
  invisibles à la relecture : `mobile` était RENDU alors que le serveur ne l'écrit **jamais**
  (0 sur 1 908 ventes), pendant que `mtn` et `mixed` étaient écrits et **absents du
  graphique**. Cf. § Répartition paiements.
- **`Tenant.status`** — `mobile/src/lib/tenantStatus.ts`. `pending_payment` et `cancelled`
  tombaient dans le VERT « actif », libellés par le champ brut de la base. Or
  `pending_payment` est l'état de **tout futur client payant** (la voie d'abonnement est
  manuelle). ⚠️ La colonne est un `String`, pas un enum : une valeur inconnue doit être
  **neutre et VISIBLE**, jamais assimilée à « actif ».

⚠️ **JUSTESSE EMPRUNTÉE — l'enregistrer, ne pas la « corriger ».** `spendGuard.quotaLimit`
mappe cinq statuts sur deux paliers de quota : l'expression **n'est pas fausse** (il n'existe
que deux jeux de plafonds). Elle n'est juste que parce que `authorizeSpend` applique ses gardes
dans l'ordre **démo → statut → rafale → quota** et que `tenantSpendState` refuse `suspended` et
`cancelled` AVANT d'atteindre cette ligne — sinon une boutique suspendue hériterait du palier
PAYANT sur un chemin de dépense facturée. **Une justesse qui dépend d'un invariant distant et
que rien n'enregistre est une justesse empruntée** : elle disparaît au premier réordonnancement,
sans qu'aucune suite ne rougisse (`tsc` ne voit rien, les deux fonctions étant valides
séparément). D'où `spendGuardStatusOrder.test.ts` — il ne teste pas le plafond, il teste que
**ce que `quotaLimit` n'a pas à distinguer, quelqu'un d'autre le refuse**. Sabotage vérifié :
retirer la garde amont → 4 rouges.

**`lang` n'a pas besoin d'un `Record`** : la convention `i(fr,en,es,it)` existe et tient à
95 %. Les traînards se rattrapent en passant. ⚠️ Mesuré au passage — `Header.tsx` rendait
`Plan X` pour fr **et** es faute de branche espagnole ; c'était juste *par coïncidence*, les
deux langues employant le même mot. Une branche correcte pour la mauvaise raison reste à
écrire, sans quoi la première reformulation française emporte l'espagnol.

### Marché par défaut ⚠️ — SOURCE UNIQUE `defaultMarket.ts`

**DÉCISION PRODUIT du 2026-08-06 : Cameroun / XAF / +237.** Motif MESURÉ — les seuls
prestataires câblés ET appelables sont camerounais (Campay est en politique `cm-only`,
MTN MoMo est camerounais) ; **Wave est sénégalais et n'a aucune clé**, Orange non plus.
Un commerçant qui s'inscrivait avec les valeurs par défaut obtenait SN + XOF, puis se
voyait proposer le seul chemin de paiement qui ne fonctionne pas.

Fixture `docs/shared-fixtures/default-market.json` + **TROIS jumeaux**
(`apps/{frontend,backend}/src/lib/defaultMarket.ts`, `mobile/src/lib/defaultMarket.ts`),
lus à l'exécution — contexte Docker oblige.

⚠️ **XOF → XAF n'a AUCUN effet sur les montants**, vérifié dans le code et non supposé :
`TO_XOF_RATES` XOF:1 / XAF:1 · `CURRENCY_DECIMALS` 0 / 0 · symbole « FCFA » des deux
côtés. `lib/plans.ts` ne dépend pas du code de devise (`XOF` n'y nomme que l'unité de
base). Aucun recalcul, aucun prix ne bouge.

⚠️ **L'INDICATIF N'EST PAS UNE CONSTANTE — il se DÉRIVE de `tenant.country`.** Corriger
`useState('+221')` en `useState('+237')` aurait créé une SEPTIÈME valeur par défaut au lieu
d'en supprimer six. `dialCodeFor(country)` (+ `useTenantDialCode`) rend le préfixe du pays
DÉCLARÉ ; `DEFAULT_MARKET.dialCode` n'est que le repli. Une boutique de Dakar ne doit pas
plus recevoir +237 qu'une boutique de Douala ne devait recevoir +221. ⚠️ **Ce n'est pas une
inférence de pays** : on part d'un pays connu pour proposer un préfixe, on ne devine pas le
pays d'un numéro — et `resolveRecipient` reste seul juge côté serveur. On corrige la CAUSE
(un préfixe faux proposé au caissier), pas le symptôme : **ne pas retirer la garde serveur**.

⚠️ **`dialCodeFor` prend `unknown`, pas `string | null`.** Le pays vient d'un JSON d'API et
d'un store persisté : le typer `string` est une AFFIRMATION, pas une garantie — un objet y
est arrivé et a fait lever `.toUpperCase()`. Même raisonnement que `resolvePlanId(raw: unknown)`.

**Ce que le verrou distingue** (`defaultMarket.test.ts`) : un DÉFAUT (ce qu'on obtient quand
personne n'a choisi) d'un MEMBRE DE LISTE (`countryList.ts` contient légitimement `'SN'`) et
d'un REPLI D'AFFICHAGE (`tenant.currency ?? 'XOF'` rend une devise absente, il ne décide
d'aucun marché — **décision explicite : on les laisse**, ils sont exemptés par raison nommée
sur une fenêtre de ±3 lignes, pas par fichier). Il vise la FORME (`??` · `||` · `useState` ·
champ de formulaire · const `DEFAULT_*`), jamais l'identifiant. Sabotages COPIÉS depuis
`fixtures/default-market-avant.txt`, extrait par `git show`.

⚠️ **Un verrou justifié par la MESURE, pas par principe** — et c'est l'inverse de l'arité des
ternaires : là-bas 1 211 chaînes sur 1 268 étaient correctes et un scanner aurait crié au
loup ; ici la quasi-totalité des occurrences était à corriger.

⚠️ **SIX listes de pays, pas cinq.** La sixième (`Onboarding.tsx`) est un **tableau de
tableaux** (`[['SN','Sénégal','🇸🇳'], …]`) que la détection par forme, qui cherche `{ iso: … }`,
n'a PAS vue. Trouvée à l'inventaire de l'imaginaire, pas par le scanner. Limite assumée n°3 :
les listes sont exemptées au FICHIER, un vrai défaut ajouté dedans passerait.

⚠️ **Deux tests figeaient le défaut d'hier** et ont rougi alors que rien n'était cassé :
`signup.anchor` exigeait « Sénégal » en dur, il lit désormais `DEFAULT_MARKET`. Un test qui
nomme le défaut au lieu de le dériver devient un frein au changement qu'il devrait garder.

⚠️ **Piège d'insertion d'import, rencontré DEUX fois dans ce chantier** : ajouter un `import`
après « la dernière ligne qui commence par `import` » le place **à l'intérieur** d'un bloc
`import {` multi-ligne → TS1003 en cascade. Ancrer sur la fin du bloc (`} from '…'`), ou
balayer après coup : `if (/^import\s/.test(l) && /^import (type )?\{\s*$/.test(lignePrécédente))`.

**Preuve de non-régression** : le basculement ne touche AUCUN tenant existant. Empreinte des
4 tenants de prod (SN 2 · CI 1 · FR 1 ; EUR 3 · XOF 1) **`0c9bd7a5d9a9d93a4fb1b8cd`**,
identique avant et après le parcours réel sur tenant jetable (`verif-market-tmp`, détruit,
orphelins 0).

### ⚠️ TVA — le taux se DÉRIVE du pays, il n'a pas de valeur par défaut

**MESURÉ le 2026-08-06 : il n'existait AUCUN mapping pays → TVA.** Le taux venait d'un
`vatRate Float @default(18)` du schéma Prisma — le taux **UEMOA** — et **aucun** des trois
chemins de création de tenant n'écrivait le champ : `POST /api/auth/register`,
`POST /api/tenant`, `POST /api/admin/tenants`. Depuis que le marché par défaut est le
Cameroun, **toute inscription camerounaise recevait 18 % au lieu de 19,25 %**, silencieusement,
sur des factures. Deux `?? 18` de plus vivaient dans `reports.ts` — dans un **rapport de TVA** —
et un dans `SectionPOS`.

Source unique : `docs/shared-fixtures/vat-rates.json` + **deux jumeaux**
(`apps/{frontend,backend}/src/lib/vatRate.ts`). ⚠️ **Pas de jumeau mobile** : `mobile/` ne crée
aucun tenant et ne porte aucun repli — un troisième serait du code mort.

⚠️ **CEMAC n'est PAS homogène**, contrairement à l'UEMOA. C'est tout le piège : traiter « zone
franc » comme un bloc est exactement l'erreur qu'encodait le `@default(18)`.

| | Taux |
|---|---|
| UEMOA (SN CI ML BF NE TG BJ GW) | **18** — directive d'harmonisation |
| **CM** | **19,25** = 17,5 % + 10 % de centimes additionnels communaux |
| GA | 18 |
| CG | **18,9** = 18 % + 5 % de surtaxe |
| FR | 20 — présent parce qu'un tenant de production est en FR |

⚠️ **Un pays non documenté rend `null`, et l'écriture vaut `0` — JAMAIS 18.** Sous-facturer
**bruyamment** vaut mieux que facturer faux en silence : un 0 se voit au POS dès le premier
encaissement, un 18 erroné part sur des factures sans que personne ne le remarque. Même
raisonnement que `ratingSummary` (→ `null`) et `resolvePosPayMode` (→ pas de prestataire deviné).

⚠️ **Table volontairement INCOMPLÈTE — 11 pays sur les 29 de `SUPPORTED_COUNTRIES`.** On
n'inscrit que les taux SOURCÉS. La compléter au jugé reviendrait à écrire du droit fiscal de
mémoire ; **ajouter un pays impose d'en citer la source dans la fixture.**

⚠️ **Ce module ne dit pas le droit, il propose une VALEUR DE DÉPART** — le taux reste éditable
(Réglages → POS). Et **le taux standard n'est pas le taux de chaque produit** : au Cameroun les
produits alimentaires de base sont **exonérés**, donc une supérette n'applique pas 19,25 % sur
l'essentiel de son catalogue. Le produit ne modélise pas la TVA par ligne (un seul
`tenant.vatRate`) : limite **assumée et écrite**, pas masquée par un chiffre d'apparence précise.

⚠️ **Le `@default(18)` du schéma RESTE en place, et c'est délibéré** : le changer imposerait une
migration DDL sur la PROD pour un défaut qui ne doit plus jamais se déclencher. On le rend
**inatteignable** en exigeant que chaque `tenant.create` pose la valeur — vérifiable par un test,
sans toucher la base. *Un `@default` qui ne se déclenche jamais ne peut plus mentir.*

Verrous : `vatRateShared.test.ts` **des deux côtés** (back 10 / front 7, **5 sabotages**, dont
les deux sens du jumelage) — le back porte en plus les deux règles structurelles « aucun
`tenant.create` sans `vatRate` » et « plus aucun `?? 18` dans les routes », à périmètre DÉRIVÉ.

✅ **Aucun tenant existant n'est touché** (décision : option 1 — les démos restent telles
quelles, cf. § Comptes démo). Empreinte pays/TVA après chantier : **`ebb3d856df1c7bb45cc1fe4b`**
— 4 tenants, tous à 18 %. ⚠️ Dont le tenant **FR à 18 %** alors que la France est à 20 % :
valeur héritée de l'ancien défaut, sur un tenant existant, **non mutée**. Un nouveau tenant FR
recevrait désormais 20.
**DÉCLENCHEUR DE RÉOUVERTURE : un SECOND tenant FR, ou une facture réellement émise depuis
celui-ci.** Aujourd'hui le taux ne sert à rien — le tenant n'émet pas de facture — et le muter
serait une écriture sur un tenant existant pour corriger un chiffre que personne ne lit. Au
premier des deux événements, il devient un taux appliqué : soit deux tenants FR affichent deux
TVA différentes, soit une facture part à 18 % en France. ⚠️ Ne pas confondre avec les démos
ouest-africaines, laissées à 18 % **délibérément** et à raison (SN/CI sont bien à 18 %).

### Le COMMENTAIRE QUI INVENTE UN REPLI ⚠️ — règle exécutoire

**Un commentaire qui affirme qu'une alternative existe DOIT citer le `fichier:ligne` de
cette alternative, ou être supprimé.** TROIS occurrences dans la même session, chacune
justifiant une décision par un chemin qui n'existait pas :

| Commentaire | Réalité mesurée |
|---|---|
| `LandingNav` : « le login reste accessible via le CTA / le hero » | **ZÉRO `<a href="/login">`** dans la page à 390, 360 et 320 px — ni nav, ni hero, ni pied. Le CTA dit « Créer ma boutique ». Un client existant sur téléphone ne pouvait pas se connecter |
| `CLAUDE.md:16` : « le parc store est en runtime 1.2.0 » | aucun parc — 1 seul `PushToken`, sur le tenant de démo |
| `quotaLimit` : rien n'indiquait que sa justesse tenait à l'ordre des gardes | invariant distant non enregistré (→ `spendGuardStatusOrder.test.ts`) |

Le motif est constant : **l'affirmation est plausible, jamais exécutée, et personne ne la
vérifie parce qu'elle sert de justification à autre chose.** Un `fichier:ligne` la rend
réfutable en dix secondes ; sans lui, elle survit des mois.

⚠️ **Vérifier dans le DOM RENDU, pas dans la source**, dès qu'il s'agit de CSS conditionnel :
la source dit ce qui est écrit, pas ce qui est affiché. Le masquage `.lp-nav-login` était
lisible dans le fichier ; qu'il ne reste AUCUN chemin vers `/login` ne l'était pas.

### La VÉRITÉ VACANTE ⚠️ — « toutes » sur l'ensemble vide

**Un quantificateur universel est VRAI et VIDE de sens sur une liste vide.** `.every()`
rend `true`, `.some()` rend `false` : les deux mentent quand la liste est vide.

MESURÉ sur la console Ops le 2026-08-06 : une coche verte annonçait « **Toutes vos
boutiques ont démarré** » sous « **0 inscrites** ». L'écran félicitait pour un succès que
personne n'avait obtenu — et c'était le même écran qui venait d'être corrigé pour ne plus
compter les fixtures : **exclure les fausses données a révélé une phrase qui n'était vraie
que grâce à elles**.

**Règle : TROIS états, jamais deux.**

| liste vide | non vide, incomplet | non vide, complet |
|---|---|---|
| **NEUTRE** — on constate, on ne félicite pas | alerte | succès |

L'état vide n'a ni coche, ni couleur de succès, ni bordure verte, et il DIT pourquoi il est
vide (« Rien à mesurer tant qu'aucune inscription réelle n'a eu lieu »).

⚠️ **C'est une FAMILLE, pas une ligne.** Balayer « toutes », « chacune », « aucune » sur
toute liste qui peut être vide — la liste « à traiter » avait le même défaut : « aucun essai
n'expire dans les 3 jours · aucune boutique inactive · aucun paiement à vérifier » se lit
comme un tableau de bord sain, alors qu'il n'y avait simplement personne.

⚠️ **Deux messages différents ne partagent jamais la même phrase.** Trois panneaux disaient
« Aucune boutique cliente » : on ne savait plus lequel parlait, et un test de rendu ne
pouvait plus les distinguer (`Found multiple elements`). Trois états ⇒ trois formulations.

⚠️ **Le SIGNAL prime sur la PHRASE.** La légende disait que les pastilles d'infrastructure
ne peuvent pas rougir ; le point vert disait le contraire — l'œil croit la couleur. Elles
sont désormais **grises** tant qu'aucune sonde ne les alimente ; le vert est réservé à ce
qui a été vérifié (la sonde `/api/health-extended`, datée). ⚠️ Le premier correctif a
changé la couleur du point mais laissé `boxShadow: '0 0 6px var(--acc2)'` : **le signal
s'était déplacé dans l'ombre**. Vérifier la propriété visuelle, pas seulement celle qu'on
avait en tête.

⚠️ **Aucun chiffre d'argent affiché sans qu'on sache s'il entre dans le MRR.** Le tiroir
d'une boutique de démonstration annonçait « Valeur/mois : 25 000 FCFA » — un montant jamais
encaissé, dans aucun agrégat. Neutralisé (`—`) : un tiret se lit, un faux montant se retient.

⚠️ **Deux nombres muets qui se contredisent, jamais.** L'onglet affichait « 0 » pendant que
la liste montrait trois cartes. Il porte les deux (« 0 · 3 ») avec le détail en infobulle,
et les fixtures sont **badgées SUR LA CARTE** — le rapport précédent affirmait qu'elles
l'étaient, alors que seul un champ `isFixture` non rendu existait. **Une intention n'est pas
un écran** : vérifier sur le rendu.

Verrou : `adminConsoleTruth.test.tsx` (7) — monte le VRAI `AdminDashboard` et exerce les
trois états, le double compteur, le badge de carte et l'exclusion des fixtures de la file.

### Le CHAMP DÉCLARÉ QUI SE FAIT PASSER POUR UNE MESURE ⚠️

**Un signal qui ne peut pas être faux ne prouve rien**, et il coûte plus cher qu'un signal
absent : on s'y fie. MESURÉ le 2026-08-06 sur les écrans applicatifs — trois formes, et la
troisième n'est visible depuis aucune des deux autres.

| Forme | Exemple mesuré | Ce qui trahit |
|---|---|---|
| **littéral dans un catalogue** | `INTEGRATIONS_LIST` portait `status:'connected'` ×11/12, plus `uptime:'99.9%'`, `calls:1847`, `lastCall:'Il y a 2 min'` | le NOM affirme une observation, la valeur est du texte dans un fichier |
| **colonne déclarée, JAMAIS écrite** | `lastLoginAt` (`schema.prisma:158`) — **0/8 comptes** en prod | rien n'est faux dans le code : c'est une **absence**, elle n'a pas de forme |
| **clé étrangère dans un compteur** | `okCount`/`allChecked` calculés sur `Object.keys(pingStatus)` | l'arithmétique naît à l'exécution, la source est valide |

- **Le NOM est la moitié du correctif.** `status` → **`declared: 'configured' \| 'absent'`**
  (`pages/Integrations.tsx`). Un champ qui dit sa nature ne se relit pas trois fois sans
  qu'on voie le défaut. L'état RÉEL vient de **`GET /api/integrations/status`**
  (`lib/integrationStatus.ts`, adossé au `providerMode()` **déjà existant** — ne pas en
  écrire un second). `sandbox` n'est **pas** une nuance de `live` : c'est la différence
  entre encaisser et simuler.
- ⚠️ **Tant que la sonde n'a pas répondu, on n'est pas optimiste** : `status` reste
  `disconnected`, la pastille est GRISE, le compteur dit « Vérification… ». Un défaut
  réseau doit rendre l'écran muet, jamais rassurant.
- ⚠️ **Une sonde vit avec sa carte.** `checkSentryBackend()` était appelée depuis la page
  COMMERÇANT dont Sentry avait été retiré : elle écrivait une clé de plus que de cartes
  affichées → **« 3/2 OK »** (numérateur > dénominateur), `allChecked` = `3 === 2` **faux
  pour toujours**, « Joignables » figé sur `…` et la barre sur « Vérification en cours… ».
  Trois symptômes, une ligne. La sonde n'était pas manquante, elle était **au mauvais
  endroit** (déplacée dans `OpsInfrastructure`, où elle rend enfin une pastille capable de
  rougir). **Un compteur se dérive de ce qui est AFFICHÉ**, jamais des clés d'une map.
- ⚠️ **Vérité vacante, encore** : `pingableList` vide ⇒ `allChecked` vrai et `anyError`
  faux ⇒ barre **verte « Tous les services opérationnels » sur ZÉRO sonde**. Et le titre
  disait « tous les services » alors que 3 prestataires sur 5 ne sont pas sondables — un
  quantificateur universel sur un sous-ensemble présenté comme le tout.
- **`lastLoginAt` est ÉCRIT** par `POST /api/auth/login`, **après** les refus (mot de passe,
  compte actif) et en **fail-open tracé** (une colonne d'affichage ne refuse pas une
  authentification). ⚠️ `isOnlineNow` → **`loggedInRecently`** : on mesure une
  AUTHENTIFICATION, pas une présence — « En ligne » promettait ce qu'aucune donnée ne
  porte. L'absence de trace se dit **« Aucune trace »**, jamais « Jamais » : un trou de
  mesure n'est pas un fait sur la personne.

**Verrous** : `measuredNotDeclared.test.ts` (front, 5 — périmètre DÉRIVÉ de l'arborescence,
assertion de couverture ≥ 200 fichiers, sabotage COPIÉ par `git show`, **3 sabotages
vérifiés**) · `lastLoginWritten.test.ts` (back, 6, sabotage vérifié) ·
`integrationsRendered.test.tsx` (front, 8, **DOM rendu**, 3 sabotages).

⚠️ **Le premier critère du scanner était FAUX, et le calibrage l'a dit** : « une clé dont
toutes les entrées portent la même valeur » ne trouvait pas `status` — il valait
`'connected'` onze fois et `'disconnected'` une fois (PayDunya). *Un critère qui laisse
passer le cas qui l'a motivé est faux, pas prudent.* La règle retenue vise le
**VOCABULAIRE** (`status`, `uptime`, `calls`, `latency`, `online`…) dans un catalogue de
≥ 3 entrées : **64 correspondances avant, 2 fichiers, zéro faux positif ailleurs**.
⚠️ Et la **première version du scanner rendait 2 correspondances sur 254 fichiers** en
paraissant propre : sa regex de tableau s'arrêtait au premier `]` d'un sous-tableau
`features:[…]`. **Analyse par appariement de délimiteurs, jamais par regex sur la
structure.**

⚠️ **Deux tests VERTS pour la mauvaise raison, attrapés par le sabotage** — et c'est le
rappel le plus utile de ce chantier : (a) `integrationsRendered` faisait échouer `fetch`
(jsdom n'a pas de réseau), donc `anyError` court-circuitait la branche testée et les
**8 cas restaient verts sous sabotage** ; (b) le mock `bcrypt.compare` comparait le HASH et
ignorait le mot de passe en clair, donc le cas « mot de passe faux » **ne produisait jamais
d'échec**. Un test qui ne peut pas atteindre le chemin fautif ne garde rien.

### ⚠️ TAILWIND N'ÉMET RIEN — toute classe `sm:`/`lg:` du source est MORTE

📖 *POURQUOI intégral (mesure du 2026-08-06, 5 angles morts du scanner, sabotage passé vert,
suppression des 18 modules shadcn) : `docs/lessons/tailwind-classes-livrees.md`* — **à lire
AVANT** de toucher `index.css`, `tailwind.config.js`, `scripts/classAudit.mjs` ou
`classesLivrees.test.ts`.

`tailwind.config.js` et `postcss.config.js` existent, mais `index.css` ne porte **aucune
directive `@tailwind`** (retirée pour la chaîne critique) : **tailwind ne génère RIEN.** Une
classe `lg:grid-cols-4` écrite dans un `className` est donc soit **inerte**, soit **figée** à
sa valeur de base — la source est juste, l'artefact vide (même famille que l'ordre des règles
du service worker, § « LA SOURCE EST VALIDE, L'ARTEFACT EST NUL »).

⚠️ **Toute nouvelle variante responsive s'écrit À LA MAIN dans `index.css`**, là où vivent
déjà `.grid`, `.gap-4`, `.flex`, avec de vraies media queries aux points de rupture tailwind
(640 / 1024). L'écrire dans un `className` ne suffit pas, et **rien ne le signale**.
⚠️ **NE PAS « réparer » en ajoutant `@tailwind base`** : le reset écraserait toute la feuille
écrite à la main.

⚠️ **« Absent de la feuille » ≠ « style manquant » — QUATRE cas, et écrire du CSS n'est le bon
geste que dans le dernier** (l'audit initial les confondait) :

| Cas | Signe | Geste |
|---|---|---|
| **poignée morte** | un `style={{…}}` complet à côté | **retirer la classe** |
| **mauvais nom** | la règle existe sous un autre nom | **corriger l'APPEL** (`badge-ok`→`badge-green`) — définir un synonyme serait pire |
| **poignée E2E** | le jeton est cité dans `e2e/` | **ne rien faire** — sélecteur Playwright. Exemption **DÉRIVÉE** des specs, jamais listée |
| **réellement manquant** | rien ne le porte | **l'écrire** dans `index.css` |

**Verrous** : `npm run verify:classes --workspace=apps/frontend` (CI, **après le build** —
il inspecte le `dist/` livré, JS compris : les blocs `<style>{…}</style>` partent dans le
bundle) + `classesLivrees.test.ts` (16, 4 sabotages) pour la LOGIQUE. Le verrou d'artefact ne
peut pas vivre dans la suite — **la CI lance `vitest` AVANT `build`**.
⚠️ Règle générale tirée d'ici : *un sabotage qui régénère un artefact doit asserter que la
régénération a eu lieu* — sinon `tsc` échoue, le build s'arrête, et le verrou juge un `dist/`
périmé en se déclarant vert.
⚠️ **Ne pas réintroduire les 18 modules shadcn supprimés** (`alert-dialog` … `textarea`,
tree-shakés donc **zéro octet** de gain, mais ils faisaient croire à un système de design
branché). L'infobulle réelle du produit est `components/ui/FocusTooltip.tsx`.

### Le LIBELLÉ QUI TRONQUE ⚠️ — corriger la CONTRAINTE, pas la chaîne

**DEUX occurrences dans la même session** (« Marketing WhatsApp », puis « Paiements &
cana… »), toutes deux « corrigées » en raccourcissant l'étiquette. Deux fois, ce n'est plus
deux accidents : c'est une contrainte trop étroite que personne n'avait mesurée.

**LA CAUSE** : l'état actif ne change **ni le padding ni la largeur** — il change la
**GRAISSE** (`--fw-regular` 500 → `--fw-bold` 800). Le même texte est donc plus large une
fois sélectionné, dans un conteneur identique. D'où une troncature qui n'apparaît **que sur
l'élément actif**, et qu'on ne voit jamais en relisant le code.

```
largeur utile d'un libellé = --sidebar − marge 16 − padding 20 − icône 30 − gap 8
  avant  220 − 74 = 146 px   → 21 caractères impossibles à toute graisse utilisable
  après  264 − 74 = 190 px   → budget 22 caractères, un de plus que le plus long
plus longs libellés : « Pannello di controllo » (it) et « Registro de actividad » (es), 21
```

⚠️ **L'espagnol et l'italien rallongent** — un libellé qui tient en français ne prouve rien.
`--sidebar` **264px** + `.nav-label` en `--fs-sm` (13 px) : à 14 px la marge restait de
l'ordre du pixel, et une marge de cet ordre se referme à la traduction suivante.

**Verrou** : `navLabelWidth.test.ts` (4) — géométrie **LUE** dans `index.css` (jamais
recopiée, sinon elle se périme en silence), libellés **DÉRIVÉS** de `Sidebar.tsx`, budget
vérifié dans les **4 langues**, et une règle qui échoue si `.nav-item.active` acquiert un
`padding`/`width`/`border-width` — la cause exacte, figée. **2 sabotages vérifiés** (retour
à 220 → nomme « Paiements & canaux » ; padding ajouté à l'actif → rouge).
⚠️ **C'est un BUDGET DE CARACTÈRES, pas une mesure en pixels** : jsdom n'a ni police ni
moteur de rendu. L'hypothèse (`0,64 em/caractère` en graisse 800, volontairement haute) est
écrite dans le fichier ; **si une capture montre encore une troncature, c'est CE nombre
qu'il faut relever — pas le libellé qu'il faut raccourcir.**

### DENSITÉ ⚠️ — un écran vide n'est un défaut que s'il devait porter de l'information

**La distinction, et elle a été prise à l'envers une fois** : `select-shop` avait été rangé
dans les défauts de densité (« deux lignes dans un écran vide »). **À tort.** Un sélecteur à
deux entrées est CENSÉ être calme et centré : ce n'est pas un écran de données, c'est un
**choix**. Le vide y est du repos, pas du gaspillage — **ne pas le « corriger »**.

| L'écran doit… | Le vide est… |
|---|---|
| porter des **données à comparer** (console Ops, rapports, planning) | un **défaut** — de la place qu'on n'a pas donnée à l'information |
| porter une **décision** (select-shop, confirmation, onboarding) | du **repos** — il isole le choix, il ne le dilue pas |

- **Table dense de la console Ops** (`AdminDashboard`, onglet Boutiques) : une ligne par
  boutique, colonnes fixes (908 px) + colonne Boutique élastique (min 240 px), lignes 40 px,
  en-tête **sticky** 38 px, `tabular-nums` sur toute colonne chiffrée, `.table-wrap` /
  `.data-table` / `.td-num` **existants** — pas une seconde table.
  ⚠️ **Le MRR est une COLONNE** : il ne vivait que dans le tiroir, alors que c'est le chiffre
  pour lequel cette console existe. Au TRI, le MRR d'une fixture vaut **0** — sinon les
  démos remontent en tête d'un classement de revenus qu'elles n'alimentent pas.
  ⚠️ **Une seule cellule colorée**, l'activité, et **seulement quand elle appelle une action**
  (cliente sans vente depuis 14 j). Une fixture inactive n'appelle rien : la couleur signale,
  elle ne décore pas.
  ⚠️ **Le tri est un `<button>` dans le `<th>`**, avec `aria-sort` — un en-tête cliquable qui
  n'est pas un bouton est inatteignable au clavier et muet pour un lecteur d'écran.
- ⚠️ **HONNÊTETÉ SUR LE GAIN, mesurée** : à 2560 la galerie de cartes était large et courte
  (≈ 7 par rangée, **≈ 1 620 px** pour 50 boutiques) ; la table en fait **≈ 2 040 px** — elle
  est donc **PLUS HAUTE à 2560**. Le gain vertical est à 1440 (≈ 2 626 → ≈ 2 040 px, **−22 %**) ;
  le gain réel est la comparabilité et le MRR. Ne pas revendiquer une compacité que la mesure
  ne donne pas.
- **`marginLeft:auto` dans un bandeau large** = la note part au bord droit. Mesuré : **~1 400 px**
  entre le MRR et la note qui le commente. Bandeau borné à `maxWidth: 1180`.
- **Un tiroir en `height: 100vh` sur un contenu court** produit un vide **structurel**, pas
  accidentel (~700 px). `height: auto` + `maxHeight: calc(100vh - 32px)`. ⚠️ On le raccourcit ;
  on ne le **remplit pas** de mesures inventées pour justifier sa taille.
- **Même grille d'un onglet à l'autre** : `ReportsLiveKpis` RH était en `lg:grid-cols-2` quand
  Stock/Clients tenaient en 3-4 → la taille des cartes sautait au changement d'onglet. Passé en
  `lg:grid-cols-4` ; **deux cellules restent vides, c'est le bon résultat** — on n'invente pas
  deux indicateurs pour remplir.
- **Planning** : la légende du pied répétait la barre « ASSIGNER : » à l'identique — mêmes six
  entrées, mêmes couleurs, **mêmes horaires** (`ShiftSelector.tsx:52-56` les affiche déjà).
  Retirée ; seule l'astuce de clic, absente du haut, reste.

⚠️ **VÉRIFIER À L'ÉCHELLE, PAS SUR LE JEU DE DÉMONSTRATION.** La galerie « marchait » — à 3
boutiques. Un test à 4 lignes reproduit exactement la situation qui a laissé passer le défaut.
Verrou : **`adminTableDense.test.tsx`** (10) monte le VRAI `AdminDashboard` sur **50 clientes
+ 3 fixtures**, avec une **assertion de couverture** (`lignes === 53`) pour qu'un `slice`
silencieux ne rende pas les autres cas verts sur un sous-ensemble, et une vérification que
chaque ligne a autant de cellules que la table a de colonnes (une ligne courte décale tout ce
qui est à sa droite — invisible à 4 lignes). **3 sabotages vérifiés** : troncature muette ·
MRR de fixture rendu comme un montant · couleur d'alerte étendue aux fixtures.
⚠️ Les noms du jeu de test sont **générés** (« Boutique 01 »…), jamais empruntés à une maquette
ni à la production (§ Neutraliser les exemples).

⚠️ **CE VERROU PROUVE LA STRUCTURE, PAS LA GÉOMÉTRIE — jsdom ne fait AUCUNE mise en page.**
Ni largeur, ni retour à la ligne, ni débordement. La table dense n'avait donc **jamais été
vue** : on affirmait qu'elle tient à 390 px sans l'avoir mesuré. D'où
**`npm run e2e:density --workspace=apps/frontend`** — Playwright, vrai moteur de rendu, sur
un harnais `/__dev/table` qui n'existe qu'en développement.

⚠️ **La garde P0 protège la ROUTE `/admin`, pas le COMPOSANT — et elle reste INTACTE.** Ne pas
chercher à authentifier Playwright sur `/admin` : le compte E2E est SUPER_ADMIN *de boutique*,
l'échec d'accès est le BON comportement. Le harnais rend le même composant ailleurs.
⚠️ **Son absence du bundle livré est VÉRIFIÉE, pas affirmée** : `verify:demo-flag` cherche
aussi le marqueur `__habashop_dev_table_harness__` (0 occurrence sur les 87 fichiers de
`dist/`). Le `import()` doit rester DANS la branche `import.meta.env.DEV ? … : null` — même
motif que `demo1234`, et **l'artefact décide**, pas le ternaire.

**MESURÉ — et la table était innocente :**

| Largeur | `.table-wrap` | Page (avant) | Page (après) |
|---|---|---|---|
| 2560 | 2512/2512 — tient | 2560 | 2560 |
| 1440 | 1392/1392 — tient | 1440 | 1440 |
| **390** | 1223/**342** — **défile, par dessin** | **421 ❌** | **390 ✅** |

À 390 px la table défile proprement dans son conteneur ; c'est la **rangée d'actions de
l'en-tête** qui atteignait `right = 431 px` et faisait défiler **la page entière**.
Un `flexWrap: 'wrap'` a suffi. **La mesure a disculpé la table et trouvé un autre défaut** —
c'est exactement ce qu'on ne peut pas obtenir en affirmant.

⚠️ **TROIS détecteurs d'enroulement avant le bon, et les deux premiers criaient au loup** :
(1) hauteur du `<td>` (41 px, padding compris) vs `line-height` (~19 px) → vrai partout ;
(2) hauteur de contenu ÷ `line-height` → un `<td>` s'étire à la hauteur de SA RANGÉE, donc
quand le nom de boutique voisin passe à deux lignes (colonne élastique, comportement VOULU)
toutes les cellules mesurent deux lignes sans qu'aucune ne se soit enroulée. Le bon détecteur
mesure le **TEXTE** : `Range.getClientRects()` rend un rectangle **par ligne rendue**.
2 sabotages vérifiés (`nowrap` retiré d'une cellule monétaire → 1 rouge · `overflow-x` retiré
du conteneur → 3 rouges).

### RÉPARTITION PAIEMENTS ⚠️ — QUATRE dénominateurs sur un seul camembert

**MESURÉ le 2026-08-07.** L'écran Rapports → Ventes portait, pour le même dessin et les
mêmes ventes, quatre populations différentes. Aucune n'était visible à la relecture : chacune
était correcte *localement*.

| Surface | Dénominateur | Sur `demo-tenant-001` |
|---|---|---|
| légende / infobulle | toutes les ventes chargées | Σ = **96 %** |
| donut (`percent` de recharts) | Σ des parts **rendues** | Σ = **101 %**, `cash` à 38 % vs 36 % |
| PDF imprimé, pied de tableau | **littéral `'100 %'`** | et un total en argent **court de 11 535 XOF** |
| KPI « Transactions » (juste au-dessus) | ventes de la **période** | **8** — contre « 50 transactions » sous le camembert |

⚠️ **La quatrième est la pire, et elle n'était pas dans la commande** : le sélecteur de
période n'agissait pas sur ce panneau. Sur `demo-tenant-002`, la carte annonçait **0
transaction** pendant que le camembert en répartissait **50** avec assurance.

**Cause unique : une liste de modes RÉÉNUMÉRÉE en dur** (`cash · mobile · wave · orange ·
card`), fausse dans les deux sens — `mobile` rendu alors que le serveur ne l'écrit **jamais**
(0 sur 1 908 ventes), `mtn` et `mixed` écrits et **avalés**. Les 2 ventes avalées sur 50 sont
tout l'écart 96/101 : tant que rien ne manque, les deux dénominateurs coïncident, et le
défaut dort.

**Ce qui est en place** — `components/reports/paymentBreakdown.ts` :
- **UNE série d'entiers**, et c'est elle que recharts reçoit en `dataKey`. L'angle vaut alors
  `pct/100` : géométrie et libellé sont le même nombre **par construction**, pas par chance.
  ⚠️ Ne PAS revenir à un compte brut en `dataKey` — cela recrée le second dénominateur.
- **Arrondi DISTRIBUÉ** (plus forts restes) : Σ == 100 exactement, aucune part à plus d'un
  point de sa valeur exacte. Un camembert dont les parts ne somment pas n'a pas besoin d'être
  faux pour paraître faux.
- **Catégories DÉRIVÉES des données** : un mode inconnu apparaît **seul**, sous son nom
  (`Paypal`), jamais fondu. Le filtre porte sur le **COMPTE**, jamais sur le pourcentage —
  `filter(value > 0)` ré-avalait une part réelle mais minuscule (1/500 → 0 %), soit le même
  défaut sous une autre forme. Une part sous 0,5 % est annoncée **« < 1 % »**.
- ⚠️ **`?? 'cash'` SUPPRIMÉ.** Un mode absent est sa propre catégorie (« Non renseigné »).
  C'est la famille `rating ?? 0`, sur de l'argent. **Honnêteté : la colonne est
  `String @default("cash")` NOT NULL et la production porte ZÉRO ligne sans mode** — on
  retire un piège, on ne colmate pas une fuite qui aurait coulé.
- **Le repli fabriqué `62/22/16/8/5` (Σ = 113 %) était MORT** — `Reports.tsx` rendait déjà un
  état vide 140 lignes plus haut. Justesse **empruntée** : il aurait resurgi au premier
  déplacement de la garde. Le sous-titre « Données de démonstration » était le second vestige
  de la même croyance. Le cas vide est désormais **atteignable** (période sans vente) et il
  se **DIT** — pas d'anneau à zéro part, qui se lit comme un graphique cassé.

**Verrou** : `paymentBreakdown.test.tsx` (18) — cas déclencheur rejoué depuis
`fixtures/reports-paymentData.avant.txt` (extrait par `git show`), **DOM rendu** dans les
trois cas, périmètre DÉRIVÉ de l'arborescence + assertion de couverture (> 150 fichiers).
Jumeau mobile : `salePaymentModesShared.test.ts` (4). **5 sabotages vérifiés.**

⚠️ **Le sabotage S4 est passé VERT au premier tir, et la leçon est neuve.** La règle « aucune
ligne de TOTAL n'affirme son propre pourcentage » scrutait **la ligne**. Or ma propre
correction venait d'éclater la ligne du total sur six lignes : la règle était devenue aveugle
à la forme **que le code venait de prendre**. *Un verrou qui ne détecte pas son défaut dans la
forme ACTUELLE du code ne garde rien* — c'est distinct de l'angle « forme » (chercher ce qui
ne peut pas exister) : ici la forme cherchée existait hier et plus aujourd'hui. Réécrit par
**appariement de crochets**, jamais par regex sur la structure.

⚠️ **CALIBRAGE de cette même règle — deux formulations rejetées avant la bonne.**
`/['"]100\s*%['"]/` rendait **87 fichiers** (tout `width: '100%'`). `/['"]\d+ %['"]/` rendait
5 sites dont **4 légitimes** : les colonnes « taux » d'un bulletin de paie (`'100 %'` pour le
salaire de base, `'25 %'` pour les heures sup) sont des constantes de **barème**, pas des
totaux. Retenu : pourcentage en dur **dans la même ligne de tableau** qu'un marqueur de total
— 1 avant, 0 après, et les 4 colonnes de paie ne sont pas touchées.

⚠️ `expect` de **jest ne prend PAS de message** (c'est un vitest-isme) : passé quand même, il
lève « Expect takes at most one argument ». Le contexte d'un échec mobile passe par la forme
comparée, pas par un second argument.

⚠️ Un commentaire JSX `{/* … */}` **ne peut pas vivre dans une liste d'attributs** (TS1005,
commis deux fois dans ce chantier) : l'ancrer au-dessus de l'élément.

### LE TOTAL CALCULÉ SUR CE QUI EST AFFICHÉ ⚠️ — la famille, pas la ligne

**TROIS instances en deux jours**, toutes de la même forme : *un total calculé sur ce qui est
AFFICHÉ plutôt que sur ce qui EXISTE.*

| Surface | Ce qui manquait au dénominateur |
|---|---|
| Répartition paiements (légende vs donut) | 2 ventes sur 50 → Σ = **96 %** / **101 %** |
| Tableau PDF des paiements | **11 535 XOF** absents d'un total imprimé, sous un « 100 % » littéral |
| Camembert « CA par catégorie » | la 7ᵉ catégorie et au-delà — **77 000 XOF** en mars sur `demo-002` |

⚠️ **`demo-tenant-001` a EXACTEMENT 6 catégories** — au catalogue comme dans ses ventes. Le
serveur tronquait à 6. La boutique de démonstration de référence était donc **pile sur la
valeur limite**, `perdu = 0` toujours : c'est ce qui explique que personne n'ait jamais vu le
défaut. `demo-tenant-002` en a **sept**, et il y était bien réel — **trois mois consécutifs**
(2026-03 77 000 · 04 27 500 · 05 65 600 XOF), en silence.
**Une démonstration calée sur la valeur limite ne démontre rien : elle masque.**

**Ce qui est en place** — `apps/backend/src/lib/categoryBreakdown.ts` :
- Le serveur rend les plus grosses catégories **PLUS un reliquat explicite**
  (`{ name:'Autres', value, count, other:true }`). Le client **ne peut pas** le calculer : il
  ne reçoit que ce qu'on lui envoie. Tronquer côté serveur et totaliser côté client, c'est
  garantir la divergence.
- ⚠️ **Le reliquat se reconnaît à un DRAPEAU, jamais à son nom** : `analytics.ts` range déjà
  les produits sans catégorie sous « Autre », et rien n'interdit qu'une catégorie réelle
  s'appelle « Autres ». Le front réserve une clé de fusion (`' reliquat'`) que `normCat` ne
  peut pas produire. Même leçon que le `?? 'cash'` — on ne distingue pas une chose par un nom
  qu'elle partage.
- **« Autres » porte son EFFECTIF** (« Autres — 4 catégories »). Sans lui, le lecteur ne sait
  pas s'il regarde une catégorie ou quatorze : c'est le « 4,2/5 » sans son dénominateur.
- Le reliquat agrège **au moins DEUX** catégories (`max − 1` nommées dès qu'il y a
  débordement) : à 7 catégories, « les 6 premières + Autres » cacherait UNE catégorie
  nommable derrière un libellé anonyme — strictement moins informatif que de la nommer.
- **À 6 exactement : aucune tranche « Autres » vide.** Un secteur à 0 % se lit comme un
  graphique cassé. **À 0 catégorie : état vide** — atteignable, pas théorique (`demo-001`
  n'a aucune vente ce mois-ci).

**L'INVARIANT VERROUILLÉ EST PLUS FORT QUE « Σ = 100 % »** : `Σ(valeurs rendues) == CA du
mois`. *Un camembert peut sommer à 100 % d'un total faux* — c'est exactement ce qu'il faisait.
Verrou `categoryBreakdown.test.ts` (9), exercé de **0 à 20 catégories** : un test à 3
reproduirait la situation qui a laissé passer le défaut. Sabotage rejoué **sur la forme que le
code venait de prendre** (leçon de S4, § Répartition paiements) → 4 rouges.

⚠️ **`pourcentagesEntiers` est la SOURCE UNIQUE de la répartition en entiers**
(`apps/frontend/src/lib/pourcentages.ts`, déplacé depuis `paymentBreakdown.ts` et réexporté).
Le Dashboard corrigeait le **dernier** secteur à `100 − Σ` : la somme valait 100, mais toute
l'erreur atterrissait sur une seule part — la dernière, donc la plus petite. Mesuré sur la
distribution réelle de `demo-002` (mars, 7 catégories), la dernière part passe de **1 à 2 %**
sur une valeur exacte de 1,83 % : `100 − Σ` se trompait de **45 % en relatif**, et c'est
l'origine du « dernier secteur diverge de ±1 » qu'avait attrapé l'assertion F1 de
`dashboard-donut.spec.ts`. Écart max par part : **0,83 pt → 0,56 pt**. Ne pas en écrire une
troisième — deux écrans, deux arrondis, ils divergent au premier cas limite.

⚠️ **BALAYAGE DE LA CLASSE — la « quatrième occurrence » attendue N'EXISTE PAS.** 681 fichiers
lus sur les trois workspaces (`.slice(0,N)` · `take: N` · `.head(`) : `analytics.ts` était le
**seul** site dont la troncature alimentait un dénominateur. Les autres sont d'une autre
nature et **correctes** — `export.ts` calcule `totalCA` **avant** son `slice(0,30)` d'affichage,
les barres de « Top produits » (web et mobile) sont relatives au **maximum** et non à un total.
*Écrit pour qu'on ne re-balaye pas cette classe en croyant qu'elle est ouverte.*
⚠️ Le premier balayage a rendu **zéro correspondance** : `--include=*.ts` non quoté est mangé
par zsh. Un scan qui ne lit rien rend un résultat propre — **contrôle positif obligatoire**
(ici : `analytics.ts` contient `.slice(0, 6)`, le scan doit le trouver).

**Dette voisine, NON traitée et distincte** : `routes/export.ts:56` plafonne l'export CSV des
ventes à `take: 1000` sans le dire. Aucun total n'en dérive — ce n'est pas cette famille — mais
c'est un plafond silencieux (§ « No silent caps »).

### La MOYENNE SANS SON DÉNOMINATEUR ⚠️ — `perf` / `rating`

`Employee.perf` et `Supplier.rating` étaient `Int NOT NULL DEFAULT 3`. Un employé jamais
évalué valait donc **3**, indiscernable d'un employé réellement noté 3 : une boutique neuve
affichait « Performance moy. **3,0/5** », un chiffre que personne n'avait saisi. Colonnes
**nullables sans défaut** depuis le 2026-08-06 (`20260806170000_perf_rating_nullable`).

⚠️ **L'information perdue ne se récupère pas** — MESURÉ avant migration : aucun signal ne
distingue un 3 saisi d'un 3 par défaut (l'audit RH n'existe pas, `routes/employees.ts`
n'appelle jamais `writeAudit` ; `updatedAt` est pollué par des scripts en masse — 10/10
lignes « modifiées », Δ de 45 s à 49 jours). La décision sur les lignes existantes est donc
un **choix assumé**, pas une déduction. Elle a été rendue sûre par une preuve d'un autre
ordre : les **20 valeurs** de production correspondaient EXACTEMENT à ce que les seeds
écrivent (0 écart), et **aucun tenant client n'existe** — personne n'avait jamais saisi une
note, et personne ne le pouvait.

- **Source unique `lib/ratingSummary.ts`** : `summarizeRatings(valeurs) → { total, rated,
  average }`. `average` est **`null`** quand personne n'est évalué — **jamais `0`**.
  `ratingValue` rend « — » (ni « 0,0/5 », ni « —/5 » : un dénominateur suggère qu'une note
  existe), `ratingCaption` porte l'**effectif évalué**.
- ⚠️ **« 4,2/5 » sur 3 évalués parmi 5 n'est PAS « 4,2/5 »** : sans son effectif, le nombre
  se lit comme portant sur toute l'équipe. Le dénominateur fait partie de la mesure.
- ⚠️ **Le filtre `.filter(e => e.perf)` n'écartait QUE `0`** — valeur impossible, l'échelle
  étant 1..5. Il avait l'air de filtrer et ne filtrait rien. Comparer à `null`.
- ⚠️ **Côté fournisseurs, le NUMÉRATEUR était faux aussi** : `Number(sup.rating) || 0`
  divisé par `suppliers.length` faisait compter un non-évalué **pour zéro**. MESURÉ : un
  unique fournisseur noté 5 sur 3 affichait « **1,7** ».
- ⚠️ **`z.coerce.number()` transforme `null` en 0.** Poser `.nullable()` AVANT toute
  coercition (`ZodNullable` intercepte `null` sans appeler le schéma interne) — sinon une
  note absente redevient un 0 qui s'affiche « 0/5 », soit un jugement.
- ⚠️ **L'absence se DIT, elle ne se dessine pas.** Cinq étoiles éteintes se lisent « 0/5 ».
  `StarRating(null)` et la grille RH rendent « Non évalué ». Re-cliquer l'étoile courante
  **remet à non évalué** : sans ce retour, un clic accidentel serait définitif et l'état
  vide inatteignable.
- ⚠️ **Aucun formulaire ne démarre noté.** `perf ?? 3` (serveur), `useState(emp?.perf ?? 3)`,
  `rating: 4` (création fournisseur), `perf:3` (nouveau contrat) écrivaient tous une note
  que personne n'avait donnée. Le verrou interdit la FORME `(perf|rating) ?? <chiffre>`.
- **Le seed laisse une partie NON évaluée** (`Fatoumata Ndiaye`, `TOMAPOR`, `Moussa Bamba`,
  `Distrib. Hygiène CI`) — même raison que les `notes` remplies sur une partie des clients :
  une démonstration qui note tout le monde ne montre jamais l'état vide.

**Verrou** : `ratingDenominator.test.tsx` (19) — helper pur, **DOM rendu** des deux écrans,
et deux règles structurelles à périmètre DÉRIVÉ. **3 sabotages vérifiés.**
⚠️ **La règle a été EXÉCUTÉE CONTRE SON CAS DÉCLENCHEUR avant d'être gardée**, parce que le
verrou précédent (« constante à une seule valeur ») ratait PayDunya, donc ratait le défaut
qui l'avait motivé : *un critère qui laisse passer son propre déclencheur est faux, pas
prudent*. Les deux formules d'origine sont rejouées depuis `fixtures/rating-average.avant.txt`
(extrait par `git show`) et le test prouve qu'elles rendent « 0.0/5 » et « 1.7 ».
⚠️ Le scanner a rougi au premier tir **sur ses propres commentaires** — ceux qui citent la
forme interdite pour l'expliquer. `codeSeul()` retire commentaires avant de conclure : un
scanner qui lit les commentaires interdit d'expliquer ce qu'il interdit. Il a par ailleurs
trouvé un site que j'avais classé « correct » à la lecture (`NewOrderModal` `rating ?? 0`).

### Console Ops ⚠️ — les FIXTURES ne sont pas des clients

`lib/fixtureTenant.ts` (backend) décide par **PROPRIÉTÉ** : `isPlatform` · `isDemo` ·
préfixe d'identifiant `e2e-`. **Jamais par une liste d'identifiants** — une liste vieillit,
le prochain tenant de test n'y figure pas, et le chiffre redevient faux en silence.

MESURÉ le 2026-08-06, la console annonçait « 3 boutiques inscrites, toutes ont démarré » :

```
                AVANT      APRÈS
boutiques           3  →       0
comptes             7  →       0
ventes           1905  →       0
CA (XOF)     49 696 665  →      0        fixtures écartées et comptées à part : 4
```

⚠️ **Les fixtures sont MARQUÉES dans la liste (`isFixture` par ligne) et EXCLUES des
agrégats** — un opérateur doit pouvoir ouvrir la démo, mais elle ne doit pas peser dans un
chiffre. Et le nombre d'exclues est DIT à l'écran : masquer sans le dire ferait croire à
une base vide alors qu'elle contient des démonstrations.

⚠️ **Pas de drapeau `isFixture` en base**, bien que ce fût plus propre : le poser sur
`e2e-tenant` serait une MUTATION d'un tenant existant, interdite.

⚠️ **« ACTIF » AVAIT DEUX SENS sur le même écran** — l'onglet Boutiques disait « • Actif »
(ABONNEMENT) pendant que Vue d'ensemble disait « INACTIVE » (ACTIVITÉ) pour la même
boutique. Deux notions orthogonales : une boutique peut payer et ne rien vendre. Désormais
`ABONNEMENT` est un Record exhaustif sur les 5 statuts (une valeur inconnue reste neutre et
VISIBLE, plus de `st` brut), et l'activité se dit « **sans vente depuis 14 j** » — ce qu'elle
mesure, pas un état.

⚠️ **UNE PASTILLE QUI NE PEUT PAS ROUGIR NE PROUVE RIEN.** « Santé technique » lisait
`itg.status === 'connected'`, un **littéral** de `pages/Integrations.tsx` : aucune requête
n'était émise. Le panneau porte maintenant (a) **une sonde réelle** sur `/api/health-extended`,
datée (« vérifié il y a N s ») et capable de rougir, et (b) la mention explicite que le reste
est de la **configuration DÉCLARÉE**, pas une vérification. Sonder Sentry/Resend/Twilio
demanderait un relais serveur : dette assumée, écrite plutôt que masquée par du vert.

### Le JUMEAU NON TRAITÉ ⚠️ — le motif le plus coûteux de ce dépôt

📖 *POURQUOI intégral (les 5 jumeaux mesurés du 2026-08-06, les deux cachés dans un fichier déjà traité, le calibrage du verrou tarifaire, la chaîne de relais qui a inventé un parc d'appareils, et le **registre des messages de commit non réécrivables**) : `docs/lessons/jumeau-non-traite.md`* — **à lire AVANT** d'écrire un verrou à périmètre, un scanner de littéraux, ou une synthèse qui compresse une mesure.

**Une correction qui s'arrête au premier fichier trouvé n'est pas une correction, c'est un déplacement.** MESURÉ le 2026-08-06 : **cinq** corrections en une journée ont laissé un jumeau vivant, dont trois **hors du répertoire voisin** (autre workspace, backend, vitrine↔`/login`).

⚠️ **Chercher au répertoire voisin n'attrape que la moitié** — les deux jumeaux les plus graves vivaient **dans un fichier déjà traité** : l'un **sous un autre NOM** (`normalizeOrangePhone` quarante lignes au-dessus du `normalizeMsisdn` déjà fusionné ; le verrou assertait `calls.length === 1`, donc il PROUVAIT un site d'appel et était aveugle au second), l'autre **sous une autre FORME** (le verrou cherchait `\b8000\b` quand toute chaîne visible écrit « 8 000 »). D'où : **un verrou juge la FORME, jamais l'identifiant.**

⚠️ **QUATRE séparateurs de milliers coexistent** — U+0020 (copie manuelle), **U+202F** (`toLocaleString('fr-FR')`), U+00A0 (gabarits HTML), U+002C (`en-US`). **Normaliser AVANT de chercher, jamais l'inverse.** Corollaire eslint : `no-irregular-whitespace` interdit ces caractères en littéral — les écrire en `\u202f`, sinon on choisit entre le lint et la couverture.

⚠️ **RÈGLE DE SABOTAGE — copier la forme depuis un fichier de PRODUCTION, jamais la retaper.** Un sabotage écrit de mémoire hérite des hypothèses du détecteur, et les deux tombent ensemble : c'est exactement ce qui a laissé le verrou tarifaire vert. Le sabotage doit être extrait par `git show HEAD:<fichier>` ou lu à l'exécution (cf. `pos-normalizeOrangePhone.deleted.txt`, et le séparateur relu dans `index.html` par `planPriceLiterals.test.ts`).

⚠️ **Un périmètre ÉCRIT À LA MAIN est faux dès qu'on ajoute quelque chose**, et l'assertion de couverture ne le dira pas : elle prouve qu'on a lu N fichiers, jamais que N était le bon N. Le périmètre se **DÉRIVE** (routes d'`App.tsx`, arborescence, les trois cibles `apps/frontend/src` + `apps/backend/src` + `mobile/src|app`), et les exemptions se **NOMMENT** une par une.

⚠️ **QUATRE angles morts, et chacun est INVISIBLE depuis le précédent.** Les trois premières parades ont toutes été inventées *après* s'être fait avoir. Un verrou peut être vert pour l'une de ces quatre raisons sans qu'aucune des autres ne le signale.

| # | Angle mort | Le verrou est vert parce que… | Parade |
|---|---|---|---|
| 1 | **Profondeur** | il ne lit RIEN (`walk()` cassé, dossier déplacé, glob muet) | assertion de **COUVERTURE** (« j'ai bien lu N fichiers ») |
| 2 | **Périmètre** | il lit les MAUVAIS fichiers | périmètre **DÉRIVÉ** (routes d'`App.tsx`, arborescence), jamais listé |
| 3 | **Forme** | il cherche ce qui ne PEUT PAS exister (`\b8000\b` vs « 8 000 ») | sabotage **COPIÉ** depuis un fichier de production |
| 4 | **Arité** | il n'y a RIEN à chercher | *aucune parade automatique* |

⚠️ **L'ARITÉ est la seule des quatre sans parade** : `plan === 'pro' ? 'Pro' : 'Enterprise'` sur un domaine à QUATRE valeurs n'offre aucun littéral fautif à détecter, juste une branche qui **n'existe pas** (toute activation Starter annonçait « plan Enterprise activé »). Question à poser à chaque revue : **ce booléen décrit-il vraiment un domaine binaire ?** Préférer un `Record<Domaine, T>` — le compilateur rougit là où aucun test ne le fera. Fréquence mesurée et calibrage : § « Arité des ternaires ».

⚠️ **Règle : une synthèse ne doit introduire AUCUN nom absent de sa source.** `build` → `parc`, `une route` → `les routes`, `un tenant` → `les clients` : chaque généralisation d'un singulier mesuré vers un collectif crée une population qui n'a jamais été comptée — c'est ainsi qu'un parc d'appareils inexistant a franchi trois relais. Quand une phrase de `CLAUDE.md` porte un collectif (« le parc », « les utilisateurs », « les boutiques »), remonter à la mesure d'origine avant de s'en servir.

⚠️ **NE PAS ARBITRER — COMPTER.** Quand deux sources se contredisent sur une entité DÉNOMBRABLE, la contradiction n'est pas à trancher : elle est le signal qu'**aucune des deux n'a compté** (les deux affirmations en litige étaient fausses toutes les deux). Aller compter — ici `pushToken.groupBy` a rendu **1**, et six commandes ont clos six jours de doute. La date et la preuve citée sont toutes deux des raccourcis ; seule la mesure tranche.

⚠️ **Un message de commit ne se corrige pas — il se RECENSE**, sinon il redevient une source : c'est un texte daté, signé, que `git log` remonte en premier et qu'on relit sans le suspecter. **Trois** en portent une, recensés dans la leçon.

---

⚠️ **LA SOURCE EST VALIDE, L'ARTEFACT EST NUL — le motif qui a ouvert ET fermé la semaine du
2026-08.** Cinq jours d'écart, deux langages, un seul défaut :

| Date | Écrit | Livré | Vu par |
|---|---|---|---|
| 02/08 | `` border: `1px solid ${v.accent}28` `` où `v.accent` vaut `'var(--p2)'` | déclaration **invalide à l'évaluation** ⇒ `border-style: none` (valeur INITIALE, pas héritée) | l'œil, à l'écran |
| 06/08 | `<meta name="keywords" <!-- commentaire --> content="…">` | `content` **absent du DOM** — le changement SEO ne faisait rien | le DOM de production |

Dans les deux cas : `tsc` vert, suite verte, revue passante, **et rien de ce qui était censé être
livré ne l'était**. Ni le compilateur, ni les tests, ni la revue ne regardent l'artefact — ils
regardent la source, et la source est correcte. Le défaut naît à la frontière : un `var()` suffixé
d'un alpha hexadécimal est du CSS invalide, un `<!-- -->` dans une balise est du HTML invalide.
Même famille que l'ordre des règles du service worker et que le contexte Docker (§ Déploiement) :
**une régression d'ARTEFACT n'est pas visible depuis la source.**

**Règle : tout ce qui est GÉNÉRÉ se vérifie sur le PRODUIT, jamais sur ce qui l'a produit.**
`verify:seo-urls` (déjà en CI) porte désormais les gardes correspondantes — aucun `<!--` dans une
balise, `content` non vide sur chaque `<meta name>`, JSON-LD `JSON.parse`-able. Sabotages écrits
avec les formes **réellement commises**, pas retapées.

⚠️ **Corollaire — un fait peut être encodé en DONNÉES, pas en texte.** Le JSON-LD portait
`serviceArea.geoMidpoint = 14.6928 / -17.4467` : Dakar. Un signal de ciblage géographique aussi
fort que le mot « Dakar », **qu'aucune recherche de chaînes ne peut trouver**. Il a été vu en
balayant les surfaces SEO une par une, pas en cherchant des mots. Quand on nettoie une
affirmation, se demander sous quelle forme NON TEXTUELLE elle pourrait aussi vivre : coordonnées,
code pays, indicatif, fuseau, code devise, locale.

### Injection CSV ⚠️ — convention EXÉCUTOIRE, pas affirmée (#173)

**Tout producteur de CSV passe par `sanitizeCsv` de `lib/csv.ts`** — `apps/backend/src/lib/csv.ts` et `apps/frontend/src/lib/csv.ts`, **jumeaux à l'identique**, exercés sur les cas partagés `docs/shared-fixtures/csv-injection-cases.json` (modifier la règle d'un seul côté fait rougir l'autre — **vérifié dans les deux sens**). Le garde préfixe d'une apostrophe toute valeur commençant par `=`, `+`, `-` (trait d'union ASCII), `@`, tabulation ou retour chariot.

⚠️ **Entourer la cellule de guillemets ne protège PAS** : le tableur retire les guillemets puis évalue — `"=1+1"` donne 2. C'est ce qui rendait la faille invisible ; les producteurs échappaient consciencieusement les `"` et se croyaient sûrs. `sanitizeCsv` s'applique donc **AVANT** l'échappement, jamais après.

⚠️ **Ce qui rend la convention réelle, c'est le méta-test** (`csvInjection.test.ts`, front + back), pas cette ligne. Avant #173, `sanitizeCsv` vivait en `const` **locale** dans `routes/reports.ts` : la règle était documentée ici, applicable nulle part ailleurs, et `routes/export.ts` ne l'appelait pas. Un garde qu'on ne peut ni importer ni enfreindre bruyamment est un vœu.

⚠️ **Le verrou raisonne par SITE D'ÉCRITURE, pas par FICHIER** — et c'est MESURÉ, pas théorique. La première version, à la maille du fichier, laissait passer un trou réel : `utils/export.ts` contient **DEUX** producteurs — `exportCSV` (gardé) et **`exportAccountingExcel`** (nu ; malgré son nom il n'écrit pas de .xlsx mais un `text/csv`). Le fichier mentionnant `sanitizeCsv` pour le premier, il passait, pendant que le libellé de dépense saisi par le commerçant partait non neutralisé. Le scan **retire commentaires et imports** avant de conclure : sans ça il se ferait berner par un commentaire qui mentionne le garde, ou par un `import` conservé alors que l'appel a disparu (les deux sont exercés en contre-preuve dans le test).

**Le méta-test prouve la SOURCE, jamais l'APPLICATION** — d'où `csvInjectionBehaviour.test.ts` des deux côtés, qui capture les octets réellement écrits (contenu du `Blob` côté front, corps de la réponse via `app.inject()` côté back). Sabotages vérifiés : garde retiré de `routes/export.ts` · d'`exportAccountingExcel` · règle divergente d'un seul côté du jumeau.

✅ **XLSX : PAS concerné — verdict MESURÉ, pas supposé.** `utils/xlsxWriter.ts` ne sanitise que les noms de feuille, jamais les cellules, et c'est **correct**. Mesuré sur la sortie réelle de `buildXlsxBytes` : chaque chaîne sort en `<c t="inlineStr"><is><t>…</t></is></c>`, et **aucun `<f>` n'est jamais émis**. La différence avec le CSV est structurelle : un CSV ne porte aucun type, le tableur doit **deviner** et devine « formule » sur un déclencheur initial ; en OOXML le type est **déclaré** et une formule exige un élément `<f>` dédié. Rien à deviner ⇒ rien à neutraliser — préfixer abîmerait la donnée (l'apostrophe s'afficherait). Verrou : bloc « injection de formule » de `xlsxWriter.test.ts`, qui fige l'absence de `<f>` et le typage des cellules, pour qu'une évolution du writer ne rouvre pas la question en silence. **Limite assumée** : ce sont les octets QUE NOUS ÉMETTONS ; le fichier n'a pas été ouvert dans un vrai Excel, et le rond-trip « Enregistrer sous → CSV » depuis Excel est hors de portée d'un garde applicatif.

### Sécurité (remédiation audit 2026-07 — `docs/audits/AUDIT_APPROFONDI_2026-07.md`)
- **Handler d'erreur durci (P1.6)** : `lib/errorHandler.ts` (extrait de `server.ts`, testable). Un **≥500 ne renvoie PLUS `error.message` brut** au client (fuite d'infos internes Prisma/DB) → message générique « Erreur serveur », le vrai message reste journalisé (log + Sentry). Les 4xx intentionnels (zod→400, P2025→404, framework 413/415/429) gardent leur message. Verrou : `errorHandler.test.ts` (message sensible masqué sur 500, conservé sur 4xx ; sabotage vérifié).
- **Validation déclarative zod** (item 6) : `app.setValidatorCompiler(validatorCompiler)` global dans `server.ts` (seul le **validator**, PAS le serializer → réponses inchangées ; routes sans `schema` inchangées). Schémas `body/params/querystring` sur les routes **argent** (sales, payments *, payroll), **auth** (login/register/switch-tenant/password), **écritures** (products, customers, suppliers, orders, employees, expenses, goals, subscriptions, stockTransfers). Erreurs zod → **400 `{ error, code:'VALIDATION' }`** (handler global). Les règles métier (nom requis, `total<0`, MSISDN, force mdp) **restent dans les handlers** (messages conservés). ⚠️ **Tout test qui monte une route avec `schema` zod DOIT appeler `app.setValidatorCompiler(validatorCompiler)` avant `register`** (sinon Ajv casse : « schema is invalid »). Schémas d'écriture mutualisés : `src/schemas/writesB.ts`.
- **Anti mass-assignment** : `PUT /products/:id`, `POST|PUT /suppliers`, `POST|PUT /expenses` passaient le body BRUT à Prisma → un `tenantId` injecté réassignait la ressource. Schémas UPDATE = **liste blanche stricte (strip)** → clés hors modèle (`tenantId`/`id`/timestamps/`sku`) supprimées. `create` : `tenantId` imposé serveur.
- **W1** (`stockTransfers.ts` confirm/cancel) : scope tenant **avant** existence/statut → **404 uniforme** pour un tiers (pas d'oracle). La source garde son 403 sur `/confirm`.
- **W2** (`whatsapp.ts` send-ticket) : reçu brandé avec `request.tenantId` (boutique **active**), pas `request.user.tenantId`.
- **Rate-limit GLOBAL** (item 5) : `@fastify/rate-limit` `global:true`, 300/min par IP (ajustable `RATE_LIMIT_MAX`). Overrides plus stricts conservés (auth, checkouts, paiements). **Exemptés** (`config.rateLimit:false`) : webhooks/IPN paiement + health checks. `bodyLimit` explicite **4 Mo** (photos employé base64 ; multipart OCR 10 Mo non concerné).
- **Isolation cross-tenant** (item 7) : `tenantIsolation.test.ts` (mock Prisma tenant-aware) prouve 404/aucune mutation pour tenant B sur les ressources de tenant A. `PUT /customers/:id` : P2025 → **404** (était 500).
- **Extension Prisma tenant** (item 8, defense-in-depth) : `src/db.ts` exporte `prisma` (étendu `$extends`) + **`basePrisma`** (non étendu, pour cross-tenant légitime — dashboard consolidé). Auto-injecte `tenantId` sur 19 modèles scopés **si absent** (n'écrase jamais un tenantId explicite). Contexte ALS (`src/lib/tenantContext.ts`) établi par un hook **`onRequest`** (`initTenantStore`) puis renseigné par `authenticate` (`bindActiveTenant`). ⚠️ `enterWith` dans un preHandler (après `await`) ne remonte PAS au handler → d'où l'établissement en `onRequest`. **Durci (#35)** : les ÉCRITURES `create`/`createMany`/`upsert` sont GARDÉES — `tenantId` absent → injecté ; présent et ≠ contexte → `TenantScopeMismatchError` (403), jamais d'écrasement silencieux (lectures : `where.tenantId` explicite respecté). `findUnique` résiduels sur modèles scopés convertis en `findFirst({id,tenantId})` (stockTransfers confirm/cancel = `OR` source/dest, analytics, cron hebdo ; TicketZ conservé — clé composite contient tenantId). Purge push tokens = `basePrisma` (nettoyage cross-tenant par token exact). `update`/`delete` par clé unique restent aux handlers. Filtrage manuel conservé. `TxClient` (db.ts) type les `tx` du client étendu. **Comportement neutre** pour le code existant (tous les handlers filtrent déjà) — c'est un filet.
- **Rotation secrets (P0.1, action Nelson)** : `apps/backend/.env` fut commité (repo PUBLIC) — `JWT_SECRET` + `TWILIO_AUTH_TOKEN` à tourner (Anthropic déjà 401, DB déjà migrée). Purge d'historique = destructive, après rotation + accord.

### Garde de DÉPENSE externe ⚠️ (2026-07 — Anthropic / Twilio / Resend)

**Principe : la garde vit au POINT DE DÉPENSE, jamais sur la route.** Garder des routes
laissait passer tout ce qui dépense hors requête HTTP — le reçu WhatsApp automatique
déclenché par `POST /api/sales` (le plus gros poste Twilio) et les crons 20h/8h n'ont ni
`request` ni preHandler. D'où une résolution par `tenantId`.

- `lib/spend/spendGuard.ts` — `authorizeSpend(tenantId, kind, units)`. Ordre **démo →
  statut/essai → rafale → quota**. UNE lecture tenant (`isDemo`+`status`+`trialEnds`)
  cachée 60 s. Kinds : `ai` · `ocr` · `whatsapp` · `email`.
- `lib/spend/{twilioClient,anthropicClient,resendClient}.ts` — **SEULS modules autorisés à
  importer les SDK facturés**. Verrou : `spendGuardAllowlist.test.ts` échoue si `twilio`,
  `@anthropic-ai/sdk` ou `resend` est importé ailleurs dans `src/`, avec contre-preuve que
  le scan détecte bien une violation.
- `middleware/costQuota.ts` — pré-refus RAPIDE (démo/essai) pour un code HTTP propre avant
  tout travail. **Il ne compte rien** : la comptabilité est au point de dépense, ce qui rend
  le compteur exact par construction (un refus de rôle ou un 413/415/503 n'atteint jamais le
  SDK, donc ne consomme rien — pas de remboursement a posteriori à écrire).
- `middleware/demoTenant.ts` + `Tenant.isDemo` — 11 routes gardées (403 `DEMO_TENANT_FORBIDDEN`).
  Bascule : `scripts/set-demo-tenant.ts` (`CONFIRM=1`). ⚠️ Le mot de passe démo est PUBLIC
  (dépôt public) : masquer le bouton côté front ne protège RIEN, seul ce refus serveur tient.
- **Plafonds par env, lus À L'APPEL** (ajustables sans redéploiement) : `QUOTA_TRIAL_*` /
  `QUOTA_ACTIVE_*` (essai 20/15/30/20, payant 200/150/300/200), `COST_BURST_PER_MIN`
  (défaut 10 — ⚠️ pas de `|| 10`, sinon `Number('0') || 10` rend la désactivation inopérante).
- **WhatsApp = DEUX seaux séparés** (`SpendKind`) : `whatsapp` TRANSACTIONNEL (reçus,
  alertes, crons — 30/300, SACRÉ) et `whatsapp_marketing` (diffusions, campagnes —
  `QUOTA_TRIAL_WHATSAPP_MARKETING`/`QUOTA_ACTIVE_WHATSAPP_MARKETING`, **défaut bas 10/50 =
  PLACEHOLDER** à fixer par produit/facturation ; chaque message marketing coûte du Twilio
  réel, on refuse plutôt qu'on surprend). La clé `whatsapp` est INCHANGÉE → le split ne
  remet aucun compteur à zéro. `sendWhatsApp` exige un `flow` (`sale_receipt` |
  `transactional` | `marketing`) — paramètre OBLIGATOIRE comme `owner` : le compilateur
  force le choix de seau pour tout futur appelant. **Le reçu de vente AUTOMATIQUE
  (`sale_receipt`) est le SEUL exempté de la rafale** (`authorizeSpend(..., {skipBurst:true})`) :
  une caisse en heure de pointe enchaîne >10 ventes/min et perdait le 11ᵉ reçu ; le
  journalier borne toujours. Verrous : `quotaSplit.test.ts` (seaux distincts + exemption,
  3 sabotages), `campaignSlot.test.ts` (le créneau 1/h ne se consomme que sur un envoi réel).
- **Asymétrie fail-open / fail-closed, assumée** : démo/statut **fail-CLOSED** (refuser une
  démo ne coûte rien de légitime) ; quota Redis **fail-OPEN TRACÉ** (`[spend-guard] FAIL-OPEN`
  console + Sentry) — un incident Redis ne doit pas couper l'OCR d'un payant. Le fail-open
  n'est acceptable QUE parce qu'un **repli mémoire par tenant** borne la rafale sans Redis :
  ne pas le retirer (c'est ce que faisait l'override `@fastify/rate-limit` supprimé des routes).
- ⚠️ **Rafale par TENANT, jamais par IP** : `@fastify/rate-limit` s'exécute en `onRequest`,
  donc AVANT `authenticate` (`request.tenantId` absent, et un JWT non vérifié laisserait
  l'attaquant choisir sa clé). Surtout, le **CGNAT ouest-africain** fait partager une IP à des
  boutiques sans lien et les caisses d'un magasin sortent par la même adresse.
- **Exemptions volontaires, à ne pas « corriger »** : les e-mails de CYCLE DE VIE
  (bienvenue, relances, essai expiré, confirmation) passent par `sendPlatformEmail` et
  **échappent au garde** — les gater bloquerait l'e-mail « votre essai est terminé » au moment
  précis où le tenant devient échu/suspendu. Seuls les e-mails OPÉRATIONNELS (invitation,
  alerte stock, rapport hebdo, récap paie) sont gardés (`sendTenantEmail`, kind `email`).
- **Invalidation du cache** : `invalidateTenantSpendInfo()` est appelée sur les 4 sites qui
  changent l'état (billing suspension, admin activation de plan, webhook paiement, script
  démo). Sans elle, une boutique basculée en démo dépense encore jusqu'à 60 s.

**PII** : `lib/redactPhone.ts` — les messages d'erreur Twilio embarquent le numéro
destinataire. `redactPhone`/`redactError` avant TOUTE journalisation (`+221****4567`).
Méta-test `redactPhone.test.ts` : assertions sur le contenu **réellement journalisé**
(`console.warn` capturé), + scan ligne-par-ligne interdisant un numéro ou un `err.message`
brut sur la surface d'envoi. Exclut les horodatages ISO (même silhouette qu'un numéro).

### ⚠️ Normalisation téléphonique — chantier CLOS. **Ne PAS re-concevoir.**

📖 **POURQUOI intégral : `docs/lessons/normalisation-telephonique.md`** — 4 tentatives, dont
**3 fuites de données annulées** (reçus clients et résumés commerçants livrés à des inconnus),
et les faits MESURÉS sur `libphonenumber-js` qui les expliquent. **Lire ce fichier AVANT de
toucher** `recipientPhone.ts`, `twilioClient`, `smsClient` ou la surface d'envoi.

**La conception en place** (PR #100, `lib/spend/recipientPhone.ts` `resolveRecipient`) : la
question se pose **AVANT** la bibliothèque — « à qui appartient ce numéro ? » — via un paramètre
**`owner` OBLIGATOIRE** sur `sendWhatsApp`/`sendSms` (le compilateur le force à tout futur appelant) :
- **flux commerçant** (`ownerPhone`, crons) → normalisable avec `tenant.country`, UNIQUEMENT si
  `isSupportedCountry()` ; sinon refus `COUNTRY_UNKNOWN` ;
- **flux client** (reçu, send-ticket, send-alert, broadcast, campagne) → **AUCUNE inférence de
  pays** ; seul un `+` littéral que `isValid()` valide passe, sinon `PHONE_NOT_INTERNATIONAL`/
  `PHONE_INVALID`. Le flux se déduit de la **PROVENANCE**, jamais de l'intention (`send-alert`
  reçoit son numéro du corps de requête ⇒ c'est un tiers) ;
- le refus **REMONTE** (`SendResult.refused[]`) → 422, jamais un `+` deviné vers Twilio.

`resolveRecipient` est la **seule autorité** : toutes les pré-transformations amont (`00→+`,
`replace(/^0/)`, `+` collé, mapping des campagnes) sont supprimées. Verrous : `phoneCollision.test.ts`
(harnais de collision, 2 sabotages) + `phoneChokepoint.test.ts` (méta-test : `libphonenumber-js`
interdit hors du résolveur, motifs de fabrication interdits sur la surface d'envoi — **résidu
assumé** : un motif INÉDIT passerait ; la couche solide est `owner` obligatoire + relancer le
harnais sur tout nouveau chemin).

⚠️ **Les trois intuitions qui ont causé les fuites, toutes MESURÉES fausses** (détail + chiffres
dans le fichier de leçon) : le pays du commerçant n'informe **pas** le numéro de son client (plans
qui se recouvrent : `76123456` est valide en ML, BF, NE **et** TG) · la bibliothèque **fabrique**
au lieu de refuser (seul `isValid()` écarte) · « Twilio rejettera un numéro mal formé » est **faux**
(un `+` à l'aveugle produit des numéros étrangers **livrables**). Donc « on ne normalise pas » ne
vaut **jamais** « on n'envoie pas » : il faut refuser d'envoyer, explicitement.

✅ **Dette `Tenant.country` : TRAITÉE** (surface propre). Le champ contenait `CI`, `SN` **et
`France`** : `Onboarding.tsx` PATCHait la `value` de son `<select>`, laquelle était le LIBELLÉ
français, là où `SignupPage` envoyait de l'ISO-2 — deux formats, aucune validation au milieu.
Conséquence NON cosmétique : `resolveRecipient` n'accepte que l'ISO-2, donc un tenant « France »
ne recevait **ni WhatsApp ni SMS**, en silence (le garde faisait son travail, la donnée mentait).
Désormais **`lib/country.ts`** (`normalizeCountry`, `SUPPORTED_COUNTRIES`) est le seul juge, appelé
par les **3** chemins d'écriture (`PATCH /api/tenant` → **400** sur l'irrésolvable, register, admin).
⚠️ **Liste blanche, PAS `^[A-Z]{2}$`** : la regex accepterait `XX`, remplaçant une valeur invalide
*bruyante* par une *silencieuse*. ⚠️ **`null` ≠ repli** — un défaut implicite sur `SN` est ce qui
rend indistinguables un choix et une valeur jamais saisie. ⚠️ **Ne PAS y importer
`libphonenumber-js`** (`isSupportedCountry`) : un second point d'entrée rouvrirait ce que
`phoneChokepoint.test.ts` ferme. Table des libellés hérités conservée (une PWA en cache les envoie
encore) — ensemble CLOS de nos propres anciennes `value`, pas une inférence sur du texte libre.
Front : `Onboarding` et **le champ Réglages → Boutique** (qui était en TEXTE LIBRE, donc 400 garanti)
passent par le sélecteur `utils/countryList.ts`, valeur ISO-2 / libellé affiché. Verrou :
`tenantCountryIso.test.ts` (12, **3 sabotages** : regex au lieu de la liste blanche · repli implicite
sur `SN` · route stockant la valeur brute). `Customer` n'a toujours **aucun** champ pays (rien ne
permettrait de résoudre un national de client — c'est voulu, cf. flux client).

⚠️ **Méthode — la leçon la plus chère, valable au-delà du téléphone** : ne JAMAIS poser une garantie
de sûreté par RAISONNEMENT. Les trois échecs ont le même motif — une affirmation plausible écrite en
commentaire et jamais exécutée, qu'un script de dix lignes aurait démentie **avant** le commit.
**Mesurer d'abord, coder ensuite** ; si un commentaire affirme une propriété de sûreté, un test doit
l'exercer, et être vérifié **dans les deux sens**.

## Dette ouverte

### 🔴 Critique
- ✅ **Numéros WhatsApp : RÉSOLU** (sous-surface 1, PR #100) — la normalisation par « à qui appartient ce numéro » (`resolveRecipient`, param `owner` obligatoire) a remplacé le `+` aveugle et le `replace(/^0/)`. Cf. § Normalisation téléphonique (+ `docs/lessons/normalisation-telephonique.md`). La dette `Tenant.country` qui subsistait est elle aussi traitée (cf. § Normalisation téléphonique, fin).
- ✅ **SMS : IMPLÉMENTÉ** (Africa's Talking). `lib/spend/smsClient.ts` = SEUL module important `africastalking` (ajouté à l'allowlist `spendGuardAllowlist.test.ts`), calqué sur `twilioClient` : garde de dépense (`SpendKind` **`sms`**, quotas `QUOTA_TRIAL_SMS`/`QUOTA_ACTIVE_SMS` défauts 20/200 placeholder) + **`resolveRecipient` obligatoire** (`owner` requis — un SMS part vers un numéro, même sécurité téléphonique que WhatsApp), ne throw jamais, rend les unités des envois échoués/écartés. `services/sms.ts` `notifyStockAlertSms(tenantId, products)` = **digest QUOTIDIEN** au gérant (câblé dans `services/notificationCrons.ts`, PAS par vente → un SMS/jour, pas un par vente ; gardé opt-in tenant `notifSmsStock` + `ownerPhone`, flux commerçant normalisé avec `tenant.country`). Filet `mockPaidSdks.ts` mocke aussi `africastalking`. ⚠️ **À ACTIVER (Nelson)** : compte Africa's Talking + `SMS_API_KEY` (+ `SMS_USERNAME` défaut `sandbox`, `SMS_SENDER_ID` optionnel) sur Railway — absente = feature inerte (`SMS_NOT_CONFIGURED`, fail-safe). Verrou : `smsClient.test.ts` (6 : refus téléphone client/pays non supporté, normalisation commerçant, quota refusé, réserve N, fail-safe clé absente ; sabotage vérifié). *(`notifSmsSales` = résumé ventes, fast-follow trivial via la même infra.)*
- ✅ **Push PWA : IMPLÉMENTÉ** (Web Push VAPID). Canal navigateur DISTINCT du push Expo mobile : `services/webPush.ts` (SEUL module important `web-push`, fail-silent, VAPID lu à chaud depuis l'env → no-op si absent) ; `pushService.dispatch()` fanne chaque notif vers Expo (mobile) ET web (subscriptions `platform='web'`, subscription JSON stockée dans `PushToken.token`). Front : `utils/webPush.ts` (permission → clé VAPID serveur → `pushManager.subscribe` → POST token), toggle « Recevoir sur cet appareil » dans `SectionNotif` (distinct de l'opt-in tenant `notifPushAll`), handlers SW dans `public/push-sw.js` (chargé via workbox `importScripts` — le SW généré n'accepte pas de listeners en config ; exclu du precache). Endpoint `GET /api/notifications/vapid-public-key`. ⚠️ **À ACTIVER (Nelson)** : poser `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT` optionnel) sur Railway — clés absentes = feature inerte (fail-safe). Verrous : `webPush.test.ts` (back : parse/fail-safe/purge 404-410) + `webPush.test.ts` (front : décodage base64url VAPID).
- **Wave webhook** : code **fail-CLOSED** (`if (!secret) return false`) ✅ — reste à poser `WAVE_WEBHOOK_SECRET` Railway pour activer la vérif en prod. **S**
- **Campay go-live** : `CAMPAY_WEBHOOK_KEY` + `CAMPAY_ENVIRONMENT=production`. **S**
- **PayDunya go-live** : `PAYDUNYA_MODE=live` + clés live. Flux POS non validé end-to-end. **S**

### 🔴 Critique (suite)
- ✅ **Rejeu hors-ligne MOBILE : TRAITÉ** (option A, voie 1) — `saleReplay.ts` pose `offlineReplay` et **consomme la réponse** (elle était jetée) ; hors bornes → entrée durable `repriced` « à vérifier ». Cf. § Intégrité prix + `docs/handoff/2026-07-25-rejeu-mobile-option-a-design.md`.

### 🟡 Medium
- **Congés E2E : fuite FERMÉE le 2026-08-07 — reste à purger le résidu de 307 lignes.** **S**
  - ✅ **Cause TROUVÉE, et c'était une clé de stockage.** Le ménage du scénario lisait le jeton
    dans `localStorage.getItem('auth-storage')` — **une clé qui n'existe nulle part**. Le store
    persiste sous **`habashop-auth`** (`authStore.ts:187`) et les quatre autres scénarios lisent
    **`habashop_token`**. Le jeton valait donc `''`, le `DELETE` partait en `Bearer ` → **401**,
    et **aucune ligne n'a jamais été supprimée** : 289 → 307 APRÈS le correctif censé stopper
    la fuite. Corrigé : la clé est désormais celle des autres scénarios.
  - ⚠️ **L'échec était INVISIBLE par construction** : le repli était un `console.warn`, et le
    rapporteur Playwright n'imprime la sortie d'un test **réussi** qu'en cas d'échec. Un test
    vert n'imprime rien. Troisième support du motif « l'absence n'est pas une preuve », après la
    coche verte du job de notification et le `exit 0` d'un scan cassé.
  - ✅ **Le ménage est désormais ASSERTÉ, plus « best-effort »** — renversement délibéré. Il
    était non bloquant « pour ne pas rougir sur du ménage » ; résultat, il a échoué à chaque
    exécution pendant une journée sans que rien ne le dise. *Un ménage silencieux qui ne marche
    pas est pire que pas de ménage : il fait croire que c'est réglé.* Et l'assertion porte sur
    **le COMPTE avant/après**, pas sur le code de retour : un 200 dit que l'appel a abouti, pas
    que la base est revenue à son état d'avant (motif du smoke de version).
  - ✅ **PROUVÉ FERMÉ** : trois exécutions consécutives, compte **307 → 307 → 307**. Sabotage
    vérifié — retour à `auth-storage` → rouge, `GET /api/leave-requests → 401` nommé.
  - ⚠️ **Les RETRIES rejouent le test entier** — mesuré : l'exécution CI `31137759378` du 07/08
    a créé DEUX demandes (01:24:40 et 01:25:37). Une tentative qui échoue avant le bloc de
    ménage laisse une orpheline, et le `avant` de la tentative suivante l'inclut. **Limite
    assumée**, écrite dans le scénario.
  - ✅ **RÉSIDU PURGÉ le 2026-08-07** — **307 → 0** sur `e2e-tenant`, après validation explicite.
    Protocole complet : répétition à blanc, garde `CONFIRM=1`, périmètre **en dur** dans le
    script (un périmètre passé en argument est un périmètre qu'on peut mal taper), refus si le
    tenant est `isDemo`, instantané avant, diff de l'objet entier après.
    **Effets de bord vérifiés INTACTS** — les 3 Shift et les 3 Attendance sont inchangés
    **id par id** (ce sont les données légitimes d'un congé approuvé, affichées par le
    Planning), 2 employés, 4 tenants, empreinte `b5c8ead69eaf537c6d5f640b` **inchangée**, et
    les **7** demandes de `demo-tenant-001` intactes.
    **Cycle E2E réel rejoué APRÈS la purge** : vert, et la base retombe à `LeaveRequest=0`,
    `Shift=3`, `Attendance=3` — le ménage tient sur une base propre, pas seulement sur une base
    déjà pleine.
- **Export CSV des ventes : plafond SILENCIEUX à 1 000 lignes** (`apps/backend/src/routes/export.ts:56`, `take: 1000`). **S**
  - ⚠️ **Ce n'est PAS la famille « le total est la somme de ce qu'on montre »** (analytics.ts:108,
    Répartition paiements, PDF du 07/08) : **aucun total n'en dérive**, et le balayage du
    2026-08-07 a établi qu'`analytics.ts` était le **seul** site de cette famille-là. C'en est
    une autre : *un document qui SORT du produit est tronqué en silence.*
  - **Et elle est plus grave dans un export que dans un graphique** : le CSV part chez un
    comptable. Une épicerie qui fait 1 200 ventes dans le mois en reçoit **1 000**, et aucune
    ligne du fichier ne le signale. Un graphique faux se discute ; un fichier comptable amputé
    se recopie.
  - **DÉCLENCHEUR DE RÉOUVERTURE : le premier commerçant dépassant 1 000 ventes sur une période
    exportée.** Avec zéro client, personne n'exporte — c'est **cela** qui rend l'attente
    acceptable, pas la gravité du défaut. ⚠️ Une question ouverte sans condition de réouverture
    ne se rouvre jamais : le déclencheur fait partie de la dette, pas du commentaire.
  - **Correctif attendu le jour venu** : lever le plafond, **ou le DIRE** — ligne d'en-tête dans
    le CSV, ou avertissement à l'écran. *Un export tronqué qui s'annonce est utilisable ; un
    export tronqué muet ne l'est pas.*
  - **Frère plus léger, même dette** : `export.ts:99` — le rapport mensuel HTML/PDF liste
    `sales.slice(0,30)` sous « Détail des ventes » sans dire que ce sont les 30 premières. Moins
    grave : le KPI voisin affiche `sales.length`, donc l'écart est au moins *inférable* par le
    lecteur. À traiter dans le même geste.
  - ✅ **Balayage de CETTE famille — fait le 2026-08-07, résultat consigné pour ne pas le
    refaire.** 15 producteurs de documents (export, facture PDF, ticket, reçu, e-mail, rapport,
    étiquette, xlsx), web + API + mobile. Les deux ci-dessus sont les seuls défauts. **Deux
    contre-exemples portent le bon motif** et servent de modèle : `services/email.ts:473`
    calcule `totalCount = products.length` **avant** son `slice(0,20)`, et `routes/whatsapp.ts:93`
    annonce `lowStock.length` avant de n'en lister que cinq. Écartés à raison : `xlsxWriter`
    (31 car. = limite dure du format Excel), `thermalLabel` (2 lignes = contrainte physique de
    l'étiquette), `ticketZ`/`whatsapp:355`/`payrollReport` (listes d'écran ou destinataires, pas
    des documents). Résiduel mineur **non retenu** : `reports.ts:492` coupe un nom de client à
    18 caractères sans ellipse — troncature de CHAMP, pas de jeu de lignes.
  - ⚠️ **Le balayage a menti deux fois avant d'aboutir, et les deux fois en SORTANT EN 0.**
    (1) `for f in $CIBLES` — zsh ne découpe pas les variables non quotées → « 0/15 fichiers ».
    (2) `xargs grep -nP` — `xargs` appelle le `grep` **BSD** de `/usr/bin`, qui n'a pas `-P`,
    pendant que le `grep` du shell est `ugrep` : erreur affichée, **code de sortie 0**, sortie
    vide. Un scan muet se lit comme un scan propre. **Contrôle positif obligatoire avant de
    conclure « rien »** — ici : la commande DOIT trouver `export.ts:56`.
- ✅ **Paie statuts : RÉSOLU** — modèle `Payroll` (instantané GELÉ) + routes `GET /api/payroll?month=YYYY-MM`, `POST /api/payroll/generate`, `PATCH /api/payroll/:id`. Cf. § Paie.
- **Bundle recharts ~105KB gz** : lazy + hors precache. Remplacer visx = **L**.
- **Densité — UN SEUL lot avec la table dense** ⚠️ : tout touche la même structure, séparer ferait le travail plusieurs fois. Défauts MESURÉS sur captures — **console Ops** : bandeau MRR ~1 400 px entre le chiffre et la note de droite · onglet Boutiques ~700 px de vide sous trois cartes · tiroir de détail ~700 px de vide en bas. **Écrans applicatifs** (2026-08-06) : Rapports/RH deux cartes pleine largeur pour deux valeurs · `select-shop` deux lignes dans un écran vide · Planning légende du bas redondante avec la barre du haut.
  - ⚠️ **NE PAS chercher à authentifier Playwright sur `/admin`.** Le compte E2E est SUPER_ADMIN **de boutique** ; la console plateforme lui est masquée **PAR CONCEPTION** (garde P0 : `App.tsx:97` `isPlatformAdmin !== true` → redirection, `Sidebar.tsx:255` masque l'entrée, `e2e/smoke.spec.ts:78` fige l'absence). L'échec d'accès est le **bon comportement** — ne pas l'affaiblir pour mesurer une marge. C'est le motif du § Vérification en PROD appliqué à l'UI : on ne desserre pas un garde pour se donner un instrument.
  -   - ✅ **Le workflow densité tourne EN CI** depuis le 2026-08-07 (`density.yml`, filtré par
    `paths:`). Preuve sur runner, pas affirmation : le `webServer` **démarre** (`> vite`,
    ready 439 ms — jamais réutilisé, `reuseExistingServer: !process.env.CI`), 4 tests en
    **9,8 s**, job **64 s** au total dont 43 s d'installation. ⚠️ La géométrie mesurée sur
    Ubuntu diffère de **9 px** du macOS local à 390 px (`.table-wrap` 1232 vs 1223) — rendu
    de police. L'assertion porte sur le DÉBORDEMENT et l'enroulement, jamais sur un pixel
    exact : c'est ce qui la rend portable.

**Boucle de mesure — Nelson EST la session authentifiée** : (1) Claude propose la mise en page avec les **valeurs visées écrites** (largeur max, gouttières, hauteur de tiroir) ; (2) Nelson envoie une capture de `/admin` à 2560 et 1440 ; (3) la mesure se fait **sur l'image**, avant et après. Un chantier de densité sans les deux captures n'a pas de mesure, donc pas de résultat.
- ✅ **A11y résiduel : FAIT** — SectionCatalog (4 champs `aria-label` : catalogue/slug/description/WhatsApp), POSModals sélecteur pays devenu vrai `role="listbox"` (+ `role="group"` par région, `role="option"`+`aria-selected` sur `CountryItem`), Stock vue grille en `role="list"`/`role="listitem"` (via props A11y additives de `ResponsiveGrid`).

## Comptes démo

⚠️ **`demo-tenant-001` et `demo-tenant-002` portent `isDemo = true`** depuis 2026-07-22 : toute action à coût externe ou destructive y est refusée côté serveur (403 `DEMO_TENANT_FORBIDDEN`, cf. § Garde de dépense). Le mot de passe démo est PUBLIC — c'est ce flag qui protège, pas la discrétion.

`demo1234` — `admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com`, tenant principal `demo-tenant-001` (« HabaShop — Dakar Central »). 5 employés (`demo-emp-${name}`). Données hors seed : `requireCashier=false`, `ownerPhone='+221771234567'`. Si reseed → repasser `requireCashier=false`.

⚠️ **`demo-tenant-001` est en XOF depuis le 2026-08-06 — corrigé, plus rien à faire.** Il portait `EUR`, et ce n'était **pas** un bug de seed : `prisma/seed.ts:34` **et** `prisma/fix-demo001.ts:50` posent tous deux `XOF` ; le tenant est créé le 16/06 et modifié le **26/07**, six semaines plus tard — l'EUR venait d'un `PATCH /api/tenant` manuel. Une boutique nommée « Dakar Central » s'affichait en € pendant que la vitrine promet le Franc CFA, et **les deux fixtures E2E écrivaient déjà `currency:'XOF'`** (`e2e/customers-uiux.shot.mjs:28`, `e2e/__ops.mjs:22`) : la production était seule à diverger. Mutation appliquée sur validation explicite de Nelson, **un seul champ** (diff de l'instantané complet : `currency` + `updatedAt` automatique, rien d'autre) ; **aucun montant n'a bougé** — tout est stocké en XOF de base, `tenant.currency` n'est qu'une préférence d'AFFICHAGE (§ Règles devise). Répartition **EUR 2 / XOF 2**.

⚠️ **`e2e-tenant` reste en EUR, et c'est DÉLIBÉRÉ — ne pas « harmoniser ».** En XOF (0 décimale, taux 1), convertir zéro, une ou deux fois donne le **même affichage** : tous les défauts de conversion y sont invisibles. C'est exactement la raison pour laquelle les cas dorés de paie doublent chaque cas XOF d'un cas EUR (§ Paie). `HabaShop Ops` est un tenant interne, pas une boutique.
⚠️ **LES DÉMOS RESTENT OUEST-AFRICAINES — décision du 2026-08-06, ne pas « aligner » sur le marché par défaut.** Mesuré avant de décider : `demo-001` est ancré au Sénégal sur **16 lignes** (tenant, 5 employés, 6 fournisseurs, 3 libellés de dépense « Senelec ») et `demo-002` à la Côte d'Ivoire sur 16 autres — dont **5 clients sénégalais dans la démo ivoirienne**, délibérés et documentés (`seed-demo.ts:78`). Les **12 produits sont neutres** (sucre, riz, huile…), l'indicatif dérive déjà de `tenant.country`, et **la TVA à 18 % est CORRECTE pour SN et CI**. Une démo sénégalaise sous un défaut produit camerounais est la meilleure preuve que le multi-pays fonctionne — la basculer coûterait un UPDATE manuel sur 16 lignes d'un tenant existant, pour un gain nul.

⚠️ **Et « re-seeder » ne ferait RIEN** : tous les `upsert` du seed ont `update: {}` (seules exceptions : `lang` sur le tenant, `role`/`name` sur les users). Le seed a d'ailleurs **déjà dérivé** — il écrit « HabaShop — Boutique Centrale » depuis la neutralisation des exemples, quand la base porte toujours « Dakar Central ». Un re-seed ne réconcilierait pas cet écart : il ne réécrit aucune ligne existante.

✅ **DONNÉES PERSONNELLES RÉELLES — TRAITÉES le 2026-08-06, et surveillées depuis.** L'unique client de `demo-001` portait un nom réel, un mobile `+336`, une adresse postale à Marseille et un e-mail personnel — **du 17/07 au 06/08, soit trois semaines** en lecture publique. Anonymisé (`Client Démo 01`, `+221 77 000 09 01`, `client01@demo.sn`, « Médina, Dakar ») ; l'abonnement qui le référençait n'a pas été orphelin. Un débris de vérification (`verif-notes-tmp`, e2e-tenant, 0 référence) a été supprimé.

⚠️ **LE TIROIR MENTAIT, ET C'EST LA LEÇON** : l'écran affichait « Aucun achat », 0 point — la base portait **1 abonnement actif**. C'est ce comptage, et lui seul, qui a fait choisir l'ANONYMISATION plutôt que la suppression (`Subscription.customerId` est non nullable : supprimer aurait violé la FK). **Compter les références avant de choisir, jamais déduire de l'écran.**

⚠️ **BALAYAGE HEBDOMADAIRE** — `runDemoPiiSweep` (lundi 9h), `lib/piiSweep.ts`. Il **RAPPORTE, il n'empêche pas** : empêcher supposerait de refuser des saisies dans une démo dont l'intérêt est qu'on puisse tout y faire. Détection **de FORME** (indicatif hors `+221/+225/+237`, domaine hors fixture), jamais par liste de pays ou de messageries. ⚠️ Le critère « absent des seeds » de l'audit initial est ABANDONNÉ : il a produit **8 faux positifs sur 12** (apostrophe échappée `N\'Guessan`, domaines `.ci` et `.test` pourtant écrits par les seeds) — *un critère qui se trompe deux fois sur trois se fait désarmer*. ⚠️ Le rapport ne reproduit **aucune valeur**, seulement identifiants et noms de champs : le recopier l'écrirait dans les logs Railway et déplacerait la fuite au lieu de la fermer. Périmètre `isDemo` UNIQUEMENT. Verrou : `piiSweep.test.ts` (11), dont le cas réel rejoué et les 8 faux positifs figés en silence.

⚠️ **QUESTION OUVERTE, non tranchée** : le mot de passe démo doit-il rester public maintenant qu'on sait que des données réelles peuvent y atterrir ? `isDemo` borne le **coût** (403 sur toute dépense externe), pas l'**exposition** : n'importe qui peut lire. Trois voies — le garder public et balayer · le fermer et distribuer à la demande · le réinitialiser périodiquement. Décision de Nelson.
**DÉCLENCHEUR DE RÉOUVERTURE : le premier prospect envoyé sur la démo.** Tant que personne n'y est dirigé, l'exposition se limite à qui trouve le dépôt ; le jour où on donne l'adresse à un client potentiel, la démo devient une vitrine et le mot de passe public un choix, plus un reliquat. ⚠️ Le balayage hebdomadaire (`runDemoPiiSweep`) réduit la fenêtre de trois semaines à sept jours — **il ne la ferme pas**, et il RAPPORTE au lieu d'empêcher.

**Multi-boutiques** : `admin@` et `manager@` sont liés à une 2ᵉ boutique `demo-tenant-002` (« Alimentation Koné — Abidjan », XOF) via `UserTenant` → login déclenche le sélecteur. `admin@` = SUPER_ADMIN/ADMIN, `manager@` = MANAGER/MANAGER. Les 3 autres restent mono-boutique.

## Env vars

**Railway** : `FRONTEND_URL` (**URL de l'app web — SOURCE UNIQUE backend**, `lib/appUrl.ts` ; déjà posée à `https://habashop.vercel.app`. Le jour d'un domaine propre, la changer ICI suffit : e-mails — logo, pied, liens login/upgrade/stock/dashboard — et redirections de paiement Campay/PayDunya suivent. Absente ⇒ repli sur l'URL vercel, comportement inchangé. ⚠️ NE PAS créer un second nom type `APP_URL` : `FRONTEND_URL` sert aussi la liste CORS. Verrou : `appUrlSource.test.ts` (8, sabotage vérifié) échoue si le littéral réapparaît dans `src/services`/`src/routes` — il ignore volontairement l'adresse factice `test@habashop.vercel.app` d'`admin.ts`. ✅ Les deux autres surfaces sont traitées : front statique via `VITE_APP_URL` (#158) et applicatif (#159), mobile via `EXPO_PUBLIC_APP_URL` (#160). **Quatre lectures, une valeur** — chaque plateforme a son environnement d'exécution, et les méta-tests verrouillent l'ÉGALITÉ des défauts), `DATABASE_URL`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`, `WAVE_WEBHOOK_SECRET`, Resend, Redis, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT` optionnel — Web Push PWA ; absents = feature inerte), `SMS_API_KEY` (+ `SMS_USERNAME` défaut `sandbox`, `SMS_SENDER_ID` optionnel — SMS Africa's Talking ; absente = feature inerte).
- MTN : `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS`
- Campay : `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS`
- PayDunya : `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS`

- Garde de dépense : `QUOTA_TRIAL_AI/OCR/WHATSAPP/WHATSAPP_MARKETING/EMAIL` · `QUOTA_ACTIVE_*` (défauts 20/15/30/**10**/20 et 200/150/300/**50**/200 ; `WHATSAPP_MARKETING` = placeholder bas) · `COST_BURST_PER_MIN` (défaut 10, `0` = désactivé) · `RATE_LIMIT_MAX` (global, défaut 300/min/IP). Tous **lus à l'appel** → ajustables sans redéploiement.

**Vercel** : **`VITE_APP_URL`** (URL publique de l'app — **miroir front de `FRONTEND_URL`** ; même valeur, deux plateformes où la poser, contrainte inhérente). Défaut garanti dans `apps/frontend/.env` (tracké). ⚠️ **Si elle manque, Vite livre le littéral `%VITE_APP_URL%`** dans `canonical`/`og:url`/JSON-LD — un canonical cassé désindexe, donc PIRE que l'URL en dur (mesuré). **Deux mécanismes, car les fichiers ne sont pas produits pareil** : `index.html` traverse Vite → substitution native `%VITE_APP_URL%` (9 balises) ; `public/` est copié **octet pour octet** → aucune substitution possible, d'où les gabarits `scripts/seo/*.tmpl` + `scripts/gen-seo.mjs` qui écrivent `dist/sitemap.xml` et `dist/robots.txt` au build (⚠️ ils ne sont donc plus servis par `vite dev` — sans effet, ils ne valent que déployés). Gardes : `npm run verify:seo-urls` inspecte le **`dist/` livré** (marqueur non substitué = échec, invisible pour tsc/tests puisque la SOURCE est correcte — c'est l'ENV de build qui manque) + méta-test `appUrlStatic.test.ts` (8, **4 sabotages**). ✅ **Les 6 liens user-facing de `src/`** (`Privacy.tsx` ×4, `PublicCatalog.tsx` ×2) passent par `src/lib/appUrl.ts` (#159) — module DISTINCT de `gen-seo.mjs`, qui tourne hors du pipeline Vite et n'a pas accès à `import.meta.env`. Verrou : bloc `src/` d'`appUrlStatic.test.ts` (3), qui interdit le retour d'un **`href`** en dur, pas toute mention du littéral (fixtures d'`Integrations.tsx`, repli `window.location.origin` de `SectionCatalog` — un verrou qui crie au loup se fait désarmer). `VITE_GOOGLE_MAPS_KEY` (.env tracké), `VITE_ENV`, `SENTRY_AUTH_TOKEN` (.env.local), `VITE_DEMO_MODE=1` (**déploiement DÉMO uniquement** — jamais en prod : sort le raccourci par rôle et `demo1234` du bundle).

**EAS (mobile)** : **`EXPO_PUBLIC_APP_URL`** (miroir mobile de `FRONTEND_URL`/`VITE_APP_URL` — URL de l'app WEB, à ne pas confondre avec `app.json` `version` qui pilote le runtime OTA et reste une piste séparée). Lue par `mobile/src/lib/appUrl.ts` ; absente = repli sur l'hôte actuel, comportement inchangé. ⚠️ **`mobile/.env` est gitignoré et n'atteint PAS le builder** : `eas.json` déclare `"environment": preview|production`, donc les variables viennent d'**EAS**. Mesuré le 2026-07-29 : `EXPO_PUBLIC_API_URL` n'est posée dans **aucun** environnement EAS — tout build/OTA tourne donc sur le repli littéral d'`api.ts`, et le `.env` local n'agit qu'en dev. Conséquence : `EXPO_PUBLIC_APP_URL` est **inerte tant que Nelson ne la pose pas** (`eas env:create --environment preview --name EXPO_PUBLIC_APP_URL`), exactement comme VAPID et SMS. ⚠️ **Expo inline `EXPO_PUBLIC_*` STATIQUEMENT au bundling** (substitution textuelle) → la variable doit apparaître en toutes lettres ; un accès calculé `process.env[clef]` ne serait jamais remplacé. D'où `normalizeAppUrl(raw)` séparé de `appUrl()` : la logique reste testable sans dépendre de ce que babel a inliné. Verrou : `mobile/src/__tests__/appUrl.test.ts` (8, **3 sabotages**) — il scanne **`src/` ET `app/`**, contrairement à `versionSource.test.ts` qui s'arrête à `src/` alors qu'un des sites vivait dans `app/(app)/(tabs)/settings.tsx`. ✅ **Ce verrou tourne en CI** depuis #163 (job `unit-tests-mobile`) ; en local, `cd mobile && npx jest`.
