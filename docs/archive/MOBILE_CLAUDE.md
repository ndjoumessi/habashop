# CLAUDE.md — HabaShop Mobile

> **⚠️ Ce fichier est un brouillon stocké dans le repo `habashop` (web).**
> Dès que le repo mobile est scaffoldé (`npx create-expo-app habashop-mobile`),
> **copie ce fichier en `habashop-mobile/CLAUDE.md`** pour que Claude Code le charge
> automatiquement. Cahier des charges complet : `MOBILE_APP_CDC.md` (dans le repo web).

Guide pour Claude Code sur l'app mobile HabaShop. Lis-le en premier.

## C'est quoi

App mobile (iOS + Android) de l'écosystème HabaShop — surtout **caisse POS mobile** + stock + dashboard + clients. **Consomme l'API backend HabaShop existante** (Fastify 5 / Railway) — aucune réécriture serveur. Multi-tenant via le même JWT que le web.

- **Repo** : `habashop-mobile` (séparé du monorepo web `habashop`).
- **Backend partagé** : `https://habashop-production.up.railway.app` (= `apps/backend` du repo `habashop`).

## Stack

| Composant | Techno |
|-----------|--------|
| Framework | React Native 0.74 + **Expo SDK 51** |
| Navigation | **Expo Router v3** (file-based, dossier `app/`) |
| State | **Zustand** (logique portée depuis `appStore` web) |
| UI | **NativeWind** (Tailwind pour RN) — PAS de styles inline web |
| Data/cache | **React Query** (@tanstack/react-query) |
| Offline | **MMKV** (cache + file d'actions) |
| Auth | JWT (même API), biométrie via `expo-local-authentication` |
| Scan | **expo-camera** (barcode EAN13) — ❌ pas `@zxing`, pas `expo-barcode-scanner` (déprécié) |
| Push | **Expo Notifications** |
| Charts | **Victory Native** |
| Paiement | WebView vers `/api/payments/wave\|orange` existants |

## ⚠️ Pièges & règles

1. **Node 20 obligatoire** pour les commandes (le Node v10 du système casse les builds) :
   ```bash
   export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
   ```
2. **Ne PAS réécrire le backend.** L'API Railway est consommée telle quelle. Le mobile n'impose que **2 ajouts backend** (à faire dans `habashop/apps/backend`, DB = **PROD Railway**, donc confirmer avec Nelson avant toute migration) :
   - table Prisma `PushToken` (`tenantId`, `userId`, `token`, `platform`)
   - route `POST /api/notifications/token`
   - les rappels J-3 réutilisent le cron existant (`server.ts` → `runTrialReminders`).
3. **Git : commit direct sur `main`** (même workflow que le web).
4. **Ne PAS coder de styles web** (CSS/inline) — tout en NativeWind / `StyleSheet`. `@zxing` et les composants web ne sont PAS portables.

## Commandes

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npx expo start              # dev (Expo Go / dev client)
npx expo start --ios        # simulateur iOS
npx expo start --android    # émulateur Android
npx tsc --noEmit            # typecheck — 0 erreur avant commit
npx eas build --platform all        # build stores (EAS)
npx eas update              # OTA (corrections sans re-soumission)
```
Env : `EXPO_PUBLIC_API_URL=https://habashop-production.up.railway.app` dans `.env`.

## Structure (cible — voir CDC §5)

```
app/                      # Expo Router (screens)
  (auth)/login.tsx
  (app)/_layout.tsx       # Tab navigation
    pos/ (index|cart|payment), stock/ (index|[id]), dashboard.tsx, clients/
components/   ui/ pos/ stock/
hooks/        useApi.ts useOffline.ts useBarcode.ts
stores/       appStore.ts        # Zustand porté du web
services/     api.ts offline.ts notifications.ts
constants/    theme.ts config.ts
```

## i18n (fr / en / es / it)

Même exigence que le web : **4 langues, jamais de binaire fr/en**. Porter `useI18n` (helper `i(fr, en, es, it)`) au runtime RN ; `lang` vient du store Zustand persisté (MMKV ici au lieu de localStorage). Réutiliser le dictionnaire/clés du web (`habashop/apps/frontend/src/i18n/index.ts`) comme référence. NE PAS traduire : marques (HabaShop, Wave, Orange Money, MTN), codes devises (XOF/EUR/FCFA), enums API, noms de pays.

## Design tokens (identiques au web — `habashop/apps/frontend/src/index.css`)

```ts
// constants/theme.ts
export const colors = {
  primary: '#6C47FF', primary2: '#8B6FFF',
  accent: '#FF9500', accent2: '#00D084', accent3: '#00B8FF',
  danger: '#FF3B5C', warn: '#FFB800',
  bg: '#07070F', card: '#0D0D1C', border: 'rgba(255,255,255,.07)',
  text: '#F0F0FF', text2: '#C4C4D4', text3: '#8888A8',
}
```
Typo : titres Outfit/Plus Jakarta Sans 700–900, corps 400–600, chiffres JetBrains Mono (`expo-font`).

## Offline-first (CDC §7)

- Online → API + affichage temps réel ; Offline → cache MMKV + **file d'actions** ; retour en ligne → sync auto.
- Cache TTL : produits 24 h, clients 1 h, stock 5 min.
- File : `OfflineAction { id, type: 'SALE'|'STOCK_MOVE', payload, createdAt, synced }`.
- Ventes offline → rejouées via `POST /api/sales` au retour réseau.

## Endpoints clés (API existante)

`POST /api/auth/login` · `GET /api/products` · `PUT /api/products/:id` · `POST /api/sales` · `GET /api/dashboard/stats` (cache Redis 5 min) · `GET /api/customers` · `/api/whatsapp/send-ticket` · `/api/payments/wave|orange` · (nouveau) `POST /api/notifications/token`.

## Rituel avant commit
`tsc --noEmit` (0 erreur) → tests → commit/push sur `main`. Releases via EAS Build ; hotfixes via EAS Update (OTA).

## Périmètre
- **Phase 1 (MVP)** : Auth, POS (scan/panier/encaissement/offline/ticket WhatsApp), Stock + alertes push, Dashboard, Clients.
- **Phase 2** : RH/planning, Fournisseurs, Dépenses, Rapports avancés, push perso.

## Conventions de code (alignées web — cf. `habashop/CLAUDE.md`)
- Montants formatés selon la devise du tenant (porter `useFormatAmount`).
- Icônes : équivalent RN de Lucide (`lucide-react-native`).
- Specs prescriptives de Nelson : réconcilier les écarts et continuer ; réserver les questions aux choix à fort enjeu.
