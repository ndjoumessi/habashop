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

### 🟡 Important
- **8 pages > 600L à découper** (Orders 1104L, Users 821L, Expenses 739L, Planning 708L, Suppliers 619L, Payroll 601L, POS 576L, HR 555L). Pattern : extraire les modals + sous-composants comme déjà fait pour Stock/HR/Customers. **L par page**
- **`HRTabs.tsx` (1171L) + `HRModals.tsx` (1096L)** à splitter en sous-tabs/sous-modals dédiés. **XL**
- **431 boutons icon-only sans aria-label** — beaucoup ont du texte (OK), mais les Trash2/Eye/Pencil isolés posent problème screen reader. **L**
- **`console.log` API debug en prod** : `apps/frontend/src/lib/api.ts:43` exécuté à chaque requête (leak token presence + bruit DevTools). Migrer vers `logger.log`. **S**
- **Bundle recharts 411KB + barcode 443KB** à optimiser (code-split charts par graph type, ou lib plus légère type visx). **L**
- **WebSocket `/api/ws` auth** à vérifier (`notifications.ts:33` sans `preHandler` visible). **M**
- **SectionLang devise** : `.catch(()=>{})` silencieux, divergence possible local/serveur. **S**

### 🟢 Nice-to-have
- **302 couleurs `#RRGGBB` hardcodées** → `var(--*)` (migration progressive, cohérence multi-thème). **L**
- **59 `console.*` non-logger** résiduels (la plupart sont `console.warn` légitimes dans des `.catch`, mais une passe de revue identifierait 5-10 vrais déchets prod). **S**
- **`og-image.png` 53KB** → conversion WebP (~15KB). **S**
- **Tests unitaires HR/Stock/Users** : 0 test métier actuellement (43 tests sont UI/pagination/currency). **XL**
- **`npm audit` cassé** au niveau workspace (`Cannot read property 'concurrently' of undefined`). Bloque la surveillance des vulnérabilités. **S**
- **i18n résiduel** : Planning/Payroll/Marketing pages secondaires probablement avec quelques chaînes FR hardcodées. **M**
- **Émojis dans Head shared** (`settingsShared.tsx`) → migration Lucide pour cohérence avec le redesign Settings parent. **S** (touche toutes les sections)

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

### Web — design
- **Thème « Violet & Or ✨ » (`gold`)** ajouté comme thème par défaut (`DEFAULT_CONFIG.theme = 'gold'`) — violet `#7C3AED` verrouillé via `applyAccentColor` (indépendant de l'accent), or via `--acc2` (`#EAB308`, 203 usages)
- Refonte **landing/login/signup** : palette violet+gold (design system `src/styles/public.css`, scope `.public-scope`), stats hero (500+ boutiques · 12 pays · 99.9%), témoignage client, inputs premium
- **Tarifs** : équivalence EUR sous les prix FCFA (taux fixe 1 €=655,957 XOF)
- **Onboarding** aligné palette violet+gold
- **Section Sécurité** Settings harmonisée (cards `var(--card)`, inputs `var(--bg3)` distincts de la card)
- **Page API Docs** thémée (fond sombre, code block dark + coloration syntaxique)
- **Page Intégrations API** : cards statut coloré (vert/orange/rouge) + glow + bouton « Tester » live (spinner + toast)

### Patterns / pièges nouveaux
- **`appStore` persiste tout par défaut** : la `partialize` utilise `...rest` → toute nouvelle state ajoutée à `appStore` est persistée dans `localStorage`. Penser à **resetter les états de session** (cart, cashier) dans `authStore` login/logout, ou les exclure de `partialize`.
- **PWA banner** : headless Chromium ne fire jamais `beforeinstallprompt` → le **dispatcher synthétiquement** dans les tests Playwright (`window.dispatchEvent(new Event('beforeinstallprompt'))`).
- **`applyAccentColor()` écrase `--p/--p2/--p3`** (appelé APRÈS `applyTheme`) → pour verrouiller une couleur primaire dans un thème, poser les valeurs **dans `applyAccentColor()`** quand `body.className === 'theme-gold'` (une seule source de vérité, couvre updateConfig/setTheme/rehydrate/reset).
- **Animation `slideUp` sans `fill-mode forwards`** (`index.css`) : opacity+transform animés → un screenshot CI peut capturer l'élément transparent/décalé. **Attendre ~500ms** avant capture.
- **Catalogue public** : NE PAS utiliser `useFormatAmount` (hook lié au store auth) → utiliser `convertAmount` + `formatInCurrency` (fonctions pures exportées d'`appStore`).
- **Agrégats financiers = réconcilier avec le dashboard** : tout nouveau total CA/revenus DOIT réutiliser la source du dashboard (`Sale.total`, bornes `new Date(y,m,1)` heure serveur) pour éviter le double comptage. Modèles réels : `Sale` (revenu POS), `Expense` (dépenses, catégories Loyer/Énergie/Transport/Maintenance/Fournitures/Marketing/Formation/Autre — **pas** de « Salaires »), **pas** de table `Payroll` ni `Transaction`/`Order` client. Salaires = `Employee.salary` (projeté).
- **Tests backend = prisma mocké** (`vi.mock('../db')`, vitest) → ne JAMAIS toucher la DB prod. Extraire la logique en helpers purs (`computeReport`, `resolveMonth`) pour les tester sans Fastify.
- **Déploiement back+front couplé** : quand un changement de forme JSON touche back ET front, déployer **Railway d'abord** (route/champ dispo) puis Vercel, sinon le front lit des champs `undefined`.
- **Crons = `setInterval` horaire + garde fenêtre-temps** (`server.ts`, ex. `getDate()===1 && getHours()===8 && getMinutes()<=5`). Pour une vraie idempotence (resists restart/rejeu), ajouter un **marqueur en base** (ex. `Tenant.lastPayrollReportMonth`) et filtrer dessus dans le `findMany`. Logique extraite en service exporté (`runMonthlyPayrollReports`) pour la tester (prisma + Resend mockés).
- **Webhooks paiement sécurisés (`payments.ts`)** : Wave ET Orange Money vérifient désormais une signature **HMAC-SHA256 du raw body** (`timingSafeEqual`). Orange est **fail CLOSED** (`verifyOrangeWebhook` : sans secret ni signature → rejet) + validation montant/devise/référence contre la `PlanRequest` en attente + idempotence. **Env requise** : `ORANGE_MONEY_WEBHOOK_SECRET` (à poser sur Railway pour réactiver l'auto-activation Orange ; sinon tous les webhooks Orange sont rejetés = sûr mais inerte). `WAVE_WEBHOOK_SECRET` côté Wave.
