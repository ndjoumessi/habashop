@AGENTS.md

# CLAUDE.md — HabaShop Mobile

Guide pour Claude Code sur l'app mobile HabaShop. Lis-le en premier.
CDC produit complet : `../habashop/MOBILE_APP_CDC.md`. Guide du repo web (backend partagé) : `../habashop/CLAUDE.md`.

## C'est quoi

App mobile (iOS + Android) de l'écosystème HabaShop — surtout **caisse POS mobile** + stock + dashboard + clients. **Consomme l'API backend HabaShop existante** (Fastify 5 / Railway) — aucune réécriture serveur. Multi-tenant via le même JWT que le web.

- **Backend partagé** : `https://habashop-production.up.railway.app` (= `../habashop/apps/backend`).
- **Env** : `EXPO_PUBLIC_API_URL` dans `.env`.

## ⚠️ Stack réelle ≠ CDC

Scaffoldé avec `create-expo-app@latest` → versions **plus récentes** que le CDC :

| | CDC (prévu) | **Installé (réel)** |
|---|---|---|
| Expo SDK | 51 | **~56** |
| React Native | 0.74 | **0.85.3** |
| React | 18 | **19.2.3** |

➡️ **Expo a beaucoup changé depuis le SDK 51.** Lis les docs versionnées **https://docs.expo.dev/versions/v56.0.0/** avant de coder (cf. `AGENTS.md`). `expo-barcode-scanner` est **supprimé depuis le SDK 52** → utiliser **`expo-camera`** (`CameraView` + `onBarcodeScanned`) pour le scan EAN13.

## Stack effective

| Composant | Techno |
|-----------|--------|
| Framework | React Native + **Expo SDK 56** |
| Navigation | **Expo Router** (file-based, dossier `app/`, typed routes) |
| State | **Zustand** (`src/stores/`) — authStore / appStore / posStore |
| Data/cache | **React Query** (@tanstack/react-query) |
| HTTP | **axios** (`src/services/api.ts`) |
| Auth token | **expo-secure-store** (JWT) ; biométrie `expo-local-authentication` (phase 2) |
| Scan | **expo-camera** (barcode EAN13) — ❌ pas `@zxing`, pas `expo-barcode-scanner` |
| Push | **Expo Notifications** (+ expo-device) |
| Fonts | Outfit + JetBrains Mono via `@expo-google-fonts/*` |
| UI | `StyleSheet` + tokens `src/constants/theme.ts` (NativeWind possible plus tard) |

## ⚠️ Règles

1. **Node 20 obligatoire** : `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` (le Node v10 système casse les builds).
2. **Lire les docs Expo v56** avant tout code.
3. **Ne PAS réécrire le backend.** API Railway consommée telle quelle. Le mobile impose **2 ajouts backend** (dans `../habashop/apps/backend`, DB = **PROD Railway** → confirmer avec Nelson avant migration) : table Prisma `PushToken` + route `POST /api/notifications/token` (rappels J-3 via le cron existant `runTrialReminders`).
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
  stores/                  # authStore, appStore (i()), posStore
  services/api.ts          # axios + interceptor JWT + authApi/productsApi/salesApi/...
  components/ ui|pos|stock|dashboard
  hooks/  types/
```
Alias TS : `@/*` → `src/*` (cf. tsconfig).

## i18n (fr / en / es / it)

Helper dans `appStore` : `const { i } = useAppStore()` → `i('fr','en','es','it')`. **4 langues, jamais de binaire fr/en.** `lang` persisté dans le store (défaut `fr`). Référence des chaînes : `../habashop/apps/frontend/src/i18n/index.ts`. NE PAS traduire : marques (HabaShop, Wave, Orange Money, MTN), codes devises (XOF/EUR/FCFA), enums API, noms de pays.

## Design tokens (= web, `../habashop/apps/frontend/src/index.css`)

`src/constants/theme.ts` : primary `#6C47FF`, accent `#FF9500`, accent2 `#00D084`, accent3 `#00B8FF`, danger `#FF3B5C`, warn `#FFB800`, bg `#07070F`, card `#0F0F1E`, text `#F0F0FF`. Titres Outfit 700–900, chiffres JetBrains Mono.

## Endpoints (API existante)
`POST /api/auth/login` · `GET /api/auth/me` · `GET /api/products` · `PATCH /api/products/:id` · `POST /api/sales` · `GET /api/analytics/dashboard` · `GET /api/customers` · `/api/whatsapp/send-ticket` · `/api/payments/wave|orange` · (à créer) `POST /api/notifications/token`.

## Offline-first (CDC §7) — à implémenter
Online → API ; Offline → cache + file d'actions `{id,type:'SALE'|'STOCK_MOVE',payload,createdAt,synced}` ; retour réseau → sync (`POST /api/sales`). Cache TTL : produits 24 h, clients 1 h, stock 5 min.

## Rituel avant commit
`npx tsc --noEmit` (0 erreur) → commit/push sur `main`. Builds : `eas build` ; hotfix : `eas update` (OTA).

## Périmètre
- **Phase 1 (MVP)** : Auth, POS (scan/panier/encaissement/offline/ticket WhatsApp), Stock + alertes push, Dashboard, Clients.
- **Phase 2** : RH/planning, Fournisseurs, Dépenses, Rapports, push perso, biométrie.

## Specs prescriptives
Nelson fournit des specs détaillées. Si une instruction ne matche pas le réel (version SDK, paquet supprimé comme `expo-barcode-scanner`), **réconcilie et continue** ; réserve les questions aux choix à fort enjeu.
