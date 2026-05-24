# Changelog HabaShop

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/).
Ce changelog reflète **ce qui est réellement livré** ; les fonctionnalités codées-mais-non-déployées ou planifiées sont signalées explicitement.

## [Non publié] — en attente de déploiement

### 💳 Système de validation des plans (codé, **pas encore déployé en prod**)
- Modèle Prisma `PlanRequest` + champs `Tenant` (`status`, `trialEnds`, `planActivatedAt`, `planRequestedAt`, `paymentMethod`, `paymentRef`, `suspendedAt`, `suspendReason`, `notes`, `isActive`)
- Migration additive `20260525120000_add_billing_plan_requests` — **non appliquée** sur la base prod (déploiement Railway en attente)
- Backend : `POST /api/billing/request-plan`, `GET /api/billing/status` (auto-suspension à l'expiration de l'essai), `GET /api/admin/plan-requests`, `PATCH /api/admin/plan-requests/:id`
- Frontend : `BillingBanner` (essai ≤ 7 j / expiré / demande en cours), page `/app/upgrade` (Wave / Orange Money / MTN / Virement), onglet « Demandes » dans la console super-admin
- `register` initialise les nouveaux tenants en `status=trial`, `trialEnds = +14 j`

> Le frontend est en ligne et dégrade proprement : tant que les routes backend renvoient 404, la `BillingBanner` reste masquée.

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

- **Notifications temps réel WebSocket** — *non implémenté* (pas de `@fastify/websocket`, pas de route `/api/ws`). Les notifications actuelles sont côté frontend.
- **Super-Admin : activer/désactiver une boutique, changer le plan depuis la table** — nécessite des routes + (déjà prévu) le champ `isActive` ; non câblé.
- **Validation automatique des paiements** via Wave Business API / Orange Money API (aujourd'hui : validation manuelle prévue côté super-admin).
- **Email transactionnel** (Mailgun / SendGrid), **notifications push mobile**, **mode offline avancé**.
- **Auto-déploiement** Railway/Vercel sur push (actuellement déclenchement manuel).
