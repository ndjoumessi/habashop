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
| @react-native-community/netinfo | 11.4.1 | Détection réseau (offline) |
| expo-file-system | ~19.0.22 | Export CSV (Rapports) — nouvelle API `File`/`Paths` |
| expo-sharing | ~14.0.8 | Partage du CSV |
| expo-local-authentication | ~17.0.8 | Biométrie Face ID + empreinte |
| expo-image-picker | ~17.0.11 | Photo de profil (galerie/caméra) |
| expo-image-manipulator | ~14.0.8 | Redimensionnement photo 200×200 |
| expo-task-manager / expo-background-fetch | ~14.0.9 | Refresh widget (15 min) — ⚠️ background-fetch déprécié → `expo-background-task` |
| DarkColors / LightColors | `theme.ts` | Thème clair/sombre/système (`useTheme()` dans `appStore`) |

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
- **app.json :** `name: HabaShop`, `slug: habashop-mobile`, `version: 1.2.0` (pas de champ `sdkVersion` ni `owner`)
- **Versionnage :** `appVersionSource: remote` dans `eas.json` → le `versionCode` Android est **géré côté EAS** (auto-incrément) ; celui d'`app.json` est **ignoré** au build.
- **Play Store :** AAB v1.2.0 buildé (build `1f6bf56f`). Feature graphic prêt → `assets/feature_graphic.png` (1024×500, généré via Pillow + logo réel ; source `.svg`). Politique de confidentialité **requise** = page publique **`/privacy`** du web (live : https://habashop.vercel.app/privacy, code dans `../habashop` `apps/frontend/src/pages/Privacy.tsx`). Fiche + checklist complètes → `PLAY_STORE.md`.

---

## Structure du projet

```
app/                       # Expo Router (file-based)
  _layout.tsx              # root : fonts, QueryClient, restoreSession, OfflineSyncBridge, setup widget
  index.tsx                # route '/' → Redirect dashboard/login (⚠️ fix écran noir, ne pas supprimer)
  (auth)/_layout.tsx + login.tsx   # login + biométrie (Face ID/empreinte)
  (app)/_layout.tsx
    (tabs)/_layout.tsx     # tab bar
    (tabs)/dashboard|stock|customers|settings|pos-tab.tsx
    pos/index.tsx          # caisse (fullScreenModal) — scanner, offline, ticket WhatsApp
    reports/index.tsx      # Rapports (KPIs période, barres CSS, top, paiements, export CSV)
    sales/index.tsx        # Historique des ventes (filtres, détail, renvoi ticket WhatsApp)
    search/index.tsx       # Recherche globale (produits + clients, debounce 300 ms)
    kiosk/index.tsx        # Mode kiosque POS plein écran (grille 4 col + panier permanent, sortie PIN)
src/
  constants/theme.ts       # Colors (sombre figé) + DarkColors/LightColors/ThemeColors + Spacing/BorderRadius/FontSize/Shadow + withAlpha()
  stores/                  # authStore, appStore (useI18n/useFmt/useTheme + theme/kioskMode + persist), posStore
  hooks/
    useNetworkStatus.ts    # détecte online/offline (NetInfo)
    useOfflineSync.ts      # sync auto de la file au retour réseau (monté via <OfflineSyncBridge/>)
    useProfilePhoto.ts     # photo de profil (image-picker + manipulator, persist AsyncStorage)
    useResponsive.ts       # ⚠️ prep tablette/iOS — PRÊT mais PAS encore branché (ne pas supprimer, ≠ code mort)
  services/
    api.ts                 # axios + interceptor JWT + authApi/productsApi/salesApi/analyticsApi
    exchangeRate.ts        # taux FX live (open.er-api.com), cache 6h, fallback
    notifications.ts       # registerForPushNotifications() (durci) + sendLocalNotification() + testPushNotification()
    offlineQueue.ts        # file d'actions offline (AsyncStorage) : SALE / STOCK_MOVE
    whatsappTicket.ts      # génère + envoie le reçu WhatsApp (Linking)
    biometric.ts           # Face ID / empreinte (expo-local-authentication + SecureStore)
    widgetNotification.ts  # "widget" CA = notification persistante (opt-in, flag AsyncStorage)
  tasks/
    backgroundRefresh.ts   # refresh widget en arrière-plan (expo-background-fetch, 15 min)
  components/
    ui/                    # AccessibleButton · AccessibleInput · ErrorState · Avatar · ThemedView
    pos/                   # BarcodeScanner · POSProductGrid · POSCart · POSConfirmModal · payModes
  types/
```
> Thème : `useTheme()` vit dans `appStore` (pas de fichier `useTheme.ts`/`themes.ts` séparé) ; palettes `DarkColors`/`LightColors` dans `theme.ts`. ✅ implémenté Sprint 4 (voir **Notes Sprint 4**).
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
| `/api/auth/login` | POST | `{ token, user, tenant }` (tenant **complet** : vatRate, posVatIncluded, plan, status…) |
| `/api/auth/me` | GET | ⚠️ objet **À PLAT** `{ id, name, email, role, shopName, currency }` — **PAS** `{ user, tenant }` (vérifié live). `restoreSession` reconstruit `user` depuis ces champs + `GET /api/tenant` pour le tenant complet. |
| `/api/tenant` | GET | tenant complet (id, name, currency, **vatRate, posVatIncluded, priceMode**, plan, status, lang…) |
| `/api/products` | GET | tableau **plat** `[{ id, name, sellPrice, emoji, stockQty, stockMin, category, isActive, barcode, priceTiers?, hasPromotion?, promotionPrice? }]` |
| `/api/products/:id` | **PUT** | ⚠️ **PUT, pas PATCH** — renvoie le produit mis à jour |
| `/api/sales` | POST | body `{ items:[{ productId, qty, price }], total, paymentMode, discount? }` — ⚠️ `qty`, pas `quantity` |
| `/api/sales` | GET | `?limit=N` → tableau `[{ id, total, paymentMode, discountAmount, createdAt, items }]` (filtrage par date **côté client** dans Rapports) |
| `/api/customers` | GET | `[{ id, name, phone, email, type, loyaltyPoints, totalRevenue }]` |
| `/api/dashboard/stats` | GET | data **plate** `{ salesToday, transactionsToday, salesMonth, totalProducts, activeEmployees, pendingOrders, topProducts:[{name,ca}], stockAlerts:[{name,stockQty,stockMin}] }` |
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
> ⚠️ Depuis Sprint 4, les écrans construisent leurs styles via `const s = useMemo(() => makeStyles(C), [C])` (C = palette courante via `useTheme()`), **pas** `Colors.` en direct — sauf `kiosk/index.tsx` (volontairement sombre figé) et `widgetNotification.ts`.

---

## Commandes essentielles

### Développement
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/nelson/Documents/Projets/habashop-mobile

lsof -ti tcp:8081 | xargs kill 2>/dev/null   # libère le port si besoin
npx expo start --clear            # Expo Go SDK 54 (scanner le QR) — exp://<ton-IP-LAN>:8081
npx expo start --dev-client       # dev build
npx tsc --noEmit                  # TypeScript : 0 erreur (0 `any` dans app/ + src/)
npm test                          # jest-expo — 31 tests (logique pure POS) doivent passer
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

## Offline-first (CDC §7) — ✅ implémenté (Sprint 2)
`useNetworkStatus` (NetInfo) ; `offlineQueue.ts` = file d'actions `{id,type:'SALE'|'STOCK_MOVE',payload,createdAt,synced}`
en AsyncStorage ; `useOfflineSync` rejoue la file au retour réseau (`POST /api/sales`), monté via
`<OfflineSyncBridge/>` **sous** le `QueryClientProvider`. POS : si hors-ligne, la vente part en file ;
badge « Hors ligne » sur le dashboard. (TTL cache produits/clients/stock = encore à affiner.)

---

## Notes Sprint 2 — réconciliations importantes

### `useI18n()` / `useFmt()`, pas `useAppStore()`
Dans tout composant : `const { i, lang } = useI18n()` / `const { fmt, currency } = useFmt()` (depuis
`@/stores/appStore`). `useAppStore` n'expose **pas** `i`.

### `<OfflineSyncBridge/>`
`useOfflineSync()` appelle `useQueryClient()` → **ne peut pas** être appelé directement dans `RootLayout`
(hors provider). Encapsulé dans `<OfflineSyncBridge/>` **sous** le `QueryClientProvider` (`app/_layout.tsx`).

### expo-file-system v19 (SDK 54) — nouvelle API
L'API legacy (`documentDirectory` + `writeAsStringAsync`) a quitté l'import par défaut (déplacée sous
`expo-file-system/legacy`). Le code utilise la **nouvelle API** :
```typescript
import { File, Paths } from 'expo-file-system'
const file = new File(Paths.cache, `rapport-${Date.now()}.csv`)
file.create(); file.write(csv)
await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' })
```

### Graphiques = barres CSS
Pas de Victory/Recharts. Barres en `View` natives (hauteur en %). Libellés de jours **en dur**
(Hermes/Android ignore les options de `toLocaleDateString` — cf. `INTL_OK` dans `appStore`).

### WhatsApp iOS
`whatsapp://` nécessitera `"LSApplicationQueriesSchemes": ["whatsapp"]` dans `ios.infoPlist` (`app.json`)
**avant un build iOS**, sinon `Linking.canOpenURL` renvoie `false` (Android OK sans rien).

---

## Notes Sprint 3+ — pièges à éviter

### Photo de profil (`useProfilePhoto` + `Avatar`)
- Stockée **en local** (URI dans AsyncStorage) — **pas** uploadée au backend ; redimensionnée **200×200 JPEG**.
- `mediaTypes: ['images']` (l'ancien `MediaTypeOptions` est déprécié SDK 54) ; `manipulateAsync` déprécié mais fonctionnel.

### Biométrie (`src/services/biometric.ts`)
- `disableDeviceFallback: true` → supprime le bouton "mot de passe/PIN" **natif** du prompt.
- Identifiants **chiffrés** dans SecureStore ; auto-trigger au démarrage si activée ; `useRef(false)` anti-double-déclenchement.
- Login : si biométrie activée, le **formulaire mot de passe est masqué** (vue biométrique + lien "utiliser le mot de passe"). `setAuth` **différé** pour que la modale d'activation s'affiche avant la redirection.

### "Widget" CA du jour
- **Pas un vrai widget Android** → **notification persistante** : `sticky: true` + `autoDismiss: false`. ⚠️ **PAS** de champ `ongoing` / `content.android` dans l'API expo-notifications (n'existe pas).
- Canal `habashop-widget` importance **LOW** ; **opt-in** (flag AsyncStorage, toggle Réglages).
- `expo-background-fetch` (déprécié) refresh 15 min → **dev build obligatoire** (ne tourne pas dans Expo Go).

### Recherche globale
- Produits **et** clients ; **debounce 300 ms** ; max **20** résultats.
- ⚠️ paramètre `.map()` nommé `term` (pas `s`) pour ne pas masquer le `StyleSheet s`.

### Thème clair/sombre — ✅ implémenté (Sprint 4)
- L'ex-« chantier dédié » des 477 usages `Colors` statiques a été fait : `StyleSheet` migrés en `makeStyles(C)`. Détails ci-dessous dans **Notes Sprint 4**.

---

## Notes Sprint 4 — pièges à éviter

### Thème clair/sombre
- **18 fichiers migrés** : `StyleSheet.create` → `makeStyles(C)` appelé via `useMemo` dans **chaque** composant — **ne pas** revenir aux `Colors` statiques.
- `ThemeColors = { [K in keyof typeof DarkColors]: string }` (**pas** `typeof DarkColors` : les littéraux `as const` rendent `LightColors` incompatible → `"#5535CC" ≠ "#A991FF"`).
- `userInterfaceStyle: "automatic"` dans `app.json` **obligatoire** pour que le mode « Système » suive vraiment l'OS ; `StatusBar` rendu dynamique (`isDark ? 'light' : 'dark'`).
- `Colors` statiques encore présents (volontairement) dans `kiosk/index.tsx` (interface caissier = sombre fixe) et `widgetNotification.ts` (couleur de marque).
- ⚠️ Le hook `useTheme()`/`useMemo` doit être **avant** tout `return` conditionnel (règle des hooks).

### Mode kiosque
- PIN de sortie : **`1234`** (appui **LONG** sur ⚙️, `delayLongPress=600`).
- `kioskMode` persisté dans `appStore` (AsyncStorage, via `partialize`).
- Route `fullScreenModal` + `animation: 'fade'` (dans `app/(app)/_layout.tsx`) ; `StatusBar hidden`.
- Branché sur l'API réelle du `posStore` (`addItem`/`updateQty`/`total`/`recordSale`/`paymentMode`).

### Version 1.2.0
- `version: 1.2.0` ; `buildNumber` iOS = `3`. Le `versionCode` Android d'`app.json` (=3) est **ignoré** (`appVersionSource: remote` → EAS auto-incrémente).
- `runtimeVersion.policy = appVersion` → passer à 1.2.0 **change le runtime** : un `eas update` OTA ne touche **PAS** les builds 1.0.0 ; **nouveau build EAS** requis pour tester le thème.
- OTA possible entre builds de **même runtime** (ex. fix navbar `777a5e1` poussé sur le build 1.2.0 via `eas update --branch preview`).

---

## Notes Sprint 5 — prep iOS + tablette (infra seule)

> Seule l'**infra** a été faite (zéro changement d'écran). Les **reflows tablette sont DIFFÉRÉS jusqu'à un iPad** (décidé avec Nelson) — cf. mémoire `tablet-ios-prep-deferred`.

### `useResponsive` (`src/hooks/useResponsive.ts`)
- Dérive `isTablet` (≥768) / `isLargeTablet` (≥1024) / `isLandscape` / `columns` / `sidebarWidth` / `cardWidth` / `fontSize` / `spacing` depuis `useWindowDimensions` (réactif à la rotation).
- ⚠️ **PRÊT mais PAS encore consommé** par les écrans — ne pas le supprimer en croyant que c'est du code mort.

### Config iOS (`app.json`)
- `ios.supportsTablet: true` ; infoPlist : `NSCamera` + `NSPhotoLibrary` + `NSFaceID` + **`LSApplicationQueriesSchemes:["whatsapp"]`** (sinon `Linking.canOpenURL('whatsapp://')` renvoie `false` sur iOS).
- `orientation: "portrait"` global **inchangé** — activer le paysage iPad fait partie du chantier différé (passer à `"default"` + orientations `~ipad`).
- `eas.json` : profil `preview` ios `simulator:true` (build simulateur gratuit, sans compte Apple). Pas de `resourceClass` custom (valeurs type `m1-medium` obsolètes → défaut).

### Reflows tablette — NON faits (à reprendre avec un iPad)
- Dashboard (grille KPI adaptative + 2 colonnes paysage), POS (panier latéral permanent + `numColumns={columns}` avec `key={`grid-${columns}`}` — la `key` force le re-render), tab bar.
- ⚠️ Tab bar latérale iPad : `tabBarPosition:'left'` va dans **`screenOptions`** (PAS comme prop de `<Tabs>`) ; supporté par React Navigation 7 (Expo Router 6).
- iOS build réel = **compte Apple Developer requis** (cf. `IOS_BUILD.md`).

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
| 49629be | feat: **Sprint 2** — scanner EAN13 + offline + WhatsApp + Rapports |
| 650370f | feat: **Sprint A** a11y — `accessibility*` sur tous les écrans (0→135) |
| 661c517 | feat: **Sprint B** — AccessibleButton/Input/ErrorState + `withAlpha` |
| 8449fd8 | feat: **Sprint C** — withAlpha complet + POS découpé (699→378) + cibles 44pt |
| 22b5e95 | feat: **Sprint 3** — biométrie + widget CA (notification persistante) |
| f76ea60 | feat: photo de profil + historique des ventes + recherche globale |
| e1a9704 | feat: **Sprint 4** — thème clair/sombre + kiosque POS + push durci + Play Store prep |
| 777a5e1 | fix: navbar — labels sur une ligne (fontSize 8 + numberOfLines + adjustsFontSizeToFit) |
| edef04b | feat: **Sprint 5 (infra)** — useResponsive + config iOS (app.json/eas.json) + IOS_BUILD.md |
| 0ce1193 | fix(pos): normalise la comparaison barcode (scan → produit) + `src/lib/barcode.ts` (+5 tests) |
| e60d205 | fix(scanner): types restreints `ean13/ean8/code128` + debounce 1.5 s + viewfinder ROI |
| a1e835e | fix(scanner): filtre stabilité 2 lectures identiques (ROI logicielle abandonnée) |
| df6eb24 | feat(pos): saisie manuelle code-barres (fallback scanner) — **retirée par 11254c5** |
| 11254c5 | refactor(pos): supprime recherche texte + saisie manuelle, **scan seul** |
| 9180ea2 | feat(ui): **Error Boundary** plein écran (anti white-screen) + reset/redémarrage |
| b0950b5 | chore(logging): comble les **8 `catch {}` vides** (logger.warn) |
| cd23f32 | feat(receipt): **reçu imprimable / PDF** (expo-print) — POS + historique |
| 750671c | chore(deps): **expo-background-fetch → expo-background-task** (minimumInterval en minutes) |
| ef487e7 | feat(observability): **crash reporter Sentry** (import dynamique guardé Expo Go + DSN) |
| 84da272 | feat(kiosk): **TVA + client + remise** (parité Caisse, via posStore + CustomerPicker) |
| 91d50ba | chore: **version 1.4.0** (build APK preview) |
| be323eb | chore(eas): pin `environment` preview/production (charge `EXPO_PUBLIC_SENTRY_DSN`) |
| 523474e | feat(sentry): **source maps** (plugin expo + metro `getSentryExpoConfig` + fix `@expo/config-plugins`) |
| 288024d | chore: **version 1.4.1** (build avec source maps Sentry) |
| dace38c | fix(settings): **version réelle** (`Constants.expoConfig?.version`) + bump **1.4.2** (label « 1.2.0 » était hardcodé) |
| a50f820 | feat(sales): **annulation/remboursement** de vente (parité web) — `RefundSheet` + `canRefundRole` + badge « Remboursé » |
| d7eecc9 | fix(sales): bouton « Rembourser » **inline dans la liste** (le web l'affiche par ligne ; mobile ne l'avait qu'en détail) + normalisation casse rôle |
| 920bb88 | feat(loyalty): **feedback +N pts** après vente (delta server-side) + **carte fidélité honnête** (miroir web) |
| 468934d | feat(robustesse): **P1-A** Error Boundaries par route (Expo Router) + **P1-B/C** ventes résilientes (clé d'idempotence + retry→file offline) |
| 07e1b31 | test(e2e): **P1-E** smoke **Maestro** (`.maestro/smoke.yaml`) — login → Caisse → vente → remboursement |
| d4a260a | feat(loyalty): **seuils & taux configurables par tenant** (`pointsPerAmount`/`bronzeThreshold`/`silverThreshold`) |
| 5cae7f4 | feat(sales): **bouton Facture PDF** (download arraybuffer + `expo-sharing`) — fiche vente + RefundSheet, tous rôles |
| 8b2105f | feat(pos): **paiement mixte** (split 2 méthodes) dans la confirmation — `paymentMode='mixed'` + `cash/mobileMoney/cardAmount` |

---

## TODO / Prochaines étapes

- [x] Scanner EAN13 · Mode hors-ligne · Ticket WhatsApp · Rapports + CSV ✅ (Sprint 2)
- [x] Audit UI/UX + accessibilité (Sprints A/B/C : 0→135 attributs `accessibility*`, POS découpé) ✅
- [x] Biométrie Face ID / empreinte ✅
- [x] Widget CA du jour (notification persistante, opt-in) ✅
- [x] Photo de profil · Historique des ventes · Recherche globale ✅
- [x] Thème clair/sombre/système ✅ (Sprint 4)
- [x] Mode kiosque POS ✅ (Sprint 4)
- [x] Push notifications durci (projectId + routing par type) ✅ (Sprint 4)
- [x] Google Play Store — préparation (`PLAY_STORE.md` + feature graphic + page `/privacy` live) ✅ (Sprint 4)
- [x] Prep iOS + responsive — `useResponsive`, config iOS `app.json`/`eas.json`, `IOS_BUILD.md` ✅ (Sprint 5, infra seule)
- [x] Validé device : scanner, thème clair, kiosque (vente + PIN), encaissement→API ✅ (cf. `runtime-verification-debt`)
- [x] **Annulation/remboursement de vente** (parité web) — manager/admin, motif obligatoire, restock, 409 idempotent ✅
- [x] **Fidélité v1** — feedback « +N pts » après vente + carte fidélité honnête, **seuils/taux configurables par tenant** ✅
- [x] **Robustesse P1-A/B/C** — boundaries par route + ventes résilientes (idempotence + retry→file offline) ✅
- [x] **Smoke E2E Maestro** (`.maestro/smoke.yaml`) — login→Caisse→vente→remboursement (P1-E) ✅ (non lancé : nécessite un device)
- [x] **Facture PDF** — bouton « 📄 Facture » (download + partage système) dans la fiche vente + RefundSheet, tous rôles ✅
- [x] **Paiement mixte** — split 2 méthodes (espèces/mobile/carte) dans la confirmation POS ✅
- [ ] **Lancer le smoke Maestro sur un device** (`maestro test .maestro/smoke.yaml`) — confirmer le parcours bout en bout
- [ ] **Tester sur device le reste** : biométrie, offline+resync, widget, ticket WhatsApp, balayage clair écran par écran, TalkBack
- [ ] **Confirmer device le scanner durci** (filtre stabilité 2 lectures) sur l'Android lent — sinon vote majoritaire glissant ; voir mémoire `barcode-scanner-android-unreliable`
- [ ] Publier sur Google Play Store (AAB `1f6bf56f` prêt ; captures à faire)
- [ ] **Layouts tablette** (Dashboard/POS/tab bar) — DIFFÉRÉS jusqu'à un iPad (`useResponsive` prêt ; cf. `tablet-ios-prep-deferred`)
- [ ] EAS Build iOS réel (compte Apple Developer requis — cf. `IOS_BUILD.md`)
- [ ] Notifications push réelles (token EAS, dev build)

---

*Dernière mise à jour : 2026-06-05 — **session remboursement + fidélité + robustesse + e2e + facture PDF + paiement mixte** (diffusée en **OTA `preview`**, runtime **1.4.2**, dernier Update `019e97e7` ; **110 tests verts** ; +`5cae7f4` Facture PDF, +`8b2105f` paiement mixte) — précédent Update `019e95b7` ; pas de nouveau build natif). Livré : (1) **annulation/remboursement** de vente (`a50f820`) + fix « Rembourser » rendu inline dans la liste (`d7eecc9`) ; (2) **fidélité** — feedback « +N pts » + carte honnête (`920bb88`), **seuils/taux configurables par tenant** (`d4a260a`) ; (3) **robustesse P1-A/B/C** — Error Boundaries par route + ventes résilientes idempotentes retry→file (`468934d`) ; (4) **smoke Maestro** e2e (`07e1b31`, non lancé). **101 tests verts**, `tsc` 0. Sentry : unique crash = Fabric natif `addViewAt` (stale, 3 juin) ; **web sans Sentry** (angle mort) ; `SENTRY_AUTH_TOKEN` tourné (`.env` + EAS). Voir **Session 2026-06-04/05** ci-dessus. — Précédent : **APK 1.4.2 buildé** (build `33940b3d`) : fix du **label version hardcodé** « 1.2.0 » en Réglages → lit désormais `Constants.expoConfig?.version` (`dace38c`). Le label trompeur faisait croire que le crash Fabric Caisse persistait alors qu'il est corrigé depuis 1.4.0 (`d949c78`). `newArchEnabled` reste absent (Fabric ON ; `false` casse le build — reanimated 4). À valider device : désinstaller l'ancienne app puis vérifier « 1.4.2 » affiché + bouton Caisse OK. Précédent : (1) scanner code-barres durci + Caisse scan seul ; (2) pack robustesse : Error Boundary, 8 catch vides comblés, reçu PDF (expo-print, validé device) ; (3) pack build : expo-background-task (remplace background-fetch déprécié) + crash reporter Sentry (guardé Expo Go/DSN) ; (4) parité kiosque TVA/client/remise ; (5) **APK 1.4.1** (`b999af75`) Sentry complet (DSN + source maps). Audit interne au repo = soldé.*

---

## État fin de session 2026-05-27

### ✅ Validé sur device (APK 382fe2ec / OTA 39e3315)
- Login + Dashboard + POS + Stock + Clients
- Scanner EAN13 bout en bout
- Thème clair/sombre/système
- Mode kiosque (vente + sortie PIN 1234)
- Biométrie (Face ID + Fingerprint)
- Barcode produits corrigé (web + mobile)

### ⏳ Reste à tester sur device
- Offline + resync automatique
- Ticket WhatsApp après vente réelle
- Widget CA (notification persistante)
- TalkBack accessibilité

### 🔜 Prochaine session
- Captures d'écran Play Store (8 écrans)
  → Stock démo nettoyé et prêt
- Publier sur Google Play Store
  → AAB prêt : HabaShop-Mobile-v1.2.0.aab
  → PLAY_STORE.md complet (4 langues)
  → Page /privacy déployée sur Vercel
- Domaine habashop.com
- Wave + Orange Money prod

---

## Session 2026-06-01 — durcissement POS + qualité (APK 1.3.0)

> Toutes ces améliorations sont sur `main` (poussées), `tsc` 0, **0 `any`**, **31 tests verts**.

### Livré (commits sur `main`)
- **`fix(auth)`** — `restoreSession` reconstruit `user` depuis le `/api/auth/me` **plat** + `GET /api/tenant` (avant : lisait `res.data.user/tenant` inexistants → user/tenant `undefined` + **boucle de refetch** depuis Settings). 5 boutons démo au login.
- **`chore(logging)`** — `src/lib/logger.ts` (DEV-gated sur `__DEV__`, même pattern que le web) ; 16 `console.*` remplacés (flux→log, échec→warn, erreur→error).
- **`fix(pos)` garde espèces** — encaissement bloqué si montant reçu < total (mode cash) ; bouton « Encaisser » désactivé + message.
- **`fix(pos)` devise espèces** — `cashGiven` saisi en **devise d'affichage** → ramené en XOF via **`convertToXOF`** (nouvel inverse de `convertFromXOF`) avant comparaison/monnaie. XOF/XAF = identité. ⚠️ **Pattern** : tout montant tapé par l'utilisateur est en devise d'affichage → convertir en XOF avant de comparer aux totaux (qui sont en XOF base).
- **`feat(pos)` promotions + paliers** — `posStore.resolveLinePrice` = **miroir exact** du backend `resolveTierPrice` (promo > palier `minQty≤qty` le plus haut > base), recalculé à chaque changement de quantité. `item.price` = prix effectif → total écran = ticket = backend.
- **`types(api)`** — `src/types/index.ts` (Product, Customer, User, Tenant, Sale*, DashboardStats, PriceTier…) ; `api.ts` 100% typé + helpers **`apiErrorMessage`/`apiErrorStatus`** ; propagation aux écrans → **0 `any`**. `authStore` utilise désormais les types `@/types`.
- **`feat(pos)` client/fidélité** — `CustomerPicker` (modal recherche nom/tél, `GET /api/customers`, points + type) ; `customerId` envoyé à `POST /api/sales` (online + offline) ; toast « Client : X — vente liée ». ⚠️ Le backend incrémente `totalRevenue` mais **pas** `loyaltyPoints` (crédit fidélité = évolution backend).
- **`feat(pos)` TVA** — `vatBreakdown(total, tenant.vatRate)` (prix **TTC**, miroir web : `HT = total/(1+taux)`, `tva = total−HT`) affiché panier + confirmation + ticket WhatsApp. ⚠️ Mode **HT** (`posVatIncluded:false`) **non géré** (changerait le total envoyé au backend).
- **`fix(pos)` anti sur-vente** — **`capToStock`** plafonne la quantité au `stockQty` dans `addItem`/`updateQty` (filet sûr tous chemins, dont kiosque) ; bouton `+` désactivé au max + alerte à l'ajout.
- **`feat(pos)` remise** — champ « Remise % » (0–100) branché sur `discount`/`setDiscount` (la logique existait déjà ; seule la saisie manquait).
- **`test`** — **jest-expo** posé (`babel.config.js`, `jest.config.js` mapper `@/` + mock AsyncStorage, `npm test`). 3 suites / **31 tests** : `pricing` (resolveLinePrice/capToStock/vatBreakdown), `exchangeRate` (convert*), `cartStore` (plafond/promo/palier/remise/clearCart).

### Nouveaux fichiers
`src/lib/logger.ts` · `src/types/index.ts` · `src/components/pos/CustomerPicker.tsx` · `babel.config.js` · `jest.config.js` · `jest.setup.js` · `src/__tests__/*`.

### Build APK 1.3.0
- `app.json` : **version 1.3.0**, versionCode 4 (⚠️ **ignoré** : `appVersionSource: remote` → EAS gère le code à distance ; le profil `preview` n'a pas d'`autoIncrement` → versionCode resté à **3**).
- Build EAS Android `preview` (APK, keystore `sH_oz3rpgx`) → **FINISHED** : build `088afe30-76df-40f0-90b2-739e7f29aca7`.
  - Dashboard : https://expo.dev/accounts/ndjoumessi/projects/habashop-mobile/builds/088afe30-76df-40f0-90b2-739e7f29aca7
  - APK : https://expo.dev/artifacts/eas/24bKjgB5o1U5TufwW1tMdB.apk

### Pistes restantes (audit)
- ✅ **FAIT (2026-06-03)** : Error Boundary (`9180ea2`) · 8 `catch {}` vides comblés (`b0950b5`) · reçu imprimable/PDF (`cd23f32`).
- ✅ **FAIT (2026-06-03, pack build)** : Sentry (`ef487e7`) + `expo-background-task` (`750671c`). **Restent à valider en build EAS réel** (invérifiables en Expo Go) :
  - **Sentry** : actif seulement hors Expo Go + si `EXPO_PUBLIC_SENTRY_DSN` défini → **Nelson doit coller son DSN** (`.env` local + **EAS secret** pour les builds). Symbolication **source maps** (plugin `@sentry/react-native/expo` + `SENTRY_AUTH_TOKEN` + org/project Sentry) = **follow-up non fait**.
  - **`expo-background-task`** : valider que le refresh widget tourne en dev/preview build (ne tourne pas en Expo Go).
- ✅ **FAIT (2026-06-03)** : mode kiosque **TVA + client + remise** (`84da272`) — réutilise la **logique** `posStore` (discount/customer/`vatBreakdown`) + `CustomerPicker`, **pas** le Modal `POSCart` (kiosque sombre figé en paysage, colonne panier permanente). `customerId` + `discount` envoyés à l'API ; récap HT/TVA/remise/client dans la modale de confirmation.
- **Hors de ce repo / différé** : fidélité non créditée côté **backend** ; layouts tablette différés ; Wave/Orange réel ; publication Play Store.

### Session 2026-06-03 (suite) — pack robustesse
- **Error Boundary** (`src/components/ui/ErrorBoundary.tsx`) : classe React au-dessus du router (`app/_layout.tsx`, sous `GestureHandlerRootView`, autour du `QueryClientProvider`). Fallback **thémé + i18n** ; boutons **Réessayer** (`setState` reset) / **Redémarrer** (`Updates.reloadAsync`) ; `error.message` affiché en `__DEV__` ; log `logger.error` + `componentStack`. ⚠️ le fallback `ErrorFallback` est une **fonction** (hooks `useI18n`/`useTheme`) rendue par la classe (les hooks sont interdits dans une classe).
- **8 `catch {}` vides** → `logger.warn(contexte, e)` (les `catch { return false/[] }` à fallback **restent** inchangés). `logger` ajouté en import dans `api.ts` + `useProfilePhoto.ts`.
- **Reçu PDF** : `src/services/printReceipt.ts` (`expo-print`, **déjà installé**, **dispo en Expo Go**) → `Print.printAsync({ html })` ouvre la boîte d'impression OS (AirPrint / Android → Bluetooth thermique ou PDF). `TicketOptions` **exporté** de `whatsappTicket.ts` et réutilisé (DRY) ; HTML **échappé** (`esc`). Branché post-vente POS (3ᵉ bouton de l'alerte) + réimpression historique (`sales/index.tsx`, helper `saleTicket` partagé WhatsApp/print). Annulation d'impression = normale → log, **pas** d'alerte. **Validé device (impression OK).**
- **Pack build** : **`expo-background-task ~1.0.10`** remplace `expo-background-fetch` (déprécié) — ⚠️ `minimumInterval` en **minutes** (était en secondes), résultat `BackgroundTaskResult.Success/Failed`, **supporté Expo Go** (import sûr). **Sentry `@sentry/react-native ~7.2.0`** via `src/lib/crashReporter.ts` : **import dynamique** (jamais évalué en Expo Go) + garde `executionEnvironment !== StoreClient` + DSN `EXPO_PUBLIC_SENTRY_DSN` → **inerte sans DSN / en Expo Go** ; `initCrashReporter()` au montage root, `ErrorBoundary` → `captureException`. ⚠️ source maps non configurées (follow-up build).

### Build APK 1.4.0 — Sentry DSN câblé
- **Sentry DSN** : projet `haba-76 / react-native` (région **EU/de**). DSN dans **`.env` local** (gitignored, **pas** dans le repo public) **+ EAS env var** `EXPO_PUBLIC_SENTRY_DSN` (visibilité *plaintext*) créée sur les environnements **preview** ET **production** (`eas env:create`, `eas secret:create` est **déprécié**). `eas.json` : `"environment"` épinglé sur les profils `preview`/`production` → le build **inline** bien la var (confirmé dans le log : *« loaded from the "preview" environment: EXPO_PUBLIC_SENTRY_DSN »*).
- `app.json` : **version 1.3.1 → 1.4.0** (commits `91d50ba` version, `be323eb` eas.json env). versionCode resté **3** (profil `preview` sans `autoIncrement` ; `appVersionSource: remote`).
- Build EAS Android `preview` (APK, keystore `sH_oz3rpgx`) → **FINISHED** : build `394fda70-fd7b-4e01-9de0-1b22e10da268`.
  - Dashboard : https://expo.dev/accounts/ndjoumessi/projects/habashop-mobile/builds/394fda70-fd7b-4e01-9de0-1b22e10da268
  - APK : https://expo.dev/artifacts/eas/85trffDN87RLYcWckDuQbm.apk
- ⚠️ **EAS auth partagée via disque** : `eas whoami` → `ndjoumessi` fonctionne depuis les shells de Claude (state.json partagé) → `eas env:create` / `eas build` **lançables par Claude** (contrairement à ce que laissait penser l'ancienne note « terminal de Nelson uniquement »).
- **Follow-up source maps** : ✅ **FAIT en 1.4.1** (cf. ci-dessous).
- **À valider device (APK 1.4.0/1.4.1)** : crash test → event Sentry ; scan ; reçu PDF ; kiosque client/remise ; widget après 15 min (background-task).

### Build APK 1.4.1 — source maps Sentry
- **Plugin** `@sentry/react-native/expo` ajouté à `app.json` (org `haba-76`, project `react-native`, url **EU** `https://de.sentry.io/`). **`metro.config.js`** : `getDefaultConfig` → **`getSentryExpoConfig`** (génère les source maps + debug IDs).
- ⚠️ **Piège résolu** : le plugin Sentry échouait au prebuild (`PluginError: Cannot find module '@expo/config-plugins'`) car `@expo/config-plugins@54.0.4` était **niché sous `expo/`** (non hoisté) → ajouté en **dépendance directe** `~54.0.4` (`npx expo install @expo/config-plugins`). Vérif avant build : `npx expo config --type public` doit résoudre le plugin sans erreur.
- **`SENTRY_AUTH_TOKEN`** = **secret EAS** (visibilité `secret`, environnements preview + production) + `.env` local (gitignored). **Jamais committé** (vérifié : `git diff --cached | grep sntryu_` = 0).
- `app.json` : version **1.4.0 → 1.4.1** (commits `523474e` plugin+metro, `288024d` version). versionCode resté **3** (`preview` sans `autoIncrement`).
- Build EAS Android `preview` → **FINISHED** : build `b999af75-7dfa-43b5-a4a7-724d8780723f`.
  - Dashboard : https://expo.dev/accounts/ndjoumessi/projects/habashop-mobile/builds/b999af75-7dfa-43b5-a4a7-724d8780723f
  - APK : https://expo.dev/artifacts/eas/oVhzodf1s9QUnUdbiFYFHH.apk
- Build réussi **avec le plugin actif** → upload des source maps OK ⇒ **stacks de crash symbolisées** dans Sentry (vs minifiées en 1.4.0). À confirmer device (Sentry → Settings → Source Maps après un crash test).

### Build APK 1.4.2 — version affichée réelle (fin du label trompeur « 1.2.0 »)
- **Diagnostic** : l'écran Réglages affichait **`1.2.0` en dur** (`settings.tsx`, texte littéral) — **aucun lien** avec la vraie version du build → tous les builds (1.3.0 → 1.4.1) montraient « 1.2.0 ». Ce label masquait **quel build était réellement installé**, d'où la fausse impression que le crash Fabric Caisse persistait (en réalité = vieux build testé).
- **Fix** (`dace38c`) : `<Text>{Constants.expoConfig?.version ?? '—'}</Text>` (import `expo-constants`) → suit automatiquement chaque bump d'`app.json`.
- ⚠️ **Crash Fabric Caisse = déjà corrigé** (`d949c78`, overlays montés à la demande), présent depuis 1.4.0. **NE PAS** mettre `newArchEnabled:false` (absent d'`app.json` = Fabric ON par défaut SDK 54) : `false` **casse le build** (reanimated 4.1.7 exige la New Arch — build `bb9fa2e5` ERRORED, cf. mémoire `fabric-newarch-pos-crash`). Si le crash réapparaît **malgré** « 1.4.2 » affiché → autre `<Modal>` empilé (signature `ReactClippingViewManager.addView "child already has a parent"`) à corriger au même pattern dans `sales/stock/customers/_layout`.
- `app.json` : version **1.4.1 → 1.4.2**. versionCode resté **3** (`preview` sans `autoIncrement` ; `appVersionSource: remote`).
- Build EAS Android `preview` → **FINISHED** : build `33940b3d-e311-4019-8171-aa03aa402ab0`.
  - Dashboard : https://expo.dev/accounts/ndjoumessi/projects/habashop-mobile/builds/33940b3d-e311-4019-8171-aa03aa402ab0
  - APK : https://expo.dev/artifacts/eas/7npFoAEmdK4DFDW3oS5NaN.apk
- ⚠️ **Procédure de test device** : **désinstaller complètement** l'app (`adb uninstall com.habashop.app`) **avant** d'installer le 1.4.2 (sinon Android peut garder l'ancien APK) → Réglages doit afficher **`1.4.2`** (preuve du bon build) → tester bouton **Caisse**.

---

## Session 2026-06-03 — fiabilisation scanner code-barres + simplification Caisse

> Tout sur `main` (poussé), `tsc` 0, **36 tests verts** (+5 vs 31). Itérations successives face à un **scanner expo-camera erratique** sur l'Android de test, puis simplification de la Caisse.

### Diagnostic (vérifié sur l'API live)
- Le match scan→produit était un **`===` strict** ; les barcodes en DB sont des **EAN-13 propres 13 chiffres**, et le champ **`ean` n'existe PAS** dans la réponse `/api/products` (clause `p.ean === …` morte).
- Sur ce device, ML Kit renvoyait surtout des **lectures erratiques** (codes différents par frame, ex. `397555556565` au lieu de `6111245050034`) — pas un simple problème de format.

### Livré (commits sur `main`)
- **`fix(pos)` normalisation** (`0ce1193`) — `src/lib/barcode.ts` → `normalizeBarcode()` (strip espaces + zéros de tête `^0+`). Comparaison des **deux côtés normalisés** ; ignore un scan vide (sinon match du produit au barcode `''`). 5 tests (`src/__tests__/barcode.test.ts`).
- **`fix(scanner)` types + debounce + viewfinder** (`e60d205`) — `barcodeTypes` réduits à **`['ean13','ean8','code128']`** (retiré qr/code39/upc) ; cooldown **1.5 s** (`lastScanTime`) ; viseur visuel centré. ⚠️ expo-camera SDK 54 **n'expose PAS** `barcodeScannerSettings.regionOfInterest` (type `BarcodeSettings = { barcodeTypes }` seulement) ; une ROI logicielle via `bounds` a été tentée…
- **`fix(scanner)` filtre stabilité** (`a1e835e`) — …puis **abandonnée** (`bounds` peu fiable sur cet Android). Remplacée par un **filtre de stabilité** : on n'accepte un code que **lu 2 fois d'affilée à l'identique** (`lastCandidate`, sur valeur normalisée) ; une lecture différente réinitialise. Un parasite aléatoire ne se répète pas → seul le code visé passe. Cooldown 1.5 s conservé après acceptation.
- **`feat(pos)` saisie manuelle** (`df6eb24`) puis **`refactor(pos)` scan seul** (`11254c5`) — un champ code-barres manuel (clavier num + douchette USB/BT) a été ajouté **puis retiré** sur ta demande, en même temps que la **recherche produit par nom**. La Caisse ne garde que : **grille complète + filtres catégories + bouton scan (header)**. States `search`/`barcodeInput`, handler `submitBarcode`, styles et import `TextInput` nettoyés ; `filtered` ne filtre plus que par catégorie.

### État scanner (final)
`BarcodeScanner.tsx` : `CameraView` + `onBarcodeScanned` → `handleBarcode` ⇒ **cooldown 1.5 s** → **normalize** → **2 lectures identiques consécutives** → `onScan(norm)`. Viseur = **guide UX visuel uniquement** (const `VIEWFINDER` en fractions ; **aucune** ROI logicielle / `bounds`). Types `ean13/ean8/code128`.

### Non vérifié sur device par Claude
Tests machine OK (tsc, 36 tests, **bundle Metro complet HTTP 200**, match logique contre l'API live : `6111245050034`→Bifaka, espaces/zéro de tête OK). Mais **le geste physique scan/tap n'a pas pu être exécuté** (pas de device USB, pas d'automatisation UI) → confirmation device = à faire par Nelson. Si même le bon code ne se répète jamais 2× → passer à un **vote majoritaire glissant** (2 sur 3 dernières lectures).

### Nouveaux fichiers
`src/lib/barcode.ts` · `src/__tests__/barcode.test.ts`.

---

## Session 2026-06-04/05 — remboursement, fidélité, robustesse, e2e

> Tout sur `main` (poussé), `tsc` 0, **101 tests verts** (10 suites). Diffusé en **OTA `preview`** (runtime **1.4.2**) — aucun nouveau build natif. Le backend a livré en parallèle : `POST /api/sales` **idempotent**, créditage **fidélité serveur**, et **config fidélité par tenant**.

### 1. Annulation / remboursement de vente (`a50f820`, fix `d7eecc9`)
- Backend `POST /api/sales/:id/refund { reason, restock }` (déjà en prod). Mobile = **présentation + appel** uniquement.
- `src/components/pos/RefundSheet.tsx` (modale **on-demand** `{state && <Modal>}` — anti-crash Fabric) ; `src/lib/refund.ts` (`canRefundRole`/`isRefunded`/`isTrackingPayment`).
- Droits **MANAGER/ADMIN/SUPER_ADMIN** ; caissier masqué. Motif **obligatoire**, restock **pré-coché**, note Wave/Orange « suivi only », **409** (déjà remboursée) géré, MAJ optimiste (`invalidateQueries(['sales'])`).
- ⚠️ **Bug corrigé (`d7eecc9`)** : « Rembourser » était **invisible** car placé **seulement dans la feuille de détail** ; le **web l'affiche inline par ligne**. → ajout d'une **pill « Rembourser » dans chaque ligne** de l'historique (rôle OK + vente non remboursée). Le rôle n'était PAS en cause (`SUPER_ADMIN` correct partout). Défense en profondeur : `canRefundRole` **normalise** la casse (`trim().toUpperCase()`, comme le web).

### 2. Fidélité (`920bb88`, config tenant `d4a260a`)
- **Feedback après vente liée à un client** : relit le solde canonique via `GET /api/customers/:id/loyalty` et affiche le **DELTA réel** « +N points fidélité » (après − avant). **Jamais** de recalcul de la règle côté mobile. Workaround « toast neutre » retiré.
- **Carte fidélité honnête** (`src/components/customers/LoyaltyCard.tsx`, fiche client) : solde + palier **canonique** (backend), barre de progression, règle réelle — **AUCUNE** promesse de remise (« Récompenses & remises : à venir »).
- **Configurable par tenant (`d4a260a`)** : `src/lib/loyalty.ts` paramétré par **`pointsPerAmount`/`bronzeThreshold`/`silverThreshold`** (renvoyés par `GET /api/tenant` **et** `GET /loyalty`). Défauts v1 = `1000/2000/5000`. ⚠️ **sémantique backend** : `bronzeThreshold` = **entrée Silver**, `silverThreshold` = **entrée Gold**. Source : réponse `/loyalty` (la plus fraîche) → `tenant` store → défauts. Libellés (taux + seuils) **dynamiques**, dans la devise du tenant.

### 3. Robustesse — P1-A + P1-B/C (`468934d`)
- **P1-A — Error Boundaries par route** : `src/components/ui/RouteErrorFallback.tsx` branché via la **convention Expo Router** `export { default as ErrorBoundary }` sur `(tabs)/_layout`, `pos/index`, `kiosk/index`. Fallback **localisé** (Réessayer/Retour, log Sentry) → un écran qui plante n'emporte plus toute l'app. Boundary racine conservé en dernier recours. ⚠️ un crash **natif** (ex. Fabric `addViewAt`) **n'est PAS** rattrapable par un boundary JS → la vraie parade reste les **modales on-demand**.
- **P1-B/C — Ventes résilientes** : `src/lib/idempotency.ts` (UUID v4, **1 clé par tentative**, jamais régénérée) ; `src/services/saleSubmit.ts` `submitSaleResilient()` → sur **timeout/5xx** : retry court (backoff, **même clé**) ; échec persistant → **bascule file offline** (au lieu d'une alerte sèche). 4xx → propagé. `isRetryableApiError` (api.ts). POS **et** kiosque câblés. `useOfflineSync` : **reflush périodique 30 s** (capte les ventes mises en file « en ligne mais lent »). Le backend dédup sur la clé → **zéro doublon** au retry/resync.

### 4. E2E — P1-E smoke Maestro (`07e1b31`)
- `.maestro/smoke.yaml` (appId `com.habashop.app`, `clearState:true`) : **login → Caisse → vente → remboursement**, labels FR exacts, `assertVisible`/`extendedWaitUntil`. `.maestro/README.md` (install/run/debug/prérequis). **Non lancé** (pas de device) ; `jest.config.js` accepte désormais `*.test.tsx`.
- Premier test E2E : aurait attrapé le crash Fabric release-only (invisible aux unit tests).

### Sentry — audit + rotation token
- **Audit** : un **seul** projet Sentry (`react-native`, org `haba-76`, EU) → **le web n'a PAS de Sentry** sous ce token (angle mort à traiter côté web). Issue unique = `IllegalStateException: addViewAt: failed to insert view` (**fatal, native Fabric**, 31 events / 6 users, **24 sur la 1.4.2**, devices **entrée de gamme** Redmi `2203129G` / Realme `RMX3363`, Android 13/14), **dernière le 3 juin** (rafale de test, pas du trafic prod). Marquée *resolved* mais le sample est **stale + minuscule** → re-tester un build courant pour confirmer.
- **Token tourné 2×** : `SENTRY_AUTH_TOKEN` mis à jour dans **`.env`** (gitignored) **et** **EAS env vars** (secret, preview + production) via `eas env:update`. ⚠️ Le token vit à ces 2 endroits ; révoquer les anciens dans Sentry pour finir la rotation.

### Nouveaux fichiers (session)
`src/lib/refund.ts` · `src/lib/idempotency.ts` · `src/services/saleSubmit.ts` · `src/components/pos/RefundSheet.tsx` · `src/components/customers/LoyaltyCard.tsx` · `src/components/ui/RouteErrorFallback.tsx` · `.maestro/smoke.yaml` · `.maestro/README.md` · `src/types/react-test-renderer.d.ts` · tests `refund`/`loyalty`/`idempotency`/`saleSubmit`/`errorBoundary`.

### 5. Facture PDF (`5cae7f4`)
- Backend `GET /api/sales/:id/invoice` → PDF binaire (auth JWT, tous rôles). `src/services/invoicePdf.ts` : `apiClient.get` **arraybuffer** (JWT via interceptor, timeout 20 s) → écrit en **cache temporaire** (`expo-file-system` `File`/`Paths`, nom horodaté) → **`expo-sharing`** `shareAsync` (partage natif). Helpers purs `invoiceEndpoint`/`invoiceCacheName` (testés).
- `src/components/sales/InvoiceButton.tsx` : bouton « 📄 Facture » réutilisable (loading « Génération… », toast erreur, i18n). Branché **fiche vente détail** + **RefundSheet**, **tous rôles**. `expo-sharing`/`expo-file-system` déjà installés.

### 6. Paiement mixte (`8b2105f`)
- Backend `POST /api/sales` accepte `cashAmount`/`mobileMoneyAmount`/`cardAmount` avec **`paymentMode='mixed'`** (≥2 seaux non nuls, somme = total ±1 ; `resolvePaymentSplit`). Mobile = UI + payload.
- `src/lib/paymentSplit.ts` (PUR) : `buildMixedSplit`/`isMixedValid`, `SPLIT_METHODS` cash/mobile/card → seaux `cashAmount`/`mobileMoneyAmount`/`cardAmount`. **Ligne 2 = reste calculé en XOF → somme EXACTE = total** (zéro dérive d'arrondi).
- `POSConfirmModal` : toggle « Paiement mixte » sous le total ; 2 lignes (picker méthode + montant ligne 1 clavier num ; ligne 2 méthode ≠ + **reste auto read-only grisé**). Valider disabled tant que invalide (2 méthodes ≠, `0 < montant1 < total`). Montant saisi en **devise d'affichage** → `toXOF` ; total/reste en **XOF base**.
- `confirmSale(override?)` injecte `paymentMode='mixed'` + le split (online **et** file offline). Garde-espèces ne s'applique qu'au **cash simple**.
- ⚠️ **Limite connue** : le **ticket WhatsApp/PDF** affiche encore le mode du panier (pas « mixte ») — le backend stocke la ventilation (source de vérité). À affiner si besoin.
- Nouveaux fichiers : `src/services/invoicePdf.ts` · `src/components/sales/InvoiceButton.tsx` · `src/lib/paymentSplit.ts` + tests `invoicePdf`/`paymentSplit`. **110 tests verts**.

### À valider sur device (cette session)
- Remboursement (rôle masqué caissier, 409, restock), feedback « +N pts » avec **taux custom** (ex. 500), seuils/devise de la carte fidélité, **boundaries** (un écran planté n'emporte pas la nav), **timeout→file** (réseau lent ⇒ « vente enregistrée, synchro en attente », zéro doublon au retour réseau), **smoke Maestro** bout en bout.
