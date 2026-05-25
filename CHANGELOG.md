# Changelog HabaShop

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/).
Ce changelog reflète **ce qui est réellement livré** ; les fonctionnalités codées-mais-non-déployées ou planifiées sont signalées explicitement.

## [2.2.0] — 2026-05-25 — CRUD complet & accessibilité (Mois 2)

> Déployé et **vérifié en production** (backend Railway + frontend Vercel).

### 🗑️ Suppression (CRUD complet)
- `DELETE /api/customers/:id`, `/api/suppliers/:id`, `/api/orders/:id` — scopés par tenant (accès cross-tenant → **404**)
- Fournisseur avec commandes liées → **409** (FK P2003) ; commande → **ADMIN requis** + transaction (supprime d'abord les lignes)
- Frontend : `customersApi`/`suppliersApi.delete` + boutons **Supprimer** (icône Lucide, `confirm` + i18n + toast) dans les fiches client/fournisseur
- Vérifié bout en bout : create → `DELETE` → **204** → absent de la liste ; id inexistant → **404**
- (la suppression employé existante est conservée en hard-delete)

### ♿ Accessibilité (ARIA)
- Attributs `aria-*`/`role`/`scope` : **69 → 117**
- `.sr-only` ; `aria-label` sur les liens de navigation (Sidebar) ; `scope="col"` sur les tables (Customers, Admin, Stock) ; `role="img"` + label sur le graphique des ventes
- (déjà en place : `:focus-visible`, `prefers-reduced-motion`, landmark `nav`, `NavLink` aria-current, `role="dialog"`)

### 🧪 Tests
- Backend **32 → 39** (`routes.test.ts` : DELETE CRUD + ARIA)

> Hors périmètre (décidé) : découpe modulaire de `server.ts` (différée — risque de régression élevé) ; pas de gate de suspension par requête (enforcement allégé conservé).

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
