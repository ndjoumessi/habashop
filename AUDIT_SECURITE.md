# 🔐 Audit Sécurité — HabaShop v2.6.0

**Date :** 2026-05-26
**Méthode :** mesures réelles (greps sur `src/`, lecture des middlewares, `npm audit`, vérifs prod en lecture seule). Aucune valeur inventée.

## Score global : **90/100**

> Sécurité **du code** excellente (97/100 sur les 4 catégories). Le score global est ramené à **90** par les **vulnérabilités de dépendances non patchées** (1 critique + 5 hautes côté backend), seul risque réellement actionnable.

---

## Vérifications

### Authentification & Autorisation
- JWT fail-fast : ✅ — `REQUIRED_ENV_VARS=['DATABASE_URL','JWT_SECRET']` + `process.exit(1)` au démarrage si absent (`server.ts:39-44`) ; plus de repli en dur (`server.ts:98`)
- Rate limiting login : ✅ — **10 / 15 min** avec message FR + `retryAfter` (`auth.ts:11`)
- Rate limiting register : ✅ — **5 / 1 h** (`auth.ts:55`)
- Rate limiting billing : ✅ — **3 / 1 h** (`billing.ts:24`) · paiements Wave/OM : **5 / 1 h** (`payments.ts`)
- Multi-tenant isolation : ✅ — `authenticate` injecte `request.tenantId` ; requêtes scopées `where:{ tenantId }` (vérifié par les 15 tests d'intégration prod)
- RBAC routes admin : ✅ — `authenticateAdmin` exige `role === 'SUPER_ADMIN'` (403 sinon)
- Couverture auth : **17 / 19** fichiers de routes utilisent un `preHandler` d'auth (les 2 restants = webhooks de paiement signés + santé, volontairement publics)

### Secrets & Configuration
- Secrets hardcodés : ✅ — **0 trouvé** (`sk-ant`, `wave_sn_prod`, `re_`, `AC[0-9a-f]{32}` : aucun en clair dans `src/`)
- Variables d'env validées au démarrage : ✅ (`process.exit(1)` sur manquant)
- JWT secret obligatoire : ✅
- `.env.example` sans vraies valeurs : ✅ — **0** vraie clé (placeholders `XXXX`/`CHANGE_ME` uniquement)

### Injection & Validation
- SQL injection (Prisma paramétré) : ✅ — **1 seul** `$queryRaw` dans tout `src/`, et c'est le `SELECT 1` du health-check (non injectable). Aucun `executeRaw`.
- Validation inputs billing : ✅ — plan ∈ {pro, enterprise}, période ∈ {monthly, yearly}, méthode whitelistée (`billing.ts`)
- Validation inputs produits : ✅ — nom requis, prix d'achat/vente & stock négatifs rejetés en 400 (`products.ts:23-32`)
- Passwords jamais retournés : ✅ — `passwordHash`/`twoFASecret` retirés des réponses (`tenant.ts:38,58`) ; login/register renvoient un `user` à champs sélectionnés (`auth.ts:42,110`)

### Transport & CORS
- HTTPS forcé (Vercel/Railway) : ✅ (terminaison TLS plateforme)
- CORS restreint : ✅ — allow-list (`habashop.vercel.app` + `FRONTEND_URL`) + localhost **dev uniquement** ; rejet explicite sinon (`server.ts:80-93`)
- `trustProxy` configuré : ✅ — `Fastify({ trustProxy: true })` → IP client réelle pour le rate-limit derrière le proxy Railway (`server.ts:77`)
- Webhooks paiement : signature HMAC Wave vérifiée (`verifyWaveWebhook`) avec garde longueur ; **permissif en sandbox** tant que `WAVE_WEBHOOK_SECRET` est absent (à durcir en prod)

### Dépendances (`npm audit`)
- **Backend : 12 vulnérabilités — 1 critique, 5 hautes, 6 modérées**
  - 🔴 critique : `fast-jwt` (≤ 6.2.3) · 🟠 hautes : `fastify`, `fast-uri`, `fast-json-stringify`, `@fastify/ajv-compiler`, `@fastify/fast-json-stringify-compiler`
  - Toutes **transitives** de la chaîne Fastify 4.x → corrigées en montant Fastify (mise à jour majeure à tester).
- **Frontend : 6 vulnérabilités modérées** (chaîne de build, non runtime).

---

## Risques identifiés

### 🔴 Critiques
1. **`fast-jwt ≤ 6.2.3` (critique, transitif de Fastify 4.x).** Touche la vérification de tokens. À patcher en priorité (montée de `fastify`/`@fastify/jwt`).

### 🟠 Majeurs
2. **5 vulnérabilités hautes backend** dans la chaîne Fastify (`fastify`, `fast-uri`, `fast-json-stringify`, compilers). Même remédiation que #1.
3. **Webhooks de paiement permissifs en sandbox.** `verifyWaveWebhook` renvoie `true` si `WAVE_WEBHOOK_SECRET` est absent, et le webhook Orange n'a pas de signature. Acceptable en sandbox ; **doit être durci** (rejet si secret absent, validation OM) avant d'accepter de l'argent réel.

### 🟡 Mineurs
4. **CORS autorise tout `localhost`** (regex) — réservé au dev, sans risque en prod (origines distantes hors allow-list rejetées), mais à garder à l'œil.
5. **6 vulnérabilités modérées frontend** (build/dev), faible exposition runtime.

---

## Score par catégorie

| Catégorie | Score |
|-----------|-------|
| Auth & Authz | 24/25 |
| Secrets | 25/25 |
| Injection | 24/25 |
| Transport & CORS | 24/25 |
| **Sous-total code** | **97/100** |
| Ajustement dépendances (1 critique + 5 hautes non patchées) | −7 |
| **Total** | **90/100** |

> **Verdict :** posture de code très solide (auth fail-fast, isolation tenant, 0 secret, Prisma paramétré, mots de passe jamais exposés). Le **seul** chantier sécurité prioritaire est la **mise à jour de la chaîne Fastify** (1 critique), puis le **durcissement des webhooks de paiement** avant la prod monétaire.
