# ⚡ Audit Performance — HabaShop v2.6.0

**Date :** 2026-05-26
**Méthode :** `vite build` (tailles gzip réelles), `npx lighthouse` v12.8.2 sur la prod (Chrome headless), `curl` chronométré sur les endpoints prod, greps sur le code. Aucune valeur inventée.

## Scores Lighthouse (prod — `https://habashop.vercel.app`)

| Catégorie | Score |
|-----------|-------|
| Performance | **80/100** |
| Accessibilité | **100/100** |
| SEO | **100/100** |
| Bonnes pratiques | **100/100** |

> ⚠️ Lighthouse n'audite que la **landing publique**. Les écrans `/app/*` (derrière login) ne sont pas mesurés — cf. `AUDIT_UX_V2.md`.
> **Web Vitals (landing) :** FCP **3,1 s** · LCP **3,9 s** · TBT **0 ms** · CLS **0** · Speed Index **4,5 s**.

---

## Frontend

### Bundle
- Entrée `index.js` : 197,97 kB → **59,19 kB gzip** (objectif < 100 kB ✅)
- `vendor.js` : **53,76 kB gzip** · CSS : **6,4 kB gzip**
- Chunks lazy : **43** fichiers JS (code-splitting par route)
- Plus gros chunks (chargés à la demande) : `BarcodeScanner` 114 kB gz, `charts` 111 kB gz, `HR` 24 kB gz
- **Score : 9/10** (entrée légère et splittée ; les 2 gros chunks sont isolés et lazy)

### Chargement
- LCP (prod, landing) : **3,9 s** — un peu haut (cible < 2,5 s)
- TBT **0 ms** / CLS **0** — excellent (pas de blocage JS, pas de saut de layout)
- Lazy loading routes : ✅ (29 `lazy()`)
- Preconnect API : ✅ (**3** `rel="preconnect"` + 2 `modulepreload` dans `index.html`)
- PWA installable : ✅ (`sw.js` généré, `rel="manifest"` présent — vite-plugin-pwa)
- **Score : 8/10** (LCP/Speed Index à améliorer ; reste très bon)

---

## Backend

### Base de données
- Index : **37 `@@index`** (objectif > 30 ✅)
- Soft delete : **4 modèles** (`Customer`, `Supplier`, `Product`, `PurchaseOrder`)
- Pagination server-side : 🟡 **partielle** — `sales.ts` paginé (`take`/`skip` via `limit`/`offset`) ✅ ; `products.ts` **non** paginé
- **Score : 8/10**

### Cache
- Redis analytics (TTL 5/10 min) : ❌ — **aucun** cache applicatif dans `analytics.ts`
- Invalidation post-vente : ❌ — sans objet (pas de cache)
- Rate-limit Redis : ✅ — store Redis partagé si `REDIS_URL` (prod : `configured`)
- **Score : 5/10** (seul le rate-limit profite de Redis ; les agrégats analytics sont recalculés à chaque requête)

### API
- Temps réponse `/health` (prod, 3 mesures) : **0,40 s** (froid) puis **0,28 s / 0,28 s** (chaud)
- Latence DB (prod, `/api/health-extended`) : **4 ms** · uptime **9 429 s**
- Frontend prod (`curl`) : **0,33 s**
- Services prod : DB ✅ · Redis `configured` ✅ · WhatsApp `configured` ✅ · IA `configured` ✅
- Compression : `content-encoding` non observé sur `/health` (payload JSON minuscule, non compressé — non significatif)
- **Score : 8/10** (latence API et DB excellentes)

---

## Recommandations

1. **Cache analytics Redis** (TTL 5–10 min) + invalidation sur création de vente → plus gros gain backend.
2. **Réduire le LCP landing** (3,9 s) : précharger l'image/héros LCP, différer le JS non critique, vérifier les polices.
3. **Paginer `products`** (et les autres listes potentiellement longues) comme `sales`.
4. **Découper `charts`/`BarcodeScanner`** plus finement ou charger à l'interaction (déjà lazy, mais lourds individuellement).
5. **Auditer `/app/*` avec un Lighthouse authentifié** (storageState Playwright) pour chiffrer la perf réelle des écrans applicatifs denses.

> Mesures reproductibles : `npm run build`, `npx lighthouse … --output=json`, `curl -w "%{time_total}"`. Rapport analytique — aucun fichier source modifié.
