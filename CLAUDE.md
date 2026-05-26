@AGENTS.md

# CLAUDE.md — HabaShop Mobile

Guide pour Claude Code sur l'app mobile HabaShop. Lis-le en premier.
CDC produit complet : `../habashop/MOBILE_APP_CDC.md`. Guide du repo web (backend partagé) : `../habashop/CLAUDE.md`.

## C'est quoi

App mobile (iOS + Android) de l'écosystème HabaShop — surtout **caisse POS mobile** + stock + dashboard + clients. **Consomme l'API backend HabaShop existante** (Fastify 5 / Railway) — aucune réécriture serveur. Multi-tenant via le même JWT que le web.

- **Backend partagé** : `https://habashop-production.up.railway.app` (= `../habashop/apps/backend`).
- **Env** : `EXPO_PUBLIC_API_URL` dans `.env`.

## ⚠️ Stack réelle ≠ CDC

Scaffoldé avec `create-expo-app@latest` (qui avait sorti le SDK 56), puis **downgradé au SDK 54** pour la **compatibilité Expo Go Android** :

| | CDC (prévu) | **Installé (réel)** |
|---|---|---|
| Expo SDK | 51 | **~54.0.0** |
| React Native | 0.74 | **0.81.5** |
| React | 18 | **19.1.0** |

➡️ **Lis les docs versionnées https://docs.expo.dev/versions/v54.0.0/ avant de coder** (cf. `AGENTS.md`). `expo-barcode-scanner` est **supprimé depuis le SDK 52** → utiliser **`expo-camera`** (`CameraView` + `onBarcodeScanned`) pour le scan EAN13.

## Stack effective

| Composant | Techno |
|-----------|--------|
| Framework | React Native 0.81.5 + **Expo SDK 54** |
| Navigation | **Expo Router** v6 (file-based, dossier `app/`, typed routes) |
| State | **Zustand** v5 (`src/stores/`) — authStore / appStore / posStore ; persist via AsyncStorage |
| Data/cache | **React Query** (@tanstack/react-query v5) |
| HTTP | **axios** (`src/services/api.ts`) |
| Auth token | **expo-secure-store** (JWT) ; biométrie `expo-local-authentication` (phase 2, pas encore installé) |
| Scan | **expo-camera** (barcode EAN13) — ❌ pas `@zxing`, pas `expo-barcode-scanner` |
| Push | **Expo Notifications** (+ expo-device) — push **distant** uniquement en **dev build** (retiré d'Expo Go depuis SDK 53) |
| Dev build | **expo-dev-client** (requis pour `developmentClient:true` dans `eas.json`) |
| Fonts | Outfit + JetBrains Mono via `@expo-google-fonts/*` |
| UI | `StyleSheet` + tokens `src/constants/theme.ts` (NativeWind possible plus tard) |

## ⚠️ Règles

1. **Node 20 obligatoire** : `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` (le Node v10 système casse les builds).
2. **Lire les docs Expo v54** avant tout code.
3. **Ne PAS réécrire le backend.** API Railway consommée telle quelle. Les **2 ajouts backend** imposés par le mobile sont **faits et déployés** (dans `../habashop/apps/backend`) : table Prisma `PushToken` + route `POST /api/notifications/token` (upsert par token, idempotent). Toute migration future sur la DB = **PROD Railway** → confirmer avec Nelson avant.
4. **Git : commit direct sur `main`.** Ce repo a son propre `.git` (vérifier `git rev-parse --show-toplevel` → `habashop-mobile`, pas le parent `Projets`).
5. **Installer les paquets Expo via `npx expo install`** (versions alignées au SDK), pas `npm install` direct.

## Structure

```
app/                       # Expo Router
  _layout.tsx              # root : fonts, QueryClient, restoreSession, Stack
  (auth)/_layout.tsx + login.tsx
  (app)/_layout.tsx
    (tabs)/_layout.tsx     # tab bar (dashboard, stock, pos-tab, customers, settings)
    (tabs)/dashboard|stock|customers|settings|pos-tab.tsx
    pos/index.tsx          # caisse (fullScreenModal)
src/
  constants/theme.ts       # Colors / Spacing / BorderRadius / FontSize / Shadow
  stores/                  # authStore, appStore (useI18n/useFmt + persist), posStore
  services/
    api.ts                 # axios + interceptor JWT + authApi/productsApi/salesApi/...
    exchangeRate.ts        # taux FX live (open.er-api.com), cache AsyncStorage 6h, fallback
    notifications.ts       # registerForPushNotifications() + sendLocalNotification()
  components/ ui|pos|stock|dashboard
  hooks/  types/
```
Alias TS : `@/*` → `src/*` (cf. tsconfig).

## i18n (fr / en / es / it)

Hook `useI18n()` (dans `appStore`) : `const { i, lang } = useI18n()` → `i('fr','en','es','it')`. **4 langues, jamais de binaire fr/en.** `useI18n` sélectionne la primitive `lang` (re-render garanti au changement) ; `lang` est persisté (défaut `fr`). Référence des chaînes : `../habashop/apps/frontend/src/i18n/index.ts`. NE PAS traduire : marques (HabaShop, Wave, Orange Money, MTN), codes devises (XOF/EUR/FCFA), enums API, noms de pays.

## Devise & montants

Hook `useFmt()` (dans `appStore`) : `const { fmt, currency, rates } = useFmt()`. **Toujours `fmt(montantXOF)` — jamais de formatage manuel.**

- Les montants backend sont **en XOF**. `fmt` **convertit à l'affichage uniquement** (jamais en DB) vers la devise du tenant.
- Taux FX live via `src/services/exchangeRate.ts` (`open.er-api.com/v6/latest/XOF`), cache AsyncStorage **6h**, **fallback** taux fixes si l'API échoue. XOF↔XAF = parité fixe.
- Symbole : **XOF/XAF → `FCFA`** (sans décimales) ; EUR `€`, USD `$`, GBP `£`, CAD `CA$` (2 décimales).
- Formatage **robuste Android** : `INTL_OK` détecte une fois si Hermes honore les options de `toLocaleString` ; sinon repli manuel `manualFormat` (toFixed + séparateurs de milliers), sortie identique iOS/Android.

## Design tokens (= web, `../habashop/apps/frontend/src/index.css`)

`src/constants/theme.ts` : primary `#6C47FF`, accent `#FF9500`, accent2 `#00D084`, accent3 `#00B8FF`, danger `#FF3B5C`, warn `#FFB800`, bg `#07070F`, card `#0F0F1E`, text `#F0F0FF`. Titres Outfit 700–900, chiffres JetBrains Mono.

## Endpoints (API existante — formes **vérifiées sur l'API réelle**)
`POST /api/auth/login` · `GET /api/auth/me` · `GET /api/products` (tableau plat `{id,name,sellPrice,emoji,stockQty,stockMin,category,isActive,barcode,…}`) · **`PUT`** `/api/products/:id` (⚠️ pas PATCH) · `POST /api/sales` (body `{items:[{productId, qty, price}], total, paymentMode, discount?}` — ⚠️ `qty`, pas `quantity`) · **`GET /api/dashboard/stats`** (⚠️ pas `/api/analytics/dashboard` ; data **plate** `{salesToday, transactionsToday, salesMonth, totalProducts, lowStockProducts, topProducts:[{name,ca}], stockAlerts:[{name,stockQty,stockMin}], …}`) · `GET /api/customers` · `/api/whatsapp/send-ticket` · `/api/payments/wave|orange` · `POST /api/notifications/token` (✅ déployé).

⚠️ **Toujours vérifier la forme réelle de l'API avant de coder** (la doc/CDC peut diverger).

## Offline-first (CDC §7) — à implémenter
Online → API ; Offline → cache + file d'actions `{id,type:'SALE'|'STOCK_MOVE',payload,createdAt,synced}` ; retour réseau → sync (`POST /api/sales`). Cache TTL : produits 24 h, clients 1 h, stock 5 min.

## Rituel avant commit
`npx tsc --noEmit` (0 erreur) → commit/push sur `main`. Builds : `eas build` ; hotfix : `eas update` (OTA).

## EAS / dev build / push
- **`projectId` EAS** (`e7399d7a-e5ba-4e30-a333-8cff7ad10eb4`) dans `app.json` → `expo.extra.eas.projectId` ; lu par `registerForPushNotifications()`.
- **Push distant = dev build obligatoire** (Expo Go ne le supporte plus depuis SDK 53). Profil `development` (`eas.json`) : APK Android + dev client + distribution interne.
  ```bash
  eas build --profile development --platform android   # dans ton terminal authentifié
  npx expo start --dev-client                          # puis connecter le dev build
  ```
- ⚠️ **Auth EAS hors sandbox** : `eas login` / la session de ton terminal **ne se propagent pas** aux shells de Claude (shells neufs, pas d'héritage d'`export`/`EXPO_TOKEN`). Donc **Nelson lance `eas login` / `eas init` / `eas build`** ; Claude fait ensuite les éditions de fichiers (ex. écrire le `projectId` dans `app.json`) + commit.

## Périmètre
- **Phase 1 (MVP)** : Auth, POS (scan/panier/encaissement/offline/ticket WhatsApp), Stock + alertes push, Dashboard, Clients.
- **Phase 2** : RH/planning, Fournisseurs, Dépenses, Rapports, push perso, biométrie.

## Specs prescriptives
Nelson fournit des specs détaillées. Si une instruction ne matche pas le réel (version SDK, paquet supprimé comme `expo-barcode-scanner`), **réconcilie et continue** ; réserve les questions aux choix à fort enjeu.
