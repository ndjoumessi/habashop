# HabaShop — Guide Claude Code

SaaS de gestion commerciale multi-tenant **et multi-boutiques** (boutiques/superettes, Afrique de l'Ouest). **Monorepo unique `habashop`** : web (npm workspaces `apps/*`) + `mobile/` (Expo, hors workspaces) + `legal/` (pages légales).

## Stack

- **Frontend** (`apps/frontend`) : React 18 + TS + Vite 8 + vitest 4, Zustand (persisté localStorage), React Router 7 (API déclarative classique — BrowserRouter/Routes/Route + hooks ; migré depuis 6.30 pour les CVE open-redirect, quasi drop-in), Lucide, recharts, jsbarcode (EAN-13/EAN-8/UPC-A), @zxing (scan), qrcode+html2canvas (fidélité), jspdf (étiquettes thermiques, **import dynamique**), cmdk (GlobalSearch), Playwright E2E, Sentry (org **haba-76** / projet **habashop-web**), PWA vite-plugin-pwa 1.x. Chunks `charts`/`barcode`/`canvas`/`pdf` EXCLUS du precache (runtime CacheFirst `lazy-chunks-cache`) — préserver si on touche `vite.config.ts`. ⚠️ **Cache SW = premier match gagne** (`workbox-routing/Router.js` `findMatchingRoute`) : une règle enregistrée après une règle plus large est **MORTE**. C'est arrivé — `products-cache` (SWR 7 j) n'a **jamais tourné en prod**, occultée par la règle `/api/`, alors que tout lecteur de la config y lisait la politique de cache du catalogue POS (supprimée ; SWR servirait un prix périmé même en ligne et rapide, or pour un prix de caisse la fraîcheur en ligne prime — `NetworkFirst` n'y retombe qu'au-delà du délai réseau). La règle API matche désormais le **chemin `/api/`, pas l'hôte** (l'hôte en dur mourait en silence si l'API déménageait — cf. `.env.production`). Garde CI : `npm run verify:sw-routes --workspace=apps/frontend` inspecte le **`dist/sw.js` livré** et échoue si une règle est inatteignable ou si une URL tombe sur le mauvais cache (invisible pour tsc/tests/revue : la source est valide, c'est l'ORDRE dans l'artefact qui tue). Vérifié dans les deux sens.
- **Backend** (`apps/backend`) : Fastify 5 + Prisma + PostgreSQL (Railway), bcryptjs + JWT, Resend, pdfkit, twilio, `@anthropic-ai/sdk ^0.96.0` (OCR Vision), `@fastify/multipart`, `@fastify/rate-limit` (**global**), **validation déclarative zod** (`fastify-type-provider-zod`, `validatorCompiler` global — cf. § Sécurité).
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, **base XOF**), multi-langues (fr/en/es/it).

## Structure du repo (monorepo)

Un seul repo `ndjoumessi/habashop` depuis juillet 2026 — fusion de `habashop-mobile` et `habashop-legal` via `git subtree` (historique préservé) :

- `apps/frontend`, `apps/backend` → **web** (workspaces racine `apps/*` + `packages/*`).
- `mobile/` → **app Expo** (ex-`habashop-mobile`). **Hors workspaces npm** : `package.json` + `package-lock.json` propres → `npm ci` à lancer *dans* `mobile/`. Builds/OTA EAS depuis `mobile/` (`cd mobile && eas update --branch preview`). Projet EAS inchangé (`projectId e7399d7a-…`, canal `preview`). ⚠️ **AVANT de toucher `mobile/`, lire `mobile/CLAUDE.md`** (+ `mobile/AGENTS.md`) : il porte les contraintes propres à la plateforme, invisibles depuis ce fichier — **SDK 54, ne PAS upgrader vers 56** · crash natif Fabric `addViewAt` sur modales empilées (parade : rendu à la demande) · ne pas supprimer `app/index.tsx` · **swap temporaire `app.json` 1.5.0→1.4.3 pour un OTA** vers le device (build natif 1.5.0 jamais fait) · polices `@expo-google-fonts` non livrables par OTA.
- `docs/modules.md` → **la référence par module** (Produits, Codes-barres, Étiquettes, Abonnements, Facture PDF, Audit, Multi-boutiques, Admin plateforme, RH…) : endpoints, schémas, composants, verrous. Sortie d'ici pour alléger le contexte chargé à chaque session — **à ouvrir dès qu'on touche l'un de ces modules** ; ce fichier n'en garde que les règles transverses (§ Modules — index).
- `docs/lessons/` → **le POURQUOI des chantiers clos** (raisonnement intégral, mesures, tentatives ratées) sorti de ce fichier pour l'alléger. Ces pages ne sont PAS de l'archive : elles sont citées 📖 depuis la règle correspondante et **sont à lire avant de retoucher la surface concernée**.
- `legal/` → **pages légales** (ex-`habashop-legal`). Publiées via `.github/workflows/pages.yml` sur **`https://ndjoumessi.github.io/habashop/legal/`** (suppression compte : `.../legal/account-deletion.html`). ⚠️ URL référencée dans Google Play Console.

## Commandes courantes

**⚠️ Node défaut = v10 → casse tout.** Toujours en premier (vaut pour dev, tests, builds ET déploiements) :
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

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

**Rituel commit** : `npx tsc --noEmit` (0) → `npm test` (verts) → `npm run build` (OK) → commit/push `main`. Git : push direct sur `main`, pas de feature branch.

**CI** (`.github/workflows/ci.yml`, Node 22) : tsc + **lint** + tests unitaires sur les deux workspaces, build front avec **garde de taille de bundle < 100 Ko gz** (`index-*.js`), scan de secrets en dur ; sur `main` uniquement : tests d'intégration (lecture seule contre la PROD) et E2E Playwright. ⚠️ **Le lint backend est un CLIQUET** : `--max-warnings 325` = l'état actuel, donc tout NOUVEL avertissement casse la CI. Ne pas relever le plafond pour faire passer un commit — corriger, ou l'abaisser quand on nettoie (descendu de 333 → 327 au fil de l'item 10, puis → 325 en extrayant le handler d'erreur ; chaque suppression d'`any` abaisse le plafond d'autant). (Il était à 200 pour 333 avertissements réels : la CI ne lançait pas le lint, l'échec passait inaperçu.) ⚠️ **`mobile/` n'est PAS couvert** (hors workspaces npm) : ses 195 tests jest sont locaux uniquement.

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
- **Sabotage d'un verrou** ⚠️ : sauvegarder le fichier par **copie** (`cp f /tmp/f.bak`) et restaurer depuis elle. `git checkout <f>` restaure depuis HEAD — si le correctif n'est pas encore commité, il l'**efface** (arrivé). Committer avant de saboter, ou copier.
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
- **Expiration de promo** ⚠️ : helper pur **`isPromotionActive(hasPromotion, promotionEnd, now)`**, miroir back (`utils/pricing.ts`) ↔ front (`lib/pricing.ts`), cas partagés `promotion-active-cases.json`, `now` **injecté**. Échéance inclusive au jour calendaire **UTC**. ⚠️ **Miroir MOBILE (`posStore.ts`) PAS aligné** (hors CI).
- **Abonnements** : **aucun total n'est stocké** (dérivé de `product.sellPrice` → « au tarif du jour ») et **aucune colonne de fréquence** n'existe (`dayOfWeek` impose l'hebdo) — ne pas promettre en UI ce que le modèle ne porte pas.
- **Sidebar / permissions** : zone quotidienne épinglée + 4 groupes d'intention ; en-têtes masqués si aucune entrée `canAccess`. Pas de badge factice (seul Stock en a un, réel).

### Tests
- **Front : 610 vitest / 64 fichiers** *(mesuré 2026-07-29)* (helpers purs + anchor tests + contraste AA sur les 2 thèmes concrets dark+light). Lancer **`vitest run` COMPLET** avant tout push touchant landing/login/thème (`landing.anchor.test.tsx` fige le H1 du hero). **Back : 853 vitest / 90 fichiers** (prisma mocké `vi.mock('../db')`, routes via `app.inject()`, mock `authenticate` via `vi.hoisted`). ⚠️ **`strict: true` COMPLET côté backend** (`apps/backend/tsconfig.json`, item 10 fini backend — `strictNullChecks` était déjà on, les 21 erreurs restantes résiduelles — `noImplicitAny` params + `err` unknown dans les catch — ont été corrigées) : verrou prouvé (une régression de nullité/typage casse tsc/CI). **Frontend AUSSI `strict: true`** (102 erreurs résolues, surtout par typage des états de formulaire — `StockForm`/`CatForm`/`LabelConfig`/`CustomerForm`/`ContractForm`/`LeaveForm`/`DiscountForm` définis dans les modules partagés et threadés dans les props `form`/`setForm` — plutôt que des `any` mécaniques ; 2 vrais bugs de type révélés au passage : union `averyPreset` incomplète, config d'impression A4 vs thermique). Filet global `src/tests/setup/mockPaidSdks.ts` (`setupFiles`) : aucun test unitaire ne parle à un SDK payant (Anthropic/Twilio/Resend) — un `vi.mock` local garde précédence. **Mobile : 227 jest / 23 fichiers** (`cd mobile && npx jest`, cf. § Commandes). ⚠️ Certains tests montent une route avec un `total` DÉCOUPLÉ des lignes (ancien « trust client total ») → cassés par l'intégrité prix serveur-autoritaire ; envoyer des lignes qui somment au total voulu (cf. `loyalty.test.ts`). **Cas PARTAGÉS backend↔mobile↔frontend (anti-dérive)** via `docs/shared-fixtures/*.json` lus par les tests jumeaux des différents côtés — modifier la règle d'un côté sans l'autre fait échouer le test : `loyalty-discount-cases.json` (`computeLoyaltyDiscount` : arrondi/plafond 50 %/remise manuelle) ; `barcode-cases.json` (`normalizeBarcode`/`isValidBarcode`/`barcodeMatches`/`matchesScannedCode` — canonicalisation, recherche, résolution scan). ⚠️ Codes-barres : **méta-test** (front `barcode.test.ts`) échoue si une regex `\d{13}` locale réapparaît hors de `lib/barcode.ts` ; les 3 rendus (vignette écran + Avery + thermique) ont un test qui verrouille les **quiet zones ≥10 modules** ; PDF étiquettes non grep-ables → mocker jsbarcode/jsPDF et capturer les options (cf. `exportLabels`/`thermalLabel`/`barcodeVignette`). OCR : `vi.hoisted()` + classe constructeur. **PDF pdfkit non grep-able** (buffer binaire) → tester présence/absence de texte en **mockant pdfkit** et capturant les `.text()` (cf. `invoiceBilledTo.test.ts`). ⚠️ Route avec `schema` zod → `app.setValidatorCompiler(validatorCompiler)` avant `register` (cf. § Sécurité). Isolation cross-tenant : `tenantIsolation.test.ts` (mock Prisma tenant-aware).
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
- **SVG + `var()`** : `fill="var(--…)"` ne résout pas → `style={{color}}` + `fill="currentColor"`.
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
- **CSV injection** : `sanitizeCsv(v)` → préfixe `'` si valeur commence par `=+−@\t\r`.

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
- **Paie statuts** : state local pur (`Payroll.tsx`), perdu au refresh. Pas de table Payroll en base. **M**
- **Bundle recharts ~105KB gz** : lazy + hors precache. Remplacer visx = **L**.
- ✅ **A11y résiduel : FAIT** — SectionCatalog (4 champs `aria-label` : catalogue/slug/description/WhatsApp), POSModals sélecteur pays devenu vrai `role="listbox"` (+ `role="group"` par région, `role="option"`+`aria-selected` sur `CountryItem`), Stock vue grille en `role="list"`/`role="listitem"` (via props A11y additives de `ResponsiveGrid`).

## Comptes démo

⚠️ **`demo-tenant-001` et `demo-tenant-002` portent `isDemo = true`** depuis 2026-07-22 : toute action à coût externe ou destructive y est refusée côté serveur (403 `DEMO_TENANT_FORBIDDEN`, cf. § Garde de dépense). Le mot de passe démo est PUBLIC — c'est ce flag qui protège, pas la discrétion.

`demo1234` — `admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com`, tenant principal `demo-tenant-001` (« HabaShop — Dakar Central »). 5 employés (`demo-emp-${name}`). Données hors seed : `currency='EUR'`, `requireCashier=false`, `ownerPhone='+221771234567'`. Si reseed → repasser `requireCashier=false`.
**Multi-boutiques** : `admin@` et `manager@` sont liés à une 2ᵉ boutique `demo-tenant-002` (« Alimentation Koné — Abidjan », XOF) via `UserTenant` → login déclenche le sélecteur. `admin@` = SUPER_ADMIN/ADMIN, `manager@` = MANAGER/MANAGER. Les 3 autres restent mono-boutique.

## Env vars

**Railway** : `FRONTEND_URL` (**URL de l'app web — SOURCE UNIQUE backend**, `lib/appUrl.ts` ; déjà posée à `https://habashop.vercel.app`. Le jour d'un domaine propre, la changer ICI suffit : e-mails — logo, pied, liens login/upgrade/stock/dashboard — et redirections de paiement Campay/PayDunya suivent. Absente ⇒ repli sur l'URL vercel, comportement inchangé. ⚠️ NE PAS créer un second nom type `APP_URL` : `FRONTEND_URL` sert aussi la liste CORS. Verrou : `appUrlSource.test.ts` (8, sabotage vérifié) échoue si le littéral réapparaît dans `src/services`/`src/routes` — il ignore volontairement l'adresse factice `test@habashop.vercel.app` d'`admin.ts`. ✅ Les deux autres surfaces sont traitées : front statique via `VITE_APP_URL` (#158) et applicatif (#159), mobile via `EXPO_PUBLIC_APP_URL` (#160). **Quatre lectures, une valeur** — chaque plateforme a son environnement d'exécution, et les méta-tests verrouillent l'ÉGALITÉ des défauts), `DATABASE_URL`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`, `WAVE_WEBHOOK_SECRET`, Resend, Redis, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT` optionnel — Web Push PWA ; absents = feature inerte), `SMS_API_KEY` (+ `SMS_USERNAME` défaut `sandbox`, `SMS_SENDER_ID` optionnel — SMS Africa's Talking ; absente = feature inerte).
- MTN : `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS`
- Campay : `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS`
- PayDunya : `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS`

- Garde de dépense : `QUOTA_TRIAL_AI/OCR/WHATSAPP/WHATSAPP_MARKETING/EMAIL` · `QUOTA_ACTIVE_*` (défauts 20/15/30/**10**/20 et 200/150/300/**50**/200 ; `WHATSAPP_MARKETING` = placeholder bas) · `COST_BURST_PER_MIN` (défaut 10, `0` = désactivé) · `RATE_LIMIT_MAX` (global, défaut 300/min/IP). Tous **lus à l'appel** → ajustables sans redéploiement.

**Vercel** : **`VITE_APP_URL`** (URL publique de l'app — **miroir front de `FRONTEND_URL`** ; même valeur, deux plateformes où la poser, contrainte inhérente). Défaut garanti dans `apps/frontend/.env` (tracké). ⚠️ **Si elle manque, Vite livre le littéral `%VITE_APP_URL%`** dans `canonical`/`og:url`/JSON-LD — un canonical cassé désindexe, donc PIRE que l'URL en dur (mesuré). **Deux mécanismes, car les fichiers ne sont pas produits pareil** : `index.html` traverse Vite → substitution native `%VITE_APP_URL%` (9 balises) ; `public/` est copié **octet pour octet** → aucune substitution possible, d'où les gabarits `scripts/seo/*.tmpl` + `scripts/gen-seo.mjs` qui écrivent `dist/sitemap.xml` et `dist/robots.txt` au build (⚠️ ils ne sont donc plus servis par `vite dev` — sans effet, ils ne valent que déployés). Gardes : `npm run verify:seo-urls` inspecte le **`dist/` livré** (marqueur non substitué = échec, invisible pour tsc/tests puisque la SOURCE est correcte — c'est l'ENV de build qui manque) + méta-test `appUrlStatic.test.ts` (8, **4 sabotages**). ✅ **Les 6 liens user-facing de `src/`** (`Privacy.tsx` ×4, `PublicCatalog.tsx` ×2) passent par `src/lib/appUrl.ts` (#159) — module DISTINCT de `gen-seo.mjs`, qui tourne hors du pipeline Vite et n'a pas accès à `import.meta.env`. Verrou : bloc `src/` d'`appUrlStatic.test.ts` (3), qui interdit le retour d'un **`href`** en dur, pas toute mention du littéral (fixtures d'`Integrations.tsx`, repli `window.location.origin` de `SectionCatalog` — un verrou qui crie au loup se fait désarmer). `VITE_GOOGLE_MAPS_KEY` (.env tracké), `VITE_ENV`, `SENTRY_AUTH_TOKEN` (.env.local), `VITE_DEMO_MODE=1` (**déploiement DÉMO uniquement** — jamais en prod : sort le raccourci par rôle et `demo1234` du bundle).

**EAS (mobile)** : **`EXPO_PUBLIC_APP_URL`** (miroir mobile de `FRONTEND_URL`/`VITE_APP_URL` — URL de l'app WEB, à ne pas confondre avec `app.json` `version` qui pilote le runtime OTA et reste une piste séparée). Lue par `mobile/src/lib/appUrl.ts` ; absente = repli sur l'hôte actuel, comportement inchangé. ⚠️ **`mobile/.env` est gitignoré et n'atteint PAS le builder** : `eas.json` déclare `"environment": preview|production`, donc les variables viennent d'**EAS**. Mesuré le 2026-07-29 : `EXPO_PUBLIC_API_URL` n'est posée dans **aucun** environnement EAS — tout build/OTA tourne donc sur le repli littéral d'`api.ts`, et le `.env` local n'agit qu'en dev. Conséquence : `EXPO_PUBLIC_APP_URL` est **inerte tant que Nelson ne la pose pas** (`eas env:create --environment preview --name EXPO_PUBLIC_APP_URL`), exactement comme VAPID et SMS. ⚠️ **Expo inline `EXPO_PUBLIC_*` STATIQUEMENT au bundling** (substitution textuelle) → la variable doit apparaître en toutes lettres ; un accès calculé `process.env[clef]` ne serait jamais remplacé. D'où `normalizeAppUrl(raw)` séparé de `appUrl()` : la logique reste testable sans dépendre de ce que babel a inliné. Verrou : `mobile/src/__tests__/appUrl.test.ts` (8, **3 sabotages**) — il scanne **`src/` ET `app/`**, contrairement à `versionSource.test.ts` qui s'arrête à `src/` alors qu'un des sites vivait dans `app/(app)/(tabs)/settings.tsx`. ⚠️ **`mobile/` est hors CI** (hors workspaces npm) : ce verrou ne tourne qu'en local, `cd mobile && npx jest`.
