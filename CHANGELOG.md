# Changelog HabaShop

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/).
Ce changelog reflète **ce qui est réellement livré** ; les fonctionnalités codées-mais-non-déployées ou planifiées sont signalées explicitement.

## [2.3.0] — 2026-05-25 — Mois 3 : modularisation, base de données, soft-delete, tests & monitoring

> Déployé et **vérifié en production** (backend Railway + frontend Vercel).

### 🧱 Architecture backend
- `server.ts` : **2003 → 170 lignes** (bootstrap uniquement : env, CORS, JWT, rate-limit Redis, WebSocket, error handler P2025→404, `/health` + `/api/health-extended`, enregistrement des routes).
- Handlers extraits **à l'identique** dans **18 modules** `src/routes/` (`auth`, `tenant`, `products`, `customers`, `sales`, `suppliers`, `orders`, `employees`, `hr`, `expenses`, `analytics`, `export`, `billing`, `admin`, `notifications`, `whatsapp`, `ai`, `docs`).
- Middleware d'auth isolés (`src/middleware/authenticate.ts`, `superAdmin.ts`) ; client Prisma partagé (`src/db.ts`) ; augmentations de type JWT/`tenantId` déplacées dans `types.ts` (portée globale).
- `notifyTenant` + état WebSocket dans `routes/notifications.ts`, importés par `sales`/`customers`/`orders`. Crons WhatsApp enregistrés **dans** `whatsappRoutes` (plus de déclenchement à l'import — neutre en tests).
- `dist/server.js` n'est plus versionné (Railway construit depuis `src` via Dockerfile ; `dist` est git/docker-ignoré).
- **Zéro régression** : vérifié en prod (santé, 401 sur routes protégées, en-têtes rate-limit au login, handshake WebSocket → close 1008).

### 🗄️ Base de données — index composites
- **+10 index composites** (23 → **33**) sur les chemins de requête fréquents : `Sale[tenantId,paymentMode]`, `Product[tenantId,barcode]`, `Customer[tenantId,totalRevenue]` & `[tenantId,type]`, `Employee[tenantId,dept]` & `[tenantId,isActive]`, `Expense[tenantId,category]`, `AuditLog[tenantId,action]`, `PurchaseOrder[tenantId,createdAt]`, `PlanRequest[tenantId,status]`.
- Migration `20260525140000_add_composite_indexes` — **additive** (`CREATE INDEX` uniquement, zéro changement de données), appliquée en prod via `prisma migrate deploy` au déploiement (jamais `migrate dev` : `DATABASE_URL` pointe sur la prod). **Présence des 10 index confirmée en prod** (`pg_indexes`).

### 🗑️ Soft delete & validation
- **`deletedAt`** sur `Customer`, `Supplier`, `PurchaseOrder`, `Product` (+ index `[tenantId, deletedAt]` → **37 index** au total). Migration `20260525150000_add_soft_delete` — **additive** (colonnes nullables + index), appliquée via `migrate deploy`. **Colonnes + index confirmés en prod**.
- `DELETE` → suppression douce (`deletedAt = now()`) + entrée `AuditLog` ; listes/exports/analytics filtrent `deletedAt: null` ; `PATCH /api/<resource>/:id/restore` (ADMIN/SUPER_ADMIN) restaure. Fournisseur avec commandes liées : plus de 409 (la ligne est conservée). `Employee` reste sur `isActive` (pas de double mécanisme).
- **Vérifié en prod** (cycle complet sur un client jetable) : create → `DELETE` **204** (masqué de la liste, ligne conservée avec `deletedAt`) → `restore` **200** (réapparaît) → audit `DELETE_CUSTOMER`/`RESTORE_CUSTOMER` → nettoyage.
- **Validation** : produits (prix/stock négatifs), ventes (≥ 1 article, total ≥ 0), billing (plan/période/méthode) — **5/5 renvoient 400 en prod**.

### 🧪 Tests — 97 au total
- **Backend** : 39 unitaires + **15 tests d'intégration** (`integration.test.ts`, **lecture seule** contre l'API prod : auth, 401/RBAC, isolation multi-tenant, analytics, billing, super-admin, export CSV via octets bruts du BOM, santé). Connexion unique partagée pour respecter le rate-limit login (10/15 min).
- **Frontend** : **22 → 43** (`components.test.tsx` : `useI18n`, conversions de devises, `usePagination`, logique billing/thèmes/onboarding).
- Séparation **unit vs intégration** : `npm test` = unitaires seulement (hors ligne) ; `npm run test:integration` via `vitest.integration.config.ts` (timeout réseau 30 s).
- **Couverture** : `@vitest/coverage-v8` (back + front), `test:coverage` — **rapport seul, pas de seuil bloquant** (les routes sont couvertes par l'intégration distante, non instrumentée). Mesuré : hooks/stores front ~47 % (`useI18n` 92 %, `usePagination` 100 %, `appStore` 76 %).
- **E2E Playwright** : `e2e/smoke.spec.ts` (**9 tests prod, 9/9 ✓** : pages publiques + flux login/dashboard/sidebar/POS/settings/super-admin) + `playwright.config.ts` + scripts `e2e`.

### ⚙️ DevOps & monitoring (additif)
- `GET /api/health-extended` enrichi : **latence DB**, uptime, **mémoire** (heap), statut des services (redis/whatsapp/ai) — `status`/`tables` conservés (rétrocompatible).
- Filets de sécurité process : `unhandledRejection` (log, pas de crash en prod) + `uncaughtException`.
- **CI/CD** (`ci.yml`) : **7 jobs** — unit backend, unit frontend + **contrôle de taille de bundle (< 100 KB gzip)**, scan sécurité (secrets + fallback JWT + `npm audit`), tests d'intégration (lecture seule, sur `main`), **E2E Playwright** (chromium + 9 tests prod, sur `main`, rapport HTML en artefact), résumé + health check prod, **`notify-failure`** (alerte Discord). Installation **workspaces depuis la racine** (lockfile racine — pas de lockfile par app). **CI vérifiée verte** (run complet incluant le job E2E). **CI sur Node 22.**
- **Node 22** : runtime prod aligné sur la CI — `Dockerfile` `node:20-slim` → **`node:22-slim`**. `nixpacks.toml` **supprimé** (config morte : Railway utilise le `Dockerfile` via `railway.json`, et le nixpacks était cassé — phase build vide + pas de `migrate deploy`). Redéployé et **vérifié en prod sur Node 22** (build OK, boot `No pending migrations`, `/api/health-extended` 200, intégration 15/15) ; `binaryTargets` Prisma inchangés (Debian bookworm).
- **Sentry** : `@sentry/react` (front : `ErrorBoundary` + UI de repli) + `@sentry/node` (back : `captureException` sur 5xx ; P2025→404 et format de réponse **conservés**) — **inerte sans DSN** (`VITE_SENTRY_DSN` / `SENTRY_DSN`). Alertes webhook Discord/Slack (`sendAlert`, `ALERT_WEBHOOK_URL`) au crash.

### 🧹 Qualité de code
- **ESLint backend** : `.eslintrc.json` (`@typescript-eslint`) + scripts `lint`/`lint:fix` — **0 erreur, 142 warnings** (surtout `any`).
- **JSDoc** concis sur les fonctions critiques : `authenticate`, `db`/`prisma`, `billing` request-plan, `useI18n`, `convertFromXOF`.
- `src/lib/logger.ts` (front) : `log` silencieux en prod, `warn`/`error` toujours actifs.

### ♿ Accessibilité & UX (Lighthouse)
- **Lighthouse : accessibilité 91 → 100/100**, bonnes pratiques **100/100**, SEO **91/100** (audité en prod sur la landing).
- **Contraste WCAG AA** : audit `color-contrast` **PASS** (26 → 0 nœuds en échec) — texte sombre sur avatars clairs (orange/vert/bleu/rouge), labels muets `text3/text4` éclaircis, opacité de la bande pays relevée, libellé « trust » `text3`→`text2`.
- `OfflineBanner` (détection online/offline, `role="status"`) dans `AppLayout` ; lien d'évitement **skip-to-content** + `#main-content`.
- `index.html` : meta `description`, Open Graph/Twitter, `color-scheme`, titre Apple, `preconnect`/`dns-prefetch` vers l'API.

> Reportés (faible valeur / risque élevé, signalés) : réduction agressive des `any` (104 → < 50), remplacement global `console`→`logger` dans les pages, intégrations Sentry react-router/Prisma (fragiles selon la version). Contraintes type CHECK non ajoutées (non exprimables en schéma Prisma sans SQL brut). Error handler et `/health` **inchangés** (comportement vérifié conservé).

## [2.2.0] — 2026-05-25 — CRUD complet & accessibilité (Mois 2)

> Déployé et **vérifié en production** (backend Railway + frontend Vercel).

### 🗑️ Suppression (CRUD complet)
- `DELETE /api/customers/:id`, `/api/suppliers/:id`, `/api/orders/:id` — scopés par tenant (accès cross-tenant → **404**)
- Fournisseur avec commandes liées → **409** (FK P2003) ; commande → **ADMIN requis** + transaction (supprime d'abord les lignes)
- Frontend : `customersApi`/`suppliersApi.delete` + boutons **Supprimer** (icône Lucide, `confirm` + i18n + toast) dans les fiches client/fournisseur
- Vérifié bout en bout : create → `DELETE` → **204** → absent de la liste ; id inexistant → **404**
- (la suppression employé existante est conservée en hard-delete)

### ♿ Accessibilité (ARIA)
- Attributs `aria-*`/`role`/`scope` : **69 → 152**
- `.sr-only` ; `aria-label` sur les liens de navigation (Sidebar) et les champs de recherche ; `scope="col"` sur les tables (Customers, Admin, Stock, Expenses, Orders, HR) ; `role="dialog"` + `aria-modal` sur les modales ; `role="img"` + label sur le graphique des ventes
- (déjà en place : `:focus-visible`, `prefers-reduced-motion`, landmark `nav`, `NavLink` aria-current, `role="dialog"`)

### 🧪 Tests
- Backend **32 → 39** (`routes.test.ts` : DELETE CRUD + ARIA)

> Hors périmètre (décidé) : pas de gate de suspension par requête (enforcement allégé conservé). _(La découpe modulaire de `server.ts`, alors différée, a été livrée en [2.3.0].)_

## [2.1.1] — 2026-05-25 — Performance & qualité

### ⚡ Performance (frontend, déployé + vérifié en prod)
- **Lazy-loading des routes** (`React.lazy` + `Suspense`) : chunk `index` principal **1 507 kB → 194 kB** (380 → 58 kB gzip). Pages, `charts` (recharts) et `BarcodeScanner` chargés à la demande. `AppLayout` reste eager (shell) ; `Suspense` autour de l'`Outlet` garde sidebar/header pendant la navigation.

### 🧹 Qualité & typage
- **Backend `any` : 160 → 104** — augmentation `@fastify/jwt` typant `request.user` (`JWTPayload`), interfaces de body typées (`LoginBody` / `RegisterBody` / `BillingBody` dans `types.ts`), paramètres de handler typés.
- **Tests backend : 8 → 32** (`routes.test.ts` : rate-limit / isolation multi-tenant / config billing).
- Hook **`useI18n()`** partagé renvoyant `{ lang, i, formatDate, formatDateTime }` — dédoublonnage du helper i18n dans 8 pages.
- **ESLint** : config unique `.eslintrc.cjs` (suppression du doublon `.eslintrc.json`).

> Les changements backend de cette version sont **purement typage** (JS compilé inchangé) → aucun redéploiement Railway requis ; la perf frontend est déployée sur Vercel.

## [2.1.0] — 2026-05-25 — Billing, WebSocket & durcissement sécurité

> Déployé et **vérifié en production** (backend Railway + frontend Vercel).

### 💳 Système de validation des plans
- Modèle `PlanRequest` + champs billing du `Tenant` (`status`, `trialEnds`, `planActivatedAt`, `planRequestedAt`, `paymentMethod`, `paymentRef`, `suspendedAt`, `suspendReason`, `notes`, `isActive`) — migration `20260525120000_add_billing_plan_requests` **appliquée en prod**
- `register` : nouveaux tenants en `status=trial`, `trialEnds = +14 j`
- `POST /api/billing/request-plan`, `GET /api/billing/status` (auto-suspension à l'expiration de l'essai)
- `GET /api/admin/plan-requests`, `PATCH /api/admin/plan-requests/:id` (SUPER_ADMIN approve/reject)
- Frontend : `BillingBanner` (essai ≤ 7 j / expiré / demande en cours), page `/app/upgrade` (Wave / Orange Money / MTN / Virement), onglet « Demandes » dans la console super-admin
- **Vérifié de bout en bout en production (nouveau tenant)** : signup → essai 14 j → demande d'upgrade via `/app/upgrade` (Wave) → demande visible dans la console super-admin → validation → tenant passé en plan `pro` / `status=active` (tenant de test supprimé ensuite)

### 🔔 Notifications temps réel (WebSocket)
- `@fastify/websocket` ; `GET /api/ws` (auth par token en query, fermeture `1008` si token invalide)
- Diffusion isolée par tenant (`notifyTenant`) : `new_sale`, `low_stock`, `new_order`, `new_customer`
- Keepalive ping 30 s, nettoyage des sockets à la déconnexion
- Frontend : `notificationStore` (reconnexion auto 5 s), cloche du Header avec badge + dropdown — **vérifié live** (broadcast reçu, badge incrémenté, notification affichée en temps réel)

### 🔒 Sécurité (audit Semaine 1)
- **Rate-limiting** (`@fastify/rate-limit`) : login 10/15 min, register 5/h, billing 3/h — **store Redis partagé** + `trustProxy: true` (clé = vrai IP client) → 429 fiable en multi-replica (**vérifié**)
- **JWT_SECRET obligatoire** : `process.exit(1)` au démarrage si absent (suppression de la valeur de repli en dur)
- Validation des variables d'environnement requises au démarrage (`DATABASE_URL`, `JWT_SECRET`)
- **23 index Prisma** (`@@index([tenantId])` + composites) — migration appliquée en prod

### ⚙️ CI/CD & qualité
- GitHub Actions (`.github/workflows/ci.yml`) : typecheck + tests + build + scan secrets (sur push)
- `.env.example` backend/frontend à jour ; hook `useI18n()` partagé (dédoublonnage du helper i18n)

## [2.0.0] — 2026-05-25

### 🏗️ Multi-tenancy
- Isolation des données par boutique via `where: { tenantId }` sur chaque route
- JWT (HS256) contenant `userId + tenantId + role`
- Création atomique `Tenant` + `User` (rôle ADMIN) au signup (transaction Prisma)
- `User.email` globalement unique (`@unique`)
- Erreur d'accès cross-tenant mappée en **404** (handler global P2025 → 404)

### 👑 Console Super-Admin (`/admin`)
- Contrôle d'accès **basé sur le rôle** `SUPER_ADMIN` (middleware `authenticateAdmin`)
- KPIs plateforme : boutiques, utilisateurs, transactions, CA, produits, **MRR estimé**
- Répartition des plans + graphe de croissance (6 mois)
- Table des boutiques avec recherche, tri et tiroir de détail
- Onglets : Vue d'ensemble / Boutiques / Demandes
- `GET /api/admin/stats`, `GET /api/admin/tenants`, `POST /api/admin/tenants`

### 🎨 UI / UX
- 7 thèmes : Dark, Darker, Midnight, Forest, Ocean, Sunset, Light
- Icônes Lucide (remplacement des emojis d'UI), transitions, `cursor:pointer`

### 🌍 Internationalisation
- 4 langues : FR / EN / ES / IT
- 6 devises : XOF / XAF / EUR / USD / CAD / GBP — conversion temps réel
- Montants stockés en XOF, convertis à l'affichage (`useFormatAmount`)
- Graphiques Recharts re-rendus au changement de devise (`key={currency}`)

### 📊 Analytics
- `GET /api/analytics/summary` (léger, dashboard)
- `GET /api/analytics` (complet, Reports) — CA jour/mois, ventes par jour, par mode de paiement, top produits
- `GET /api/dashboard/stats`, `GET /api/reports/sales`

### 📦 Export
- CSV : `GET /api/export/:resource` (products, customers, suppliers, sales, employees)
- PDF mensuel : `GET /api/export/pdf/monthly`
- Token passé en query param pour téléchargement direct

### 🚀 Onboarding
- Flux 5 étapes : Bienvenue / Localisation / Configuration / Premier produit / Prêt
- Types de commerce : retail / wholesale / restaurant / service
- i18n 4 langues, `localStorage 'habashop_onboarded'`
- Signup → redirection vers `/onboarding`

### 💸 Pricing
- 3 plans : Starter (9 900 F/mois) · Pro (24 900) · Enterprise (49 900)
- Page `/pricing` publique, bascule mensuel/annuel, prix selon devise

### 🤖 IA & WhatsApp
- Assistant IA (Claude via Anthropic SDK) : `POST /api/ai/analyze`, `POST /api/ai/chat`
- WhatsApp (Twilio) : `broadcast`, `send-alert`, `send-ticket`, résumés programmés

### 🧪 Tests
- Frontend : **22 tests** Vitest (`currency`, `pagination`, `i18n`)
- Backend : **8 tests** Vitest (`auth` — login/register/JWT/isolation)

### 📱 PWA
- `manifest.json` + Service Worker (`vite-plugin-pwa`), installable

## [1.0.0] — 2026-05-24 — MVP

- POS / caisse, gestion stock & produits
- Clients & fournisseurs, commandes
- Employés, primes, historique salaires, dépenses
- Rapports de base
- Auth JWT
- Déploiement Railway (backend + PostgreSQL) + Vercel (frontend)

---

## 🛣️ Roadmap (non implémenté)

- **Super-Admin : activer/désactiver une boutique, changer le plan depuis la table** — le champ `isActive` existe désormais, mais les routes/boutons ne sont pas câblés.
- **Validation automatique des paiements** via Wave Business API / Orange Money API (aujourd'hui : validation manuelle prévue côté super-admin).
- **Email transactionnel** (Mailgun / SendGrid), **notifications push mobile**, **mode offline avancé**.
- **Auto-déploiement** Railway/Vercel sur push (actuellement déclenchement manuel).
