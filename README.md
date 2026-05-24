# 🛒 HabaShop — SaaS de Gestion Commerciale

> Solution complète de gestion pour commerces d'Afrique francophone
> (Sénégal, Côte d'Ivoire, Mali, Cameroun, RDC…) — épiceries, grossistes, demi-grossistes.

## 🌐 URLs Production

| Service  | URL |
|----------|-----|
| Frontend | https://habashop.vercel.app |
| Backend  | https://habashop-production.up.railway.app |
| GitHub   | https://github.com/ndjoumessi/habashop |

## 🔑 Comptes démo

Mot de passe commun : `demo1234`

| Email | Rôle | Boutique |
|-------|------|----------|
| admin@habashop.com | SUPER_ADMIN | HabaShop — Dakar Central |
| manager@habashop.com | MANAGER | HabaShop — Dakar Central |
| cashier@habashop.com | CASHIER | HabaShop — Dakar Central |
| accountant@habashop.com | ACCOUNTANT | HabaShop — Dakar Central |
| hr@habashop.com | HR | HabaShop — Dakar Central |
| kone@habashop.com | ADMIN | Alimentation Koné — Abidjan |

> `admin@habashop.com` est `SUPER_ADMIN` (accès à la console `/admin`). Le login tente d'abord le backend réel ; en cas d'échec réseau, un mode démo local prend le relais pour ces comptes.

## 🏗️ Stack technique

### Frontend
- React 18 + TypeScript + Vite
- Zustand (state management) + React Router v6
- Recharts (graphiques)
- PWA (service worker, installable)
- Déploiement : Vercel

### Backend
- Fastify 4 + Node.js 20
- Prisma ORM + PostgreSQL (Railway)
- Auth JWT (`@fastify/jwt`) — payload `{ userId, tenantId, role }`
- `@fastify/rate-limit`, `@fastify/cors`
- Swagger / OpenAPI (`@fastify/swagger` + `swagger-ui`)
- Twilio SDK (WhatsApp), Anthropic SDK (assistant IA — Claude)
- Déploiement : Railway (Docker, `prisma migrate deploy` au démarrage)

### Infrastructure
- Railway (backend + PostgreSQL)
- Vercel (frontend — déployé depuis `apps/frontend`)
- GitHub

## 📦 Modules

### Commerce
- ✅ POS / Caisse
- ✅ Stock & produits
- ✅ Commandes clients & fournisseurs
- ✅ Clients (CRM + fidélité)
- ✅ Fournisseurs

### Finance
- ✅ Dépenses
- ✅ Rapports & analytics
- ✅ Prévisions CA
- ✅ Export CSV + PDF

### RH
- ✅ Employés, contrats
- ✅ Planning & congés
- ✅ Paie & bulletins
- ✅ Primes & historique salaires

### Marketing & IA
- ✅ Assistant IA (Claude) — `/api/ai/analyze`, `/api/ai/chat`
- ✅ Notifications WhatsApp (Twilio)
- ✅ Marketing & objectifs / KPIs

### Administration
- ✅ Journal d'activités (AuditLog)
- ✅ Gestion utilisateurs (par boutique)
- ✅ Paramètres boutique (7 thèmes UI)
- ✅ Console Super-Admin (`/admin`) — boutiques, MRR, demandes de plans

## 🌍 Internationalisation
- **4 langues** : Français, English, Español, Italiano
- **6 devises** : XOF, XAF, EUR, USD, CAD, GBP — conversion temps réel (taux récupérés au démarrage)
- **7 thèmes UI** : Dark, Darker, Midnight, Forest, Ocean, Sunset, Light

## 🏢 Multi-Tenancy
- Isolation des données par boutique via `where: { tenantId }` sur chaque requête
- Le JWT contient `userId + tenantId + role`
- Chaque `signup` crée un `Tenant` + un `User` rôle `ADMIN`
- `User.email` est **globalement unique** (`@unique`)

## 💳 Système de pricing

| Plan | Prix/mois (XOF) | Utilisateurs | Produits |
|------|-----------------|--------------|----------|
| Starter | 9 900 F CFA | 1 | 100 max |
| Pro | 24 900 F CFA | 5 | Illimité |
| Enterprise | 49 900 F CFA | Illimité | Illimité |

### Flux de validation (marché africain)
1. **Signup** → essai 14 jours (`status: trial`, plan Starter)
2. **Upgrade** → demande de plan via Wave / Orange Money / MTN Money / Virement
3. **Super-Admin** valide la demande → plan activé (24–48 h)

> ⚠️ **Statut** : le système de validation des plans (modèle `PlanRequest`, routes `/api/billing/*` et `/api/admin/plan-requests`, page `/app/upgrade`, `BillingBanner`) est **implémenté et committé** mais **pas encore déployé en production** (déploiement backend Railway en attente). Le frontend dégrade proprement tant que les routes ne sont pas en ligne.

## 🔌 API — endpoints principaux

> Base : `https://habashop-production.up.railway.app` · Docs Swagger : `/api/docs/html`

### Auth
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`

### Tenant
- `GET /api/tenant` · `PATCH /api/tenant` · `PUT /api/tenant`
- `GET /api/tenant/users` · `POST /api/tenant/users`

### Commerce
- `GET|POST /api/products` · `PUT|DELETE /api/products/:id` · `GET /api/products/low-stock`
- `GET|POST /api/customers` · `PUT /api/customers/:id` · `GET|POST /api/customers/:id/loyalty`
- `GET|POST /api/suppliers` · `PUT /api/suppliers/:id`
- `GET|POST /api/sales`
- `GET|POST /api/orders` · `PATCH /api/orders/:id/status`

### RH
- `GET|POST /api/employees` · `PUT|DELETE /api/employees/:id`
- `GET|POST /api/bonuses` · `GET /api/bonuses/employee/:employeeId` · `DELETE /api/bonuses/:id`
- `GET|POST /api/salary-history` · `GET /api/salary-history/employee/:employeeId`
- `GET|POST /api/expenses` · `PUT|DELETE /api/expenses/:id`

### Analytics & Export
- `GET /api/analytics` · `GET /api/analytics/summary`
- `GET /api/dashboard/stats` · `GET /api/reports/sales`
- `GET /api/export/:resource` (products / customers / suppliers / sales / employees)
- `GET /api/export/pdf/monthly`

### IA & WhatsApp
- `POST /api/ai/analyze` · `POST /api/ai/chat`
- `POST /api/whatsapp/broadcast` · `POST /api/whatsapp/send-alert` · `POST /api/whatsapp/send-ticket`

### Super-Admin (rôle `SUPER_ADMIN`)
- `GET /api/admin/stats` · `GET /api/admin/tenants` · `POST /api/admin/tenants`

### Billing — *implémenté, déploiement en attente*
- `POST /api/billing/request-plan` · `GET /api/billing/status`
- `GET /api/admin/plan-requests` · `PATCH /api/admin/plan-requests/:id`

## 🚀 Installation locale

> **Node.js 20 requis.** Un Node trop ancien casse `tsc` / Vite.

```bash
# Cloner
git clone https://github.com/ndjoumessi/habashop.git
cd habashop

# Dépendances (monorepo)
npm install

# Variables d'environnement
#  apps/backend/.env  →  DATABASE_URL (PostgreSQL), JWT_SECRET, PORT (def. 3001)
#                        ANTHROPIC_API_KEY (IA), TWILIO_* (WhatsApp) — optionnels
#  apps/frontend/.env →  VITE_API_URL (def. https://habashop-production.up.railway.app)

# Prisma : générer le client + appliquer les migrations
npm run db:generate --workspace=apps/backend
npm run db:migrate  --workspace=apps/backend   # prisma migrate deploy

# Démarrer
npm run dev --workspace=apps/backend   # API sur http://localhost:3001
npm run dev --workspace=apps/frontend  # UI  sur http://localhost:5173
```

## 🛠️ Build & déploiement

```bash
# Frontend (build + déploiement Vercel — depuis apps/frontend)
cd apps/frontend && npm run build && npx vercel --prod

# Backend (build local)
cd apps/backend && npm run build       # tsc -> dist/

# Backend (déploiement Railway, builder Docker)
#  Le Dockerfile compile depuis src (tsc) puis exécute :
#  prisma migrate deploy && node dist/server.js
```

> ℹ️ Le frontend **ne se déploie pas automatiquement** au `git push` : lancer `vercel --prod` **depuis `apps/frontend`** (un déploiement depuis la racine renvoie un 404).

## 🗄️ Base de données (15 modèles Prisma)

`Tenant` · `User` · `Product` · `Sale` · `SaleItem` · `Customer` · `Supplier` · `PurchaseOrder` · `PurchaseOrderItem` · `Employee` · `EmployeeBonus` · `SalaryHistory` · `Expense` · `AuditLog` · `PlanRequest`

> Toutes les tables métier portent un `tenantId` (isolation). `PlanRequest` et les champs de facturation du `Tenant` (`status`, `trialEnds`, …) existent dans le schéma mais leur migration **n'est pas encore appliquée en prod** (voir le statut billing ci-dessus).

## 📱 PWA mobile
- `manifest.json` + Service Worker (généré au build via `vite-plugin-pwa`)
- Installable (bouton d'installation in-app)
- Responsive

## 📁 Structure

```
habashop/
├── apps/
│   ├── frontend/   # React 18 + TS + Vite (Vercel)
│   └── backend/    # Fastify + Prisma (Railway, Docker)
└── README.md
```

## 📄 Licence
Propriétaire — © 2026 HabaShop. Tous droits réservés.
