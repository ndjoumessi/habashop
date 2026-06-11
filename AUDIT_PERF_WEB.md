# Audit Performance Web — Frontend HabaShop (Agent D)

Date : 2026-06-10 · Build mesuré localement (`npm run build`, vite-plugin-pwa, sourcemaps `hidden` uploadées Sentry puis absentes de dist) + comparaison avec le bundle PROD réellement servi (`habashop.vercel.app`).

---

## 1. Métriques de référence

### Taille totale
| Mesure | Valeur |
|---|---|
| `dist/` total (build local) | **3,2 Mo** (dont `dist/assets` 2,9 Mo, 0 sourcemap publiée) |
| Précache PWA (sw.js) | **68 entrées / 2 826 Kio** — TOUS les chunks, y compris `barcode`, `charts`, `Customers` |
| Chunk principal `index-*.js` **local** | 208 299 o raw / **62,4 Ko gz / 52,0 Ko br** |
| Chunk principal `index-*.js` **PROD Vercel** (`index-DErgfURp.js`) | **485 733 o raw / 153,5 Ko gz** — le delta (+277 Ko raw / **+91 Ko gz**) = SDK Sentry (browserTracing + **Replay/rrweb**), tree-shaké en local car `VITE_SENTRY_DSN` n'est défini que dans le build Vercel |
| Payload initial PROD (gz) | index 153,5 + vendor 54,2 + ui 16,5 + css 7,6 ≈ **232 Ko gz** avant le 1er chunk de page |

### Top 10 chunks (build local, raw / gzip)
| Chunk | Raw | Gzip | Contenu |
|---|---|---|---|
| `barcode-*.js` | 443 843 | 111 868 | @zxing — lazy (ouverture scanner) ✅ |
| `charts-*.js` | 411 270 | 110 847 | recharts + d3 — lazy (Dashboard/Reports) ✅ |
| `Customers-*.js` | 317 840 | 81 081 | page Customers **+ html2canvas embarqué** ⚠️ |
| `index-*.js` | 208 299 | 62 416 | shell : appStore, authStore, api, i18n (dict 88 Ko src), zustand, AppLayout. **PROD : 485 733 / 153 529 avec Sentry** ⚠️ |
| `vendor-*.js` | 166 196 | 54 158 | react + react-dom + react-router |
| `Stock-*.js` | 140 103 | 34 345 | page Stock + StockModals (**jsbarcode** statique) |
| `HR-*.js` | 135 728 | 32 295 | page HR |
| `POS-*.js` | 92 552 | 24 164 | page POS |
| `Settings-*.js` | 80 786 | 22 102 | page Settings |
| `ui-*.js` | 73 404 | 16 531 | lucide-react + react-hot-toast (chargé initialement) |

### Chunks > 100 Ko (raw)
`barcode` (444 Ko, lazy), `charts` (411 Ko, lazy), `Customers` (318 Ko, route lazy mais gonflé), `index` (208 Ko local / **486 Ko PROD**, critique), `vendor` (166 Ko, critique), `Stock` (140 Ko, route), `HR` (136 Ko, route).

---

## 2. Lazy loading des routes — ✅ conforme

`src/App.tsx:10-40` : **les 31 pages sont toutes en `React.lazy`** (LandingPage, LoginPage, Dashboard, POS, … PublicCatalog). Seuls imports statiques du shell : `AppLayout`, `ConfirmHost`, stores, api — légitimes. **Aucune route secondaire ne gonfle le chunk initial.** Rien à faire ici.

`vite.config.ts:93-109` : `manualChunks` isole correctement `vendor` (react), `barcode` (@zxing), `charts` (recharts/d3), `ui` (lucide/toast).

---

## 3. Imports lourds — état chunk par chunk

| Lib | Import | Chunk d'atterrissage | Verdict |
|---|---|---|---|
| recharts | statique dans `DashCategoryDonut/DashSalesArea/ReportsTabs`, mais ces composants sont `lazy()` (`Dashboard.tsx:15-16`, `Reports.tsx:15`) | `charts` séparé | ✅ OK |
| @zxing | statique dans `BarcodeScanner.tsx:2`, mais `BarcodeScanner` est `lazy()` partout (`POS.tsx:8`, `POSCustomerSelector.tsx:7`, `StockModals.tsx:12`) | `barcode` séparé | ✅ OK |
| **html2canvas + qrcode** | **statiques** dans `src/components/ui/LoyaltyCardDigital.tsx:3-4`, et `LoyaltyCardDigital` importé **statiquement** dans `src/components/customers/CustomersModals.tsx:9` | fondus dans `Customers-*.js` (318 Ko raw / 81 Ko gz) | ⚠️ tout visiteur de la page Clients paie ~50 Ko gz pour une feature ponctuelle (téléchargement carte) |
| **jsbarcode** | **statique** dans `src/components/stock/StockModals.tsx:3`, et `StockModals` importé statiquement dans `src/pages/Stock.tsx:15` | fondu dans `Stock-*.js` (140 Ko) | 🟡 mineur (~15-20 Ko gz), modales = cœur de la page Stock |
| jspdf | aucun import trouvé dans `src` (bulletins paie passent par `utils/export.ts`, HTML/print) | — | ✅ absent du bundle |
| **@sentry/react** | **statique** dans `src/main.tsx:9`, avec `browserTracingIntegration` + **`replayIntegration`** (`main.tsx:21-23`) | **chunk principal PROD** | 🔴 +91 Ko gz sur le critical path (Replay/rrweb = la majorité) |

---

## 4. Images lourdes — ✅ rien à signaler

`find public src/assets -size +100k` : **aucun fichier**. Plus gros : `public/og-image.webp` 28 Ko, `pwa-512x512.png` 16 Ko. Pas de dossier `src/assets`.

---

## 5. Re-renders — patterns coûteux observés (factuel)

**Aucun `React.memo` dans `components/pos|stock|customers`** (grep vide). Keys stables partout (`key={p.id}`, `key={p.sku}`, `key={c.id}`) — pas de bug de key.

### POS — le hotspot (grille NON paginée)
- `src/pages/POS.tsx:219-222` : `filtered = posProducts.filter(...)` recalculé à **chaque render** sans `useMemo` (chaque frappe, chaque tick d'état POS).
- `src/pages/POS.tsx:225` : `productById = new Map(posProducts.map(...))` reconstruite à chaque render.
- `src/components/pos/POSProductGrid.tsx:196-197` : `filtered.map(...)` rend **toutes** les tuiles (pas de pagination/virtualisation), et chaque tuile fait `cart.find(i => i.id === p.id)` → **O(produits × panier)** à chaque render ; tout ajout au panier re-rend toute la grille.
- `POSProductGrid.tsx:200-236` : objets de style inline + closures `onClick`/`onMouseEnter`/`onMouseLeave` recréés par tuile à chaque render ; composant tuile non extrait/non mémoïsé.
- `POSProductGrid` reçoit ~30 props dont des closures recréées à chaque render de POS.tsx (`addItem`, `getPrice`, setters) → un `memo` du conteneur serait inopérant sans stabilisation préalable (`useCallback`).

### Stock / Customers — bornés par la pagination (20/page) → impact limité
- `src/hooks/usePagination.ts:3` : `pageSize = 20` ; `StockInventory.tsx:175,278` et `CustomersList.tsx:103,168` mappent `pg.paginated` (≤20 lignes) → coût par render plafonné. Pas urgent.
- Patterns identiques par ligne tout de même : `CustomersList.tsx:170-190` recalcule `initials`/`tc` et recrée `openDetail` + handlers `onMouseEnter/Leave` (avec `querySelector` DOM) par carte et par render ; `StockInventory.tsx:176-178` recalcule `statusOf`/`pct` par carte. Acceptable à 20 éléments.
- `StockInventory.tsx:97,110,116,122` : maps sur la liste **complète** `products` à chaque render (export CSV/labels + stats) — recalculés même quand rien ne change ; candidats `useMemo` si la page rame avec de gros catalogues.

---

## Findings priorisés

| # | Finding | Gain estimé | Risque | Sans changement de comportement ? |
|---|---|---|---|---|
| **P1** | **Sentry Replay dans le chunk critique PROD** (`main.tsx:9,21-23`). Charger `replayIntegration` (et idéalement `browserTracingIntegration`) en différé : `Sentry.lazyLoadIntegration('replayIntegration')` puis `client.addIntegration(...)` après init, ou `import('@sentry/react')` post-mount. Le chunk principal prod passerait de ~153 Ko gz vers ~70-90 Ko gz. | **-60 à -90 Ko gz** sur le payload initial (-30 % du critical path) | Faible (pattern officiel Sentry) | ✅ Oui (le replay démarre quelques centaines de ms plus tard, erreurs early-boot toujours capturées par init de base) |
| **P2** | **POS : grille produits non mémoïsée et non bornée** (`POS.tsx:219-225`, `POSProductGrid.tsx:196-236`). a) `useMemo` sur `filtered` + `productById` ; b) `cartQtyById = useMemo(Map)` au lieu de `cart.find` par tuile ; c) extraire une `<ProductTile>` `React.memo` avec props primitives + `useCallback(addItem)`. | Fluidité frappe/ajout panier sur catalogues >100 produits (de O(n×m) par tick à O(changements)) | Faible-moyen (refacto locale ; suivre le pattern CLAUDE.md « anchor test d'abord ») | ✅ Oui (rendu identique) |
| **P3** | **html2canvas + qrcode statiques dans le chunk Customers** (`LoyaltyCardDigital.tsx:3-4`, `CustomersModals.tsx:9`). Passer `LoyaltyCardDigital` en `lazy()` dans CustomersModals, ou `await import('html2canvas')` dans le handler de téléchargement. | **-40 à -50 Ko gz** sur le chunk Customers (81→~35 Ko gz) | Faible | ✅ Oui (Suspense fallback à l'ouverture de la carte) |
| **P4** | **Précache PWA = 2,8 Mo dès la 1re visite** (68 entrées, inclut `barcode` 444 Ko + `charts` 411 Ko + toutes les pages). Coût data réel sur mobile (cible Afrique de l'Ouest, data facturée). Option : `workbox.globIgnores` sur `barcode-*` / `charts-*` + runtime caching `CacheFirst` pour ces chunks. | -860 Ko raw de data au premier install ; trade-off : offline partiel pour scanner/graphes au 1er usage hors-ligne | Moyen (dégrade l'offline-first de 2 features si jamais visitées en ligne) | ⚠️ Non strictement (comportement offline modifié) — à arbitrer |
| **P5** | Dictionnaire i18n monolithique (88 Ko src, 4 langues) embarqué dans le chunk initial (`i18n/index.ts` importé par le shell). Split par langue en import dynamique. | ~-10 à -15 Ko gz initial | Moyen (touche `t()` global, 3 mécanismes i18n coexistants) | ✅ Oui, mais ROI faible vs P1-P3 |
| P6 | `jsbarcode` statique dans `Stock-*.js` via `StockModals.tsx:3` | ~-15 Ko gz sur le chunk Stock | Faible | ✅ Oui — mais modales = usage central de la page, gain marginal |
| P7 | `StockInventory.tsx:97-122` : agrégats sur `products` complets recalculés chaque render | Perceptible seulement sur très gros catalogues | Faible | ✅ Oui (`useMemo`) |
| — | recharts 110 Ko gz (chunk `charts` lazy) : déjà identifié en dette CLAUDE.md (remplacement visx = L, non prioritaire) | — | — | — |

### Non-findings (conformes, ne pas retravailler)
- 31/31 routes en `React.lazy` ; `manualChunks` vendor/barcode/charts/ui bien découpés.
- Aucune image >100 Ko ; og-image déjà webp.
- Aucune sourcemap publiée (mode `hidden` + upload Sentry OK).
- Stock/Customers paginés à 20 → re-renders bornés.
- jspdf absent du bundle.
