@AGENTS.md

# CLAUDE.md — HabaShop Mobile

> Guide pour Claude Code. Lis ce fichier **en premier** avant de travailler sur ce repo.
> CDC produit complet : `../habashop/MOBILE_APP_CDC.md`. Repo web (backend partagé) : `../habashop/CLAUDE.md`.

---

## C'est quoi

App mobile React Native (iOS + Android) de l'écosystème HabaShop SaaS (gestion commerciale,
Afrique francophone) — surtout **caisse POS mobile** + stock + dashboard + clients.
**Consomme l'API backend existante** (même backend Railway que le web, même JWT multi-tenant).

- **Repo GitHub :** https://github.com/ndjoumessi/habashop-mobile
- **Backend API :** https://habashop-production.up.railway.app (= `../habashop/apps/backend`)
- **Env :** `EXPO_PUBLIC_API_URL` dans `.env`

---

## Stack technique

| Outil | Version | Notes |
|-------|---------|-------|
| Expo SDK | **~54.0.0** | ⚠️ PAS 56 — compat Expo Go Android |
| React Native | 0.81.5 | |
| React | 19.1.0 | |
| Expo Router | ~6.0.23 | File-based routing (dossier `app/`, typed routes) |
| Zustand | ^5.0.13 | State (`src/stores/`) + persist AsyncStorage |
| TanStack Query | ^5.100.14 | Data fetching / cache |
| axios | ^1.16.1 | HTTP (`src/services/api.ts`) |
| AsyncStorage | 2.2.0 | Persist lang/currency + cache FX |
| expo-secure-store | ~15.0.8 | JWT |
| expo-camera | ~17.0.10 | Scan barcode EAN13 |
| expo-updates | ~29.0.17 | OTA updates |
| expo-dev-client | ~6.0.21 | Dev builds |

> Lire les **docs versionnées** https://docs.expo.dev/versions/v54.0.0/ avant de coder (cf. `AGENTS.md`).

---

## ⚠️ Pièges critiques — lire avant tout

### 1. Node 20 OBLIGATOIRE
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```
Le Node système (v10) casse les builds. À mettre dans **chaque** commande.

### 2. SDK 54 — NE PAS upgrader vers SDK 56
Scaffoldé avec `create-expo-app` (SDK 56) puis **downgradé en SDK 54** pour Expo Go Android.
Si jamais ré-upgradé par erreur :
```bash
npm install expo@~54.0.0 && npx expo install --fix
```

### 3. Chemins avec parenthèses (groupes Expo Router) dans zsh
`app/(app)/(tabs)/…` casse zsh (glob). Toujours **quoter** :
```bash
cat "app/(app)/(tabs)/dashboard.tsx"      # ✅
cat app/(app)/(tabs)/dashboard.tsx        # ❌ "no matches found"
```
(idem : un glob non-matché comme `*.config.ts` fait sortir tout le compound command en erreur.)

### 4. EAS CLI — auth NE se propage PAS aux shells de Claude
`eas-cli` est installé global sur Node 20. Mais la session EAS (`~/.expo/state.json`) doit être
ouverte par **Nelson dans SON terminal** (`eas login`) ; les `export`/`EXPO_TOKEN` ne s'héritent pas.
Une fois loggé, le disque est partagé → `eas whoami` doit afficher `ndjoumessi`.

### 5. Écran noir en build (RÉSOLU — `f95133f`)
**Cause :** route racine `/` manquante. Expo Router montre une sitemap auto en dev (qui masque
le trou), retirée en build → `/` ne rend rien → noir.
**Fix :** `app/index.tsx` avec `<Redirect>` selon l'auth. **NE PAS supprimer `app/index.tsx`.**

### 6. `expo-barcode-scanner` supprimé depuis SDK 52
Utiliser **`expo-camera`** (`CameraView` + `onBarcodeScanned`) pour le scan EAN13.

### 7. Push distant = dev build only
Expo Go ne supporte plus le push distant depuis SDK 53 → nécessite un **dev build** (ou production).

---

## ⚠️ Règle backend
**Ne PAS réécrire le backend.** API Railway consommée telle quelle. Les 2 ajouts imposés par le
mobile sont **faits et déployés** (table Prisma `PushToken` + `POST /api/notifications/token`).
Toute migration DB future = **PROD Railway** → **confirmer avec Nelson avant**.

---

## Compte Expo / EAS

- **Compte EAS :** `ndjoumessi` (romel.djoumessi@gmail.com)
- **Project ID :** `e7399d7a-e5ba-4e30-a333-8cff7ad10eb4` (dans `app.json` → `expo.extra.eas.projectId`)
- **Keystore Android :** `sH_oz3rpgx` (généré auto, stocké sur EAS)
- **app.json :** `name: HabaShop`, `slug: habashop-mobile`, `version: 1.0.0` (pas de champ `sdkVersion` ni `owner`)

---

## Structure du projet

```
app/                       # Expo Router (file-based)
  _layout.tsx              # root : fonts, QueryClient, restoreSession, Stack
  index.tsx                # route '/' → Redirect dashboard/login (⚠️ fix écran noir, ne pas supprimer)
  (auth)/_layout.tsx + login.tsx
  (app)/_layout.tsx
    (tabs)/_layout.tsx     # tab bar
    (tabs)/dashboard|stock|customers|settings|pos-tab.tsx
    pos/index.tsx          # caisse (fullScreenModal)
src/
  constants/theme.ts       # Colors / Spacing / BorderRadius / FontSize / Shadow
  stores/                  # authStore, appStore (useI18n/useFmt + persist), posStore
  services/
    api.ts                 # axios + interceptor JWT + authApi/productsApi/salesApi/...
    exchangeRate.ts        # taux FX live (open.er-api.com), cache 6h, fallback
    notifications.ts       # registerForPushNotifications() + sendLocalNotification()
  components/ ui|pos|stock|dashboard   ·   hooks/   ·   types/
```
Alias TS : `@/*` → `src/*`.

---

## Système i18n (fr / en / es / it)

```typescript
import { useI18n, useFmt } from '@/stores/appStore'
const { i, lang } = useI18n()
const { fmt, currency } = useFmt()

i('Bonjour', 'Hello', 'Hola', 'Ciao')   // 4 langues, JAMAIS de binaire fr/en
fmt(1000)                                 // montants backend en XOF, conversion à l'affichage
// XOF → "1 000 FCFA"  ·  EUR → "1,52 €"  ·  USD → "$1.64"  ·  GBP → "£1.30"  ·  CAD → "CA$2.24"
//   (taux live open.er-api.com, cache 6h, fallback fixe ; valeurs ci-dessus = approximatives)
```
**Règles :** jamais de texte hardcodé dans le JSX (toujours `i()`) ; tous les montants via `fmt()` ;
les montants en DB sont en **XOF**, conversion **à l'affichage uniquement**. Symbole XOF/XAF = `FCFA`
(sans décimales). **Ne pas traduire** : marques (HabaShop, Wave, Orange Money, MTN), codes devises, enums API, pays.

---

## Endpoints API réels (vérifiés sur l'API + dans `src/services/api.ts`)

| Endpoint | Méthode | Forme |
|----------|---------|-------|
| `/api/auth/login` | POST | `{ token, user, tenant }` |
| `/api/auth/me` | GET | `{ user, tenant }` |
| `/api/products` | GET | tableau **plat** `[{ id, name, sellPrice, emoji, stockQty, stockMin, category, isActive, barcode }]` |
| `/api/products/:id` | **PUT** | ⚠️ **PUT, pas PATCH** — renvoie le produit mis à jour |
| `/api/sales` | POST | body `{ items:[{ productId, qty, price }], total, paymentMode, discount? }` — ⚠️ `qty`, pas `quantity` |
| `/api/customers` | GET | `[{ id, name, phone, email, type, loyaltyPoints, totalRevenue }]` |
| `/api/dashboard/stats` | GET | data **plate** `{ salesToday, transactionsToday, salesMonth, totalProducts, lowStockProducts, topProducts:[{name,ca}], stockAlerts:[{name,stockQty,stockMin}] }` |
| `/api/notifications/token` | POST | upsert idempotent (déployé ✅) |

⚠️ Dashboard = **`/api/dashboard/stats`** (PAS `/api/analytics/dashboard` → 404), réponse **à plat** (pas `data.stats`).
⚠️ Toujours vérifier la forme réelle de l'API avant de coder (la doc/CDC peut diverger).

---

## Design System (tokens `src/constants/theme.ts`, = web)

```typescript
Colors.primary  = '#6C47FF'   // violet      Colors.bg    = '#07070F'  // fond
Colors.accent   = '#FF9500'   // orange       Colors.card  = '#0F0F1E'  // cartes
Colors.accent2  = '#00D084'   // vert         Colors.text  = '#F0F0FF'
Colors.accent3  = '#00B8FF'   // bleu         Colors.text2 = '#A0A0C0'
Colors.danger   = '#FF3B5C'                   Colors.text3 = '#606080'  // labels
Colors.warn     = '#FFB800'
```
**Règles :** `StyleSheet.create()` (jamais de styles inline) ; toujours les tokens (jamais d'hex hardcodé) ;
fonts `Outfit_700Bold` (titres) / `JetBrainsMono_400Regular` (chiffres).

---

## Commandes essentielles

### Développement
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/nelson/Documents/Projets/habashop-mobile

lsof -ti tcp:8081 | xargs kill 2>/dev/null   # libère le port si besoin
npx expo start --clear            # Expo Go SDK 54 (scanner le QR) — exp://<ton-IP-LAN>:8081
npx expo start --dev-client       # dev build
npx tsc --noEmit                  # TypeScript : 0 erreur
npx expo-doctor                   # objectif 18/18 ✅
```

### Build EAS (dans le terminal authentifié de Nelson)
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
eas build --platform android --profile preview      # APK installable (test)
eas build --platform android --profile production    # AAB Google Play
eas build:list --limit 3                             # suivre les builds
```

### Git — commit direct sur `main`
```bash
npx tsc --noEmit            # rituel avant commit : 0 erreur
git add . && git commit -m "feat/fix: description" && git push origin main
```

---

## EAS Build — profils (`eas.json`)

| Profil | Format | Usage | Durée |
|--------|--------|-------|-------|
| `development` | APK | dev + Metro + hot reload (dev-client) | ~15 min |
| `preview` | APK | test direct sur Android (distribution interne) | ~15 min |
| `production` | AAB | Google Play Store | ~20 min |

### Nommer l'APK téléchargé (`HabaShop-Mobile.apk`)
⚠️ **Aucun champ eas.json ne renomme l'artefact** (`artifactPath`/`applicationArchivePath` = chemin où
EAS *cherche* l'archive dans le build, pas un renommage ; le mettre casserait le build). EAS sert
l'artefact sous une URL hashée. → **Renommer au téléchargement** :
```bash
URL=$(eas build:list --platform android --limit 1 --json --non-interactive \
  | python3 -c 'import sys,json; a=json.load(sys.stdin)[0]["artifacts"]; print(a.get("applicationArchiveUrl") or a.get("buildUrl") or "")')
curl -fL -o HabaShop-Mobile.apk "$URL"   # *.apk / *.aab sont gitignorés
```
Installer sur device : `adb install -r HabaShop-Mobile.apk` (nécessite un device en débogage USB).

---

## Notifications Push

- Token enregistré via `POST /api/notifications/token` (route Railway déployée ✅).
- Push distant **uniquement en dev build ou production** (pas Expo Go — restriction SDK 53+).
- Icône notif Android = **silhouette blanche sur transparent** (`assets/notification-icon.png`,
  câblée dans le plugin `expo-notifications`).

---

## Offline-first (CDC §7) — à implémenter
Online → API ; offline → cache + file d'actions `{id,type:'SALE'|'STOCK_MOVE',payload,createdAt,synced}` ;
retour réseau → sync (`POST /api/sales`). TTL cache : produits 24 h, clients 1 h, stock 5 min.

---

## Historique des commits importants

| Commit | Description |
|--------|-------------|
| ac98738 | feat: init — Expo SDK 56 + Auth + Expo Router (5 tabs) |
| 4be9001 | fix: downgrade SDK 56 → 54 (compat Expo Go Android) |
| 441d75f | feat: Dashboard complet (vraies données API) |
| 46f3ea7 | feat: POS complet (API réelle) |
| cf0ae03 | feat: Stock complet (API réelle) |
| 97412c6 | feat: Settings + Clients + Notifications push |
| 840175a | fix: i18n + devise — hooks useI18n/useFmt + persist |
| f95133f | fix: écran noir — route `/` manquante + splash durci |
| c079caf | feat: icônes depuis logo HabaShop réel (pwa-512x512) |
| dcce28b | fix: commit expo-updates (dépendance manquante) |
| 799ebee | feat: icônes iOS opaque + notif silhouette blanche |
| 77157c7 | chore: gitignore *.apk / *.aab |

---

## TODO / Prochaines étapes

- [ ] Tester l'install APK sur device réel (vérifier fix écran noir → login)
- [ ] EAS Build iOS (nécessite compte Apple Developer ; `icon-ios.png` opaque déjà prêt)
- [ ] Tester notifications push réelles (token EAS, dev build)
- [ ] Scanner code-barres (`expo-camera`, EAN13)
- [ ] Mode hors ligne (cache + file d'actions, CDC §7)
- [ ] Écran Rapports (analytics)
- [ ] Google Play Store (AAB production)

---

*Dernière mise à jour : Sprint 1 — 2026-05-27 (SDK 54, EAS, icônes, fix écran noir, endpoints réels vérifiés).*
