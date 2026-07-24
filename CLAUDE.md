# HabaShop — Guide Claude Code

SaaS de gestion commerciale multi-tenant **et multi-boutiques** (boutiques/superettes, Afrique de l'Ouest). **Monorepo unique `habashop`** : web (npm workspaces `apps/*`) + `mobile/` (Expo, hors workspaces) + `legal/` (pages légales).

## Stack

- **Frontend** (`apps/frontend`) : React 18 + TS + Vite 8 + vitest 4, Zustand (persisté localStorage), React Router ≥6.30.4, Lucide, recharts, jsbarcode (EAN-13/EAN-8/UPC-A), @zxing (scan), qrcode+html2canvas (fidélité), jspdf (étiquettes thermiques, **import dynamique**), cmdk (GlobalSearch), Playwright E2E, Sentry (org **haba-76** / projet **habashop-web**), PWA vite-plugin-pwa 1.x. Chunks `charts`/`barcode`/`canvas`/`pdf` EXCLUS du precache (runtime CacheFirst `lazy-chunks-cache`) — préserver si on touche `vite.config.ts`. ⚠️ **Cache SW = premier match gagne** (`workbox-routing/Router.js` `findMatchingRoute`) : une règle enregistrée après une règle plus large est **MORTE**. C'est arrivé — `products-cache` (SWR 7 j) n'a **jamais tourné en prod**, occultée par la règle `/api/`, alors que tout lecteur de la config y lisait la politique de cache du catalogue POS (supprimée ; SWR servirait un prix périmé même en ligne et rapide, or pour un prix de caisse la fraîcheur en ligne prime — `NetworkFirst` n'y retombe qu'au-delà du délai réseau). La règle API matche désormais le **chemin `/api/`, pas l'hôte** (l'hôte en dur mourait en silence si l'API déménageait — cf. `.env.production`). Garde CI : `npm run verify:sw-routes --workspace=apps/frontend` inspecte le **`dist/sw.js` livré** et échoue si une règle est inatteignable ou si une URL tombe sur le mauvais cache (invisible pour tsc/tests/revue : la source est valide, c'est l'ORDRE dans l'artefact qui tue). Vérifié dans les deux sens.
- **Backend** (`apps/backend`) : Fastify 5 + Prisma + PostgreSQL (Railway), bcryptjs + JWT, Resend, pdfkit, twilio, `@anthropic-ai/sdk ^0.96.0` (OCR Vision), `@fastify/multipart`, `@fastify/rate-limit` (**global**), **validation déclarative zod** (`fastify-type-provider-zod`, `validatorCompiler` global — cf. § Sécurité).
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, **base XOF**), multi-langues (fr/en/es/it).

## Structure du repo (monorepo)

Un seul repo `ndjoumessi/habashop` depuis juillet 2026 — fusion de `habashop-mobile` et `habashop-legal` via `git subtree` (historique préservé) :

- `apps/frontend`, `apps/backend` → **web** (workspaces racine `apps/*` + `packages/*`).
- `mobile/` → **app Expo** (ex-`habashop-mobile`). **Hors workspaces npm** : `package.json` + `package-lock.json` propres → `npm ci` à lancer *dans* `mobile/`. Builds/OTA EAS depuis `mobile/` (`cd mobile && eas update --branch preview`). Projet EAS inchangé (`projectId e7399d7a-…`, canal `preview`).
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
cd apps/frontend && npm run e2e              # Playwright live prod (tenant e2e) ; un spec : npx playwright test e2e/pos.spec.ts
npx tsc --noEmit                             # typecheck — dans chaque workspace touché
npm run lint --workspaces                    # eslint front+back
```

⚠️ `README.md` est **daté** (Fastify 4, 7 thèmes, 22/8 tests, « vercel depuis apps/frontend »…) — en cas de conflit, **ce fichier fait foi**.

## Déploiement

**Frontend Vercel** — **auto-déploiement prod sur push `main`** (vérifié 2026-07-19, Settings → Git : Production suit `main`). **NE PAS lancer `vercel --prod` manuel** — c'est redondant et ça consomme le quota (cf. § « Après un merge » ci-dessous).

**Backend Railway** — service `habashop`, projet `grateful-happiness`. **Auto-deploy GitHub sur push `main`.** Après déploiement : `npm run smoke:version --workspace=apps/backend` (le `/health` DÉPLOYÉ doit renvoyer la version racine — cf. § Versionnage).

### ⚠️ APRÈS UN MERGE : ne rien lancer. Vérifier, c'est tout.

`main` auto-déploie **sur les DEUX** plateformes. Donc après un merge :

- **NE PAS** lancer `railway up --ci` · **NE PAS** lancer `vercel --prod`.
- **VÉRIFIER** : `/health` (version + build id) côté back · un déploiement `● Ready` **plus récent que le merge** côté front.

Le geste manuel **double le déploiement** — deux redémarrages de conteneur au lieu d'un — et **brûle le quota Vercel** (free-tier = 100 déploiements/jour). Mesuré le 2026-07-23 : la prod servait déjà la version neuve **17 s** après le push, alors que le `railway up --ci` lancé « pour forcer » était encore en build ; il a produit un **second** déploiement du même commit. Le lag « ~20-25 min » qui justifiait le forçage n'a pas été observé.

Repli d'URGENCE seulement, si l'auto-deploy est *démontré* cassé (pas supposé lent) : `railway up --ci` depuis la racine · `vercel --prod --yes` depuis la **racine** (jamais `apps/frontend` → path doublé = échec).

**Déploiement couplé** : le push `main` déclenche les deux auto-deploys. Si le backend introduit une rupture d'API, l'ordre n'est pas garanti — vérifier que le back sert bien la version neuve **avant** de conclure que le front est bon.

⚠️ **Vercel — la PROD s'auto-déploie sur push `main`** (vérifié 2026-07-19). L'ancienne inférence « prod = manuelle » (basée sur PR #49 : déploiements prod sans métadonnée git) était **FAUSSE** : ces prod-là venaient bien du CLI **parce qu'on lançait `vercel --prod` en plus**, pas parce que l'auto-deploy manquait ; l'absence de prod après certains merges venait du **QUOTA épuisé**, pas d'une config absente. Donc : **rien à lancer à la main** — au prochain push sur `main` (quota revenu), la prod part seule. Le rôle de Claude = **VÉRIFIER** (`vercel ls --prod` → un déploiement **plus récent que le merge** et `Ready`), jamais conclure « déployé » sans ça, et **ne JAMAIS relancer `vercel --prod`**. **Preview branch tracking DÉSACTIVÉ** (Settings → Git) — il était sur « All unassigned git branches » = 1 preview par PR = la moitié du quota. Cible = **1 déploiement prod par merge, zéro preview, zéro geste manuel**. **Free-tier = 100 déploiements/jour.**

**Rituel commit** : `npx tsc --noEmit` (0) → `npm test` (verts) → `npm run build` (OK) → commit/push `main`. Git : push direct sur `main`, pas de feature branch.

**CI** (`.github/workflows/ci.yml`, Node 22) : tsc + **lint** + tests unitaires sur les deux workspaces, build front avec **garde de taille de bundle < 100 Ko gz** (`index-*.js`), scan de secrets en dur ; sur `main` uniquement : tests d'intégration (lecture seule contre la PROD) et E2E Playwright. ⚠️ **Le lint backend est un CLIQUET** : `--max-warnings 327` = l'état actuel, donc tout NOUVEL avertissement casse la CI. Ne pas relever le plafond pour faire passer un commit — corriger, ou l'abaisser quand on nettoie (descendu de 333 → 327 au fil de l'item 10, chaque suppression d'`any` abaissant le plafond d'autant). (Il était à 200 pour 333 avertissements réels : la CI ne lançait pas le lint, l'échec passait inaperçu.) ⚠️ **`mobile/` n'est PAS couvert** (hors workspaces npm) : ses 195 tests jest sont locaux uniquement.

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

**La version PRODUIT vit dans UN SEUL endroit : `version` du `package.json` RACINE** (actuellement **2.8.1**). Tout affichage/retour de version en dérive — **jamais de littéral en dur** (on a eu 6 versions divergentes : admin 2.6.0, /health 2.1.0, /health-extended 2.3.0, /api/docs 2.0.0, sidebar 1.0.0…).
- **Web** : injectée au build par Vite (`vite.config.ts` lit `../../package.json` racine) → `__APP_VERSION__` (brut « 2.8.1 ») + `__BUILD_SHORT__` (« v2.8.1 · JJ/MM », sidebar) + `__BUILD_ID__` (horodatage+SHA, `title`/Réglages). `AdminDashboard` utilise `__APP_VERSION__`. ⚠️ NE PAS lire `apps/frontend/package.json` (resté à 1.0.0).
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
- **Specs prescriptives** : si instruction ≠ code réel → réconcilie et continue. Questions réservées aux choix irréversibles.
- **Refactor transverse** ⚠️ : unifier N points d'appel dans un module unique fait perdre ce que chaque appelant distinguait, si le module ne remonte pas TOUTE leur information (statuts, codes d'erreur, détail par élément). Un goulot ne doit pas être un entonnoir. Corollaire éprouvé : **une surface à la fois, revue entre chaque** — trois refactors enchaînés sur le même code ont produit à chaque tour des régressions plus graves que ce qu'ils réparaient.
- **Test qui grep du texte source** (`expect(src).toContain(…)`) : prouve la SOURCE, pas le comportement. Il passe au rouge sur un simple reformatage et reste vert si le bloc devient inatteignable. Préférer l'injection de la route avec les dépendances mockées et l'assertion sur l'effet (cf. `redactPhone.test.ts`). Tout verrou doit être vérifié **dans les deux sens** : on le casse volontairement pour prouver qu'il détecte.

## État fonctionnel

### POS / Ventes
- **Paiements** : cash/wave/orange/mtn/card. **Mixte** : `Sale.cashAmount/mobileMoneyAmount/cardAmount`, `|somme−total|≤1` + ≥2 modes. Helper `lib/paymentSplit.ts`.
- **Idempotence** : `idempotencyKey` (`@@unique([tenantId,idempotencyKey])`), P2002 gérée.
- **Remboursement** : `POST /api/sales/:id/refund`, motif requis, restock optionnel, idempotent 409, `refunded` exclu CA + retire points.
- **Anti-survente** : backend `400 INSUFFICIENT_STOCK` (garde AVANT tx, décrément atomique). Front : `confirmSale` surface l'erreur + refetch stock. Tuile rupture grisée `opacity .45`. 4 tests `overselling.test.ts`.
- **Intégrité prix (ticket sécurité — `sales.ts`)** ⚠️ : le prix de base et le total sont **SERVEUR-autoritaires**. Un caissier authentifié pouvait forger une vente à prix arbitraire (`total:1` pour un produit à 1300) — vecteur de fraude interne silencieux, **indépendant du cache**. Désormais : le prix soumis n'est facturé QUE s'il correspond à un **point de tarif serveur légitime** (détail/demi-gros/gros, chacun résolu via palier+promo à la qté → pas besoin du `clientType`). Sinon = **divergence** : en ligne on facture le **prix serveur détail** ; « offline » on **honore le montant encaissé** (précision : une vente enregistrée reflète la transaction réelle, pas de re-tarification au rejeu). Total (`sale.total`) = Σ lignes serveur − remise − fidélité, **TVA serveur** (`tenant.vatRate`+`posVatIncluded` : TTC extrait / HT ajouté). **La déviation légitime (abîmé/négo) passe par la remise manuelle** (déjà tracée) — le panier n'offre AUCUN champ d'édition de prix de ligne. **⚠️ `clientCreatedAt` (offline) est FALSIFIABLE** → ce n'est PAS un signal vérifiable ; la protection anti-fraude est la **TRACE**, pas la branche : toute divergence écrit `SaleItem.submittedPrice`/`catalogPrice` + `Sale.priceDivergence=true`, dans les DEUX cas (online/offline), exploitée en **audit a posteriori** (filtre `GET /api/sales?priceDivergence=true`). Verrou : `salesPriceIntegrity.test.ts` rejoue la requête forgée (prix serveur + trace). **UI d'audit (ADMIN uniquement, dans l'historique POS)** : filtre « écarts de prix » + sous-filtre « en ligne uniquement », badge par vente, détail par ligne (soumis/catalogue/**écart en argent signé**/caissier). **QUALIFICATION « tarif précédent » (Chantier B, PR1)** ⚠️ : une divergence peut venir d'un **catalogue POS périmé** (le prix a changé, le terminal était encore sur son cache) et non d'un prix forgé — les deux produisaient la MÊME ligne ambre, donc *un cache périmé accusait un caissier honnête*. Désormais `Product.previousPricing` (Json) + `Product.pricingChangedAt` instantanéisent le jeu de tarifs **sortant** à chaque écriture qui change RÉELLEMENT un prix (`PUT /products/:id` ; un renommage ne consomme pas l'instantané), et `SaleItem.staleCatalogAt` porte la qualification. **Serveur-autoritaire de bout en bout** — aucune donnée client (≠ `clientCreatedAt`, falsifiable) : les colonnes sont hors de `PRODUCT_UPDATE` (liste blanche stricte), donc non forgeables. **DEUX conditions cumulatives** : le prix soumis appartient à `legitimatePrices(qty, previousPricing)` **ET** `now − pricingChangedAt ≤ STALE_CATALOG_WINDOW_MS` (48 h = 2× le TTL du cache SW `api-cache`). ⚠️ **La borne est indispensable** : sans elle un prix vieux de 3 mois serait qualifié et l'audit exonérerait une vraie fraude. **Profondeur 1 assumée** (deux changements rapprochés perdent le plus ancien) → non concluant ⇒ `null` ⇒ comportement historique, **jamais une affirmation d'innocence**. **N'influence RIEN de ce qui est facturé.** Concept partagé `legitimatePrices`/`toPricingSet`/`samePricing`/`PRICING_FIELDS` dans `utils/pricing.ts` (⚠️ toute nouvelle colonne de prix sur `Product` doit être ajoutée à `PRICING_FIELDS`, sinon un changement cesse d'être instantanéisé). Verrou : `staleCatalogDivergence.test.ts` (10 tests, **3 sabotages vérifiés** : borne temporelle, appartenance, détection de changement réel).
**UI d'audit (PR2)** : l'historique POS a désormais **TROIS** traitements, tous dérivés d'une source unique `priceGapLevel(rows)` (badge + cadre de détail + sous-filtre → jamais de désaccord possible) — `look` **ambre** (écart en ligne que le serveur n'explique PAS = à regarder) · `previous` **bleu** (`--c-blue-*`/`--info`, fait établi : « le tarif venait de changer » + par ligne « était le tarif catalogue jusqu'au JJ/MM HH:MM ») · `offline` **gris** (montant honoré, bénin). ⚠️ **Biais de PRUDENCE** : une vente mêlant expliqué et inexpliqué reste `look`. Le sous-filtre a changé de sens — « En ligne uniquement » → **« À regarder »** (`priceGapLevel === 'look'`) : garder tous les écarts « en ligne » y ferait entrer les caches périmés, c.-à-d. du bruit qui ressemble à une tentative. Helpers purs **exportés** de `POSProductGrid.tsx` (`priceDivergenceRows`/`priceGapLevel`/`staleUntilLabel`), verrou `priceGapLevel.test.ts` (11 tests, sabotage vérifié).

**Deux sens DISTINCTS dérivés des lignes** : `unitPrice===catalogPrice` ⇒ **corrigé (EN LIGNE)** = tentative à regarder (ambre) ; `unitPrice===submittedPrice` ⇒ **honoré (HORS-LIGNE)** = bénin (gris). Vocabulaire **factuel** (« écart de prix », jamais « suspect »/« fraude »). Masqué aux MANAGER/CASHIER (`canAuditPrices`). Backend : `cashier.name` ajouté à l'include de `GET /api/sales`.
- **Réconciliation du total encaissé (Chantier B, (c))** ⚠️ : `confirmSale` **JETAIT** la réponse de `POST /api/sales`. Or le serveur est autoritaire sur le prix : s'il re-tarife (catalogue du terminal périmé), il facture un autre montant que celui encaissé → **caisse courte, sans cause explicable à la clôture**. Désormais la réponse est capturée ; `reconcileSaleTotal(serverTotal, netTotal)` (`components/pos/saleReconcile.ts`, tolérance **1** comme le paiement mixte) signale au caissier **combien réclamer ou rendre**, tant que le client est au comptoir (toast 15 s + `announce`). ⚠️ `authoritativeTotal` alimente **le ticket imprimé ET le reçu WhatsApp** — les deux affichaient le total CLIENT alors que la facture PDF porte le total SERVEUR (le reçu WhatsApp envoyait même le **BRUT**, remise fidélité ignorée). Le total serveur transite par une **`ref`** (`billedTotalRef`), pas un state : `printTicket` est appelé dans la même passe que l'enregistrement, et garder sa signature à zéro argument évite le piège `onPrint={printTicket}` (l'événement passerait en 1er argument). ⚠️ **`Number(null) === 0`** : sans filtre d'absence explicite, un total serveur absent déclenchait « rendre 1 000 F » sur une vente saine et imprimait un ticket à **0** — l'absence de donnée doit rester une absence (`readTotal`). **Effet de bord utile** : une alerte sur une vente au tarif courant signale une **dérive des miroirs front/back** (TVA `computePosVat`, fidélité) — c'est un signal, pas un faux positif à museler. Verrou : `saleReconcile.test.ts` (11 tests, sabotage vérifié). Aucun appel réseau ajouté au chemin critique. *(Prévenir AVANT l'encaissement = décision produit ouverte : que devient le panier quand un tarif bouge en cours de vente ?)*
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

### Autres modules
- **Produits** : SKU `PRD-NNNN`, priceTiers, scan @zxing.
- **Codes-barres (Chantier A)** : RÈGLE CANONIQUE UNIQUE `src/lib/barcode.ts` — **3 miroirs** (backend/mobile/frontend, à l'identique) testés contre `docs/shared-fixtures/barcode-cases.json`. `normalizeBarcode` (EAN-13 · EAN-8 conservé tel quel · **UPC-A→EAN-13** par préfixe « 0 », **JAMAIS de strip des zéros de tête** — casserait le round-trip scan) ; `isValidBarcode`/`isAcceptableBarcode` (garde saisie) ; `barcodeMatches` (RECHERCHE : sous-chaîne OU égalité canonique) ; `matchesScannedCode` (SCAN→panier : barcode canonique **OU SKU EXACT**, jamais sous-chaîne — un faux positif caisse coûte plus cher qu'un échec) ; `quietZonePx` (silence latéral **≥10 modules**, GS1 11). Backend `checkBarcode` (POST/PUT products) : EAN-13/EAN-8/UPC-A + **unicité par tenant** (findFirst hors soft-deleted → 400 `INVALID_BARCODE` / 409 `DUPLICATE_BARCODE`) ; PAS de `@@unique` DB (barcodes vides + soft-delete). ⚠️ Toute logique barcode passe par le lib — **méta-test** (`barcode.test.ts` front) échoue si une regex `\d{13}` locale réapparaît hors du lib. **Scan = geste PRINCIPAL** (fiche `StockModals` + POS `handleScan` web/mobile + scan de recherche inventaire) ; recherche par nom/**SKU**/barcode (web inventaire+POS, mobile stock+globale) ; « Générer » (EAN-13 interne préfixe 200, `generateEAN13`) = second recours **réservé au vrac** (sélection explicite + confirmation). **Rattrapage** guidé `StockBackfill.tsx` (produits sans code → scan/génère par ligne + planche A4). Vignette fiche (`BarcodeVignette`) = surface blanche unique cliquable-pour-copier, quiet zones bakées dans le SVG (`quietZonePx`).
- **Étiquettes** : planche **A4 Avery** (`utils/export.ts printProductLabels`, rattrapage en masse) + **thermique 40×30 mm** (`utils/thermalLabel.ts printThermalLabels`, jsPDF import dynamique, à l'unité, chunk `pdf` hors precache). Les DEUX : barcode rendu via **jsbarcode LOCAL** (plus de CDN), **EAN-13/EAN-8 uniquement** (JAMAIS de CODE128-sur-SKU = code non standard, piège caisse), quiet zones ≥10 modules (`quietZonePx`). Sans code EAN → **zone repliée** (nom/SKU/prix, étiquette de prix propre) : AUCUNE mention sur l'étiquette (face client) ; l'alerte « N sans code-barres → compléter » vit dans la modale Étiquettes AVANT impression (→ ouvre le rattrapage). **Prix en NOIR gras** sur les DEUX (jamais le violet écran `#5B4EE8` : impression bureau souvent N&B → violet = gris pâle sur l'info la plus importante + encre couleur ; thermique = monochrome, `setTextColor(0)` explicite). **Pas d'émoji sur la planche Avery** (le 📦 générique par défaut n'apporte rien, redondant avec le produit sur lequel l'étiquette est collée ; thermique n'a jamais rendu d'émoji — Helvetica). Thermique : gabarit 40 mm, marge page 1 mm → module ≈ 0,325 mm (proche nominal GS1, absorbe l'étalement d'encre).
- **Transferts stock** (multi-boutiques v2) : `StockTransfer` (`pending → completed | cancelled`), MANAGER+. `POST /api/stock/transfers` (vérif accès aux 2 boutiques, anti-soi-même, **décrément gardé** `updateMany stockQty>=qty`), `GET` (source OU dest = active, `?status`), `PATCH /:id/confirm` (dest only → incrément ; produit dest retrouvé **SKU→barcode, sinon copié depuis source**), `PATCH /:id/cancel` (source ou dest → restitue stock source). Push `stock_transfer`. Front : onglet Stock « ↔ Transferts » (si >1 boutique), badge sidebar Stock = transferts reçus en attente.
- **OCR factures** : `POST /api/suppliers/scan-invoice` (multipart 10MB), Claude Sonnet 4.6 Vision. `unitPrice` OCR = devise facture → `formatInCurrency` (pas `fmt`). `suppliersApi.scanInvoice` = fetch brut FormData.
- **Facture PDF (backend, LA vraie)** : bouton historique POS → `GET /api/sales/:id/invoice` → `lib/invoicePdf.ts` (**pdfkit**), `FAC-{YYYY}-{NNNNN}` idempotent (`Sale.invoiceNumber`). ⚠️ **Générateur DISTINCT** du devis frontend (`generateInvoice`) — deux parcours vivants, corriger les DEUX. Séparateur : `pdfSafeSpaces()` (U+202F/U+00A0 → espace simple ; Helvetica/WinAnsi n'a pas de glyphe U+202F → « 8 /500 » sinon) dans `fmtMoney` → couvre facture + Ticket Z PDF (`ticketZ.ts` réutilise `fmtMoney`) + PDF TVA (`reports.ts` fmt2). Logo Sac+H vectoriel pdfkit — `drawLogo()` **exporté** d'`invoicePdf.ts` et **partagé** (facture + Ticket Z + PDF TVA, source unique du dessin) ; pill « Payée » (cercle tracé, « ● » absent en WinAnsi), mentions légales `ninea/rccm/vatNumber` si configurées. E-mails (`email.ts`) : logo = **PNG hébergé** `/pwa-192x192.png` (Outlook ne rend pas le SVG inline), plus l'emoji 🛍️.
- **Facture/devis client (`utils/export.ts` generateInvoice)** : document dédié (logo Sac+H, filet violet, statut Payée/En attente, Total TTC). **Tout montant imprimé passe par `printableAmount()`** (U+202F/U+00A0 → espace simple — sinon « 2 /800 » en monospace ; vaut aussi pour posTicket + rapport Z) et toute donnée dynamique par `escHtml()`. Pied légal : `Tenant.ninea/rccm/vatNumber` (String?, PATCH tenant trim + ''→null + max 64), UI Réglages → Boutique « Infos légales », affichés seulement si renseignés.
- **Ticket Z** : `@@unique([tenantId,date])`, upsert idempotent, CA hors refunded, breakdown COALESCE(split, paymentMode).
- **WhatsApp** : auto-vente (Twilio, fail-silent), manuel (`/api/whatsapp/send-ticket`), crons gérant (20h/8h TZ Dakar, **uniquement si `Tenant.ownerPhone` non null**). Campagnes : `POST /api/marketing/whatsapp/campaign`, rate-limit 1/h Redis, segments fidélité.
- **Finance** : CSV comptable `GET /api/reports/accounting/csv` (UTF-8 BOM, semicolons, `sanitizeCsv()` anti-injection). TVA : `GET /api/reports/vat` + `/csv` + `/pdf` (pdfkit). `buildVatData()` partagé.
- **RH/Planning** : `Attendance` (`@@unique([tenantId,employeeId,date])`), `Shift` (même type interdit), `LeaveRequest`. Planning = `shiftsByDate Record<"empId_date", {type,id}[]>`, MAJ optimiste + rollback. Clavier PlanningGrid (Entrée/flèches/Échap/Suppr via GripVertical) — ne pas casser.
- **Paie** : bulletins jsPDF, cron idempotent via `Tenant.lastPayrollReportMonth`, `dryRun:true` par défaut.
- **Rapport comptable** : `GET /api/reports/accounting?month=YYYY-MM` (Redis cache), conversion XOF→devise serveur → modale formate sans reconvertir.
- **Intégrations** : métriques réelles uniquement. `noPing` masque grille latence. Sentry = `GET /api/integrations/sentry/status` backend.
- **Auth** : JWT + bcrypt12, `ROLE_PERMISSIONS` slug-based, `canAccess(role, slug)`. Rate-limit **global** 300/min/IP + overrides (login 30/15min, register 5/h…). Register : mot de passe ≥ 8 (validé zod). WS `/api/ws` fail-closed.
- **Audit** : `AuditLog` = échelle BOUTIQUE (`tenantId` requis + FK). `UserAuditLog` = échelle UTILISATEUR, **hors boutique** (changement de mot de passe : n'appartient à aucune boutique) — **SANS FK vers User** (un audit de sécurité SURVIT à la suppression du compte ; instantanés `userEmailSnapshot`/`userNameSnapshot` gardent la ligne lisible), hors liste scopée de l'extension Prisma. Lecture : `GET /api/account/security-activity` (userId courant) + `GET /api/admin/security-events` (console plateforme). ⚠️ **TOUTE écriture d'audit passe par `writeAudit(label, promise)`** (`lib/writeAudit.ts`) : fail-open mais TRACÉ (console.error + Sentry) — remplace le `.catch(() => {})` qui rendait un échec d'audit invisible. EXCEPTION : les 3 sites en `$transaction` (`sales`, `accountDeletion` ×2) propagent (échec ATOMIQUE). Verrou : `auditWriteConvention.test.ts` (méta-test : aucun `prisma.auditLog.create` avalé hors transaction). La lecture `/api/audit-logs` REMONTE l'erreur (plus de `catch→[]` : un journal muet ment).
- **Multi-boutiques** : `UserTenant` (many-to-many User↔Tenant, **rôle PAR boutique**). JWT porte `activeTenantId` (nullable) + `role` de la boutique active ; rétro-compat anciens tokens (`tenantId`). `authenticate` → `req.tenantId = activeTenantId`, **400 `NO_ACTIVE_TENANT`** sur routes métier sans boutique (exemptés : `/api/auth/*`, `/api/dashboard/consolidated`). ⚠️ **DEUX champs tenant, DEUX helpers** (`lib/tenantId.ts`, item 10) : `request.user.tenantId` (`string|null`, source héritée du JWT) → **`getTenantId(request)`** ; `request.tenantId` (`string|undefined`, boutique ACTIVE résolue par `authenticate`, W2-correct) → **`getActiveTenantId(request)`**. Les deux rétrécissent en `string` non-nullable et LÈVENT `TENANT_CONTEXT_MISSING` (défense en profondeur si une route tenant-scopée était montée sans le garde). Placer l'appel **APRÈS les gardes 400/403** (sa levée ne doit pas préempter un refus existant). `getActiveTenantId` est la couture de la future convergence W2. ⚠️ NE PAS confondre les champs : sur une route platform-scopée (`authenticateAdmin`, non gardée par `NO_ACTIVE_TENANT`) `request.user.tenantId` est légitimement nullable → `getTenantId` y lèverait à tort. Login : 1 boutique → directe ; >1 → `activeTenantId=null` + `tenants[]` (sélecteur). Endpoints : `POST /api/auth/switch-tenant` (rate-limit 10/min, vérif `UserTenant`→403), `GET /api/auth/tenants`, `POST /api/tenants` (ADMIN+, créateur lié ADMIN), `POST /api/tenants/:id/invite`, `GET /api/dashboard/consolidated` (CA XOF tous tenants). Front : `authStore.switchTenant()` → **rechargement complet** (`window.location`, pas de TanStack Query). `SelectShop.tsx` (sélecteur login), `TenantSwitcher.tsx` (sidebar, si >1), `ConsolidatedShops.tsx` (dashboard), Settings « Mes boutiques » (`SectionShops`, ADMIN+).
- **Admin PLATEFORME (super-admin SaaS)** : `User.isPlatformAdmin` (Boolean) = **SEUL** critère d'accès à `/api/admin/*` (`middleware/superAdmin.ts` `authenticateAdmin`), claim signé dans le JWT (login/switch, relu DB au switch). ⚠️ **JAMAIS gater sur le rôle `SUPER_ADMIN`** — c'est un rôle INTERNE au tenant (suppression tenant, notifs) ; gater dessus = fuite inter-tenants (P0 corrigé, cf. `adminPlatformIsolation.test.ts`). Anciens JWT sans le claim → 403 fail-closed. Provisioning **hors API, sans mdp en dur** : `apps/backend/scripts/set-platform-admin.ts` (`CONFIRM=1 PLATFORM_ADMIN_EMAIL=…`, promeut un user EXISTANT ; option `PLATFORM_TENANT=1` marque son tenant `isPlatform`). `Tenant.isPlatform` (Boolean) = tenant staff **exclu des listings/quotas/agrégats** de `/api/admin/*` (via relation `tenant.isPlatform`, `basePrisma`). Migrations additives appliquées : `isPlatformAdmin`, `Tenant.isPlatform`.
  - **Coquille opérateur (l'app du SaaS, pas une greffe commerçant)** : à la connexion, `landingFor(user)` (authStore) envoie un `isPlatformAdmin` sur **`/admin`** — critère **EN PARALLÈLE du rôle**, JAMAIS à sa place (`getLandingForRole` basé rôle reste intact). ⚠️ **Ne JAMAIS masquer le commerçant par le RÔLE** (un ADMIN commerçant garde api-docs/intégrations/utilisateurs) — le dépouillement se fait sur `isPlatformAdmin`. **PREUVE : `platformAdminShell.test.ts`** verrouille cet accès. Masquage **INTERFACE-only** (si l'opérateur force `/app/pos` il voit SA boutique vide → aucune donnée client, PAS de gate serveur, ≠ P0). `AdminDashboard.tsx` = console standalone (pas d'`AppLayout` commerçant) : **volet compte MINIMAL** (mot de passe/langue/thème, pas la page Réglages) + déconnexion, aucune entrée/badge/bandeau commerçant. Gardée par `PlatformAdminOnly` (≠ `AdminOnly` tenant qui reste pour api-docs/integrations).
  - **Contenu console** : **ACTIVATION en héros** (boutiques inscrites n'ayant JAMAIS ajouté de produit + entonnoir Inscrites→Produit→Vente + liste triée « jamais revenues » d'abord) ; **une seule liste « boutiques à traiter »** (fusion rétention+facturation, motif en étiquette : essai ≤3j/inactive/demande de plan/paiement à vérifier) ; **santé technique** (`OpsInfrastructure`, infra récupérée des intégrations) ; **« Relancer »** = lien e-mail pré-rempli (pas d'envoi auto). ⚠️ **SUPPRIMÉS** : cartes MRR/segments/**churn estimé** + graphe 6 mois (chiffres qu'on regarde sans agir). Données réelles only. *(« Voir en tant que » = design d'audit séparé, NON construit.)*
    - ⚠️ **États vides EXPLICITES (outil de surveillance)** : une section qui **disparaît** à vide empêche de distinguer « rien à signaler » de « fonction absente » → chaque section dit son vide. **Héros activation** à 0 « jamais activées » = **état de succès** (coche verte `CheckCircle2`/`--acc2`, fond vert discret, « Toutes vos boutiques ont démarré ») — le zéro géant + liseré `--warn` n'apparaissent qu'**≥1**. **« Boutiques à traiter »** TOUJOURS rendue ; vide → **checklist** nommant chaque signal surveillé comme sain (« aucun essai n'expire dans les 3 jours », « aucune boutique inactive », « aucune demande de plan en attente », « aucun paiement à vérifier »), badge de compte = `0` factuel. Onglets Boutiques/Demandes = `EmptyState`. **Ne jamais masquer une section vide** dans la console. Légendes **factuelles** (« inscrites sans aucun produit enregistré », pas « c'est là qu'un SaaS se perd » — pas de phrase de cadrage dans l'outil quotidien).
  - **Intégrations réparties par PUBLIC** : `/app/integrations` (commerçant) = **paiements + canaux uniquement** (MTN/Campay/PayDunya, Twilio/Resend) ; l'**infra** (Prisma/Redis/Railway/Vercel/monitoring) est retirée (publiait la stack aux clients) → `OpsInfrastructure` (console `/admin`). `MERCHANT_CATS`/`OPS_CATS` exportés d'`Integrations.tsx`. `/app/api-docs` **reste commerçant** mais le « Cahier des charges » (doc interne) est retiré.
- **Sidebar** (`components/layout/Sidebar.tsx`) : **zone QUOTIDIENNE épinglée** (Point de vente / Tableau de bord / Stock, bloc distinct) + **4 groupes d'INTENTION** (`nav_sec_sell/manage/analyze/configure` : Vendre / Gérer / Analyser / Configurer). Système+Administration fusionnés dans Configurer. Pas de badge factice (seul Stock = badge réel transferts). En-têtes masqués si aucune entrée accessible (`canAccess`). `ROLE_PERMISSIONS` : CASHIER sans Finance/RH ; « Activité » (journal) = MANAGER+/ADMIN (retiré à HR).
- **Emails Resend** : `escHtml()` + `baseTemplate()`. `email @unique` libéré au soft-delete.
- **GlobalSearch** : `GlobalSearch.tsx` (cmdk), Cmd+K/Ctrl+K dans AppLayout. Catégories : produits, clients, commandes, fournisseurs, actions rapides. Filtrées par `canAccess(role, slug)`.
- **Onboarding** : wizard 5 étapes `Onboarding.tsx`, route `/onboarding`. Flag `habashop_onboarded` localStorage. Auto-redirect depuis Dashboard pour ADMIN sans produits/ventes.

### Tests
- **Front : 445 vitest / 51 fichiers** (helpers purs + anchor tests + contraste AA sur les 2 thèmes concrets dark+light). Lancer **`vitest run` COMPLET** avant tout push touchant landing/login/thème (`landing.anchor.test.tsx` fige le H1 du hero). **Back : 711 vitest / 74 fichiers** (prisma mocké `vi.mock('../db')`, routes via `app.inject()`, mock `authenticate` via `vi.hoisted`). ⚠️ **`strictNullChecks` ACTIVÉ** (`apps/backend/tsconfig.json`, item 10 — `strict:false` reste, seul ce flag est on) : verrou prouvé (une régression `string|null → string` casse tsc/CI). Filet global `src/tests/setup/mockPaidSdks.ts` (`setupFiles`) : aucun test unitaire ne parle à un SDK payant (Anthropic/Twilio/Resend) — un `vi.mock` local garde précédence. **Mobile : 195 jest.** ⚠️ Certains tests montent une route avec un `total` DÉCOUPLÉ des lignes (ancien « trust client total ») → cassés par l'intégrité prix serveur-autoritaire ; envoyer des lignes qui somment au total voulu (cf. `loyalty.test.ts`). **Cas PARTAGÉS backend↔mobile↔frontend (anti-dérive)** via `docs/shared-fixtures/*.json` lus par les tests jumeaux des différents côtés — modifier la règle d'un côté sans l'autre fait échouer le test : `loyalty-discount-cases.json` (`computeLoyaltyDiscount` : arrondi/plafond 50 %/remise manuelle) ; `barcode-cases.json` (`normalizeBarcode`/`isValidBarcode`/`barcodeMatches`/`matchesScannedCode` — canonicalisation, recherche, résolution scan). ⚠️ Codes-barres : **méta-test** (front `barcode.test.ts`) échoue si une regex `\d{13}` locale réapparaît hors de `lib/barcode.ts` ; les 3 rendus (vignette écran + Avery + thermique) ont un test qui verrouille les **quiet zones ≥10 modules** ; PDF étiquettes non grep-ables → mocker jsbarcode/jsPDF et capturer les options (cf. `exportLabels`/`thermalLabel`/`barcodeVignette`). OCR : `vi.hoisted()` + classe constructeur. **PDF pdfkit non grep-able** (buffer binaire) → tester présence/absence de texte en **mockant pdfkit** et capturant les `.text()` (cf. `invoiceBilledTo.test.ts`). ⚠️ Route avec `schema` zod → `app.setValidatorCompiler(validatorCompiler)` avant `register` (cf. § Sécurité). Isolation cross-tenant : `tenantIsolation.test.ts` (mock Prisma tenant-aware).
- **E2E Playwright** : live prod sur **tenant dédié `e2e-tenant`** (EUR, `requireCashier=true`, compte `e2e@habashop.com` SUPER_ADMIN mono-boutique) — issue #5 close. Fixtures **statiques** via `apps/backend/scripts/seed-e2e-tenant.ts` (idempotent, guard `E2E_SEED=1` + scope `e2e-tenant`, **manuel** ; jamais demo/prod). Fixtures **datées** (ventes du jour → `dashboard-donut`) créées par API dans `auth.setup` (`e2e/helpers/fixtures.ts`, **pas de secret DB** en repo public). `auth.setup` login `e2e@` ; `e2e/helpers/preconditions.ts` + `test.skip` conditionnels = garde-fou (0 skip nominal). `storageState` `e2e/.auth/user.json`, `workers:1`. **Smoke : navigation par clic** (pas `page.goto` après login → logout cold-start). **BASE surchargeable** : `playwright.config` + chaque spec lisent `E2E_BASE`/`PAYROLL_BASE`/`POS_BASE`/`STOCK_BASE`/`PAGES_BASE`/`DASH_BASE`/`CUST_BASE`/`HR_BASE`/`REPORTS_BASE`/`SETTINGS_BASE` (défaut prod) → pour valider un build local, `vite preview` + **tout** mettre sur `http://localhost:PORT` (sinon cross-origin : auth locale ≠ site prod → redirection login). API prod (build) = `https://habashop-production.up.railway.app` (Railway, cold-start ~lent, free-tier).
- **A11y** : `useModalFocus` (34 modales), `announce()` (8 domaines), skip-link, `*:focus-visible`, `prefers-reduced-motion`.

## Règles devise / montants ⚠️

- **Tout XOF en base.** `fmt()`/`useFormatAmount()` convertissent XOF→devise. **Ne JAMAIS pré-convertir** (= double conversion).
- **Exception** : valeurs déjà en devise tenant (`pointsPerAmount`, remises fidélité, valeur carte) → `formatInCurrency` SANS conversion.
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
- **Crons** : `setInterval` + garde fenêtre-temps + marqueur idempotent en base.
- **Webhooks** : HMAC-SHA256 raw body, `timingSafeEqual`, **fail-closed partout** (Wave inclus : `wave.ts` `if (!secret) return false`). Reste à poser `WAVE_WEBHOOK_SECRET` en prod.
- **Tests PDF** : signature `%PDF` + taille >500o.
- **CSV injection** : `sanitizeCsv(v)` → préfixe `'` si valeur commence par `=+−@\t\r`.

### Sécurité (remédiation audit 2026-07 — `docs/audits/AUDIT_APPROFONDI_2026-07.md`)
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

### ⚠️ Chantier NORMALISATION téléphonique — RÉSOLU à la 5ᵉ tentative. Lire avant de retoucher.

**Une normalisation EST désormais en place** (PR #100, `lib/spend/recipientPhone.ts`
`resolveRecipient`) — après **4 échecs** dont **3 fuites** annulées. Ce qui a marché,
et qui manquait aux quatre premières : poser la question **AVANT** la bibliothèque —
« à qui appartient ce numéro ? » — via un **paramètre `owner` OBLIGATOIRE** sur
`sendWhatsApp` (`{ kind:'merchant', country } | { kind:'customer' }`) :
- **flux commerçant** (`ownerPhone`, crons) → normalisable avec `tenant.country`
  UNIQUEMENT si `isSupportedCountry()` ; sinon refus `COUNTRY_UNKNOWN` ;
- **flux client** (reçu, send-ticket, send-alert, broadcast, campagne) → AUCUNE
  inférence de pays ; on n'accepte qu'un `+` littéral que `isValid()` valide, sinon
  refus `PHONE_NOT_INTERNATIONAL`/`PHONE_INVALID` ;
- le refus REMONTE (`SendResult.refused[]`) → 422 « format international requis », jamais
  un `+` deviné vers Twilio.
Le compilateur force `owner` sur tout futur appelant ; les pré-transformations amont
(`00→+`, `replace(/^0/)`, `+` collé, le mapping des campagnes) sont **supprimées** — le
goulot `resolveRecipient` est la seule autorité. Verrous : `phoneCollision.test.ts`
(harnais de collision, 2 sabotages) + `phoneChokepoint.test.ts` (méta-test : `libphonenumber-js`
interdit hors du résolveur, motifs de fabrication `'+' +`/`` `+${…}` ``/`replace(/^0/)`
interdits sur la surface d'envoi — **résidu assumé** : un motif de fabrication INÉDIT
passerait, la couche solide est `owner` obligatoire + relancer le harnais sur tout nouveau
chemin). **Ne PAS revenir sur cette conception** ; l'historique ci-dessous est le POURQUOI.

Les quatre tentatives précédentes, dont trois fuites de données annulées :

| # | Commits | Annulé par | Ce qui fuyait |
|---|---|---|---|
| 1 | `7fe8b4e7`/`da26197e` (`lib/spend/phone.ts`) | `1ae8f9c0` | table `trunkZero` écrite à la main + repli Sénégal → numéro mal formé réécrit en **SN valide**, donc livré |
| 2 | `18cc6eb9` (`lib/phoneE164.ts`) | `77d954f6` | `Tenant.country` appliqué au numéro du **DESTINATAIRE** |
| 3 | `f447a462` (`SendAudience`) | `61f94c7d` | la réécriture `00`→`+`, pourtant documentée « sans supposition de pays » |

Chaque fois : avant, Twilio rejetait (21211) et **rien ne partait** ; après, un numéro
**valide d'un autre pays** était fabriqué et **livré**. Reçus clients et résumés de
commerçants expédiés à des inconnus.

#### Faits MESURÉS — ne pas les re-dériver, ils ont coûté trois fuites

Vérifiés sur `libphonenumber-js` 1.13.9. Chacun infirme une garantie qui « allait de soi » :

- **Le pays du commerçant n'est PAS une information sur le numéro de son CLIENT.**
  `isValid()` ne sépare que des plans **disjoints**. Collisions réelles :
  `621234567` est valide en **CM** (`+237…`) *et* en **GN** (`+224…`) ; `76123456` est
  valide simultanément en **ML, BF, NE, TG**. Une boutique camerounaise avec une cliente
  guinéenne fabriquait donc un `+237…` réel appartenant à un tiers.
- **La bibliothèque FABRIQUE, elle ne refuse pas.**
  `parsePhoneNumberFromString('0701234567','SN')` renvoie un objet **non nul** dont
  `.number` vaut `+2210701234567`. Seul `isValid()` (faux ici) l'écarte. Renvoyer
  `.number` sans exiger `isValid()` = la fuite d'origine, à l'identique.
- **`00`→`+` n'est PAS une réécriture « purement syntaxique ».** Elle suppose que les
  chiffres suivants commencent par un indicatif pays. `00622123456` → `+622123456`,
  numéro **indonésien valide**. Une caissière à qui l'UI dit « format international »
  tape le préfixe qu'elle connaît, et le reçu part à Jakarta.
- **« Twilio rejettera un numéro mal formé » est FAUX.** `+622123456` est valide.
  Préfixer `+` à l'aveugle produit des numéros étrangers **livrables**. Donc
  *« on ne normalise pas »* ne vaut **jamais** *« on n'envoie pas »* : il faut refuser
  d'envoyer explicitement.
- **Le zéro de tête n'est pas uniforme** : CI/BJ/**CG** le CONSERVENT
  (`061234567` → `+242061234567`), **GA** le RETIRE (`062345678` → `+24162345678`).
  D'où l'interdiction de toute table écrite à la main.

#### Invariants pour la reprise

1. **Pays inconnu ou absent → on NE normalise PAS.** Jamais de repli, surtout pas SN.
2. **On n'envoie QU'À un E.164 validé.** Non résolvable ⇒ destinataire écarté, pas un `+`
   deviné. Un message non envoyé est bénin ; un message au mauvais destinataire est une fuite.
3. **Séparer les flux** (fondation, validée avec Nelson) : numéro lu dans `Tenant.ownerPhone`
   ⇒ normalisable avec le pays de la boutique ; **toute autre provenance** (fiche client,
   corps de requête, liste de diffusion) ⇒ international EXIGÉ, aucun pays consulté. Le flux
   se déduit de la **PROVENANCE**, jamais de l'intention — `send-alert` reçoit son numéro du
   corps de requête, donc c'est un tiers.
4. **`libphonenumber-js` est nécessaire mais PAS suffisant** : c'est le gate `isValid()` +
   la séparation des flux qui protègent, pas la bibliothèque.

#### État réel des données (lecture seule, 2026-07-23)

- `Tenant.country` : `String @default("SN")` **non nullable**, + `country ?? 'SN'` dans
  `auth.ts:166` / `admin.ts:62` / `tenant.ts:65`, + `SignupPage.tsx:29` pré-sélectionne SN.
  « Pays absent » **n'existe pas en base** : un tenant ivoirien qui n'ouvre jamais la liste
  est stocké « SN ». Pire, `Onboarding.tsx` PATCHe des **noms français** là où `SignupPage`
  envoie de l'ISO-2 → prod contient `CI`, `SN` et **`France`**. `sales.ts` ne lit pas le champ.
- **`Customer` n'a AUCUN champ pays** → aucune donnée ne permet de résoudre un national de client.
- **9 téléphones clients sur 9 sont déjà internationaux** en prod → l'exposition actuelle est
  nulle, mais rien ne la maintient ainsi.

#### Défauts PRÉEXISTANTS — TOUS RÉSOLUS (sous-surfaces 1 & 2, PR #100/#102/#105/#106)

Les quatre invariants ci-dessus sont désormais IMPLÉMENTÉS par `resolveRecipient`. Et
toute la dette qui les entourait a été traitée :

- ✅ `twilioClient.normalize()` (`+` aveugle) et send-alert `replace(/^0/)` → **SUPPRIMÉS**,
  remplacés par le goulot `resolveRecipient` (#100).
- ✅ `broadcast`/`campaign` normalisaient différemment → **unifiés** au goulot (#100).
- ✅ `failed: 0` quand Twilio absent + table `TWILIO_ERRORS` inatteignable → **corrigés** :
  `SendResult` compte exactement (`failed: N`) et remonte `errorCodes[]` (#102, PR A).
- ✅ créneau horaire 1/h brûlé sur un refus → **réserve-puis-libère**, consommé QUE sur un
  envoi réel (#105, PR C).
- ✅ campagnes et reçus partageaient un seau + reçu soumis au plafond minute → **deux seaux
  `SpendKind`** (`whatsapp` transactionnel / `whatsapp_marketing`) + le reçu de vente
  AUTOMATIQUE exempté de la rafale via `flow:'sale_receipt'` (#106, PR B — cf. § Garde de dépense).

⚠️ **Reste non traité** (dette `Tenant.country`, cf. « État réel des données » ci-dessus) :
la prod contient `CI`/`SN`/`France` (`Onboarding` PATCHe des noms FR). `resolveRecipient`
s'en protège (`isSupportedCountry()` écarte « France » → refus `COUNTRY_UNKNOWN`), mais le
CHAMP reste incohérent — à normaliser en ISO-2 dans sa propre surface si le flux commerçant
doit couvrir ces tenants.

#### ⚠️ Méthode — la leçon la plus chère

**Ne JAMAIS poser une garantie de sûreté par RAISONNEMENT sur ce code.** Les trois échecs
ont le même motif : une affirmation plausible (« un pays fiable protège », « Twilio
rejettera », « `00` ne suppose rien ») écrite en commentaire et jamais exécutée. Les trois
fois, un script de dix lignes appelant la bibliothèque l'aurait démentie **avant** le commit.
**Mesurer d'abord, coder ensuite** — et si un commentaire affirme une propriété de sûreté,
un test doit l'exercer.

Corollaires : une surface à la fois, revue entre chaque, on ne clôt que sur une revue qui
revient **vide**. Un test « gardien » doit être vérifié **dans les deux sens** — celui de la
tentative 2 restait vert parce que son cas échouait par la **longueur** des plans (CI 10
chiffres vs SN 9), pas par un garde réel : toute la moitié dangereuse (plans qui se
recouvrent) n'était pas testée.

## Dette ouverte

### 🔴 Critique
- ✅ **Numéros WhatsApp : RÉSOLU** (sous-surface 1, PR #100) — la normalisation par « à qui appartient ce numéro » (`resolveRecipient`, param `owner` obligatoire) a remplacé le `+` aveugle et le `replace(/^0/)`. Cf. § Chantier NORMALISATION téléphonique (résolu à la 5ᵉ tentative). Le seul reste est la dette `Tenant.country` (noms FR en prod, dont `resolveRecipient` se protège par `isSupportedCountry()`).
- **SMS** (`notifSmsSales`/`notifSmsStock`) : Africa's Talking reco. `services/sms.ts`, `SMS_API_KEY`. **XL**
- **Push PWA** : VAPID keys, `PushToken` prêt inutilisé, SW sans handler. **XL**
- **Wave webhook** : code **fail-CLOSED** (`if (!secret) return false`) ✅ — reste à poser `WAVE_WEBHOOK_SECRET` Railway pour activer la vérif en prod. **S**
- **Campay go-live** : `CAMPAY_WEBHOOK_KEY` + `CAMPAY_ENVIRONMENT=production`. **S**
- **PayDunya go-live** : `PAYDUNYA_MODE=live` + clés live. Flux POS non validé end-to-end. **S**

### 🟡 Medium
- **Paie statuts** : state local pur (`Payroll.tsx`), perdu au refresh. Pas de table Payroll en base. **M**
- **Bundle recharts ~105KB gz** : lazy + hors precache. Remplacer visx = **L**.
- **A11y résiduel** : 3 champs SectionCatalog sans label, POSModals pays non-listbox, Stock liste divs.

## Comptes démo

⚠️ **`demo-tenant-001` et `demo-tenant-002` portent `isDemo = true`** depuis 2026-07-22 : toute action à coût externe ou destructive y est refusée côté serveur (403 `DEMO_TENANT_FORBIDDEN`, cf. § Garde de dépense). Le mot de passe démo est PUBLIC — c'est ce flag qui protège, pas la discrétion.

`demo1234` — `admin@`/`manager@`/`cashier@`/`accountant@`/`hr@habashop.com`, tenant principal `demo-tenant-001` (« HabaShop — Dakar Central »). 5 employés (`demo-emp-${name}`). Données hors seed : `currency='EUR'`, `requireCashier=false`, `ownerPhone='+221771234567'`. Si reseed → repasser `requireCashier=false`.
**Multi-boutiques** : `admin@` et `manager@` sont liés à une 2ᵉ boutique `demo-tenant-002` (« Alimentation Koné — Abidjan », XOF) via `UserTenant` → login déclenche le sélecteur. `admin@` = SUPER_ADMIN/ADMIN, `manager@` = MANAGER/MANAGER. Les 3 autres restent mono-boutique.

## Env vars

**Railway** : `DATABASE_URL`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`, `WAVE_WEBHOOK_SECRET`, Resend, Redis, `ANTHROPIC_API_KEY`, `SENTRY_AUTH_TOKEN`.
- MTN : `MTN_MOMO_SUBSCRIPTION_KEY/USER_ID/API_KEY/ENVIRONMENT` · `MTN_SANDBOX_AUTO_SUCCESS`
- Campay : `CAMPAY_USERNAME/PASSWORD/TOKEN/WEBHOOK_KEY/ENVIRONMENT` · `CAMPAY_SANDBOX_AUTO_SUCCESS`
- PayDunya : `PAYDUNYA_MASTER_KEY/PRIVATE_KEY/PUBLIC_KEY/TOKEN/MODE` · `PAYDUNYA_SANDBOX_AUTO_SUCCESS`

- Garde de dépense : `QUOTA_TRIAL_AI/OCR/WHATSAPP/WHATSAPP_MARKETING/EMAIL` · `QUOTA_ACTIVE_*` (défauts 20/15/30/**10**/20 et 200/150/300/**50**/200 ; `WHATSAPP_MARKETING` = placeholder bas) · `COST_BURST_PER_MIN` (défaut 10, `0` = désactivé) · `RATE_LIMIT_MAX` (global, défaut 300/min/IP). Tous **lus à l'appel** → ajustables sans redéploiement.

**Vercel** : `VITE_GOOGLE_MAPS_KEY` (.env tracké), `VITE_ENV`, `SENTRY_AUTH_TOKEN` (.env.local), `VITE_VAPID_PUBLIC_KEY` (à venir), `VITE_DEMO_MODE=1` (**déploiement DÉMO uniquement** — jamais en prod : sort le raccourci par rôle et `demo1234` du bundle).
