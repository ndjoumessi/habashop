# HabaShop — Guide Claude Code

SaaS de gestion commerciale multi-tenant **et multi-boutiques** (boutiques/superettes, Afrique de l'Ouest). **Monorepo unique `habashop`** : web (npm workspaces `apps/*`) + `mobile/` (Expo, hors workspaces) + `legal/` (pages légales).

> ## ⚠️ ALLÉGER CE FICHIER — plafond 160 000 CARACTÈRES, et une compression a déjà coûté cinq règles
>
> **Le critère** — reste ici ce qui **change un comportement sans qu'on l'ait demandé** (le piège du pipe sur `tsc`, le contexte Docker, la garde de dépense, le jumeau, le sabotage copié, le contrôle discriminant, l'arité) ; part dans `docs/lessons/` ce qu'on **consulte une fois déjà sur le sujet** (récits d'incident, tableaux de mesure, chiffres datés).
> ⚠️ **Une règle rétrogradée vers une leçon est une règle qui ne se charge plus.** Le texte existe encore, il ne s'applique plus tout seul — c'est ainsi que 3 des 5 régressions du 2026-08-07 sont passées (compression à 149 844 conforme, **cinq règles supprimées**, dont la trace d'audit qui borne une fraude de caisse ; une revue les a rattrapées).
>
> **Vérifier un allègement, c'est vérifier ce qui a QUITTÉ ce fichier**, pas ce qui est bien arrivé à destination : différence des identifiants entre `git show <avant>:CLAUDE.md` et le fichier courant, **indépendamment des leçons**, avec un contrôle discriminant (témoin positif trouvé, témoin inexistant non signalé, chemins normalisés — `lib/x.ts` et `x` sont le même identifiant).
>
> ⚠️ **L'extraction REDISTRIBUE, elle ne réduit pas.** Mesuré le 2026-08-07 : `CLAUDE.md` **−7 722**, `docs/lessons/` **+6 584**, documentation totale **−1 138**. Le plafond mesure donc la **CONCENTRATION** — ce qui se charge à CHAQUE session — pas le coût réel : graphify indexe les deux répertoires, et une session peut se faire lire une leçon. Sortir une page n'est un gain que si elle n'est pas lue à chaque fois.
>
> ⚠️ **Si 160 000 est inatteignable sans toucher une protection : s'arrêter et le dire** — combien de caractères manquent, quelles règles il faudrait sacrifier. Un fichier conforme amputé d'une protection est un mauvais échange.
> Compter en **caractères**, pas en octets — `wc -c` en annonce 4 % de trop ici (accents, émojis).
>
> ⚠️ **Relevé de 150 000 à 160 000 le 2026-08-09, sur décision de Nelson**, parce que deux règles mesurées ne tenaient plus. Ce n'est PAS une invitation à écrire : le plafond mesure ce qui se charge à CHAQUE session, et +10 000 caractères ≈ **+3 300 jetons par démarrage**, payés à chaque fois. Le critère du tri n'a pas bougé d'un pouce.
>
> ✅ **Ce plafond est APPLIQUÉ depuis le 2026-08-09** — `apps/frontend/src/tests/claudeMdPlafond.test.ts` (4, 3 sabotages), en CI comme le reste de la suite front (`ci.yml` n'a aucun filtre de chemin : un commit qui ne touche que ce fichier la déclenche). La règle existait depuis des mois et **rien ne l'appliquait** — un garde qu'on n'écrit pas est un vœu, exactement comme `sanitizeCsv` en `const` locale avant #173. ⚠️ **Le nombre est écrit DEUX fois, ici et dans le test, et c'est voulu** : le relever exige deux éditions visibles dans le même diff (forme du cliquet de lint). Un plafond DÉRIVÉ de ce fichier serait sans valeur — le commit qui déborde relèverait la limite du même geste. ⚠️ Le garde ne juge **que ce fichier**, pas `docs/lessons/` : il mesure la CONCENTRATION, cf. ci-dessus.

## Stack

- **Frontend** (`apps/frontend`) : React 18 + TS + Vite 8 + vitest 4, Zustand (persisté localStorage), React Router 7 (API déclarative classique — BrowserRouter/Routes/Route + hooks ; migré depuis 6.30 pour les CVE open-redirect, quasi drop-in), Lucide, recharts, jsbarcode (EAN-13/EAN-8/UPC-A), @zxing (scan), qrcode+html2canvas (fidélité), jspdf (étiquettes thermiques, **import dynamique**), cmdk (GlobalSearch), Playwright E2E, Sentry (org **haba-76** / projet **habashop-web**), PWA vite-plugin-pwa 1.x. Chunks `charts`/`barcode`/`canvas`/`pdf` EXCLUS du precache (runtime CacheFirst `lazy-chunks-cache`) — préserver si on touche `vite.config.ts`. ⚠️ **Cache SW = premier match gagne** (`workbox-routing/Router.js` `findMatchingRoute`) : une règle enregistrée après une règle plus large est **MORTE**. C'est arrivé — `products-cache` (SWR 7 j) n'a **jamais tourné en prod**, occultée par la règle `/api/`, alors que tout lecteur de la config y lisait la politique de cache du catalogue POS (supprimée ; SWR servirait un prix périmé même en ligne et rapide, or pour un prix de caisse la fraîcheur en ligne prime — `NetworkFirst` n'y retombe qu'au-delà du délai réseau). La règle API matche désormais le **chemin `/api/`, pas l'hôte** (l'hôte en dur mourait en silence si l'API déménageait — cf. `.env.production`). Garde CI : `npm run verify:sw-routes --workspace=apps/frontend` inspecte le **`dist/sw.js` livré** et échoue si une règle est inatteignable ou si une URL tombe sur le mauvais cache (invisible pour tsc/tests/revue : la source est valide, c'est l'ORDRE dans l'artefact qui tue). Vérifié dans les deux sens.
- **Backend** (`apps/backend`) : Fastify 5 + Prisma + PostgreSQL (Railway), bcryptjs + JWT, Resend, pdfkit, twilio, `@anthropic-ai/sdk ^0.96.0` (OCR Vision), `@fastify/multipart`, `@fastify/rate-limit` (**global**), **validation déclarative zod** (`fastify-type-provider-zod`, `validatorCompiler` global — cf. § Sécurité).
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, **base XOF**), multi-langues (fr/en/es/it).

## Structure du repo (monorepo)

Un seul repo `ndjoumessi/habashop` depuis juillet 2026 — fusion de `habashop-mobile` et `habashop-legal` via `git subtree` (historique préservé) :

- `apps/frontend`, `apps/backend` → **web** (workspaces racine `apps/*` + `packages/*`).
- `mobile/` → **app Expo** (ex-`habashop-mobile`). **Hors workspaces npm** : `package.json` + `package-lock.json` propres → `npm ci` à lancer *dans* `mobile/`. Builds/OTA EAS depuis `mobile/` (`cd mobile && eas update --branch preview`). Projet EAS inchangé (`projectId e7399d7a-…`, canal `preview`).
  ⚠️ **AVANT de toucher `mobile/`, lire `mobile/CLAUDE.md`** (+ `mobile/AGENTS.md`) : il porte les contraintes de plateforme, invisibles depuis ce fichier — version du SDK, crash natif sur modales empilées, fichiers à ne pas supprimer, polices non livrables par OTA, frontière `app/` ↔ `src/lib/`. **Elles ne sont PAS recopiées ici** : deux copies divergent, et c'est la copie lue en premier qui se périme.
  ⚠️ **Ce qui se décide en dehors de `mobile/` est ici** : le **seul** build store est en runtime **1.2.0**, **AUCUNE installation réelle n'existe** (1 seul `PushToken` en prod, l'appareil de test), le canal `production` n'est lié à **aucune** branche, et `main` a franchi des ruptures **natives** qu'une OTA ne porte pas. Une OTA vers l'appareil de TEST passe par un swap temporaire d'`app.json` — ⚠️ **ne PAS transposer à la prod**.
- `docs/modules.md` → **la référence par module** (Produits, Codes-barres, Étiquettes, Abonnements, Facture PDF, Audit, Multi-boutiques, Admin plateforme, RH…) : endpoints, schémas, composants, verrous — **à ouvrir dès qu'on touche l'un d'eux** ; ce fichier n'en garde que les règles transverses (§ Modules — index).
- `docs/HabaShop_CDC_v4.md` → **le cahier des charges COURANT** (Markdown, versionné). Chaque capacité y porte son état RÉEL — ✅ atteignable · ⚠️ livré mais inerte · 🧪 bac à sable · ⬜ absent. ⚠️ Le `.docx` v3 est **périmé et faux**, ne pas s'y référer.
- `docs/lessons/` → **le POURQUOI des chantiers clos** (raisonnement intégral, mesures, tentatives ratées). Ces pages ne sont PAS de l'archive : citées 📖 depuis la règle correspondante, elles **sont à lire avant de retoucher la surface concernée**.
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
npm run lint --workspaces                    # eslint front+back (⚠️ LES DEUX sont des cliquets, cf. § CI)
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

Le geste manuel **double le déploiement** et **brûle le quota Vercel** (free-tier = 100 déploiements/jour) : mesuré, la prod servait déjà la version neuve pendant qu'un `railway up --ci` « pour forcer » était encore en build.

Repli d'URGENCE seulement, si l'auto-deploy est *démontré* cassé (pas supposé lent) : `railway up --ci` depuis la racine · `vercel --prod --yes` depuis la **racine** (jamais `apps/frontend` → path doublé = échec).

**Déploiement couplé** : le push `main` déclenche les deux auto-deploys. Si le backend introduit une rupture d'API, l'ordre n'est pas garanti — vérifier que le back sert bien la version neuve **avant** de conclure que le front est bon.

⚠️ **Une PR crée une preview Vercel PAR CONCEPTION** (un force-push en coûte une de plus) ; une branche sans PR n'en crée aucune. **Ce n'est pas un réglage cassé** — ne plus chercher à le « réparer », et ne pas supprimer les previews : chaque build de PR prouve que le front **compile**, signal que la CI unitaire ne donne pas.

📖 *Modèle de déploiement mesuré (12 déploiements, 5 merges, 5 PR), l'inférence « prod = manuelle » corrigée, et les incidents CI : `docs/lessons/deploiement-et-ci.md`.*

**Rituel commit** : `npx tsc --noEmit` (0) → `npm test` (verts) → `npm run build` (OK) **dans les DEUX workspaces** → commit/push `main`. Git : push direct sur `main`, pas de feature branch.

⚠️ **`tsc --noEmit` NE SUFFIT PAS à valider le backend — c'est `npm run build --workspace=apps/backend` qui décide du déploiement.** Le contexte Docker est `apps/backend` SEUL (`COPY src`+`scripts`+`prisma`+`package*.json`+`tsconfig.json`) : `docs/` n'y est PAS, et l'image lance `tsc` sur tout `src/`, **tests compris**. Un `import x from '../../../../docs/shared-fixtures/….json'` compile donc en local — où le monorepo entier est présent — puis casse le déploiement Railway en **TS2307**, invisible pour tsc local, la suite ET la revue (la source est valide, c'est le CONTEXTE qui diffère). Vécu (prod figée 20 min). **Toute fixture partagée se lit à l'EXÉCUTION** — `readFileSync(join(__dirname, '..', …))` — jamais par `import` : un chemin runtime n'est pas résolu par tsc, donc le build passe et le test ne s'exécute simplement pas dans l'image. C'était déjà la convention des 7 autres jumeaux (`csvInjection`, `payrollNetShared`, `barcodeShared`…), elle n'était juste écrite nulle part. Verrou : **`dockerContextImports.test.ts`** (back) échoue si un fichier de `src/` importe statiquement hors d'`apps/backend` — la frontière gardée est le CONTEXTE DE BUILD, pas un répertoire particulier. ⚠️ Ce méta-test s'est épinglé lui-même au premier tir (sa contre-preuve écrivait le motif en toutes lettres) : un scanneur doit survivre à son propre scan. Même famille que le smoke de version — **un test unitaire ne voit pas une régression d'ENVIRONNEMENT**.

⚠️ **Et `$?` après un pipe n'est PAS celui de `tsc`.** `npx tsc --noEmit 2>&1 | tail -20` rend le statut de `tail`, donc **0** alors que tsc sort en 2 : mesuré le 2026-08-05, deux erreurs de type affichées sous un « exit=0 ». Annoncer « tsc 0 » depuis une commande pipée ne prouve rien — lancer sans pipe, ou lire `${PIPESTATUS[0]}`. ⚠️ Depuis la RACINE, `npx tsc --noEmit` ne vérifie **rien du tout** (aucun `tsconfig.json` racine) : il imprime son aide et sort en 1. Toujours depuis le workspace concerné.

**CI** (`.github/workflows/ci.yml`, Node 22) : tsc + **lint** + tests unitaires sur les deux workspaces, build front avec **garde de taille de bundle < 100 Ko gz** (`index-*.js`), scan de secrets en dur ; sur `main` uniquement : tests d'intégration (lecture seule contre la PROD) et E2E Playwright. ⚠️ **Les DEUX lints sont des CLIQUETS** (`--max-warnings`, back ET front) : le plafond vaut l'état actuel, donc tout NOUVEL avertissement casse la CI. ⚠️ **Les deux nombres se lisent dans `apps/{backend,frontend}/package.json`, JAMAIS ici** — ce fichier en a déjà écrit deux qui étaient faux, et une CI rouge en continu n'a pas été vue pendant six heures. Ne pas relever le plafond pour faire passer un commit : corriger, ou l'abaisser de ce qu'on a nettoyé (chaque `any` supprimé l'abaisse d'autant). ⚠️ Le cliquet **FRONT** a déjà été franchi — une `() => {}` vide dans un test ajouté — et la CI de `main` est restée rouge **6 h et 5 commits**. Corrigé **par le bas**, jamais en relevant le plafond.

⚠️ **UN CLIQUET CONTRAINT LA SOMME, PAS L'INTRODUCTION.** « Lint au cliquet » ne prouve **PAS** qu'aucun avertissement n'a été ajouté : il prouve que le TOTAL n'a pas monté. Un cliquet soldé par une coupe ailleurs cesse de mesurer ce qu'il devait mesurer, et le budget de nettoyage part sans que rien ne soit nettoyé — c'est ce qui s'est passé, deux imports morts sacrifiés pendant que la fonction vide restait.

**Règle : on retire l'avertissement QU'ON A INTRODUIT**, puis on abaisse le plafond de ce qu'on a nettoyé **par ailleurs** — jamais l'inverse, jamais en compensant. Deux colonnes séparées : la première répare, la seconde progresse.

### ⚠️ L'ALARME QUI NE PEUT PAS SONNER — et qui se déclare VERTE

Ce n'est pas le cliquet franchi qui compte, c'est que l'échec soit **passé inaperçu 6 h et 5 commits** : le job `notify-failure` sortait en `exit 0` quand le secret de webhook était absent — et le dépôt n'a **AUCUN secret**. La page du run affichait donc une **coche VERTE** à côté de « Notify on failure », sur un run rouge où personne n'avait été prévenu.

**Règle générale : un garde qui ne peut pas échouer n'est pas un garde.** Tout `exit 0`, `|| true` ou `continue-on-error` sur l'ABSENCE d'une configuration doit soit échouer, soit émettre un `::error::`/`::warning::` — jamais réussir en silence. Et cela vaut d'abord pour les gardes qui surveillent les autres gardes : c'est là que le vert coûte le plus cher.

⚠️ **Un fail-open non tracé rend l'absence de canal indistinguable d'une alerte envoyée.** Même piège sur le transport : sans `--fail-with-body`, un `curl` vers un webhook **révoqué** sort en 0 sur un 404. Et toute métadonnée interpolée dans un `run:` passe par `env:` + `jq` — une branche portant un guillemet casse le JSON ou s'y injecte.

⚠️ **Le motif ne se répète PAS ailleurs — vérifié, pas supposé.** Les deux `continue-on-error: true` (npm audit) sont **délibérés, nommés « non bloquant », et l'étape reste visiblement en échec**. Ne pas les « corriger » par analogie. 📖 *`docs/lessons/deploiement-et-ci.md`.*

### ⚠️ CI ROUGE ≠ CODE FAUTIF — lire l'exécution AVANT d'accuser le dépôt

Deux causes **indépendantes** peuvent se superposer sur une série de runs rouges — notre code, et une panne de la plateforme. Les confondre a produit deux diagnostics faux d'affilée.

**Le discriminant est `steps.length`, pas la conclusion.** Un job `cancelled` avec **zéro étape** n'a rien jugé : il n'a jamais démarré (aucun runner obtenu ; l'annulation tombe à **15 min pile**). Un job dont les étapes ont TOURNÉ accuse bien le code.

**L'ordre des vérifications** : (1) le run a-t-il exécuté des étapes ? (2) les workflows sont-ils `active` ? (3) githubstatus. ⚠️ **La facturation vient en DERNIER, et seulement sur un dépôt privé** — celui-ci est **PUBLIC**, donc les minutes runner y sont gratuites et illimitées : la piste « minutes épuisées » y est structurellement impossible, et elle a été proposée une fois sans vérifier une seule ligne de `gh api`. Une hypothèse qui envoie chercher dans la facturation coûte le temps de quelqu'un d'autre.

```bash
gh api repos/<o>/<r>/actions/runs/<id>/jobs \
  -q '.jobs[] | "\(.name) \(.conclusion) étapes=\(.steps|length)"'
gh api /repos/<o>/<r>/actions/workflows -q '.workflows[].state'   # active ≠ désactivé
curl -s https://www.githubstatus.com/api/v2/summary.json | jq '.components[]|select(.name=="Actions")'
```

📖 *Incident du 2026-08-06 et concordance des symptômes : `docs/lessons/deploiement-et-ci.md`.*

⚠️ **Pendant une panne Actions, repousser ne sert à rien** — aucun run n'est créé, et un `git push` de plus n'en déclenche pas. Attendre la résolution, puis **relancer les étapes manquées en local et RENDRE le résultat** (§ ci-dessous), plutôt que de supposer qu'elles passent. ✅ **`mobile/` est COUVERT** depuis #163 par un job dédié `unit-tests-mobile` (`tsc` + la suite jest) : `mobile/` ayant son propre lockfile, il fait son `npm ci` **dans** `mobile/` (`cache-dependency-path: mobile/package-lock.json`), il n'est PAS servi par le `npm ci` racine. ⚠️ **AUCUN filtre de chemin, délibérément** : restreindre à `mobile/**` rouvrirait le trou qu'on ferme — une fixture partagée vit dans `docs/`, pas dans `mobile/`, et ne déclencherait donc pas le job. MESURÉ : install à froid **28 s**, suite **5 s**.

### ⚠️ Vérification en PROD — trois formes autorisées, pas une de plus

**Un correctif de dépense ne se valide pas en dépensant.** La preuve en production se fait **UNIQUEMENT** par :
- **(a) lecture seule** — `GET`, requête Prisma `findMany`/`findUnique`, `curl` sur une route non mutante ;
- **(b) assertion sur la DÉCISION du garde, SDK mocké** — `expect(messages.create).not.toHaveBeenCalled()` ; c'est un test, pas un appel réseau ;
- **(c) tenant JETABLE** créé pour la vérification puis **détruit** (cf. le motif `verif-guard-tmp` : écriture directe en base, aucun e-mail émis, suppression immédiate + état final vérifié).

**JAMAIS** : muter l'état d'un tenant existant (`PATCH` sur `ownerPhone`, `enableAutoWhatsApp`, `status`…), ni déclencher un envoi/appel réel (Twilio, Anthropic, Resend) pour « prouver que ça marche ».

⚠️ Les deux incidents qui ont produit cette règle sont réels : un « contrôle positif » a **réellement expédié** un WhatsApp facturé — l'endpoint choisi pour prouver qu'un garde laisse passer était un endpoint qui envoie — et un `PATCH` exploratoire a modifié la config d'une boutique. 📖 *`docs/lessons/deploiement-et-ci.md`.*

**Corollaire — le smoke de version ne prouve pas un déploiement.** `npm run smoke:version` compare la version, donc reste **vert quand le déploiement n'a pas eu lieu** si la version n'a pas bougé (vu 2 fois). Preuve réelle = **`uptime` de `/api/health-extended` remis à zéro** (poller jusqu'à ce qu'il redescende), ou une réponse dont le contenu a changé.

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
- **Login** (`pages/LoginPage.tsx`) — refonte 2026-07 : **formulaire héros**, 100 % tokens `var(--)` (le dégradé `#0F0A2E` en dur a sauté → le thème Clair fonctionne), volet gauche = accroche + aperçu POS + capacités factuelles, CTA unique **désactivé PENDANT L'ENVOI SEULEMENT** (jamais par la validation : au clic à vide on NOMME les champs manquants et on donne le focus au premier — cf. `landingClaims.test.ts`), erreur INLINE (`role=status` + `aria-live`) avec focus rendu à l'e-mail, version issue de `__APP_VERSION__`. Sélecteurs stables **`data-testid="login-email/login-password/login-submit"`** — E2E en dépend. Lien « ← Retour à l'accueil » + logo cliquable → `/`. ⚠️ **RETIRÉS et à ne pas réintroduire** : « Déployé dans 150+ pays » (faux), badges SSL/TLS (page + pied), liste de fonctionnalités génériques. `login.anchor.test.tsx` fige leur ABSENCE.
- **Raccourci démo par rôle — ⚠️ LE WEB ET LE MOBILE NE GARANTISSENT PAS LA MÊME CHOSE.** Web : le chunk est **absent** du `dist/` (Rollup l'élimine, `verify:demo-flag` le prouve sur l'artefact). Mobile (`src/lib/demoAccounts.ts`, drapeau `EXPO_PUBLIC_DEMO_MODE`, gaté depuis le 2026-08-09 — il ne l'était **pas du tout** avant, les 5 boutons partaient dans chaque build store) : le drapeau **masque à l'exécution**, il **ne retire RIEN de l'artefact**. MESURÉ par deux `expo export`, drapeau absent puis `1` : le nom de la variable disparaît et les deux `.hbc` DIFFÈRENT bien de 2 octets (la substitution atteint l'artefact), mais `demo1234`, `admin@habashop.com` et les libellés sont présents **dans les deux** — **Metro n'élimine pas la branche morte comme Rollup**. Ne pas transposer la garantie web au mobile. Verrou : `mobile/src/__tests__/demoAccounts.test.ts` (4, 3 sabotages), défaut ÉTEINT.
- **Raccourci démo, côté WEB** : vit dans `components/login/DemoRoleLogin.tsx`, rendu **UNIQUEMENT** si `VITE_DEMO_MODE === '1'`. ⚠️ Le `import()` doit rester DANS la branche (`DEMO_MODE ? lazy(…) : null`) : un `lazy(() => import(…))` inconditionnel laisse Rollup émettre le chunk et **livre `demo1234` en prod**. Garde : `npm run verify:demo-flag --workspace=apps/frontend` grep le `dist/` livré — à valider dans les DEUX sens (prod = absent, `VITE_DEMO_MODE=1` = présent, sinon le grep ne prouve rien). Ceci n'est PAS la sécurité (cf. § Garde de dépense).
- **Landing hero** (`components/landing/LandingHero.tsx`) : **split 2 colonnes** (texte / carte aperçu produit), **100 % tokens CSS** (`var(--…)` + `color-mix`, theme-aware) — pas la palette `D` hex. H1 unique, mot d'accent en `--p2`. `< 900px` → colonne unique. `LandingNav` masque « Connexion » `< 640px` (`.lp-nav-login`).
- **Graisses** : `--fw-regular/--fw-semibold/--fw-bold` uniquement. Exclusions : PDF, SVG Maps, `.public-scope`.
- **Toasts** : sans emoji. Mutations clés → `announce(msg)` (`@/lib/announce`) + `toast.success`.
- **Modales** : `useModalFocus<HTMLDivElement>()` + `ref` sur `.modal-box` + `role="dialog"`/`aria-modal`/`aria-label`. ⚠️ `aria-grabbed`/`aria-dropeffect` = dépréciés.
- **Pills de statut** : tokens `--c-{green,orange,blue,red,amber}-bg/-border`, `--r-full`, 12px semibold.
- **Logs** : `logger.log/warn` (`@/lib/logger`, filtre DEV) — pas de `console.*` en commit.
- **Aucune soumission n'avale une erreur serveur** ⚠️ : `xxxApi.update(...).catch(() => {})` après une mise à jour optimiste du store ET un toast de succès = l'écran affirme un enregistrement qui n'existe pas. Mesuré : **7 sites**, dont l'Onboarding qui perdait nom + téléphone + adresse + pays + TVA d'un seul PATCH refusé, écran de succès par-dessus. Passer par **`saved(promesse, quoi)`** (`lib/saved.ts`) : il RAPPORTE (message du serveur préféré au nôtre) et rend un booléen — **la décision reste à l'appelant** (bloquer, revenir en arrière, continuer). Verrou : `noSwallowedSaveError.test.ts`, périmètre **DÉRIVÉ** de `src/`, contre-preuve dans les deux sens. ⚠️ Il a trouvé un 3ᵉ site dans un fichier que mon balayage manuel avait cru épuisé.
- **Éditions masse multi-octets/emoji** : script Python ou tsx, pas `sed`.
- **Édition scriptée d'un fichier** ⚠️ : tout `replace()` doit **asserter que l'ancre existe** (`assert s.count(old) == 1`). Sans ça, une ancre inexacte fait un **no-op silencieux** — le script affiche « ✓ » et rien n'a changé. C'est ainsi qu'un compteur est resté faux pendant 4 PR.
- **Sabotage d'un verrou** ⚠️ — **passe par le script, il n'y a plus de procédure à retenir** :
  ```bash
  npm run sabotage -- <fichier…>    # instantané HORS du dépôt, puis on casse librement
  npm run sabotage:status           # y a-t-il un sabotage en cours ? (code de sortie non nul)
  npm run sabotage:restore          # restaure DEPUIS LA COPIE + vérifie octet par octet
  ```
  Ce qui suit n'est plus une consigne, c'est l'**explication** du script. `git checkout <f>` restaure depuis HEAD : pendant la vérification d'un verrou le correctif n'est PAS commité, donc il est **effacé**. L'instantané vit dans `os.tmpdir()` — invisible pour `git status`, incommitable, et hors d'atteinte d'un `checkout`. Un second instantané est **refusé** (un sabotage interrompu dont on restaurerait la copie plus tard écraserait du travail plus récent). La restauration **vérifie et le DIT** : une restauration silencieuse est une restauration non prouvée.
  ⚠️ **Pourquoi un script plutôt qu'une règle** : le piège était déjà écrit **deux fois** ici, et il a été commis **trois fois dans la même session par l'auteur de ces avertissements**. **Quand une règle documentée est violée trois fois par le même acteur, ce n'est plus la règle qu'il faut corriger.** Verrou : `sabotageScript.test.ts` — vrai script, vrais fichiers, octets comparés, cas « instantané déjà présent » exercé.
- **Specs prescriptives** : si instruction ≠ code réel → réconcilie et continue. Questions réservées aux choix irréversibles.
- **Refactor transverse** ⚠️ : unifier N points d'appel dans un module unique fait perdre ce que chaque appelant distinguait, si le module ne remonte pas TOUTE leur information (statuts, codes d'erreur, détail par élément). **Un goulot ne doit pas être un entonnoir.** Corollaire éprouvé : **une surface à la fois, revue entre chaque.**
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
  - ⚠️ **Le tir sur inactivité n'utilise QUE la vitesse** (`looksLikeScannerBurst`), **jamais** `looksLikeScannedInput`. **MESURÉ sur 10 000 EAN-13 : 10,0 % ont un préfixe de 12 caractères qui est un UPC-A VALIDE**, et la collision tombe *exactement* à 12 — restreindre à « ≥ 12 car » ne servirait à rien. Un caissier qui RECOPIE marque des pauses : s'il s'arrête au 12ᵉ chiffre, la voie forme validerait le code **partiel** et ajouterait **un AUTRE produit** au panier — erreur d'ARGENT, silencieuse, une fois sur dix. **Ne pas « simplifier » les deux prédicats en un seul.**
  - **La recopie manuelle reste servie par ENTRÉE**, où la saisie est finie *par construction* — c'est l'appui qui dit « j'ai fini », pas une horloge. Délibéré.
  - **Deux gardes REDONDANTES** annulent le minuteur après Entrée (`onKeyDown` + `resetTyping`) : retirer une seule des deux laisse la suite **verte** (vérifié) — ceinture et bretelles sur un double-ajout au panier.
  - Verrous : `wedgeScan.test.ts` (25, invariant PUR) + **`pos-wedge-wiring.test.tsx`** (10, **câblage** — monte le VRAI `POS.tsx` avec faux timers ; 3 sabotages). ⚠️ L'invariant pur ne peut RIEN dire du câblage (minuteur posé/annulé) : il faut les deux. **Limite assumée** : la saisie exige le focus du champ — une capture clavier au niveau `document` volerait les touches aux autres champs et modales.
- **Intégrité prix — SERVEUR-autoritaire** ⚠️ (`sales.ts`) 📖 *raisonnement complet, expositions mesurées et justification des bornes : `docs/lessons/integrite-prix-pos.md`* :
  - Le prix soumis n'est facturé **QUE** s'il correspond au tarif **DÉCLARÉ par la ligne** (`items[].clientType` ∈ `retail|semi|wholesale`, résolu palier+promo à la qté par `expectedPrice`). Sinon = **divergence** → on facture le prix serveur de ce tarif. Défaut rétro-compatible `retail`. Accepter « un tarif quelconque » **n'est pas** vérifier un prix (c'était l'ancien `legitimatePrices`, qui laissait un client détail payer le tarif de gros en silence).
  - ⚠️ **Le tarif est porté par la LIGNE, pas par la vente** — un panier monté en Détail puis basculé en Grossiste garde légitimement ses prix détail. `toSaleItemPayload(cart)` (`saleReconcile.ts`) **ne reçoit pas** le tarif sélectionné : l'erreur est rendue inécrivable, ne pas « réparer » cette signature.
  - **Produit inconnu du catalogue → 400 `UNKNOWN_PRODUCT`** (sans prix serveur, rien à comparer). Total = **Σ lignes serveur** − remise − fidélité, **TVA serveur** (`tenant.vatRate` + `posVatIncluded`). La déviation légitime (abîmé/négo) passe par la **remise manuelle**, déjà tracée : le panier n'offre AUCUN champ d'édition de prix de ligne.
  - **REJEU HORS-LIGNE HONORÉ (option A, voie 1)** ⚠️ : `honored = offlineReplay && staleCatalogAt !== null` — **DEUX conditions cumulatives**, et l'ORDRE du bloc est load-bearing (la qualification se calcule AVANT la décision ; l'inverse honorerait sur le seul drapeau — `tsc` le refuse, TS2448). `offlineReplay` est posé **UNIQUEMENT** par la file mobile (`saleReplay.ts`). ⚠️ **Ne pas ré-adosser un honneur à une horloge client** — `clientCreatedAt`/`REPLAY_THRESHOLD_MS`/`honorClientPrice` sont SUPPRIMÉS (ils honoraient n'importe quel prix sur un horodatage antidaté) ; `salesPriceIntegrity.test.ts` échoue si on le refait.
  - **Le drapeau est FALSIFIABLE — vecteur assumé et BORNÉ** : un caissier forgeant `offlineReplay:true` ne peut faire passer qu'un prix qui **était réellement celui de son tarif DÉCLARÉ il y a moins de 48 h**. Il ne peut pas inventer un montant : le gain maximal est le delta d'un vrai changement de prix récent, sur les seuls produits concernés. Aucun signal non falsifiable de « c'était hors-ligne » n'existe (`idempotencyKey` ne porte pas le temps, l'horloge client n'est jamais transmise, un jeton pré-signé serait rejouable). La protection est donc le **CADRE** (`staleCatalogAt`, fait serveur) **+ la TRACE** : toute divergence écrit `submittedPrice`/`catalogPrice`/`staleCatalogAt` + `SaleItem.pricingHonored` + `Sale.priceDivergence=true` (audit a posteriori, `GET /api/sales?priceDivergence=true`). ⚠️ **« Posé uniquement par la file mobile » n'est PAS une garantie de provenance** — c'est une description de l'écrivain légitime, pas une preuve. Retirer les écritures d'audit au motif que le drapeau serait fiable est le geste que cette ligne existe pour empêcher.
  - **BORNES, et ce qui se passe dehors** : fenêtre **48 h** (2× le TTL du cache SW), **profondeur 1**. Hors bornes — ou tarif non qualifié, ou vente mixte partiellement qualifiée — le serveur **re-tarife** et le mobile écrit une entrée durable **`repriced`** (« à vérifier »), **distincte de `rejected`** (« à ressaisir ») : la vente EXISTE, la confondre la ferait compter deux fois. **Jamais un honneur par défaut.**
  - **Qualification « tarif précédent »** : `Product.previousPricing` + `pricingChangedAt` instantanéisent le jeu de tarifs sortant à chaque écriture qui change RÉELLEMENT un prix ; `SaleItem.staleCatalogAt` porte la qualification (**deux conditions cumulatives** : appartenance au tarif déclaré ET fenêtre 48 h). Profondeur 1 ⇒ non concluant = `null`, **jamais une affirmation d'innocence**. **N'influence RIEN de ce qui est facturé**, serveur-autoritaire (colonnes hors de `PRODUCT_UPDATE`). ⚠️ **Toute nouvelle colonne de prix sur `Product` DOIT être ajoutée à `PRICING_FIELDS`** (`utils/pricing.ts`), sinon un changement cesse d'être instantanéisé.
  - **UI d'audit** (ADMIN seul, `canAuditPrices`) : **une source unique `priceGapLevel(rows)`** alimente badge + détail + sous-filtres → **QUATRE** niveaux par ordre de PRUDENCE — `look` ambre · **`honored` ambre « à vérifier »** · `previous` bleu · `offline` gris. ⚠️ **`honored` ne doit JAMAIS retomber dans le bleu** : là-bas le serveur a corrigé, donc l'argent est juste et le bleu se lit « fait établi » ; ici **l'argent a bougé** — il y a une caisse à vérifier. **Biais de PRUDENCE** : une vente mêlant expliqué et inexpliqué reste `look`. ⚠️ **Le filtre « Écarts honorés » est résolu CÔTÉ SERVEUR** (`GET /api/sales?pricingHonored=true`) — côté client on ne verrait que la page de 50 ventes, et un écart de quelques jours deviendrait **introuvable**. Vocabulaire **factuel** — « écart de prix », jamais « suspect »/« fraude ».
  - Verrous : `salesTariffIntention` · `salesPriceIntegrity` · `staleCatalogDivergence` · `offlineReplayHonor` · mobile `saleReplay` · front `cartTariff` / `saleReconcile` / `priceGapLevel` — comptes et sabotages détaillés dans la leçon.
- **Réconciliation du total encaissé** ⚠️ (Chantier B (c)) : `confirmSale` **capture** la réponse de `POST /api/sales` (elle était JETÉE). Le serveur étant autoritaire sur le prix, une re-tarification facture un autre montant que celui encaissé → **caisse courte sans cause explicable**. `reconcileSaleTotal(serverTotal, netTotal)` (`components/pos/saleReconcile.ts`, tolérance **1** comme le paiement mixte) dit au caissier **combien réclamer ou rendre** tant que le client est au comptoir (toast 15 s + `announce`).
  - `authoritativeTotal` alimente **le ticket imprimé ET le reçu WhatsApp** (les deux affichaient le total CLIENT ; le reçu WhatsApp envoyait même le BRUT). Il transite par une **`ref`** (`billedTotalRef`), pas un state, et `printTicket` garde sa **signature à zéro argument** — sinon `onPrint={printTicket}` passerait l'événement en 1er argument.
  - ⚠️ **`Number(null) === 0`** : sans filtre d'absence explicite (`readTotal`), un total serveur absent déclenchait « rendre 1 000 F » sur une vente saine et imprimait un ticket à **0**. Une absence de donnée doit rester une absence.
  - **Effet de bord utile** : une alerte sur une vente au tarif courant signale une **dérive des miroirs front/back** (TVA `computePosVat`, fidélité) — c'est un signal, pas un faux positif à museler. Verrou : `saleReconcile.test.ts` (11, sabotage vérifié). Aucun appel réseau ajouté au chemin critique. *(Prévenir AVANT l'encaissement = décision produit ouverte.)*
- **Session caisse** : `cashierIsOpen = requireCashier ? cashierOpen : !cashierForcedClosed` — sélecteur `useCashierIsOpen()` partout. `cashierForcedClosed` persisté ; `cashierOpen/Fund/Tx/CA`+`cart` exclus de partialize. `requireCashier` refetché au montage POS. Montants caisse XOF → `fmt()`. ⚠️ `onClick={() => confirmSale()}` jamais `onClick={confirmSale}` (event = JSON circulaire).

### Paiements mobiles

**MTN MoMo** (CM) `services/mtnMomo.ts` · **Campay/Orange** (CM) `services/campay.ts` — HMAC webhook **fail-closed** · **PayDunya** (SN/UEMOA) `services/paydunya.ts`. Clés : § Env vars.
📖 *Flux POS, IPN, Campay carte, `computePaymentStats` : `docs/modules.md` § Paiements mobiles.*
**⚠️ Sécurité sandbox** : `IS_SANDBOX` INTERDIT pour l'auto-approbation d'un paiement — toujours un `_SANDBOX_AUTO_SUCCESS=1` explicite. 📖 *`docs/modules.md`.*

### UI POS/fidélité/onboarding — item 11 (maquettes) ⚠️
Refonte 2026-07 fidèle aux **maquettes faisant foi** `docs/ux-mockups/0N-*.view.html`.
📖 *Mise en page livrée : `docs/SPECS_UX_pos_fidelite_onboarding.md` § « État IMPLÉMENTÉ » ·
placeholder honnête et payload d'onboarding : `docs/modules.md`.*

Les règles qu'on enfreint **sans même travailler sur ces écrans** :

- **`.pos-fullbleed`** sur le wrapper POS → neutralise padding/scroll de `.page-content`. Sans
  elle, débordement d'environ 2× le padding et **CTA coupé**.
- ⚠️ **Le « Scanner » du PANIER est le scanner de CARTE FIDÉLITÉ** (QR `HABA-CUST:`,
  `POSCustomerSelector`) — fonction **DISTINCTE** du scan produit. Ne pas confondre ni fusionner.
- **Clôture de caisse** : **espèces attendues = fond + ventes ESPÈCES**, jamais le CA tous modes.
  Écart coloré par **MAGNITUDE** via un `gapLevel` unique (écran ET rapport imprimé) : |é| ≤ 1 XOF
  vert · < max(500 XOF, 5 %) ambre · sinon rouge, **surplus comme manque**.
- ⚠️ **Rapport imprimé : TOUTE interpolation via `esc()`** — anti-XSS, `cashierName` est une
  donnée utilisateur.

### Fidélité
Backend AUTORITAIRE (plafond 50 %, `sale.total` = NET). ⚠️ Le front envoie le **BRUT** + `customerId` — **ne PAS envoyer le net** (double remise). 📖 *`docs/modules.md` § Fidélité.*

### Paie ⚠️ — bulletins PERSISTÉS, instantané GELÉ

📖 *POURQUOI intégral (les deux règles de retenues incompatibles — 150 000 imprimé contre 130 500 affiché —, les trois temps de la correction de conversion, le verrou tout négatif aveugle au « zéro fois », les cas dorés chiffrés) : `docs/lessons/paie-conversion-et-gel.md`* — **à lire AVANT** de toucher `payrollShared`, `utils/payroll.ts`, `payrollDisplay`, `PayrollGrid`, `PayrollPayslips`, `printBulletin` ou l'une des 5 surfaces d'affichage.

📖 *Modèle `Payroll`, routes, miroir des rôles, idempotence de la génération et `paidAt` serveur : `docs/modules.md` § Paie.*

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
- **Zone franc CFA** ⚠️ : un pays **UEMOA ne peut pas être en XAF**, ni un pays **CEMAC en XOF** — `lib/currencyZone.ts`, **jumeaux front/back**, cas partagés `currency-zones.json`, refus **400 `CURRENCY_ZONE_MISMATCH`** sur les **4** chemins d'écriture de tenant. ⚠️ Le `PATCH` juge le couple **EFFECTIF** (corps + base) : un corps qui ne porte que `currency` doit être confronté au pays déjà stocké — c'est par là qu'un `XAF` est arrivé sur un tenant `SN`, **sans aucune trace** (`PATCH /api/tenant` n'appelle pas `writeAudit`). ⚠️ **NE PAS dériver la zone du taux de TVA** : `GA` (CEMAC) porte 18 comme l'UEMOA — justesse empruntée. ⚠️ Une devise **hors franc CFA reste légitime partout** (`e2e-tenant` SN/EUR passe **sans exemption nommée** — *une exemption dont on n'a pas besoin est un trou*). ⚠️ **DÉRIVER, PAS REFUSER — le garde ne 400 que sur un couple que l'appelant a CONSTRUIT.** À la création, le pays HÉRITE de la boutique d'origine puis retombe sur le marché par défaut, et la devise en DÉRIVE : les formulaires n'ont pas tous de champ pays, et refuser un couple non choisi avait rendu **XOF incréable** dans le produit ET la console. Au `PATCH`, asymétrie : le **pays** qui bouge seul dérive la devise (le commerçant a déménagé, il n'a pas choisi de franc) ; la **devise** choisie seule et en conflit est refusée. ⚠️ La devise DÉRIVÉE doit rester journalisée — la trace compare toute la liste blanche, pas les champs soumis.
⚠️ **Le même geste pose la TRACE** : `PATCH /api/tenant` n'écrivait AUCUN audit — c'est ce trou qui a rendu l'écrivain du `XAF` introuvable. `TENANT_LOCALE_CHANGE` consigne **AVANT → APRÈS** (« la devise a changé » n'aurait rien permis) sur une liste blanche NOMMÉE de codes et de nombres (`currency/country/lang/vatRate`) — **aucun champ personnel**, la leçon du balayage PII. ⚠️ **LES QUATRE ROUTES SONT EXERCÉES PAR INJECTION** (`currencyZoneRoutes4.test.ts`) — le garde avait été posé sur quatre et vérifié sur UNE ; une revue a trouvé dans les non testées deux régressions **livrées en prod**. *Le sabotage S3 avait déjà enseigné qu'un invariant pur ne dit rien du câblage : la leçon n'avait été appliquée qu'à la route qu'on regardait.* Verrous : `currencyZone.test.ts` · `currencyZoneRoute.test.ts` (13, câblage ET trace) · `currencyZoneRoutes4.test.ts` — **12 sabotages**. ⚠️ Le mock de `writeAudit` **délègue au module réel** : l'attendre sans l'attraper prouverait le mock, pas le fail-open.
- **Expiration de promo** ⚠️ : helper pur **`isPromotionActive(hasPromotion, promotionEnd, now)`**, miroir back (`utils/pricing.ts`) ↔ front (`lib/pricing.ts`), cas partagés `promotion-active-cases.json`, `now` **injecté**. Échéance inclusive au jour calendaire **UTC**. ✅ **Miroir MOBILE (`posStore.ts`) ALIGNÉ et désormais ENFORCED** — `mobile/src/__tests__/promotionActiveShared.test.ts` exerce `isPromotionActive` sur les 9 cas partagés et tourne en CI depuis #163. *(Ce fichier a longtemps affirmé le miroir « PAS aligné » : c'était FAUX — il l'était, il n'était simplement pas enforced. Une dette d'exécution lue comme une dette de code.)*
- **Abonnements** : **aucun total n'est stocké** (dérivé de `product.sellPrice` → « au tarif du jour ») et **aucune colonne de fréquence** n'existe (`dayOfWeek` impose l'hebdo) — ne pas promettre en UI ce que le modèle ne porte pas.
- **Commandes** ⚠️ : **`PurchaseOrder` ne représente QUE des commandes FOURNISSEUR** — `supplierId` y est une FK obligatoire, et il n'existe ni `clientName`, ni `clientPhone`, ni colonne `type`. Les **commandes CLIENT de l'écran sont donc LOCALES et ÉPHÉMÈRES** (décision produit #171) : aucun appel serveur n'est émis pour elles. Avant, il l'était — sans `supplierId` — et se faisait refuser en **400 systématique**, dont le caissier ne voyait qu'un « Échec de la création ». Leur persistance est une **dette backend** (colonnes + zod), pas un oubli du front.
  - ⚠️ **ASYMÉTRIE écriture/lecture** : on ENVOIE `items[].product`, le serveur range en `items[].productName`. **Passer par `toOrderPayload`** — envoyer les lignes du formulaire telles quelles est exactement ce qui a cassé la création : **0 commande en base**, avec `tsc` vert parce que `create` prenait `any`.
  - **Frontière dans la frontière** : `GET /api/orders` inclut `supplier` → on reçoit la ligne Prisma **brute** (`ApiSupplier` : `categories` en CHAÎNE, `leadTime` camelCase), pas l'interface `Supplier` du front. Le `POST` ne l'inclut pas → sa réponse est plus étroite (`Omit<ApiOrder,'supplier'>`).
  - Verrous : test **JUMEAU** sur `docs/shared-fixtures/order-create-cases.json` ; plus `ordersApiTypes.test.ts` (accès fantôme = **TS2339**, comparaison hors union = **TS2367**).
- **Sidebar / permissions** : zone quotidienne épinglée + 4 groupes d'intention ; en-têtes masqués si aucune entrée `canAccess`. Pas de badge factice (seul Stock en a un, réel).

### Tests
- ⚠️ **Un compteur de tests écrit ici se périme au commit suivant** — celui du mobile a menti deux fois **dans la même journée**, et un chiffre faux dans un fichier qui fait autorité coûte plus qu'un chiffre absent : on le recopie. **Ne pas réinscrire de total ; lancer la suite.** *(Plus AUCUN total ici — la commande fait foi, elle ne se périme pas.)*
- **Front : `cd apps/frontend && npx vitest run`** (helpers purs + anchor tests + contraste AA sur les 2 thèmes concrets dark+light). Lancer **`vitest run` COMPLET** avant tout push touchant landing/login/thème (`landing.anchor.test.tsx` fige le H1 du hero). **Back : `cd apps/backend && npx vitest run`** (prisma mocké `vi.mock('../db')`, routes via `app.inject()`, mock `authenticate` via `vi.hoisted`). ⚠️ **`strict: true` COMPLET des DEUX côtés** (`apps/{backend,frontend}/tsconfig.json`) : une régression de nullité ou de typage casse tsc/CI. Côté front il a été atteint par **typage des états de formulaire** (`StockForm`/`CatForm`/`LabelConfig`/`CustomerForm`/`ContractForm`/`LeaveForm`/`DiscountForm` définis dans les modules partagés et threadés dans les props `form`/`setForm`) plutôt que par des `any` mécaniques. Filet global `src/tests/setup/mockPaidSdks.ts` (`setupFiles`) : aucun test unitaire ne parle à un SDK payant (Anthropic/Twilio/Resend) — un `vi.mock` local garde précédence. **Mobile : `cd mobile && npx jest`** (cf. § Commandes) — **en CI depuis #163** (job `unit-tests-mobile`). ⚠️ Certains tests montent une route avec un `total` DÉCOUPLÉ des lignes (ancien « trust client total ») → cassés par l'intégrité prix serveur-autoritaire ; envoyer des lignes qui somment au total voulu (cf. `loyalty.test.ts`). **Cas PARTAGÉS backend↔mobile↔frontend (anti-dérive)** via `docs/shared-fixtures/*.json` lus par les tests jumeaux des différents côtés — modifier la règle d'un côté sans l'autre fait échouer le test : `loyalty-discount-cases.json` (`computeLoyaltyDiscount` : arrondi/plafond 50 %/remise manuelle) ; `barcode-cases.json` (`normalizeBarcode`/`isValidBarcode`/`barcodeMatches`/`matchesScannedCode` — canonicalisation, recherche, résolution scan) ; `csv-injection-cases.json` (`sanitizeCsv` front↔back — cf. § Injection CSV) ; `payroll-net-cases.json` (`payrollBreakdown` front↔back — le front l'AFFICHE, le back le FIGE en base, cf. § Paie). ⚠️ Codes-barres : **méta-test** (front `barcode.test.ts`) échoue si une regex `\d{13}` locale réapparaît hors de `lib/barcode.ts` ; les 3 rendus (vignette écran + Avery + thermique) ont un test qui verrouille les **quiet zones ≥10 modules** ; PDF étiquettes non grep-ables → mocker jsbarcode/jsPDF et capturer les options (cf. `exportLabels`/`thermalLabel`/`barcodeVignette`). OCR : `vi.hoisted()` + classe constructeur. **PDF pdfkit non grep-able** (buffer binaire) → tester présence/absence de texte en **mockant pdfkit** et capturant les `.text()` (cf. `invoiceBilledTo.test.ts`). ⚠️ Route avec `schema` zod → `app.setValidatorCompiler(validatorCompiler)` avant `register` (cf. § Sécurité). Isolation cross-tenant : `tenantIsolation.test.ts` (mock Prisma tenant-aware).
- **MSISDN — UNE règle de nettoyage, DEUX politiques** ⚠️ : `lib/msisdn.ts`, **jumeaux front/back à l'identique**, cas partagés `docs/shared-fixtures/msisdn-cases.json`.
  📖 *Les deux fonctions homonymes, les 8 divergences sur 20 et les deux axes à séparer : `docs/lessons/msisdn-deux-politiques.md`* — **à lire AVANT de câbler un 3ᵉ prestataire**.
  - `normalizeMsisdn(raw, policy)` — `policy` **sans valeur par défaut** : le compilateur force chaque futur appelant à choisir (comme le `owner` de `resolveRecipient`). MTN = `international` (son bac à sable utilise des numéros ÉTRANGERS), Campay = `cm-only` (seul pays desservi). **Aplatir casse forcément un côté.**
  - ⚠️ **La politique se verrouille AU POINT D'APPEL**, pas seulement dans le module : basculer POS en `'cm-only'` laissait toute la suite VERTE et aurait tué le bac à sable MTN en silence. *Un invariant garanti sur le module ne dit rien de ce que l'appelant en demande.*
  - ⚠️ **Les DEUX routes normalisent côté SERVEUR.** MTN ne le faisait pas — **la garde du navigateur n'est pas une garde**, un appel direct à l'API passait. Refus = **400 `PHONE_INVALID`**, SDK jamais appelé, numéro absent du message (PII). Le verrou énumère les routes **NOMMÉMENT** : un 3ᵉ prestataire ne peut pas entrer en douce.
  - ⚠️ **La FORME du refus est verrouillée aussi** — corps unique `phoneInvalidBody(policy)`, message **DÉRIVÉ** de la politique : écrit à la main, un « format Cameroun attendu » survivrait à un passage en `international`. Les deux routes avaient déjà divergé dessus.
  - ⚠️ **Le texte montré au CAISSIER est DÉRIVÉ de la politique de la route réellement atteinte** (`lib/posMsisdnPolicy.ts`) — mesurée, pas supposée. Orange passe par Campay ⇒ `cm-only` ; le champ promettait « 8–15 chiffres » et acceptait un numéro sénégalais que le serveur refusait. MTN reste `international` (bac à sable suédois). *Une réserve ou un refus écrits deux fois divergent* : c'est aussi pourquoi `/login` lit `pillar1_status` **de la vitrine** au lieu de recopier sa propre réserve.
- **Tests qui FIGENT au lieu d'affirmer** ⚠️ — *le test décrit ce que le code FAIT au lieu d'affirmer ce qu'il DOIT faire*. Invisible tant que le comportement est juste ; le jour où il devient faux, **le test protège le défaut**.
  📖 *Récit de la purge (−58 cas), cas nommés et limites de la détection : `docs/lessons/tests-qui-figent.md`.*
  - **UN TEST QUI N'AFFIRME RIEN SE SUPPRIME, IL NE SE RÉPARE PAS** : le réparer invente une couverture que personne n'a demandée sur un code que personne n'a jugé prioritaire de tester. **Critère de succès d'une purge : le total DOIT baisser.**
  - ⚠️ **La signature la plus grave n'est dans aucune liste** : un cas qui ne touche la production **par aucun moyen** — ni import, ni `readFileSync`, ni `app.inject`, ni `render`. Le tort n'est pas de rater une régression, c'est que **le TITRE dissuade d'écrire le vrai test**.
  - ⚠️ **La détection a DEUX limites, à ne pas laisser croire couvertes** : un test qui importe un symbole puis assert à côté de la plaque passe au travers (le compte trouvé est un **PLANCHER**), et la signature « libellé figé » n'est pas balayable sans une heuristique qu'on n'a pas.
  - ⚠️ **On avait retiré l'EMPÊCHEMENT, pas le REPROCHE** : `ValidatedInput` posait `touched` sur tout `blur`, or les modales autofocusent leur premier champ — cliquer ailleurs reprochait un champ jamais visité. `touched` exige désormais une SAISIE réelle. ⚠️ La description initiale disait « au montage » : **MESURÉ, c'était faux** — corriger le symptôme décrit aurait manqué la cause.
  - ⚠️ **Une alerte qui crie toujours n'alerte plus quand elle devient vraie** : le bandeau « modifications non sauvegardées » s'affichait dès l'entrée en édition. Deux états distincts, comparés à un instantané pris à l'entrée.
  - **Méta-règle en place** (`landingClaims.test.ts`) : **aucun CTA de soumission désactivé par la VALIDATION**, sur tout `src/` (publiques ET authentifiées). Un bouton éteint gronde avant l'erreur, ne dit pas ce qui manque, et n'affiche **aucune infobulle au toucher** — sur mobile il n'explique rien. Exemptions NOMMÉES : requête en vol (`loading`/`saving`/`scanning`…, anti double-soumission), sélecteurs CSS `:disabled`, déclarations de type, champs de saisie, relais `disabled={disabled}`. ⚠️ La règle vise la **forme** « éteint parce qu'un CHAMP n'est pas rempli » : élargir à toute désactivation noyait le défaut sous les **capacités** indisponibles (panier vide, hors-ligne, stock épuisé), qui sont légitimes — il n'y a rien à « nommer » qui manque. Sabotages vérifiés dans les DEUX sens.
- **E2E Playwright** : live prod sur **tenant dédié `e2e-tenant`** (EUR, `requireCashier=true`, compte `e2e@habashop.com` SUPER_ADMIN mono-boutique). **Smoke : navigation par CLIC** — pas de `page.goto` après login (logout cold-start). 📖 *fixtures, `*_BASE` et validation d'un build local : `docs/modules.md` § E2E Playwright.*
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
- **Dates SAISIES** ⚠️ : jamais un `<input type="date">` nu — tout passe par `components/ui/DatePicker.tsx` (`DateField`/`MonthField`/`DateRangeField`). Le composant **conserve l'input natif** comme porteur de valeur (clavier, lecteurs d'écran, sélecteur au doigt sur mobile, et `hrContractDomain.test.ts` qui interdit la saisie libre) : on ne remplace que le CALENDRIER. Panneau en **portail** — `.modal-box` porte `overflow:hidden` et la plupart des champs vivent dans une modale. Méta-test à périmètre dérivé de `src/`.
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

**Règle : élargir le type, jamais caster.** Un `as` vers une union de littéraux n'est
acceptable que (a) pour ÉLARGIR un littéral (idiome `useState`), ou (b) immédiatement après une
garde runtime qui l'établit — et alors **la garde se cite à côté**. Balayage fait : sur 12 casts,
**un seul défaut** — un scanner naïf confond les deux formes.

⚠️ **Le type doit décrire la DONNÉE, pas le plus pauvre des formulaires qui l'écrivent.**
`Employee.type` était typé `'CDI' | 'CDD'` quand le fichier lui-même en libellait CINQ, que Prisma
porte `type String` et que le zod est `z.string().optional()`. Deux dégâts silencieux : un stage
daté n'était jamais signalé, et `endAt` était jeté hors CDD.

⚠️ **Un défaut latent se mesure au CHEMIN, pas au contenu de la table.** Ce cast n'était jamais
passé en production (aucun tenant client), mais deux écrans sur trois offraient déjà les cinq
valeurs.

⚠️ **UN CHAMP PERSISTÉ N'A PAS DE DOMAINE « ACTUEL » : il a l'union de tous ceux qu'il a eus.**
`posDefaultPayment` semblait inatteignable — « aucun écran ne l'écrit ». Faux : un sélecteur à
cinq options a vécu quatre jours en 05/2026, et `appStore` étant **persisté en localStorage**, la
valeur est devenue inatteignable **en écriture**, jamais **en lecture**. Chercher qui écrit
AUJOURD'HUI ne suffit pas — faire `git log -S` sur le champ. Repli gracieux via
`resolvePosPayMode(raw: unknown)` appelée par `merge`, et **DÉCISION PRODUIT : `'mobile'` →
`'cash'`, jamais vers un prestataire** (en désigner un inventerait la décision du commerçant, et
la disponibilité réelle dépend de la config SERVEUR). ⚠️ Domaine tenu **DISTINCT** de
`PaymentMethodId` (abonnement) — se ressemblent, diffèrent, les fondre perdrait ce que chacun
distingue.

⚠️ **Une règle réécrite dans un test ne prouve rien de ce que le code fait** : le sabotage décisif
de `posPayModeDomain.test.ts` est passé VERT au premier tir parce que le test rejouait la règle de
repli au lieu d'appeler celle du store. D'où l'extraction en fonction NOMMÉE, exercée telle quelle.

⚠️ **Un test qui NOMME le défaut le protège** : `hrmodals.anchor` figeait le DOUBLE marqueur de
champ requis en cherchant `'Nom complet *'`, et serait devenu un frein à sa correction. Il dérive
désormais (`/^Nom complet/`). Même motif que `signup.anchor` figeant « Sénégal ».

Verrous : `posPayModeDomain.test.ts` (6, 5 sabotages) · `hrContractDomain.test.ts` (11, 5
sabotages) — tous deux jugent la **FORME**, pas l'identifiant. 📖 *Balayages, tables de verdict et archéologie : `docs/lessons/domaines-de-type.md`.*

### Arité des ternaires ⚠️ — la parade est le `Record`, PAS un scanner

⚠️ **NE PAS écrire de verrou-scanner sur ce motif.** Décision prise APRÈS mesure, pas par
principe : le motif `x === 'litéral' ? A : B` est massivement CORRECT dans ce dépôt (~95 % des
chaînes sont exhaustives), et **un scanner qui crie au loup se fait désarmer**. 📖 *Balayages,
deux pièges de mesure, tables de verdict : `docs/lessons/domaines-de-type.md`.*

**La parade est le `Record<Domaine, …>`** — `tsc` échoue si une valeur est ajoutée sans être
décrite, ce que le ternaire ne peut pas faire (son `else` avale silencieusement). À poser
**uniquement là où le domaine GRANDIRA**. Quatre sont en place, tous sur des domaines de
paiement ou de statut, chacun né d'un défaut réel : un mode **MTN imprimé « Carte »** sur le
reçu remis à l'acheteur, un `pending_payment` peint en VERT « actif », un champ de base rendu
BRUT à l'écran.

- `lib/paymentMethods.ts` (jumeaux front/back, fixture `payment-methods.json`) —
  `offeredInTunnel` distingue ce qu'on **PROPOSE** de ce qu'on sait **NOMMER**.
- `mobile/src/lib/paymentLabel.ts` et son jumeau web `lib/salePaymentModes.ts`
  (fixture `sale-payment-modes.json`) · `mobile/src/lib/tenantStatus.ts`.

⚠️ **Corriger un jumeau ne ferme rien tant que la SOURCE n'existe pas** : le même domaine a
reparu **deux jours plus tard, dans le même fichier**, en deux instances symétriques — et c'est
la symétrie qui les rendait invisibles à la relecture.

⚠️ **Une valeur inconnue doit rester NEUTRE et VISIBLE** quand la colonne est un `String` sans
enum — jamais assimilée à l'état favorable.

⚠️ **JUSTESSE EMPRUNTÉE — l'enregistrer, ne pas la « corriger ».** `spendGuard.quotaLimit` mappe
cinq statuts sur deux paliers : l'expression **n'est pas fausse**, mais elle n'est juste que parce
qu'une garde **distante** refuse `suspended`/`cancelled` avant de l'atteindre — sinon une boutique
suspendue hériterait du palier PAYANT sur un chemin de dépense facturée. **Une justesse qui dépend
d'un invariant distant et que rien n'enregistre disparaît au premier réordonnancement**, sans
qu'aucune suite ne rougisse (`tsc` ne voit rien, les deux fonctions étant valides séparément).
D'où `spendGuardStatusOrder.test.ts` : il ne teste pas le plafond, il teste que **ce que
`quotaLimit` n'a pas à distinguer, quelqu'un d'autre le refuse**. Sabotage vérifié → 4 rouges.

**`lang` n'a pas besoin d'un `Record`** : la convention `i(fr,en,es,it)` existe et tient à 95 %.
⚠️ Mais **une branche correcte pour la mauvaise raison reste à écrire** — `Header.tsx` rendait le
même texte pour fr et es faute de branche espagnole, juste *par coïncidence* lexicale : la
première reformulation française aurait emporté l'espagnol.

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

⚠️ **SIX listes de pays, pas cinq.** La sixième (`Onboarding.tsx`) est un **tableau de tableaux**
que la détection par forme, qui cherchait `{ iso: … }`, n'a **PAS** vue — trouvée à l'inventaire
de l'imaginaire, pas par le scanner. **Limite assumée** : les listes sont exemptées au FICHIER,
un vrai défaut ajouté dedans passerait.

⚠️ **Deux tests figeaient le défaut d'hier** et ont rougi alors que rien n'était cassé :
`signup.anchor` exigeait « Sénégal » en dur, il lit désormais `DEFAULT_MARKET`. Un test qui
nomme le défaut au lieu de le dériver devient un frein au changement qu'il devrait garder.

⚠️ **Piège d'insertion d'import, rencontré DEUX fois dans ce chantier** : ajouter un `import`
après « la dernière ligne qui commence par `import` » le place **à l'intérieur** d'un bloc
`import {` multi-ligne → TS1003 en cascade. Ancrer sur la fin du bloc (`} from '…'`), ou
balayer après coup : `if (/^import\s/.test(l) && /^import (type )?\{\s*$/.test(lignePrécédente))`.

**Preuve de non-régression** : le basculement ne touche **AUCUN** tenant existant — vérifié sur
tenant jetable (`verif-market-tmp`, détruit, orphelins 0). ⚠️ La valeur de l'empreinte a été
perdue à une compression : elle se **RECALCULE** — hash du
`(id, country, currency, vatRate, updatedAt)` des 4 tenants, trié par id. *Une assertion dont on a supprimé le moyen de
vérification n'est plus une preuve, c'est une affirmation.*

### ⚠️ TVA — le taux se DÉRIVE du pays, il n'a pas de valeur par défaut

**Il n'existait AUCUN mapping pays → TVA** : le taux venait du `vatRate Float @default(18)` de Prisma — le taux **UEMOA** — qu'aucun des trois chemins de création de tenant n'écrivait, si bien que **toute inscription camerounaise recevait 18 % au lieu de 19,25 %**, en silence, sur des factures.

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

⚠️ **Table volontairement INCOMPLÈTE — 12 pays sur les 32 de `SUPPORTED_COUNTRIES`** (recomptés, pas recopiés : clés de `rates` dans la fixture, codes de `lib/country.ts`). On
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

✅ **ALIGNÉ le 2026-08-09, sur décision de Nelson** — le seul écart était le tenant **FR à 18 %**
(la France est à 20), valeur héritée de l'ancien `@default(18)`. ⚠️ **C'est `HabaShop Ops`, le
tenant `isPlatform` INTERNE** — pas un commerçant : 0 vente, 0 produit, 0 client. La correction est
donc sans effet fonctionnel ; elle aligne la base sur `lib/vatRate.ts`, rien de plus.
`prisma/align-tenant-vat.ts` (`CONFIRM=1`) **DÉRIVE le taux de `vatRateFor(country)`** — un script
qui écrirait « 20 » serait un cinquième endroit où le droit fiscal est écrit. Diff de l'objet ENTIER
après : **seuls `vatRate` et `updatedAt` ont bougé**, le script échoue sur tout autre champ.
⚠️ Les démos ouest-africaines sont **lues, jugées concordantes, et NON écrites** — 18 % est correct
pour SN et CI. Un pays non documenté (`vatRateFor` → `null`) n'est jamais touché.

### Le COMMENTAIRE QUI INVENTE UN REPLI ⚠️ — règle exécutoire

**Un commentaire qui affirme qu'une alternative existe DOIT citer le `fichier:ligne` de
cette alternative, ou être supprimé.** TROIS occurrences dans la même session, chacune
justifiant une décision par un chemin qui n'existait pas. Le motif est constant :
**l'affirmation est plausible, jamais exécutée, et personne ne la vérifie parce qu'elle sert
de justification à autre chose.** Un `fichier:ligne` la rend réfutable en dix secondes ; sans
lui, elle survit des mois. 📖 *`docs/lessons/chiffres-affiches.md`.*

⚠️ **Vérifier dans le DOM RENDU, pas dans la source**, dès qu'il s'agit de CSS conditionnel :
la source dit ce qui est écrit, pas ce qui est affiché. Le masquage `.lp-nav-login` était
lisible dans le fichier ; qu'il ne reste AUCUN chemin vers `/login` ne l'était pas.

### La VÉRITÉ VACANTE ⚠️ — « toutes » sur l'ensemble vide

**Un quantificateur universel est VRAI et VIDE de sens sur une liste vide** — `.every()` rend `true`, `.some()` rend `false` : les deux mentent.

**Règle : TROIS états, jamais deux.**

| liste vide | non vide, incomplet | non vide, complet |
|---|---|---|
| **NEUTRE** — on constate, on ne félicite pas | alerte | succès |

L'état vide n'a ni coche, ni couleur de succès, ni bordure verte, et il DIT pourquoi il est vide.

⚠️ **C'est une FAMILLE, pas une ligne.** Balayer « toutes », « chacune », « aucune » sur toute liste qui peut être vide.

⚠️ **Deux messages différents ne partagent jamais la même phrase** — trois panneaux disant « Aucune boutique cliente » deviennent indistinguables, y compris pour un test de rendu.

⚠️ **Le SIGNAL prime sur la PHRASE** : l'œil croit la couleur, pas la légende qui la relativise. Une pastille non alimentée est **grise**, jamais verte. ⚠️ Vérifier **la propriété visuelle, pas seulement celle qu'on avait en tête** (un correctif avait changé la couleur du point en laissant le `boxShadow`).

⚠️ **Aucun chiffre d'argent affiché sans qu'on sache s'il entre dans le MRR.** Un tiret se lit, un faux montant se retient.

⚠️ **Deux nombres muets qui se contredisent, jamais** (un onglet à « 0 » au-dessus de trois cartes). Et **une intention n'est pas un écran** : un champ `isFixture` non rendu ne badge rien — vérifier sur le rendu.

Verrou : `adminConsoleTruth.test.tsx`. 📖 *`docs/lessons/chiffres-affiches.md`.*

### Le CHAMP DÉCLARÉ QUI SE FAIT PASSER POUR UNE MESURE ⚠️

**Un signal qui ne peut pas être faux ne prouve rien**, et il coûte plus cher qu'un signal absent : on s'y fie. Trois formes, dont aucune n'est visible depuis les autres — un **littéral dans un catalogue** (`status:'connected'`, `uptime:'99.9%'`), une **colonne déclarée JAMAIS écrite**, un **compteur dérivé des clés d'une map** plutôt que de ce qui est affiché.

- **Le NOM est la moitié du correctif** : `status` → **`declared: 'configured' | 'absent'`**. Un champ qui dit sa nature ne se relit pas trois fois sans qu'on voie le défaut. L'état RÉEL vient de **`GET /api/integrations/status`** (`lib/integrationStatus.ts`, adossé au `providerMode()` **déjà existant** — ne pas en écrire un second). `sandbox` n'est **pas** une nuance de `live` : c'est la différence entre encaisser et simuler.
- ⚠️ **Tant que la sonde n'a pas répondu, on n'est pas optimiste** : pastille GRISE, compteur « Vérification… ». **Un défaut réseau doit rendre l'écran muet, jamais rassurant.**
- ⚠️ **Une sonde vit avec sa carte, et un compteur se dérive de ce qui est AFFICHÉ** — jamais des clés d'une map (une sonde orpheline avait produit « 3/2 OK » et un `allChecked` faux pour toujours).
- ⚠️ **Vérité vacante, encore** : zéro sonde ⇒ barre verte « Tous les services opérationnels ». Et « tous les services » sur un sous-ensemble sondable est un quantificateur universel présenté comme le tout.
- ⚠️ **On mesure ce que la donnée porte** : `isOnlineNow` → **`loggedInRecently`** — « En ligne » promettait ce qu'aucune donnée ne porte. L'écriture de `lastLoginAt` est en **fail-open tracé**, après les refus : une colonne d'affichage ne refuse pas une authentification. L'absence se dit **« Aucune trace »**, jamais « Jamais » : *un trou de mesure n'est pas un fait sur la personne.*
- ⚠️ **Un test qui ne peut pas atteindre le chemin fautif ne garde rien** — deux verrous sont restés VERTS sous sabotage ici (`fetch` qui échoue en jsdom, mock `bcrypt.compare` qui ignore le mot de passe).

Verrous : `measuredNotDeclared.test.ts` · `lastLoginWritten.test.ts` · `integrationsRendered.test.tsx` (8, DOM rendu). 📖 *`docs/lessons/chiffres-affiches.md`.*

### ⚠️ TAILWIND N'ÉMET RIEN — toute classe `sm:`/`lg:` du source est MORTE

📖 *POURQUOI intégral (mesure du 2026-08-06, 5 angles morts du scanner, sabotage passé vert,
suppression des 18 modules shadcn) : `docs/lessons/tailwind-classes-livrees.md`* — **à lire
AVANT** de toucher `index.css`, `tailwind.config.js`, `apps/frontend/scripts/classAudit.mjs` ou
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

DEUX occurrences dans la même session, toutes deux « corrigées » en raccourcissant l'étiquette
— *c'est une contrainte trop étroite que personne n'avait mesurée.*

**LA CAUSE** : l'état actif ne change **ni le padding ni la largeur** — il change la **GRAISSE**
(500 → 800). Le même texte est plus large une fois sélectionné, dans un conteneur identique :
une troncature qui n'apparaît **que sur l'élément actif**, et qu'on ne voit jamais en relisant
le code. ⚠️ **L'espagnol et l'italien rallongent** : un libellé qui tient en français ne prouve rien.

**Verrou** : `navLabelWidth.test.ts` — géométrie **LUE** dans `index.css` (jamais
recopiée, sinon elle se périme en silence), libellés **DÉRIVÉS** de `Sidebar.tsx`, budget
vérifié dans les **4 langues**, et une règle qui échoue si `.nav-item.active` acquiert un
`padding`/`width`/`border-width` — la cause exacte, figée. **2 sabotages vérifiés.**
⚠️ **C'est un BUDGET DE CARACTÈRES, pas une mesure en pixels** : jsdom n'a ni police ni moteur de rendu. L'hypothèse (`0,64 em/caractère` en graisse 800, volontairement haute) est écrite dans le fichier ; **si une capture montre encore une troncature, c'est CE nombre qu'il faut relever — pas le libellé qu'il faut raccourcir.** 📖 *`docs/lessons/chiffres-affiches.md`.*

### DENSITÉ ⚠️ — un écran vide n'est un défaut que s'il devait porter de l'information

**La distinction a été prise à l'envers une fois** : `select-shop` rangé dans les défauts de
densité, **à tort** — un sélecteur à deux entrées est CENSÉ être calme et centré. Le vide y est
du repos, pas du gaspillage : **ne pas le « corriger »**.

| L'écran doit… | Le vide est… |
|---|---|
| porter des **données à comparer** (console Ops, rapports, planning) | un **défaut** — de la place qu'on n'a pas donnée à l'information |
| porter une **décision** (select-shop, confirmation, onboarding) | du **repos** — il isole le choix, il ne le dilue pas |

📖 *Mesures, gain réel, les trois détecteurs d'enroulement, le harnais `/__dev/table` et la
boucle de mesure par capture : `docs/lessons/densite-mesuree.md`* — **à lire AVANT** de
retoucher la table dense d'`AdminDashboard`, `adminTableDense.test.tsx` ou `e2e:density`.

⚠️ **VÉRIFIER À L'ÉCHELLE, PAS SUR LE JEU DE DÉMONSTRATION.** La galerie « marchait » — à 3
boutiques. Un test à 4 lignes reproduit exactement la situation qui a laissé passer le défaut.
Verrou `adminTableDense.test.tsx` : **50 clientes + 3 fixtures**, assertion de couverture
(`lignes === 53`), et autant de cellules par ligne que la table a de colonnes.

⚠️ **jsdom ne fait AUCUNE mise en page** — ni largeur, ni retour à la ligne, ni débordement.
Un verrou de rendu prouve la STRUCTURE, jamais la GÉOMÉTRIE : celle-ci se mesure avec un vrai
moteur (`npm run e2e:density --workspace=apps/frontend`). On avait affirmé que la table tient
sur un écran étroit sans l'avoir jamais vue : la mesure a disculpé la table et trouvé un autre défaut.

⚠️ **La garde P0 protège la ROUTE `/admin`, pas le COMPOSANT — et elle reste INTACTE.** Ne pas
chercher à authentifier Playwright sur `/admin` : le compte E2E est SUPER_ADMIN *de boutique*,
l'échec d'accès est le BON comportement (`App.tsx:97` redirige si `isPlatformAdmin !== true`,
`Sidebar.tsx:255` masque l'entrée, `e2e/smoke.spec.ts:78` fige l'absence). Le harnais rend le même composant ailleurs, et son
absence du bundle est **vérifiée** par `verify:demo-flag` (marqueur
`__habashop_dev_table_harness__`) — **l'artefact décide**, pas le ternaire.

### RÉPARTITION PAIEMENTS ⚠️ — QUATRE dénominateurs sur un seul camembert

**MESURÉ : l'écran Rapports → Ventes portait QUATRE dénominateurs pour le même dessin** — légende, donut, PDF et KPI de période, aucun d'accord avec les autres. Aucun n'était visible à la relecture : chacun était correct *localement*.

**Cause unique : une liste de modes RÉÉNUMÉRÉE en dur**, fausse dans les deux sens — un mode rendu que le serveur n'écrit **jamais**, deux modes écrits et **avalés**. *Tant que rien ne manque, les dénominateurs coïncident et le défaut dort.*

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
  `String @default("cash")` NOT NULL et la production porte ZÉRO ligne sans mode** — on retire un
  piège, on ne colmate pas une fuite.
- ⚠️ **Un repli fabriqué est une justesse EMPRUNTÉE** : celui-ci (Σ = 113 %) était inatteignable — l'état vide était rendu 140 lignes plus haut — mais il aurait resurgi au premier déplacement de la garde. Le cas vide est désormais **atteignable** (période sans vente) et il se **DIT** : pas d'anneau à zéro part, qui se lit comme un graphique cassé.

**Verrou** : `paymentBreakdown.test.tsx`, **5 sabotages vérifiés**. Jumeau mobile : `salePaymentModesShared.test.ts`.

⚠️ **Un sabotage y est passé VERT au premier tir** : la règle scrutait **la ligne** de total, que la correction venait d'éclater sur six lignes. *Un verrou qui ne détecte pas son défaut dans la forme ACTUELLE du code ne garde rien.* Réécrit par **appariement de crochets, jamais par regex sur la structure**.

📖 *`docs/lessons/chiffres-affiches.md`.*

### LE TOTAL CALCULÉ SUR CE QUI EST AFFICHÉ ⚠️ — la famille, pas la ligne

**TROIS instances en deux jours**, toutes de la même forme : *un total calculé sur ce qui est AFFICHÉ plutôt que sur ce qui EXISTE* — répartition paiements, tableau PDF, et camembert « CA par catégorie » tronqué à 6 (des dizaines de milliers de XOF perdus en un mois).

⚠️ **La démonstration de référence était PILE sur la valeur limite** : `demo-tenant-001` a EXACTEMENT 6 catégories, donc `perdu = 0` toujours — le défaut, réel et silencieux sur `demo-002`, restait invisible. **Une démonstration calée sur la valeur limite ne démontre rien : elle masque.**

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

**L'INVARIANT VERROUILLÉ EST PLUS FORT QUE « Σ = 100 % »** : `Σ(valeurs rendues) == CA du mois`. *Un camembert peut sommer à 100 % d'un total faux* — c'est exactement ce qu'il faisait. Verrou `categoryBreakdown.test.ts`, exercé de **0 à 20 catégories** : un test à 3 reproduirait la situation qui a laissé passer le défaut.

⚠️ **`pourcentagesEntiers` est la SOURCE UNIQUE de la répartition en entiers** (`apps/frontend/src/lib/pourcentages.ts`). Le Dashboard corrigeait le **dernier** secteur à `100 − Σ` : la somme valait 100, mais toute l'erreur atterrissait sur une seule part — la dernière, donc la plus petite. Ne pas en écrire une troisième — deux écrans, deux arrondis, ils divergent au premier cas limite.

⚠️ **BALAYAGE DE LA CLASSE FAIT — la « quatrième occurrence » attendue N'EXISTE PAS.** 681 fichiers sur les trois workspaces : `analytics.ts` était le **seul** site dont la troncature alimentait un dénominateur. Les autres sont d'une autre nature et **correctes** (total calculé AVANT le `slice`, barres relatives au maximum). *Écrit pour qu'on ne re-balaye pas cette classe en croyant qu'elle est ouverte.* ⚠️ **Il portait sur la TRONCATURE.** La famille SŒUR — deux totaux d'une même grandeur sur deux **POPULATIONS** — y échappe : mesurée en prod le 2026-08-08 (« Budget vs Réel »). **Parade : une source unique qui reçoit une liste DÉJÀ FILTRÉE** — la période est décidée en UN endroit, donc indécidable ailleurs (`buildBudgetSummary` ; y remettre un filtre de date recréerait le second endroit où elle diverge). ⚠️ **Et la cohérence ne suffit PAS** : depuis ce refactor, total, écart et taux dérivent du même résumé — ils restent d'accord **même si l'appelant passe la MAUVAISE liste**. La POPULATION s'épingle séparément, sinon le défaut revient sous un verrou vert. 📖 *`docs/lessons/chiffres-affiches.md`.*

**Dette voisine, NON traitée et distincte** : `routes/export.ts:56` plafonne l'export CSV des
ventes à `take: 1000` sans le dire. Aucun total n'en dérive — ce n'est pas cette famille — mais
c'est un plafond silencieux. **Entrée complète, avec son déclencheur de réouverture : § Dette ouverte.**

### La MOYENNE SANS SON DÉNOMINATEUR ⚠️ — `perf` / `rating`

`Employee.perf` et `Supplier.rating` étaient `Int NOT NULL DEFAULT 3` : un employé jamais évalué valait **3**, indiscernable d'un employé réellement noté 3. Colonnes **nullables sans défaut** depuis le 2026-08-06 (`20260806170000_perf_rating_nullable`).

- **Source unique `lib/ratingSummary.ts`** : `summarizeRatings(valeurs) → { total, rated, average }`. `average` est **`null`** quand personne n'est évalué — **jamais `0`**. `ratingValue` rend « — » (ni « 0,0/5 », ni « —/5 » : un dénominateur suggère qu'une note existe), `ratingCaption` porte l'**effectif évalué**.
- ⚠️ **« 4,2/5 » sur 3 évalués parmi 5 n'est PAS « 4,2/5 »** : sans son effectif, le nombre se lit comme portant sur toute l'équipe. **Le dénominateur fait partie de la mesure.**
- ⚠️ **Un filtre `.filter(e => e.perf)` n'écarte QUE `0`** — valeur impossible sur une échelle 1..5. Il avait l'air de filtrer et ne filtrait rien : **comparer à `null`**. Et le NUMÉRATEUR peut être faux aussi : `Number(x) || 0` divisé par le TOTAL fait compter un non-évalué pour zéro.
- ⚠️ **`z.coerce.number()` transforme `null` en 0.** Poser `.nullable()` AVANT toute coercition.
- ⚠️ **L'absence se DIT, elle ne se dessine pas** — cinq étoiles éteintes se lisent « 0/5 ». Re-cliquer l'étoile courante **remet à non évalué**, sinon un clic accidentel serait définitif et l'état vide inatteignable.
- ⚠️ **Aucun formulaire ne démarre noté.** `perf ?? 3` (serveur), `useState(emp?.perf ?? 3)`, `rating: 4` (création fournisseur), `perf:3` (nouveau contrat) écrivaient tous une note que personne n'avait donnée. Le verrou interdit la FORME `(perf|rating) ?? <chiffre>`. ⚠️ **Il n'attrape QUE cette forme** : `rating: 4` et `perf:3` en littéral d'objet passent au travers — vérifié en exécutant le motif. Ces deux-là n'ont que cette ligne comme défense ; la supprimer, c'est retirer la seule protection d'un cas que le code ne couvre pas.
- **Le seed laisse une partie NON évaluée** — *une démonstration qui note tout le monde ne montre jamais l'état vide.*

Verrou : `ratingDenominator.test.tsx`, 3 sabotages vérifiés. ⚠️ Deux enseignements de méthode y sont attachés : **un critère qui laisse passer son propre déclencheur est faux, pas prudent** (la règle a été exécutée contre son cas d'origine avant d'être gardée), et **un scanner doit retirer les commentaires avant de conclure** — sinon il interdit d'expliquer ce qu'il interdit. 📖 *`docs/lessons/chiffres-affiches.md`.*

### Console Ops ⚠️ — les FIXTURES ne sont pas des clients

`lib/fixtureTenant.ts` (backend) décide par **PROPRIÉTÉ** : `isPlatform` · `isDemo` ·
préfixe d'identifiant `e2e-`. **Jamais par une liste d'identifiants** — une liste vieillit,
le prochain tenant de test n'y figure pas, et le chiffre redevient faux en silence.

Mesuré : la console annonçait « 3 boutiques inscrites, toutes ont démarré » alors que le compte réel était **0**, tout le CA venant de fixtures.

⚠️ **Les fixtures sont MARQUÉES dans la liste (`isFixture` par ligne) et EXCLUES des agrégats** — un opérateur doit pouvoir ouvrir la démo, mais elle ne doit pas peser dans un chiffre. **Et le nombre d'exclues est DIT à l'écran** : masquer sans le dire ferait croire à une base vide alors qu'elle contient des démonstrations.

⚠️ **Pas de drapeau `isFixture` en base**, bien que ce fût plus propre : le poser sur `e2e-tenant` serait une MUTATION d'un tenant existant, interdite.

⚠️ **« ACTIF » A DEUX SENS — ne pas les confondre** : l'ABONNEMENT (une boutique paie) et
l'ACTIVITÉ (elle vend). Notions orthogonales, elles se contredisaient sur le même écran.
`ABONNEMENT` est un Record exhaustif sur les 5 statuts (valeur inconnue = neutre et VISIBLE,
plus de `st` brut) ; l'activité se dit « **sans vente depuis 14 j** » — ce qu'elle mesure,
pas un état.

⚠️ **UNE PASTILLE QUI NE PEUT PAS ROUGIR NE PROUVE RIEN.** « Santé technique » lisait un **littéral** de `pages/Integrations.tsx` : aucune requête n'était émise. Le panneau porte maintenant (a) **une sonde réelle** sur `/api/health-extended`, datée (« vérifié il y a N s ») et capable de rougir, et (b) la mention explicite que le reste est de la **configuration DÉCLARÉE**, pas une vérification. Sonder Sentry/Resend/Twilio demanderait un relais serveur : **dette assumée, écrite plutôt que masquée par du vert.** 📖 *`docs/lessons/chiffres-affiches.md`.*

### Le JUMEAU NON TRAITÉ ⚠️ — le motif le plus coûteux de ce dépôt

📖 *POURQUOI intégral (les 5 jumeaux mesurés du 2026-08-06, les deux cachés dans un fichier déjà traité, le calibrage du verrou tarifaire, la chaîne de relais qui a inventé un parc d'appareils, et le **registre des messages de commit non réécrivables**) : `docs/lessons/jumeau-non-traite.md`* — **à lire AVANT** d'écrire un verrou à périmètre, un scanner de littéraux, ou une synthèse qui compresse une mesure.

**Une correction qui s'arrête au premier fichier trouvé n'est pas une correction, c'est un déplacement.** MESURÉ : **cinq** corrections en une journée ont laissé un jumeau vivant, dont trois **hors du répertoire voisin**.

⚠️ **Chercher au répertoire voisin n'attrape que la moitié** — les deux jumeaux les plus graves vivaient **dans un fichier déjà traité** : l'un **sous un autre NOM** (`normalizeOrangePhone` quarante lignes au-dessus du `normalizeMsisdn` déjà fusionné ; le verrou assertait `calls.length === 1`, donc il PROUVAIT un site d'appel et était aveugle au second), l'autre **sous une autre FORME** (le verrou cherchait `\b8000\b` quand toute chaîne visible écrit « 8 000 »). D'où : **un verrou juge la FORME, jamais l'identifiant.**

⚠️ **QUATRE séparateurs de milliers coexistent** — U+0020, **U+202F** (`toLocaleString('fr-FR')`), U+00A0, U+002C. **Normaliser AVANT de chercher, jamais l'inverse.** Corollaire eslint : `no-irregular-whitespace` interdit ces caractères en littéral — les écrire en `\u202f`, sinon on choisit entre le lint et la couverture.

⚠️ **RÈGLE DE SABOTAGE — copier la forme depuis un fichier de PRODUCTION, jamais la retaper.** Un sabotage écrit de mémoire hérite des hypothèses du détecteur, et les deux tombent ensemble : c'est exactement ce qui a laissé le verrou tarifaire vert. Le sabotage doit être extrait par `git show HEAD:<fichier>` ou lu à l'exécution (cf. `pos-normalizeOrangePhone.deleted.txt`, et le séparateur relu dans `index.html` par `planPriceLiterals.test.ts`).

⚠️ **Un périmètre ÉCRIT À LA MAIN est faux dès qu'on ajoute quelque chose**, et l'assertion de couverture ne le dira pas : elle prouve qu'on a lu N fichiers, jamais que N était le bon N. Le périmètre se **DÉRIVE** (routes d'`App.tsx`, arborescence, les trois cibles `apps/frontend/src` + `apps/backend/src` + `mobile/src|app`), et les exemptions se **NOMMENT** une par une.

⚠️ **QUATRE angles morts, et chacun est INVISIBLE depuis le précédent.** Les trois premières parades ont toutes été inventées *après* s'être fait avoir. Un verrou peut être vert pour l'une de ces quatre raisons sans qu'aucune des autres ne le signale.

| # | Angle mort | Le verrou est vert parce que… | Parade |
|---|---|---|---|
| 1 | **Profondeur** | il ne lit RIEN (`walk()` cassé, dossier déplacé, glob muet) | assertion de **COUVERTURE** (« j'ai bien lu N fichiers ») |
| 2 | **Périmètre** | il lit les MAUVAIS fichiers | périmètre **DÉRIVÉ** (routes d'`App.tsx`, arborescence), jamais listé |
| 3 | **Forme** | il cherche ce qui ne PEUT PAS exister (`\b8000\b` vs « 8 000 ») | sabotage **COPIÉ** depuis un fichier de production |
| 4 | **Arité** | il n'y a RIEN à chercher | *aucune parade automatique* |

⚠️ **L'ARITÉ est la seule des quatre sans parade** : `plan === 'pro' ? 'Pro' : 'Enterprise'` sur un domaine à QUATRE valeurs n'offre aucun littéral fautif à détecter, juste une branche qui **n'existe pas** (toute activation Starter annonçait « plan Enterprise activé »). Question à poser à chaque revue : **ce booléen décrit-il vraiment un domaine binaire ?** Un `x === 'valeur' ? A : B` sur un champ qui vient d'un enum, d'un catalogue ou de la base est suspect **par construction** — il code une bijection sur un ensemble qui grandira. Préférer un `Record<Domaine, T>` ou un `switch` exhaustif — le compilateur rougit là où aucun test ne le fera. **Domaines à surveiller dans ce dépôt** : `plan` (4 + alias), `lang` (4), devises (6), rôles, statuts de `PlanRequest`, niveaux de `priceGapLevel` (4), `payMode` (5 + `mixed`). **Seul domaine légitimement binaire** : `policy` MSISDN (2, et sans valeur par défaut pour que le compilateur force le choix). ⚠️ **`as` désactive la seule parade automatique** : un cast qui RÉTRÉCIT un domaine (5 → 2) n'est pas une annotation, c'est une affirmation fausse que le compilateur a été prié d'accepter. Fréquence mesurée et calibrage : § « Arité des ternaires ».

⚠️ **Règle : une synthèse ne doit introduire AUCUN nom absent de sa source.** `build` → `parc`, `une route` → `les routes`, `un tenant` → `les clients` : chaque généralisation d'un singulier mesuré vers un collectif crée une population qui n'a jamais été comptée — c'est ainsi qu'un parc d'appareils inexistant a franchi trois relais. Quand une phrase porte un collectif, remonter à la mesure d'origine avant de s'en servir.

⚠️ **NE PAS ARBITRER — COMPTER.** Quand deux sources se contredisent sur une entité DÉNOMBRABLE, la contradiction n'est pas à trancher : elle est le signal qu'**aucune des deux n'a compté** (les deux affirmations en litige étaient fausses toutes les deux). Aller compter — ici `pushToken.groupBy` a rendu **1**, et six commandes ont clos six jours de doute. Seule la mesure tranche.

⚠️ **Un message de commit ne se corrige pas — il se RECENSE**, sinon il redevient une source : c'est un texte daté, signé, que `git log` remonte en premier et qu'on relit sans le suspecter. **Trois** en portent une, recensés dans la leçon.

---

⚠️ **LA SOURCE EST VALIDE, L'ARTEFACT EST NUL.** Deux défauts en cinq jours, deux langages : un
`` `${v.accent}28` `` où `v.accent` vaut `'var(--p2)'` (CSS **invalide à l'évaluation** ⇒
`border-style: none`, la valeur INITIALE), et un `<meta name="keywords" <!-- commentaire --> content="…">` dont le `content` est
**absent du DOM**. Dans les deux cas : `tsc` vert, suite
verte, revue passante, **et rien de ce qui était censé être livré ne l'était** — ni le
compilateur, ni les tests, ni la revue ne regardent l'artefact. Même famille que l'ordre des
règles du service worker et que le contexte Docker (§ Déploiement).

**Règle : tout ce qui est GÉNÉRÉ se vérifie sur le PRODUIT, jamais sur ce qui l'a produit.**
`verify:seo-urls` porte les gardes correspondantes — aucun `<!--` dans une balise, `content` non
vide sur chaque `<meta name>`, JSON-LD `JSON.parse`-able ; sabotages écrits avec les formes
**réellement commises**, pas retapées. ✅ **EN CI depuis le 2026-08-09** — il ne l'était pas, et
`verify:demo-flag` non plus : **deux gardes sur quatre ne tournaient nulle part**, décrits ici
comme « à lancer à la main avant tout push », donc en pratique jamais. *Une garde qu'on croit
automatique et qui ne l'est pas ne protège rien* — même famille que `notify-failure` sortant en
`exit 0`. ⚠️ **Les QUATRE sont désormais dans `ci.yml`, après le build** (ils inspectent le
`dist/`) ; vérifié avant branchement : les quatre passent sur un artefact construit dans les
conditions exactes du job.

⚠️ **Corollaire — un fait peut être encodé en DONNÉES, pas en texte.** Le JSON-LD portait
`serviceArea.geoMidpoint = 14.6928 / -17.4467` : Dakar. Un signal de ciblage géographique aussi
fort que le mot, **qu'aucune recherche de chaînes ne peut trouver** — vu en balayant les surfaces
SEO une par une. Quand on nettoie une affirmation, se demander sous quelle forme NON TEXTUELLE
elle pourrait aussi vivre : coordonnées, code pays, indicatif, fuseau, code devise, locale.

### Injection CSV ⚠️ — convention EXÉCUTOIRE, pas affirmée (#173)

**Tout producteur de CSV passe par `sanitizeCsv` de `lib/csv.ts`** — `apps/backend/src/lib/csv.ts` et `apps/frontend/src/lib/csv.ts`, **jumeaux à l'identique**, exercés sur les cas partagés `docs/shared-fixtures/csv-injection-cases.json` (modifier la règle d'un seul côté fait rougir l'autre — **vérifié dans les deux sens**). Le garde préfixe d'une apostrophe toute valeur commençant par `=`, `+`, `-` (trait d'union ASCII), `@`, tabulation ou retour chariot.

⚠️ **Entourer la cellule de guillemets ne protège PAS** : le tableur retire les guillemets puis évalue — `"=1+1"` donne 2. C'est ce qui rendait la faille invisible ; les producteurs échappaient consciencieusement les `"` et se croyaient sûrs. `sanitizeCsv` s'applique donc **AVANT** l'échappement, jamais après.

⚠️ **Ce qui rend la convention réelle, c'est le méta-test** (`csvInjection.test.ts`, front + back), pas cette ligne. Avant #173, `sanitizeCsv` vivait en `const` **locale** dans `routes/reports.ts` : la règle était documentée ici, applicable nulle part ailleurs, et `routes/export.ts` ne l'appelait pas. Un garde qu'on ne peut ni importer ni enfreindre bruyamment est un vœu.

⚠️ **Le verrou raisonne par SITE D'ÉCRITURE, pas par FICHIER** — et c'est MESURÉ, pas théorique. La première version, à la maille du fichier, laissait passer un trou réel : `utils/export.ts` contient **DEUX** producteurs — `exportCSV` (gardé) et **`exportAccountingExcel`** (nu ; malgré son nom il n'écrit pas de .xlsx mais un `text/csv`). Le fichier mentionnant `sanitizeCsv` pour le premier, il passait, pendant que le libellé de dépense saisi par le commerçant partait non neutralisé. Le scan **retire commentaires et imports** avant de conclure : sans ça il se ferait berner par un commentaire qui mentionne le garde, ou par un `import` conservé alors que l'appel a disparu (les deux sont exercés en contre-preuve dans le test).

**Le méta-test prouve la SOURCE, jamais l'APPLICATION** — d'où `csvInjectionBehaviour.test.ts` des deux côtés, qui capture les octets réellement écrits (contenu du `Blob` côté front, corps de la réponse via `app.inject()` côté back). Sabotages vérifiés : garde retiré de `routes/export.ts` · d'`exportAccountingExcel` · règle divergente d'un seul côté du jumeau.

✅ **XLSX : PAS concerné — verdict MESURÉ, pas supposé. Ne pas « corriger » `xlsxWriter` par analogie avec le CSV.** Il ne sanitise que les noms de feuille, jamais les cellules, et c'est **correct** : en OOXML le type est **DÉCLARÉ** (`<c t="inlineStr">`) et une formule exige un `<f>` dédié, que nous n'émettons jamais — là où un CSV ne porte aucun type et force le tableur à **deviner**. Rien à deviner ⇒ rien à neutraliser, et **préfixer abîmerait la donnée** (l'apostrophe s'afficherait). Verrou : bloc « injection de formule » de `xlsxWriter.test.ts`. **Limite assumée** : ce sont les octets QUE NOUS ÉMETTONS — le rond-trip « Enregistrer sous → CSV » depuis Excel est hors de portée d'un garde applicatif.

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
- **Plafonds par env, lus À L'APPEL** (ajustables sans redéploiement ; valeurs en § Env vars) :
  `QUOTA_TRIAL_*` / `QUOTA_ACTIVE_*`, `COST_BURST_PER_MIN` — ⚠️ pas de `|| 10`, sinon
  `Number('0') || 10` rend la désactivation inopérante.
- **WhatsApp = DEUX seaux séparés** (`SpendKind`) : `whatsapp` TRANSACTIONNEL (reçus,
  alertes, crons — **SACRÉ**) et `whatsapp_marketing` (diffusions, campagnes —
  `QUOTA_TRIAL_WHATSAPP_MARKETING`/`QUOTA_ACTIVE_WHATSAPP_MARKETING`, **défaut volontairement BAS
  = PLACEHOLDER** à fixer par produit/facturation ; chaque message marketing coûte du Twilio
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

✅ **Dette `Tenant.country` : TRAITÉE.** Le champ a contenu des LIBELLÉS français à côté d'ISO-2,
faute de validation entre `Onboarding` et `SignupPage`. Conséquence NON cosmétique :
`resolveRecipient` n'accepte que l'ISO-2, donc un tenant « France » ne recevait **ni WhatsApp ni
SMS**, en silence — *le garde faisait son travail, la donnée mentait*.

**`lib/country.ts`** (`normalizeCountry`, `SUPPORTED_COUNTRIES`) est le seul juge, appelé par les
**3** chemins d'écriture (`PATCH /api/tenant` → **400** sur l'irrésolvable, register, admin).
⚠️ **Liste blanche, PAS `^[A-Z]{2}$`** : la regex accepterait `XX`, remplaçant une valeur invalide
*bruyante* par une *silencieuse*. ⚠️ **`null` ≠ repli** — un défaut implicite sur `SN` rend
indistinguables un choix et une valeur jamais saisie. ⚠️ **Ne PAS y importer `libphonenumber-js`**
(`isSupportedCountry`) : un second point d'entrée rouvrirait ce que `phoneChokepoint.test.ts`
ferme. Table des libellés hérités conservée (une PWA en cache les envoie encore) — ensemble CLOS
de nos propres anciennes `value`, pas une inférence sur du texte libre. Front : `Onboarding` et le
champ Réglages → Boutique (qui était en TEXTE LIBRE, donc 400 garanti) passent par le sélecteur
`utils/countryList.ts`. Verrou : `tenantCountryIso.test.ts` (12, 3 sabotages). `Customer` n'a
toujours **aucun** champ pays — c'est voulu (cf. flux client).

⚠️ **Méthode — la leçon la plus chère, valable au-delà du téléphone** : ne JAMAIS poser une garantie
de sûreté par RAISONNEMENT. Les trois échecs ont le même motif — une affirmation plausible écrite en
commentaire et jamais exécutée, qu'un script de dix lignes aurait démentie **avant** le commit.
**Mesurer d'abord, coder ensuite** ; si un commentaire affirme une propriété de sûreté, un test doit
l'exercer, et être vérifié **dans les deux sens**.

## Dette ouverte

### 🔴 Critique
- ✅ **Numéros WhatsApp : RÉSOLU** (PR #100) — `resolveRecipient` + `owner` obligatoire ; dette `Tenant.country` traitée aussi. Cf. § Normalisation téléphonique.
- ✅ **SMS : IMPLÉMENTÉ** (Africa's Talking) — `lib/spend/smsClient.ts` = **SEUL module autorisé à importer `africastalking`** (allowlist `spendGuardAllowlist.test.ts`), garde de dépense `SpendKind` **`sms`** + **`resolveRecipient` obligatoire**. Digest QUOTIDIEN au gérant, jamais par vente. 📖 *câblage complet : `docs/modules.md` § SMS.* ⚠️ **À ACTIVER (Nelson)** : compte Africa's Talking + `SMS_API_KEY` (+ `SMS_USERNAME` défaut `sandbox`, `SMS_SENDER_ID` optionnel) sur Railway — absente = feature inerte (`SMS_NOT_CONFIGURED`, fail-safe).
- ✅ **Push PWA : IMPLÉMENTÉ** (Web Push VAPID) — canal navigateur **DISTINCT** du push Expo mobile ; `services/webPush.ts` = **SEUL module autorisé à importer `web-push`** (fail-silent). 📖 *câblage complet : `docs/modules.md` § Push PWA.* ⚠️ **À ACTIVER (Nelson)** : poser `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT` optionnel) sur Railway — clés absentes = feature inerte (fail-safe).
- **Wave webhook** : code **fail-CLOSED** (`if (!secret) return false`) ✅ — reste à poser `WAVE_WEBHOOK_SECRET` Railway pour activer la vérif en prod. **S**
- **Campay go-live** : `CAMPAY_WEBHOOK_KEY` + `CAMPAY_ENVIRONMENT=production`. **S**
- **PayDunya go-live** : `PAYDUNYA_MODE=live` + clés live. Flux POS non validé end-to-end. **S**

### 🔴 Critique (suite)
- ✅ **Rejeu hors-ligne MOBILE : TRAITÉ** (option A, voie 1) — `saleReplay.ts` pose `offlineReplay` et **consomme la réponse** ; hors bornes → `repriced`. Cf. § Intégrité prix + `docs/handoff/2026-07-25-rejeu-mobile-option-a-design.md`.

### 🟡 Medium
- ✅ **Congés E2E : CLOS le 2026-08-07** — fuite fermée, résidu purgé (**307 → 0** sur
  `e2e-tenant`, effets de bord vérifiés intacts).
  📖 *`docs/lessons/menage-e2e-conges.md`* — **à lire avant** d'écrire un bloc de ménage E2E.
  - ⚠️ **Un ménage s'ASSERTE, il n'est jamais « best-effort ».** Non bloquant, il a échoué une
    journée entière sans que rien ne le dise (repli en `console.warn`, et **un test vert
    n'imprime rien**). L'assertion porte sur **le COMPTE avant/après**, jamais sur le code de
    retour : un 200 dit que l'appel a abouti, pas que la base est revenue à son état d'avant.
  - ⚠️ **Le jeton E2E se lit sous `habashop_token`** (store persisté : `habashop-auth`). Le
    ménage lisait `auth-storage`, **clé qui n'existe nulle part** → `Bearer ` → 401 muet.
  - ⚠️ **Une purge sur un tenant réel** : périmètre **en dur dans le script**, garde `CONFIRM=1`,
    refus si `isDemo`, instantané avant / diff de l'objet entier après.
- ✅ **Export tronqué en silence : CLOS le 2026-08-09.** *Un document qui SORT du produit ne se
  tronque pas sans le dire* — le CSV part chez un comptable et se recopie. ⚠️ **Famille DISTINCTE
  de « le total est la somme de ce qu'on montre »** : aucun total n'en dérivait (`analytics.ts`
  en était le seul site, balayage du 2026-08-07) — ne pas les fondre.
  - **La troncature s'annonce dans le NOM DE FICHIER** (`ventes-JJ-10000-sur-42130.csv`), jamais
    dans une ligne du CSV : une ligne de plus est une **ligne de données** pour le tableur, elle
    se trie, entre dans une somme et se recopie. Le nom se lit avant l'ouverture.
  - Plafond **1 000 → 10 000**, tenable UNIQUEMENT parce que la requête ne charge plus les
    articles (`_count` au lieu d'`include: { items: true }`, qui chargeait tous les `SaleItem`
    pour ne lire qu'un `.length`). **Un plafond subsiste délibérément** — le défaut était son
    silence, pas son existence.
  - ⚠️ **La route ne prend AUCUNE période** : ce ne sont pas « N ventes de la période » mais les
    N plus récentes, toutes périodes confondues. La dette était écrite avec un déclencheur qui
    décrivait un paramètre inexistant — *un déclencheur qui nomme ce qui n'existe pas ne se
    déclenche jamais.*
  - **Rapport mensuel** : mention « Les 30 ventes les plus récentes, sur N au total ». ⚠️ Le
    `findMany` n'avait **aucun `orderBy`** — « les 30 premières » n'était même pas « les plus
    récentes », c'étaient 30 ventes dans un ordre que Postgres ne garantit pas. *Poser la légende
    sans le tri aurait remplacé un silence par une affirmation fausse.*
  - Verrou : `exportTroncature.test.ts` (7, **5 sabotages** aux formes extraites par
    `git show HEAD`) — le mock **applique `take`**, sinon il rendrait la même liste quel que soit
    l'argument et resterait vert si le code cessait de plafonner.
  - ✅ **Balayage de CETTE famille : FAIT le 2026-08-07 — ne pas le refaire.** 15 producteurs
    de documents (export, facture PDF, ticket, reçu, e-mail, rapport, étiquette, xlsx), web +
    API + mobile : les deux ci-dessus sont les **seuls** défauts. Le bon motif à copier —
    `services/email.ts:473` calcule `totalCount = products.length` **avant** son `slice(0,20)`,
    `routes/whatsapp.ts:93` annonce `lowStock.length` avant de n'en lister que cinq. Écartés à
    raison : limites dures de format (`xlsxWriter` 31 car., `thermalLabel` 2 lignes) et listes
    d'écran ou de destinataires, qui ne sont pas des documents.
- ✅ **Cahier des charges : REMPLACÉ le 2026-08-07** — `docs/HabaShop_CDC_v4.md` (Markdown, versionné, diffable) succède au `.docx` de mai, renommé `HabaShop_CDC_v3.PERIME-2026-05.docx`. La v3 ne se contentait pas d'être périmée : elle prescrivait `vercel --prod` depuis `apps/frontend` (§2.4, chemin qui échoue) et documentait le gating de `/api/admin/*` sur le rôle `SUPER_ADMIN` (§6.3, la fuite P0 corrigée) — *un document de référence périmé dit le contraire, avec autorité.* **Ne plus s'y référer.** ⚠️ La v4 pose une règle qui lui survit : *rien n'y est affirmé qui n'ait été compté*, et son **annexe B donne la commande de recomptage de chaque chiffre**. Un chiffre sans son moyen de recalcul redevient une affirmation.
- ✅ **Paie statuts : RÉSOLU** — modèle `Payroll` (instantané GELÉ) + routes `GET /api/payroll?month=YYYY-MM`, `POST /api/payroll/generate`, `PATCH /api/payroll/:id`. Cf. § Paie.
- **Bundle recharts ~105KB gz** : lazy + hors precache. Remplacer visx = **L**.
- **Densité — UN SEUL lot avec la table dense** ⚠️ : tout touche la même structure, séparer ferait le travail plusieurs fois. Défauts MESURÉS sur captures (console Ops, Rapports/RH, Planning) — 📖 *liste et mesures : `docs/lessons/densite-mesuree.md`* ; la garde P0 sur `/admin` reste intacte, cf. § DENSITÉ.
  - ✅ **Le workflow densité tourne EN CI** (`density.yml`, filtré par `paths:`). ⚠️ La géométrie diffère entre Ubuntu et macOS : l'assertion porte sur le DÉBORDEMENT et l'enroulement, **jamais sur un pixel exact**.

- ✅ **A11y résiduel : FAIT** — SectionCatalog (4 champs `aria-label` : catalogue/slug/description/WhatsApp), POSModals sélecteur pays devenu vrai `role="listbox"` (+ `role="group"` par région, `role="option"`+`aria-selected` sur `CountryItem`), Stock vue grille en `role="list"`/`role="listitem"` (via props A11y additives de `ResponsiveGrid`).

## Carte du dépôt (graphify) ⚠️ — datée, et elle se périme vite

📖 *Passes mesurées, périmètre recalculable, archéologie et POURQUOI de chaque
exclusion : `docs/lessons/carte-graphify.md`.* Passe : `graphify . --update` ; sorties dans
`graphify-out/`, **gitignoré**.

⚠️ **RAFRAÎCHIR au premier des deux :** **50 commits** depuis la dernière passe, ou **la
création d'un module de source unique** (`lib/*` jumelé, fixture partagée). Le second est
celui qui coûte cher : mesuré, une carte de 86 commits de retard ignorait **29 modules de
source unique** — exactement ceux que ce guide traite comme faisant autorité. *Une carte
qui ignore les sources uniques répond, et répond à côté.*

⚠️ **LE MODÈLE DE DONNÉES EST INVISIBLE AU GRAPHE** — `schema.prisma` n'est pas une
extension supportée, les 35 migrations `.sql` exigent `graphifyy[sql]` (absent). Ne pas
lui demander « quelles colonnes porte `Sale` ? » : lire `schema.prisma`.

⚠️ **Le coût suit la DOCUMENTATION, pas le code** (AST = coût nul), et ce guide plus
`docs/lessons/` en sont l'essentiel — à savoir **avant** de lancer une passe.

**Périmètre borné par `.graphifyignore`** (racine, exclusions motivées en clair) : images,
`.docx` sans jumeau markdown, `docs/shared-fixtures/`. ⚠️ **Ne jamais y mettre du code de
production** — la règle actuelle ne retire aucun fichier du dénominateur de couverture,
c'est ce qui la rend sûre. Et le « N files » de la *Corpus Check* n'est PAS la couverture :
compter les `source_file` distincts de `graph.json`.

## Comptes démo

⚠️ **`demo-tenant-001` et `demo-tenant-002` portent `isDemo = true`** depuis 2026-07-22 : toute action à coût externe ou destructive y est refusée côté serveur (403 `DEMO_TENANT_FORBIDDEN`, cf. § Garde de dépense). Le mot de passe démo est PUBLIC — c'est ce flag qui protège, pas la discrétion.

`demo1234` — `admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com`, tenant principal `demo-tenant-001` (« HabaShop — Dakar Central »). 5 employés (`demo-emp-${name}`). Données hors seed : `requireCashier=false`, `ownerPhone='+221771234567'`. Si reseed → repasser `requireCashier=false`.

⚠️ **QUATRE tenants depuis le 2026-08-09 — un cinquième a été SUPPRIMÉ.** « Boutique 2 » (créé le 2026-08-07 à 23:58, jamais retouché) n'avait **aucune référence sur les 26 relations** du modèle Tenant, donc aucun utilisateur : inatteignable. Mais il ne portait ni `isDemo`, ni `isPlatform`, ni le préfixe `e2e-` — la console Ops le comptait donc comme **« 1 boutique cliente »**, seul chiffre qu'elle doive rendre juste. Après suppression : **0 cliente, 4 fixtures, partition complète**. Script `prisma/delete-orphan-tenant.ts` (`CONFIRM=1`, périmètre EN DUR, 4 gardes vérifiés qui refusent démo/plateforme/nom discordant/non-orphelin). ⚠️ **Le comptage des références se DÉRIVE des relations inverses de `model Tenant`, jamais des champs nommés `tenantId`** : un premier scan par nom de champ annonçait « 0 référence » en ayant manqué `StockTransfer` (`fromTenantId`/`toTenantId`) — *un périmètre dérivé de la mauvaise propriété rend un zéro qui a l'air d'une preuve.*

✅ **DEVISES DES TENANTS — corrigées et VÉRIFIÉES le 2026-08-07** : `demo-001` SN/**XOF** (il portait `XAF` — un tenant sénégalais en devise d'Afrique CENTRALE, que rien ne pouvait signaler puisque les deux calculent à l'identique) · `demo-002` CI/XOF · `e2e-tenant` SN/EUR · interne FR/EUR. ⚠️ **Ne PAS recopier cette liste comme un fait acquis** : ce fichier a déjà annoncé « EUR 2 / XOF 2 » sur la foi d'un `PATCH` non revérifié. Elle se **relit** (`tenant.findMany`), et depuis le 2026-08-08 un garde empêche le couple incohérent de revenir. 📖 *`docs/lessons/demos-devise-et-pii.md`.*

⚠️ **`e2e-tenant` reste en EUR, et c'est DÉLIBÉRÉ — ne pas « harmoniser ».** En XOF (0 décimale, taux 1), convertir zéro, une ou deux fois donne le **même affichage** : tous les défauts de conversion y sont invisibles. C'est exactement la raison pour laquelle les cas dorés de paie doublent chaque cas XOF d'un cas EUR (§ Paie). `HabaShop Ops` est un tenant interne, pas une boutique.
⚠️ **LES DÉMOS RESTENT OUEST-AFRICAINES — ne pas « aligner » sur le marché par défaut.** Mesuré avant de décider : chaque démo est ancrée sur 16 lignes (SN pour `demo-001`, CI pour `demo-002`), l'indicatif dérive déjà de `tenant.country`, et **la TVA à 18 % est CORRECTE pour SN et CI**. Une démo sénégalaise sous un défaut produit camerounais est la meilleure preuve que le multi-pays fonctionne.

⚠️ **Et « re-seeder » ne ferait RIEN** : tous les `upsert` du seed ont `update: {}` (seules exceptions : `lang` sur le tenant, `role`/`name` sur les users). Le seed a d'ailleurs **déjà dérivé** du contenu de la base, et un re-seed ne réconcilierait pas l'écart — il ne réécrit aucune ligne existante.

✅ **DONNÉES PERSONNELLES RÉELLES — TRAITÉES le 2026-08-06, et surveillées depuis** (un client de `demo-001` portait nom, mobile, adresse et e-mail réels, **trois semaines** en lecture publique ; anonymisé). 📖 *`docs/lessons/demos-devise-et-pii.md`.*

⚠️ **LE TIROIR MENTAIT, ET C'EST LA LEÇON** : l'écran affichait « Aucun achat », la base portait **1 abonnement actif** — c'est ce comptage qui a imposé l'ANONYMISATION plutôt que la suppression (`Subscription.customerId` non nullable). **Compter les références avant de choisir, jamais déduire de l'écran.**

⚠️ **BALAYAGE HEBDOMADAIRE** — `runDemoPiiSweep` (lundi 9h), `lib/piiSweep.ts`. Il **RAPPORTE, il n'empêche pas** : empêcher supposerait de refuser des saisies dans une démo dont l'intérêt est qu'on puisse tout y faire. Détection **de FORME** (indicatif, domaine), jamais par liste de pays ou de messageries — le critère « absent des seeds » a été ABANDONNÉ après **8 faux positifs sur 12**. ⚠️ Le rapport ne reproduit **aucune valeur**, seulement identifiants et noms de champs : le recopier l'écrirait dans les logs Railway et **déplacerait la fuite au lieu de la fermer**. Périmètre `isDemo` UNIQUEMENT.

✅ **TRANCHÉ le 2026-08-09 par Nelson : le mot de passe démo RESTE PUBLIC**, avec le balayage PII hebdomadaire pour seule borne. `isDemo` borne le **coût** (403 sur toute dépense externe), **pas l'exposition** : n'importe qui peut lire. **Le déclencheur de réouverture est INCHANGÉ — le premier prospect envoyé sur la démo.** ⚠️ Coût mesuré de la voie écartée (fermer) : **22 fichiers du dépôt public citent `demo1234`**, le build store mobile (runtime 1.2.0) perdrait ses boutons démo **définitivement** — aucune OTA ne l'atteint — et la review Apple s'en sert (`mobile/IOS_BUILD.md`). Ce coût ne vaut que tant que personne n'est dirigé vers la démo ; le jour où on donne l'adresse, il se recalcule.
**DÉCLENCHEUR DE RÉOUVERTURE : le premier prospect envoyé sur la démo.** Tant que personne n'y est dirigé, l'exposition se limite à qui trouve le dépôt ; le jour où on donne l'adresse, la démo devient une vitrine et le mot de passe public un choix, plus un reliquat. ⚠️ `runDemoPiiSweep` réduit la fenêtre à sept jours — **il ne la ferme pas**.

**Multi-boutiques** : `admin@` et `manager@` sont liés à une 2ᵉ boutique `demo-tenant-002` (« Alimentation Koné — Abidjan », XOF) via `UserTenant` → login déclenche le sélecteur. `admin@` = SUPER_ADMIN/ADMIN, `manager@` = MANAGER/MANAGER. Les 3 autres restent mono-boutique.

## Env vars

**Railway** : `FRONTEND_URL` (**URL de l'app web — SOURCE UNIQUE backend**, `lib/appUrl.ts` ; déjà posée à `https://habashop.vercel.app`. Le jour d'un domaine propre, la changer ICI suffit : e-mails — logo, pied, liens login/upgrade/stock/dashboard — et redirections de paiement Campay/PayDunya suivent. Absente ⇒ repli sur l'URL vercel, comportement inchangé. ⚠️ NE PAS créer un second nom type `APP_URL` : `FRONTEND_URL` sert aussi la liste CORS. Verrou : `appUrlSource.test.ts` (8, sabotage vérifié) échoue si le littéral réapparaît dans `src/services`/`src/routes` — il ignore volontairement l'adresse factice `test@habashop.vercel.app` d'`admin.ts`. ✅ Les deux autres surfaces sont traitées : front statique via `VITE_APP_URL` (#158) et applicatif (#159), mobile via `EXPO_PUBLIC_APP_URL` (#160). **Quatre lectures, une valeur** — chaque plateforme a son environnement d'exécution, et les méta-tests verrouillent l'ÉGALITÉ des défauts), `DATABASE_URL`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`, `WAVE_WEBHOOK_SECRET`, Resend, Redis, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT` optionnel — Web Push PWA ; absents = feature inerte), `SMS_API_KEY` (+ `SMS_USERNAME` défaut `sandbox`, `SMS_SENDER_ID` optionnel — SMS Africa's Talking ; absente = feature inerte).
- MTN : `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS`
- Campay : `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS`
- PayDunya : `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS`

- Garde de dépense : `QUOTA_TRIAL_AI/OCR/WHATSAPP/WHATSAPP_MARKETING/EMAIL` · `QUOTA_ACTIVE_*` (défauts 20/15/30/**10**/20 et 200/150/300/**50**/200 ; `WHATSAPP_MARKETING` = placeholder bas) · `COST_BURST_PER_MIN` (défaut 10, `0` = désactivé) · `RATE_LIMIT_MAX` (global, défaut 300/min/IP). Tous **lus à l'appel** → ajustables sans redéploiement.

**Vercel** : **`VITE_APP_URL`** (URL publique de l'app — **miroir front de `FRONTEND_URL`** ; même valeur, deux plateformes où la poser, contrainte inhérente). Défaut garanti dans `apps/frontend/.env` (tracké). ⚠️ **Si elle manque, Vite livre le littéral `%VITE_APP_URL%`** dans `canonical`/`og:url`/JSON-LD — un canonical cassé désindexe, donc PIRE que l'URL en dur (mesuré). **Deux mécanismes, car les fichiers ne sont pas produits pareil** : `index.html` traverse Vite → substitution native `%VITE_APP_URL%` (9 balises) ; `public/` est copié **octet pour octet** → aucune substitution possible, d'où les gabarits `scripts/seo/*.tmpl` + `scripts/gen-seo.mjs` qui écrivent `dist/sitemap.xml` et `dist/robots.txt` au build (⚠️ ils ne sont donc plus servis par `vite dev` — sans effet, ils ne valent que déployés). Gardes : `npm run verify:seo-urls` inspecte le **`dist/` livré** (marqueur non substitué = échec, invisible pour tsc/tests puisque la SOURCE est correcte — c'est l'ENV de build qui manque) + méta-test `appUrlStatic.test.ts` (8, **4 sabotages**). ✅ **Les 6 liens user-facing de `src/`** (`Privacy.tsx` ×4, `PublicCatalog.tsx` ×2) passent par `src/lib/appUrl.ts` (#159) — module DISTINCT de `gen-seo.mjs`, qui tourne hors du pipeline Vite et n'a pas accès à `import.meta.env`. Verrou : bloc `src/` d'`appUrlStatic.test.ts`, qui interdit le retour d'un **`href`** en dur, pas toute mention du littéral (fixtures d'`Integrations.tsx`, repli `window.location.origin` de `SectionCatalog` — un verrou qui crie au loup se fait désarmer). `VITE_GOOGLE_MAPS_KEY` (.env tracké), `VITE_ENV`, `SENTRY_AUTH_TOKEN` (.env.local), `VITE_DEMO_MODE=1` (**déploiement DÉMO uniquement** — jamais en prod : sort le raccourci par rôle et `demo1234` du bundle).

**EAS (mobile)** : **`EXPO_PUBLIC_APP_URL`** (miroir mobile de `FRONTEND_URL`/`VITE_APP_URL` — URL de l'app WEB, à ne pas confondre avec `app.json` `version` qui pilote le runtime OTA et reste une piste séparée). Lue par `mobile/src/lib/appUrl.ts` ; absente = repli sur l'hôte actuel, comportement inchangé. ⚠️ **`mobile/.env` est gitignoré et n'atteint PAS le builder** : `eas.json` déclare `"environment": preview|production`, donc les variables viennent d'**EAS**. Mesuré le 2026-07-29 : `EXPO_PUBLIC_API_URL` n'est posée dans **aucun** environnement EAS — tout build/OTA tourne donc sur le repli littéral d'`api.ts`, et le `.env` local n'agit qu'en dev. Conséquence : `EXPO_PUBLIC_APP_URL` est **inerte tant que Nelson ne la pose pas** (`eas env:create --environment preview --name EXPO_PUBLIC_APP_URL`), exactement comme VAPID et SMS. ⚠️ **Expo inline `EXPO_PUBLIC_*` STATIQUEMENT au bundling** (substitution textuelle) → la variable doit apparaître en toutes lettres ; un accès calculé `process.env[clef]` ne serait jamais remplacé. D'où `normalizeAppUrl(raw)` séparé de `appUrl()` : la logique reste testable sans dépendre de ce que babel a inliné. Verrou : `mobile/src/__tests__/appUrl.test.ts` (8, **3 sabotages**) — il scanne **`src/` ET `app/`**, contrairement à `versionSource.test.ts` qui s'arrête à `src/` alors qu'un des sites vivait dans `app/(app)/(tabs)/settings.tsx`. ✅ **Ce verrou tourne en CI** depuis #163 (job `unit-tests-mobile`) ; en local, `cd mobile && npx jest`.
