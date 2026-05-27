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
| `/api/auth/login` | POST | `{ token, user, tenant }` |
| `/api/auth/me` | GET | `{ user, tenant }` |
| `/api/products` | GET | tableau **plat** `[{ id, name, sellPrice, emoji, stockQty, stockMin, category, isActive, barcode }]` |
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
- [ ] **Tester sur device le reste** : biométrie, offline+resync, widget, ticket WhatsApp, balayage clair écran par écran, TalkBack
- [ ] Publier sur Google Play Store (AAB `1f6bf56f` prêt ; captures à faire)
- [ ] **Layouts tablette** (Dashboard/POS/tab bar) — DIFFÉRÉS jusqu'à un iPad (`useResponsive` prêt ; cf. `tablet-ios-prep-deferred`)
- [ ] EAS Build iOS réel (compte Apple Developer requis — cf. `IOS_BUILD.md`)
- [ ] Notifications push réelles (token EAS, dev build)

---

*Dernière mise à jour : Sprint 5 — 2026-05-27 (prep iOS + responsive : useResponsive, config iOS app.json/eas.json, IOS_BUILD.md ; reflows tablette différés jusqu'à un iPad).*
