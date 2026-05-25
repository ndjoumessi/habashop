# HabaShop — API Reference

**Base URL :** `https://habashop-production.up.railway.app`
**Docs interactives (Swagger UI) :** `/api/docs/html` · **OpenAPI JSON :** `/api/docs`

> Cette référence ne liste que les routes **réellement présentes** dans `apps/backend/src/server.ts`. Les routes de facturation sont marquées *(non déployée)* — elles existent dans le code mais leur déploiement Railway est en attente.

## Authentification

Toutes les routes protégées exigent un en-tête :

```
Authorization: Bearer <JWT>
```

Le JWT (HS256, expiration 7 j) contient `{ userId, tenantId, role }`. On l'obtient via `/api/auth/login` ou `/api/auth/register`.

- **401** : token absent/invalide/expiré → le client efface le token et redirige vers `/login`.
- **403** : rôle insuffisant (ex. routes `/api/admin/*` hors `SUPER_ADMIN`).
- **404** : ressource introuvable **ou** appartenant à un autre tenant (handler global Prisma `P2025` → 404).
- Format d'erreur : `{ "error": "message" }` (ou `{ "statusCode", "error", "message" }`).

---

## Auth

### `POST /api/auth/register`
Crée une boutique (Tenant) + un utilisateur ADMIN. Démarre un essai de 14 jours.
```jsonc
// body
{ "name": "Aminata Diallo", "email": "a@shop.sn", "password": "•••",
  "shopName": "Épicerie Centrale", "currency": "XOF", "country": "SN" }
// 201
{ "token": "eyJ…",
  "user": { "id", "name", "email", "role": "ADMIN", "shopName" },
  "tenant": { "id", "name", "status": "trial", "trialEnds", "trialDaysLeft": 14, "canUpgrade": true } }
```

### `POST /api/auth/login`
```jsonc
// body
{ "email": "admin@habashop.com", "password": "demo1234" }
// 200
{ "token": "eyJ…", "user": { "id","name","email","role","shopName" }, "tenant": { … } }
```

### `GET /api/auth/me` 🔒
Retourne l'utilisateur courant.

---

## Tenant 🔒

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/tenant` | Boutique courante |
| PATCH / PUT | `/api/tenant` | Met à jour la boutique (`name`, `country`, `currency`, `vatRate`, `phone`, `address`…) |
| GET | `/api/tenant/users` | Utilisateurs de la boutique |
| POST | `/api/tenant/users` | Crée un utilisateur (`name`, `email`, `password`, `role`) |

---

## Commerce 🔒

| Méthode | Route | Description |
|---|---|---|
| GET / POST | `/api/products` | Liste / crée un produit |
| PUT / DELETE | `/api/products/:id` | Met à jour / supprime |
| GET | `/api/products/low-stock` | Produits sous le seuil min |
| GET / POST | `/api/customers` | Liste / crée un client |
| PUT | `/api/customers/:id` | Met à jour |
| GET / POST | `/api/customers/:id/loyalty` | Points de fidélité |
| GET / POST | `/api/suppliers` | Liste / crée un fournisseur |
| PUT | `/api/suppliers/:id` | Met à jour |
| GET / POST | `/api/sales` | Liste / enregistre une vente |
| GET / POST | `/api/orders` | Liste / crée une commande |
| PATCH | `/api/orders/:id/status` | Change le statut |

```jsonc
// POST /api/sales — body
{ "items": [{ "productId": "…", "qty": 2, "price": 1500 }],
  "paymentMode": "cash|card|wave|orange_money",
  "total": 3000,
  "discount": { "amount": 0, "type": null } }   // optionnel
```

---

## RH 🔒

| Méthode | Route | Description |
|---|---|---|
| GET / POST | `/api/employees` | Liste / crée |
| PUT / DELETE | `/api/employees/:id` | Met à jour / supprime |
| GET / POST | `/api/bonuses` | Primes |
| GET | `/api/bonuses/employee/:employeeId` | Primes d'un employé |
| DELETE | `/api/bonuses/:id` | Supprime une prime |
| GET / POST | `/api/salary-history` | Historique salaires |
| GET | `/api/salary-history/employee/:employeeId` | Historique d'un employé |
| GET / POST | `/api/expenses` | Dépenses |
| PUT / DELETE | `/api/expenses/:id` | Met à jour / supprime |

---

## Analytics, Rapports & Export 🔒

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/analytics/summary` | KPIs légers (dashboard) |
| GET | `/api/analytics` | KPIs complets + charts (Reports) |
| GET | `/api/dashboard/stats` | Stats dashboard |
| GET | `/api/reports/sales` | Rapport ventes |
| GET | `/api/export/:resource` | CSV — `products`/`customers`/`suppliers`/`sales`/`employees` |
| GET | `/api/export/pdf/monthly` | Rapport mensuel (PDF/HTML) |

```jsonc
// GET /api/analytics/summary — 200
{ "caToday": 6750, "txToday": 2, "caMonth": 356250, "txMonth": 58, "customers": 3, "products": 13 }
```

---

## IA & WhatsApp 🔒

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/ai/analyze` | Analyse IA (Claude) du contexte boutique |
| POST | `/api/ai/chat` | Conversation IA |
| POST | `/api/whatsapp/broadcast` | Diffusion |
| POST | `/api/whatsapp/send-alert` | Alerte |
| POST | `/api/whatsapp/send-ticket` | Ticket de caisse |

> Nécessitent `ANTHROPIC_API_KEY` (IA) / `TWILIO_*` (WhatsApp). Renvoient `503` si non configuré.

---

## Super-Admin 🔒 `SUPER_ADMIN`

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/stats` | KPIs plateforme (tenants, users, ventes, CA, produits) |
| GET | `/api/admin/tenants` | Toutes les boutiques (+ `_count`) |
| POST | `/api/admin/tenants` | Crée une boutique (+ admin optionnel) |

---

## Billing — *implémenté, non déployé*

> Présent dans le code mais la migration et les routes ne sont **pas encore en ligne** (renvoient 404 en prod tant que le backend n'est pas redéployé).

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/billing/status` 🔒 | Statut plan + jours d'essai restants (auto-suspend si expiré) |
| POST | `/api/billing/request-plan` 🔒 | Demande d'upgrade (`plan`, `period`, `paymentMethod`, `paymentRef?`, `notes?`) |
| GET | `/api/admin/plan-requests` 🔒 `SUPER_ADMIN` | Demandes en attente |
| PATCH | `/api/admin/plan-requests/:id` 🔒 `SUPER_ADMIN` | `{ action: "approve" \| "reject", adminNotes? }` |

---

## Santé & Docs (public)

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | `{ status, version, build, timestamp }` |
| GET | `/api/health-extended` | Santé détaillée |
| GET | `/api/docs` | OpenAPI JSON |
| GET | `/api/docs/html` | Swagger UI |

---

> ❌ **N'existent pas** (présents dans d'anciennes specs, mais pas dans le code) : `WS /api/ws` / WebSocket, `GET /api/notifications`, `PATCH /api/admin/tenants/:id`.
