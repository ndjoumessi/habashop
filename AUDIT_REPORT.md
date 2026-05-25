# 🔍 Audit HabaShop — Rapport complet

**Date :** 25 mai 2026 · **Version auditée :** code à `79b3de09` (main)
**Méthode :** mesures réelles sur le code (greps, `tsc`, tests, build, état prod). Aucune valeur inventée.

## Scores

| Dimension | Score | Statut |
|-----------|-------|--------|
| Sécurité | 6/10 | 🟡 |
| Performance | 6/10 | 🟡 |
| Qualité du code | 6/10 | 🟡 |
| Couverture fonctionnelle | 8/10 | 🟢 |
| Base de données | 6/10 | 🟡 |
| Tests | 5/10 | 🟡 |
| UX / Accessibilité | 7/10 | 🟡 |
| DevOps | 5/10 | 🟡 |
| **TOTAL** | **49/80** | 🟡 |

## Score global : **61 %**

Produit fonctionnellement riche et type-safe à la compilation, mais avec des angles morts d'**exploitation** (rate-limiting non branché, secret JWT à défaut faible, pas d'index DB, pas de CI/CD, déploiements manuels et instables). Aucun bloquant fonctionnel ; les correctifs critiques sont rapides.

---

## ✅ Points forts

- **Isolation multi-tenant solide** : `tenantId` filtré dans ~141 emplacements sur 67 routes ; un accès cross-tenant renvoie **404** (handler global Prisma `P2025`), comportement vérifié en session.
- **Aucune requête SQL brute** (`$queryRaw`/`$executeRaw` = 0) → surface d'injection SQL nulle (Prisma paramétré).
- **Secrets non exposés** : `passwordHash` et `twoFASecret` retirés des réponses (`/api/tenant/users`) ; login/register ne renvoient jamais le hash.
- **TypeScript propre** : `tsc --noEmit` passe sans erreur côté backend **et** frontend.
- **Couverture fonctionnelle large** : 29 pages, 67 routes API, tous les modules majeurs présents (POS, stock, clients, fournisseurs, ventes, commandes, RH/paie, dépenses, rapports, analytics, IA, WhatsApp, billing, super-admin, onboarding, pricing).
- **Billing en production** : routes `/api/billing/*` live, flux d'upgrade déjà exercé (demande Pro en attente observée).
- **i18n 4 langues + 6 devises** avec conversion temps réel ; **PWA** (service worker, installable).
- **CORS** validé par fonction (localhost + `FRONTEND_URL`), `credentials: true`.
- **Build front découpé** (chunks `vendor` / `charts` / `ui` séparés) ; `.env.example` présent.

## 🔴 Problèmes critiques (à corriger immédiatement)

1. **Rate-limiting non appliqué.** `@fastify/rate-limit` est une dépendance et la doc `/api/docs` annonce « 100/minute par token », mais le plugin **n'est ni importé ni enregistré**. Les endpoints d'auth (`/api/auth/login`, `/register`) sont **non throttlés** → risque de brute-force / abus.
2. **Secret JWT à valeur de repli en dur.** `secret: process.env.JWT_SECRET ?? 'habashop-secret-dev-2026'`. Si `JWT_SECRET` n'est pas défini en prod, des tokens sont signés avec un secret **public connu** → forge de tokens possible. Doit **échouer au démarrage** si la variable manque.
3. **Aucun index en base.** `@@index` = 0 alors que `tenantId` est filtré ~141 fois. Les colonnes `tenantId` / clés étrangères ne sont pas indexées (Postgres n'indexe pas les FK automatiquement) → scans séquentiels et dégradation à la montée en charge.
4. **Pas de CI/CD et déploiements instables.** Aucun `.github/workflows`. Les déploiements Railway **et** Vercel sont manuels et n'ont pas atterri de façon fiable (le code WebSocket — commit `79b3de09` — n'est **toujours pas en prod** : `/api/ws` renvoie 404).

## ⚠️ Points d'amélioration (priorisés)

- **Tests sous l'objectif** : 22 (front) + 8 (back) = 30, mais routes critiques **non testées** : `POST /api/sales`, billing request, WebSocket, export CSV, la plupart des CRUD.
- **`server.ts` monolithique** : 1 894 lignes (> seuil de refactor 1 500). À découper par domaine.
- **Typage faible** : 157 occurrences de `: any` / `as any` côté backend.
- **Pages volumineuses** : `HR.tsx` 2 874, `POS.tsx` 1 890, `Customers.tsx` 1 795 lignes.
- **i18n dupliqué** : helper `const i = (fr,en,es,it)` recopié dans 8 pages → extraire un hook `useI18n()`.
- **ESLint non configuré** : la dépendance existe mais **aucun fichier de config** → linting non appliqué.
- **Bundle principal lourd** : `index` = 1,5 Mo (≈ 380 Ko gzip), **pas de lazy-loading par route** ni code-splitting applicatif.
- **CRUD incomplet** : `DELETE` seulement sur products/employees/bonuses/expenses ; absent sur customers/suppliers/sales/orders.
- **Logs backend** : 27 `console.*` → vérifier qu'aucune donnée sensible/token n'est journalisée.
- **Accessibilité éparse** : ~71 attributs `aria-/role/alt` pour une app de cette taille.

## 📋 Plan d'action recommandé

### Semaine 1 — Critique
- Enregistrer `@fastify/rate-limit` (auth + global), avec limites réelles.
- Supprimer le repli de secret JWT ; **fail-fast** si `JWT_SECRET` absent.
- Ajouter les index : `@@index([tenantId])` sur les modèles métier (et composites utiles : `[tenantId, createdAt]`), migration additive.
- Fiabiliser le déploiement backend Railway (faire atterrir `/api/ws`) ; vérifier les Deploy Logs (runtime), pas seulement le build.

### Semaine 2 — Important
- Tests des chemins critiques : `POST /api/sales`, billing request, connexion WebSocket, format export CSV, isolation tenant (déjà couverte — étendre).
- Configurer ESLint (config + script) et corriger les warnings.
- Compléter les CRUD (`DELETE` customers/suppliers/orders) selon les besoins métier.
- Extraire `useI18n()` partagé.

### Mois 2 — Optimisation
- Lazy-loading des routes (`React.lazy` + `Suspense`) pour réduire le bundle de 1,5 Mo.
- Découper `server.ts` par domaine (auth / commerce / RH / billing / admin).
- Réduire l'usage de `any` (typer les `request.body` / `params`).

### Mois 3 — Évolution
- CI/CD GitHub Actions : lint + tests + build (+ déploiement) à chaque push.
- Monitoring / alerting (erreurs, latence) et stratégie de backup DB documentée.
- Persistance / historique des notifications (aujourd'hui WebSocket éphémère).

---

## Détail par dimension

### 1. Sécurité — 6/10 🟡
- JWT : secret via `process.env.JWT_SECRET` (mais repli en dur), expiration **7 j** (OK mobile), `jwtVerify` appliqué via le middleware `authenticate`.
- Injection : **0** requête brute → protégé par Prisma.
- Données sensibles : hash retiré des réponses (`{ passwordHash, twoFASecret, ...u }`).
- CORS : origine validée (localhost + `FRONTEND_URL`), credentials inclus.
- `process.env` : 13 usages ; pas de clé API en dur détectée (hors le repli JWT).
- ❌ Rate-limiting documenté mais **non branché**.

### 2. Performance — 6/10 🟡
- Build : `index` 1 507 Ko (380 Ko gzip), `charts` 434 Ko (115 Ko gzip), `vendor` 164 Ko (54 Ko gzip), `ui` 64 Ko (15 Ko gzip). Total JS ≈ 560 Ko gzip → léger dépassement de la cible 500 Ko.
- Découpage manuel présent, mais **pas de lazy-loading par page**.
- ❌ **0 `@@index`** malgré 141 filtres `tenantId`.
- Modèle « suspend » allégé : pas de requête tenant par requête.

### 3. Qualité du code — 6/10 🟡
- `tsc --noEmit` : **0 erreur** (back + front).
- `server.ts` : **1 894 lignes** ; 157 `any` ; 89 commentaires ; 27 `console.*`.
- Frontend : `console.log` dans seulement 2 fichiers de pages (propre).
- ESLint : **aucune config** → non appliqué.

### 4. Couverture fonctionnelle — 8/10 🟢
- 29 pages, 67 routes. Modules complets ; billing **live**.
- WebSocket : **implémenté + vérifié en local** (handshake, rejet token, broadcast `new_customer`) mais **pas déployé** (`/api/ws` = 404 en prod).
- CRUD partiel (deletes limités).

### 5. Base de données — 6/10 🟡
- **15 modèles**, relations correctes, 12 modèles avec `tenantId`, `createdAt`/`updatedAt` répandus (22 occurrences).
- **3 migrations** nommées proprement (`init`, `add_employee_bonuses_salary_history`, `add_billing_plan_requests`) — toutes appliquées en prod.
- Seed : 145 lignes (2 tenants démo). `email` en `@unique` (global).
- ❌ **Aucun `@@index`**.

### 6. Tests — 5/10 🟡
- Frontend : **22** tests (3 fichiers : currency, pagination, i18n) — ✅ passent.
- Backend : **8** tests (auth, isolation multi-tenant) — ✅ passent.
- Sous les objectifs (30 / 20) ; chemins critiques non couverts.

### 7. UX / Accessibilité — 7/10 🟡
- Responsive : 9 règles `@media`/breakpoints dans `index.css`.
- Feedback : `toast` utilisé dans 25 pages.
- a11y : ~71 attributs `aria-/role/alt`.
- i18n : 4 langues ; helper dupliqué dans 8 pages.

### 8. DevOps — 5/10 🟡
- Railway : builder **Dockerfile** (`railway.json`), `prisma migrate deploy && node dist/server.js` au démarrage.
- Scripts : back `build: tsc` / `start: node dist/server.js` ; front `build: tsc && vite build`.
- `.env.example` ✅ ; health `/health` + `/api/health-extended` ✅.
- ❌ Pas de CI/CD ; déploiements manuels et instables ; monitoring/backup non documentés.
