# HabaShop — État du projet

Guide pour Claude Code. Lis ce fichier en premier avant de bosser sur le repo.

## C'est quoi

SaaS de gestion commerciale multi-tenant pour boutiques/superettes (Afrique de l'Ouest & francophone, puis international). Monorepo npm workspaces.

## Stack technique

- **`apps/frontend`** — React 18 + TypeScript + Vite, Zustand (state, persisté localStorage), React Router, Lucide icons, recharts, jsbarcode (EAN-13 SVG), @zxing (scan caméra), Playwright (E2E). PWA installable via vite-plugin-pwa.
- **`apps/backend`** — Fastify + Prisma + PostgreSQL (Railway), bcryptjs auth + JWT, Resend (emails), Sentry, cron `setInterval` natifs.
- Multi-devises (XOF/XAF/EUR/USD/CAD/GBP, base XOF + conversion live) et multi-langues (fr/en/es/it).

## Déploiement

### Frontend — Vercel (`habashop.vercel.app`)
- **Toujours depuis la racine** `/Users/nelson/Documents/Projets/habashop` :
  ```bash
  vercel --prod --yes
  vercel alias set habashop-<hash>-ndjoumessis-projects.vercel.app habashop.vercel.app
  ```
- ⚠️ **JAMAIS depuis `apps/frontend`** — `vercel.json` est à la racine et le CLI résout les paths relatifs depuis `cwd`. Lancer depuis `apps/frontend` produit un path doublé `apps/frontend/apps/frontend` et échoue.
- Auto-deploy GitHub Vercel actif (push `main` → build + promote `habashop.vercel.app`). Si l'auto-deploy lag (parfois >10 min), forcer manuellement avec les 2 commandes ci-dessus.

### Backend — Railway (`habashop-production.up.railway.app`)
- Service `habashop` dans le projet `grateful-happiness`.
- Depuis la racine (après `railway link` une fois) :
  ```bash
  railway up --ci
  ```
- Auto-deploy GitHub Railway actif sur push `main`.

## ⚠️ Pièges critiques (lis avant de lancer une commande)

1. **Node par défaut = v10 → casse tous les builds** (`tsc`/`vite`/`vercel`/`railway`/`tsx`). Toujours préfixer par le Node 20 :
   ```bash
   export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
   ```
   Mets ça en tête de chaque session shell qui build/test/déploie.

2. **`DATABASE_URL` pointe sur la DB PROD Railway** — il n'y a PAS de DB locale de dev. Ne lance JAMAIS `db:migrate`, `db:seed`, `migrate dev` sans confirmation explicite de Nelson. `prisma db push` accepté pour les ajouts de colonnes/tables sans risque de data loss (sinon ajouter `--accept-data-loss` après vérification doublons).

3. **Git : commit directement sur `main`.** Pas de feature branch. Commit + push straight to main.

4. **Vercel = depuis racine, jamais depuis `apps/frontend`** (voir Déploiement).

## Commandes

Toujours avec le PATH Node 20. Depuis `apps/frontend` :
```bash
npx tsc --noEmit        # typecheck — doit être 0 erreur
npm test                # vitest — 43 tests doivent passer
npm run build           # tsc && vite build
```
Backend (`apps/backend`) :
```bash
npx tsc --noEmit        # typecheck
npx prisma db push      # appliquer schema.prisma sur prod (sans migration versionnée)
npx tsx <script>.ts     # one-shot scripts DB (pattern utilisé : check-X.ts, fix-X.ts)
```

### Rituel de vérification avant CHAQUE commit
`tsc --noEmit` (0 erreur) → `npm test` (43/43) → `npm run build` (OK). Puis commit/push sur main. Si frontend touché et auto-deploy lent : `vercel --prod --yes` depuis la racine + alias. Si backend touché et auto-deploy lent : `railway up --ci`.

## Structure frontend

```
src/
  pages/         # 1 fichier par écran (Dashboard, POS, Stock, Orders, Customers,
                 #   HR, Planning, Payroll, Goals, Expenses, Reports, Forecasts,
                 #   Users, Settings, Activity, Notifications, AIAssistant, APIDocs,
                 #   Integrations, AdminDashboard, UpgradePlan, PaymentCallback,
                 #   Onboarding, LandingPage, SignupPage, LoginPage, Marketing, Pricing, Privacy)
                 #   ⚠️ /privacy = route PUBLIQUE (hors auth, avant le catch-all) — URL exigée par Google Play
  components/    # par domaine : customers/ hr/ pos/ stock/ reports/ settings/
                 #   integrations/ layout/ (Header, Sidebar, AppLayout) ui/
                 #   → chaque domaine a souvent un `*Shared.tsx` (helpers + maps i18n)
  stores/        # appStore.ts (Zustand : lang, currency, tenant, caisse… persisté localStorage)
                 # authStore.ts (user, token, ROLE_PERMISSIONS + canAccess slug)
  hooks/         # useI18n.ts, usePagination.ts, useFormatAmount…
  i18n/index.ts  # dictionnaire t() : translations = { fr, en, es, it }, 575+ clés
  utils/export.ts # génération CSV / PDF / labels (JsBarcode SVG scannable)
  lib/api.ts     # tous les *Api : productsApi, salesApi, customersApi, suppliersApi,
                 #   ordersApi, employeesApi, hrApi (bonusesApi, salaryHistoryApi),
                 #   expensesApi, tenantApi, usersApi, goalsApi, auditApi, authApi…
```

## i18n — convention CRUCIALE (le projet est 100% fr/en/es/it)

Trois mécanismes coexistent ; **utilise celui déjà présent dans le fichier** :

1. **Helper `i(fr, en, es, it)`** via `useI18n()` ou local au composant — standard pour le nouveau code.
2. **Ternaire inline 4-langues** — TOUJOURS les 4 (jamais binaire FR/EN qui ferait retomber ES/IT en anglais).
3. **`t('key')`** (global, depuis appStore) — pioche dans `src/i18n/index.ts`. Si tu ajoutes une clé, ajoute-la dans **les 4 blocs**.

Autres helpers : `makeI(lang)` (settings), `pick(lang, obj)`.

**Pattern data traduites** : map `Record<string, Record<lang, string>>` + fonction `xxxLabel(value, lang)` qui garde la valeur FR comme clé (filtres/data) et ne traduit que l'affichage. Exemples : `hr/hrShared.tsx`, `pos/posShared.tsx`, `stock/stockShared.tsx`.

**NE PAS traduire** : noms de marque (HabaShop, Wave, Orange Money, MTN, Railway, Vercel, Claude, WhatsApp), codes (XOF, EUR, FCFA), enums/clés API, noms de pays. Les PDF générés (`utils/export.ts`) sont hors périmètre i18n.

## Conventions de code

- Montants : `useFormatAmount()` ou `fmt()` — jamais de formatage manuel ; suit la devise du tenant.
- Icônes : **Lucide uniquement** (pas d'emoji UI), `cursor: pointer` + transitions sur cliquables.
- Couleurs : **`var(--*)`** systématiquement — jamais de `#RRGGBB` hardcodé (sinon les thèmes claire/forêt/etc. cassent).
- Logs : utiliser `logger.log/warn` depuis `@/lib/logger` (filtre `import.meta.env.DEV`). `console.*` à éviter en code commit.
- Pour éditer des chaînes multi-octets/emoji en masse, préférer un script Python ou un fichier `.ts` tsx-runnable à des `sed` fragiles.

## Specs prescriptives

Nelson fournit souvent des specs détaillées (ex : « lot N i18n »). Si une instruction du spec ne matche pas le code réel (numéro de lot déjà pris, fichier/string introuvable, ternaire déjà 4-langues), **réconcilie et continue** — ne bloque pas. Réserve les questions aux choix à fort enjeu / irréversibles (ex : élargir le périmètre à des milliers de lignes). Vérifie toujours qu'un fichier/flag mentionné existe encore avant de t'appuyer dessus.

## Derniers commits livrés

```
7336bd60  feat(goals+notifs)  Goals persistés en base (Prisma+CRUD+frontend) + cron alerte stock email quotidien
f6efe49d  fix(security)       settingsLocked conditionnel dans header + edge cases JWT + migration Lucide/var(--*)
5503c161  feat(settings)      Refonte design — sidebar épurée, header section, cards uniformes, forms structurés
ca85f932  feat(settings)      Persiste POS + Notif + Langue en base (migration Prisma + backend + frontend branché)
2c379360  feat(activity)      Refonte journal — descriptions lisibles + icônes par action + design enrichi
f8cfa5b1  fix(activity)       Ajoute activityLog aux deps useMemo — liste vide au premier load
08545a01  fix(users)          Refonte design modales invitation/modification (icônes inline, toggles switch, layout cohérent)
c577cac2  fix(users)          Libère l'email au soft-delete (contrainte unique globale)
4b76a395  fix(users)          requireAdmin accepte SUPER_ADMIN
e7e517ab  feat(users)         Masque boutons d'action aux non-admins (UI cohérente avec les checks backend)
```

## État fonctionnel — ce qui marche

### Core métier (CRUD complet + persistance backend)
- **Produits / Stock** : create/update/delete, SKU auto-séquentiel par tenant `PRD-NNNN` + `@@unique([tenantId, sku])`, code-barres EAN-13 (génération + validation 13 chiffres + rendu SVG scannable via JsBarcode), supplierId FK, description/notes, scan caméra via @zxing
- **POS / Ventes** : caisse, paniers, modes paiement (cash/wave/orange/mtn/card), remises, customer linking, fidélité (toggle)
- **Clients** : CRUD complet, carte Google Maps (sous `VITE_GOOGLE_MAPS_KEY`), loyalty points, revenus cumulés
- **Fournisseurs** : CRUD, catégories, lead time, rating, soft-delete restorable
- **Commandes (PurchaseOrder)** : CRUD, statuts, items
- **Employés / RH** : CRUD, contrats CDI/CDD, primes (`EmployeeBonus`), historique salaires (`SalaryHistory`) avec DELETE + timeline zigzag responsive (commit `93de0d09` + `e797310b`)
- **Paie** : génération bulletins PDF, calcul brut/CNSS/IR/net
- **Dépenses** : CRUD avec catégories
- **Utilisateurs (`/app/users`)** : invite (email Resend + audit + bcrypt 12), update, toggle active, toggle 2FA (self-service ou admin), soft-delete avec libération email (`_deleted_${ts}` suffix). `requireAdmin` accepte `ADMIN` + `SUPER_ADMIN`. UI conditionnée par rôle (boutons masqués aux non-admins).
- **Objectifs (Goals)** : CRUD persisté backend (commit `7336bd60`), `linkedMetric` ('salesMonth' / 'transactionsMonth' / 'avgBasket') pour l'enrichissement live depuis dashboardApi.stats. Plus de localStorage.
- **Activity / Audit log** : route GET `/api/audit-logs` filtrée par tenant + render i18n par action (ACTION_LABELS 21 actions, ACTION_ICONS), parseDescription extrait nom/email du JSON, design card moderne (commit `2c379360`)

### Settings — persistance backend complète
- **Shop** : nom/email/phone/address/country/vatRate → `tenantApi.update`
- **POS** : 9 paramètres (vatRate, posVatIncluded, posAutoprint, autoWhatsApp, enableLoyalty, requireCashier, enableScanner, priceMode, posDefaultFund) → backend (commit `ca85f932`)
- **Notifications** : 6 toggles persistés (notifEmail×3, notifSms×2, notifPush) ; **consommés par les crons** : `notifEmailSales` (weekly), `notifEmailStock` (daily 7h, commit `7336bd60`), `notifEmailPayroll` (récap paie mensuel, 1er du mois 8h)
- **Lang & Currency** : `cfg.setLang` + `tenantApi.update({lang})`, currency idem. `setTenant` restore lang au login.
- **Security** : changePassword backend (`PATCH /api/auth/password`), JWT info avec edge cases (expiré/expire aujourd'hui/actif), confirmation logout, settingsLocked **conditionnel** dans Header (commit `f6efe49d`)

### Auth & RBAC
- JWT bcrypt12, register/login/me/changePassword
- `ROLE_PERMISSIONS` slug-based : ADMIN/SUPER_ADMIN = `*`, MANAGER/CASHIER/ACCOUNTANT/HR avec listes
- Route guard `canAccess(role, slug)` redirige vers landing si refus
- Backend `requireAdmin` helper + validation `body.role` whitelist sur tous les writes users

### Emails Resend
- Welcome (signup), trial reminder 7d/3d, trial expired, upgrade confirmation, weekly report, user invitation, stock alert (daily), **récap paie mensuel** (`sendPayrollSummaryEmail`, localisé fr/en/es/it + devise tenant)
- Helper `escHtml()` appliqué aux interpolations (defense-in-depth XSS)
- Template `baseTemplate()` cohérent avec footer désabonnement

### Multi-tenant
- Scope `tenantId` sur toutes les routes write/read
- Soft-delete `deletedAt` partout pour permettre restoration
- `email @unique` global (User) avec libération au soft-delete via suffix `_deleted_${ts}`

### i18n & thèmes
- 100% fr/en/es/it sur l'in-app + landing/login/signup (8 lots i18n)
- 4 thèmes (dark/light/forêt/+accent custom) — préférence per-device (localStorage)

### Tests
- 43 tests vitest (currency, pagination, components UI)
- Playwright E2E configuré (`@playwright/test` installé pour les verifs manuels)

## Dette technique — points à fixer

### 🔴 Critique
- **`notifSmsSales` + `notifSmsStock`** : infra SMS à choisir (recommandé : **Africa's Talking** pour XOF/XAF pricing). Crée `services/sms.ts`, env `SMS_API_KEY`, gère format international. **XL**
- **`notifPushAll`** : web-push PWA à implémenter. **XL** (révisé après audit)
  - VAPID keys à générer + ajouter Railway (backend) + Vercel (frontend `VITE_VAPID_PUBLIC_KEY`)
  - Modèle Prisma `PushToken` prêt mais inutilisé
  - SW PWA existe (`public/sw.js`, 39 lignes) mais sans handler `push`/`notificationclick`
  - Pipeline complet à créer : route POST/DELETE `/api/push-tokens`, service `sendPushNotification(userId, payload)`, SW handlers, frontend `pushManager.subscribe()` + bouton "Activer" dans SectionNotif, émetteurs sur 3-5 events (vente importante, rupture stock, paiement reçu, objectif atteint, invite user)
- **Wave webhook — fail-OPEN en sandbox** (`services/wave.ts`) : `verifyWaveWebhook` fait `if (!WAVE_SECRET) return true` → toute signature passe sans `WAVE_WEBHOOK_SECRET`. Sûr tant que sandbox, **bloquant go-live** : avant passage Wave **prod**, poser `WAVE_WEBHOOK_SECRET` (Railway) ET vérifier que le chemin prod **rejette** réellement une signature invalide (mesurer un POST signé KO → 401). **S** (≠ Orange, déjà fail-closed)
- **Action ops — `ORANGE_MONEY_WEBHOOK_SECRET` à poser sur Railway** : sans lui, `verifyOrangeWebhook` rejette **tous** les webhooks Orange (fail-closed = sûr mais **auto-activation Orange inerte**). Mécanisme détaillé en *Patterns / pièges* (webhooks sécurisés). **S**

### 🟡 Important
- ~~**7 pages in-app > 600L à découper**~~ ✅ **CLOS** (Sprint 9+). Les 7 pages décomposées par la même méthode (**test d'ancrage d'abord → découpe à comportement identique → i18n ensuite** — l'i18n était déjà propre sur toutes, pattern FR-comme-clé) : **Orders** 1104→296L, **Users** 821→219L (`components/users/` 7 fichiers), **Expenses** 739→307L (`components/expenses/` 7), **Planning** 708→190L (`components/planning/` 7), **POS** 627→495L (déjà découpé ; extraction écran caisse-fermée + `posTicket.ts`), **Suppliers** 619→230L (`components/suppliers/` 6), **Payroll** 601→155L (`components/payroll/` 4, `buildMonths`/`monthLabel` ré-exportés pour `payroll-months.test`). HR déjà traité (HR XL). Chaque page a son `*.anchor.test.tsx` (4–9 cas) figeant le comportement avant/après. **Plus aucune page in-app > 600L.** Pages **publiques** aussi décomposées : **LandingPage** 1384→43L (`components/landing/` : `landingShared.ts` = `LANDING_TRANSLATIONS` + palette + helpers, **13 sections**, conteneur = pur composition root ; `landing.anchor.test.tsx` 6 cas) et **SignupPage** 938→202L (`components/signup/` : `signupShared.tsx` = `TX` 4-langues + `COUNTRIES` + palette + `getStrength` + helpers `inputBase`/`focusOn`/`focusOff`/`Label` ; `SignupBranding` + `SignupStep1` [état dropdown pays co-localisé] + `SignupStep2` [force mdp] ; `signup.anchor.test.tsx` 6 cas). **Plus AUCUNE page du repo > 600L.** Suite de tests : 84 → **134**.
- ~~**`HRTabs.tsx` (1171L) + `HRModals.tsx` (1096L)** à splitter + i18n. **XL**~~ ✅ **CLOS** (voir Sprint 9 « HR XL »). Méthode suivie : **test d'ancrage d'abord** (`hrmodals.anchor.test.tsx` 10 cas, `EditEmployeeModal` en priorité — la modale la plus riche en props/état), **découpe à comportement identique**, **i18n ensuite** (7 chaînes résiduelles : placeholders + headers). 84/84 tests.
- ~~**431 boutons icon-only sans aria-label**~~ ✅ **CLOS** — un scan AST-léger (`<button>` dont le contenu est *uniquement* une icône Lucide, sans `aria-label`/`title`/texte) a isolé les **37 vrais cas** sans nom accessible (les ~334 autres « icon-only » ont en fait un libellé via `{expression}` → faux positifs). `aria-label` localisé 4-langues ajouté à chacun (fermeture modale X, Trash2/Pencil isolés, étoiles de notation `Note ${s}/5`, PDF/Facture/Effacer/Retirer), via le mécanisme i18n déjà présent dans chaque fichier (`i()` ou ternaire `lang`). Re-scan = **0**.
- **Bundle recharts 411KB + barcode 443KB** — ✅ **différés hors rendu initial** (le poids brut reste, mais ne bloque plus). `barcode` (@zxing 443KB) déjà lazy (POS + StockModals via `React.lazy`). `charts` (recharts+d3, 110KB gz) : sorti des imports statiques de **Dashboard** (2 blocs → `components/charts/DashSalesArea`+`DashCategoryDonut` lazy sous Suspense ; tooltips/labels sans dépendance recharts restent dans Dashboard, passés en props) et de **Reports** (import recharts mort supprimé + `ReportsTabs` lazy). Chunks Dashboard 6,3 kB gz / Reports 3,9 kB gz, KPIs affichés sans attendre les charts. **Reste possible (L, non fait)** : remplacer recharts par une lib plus légère (visx) pour réduire les 110 kB eux-mêmes.
- ~~**WebSocket `/api/ws` auth** à vérifier~~ ✅ **VÉRIFIÉ + DURCI**. Faux positif sur le fond : l'auth était bien présente (token `?token=`/header → `app.jwt.verify` → `close(1008)` si invalide, **fail-closed**) — juste **inline** dans le handler, pas via `preHandler` (impossible proprement avant l'upgrade WS). 2 écarts réels vs l'auth HTTP corrigés : (1) **`isUserActive`** n'était pas checké → un compte supprimé/désactivé pouvait se connecter pendant les 7 j de validité du JWT (ajout du check, parité avec `authenticate`) ; (2) garde **`tenantId` manquant** (évitait d'indexer un socket sous clé `undefined`). Logique extraite en helper **pur** `lib/wsAuth.ts` (`decideWsAuth`, zéro dépendance DB/Redis) + **5 tests** (no-token/invalide/no-tenant/valide/verify hostile). Handler passé `async` pour `await isUserActive`. Frontend inchangé (`notificationStore` connecte via `?token=<JWT>`).
- ~~**SectionLang devise** : `.catch(()=>{})` silencieux, divergence possible local/serveur~~ ✅ **CLOS** (commit `8d3c40e6`). Le sélecteur « Devise d'affichage » ne pousse plus au tenant (`tenantApi.update({currency})` retiré) → c'est une **préférence d'affichage par appareil** (montants stockés base XOF, convertis via `useFormatAmount`). `appStore.setTenant` adopte `tenant.currency` **uniquement au changement de boutique** (plus à chaque `/me`/refresh), préservant le choix local tout en gardant le correctif anti « EUR persisté convertit des XOF ». Cause racine du bug démo (tenant-001 rebasculait en EUR via sessions publiques) supprimée. La devise réelle du tenant est fixée à l'onboarding. **Latent ✅ corrigé** (commit `0f5264d1`) : le rapport comptable (`/api/reports/accounting`) convertit désormais les montants base XOF → `tenant.currency` (`lib/currency.ts` partagé avec le récap paie) ; modale `AccountingReportModal` formate sans reconvertir (`formatInCurrency(n, data.currency)`). **lang** garde le même pattern (push tenant) — bénin, non touché (restore login documenté).

### 🟢 Nice-to-have
- **Couleurs hardcodées → `var(--*)`** (migration **progressive**, cohérence multi-thème). **L** — ⏳ EN COURS.
  - **Lot 1 ✅** (`e853ea38`) : 3 widgets de formulaire réutilisables (`PhoneInputWithCountry`, `AddressAutocompleteInput`, `AddressAutocomplete`) — dropdown navy `#0D0D1C` + bordures/survols blancs → `var(--card)`/`--border`/`--bg3`/`--bg4`. C'était la casse la plus visible (boîte noire sur formulaire en thème clair).
  - **Méthode / classification** (le « 920 hex » brut est trompeur — la vraie cible = le *chrome* in-app) : **CONVERTIR** = fonds/bordures/texte d'UI sombres hardcodés (`#0D0D1C`, `#1a1a2e`, `rgba(255,255,255,…)`) dans des composants in-app. **NE PAS toucher** = palettes **sémantiques** (avatars/catégories/charts/status : `COLORS`/`DONUT_COLORS`/`CATEGORY_STYLE`/`SHIFT_TYPES`/`PAY_COLORS`… couleurs-identité par entité), **styles Google Maps** (`customersShared`, hex requis par l'API), **templates PDF** (`HR.tsx`/`export.ts`, doc imprimé sans CSS vars), **pages publiques** (`.public-scope`, palette `D` dark voulue : `landing*`/`signup*`/`Pricing`/`Privacy`/`Onboarding`/`UpgradePlan`), **défs de thème** (`appStore.ts`), `#fff` sur boutons colorés. Tints violet `rgba(108,71,255,…)` = sémantiques → garder.
  - **Lot 2 ✅** (`6c89b6ef`) : bordures de champ des modales vue/détail (`background:transparent` + `border 1px rgba(255,255,255,.06)` → invisible en clair) → `var(--border)` : `ExpenseDetailModal`, `ContractDetailModal` (+ footer `rgba(0,0,0,.15)`→`var(--bg3)`), `StockModals` (2 bordures). **Inspecté & laissé (tout sémantique)** : `CustomersModals` (médailles fidélité or/argent/bronze/platine + accents marque), palette hex de `StockModals` (= color-picker catégories).
  - **Lot 3 ✅** (`e330e362`) : `Pagination` (fonds/bordures des contrôles page-size/prev-next/pages inactives) + `UserCard` (2FA off-state + boîtes info) — blanc neutre → `var(--bg3)`/`var(--border)`. Conservé : gradient violet page active, tint emerald 2FA-on, dots statut online/offline, accents rôle.
  - **Constat** : après lots 1-3, la casse de thème majeure (surfaces navy + bordures/boîtes invisibles) est traitée. Reste ~40 `rgba(255,255,255,…)` in-app (`NewOrderModal`/`BulletinModal`/`Header`/`PlanningGrid`/`Goals`/`Forecasts`/sections Settings…) — surtout bordures/survols fins, à convertir par petits lots en vérifiant le **blanc intentionnel sur surface colorée/gradient** (ex. header violet `BulletinModal`).
  - **Reste** : ces ~40 rgba blancs fins + cas borderline `UpgradePlan` (page dark autonome).
- ~~**`og-image.png` 53KB** → WebP~~ ✅ **FAIT** (`5ad07f8e`) : `og-image.webp` **24,6KB** (−53%) via `sharp` q80 (1200×630). Refs MAJ : `index.html` (og:image + twitter:image + JSON-LD screenshot, + `og:image:type`) et `manifest.json` ; PNG source supprimé. Conversion sans outil système (sips ne sait pas *écrire* le webp ; `cwebp`/`magick` absents) → **`sharp` (déjà en dépendance) pour tout besoin de conversion d'image**.
- **Tests unitaires métier HR/Stock/Users** : la suite couvre désormais le rendu/câblage (137 front via les `*.anchor.test.tsx` + 145 back), mais **0 test de logique métier pure** (calcul paie/CNSS/IR, paliers de prix POS, RBAC). **XL**
- **`npm audit` (note permanente, pas un blocage)** : audit fonctionnel (racine + par app) ; **6 vulns modérées DEV-only** (chaîne esbuild→vite→vitest→vite-plugin-pwa, advisory serveur-de-dev uniquement, jamais en prod). Aucun fix non-breaking — corrigeable seulement via vite 5→8 / vitest 1→3 (**majeur**), à planifier comme upgrade outillage dédié.
- ~~**i18n résiduel — page Marketing**~~ ✅ **AUDITÉ — RAS** (`3ff3393c`) : dict `MK` complet sur les 4 langues + KPIs en ternaires inline 4-langues ; 0 chaîne FR hardcodée, 0 ternaire binaire. **i18n in-app = 100%.** (Les chaînes FR apparentes ailleurs = pattern **valeur-FR-comme-clé** filtres/data, à NE PAS toucher.)
- ~~**Émojis dans `Head` shared** (`settingsShared.tsx`) → Lucide~~ ✅ **FAIT** (`3ff3393c`) : `Head` prend un `icon` (élément Lucide), couleur `var(--p2)` ; **13 callers / 7 sections** migrés (Store/ShoppingCart/Bell/ClipboardList/Lock/Globe/Coins/Palette/Eye-EyeOff/Link2/Pencil/MessageCircle). Bordure `rgba` → `var(--border)` au passage.

## Application mobile

- **CDC disponible** : `MOBILE_APP_CDC.md` à la racine
- **Stack cible** : React Native
- **État** : à démarrer (pas commencé)

## Comptes démo

Démo bypass auth via `authStore.ts:90+` — mot de passe `demo1234` accepté pour ces comptes :
- `admin@habashop.com` / `demo1234` (rôle ADMIN sur `demo-tenant-001`)
- `manager@habashop.com` / `demo1234` (rôle MANAGER)
- `cashier@habashop.com` / `demo1234` (rôle CASHIER)
- `accountant@habashop.com` / `demo1234` (rôle ACCOUNTANT)
- `hr@habashop.com` / `demo1234` (rôle HR)

Le tenant `demo-tenant-001` contient 5 employés seedés (Marie Bakayoko, Kofi Diallo, Aminata Touré, Seydou Koné, Fatoumata Ndiaye) avec IDs `demo-emp-${name}` (pas des cuid — voir `seed.ts`).

## Historique récent

i18n complété en 8 lots (sept. 2024–mai 2026) : tout le texte d'interface (in-app + pages publiques/pré-login) est en fr/en/es/it. Détails dans `I18N_AUDIT.md` et le git log (`feat: i18n lot N`).

Refonte design complète : Settings (commit `5503c161`), Activity (commit `2c379360`), modales Users (commit `08545a01`), timeline HR salaires (commit `93de0d09` + `e797310b`).

Sécurité & multi-tenant : routes user management durcies admin-only + validation role whitelist + HTML escape email (commits `c66d9adb` + `4b76a395`), libération email au soft-delete (commit `c577cac2`).

## Sprint 9 — session 30 mai 2026

### Mobile (`habashop-mobile`)
- Navbar FAB POS outlined/filled selon état actif
- Settings : bloc profil avec avatar initiales + badge rôle (ADMIN/MANAGER/etc.)
- Fix `GO_BACK` Caisse (guard `router.canGoBack`)

### Web (`habashop`) — features métier
- **Étiquettes prix imprimables** : sélection inline (checkbox par ligne) + presets Avery (L7160/L7163/L7165/L7651) + ActionBar contextuelle
- **Multi-prix par paliers de quantité** : `priceTiers` JSON sur `Product` + fix bug `updateQty` POS (recalcul prix au franchissement de palier)
- **Catalogue WhatsApp partageable** (`/c/:slug`) : route publique + section Settings + message `wa.me` pré-rempli + slugs auto-générés (backfill 6 tenants)
- **Auto-détection devise selon pays** dans Signup/Onboarding (util `currencyForCountry`/`suggestedCurrencyForCountry`, fallback XOF, préremplissage jusqu'à choix manuel)
- **Rapport comptable mensuel** (remplace le stub « Bientôt disponible » de `SectionDocs`) :
  - Backend `GET /api/reports/accounting?month=YYYY-MM` (`routes/reports.ts`) : RBAC ADMIN/SUPER_ADMIN/MANAGER/ACCOUNTANT, `tenantId` STRICT depuis le JWT, cache Redis `reports:accounting:{tenant}:{YYYY-MM}` (TTL 5 min mois courant / 30 min passés, invalidé sur vente/dépense via `invalidateTenantCache` étendu). Helpers purs `resolveMonth`/`computeReport`/`buildAccountingReport` (testés : mois vide→0, agrégation, isolation tenant, paie=0).
  - **Source revenus = `Sale.total`** sur `createdAt ∈ [new Date(y,m,1), mois+1)` (heure serveur) → **réconcilie exactement** avec le `caMonth` du dashboard (`prisma.sale.aggregate({_sum:{total}})`). Pas de modèle Order client (`PurchaseOrder` = fournisseurs).
  - **Salaires = source unique `Employee.salary`** (employés actifs) = masse salariale **projetée** (aucune catégorie dépense « Salaires » ni table Payroll). JAMAIS dans le net.
  - JSON dédoublé pour ne pas tromper : `resultBeforePayroll` (= revenu − dépenses Expense) **et** `resultAfterPayrollEstimate` (= − payroll, ESTIMATION). Pas de champ orphelin `net`.
  - Frontend `AccountingReportModal.tsx` : sélecteur mois localisé, KPIs (« Résultat avant masse salariale » + bannière « Résultat estimé après paie » badge *estimé*, masquée si paie=0), ventilation par catégorie (barres), états loading/erreur/vide, export PDF+CSV (réutilise `openPDF`/`htmlKPIs`/`htmlTable`/`exportCSV`), i18n fr/en/es/it.

### Backend — récap paie mensuel (livré)
- **Cron récap paie mensuel** (`runMonthlyPayrollReports`, `services/payrollReport.ts`) : honore enfin le toggle `notifEmailPayroll` — 1er du mois ~8h, **opt-in strict**, **idempotent** via `Tenant.lastPayrollReportMonth` (filtre `null` ou `≠ mois`), montants convertis en **devise du tenant**, email **localisé** fr/en/es/it, destinataire = **ADMIN du tenant dérivé serveur** (jamais d'email client en entrée).
- **Route admin `POST /api/admin/payroll-report/run`** : déclenchement à la demande pour test, **`dryRun:true` par défaut** (calcule + renvoie le récap, AUCUN email/marqueur), RBAC ADMIN, **cœur partagé** avec le cron (zéro duplication).
- **Migration `lastPayrollReportMonth` régularisée** : colonne jadis ajoutée par `db push` (hors historique) → migration additive **idempotente** (`ADD COLUMN IF NOT EXISTS`, `20260530140000_add_payroll_report_marker`) + `migrate resolve --applied` sur prod → `migrate status` propre, aucune ré-exécution.
> Mécanisme (cron `setInterval` + garde fenêtre-temps, idempotence, régularisation `db push`) détaillé dans **Patterns / pièges nouveaux**.

### Web — refonte architecture (découpage Orders) ✅ CLOS
- **`Orders.tsx` découpé 1104 → 296L** (conteneur fin : état, effets de chargement, handlers, orchestration — alimente 6 enfants par props). Découpe **à comportement strictement identique** (JSX déplacé verbatim, substitutions mécaniques seulement).
- **6 composants `components/orders/`** :
  - `ordersShared.tsx` — types (`Order`/`OrderStatus`/`OrderItem`) + `STATUS_CONFIG`/`STATUSES` + `ORDER_STATUS_LABELS` (4-langues) + `orderStatusLabel` + `API_TO_LOCAL_STATUS`/`LOCAL_TO_API_STATUS` + `mapApiOrder`.
  - `OrdersKpis` / `OrdersCalendar` / `OrdersListPanel` / `OrderDetailModal` / `NewOrderModal` (460L, le plus riche en props/état) — **présentationnels**, appellent `useConfig`/`useI18n`/`useFormatAmount`/`t` en interne.
- **Contrat de comportement** : `src/tests/orders.anchor.test.tsx` (**9 cas**) couvre load+KPIs / filtre recherche / modale détail / onglet calendrier / changement de statut **+ flux de création** (commande client, bon de commande fournisseur, bouton créer désactivé tant que client+article manquent, picker ajout/retrait panier). **À garder vert avec assertions inchangées** : c'est lui qui prouve le câblage props/état au runtime (tsc ne le couvre pas) et protège l'i18n.
- **i18n Orders : CLOS** — tout en `i()`/`t()`/ternaire 4-langues ; seule dette d'affichage restante (badge « Retard ») passée en clé 4-langues. Pattern **FR=clé intact** : `STATUS_CONFIG`/`STATUSES`, `unit:'unité'` (data), filtres → **non touchés** (valeur FR = clé de données/filtre, seul l'affichage est traduit via `orderStatusLabel`).

### Web — HR XL : découpe + i18n ✅ CLOS
Dernier module in-app monolithique traité (même méthode qu'Orders : **test d'ancrage d'abord → découpe à comportement identique → i18n ensuite**).
- **`HRTabs.tsx` 1172 → 82L** (conteneur fin) + **8 composants `components/hr/tabs/`** : `HRContractsTab`, `HRPayrollTab` (conteneur des 4 sous-onglets) + `PayrollGrid`/`PayrollPayslips`/`PayrollBonuses`/`PayrollHistory`, `HRAttendanceTab`, `HRLeavesTab`. **État co-localisé** : `isMobile`+resize → `PayrollHistory`, `expandedEmpBonuses`/`deleteOneBonus` → `PayrollBonuses`. Ancrage `src/tests/hrtabs.anchor.test.tsx` **8 cas** (étendu en cours de session : `PayrollHistory`/`PayrollPayslips` couverts après la découpe initiale).
- **`HRModals.tsx` 1097 → 118L** (dispatcher fin : flag d'ouverture → composant) + **8 composants `components/hr/modals/`** : `SalaryModal` (+ `SalaryRaiseForm`, `BonusForm`), `EmpModal` (ajout), `EditEmployeeModal` (édition premium, **333L — la plus riche en props/état**), `NewContractModal`, `ContractDetailModal`, `LeaveRequestModal`. **`AddressInputSimple` (code mort, 0 référence) supprimé.** Ancrage `src/tests/hrmodals.anchor.test.tsx` **10 cas** (priorité `EditEmployeeModal` : save→`employeesApi.update`, cancel→`openEditModal`, delete→`confirm`).
- **i18n** : **9 chaînes HRTabs** (Actif/Inactif, bannière congés en attente + suffixe jours, en-têtes CSV + colonne Actions, NET/ACTIONS/TOTAL) + **7 chaînes HRModals** (PERFORMANCE, Net preview ×2, placeholders date `JJ/MM/AAAA` + emails) passées en 4-langues. **Validation & soumission déjà localisées.** Pattern **FR=clé intact** : `CDI`/`CDD`/types contrat, rôles, départements (traduits à l'affichage via `contractLabel`/`roleLabel`/`deptLabel`), codes `CNSS`/`IR`, noms propres (exemples) → non touchés.
- Total après lots HR : **tsc 0, 84/84 tests, build OK**. HRTabs/HRModals = derniers monolithes in-app ⇒ dette « découpe + i18n in-app » close (les 7 pages de la ligne dette 🟡 restent ouvertes, fichiers non traités).

### Web — bugs corrigés
- Devise form Stock : conversion XOF↔devise aux frontières I/O (helpers hydrate/dehydrate)
- Prix catalogue public : conversion XOF→devise
- Cache-busting devise catalogue (`s-maxage=0`)
- Caisse après refresh : reset conditionnel dans `App.tsx` (seulement si pas de session active)
- Panier POS après navigation/refresh : `cart` déplacé dans `appStore` (Zustand persist)
- `clearCart()` au login ET logout (panier vide à chaque nouvelle session)
- Guard cash POS : encaissement bloqué si montant reçu < total (modes Wave/Orange/Carte non concernés)
- Thème modales customers : fond `#0D0D1C` hardcodé → `var(--card)` (détail + création)
- Bannière PWA : mémorisée 7 jours après « Plus tard » (`localStorage` `pwa-install-dismissed`)
- Libellé FCFA sans espace (« F CFA » → « FCFA »)
- Badge hero landing lisible (fond translucide + bordure violette + texte gradient)
- **Payroll : année réelle dans les clés/labels de mois** — `MONTHS` ne code plus `2026` en dur (`buildMonths(new Date().getFullYear())`). Le mois n'est qu'une **clé d'affichage/filtre côté client** (records générés depuis `employeesApi`, jamais persistés) → blast radius nul ; format de clé `"Mois AAAA"` inchangé, affichage localisé via `monthLabel` (`Intl`). `buildMonths`/`monthLabel` exportés + testés (passage 2027, 4 langues).
- **`console.log` API debug → `logger.log` DEV-gated** (`api.ts:43`) : ne s'exécute plus en prod (`logger` filtre sur `import.meta.env.DEV`) et ne logge que la **présence** du token (`✅/❌`), jamais sa valeur. Retiré de la dette 🟡.
- **HR — 3 bugs UI** (commits `3fe4fcf1` + `67f44a4b`) : (1) **suffixe devise** des champs salaire — affichaient le **code ISO** (« XOF ») au lieu du **symbole** (« FCFA »/« € »/« CA$ »). Source canonique = `CURRENCY_SYMBOLS` (appStore). `NewContractModal` utilise la **devise officielle du tenant** (`tenant.currency`, salaire contractuel ; threadé via prop `tenantCurrency`, suffixe = `CURRENCY_SYMBOLS[tenantCurrency] ?? tenantCurrency`) ; `SalaryRaiseForm`/`BonusForm`/`EditEmployeeModal`/`EmpModal` la **devise d'affichage** (`useCurrencyInfo().symbol` ou prop `currencySymbol`). `EmpModal` garde `code` pour la logique `code==='XOF'`. (2) **`LeaveRequestModal` dropdown employé injélectable** : les ids sont des **cuid STRING** en prod/démo (`demo-emp-Marie`), mais `onChange` faisait `Number(e.target.value)=NaN` → la sélection ne tenait jamais (le test d'ancrage le masquait avec un id numérique). Fix : `empId` gardé en string + compare souple `String(e.id)===String(empId)` + `option value=String(e.id)`. (3) **`AssignShiftModal` (planning) thème non respecté** : fond `#0D0D1C` + cartes rgba blanc hardcodés → `var(--card)`/`var(--border)`/`var(--bg3)`/`var(--sh-xl)` (conservé : scrim `rgba(0,0,0,.7)` overlay standard, couleurs sémantiques de shift `s.color`/`s.bg`).

### Web — design
- **Thème « Violet & Or ✨ » (`gold`)** ajouté comme thème par défaut (`DEFAULT_CONFIG.theme = 'gold'`) — violet `#7C3AED` verrouillé via `applyAccentColor` (indépendant de l'accent), or via `--acc2` (`#EAB308`, 203 usages)
- Refonte **landing/login/signup** : palette violet+gold (design system `src/styles/public.css`, scope `.public-scope`), stats hero (500+ boutiques · 12 pays · 99.9%), témoignage client, inputs premium
- **Tarifs** : équivalence EUR sous les prix FCFA (taux fixe 1 €=655,957 XOF)
- **Onboarding** aligné palette violet+gold
- **Section Sécurité** Settings harmonisée (cards `var(--card)`, inputs `var(--bg3)` distincts de la card)
- **Page API Docs** thémée (fond sombre, code block dark + coloration syntaxique)
- **Page Intégrations API** : cards statut coloré (vert/orange/rouge) + glow + bouton « Tester » live (spinner + toast)

### Patterns / pièges nouveaux
- **Découper un gros composant SANS tests → écrire d'abord un test d'ancrage** (rendu + interactions clés, en priorité les flux les plus riches en props/état — ex. la modale de création). Il doit passer **à l'identique AVANT et APRÈS** la découpe : `tsc` valide les types mais **ne couvre pas le câblage de props au runtime** (un `onClose`/`setState` mal rebranché compile), c'est le test qui le prouve. Ensuite seulement, faire l'i18n par-dessus (mêmes assertions = filet anti-régression). Cas vécu : Orders 1104→296L + 6 composants, `orders.anchor.test.tsx` 5→9 cas.
- **`appStore` persiste tout par défaut** : la `partialize` utilise `...rest` → toute nouvelle state ajoutée à `appStore` est persistée dans `localStorage`. Penser à **resetter les états de session** (cart, cashier) dans `authStore` login/logout, ou les exclure de `partialize`.
- **PWA banner** : headless Chromium ne fire jamais `beforeinstallprompt` → le **dispatcher synthétiquement** dans les tests Playwright (`window.dispatchEvent(new Event('beforeinstallprompt'))`).
- **`applyAccentColor()` écrase `--p/--p2/--p3`** (appelé APRÈS `applyTheme`) → pour verrouiller une couleur primaire dans un thème, poser les valeurs **dans `applyAccentColor()`** quand `body.className === 'theme-gold'` (une seule source de vérité, couvre updateConfig/setTheme/rehydrate/reset).
- **Animation `slideUp` sans `fill-mode forwards`** (`index.css`) : opacity+transform animés → un screenshot CI peut capturer l'élément transparent/décalé. **Attendre ~500ms** avant capture.
- **Catalogue public** : NE PAS utiliser `useFormatAmount` (hook lié au store auth) → utiliser `convertAmount` + `formatInCurrency` (fonctions pures exportées d'`appStore`).
- **Agrégats financiers = réconcilier avec le dashboard** : tout nouveau total CA/revenus DOIT réutiliser la source du dashboard (`Sale.total`, bornes `new Date(y,m,1)` heure serveur) pour éviter le double comptage. Modèles réels : `Sale` (revenu POS), `Expense` (dépenses, catégories Loyer/Énergie/Transport/Maintenance/Fournitures/Marketing/Formation/Autre — **pas** de « Salaires »), **pas** de table `Payroll` ni `Transaction`/`Order` client. Salaires = `Employee.salary` (projeté).
- **Tests backend = prisma mocké** (`vi.mock('../db')`, vitest) → ne JAMAIS toucher la DB prod. Extraire la logique en helpers purs (`computeReport`, `resolveMonth`, `decideOrangeWebhook`) pour les tester sans Fastify. Pour tester une **route** (RBAC, dryRun, etc.) : `Fastify().register(routes)` + `app.inject()` en mockant `../middleware/authenticate` (injecter `request.user.role`/`tenantId` via headers de test).
- **Régulariser un `prisma db push`** : un `db push` (ajout colonne sans migration) crée un **drift** invisible (`migrate status` reste « up to date » car il ne compare que l'historique). Pour régulariser SANS perte : créer une migration additive **idempotente** (`ADD COLUMN IF NOT EXISTS`) puis `prisma migrate resolve --applied <migration>` (enregistre l'historique sans ré-exécuter, la colonne existant déjà). JAMAIS `migrate reset`/`migrate dev` sur la DB prod.
- **Déploiement back+front couplé** : quand un changement de forme JSON touche back ET front, déployer **Railway d'abord** (route/champ dispo) puis Vercel, sinon le front lit des champs `undefined`.
- **Crons = `setInterval` horaire + garde fenêtre-temps** (`server.ts`, ex. `getDate()===1 && getHours()===8 && getMinutes()<=5`). Pour une vraie idempotence (resists restart/rejeu), ajouter un **marqueur en base** (ex. `Tenant.lastPayrollReportMonth`) et filtrer dessus dans le `findMany`. Cœur extrait en service (`payrollReport.ts` : `buildPayrollReport`/`deliverPayrollReport`) partagé entre le **cron** (`runMonthlyPayrollReports`) ET une **route admin de déclenchement à la demande** (`POST /api/admin/payroll-report/run`, RBAC ADMIN, `dryRun:true` par défaut, destinataire dérivé serveur, jamais d'email du client) → zéro duplication. Montants paie = base XOF → **convertir vers la devise du tenant** dans le service (`Employee.salary` est en base, comme tout ; taux fixes miroir du frontend).
- **Webhooks paiement sécurisés (`payments.ts`)** : Wave ET Orange Money vérifient désormais une signature **HMAC-SHA256 du raw body** (`timingSafeEqual`). Orange est **fail CLOSED** (`verifyOrangeWebhook` : sans secret ni signature → rejet) + validation montant/devise/référence contre la `PlanRequest` en attente + idempotence. **Env requise** : `ORANGE_MONEY_WEBHOOK_SECRET` (à poser sur Railway pour réactiver l'auto-activation Orange ; sinon tous les webhooks Orange sont rejetés = sûr mais inerte). `WAVE_WEBHOOK_SECRET` côté Wave.
