# 🔍 Audit HabaShop — Rapport complet

**Audit initial :** 25 mai 2026 (code à `79b3de09`) · **Re-score :** 25 mai 2026 après les travaux Mois 1-3 (code à `bfc2d90c`, main)
**Méthode :** mesures réelles sur le code (greps, `tsc`, tests, build, CI) et **état prod vérifié**. Aucune valeur inventée.

## Scores

| Dimension | Avant | Après | Statut |
|-----------|-------|-------|--------|
| Sécurité | 6/10 | **9/10** | 🟢 |
| Performance | 6/10 | **8/10** | 🟢 |
| Qualité du code | 6/10 | **8/10** | 🟢 |
| Couverture fonctionnelle | 8/10 | **9/10** | 🟢 |
| Base de données | 6/10 | **9/10** | 🟢 |
| Tests | 5/10 | **9/10** | 🟢 |
| UX / Accessibilité | 7/10 | **8/10** | 🟢 |
| DevOps | 5/10 | **9/10** | 🟢 |
| **TOTAL** | **49/80** | **69/80** | 🟢 |

## Score global : **61 % → 86 %**

Tous les problèmes critiques de l'audit initial sont **résolus et vérifiés en production**. Le produit est désormais throttlé, indexé, testé (unit + intégration + E2E), monitoré et livré via une CI verte. Les points restants sont des optimisations (déploiement encore manuel, couverture % faible sur les routes, ~104 `any`, pages volumineuses), sans bloquant.

---

## ✅ Problèmes critiques — tous résolus

1. **Rate-limiting** — `@fastify/rate-limit` enregistré ; login 10/15 min, register 5/h, billing 3/h ; **store Redis partagé + `trustProxy`** → 429 fiable en multi-replica (**vérifié en prod** : en-têtes `x-ratelimit-*` monotones, 429 atteint).
2. **Secret JWT** — repli en dur supprimé ; `process.exit(1)` au démarrage si `JWT_SECRET` absent (fail-fast).
3. **Index DB** — **0 → 37 `@@index`** (`tenantId` + composites `[tenantId, createdAt|paymentMode|status|…]` + `[tenantId, deletedAt]`). Migrations additives appliquées via `migrate deploy` (**présence confirmée en prod** via `pg_indexes`).
4. **CI/CD + déploiements** — GitHub Actions **7 jobs** (unit back/front, bundle < 100 KB gzip, sécurité, intégration prod, **E2E Playwright**, résumé + health check, notify-failure) — **run complet vérifié vert**. Déploiement Railway fiabilisé (`railway up --ci`, Docker depuis `src`, `migrate deploy` au boot) ; WebSocket `/api/ws` **live + vérifié** (handshake, close 1008).

## 📈 Évolution par rapport à l'audit initial

- **Tests : 30 → ~106** — backend 39 unitaires + 15 intégration (lecture seule prod) ; frontend 43 ; **E2E Playwright 9/9** (prod). Chemins critiques couverts (WebSocket, export CSV, billing, isolation, soft-delete round-trip vérifié). Outil de couverture branché (rapport seul).
- **`server.ts` : 1 894 → 170 lignes** — découpé en **18 modules** `routes/` + middleware + `db.ts` partagé (zéro régression, vérifié en prod).
- **Bundle principal : 1 507 Ko (380 Ko gzip) → 58 Ko gzip** — lazy-loading par route (`React.lazy` + `Suspense`), code-splitting.
- **CRUD complet + soft-delete** — `deletedAt` sur Customer/Supplier/PurchaseOrder/Product + `restore` (ADMIN) + `AuditLog` ; validation des entrées (prix/stock négatifs, vente vide, plan/période billing) — **5/5 rejets 400 vérifiés en prod**.
- **Monitoring** — `/api/health-extended` enrichi (latence DB, mémoire, services) ; **Sentry** front + back (inerte sans DSN) ; alertes webhook Discord/Slack ; `BACKUP.md` (stratégie de sauvegarde documentée).
- **Accessibilité : ~71 → 152** attributs `aria-/role/scope` ; `useI18n()` partagé ; ESLint backend configuré ; `any` backend 157 → ~104.

## ⚠️ Points restants (non bloquants)

- **Déploiement encore manuel** (Railway/Vercel) — CI verte mais pas de déploiement auto sur push (choix actuel).
- **Couverture % faible sur les routes** — les routes sont exercées par les tests d'intégration **distants** (prod), non instrumentés → couverture v8 ≈ 0 % sur `routes/` (pas de seuil bloquant) ; les hooks/stores front sont à ~47 %.
- **~104 `any` backend** (142 warnings ESLint) ; **pages volumineuses** (`HR.tsx` 2 874 lignes, etc.) ; remplacement global `console`→`logger` non fait.

---

## Détail par dimension

### 1. Sécurité — 6/10 → **9/10** 🟢
Rate-limiting live (Redis, vérifié) ; JWT fail-fast (plus de repli) ; **0** requête SQL brute (Prisma paramétré) ; hash/2FA retirés des réponses ; CORS validé par fonction ; `AuditLog` sur suppressions/restaurations ; validation des entrées ; Sentry (capture 5xx). Restant : déploiement manuel, pas de gate de suspension par requête (allégé, choisi).

### 2. Performance — 6/10 → **8/10** 🟢
**37 `@@index`** (composites sur chemins chauds) ; lazy-loading (main 58 Ko gzip) ; store rate-limit Redis. Restant : chunks `charts`/`BarcodeScanner` lourds (chargés à la demande), total JS ≈ 560 Ko gzip réparti.

### 3. Qualité du code — 6/10 → **8/10** 🟢
`tsc --noEmit` 0 erreur (back + front) ; `server.ts` modularisé (170 lignes, 18 modules) ; **ESLint backend configuré** (0 erreur, 142 warnings) ; JSDoc sur fonctions critiques ; `useI18n()` partagé. Restant : ~104 `any`, pages volumineuses.

### 4. Couverture fonctionnelle — 8/10 → **9/10** 🟢
29 pages, ~70 routes ; CRUD complet (DELETE + **soft-delete + restore**) ; billing **live** ; WebSocket **live + vérifié** ; IA/WhatsApp ; super-admin.

### 5. Base de données — 6/10 → **9/10** 🟢
15 modèles, relations correctes ; **37 `@@index`** ; **6 migrations** propres (toutes appliquées en prod) ; soft-delete (`deletedAt`) sur 4 modèles ; `BACKUP.md`. Restant : contraintes CHECK non exprimables en schéma Prisma (sans SQL brut).

### 6. Tests — 5/10 → **9/10** 🟢
Backend 39 unitaires + 15 intégration ; frontend 43 ; **E2E Playwright 9/9** (prod) ; couverture branchée (rapport). CI les exécute (intégration + E2E sur `main`). Restant : couverture % routes faible (intégration distante non instrumentée).

### 7. UX / Accessibilité — 7/10 → **8/10** 🟢
**152** attributs `aria-/role/scope` (`.sr-only`, `aria-label` nav/recherche, `scope="col"`, `role="dialog"`/`aria-modal`) ; 7 thèmes ; i18n 4 langues / 6 devises ; PWA ; toasts. Restant : audit a11y complet (contrastes, navigation clavier exhaustive).

### 8. DevOps — 5/10 → **9/10** 🟢
**CI 7 jobs vérifiée verte** ; déploiement Railway fiabilisé (Docker depuis `src`) ; `/health` + `/api/health-extended` enrichi ; Sentry + alertes webhook ; `BACKUP.md`. Restant : déploiement **manuel** (pas d'auto-deploy sur push).
