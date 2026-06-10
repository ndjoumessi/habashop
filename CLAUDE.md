@AGENTS.md

# CLAUDE.md — HabaShop Mobile

> Guide Claude Code. Lis-moi **en premier**. CDC produit : `../habashop/MOBILE_APP_CDC.md` · Repo web (backend partagé) : `../habashop/CLAUDE.md`.
> Historique détaillé : `git log`. Détails device/dette : voir **mémoires** (`runtime-verification-debt`, `fabric-newarch-pos-crash`, `barcode-scanner-android-unreliable`, `tablet-ios-prep-deferred`).

App mobile React Native (iOS + Android), écosystème HabaShop SaaS (gestion commerciale, Afrique francophone) — surtout **caisse POS** + stock + dashboard + clients. **Consomme l'API backend existante** (même Railway que le web, JWT multi-tenant).
- **GitHub :** https://github.com/ndjoumessi/habashop-mobile · **Backend :** https://habashop-production.up.railway.app (= `../habashop/apps/backend`) · **Env :** `EXPO_PUBLIC_API_URL` dans `.env`

---

## Stack technique
| Outil | Version | Notes |
|-------|---------|-------|
| Expo SDK | **~54.0.0** | ⚠️ PAS 56 — compat Expo Go Android |
| React Native | 0.81.5 | New Arch / Fabric **ON** (≠ `newArchEnabled:false` → casse le build, reanimated 4 l'exige) |
| React | 19.1.0 | |
| Expo Router | ~6.0.23 | File-based (`app/`, typed routes) |
| Zustand | ^5.0.13 | State (`src/stores/`) + persist AsyncStorage |
| TanStack Query | ^5.100.14 | Data fetching / cache |
| axios | ^1.16.1 | `src/services/api.ts` |
| AsyncStorage | 2.2.0 | Persist lang/currency + cache FX |
| expo-secure-store | ~15.0.8 | JWT |
| expo-camera | ~17.0.10 | Scan EAN13 + QR (`CameraView`) |
| expo-updates | ~29.0.17 | OTA |
| expo-dev-client | ~6.0.21 | Dev builds |
| @react-native-community/netinfo | 11.4.1 | Offline |
| expo-file-system | ~19.0.22 | CSV/PDF — **nouvelle API `File`/`Paths`** |
| expo-sharing | ~14.0.8 | Partage |
| expo-local-authentication | ~17.0.8 | Biométrie |
| expo-image-picker / -manipulator | ~17 / ~14 | Photo profil 200×200 |
| expo-background-task | ~1.0.10 | Refresh widget (remplace background-fetch déprécié ; `minimumInterval` en **minutes**) |
| expo-print | (installé) | Reçu/facture/carte PDF — **dispo Expo Go** |
| qrcode | (pur JS) | QR carte fidélité — voir **Carte fidélité (QR)** |
| @sentry/react-native | ~7.2.0 | Crash reporter (import dynamique) |

> Lire les **docs versionnées** https://docs.expo.dev/versions/v54.0.0/ avant de coder.

---

## ⚠️ Pièges critiques build/env
1. **Node 20 OBLIGATOIRE** — `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` dans **chaque** commande (Node système v10 casse les builds).
2. **SDK 54 — NE PAS upgrader vers 56.** Si fait par erreur : `npm install expo@~54.0.0 && npx expo install --fix`.
3. **Chemins à parenthèses (groupes Expo Router) en zsh** : toujours **quoter** → `cat "app/(app)/(tabs)/dashboard.tsx"`. (Un glob non-matché type `*.config.ts` fait échouer tout le compound command.)
4. **EAS auth = partagée via disque** (`~/.expo/state.json`). `eas whoami` → `ndjoumessi` fonctionne depuis les shells de Claude → `eas env:*` / `eas build` / `eas update` **lançables par Claude**. (`export`/`EXPO_TOKEN` ne s'héritent pas, mais inutile.)
5. **Écran noir en build (résolu `f95133f`)** : route `/` manquante (sitemap auto masquait en dev, retirée en build). **NE PAS supprimer `app/index.tsx`** (`<Redirect>` selon auth).
6. **`expo-barcode-scanner` supprimé depuis SDK 52** → utiliser **`expo-camera`**.
7. **Push distant = dev build ou production seulement** (pas Expo Go depuis SDK 53).
8. **Crash Fabric `addViewAt`/`addView "child already has a parent"`** (release-only, devices entrée de gamme) : empiler plusieurs `<Modal>` au montage fait planter la réconciliation. **Parade = modales montées À LA DEMANDE** (`{open && <Modal/>}`), jamais toutes montées `visible={false}`. Un boundary JS **ne rattrape PAS** un crash natif. Corrigé `d949c78` (overlays on-demand). Cf. `fabric-newarch-pos-crash`.

---

## Règle backend
**Ne PAS réécrire le backend.** API Railway consommée telle quelle (2 ajouts mobile faits/déployés : table `PushToken` + `POST /api/notifications/token`). **Toute migration DB future = PROD Railway → confirmer avec Nelson AVANT.** ⚠️ Toujours vérifier la **forme réelle** de l'API avant de coder (la doc/CDC peut diverger).

---

## Compte Expo / EAS / versions
- **Compte :** `ndjoumessi` (romel.djoumessi@gmail.com) · **Project ID :** `e7399d7a-e5ba-4e30-a333-8cff7ad10eb4` (`app.json` → `expo.extra.eas.projectId`) · **Keystore Android :** `sH_oz3rpgx` (auto, sur EAS).
- **Versioning :** `appVersionSource: remote` → `versionCode` Android **géré par EAS** (celui d'`app.json` ignoré ; profil `preview` sans `autoIncrement` → resté à **3**). `runtimeVersion.policy = appVersion` → **bump version = change runtime** : un OTA ne touche que les builds du **même runtime** ; nouveau build natif sinon.
- **Version courante : 1.4.2** (runtime **1.4.2**). Label Réglages lit `Constants.expoConfig?.version` (`dace38c` — avant : « 1.2.0 » hardcodé trompeur).
- **Play Store :** AAB v1.2.0 (build `1f6bf56f`), feature graphic `assets/feature_graphic.png` (1024×500). Politique de confidentialité = page web **`/privacy`** (https://habashop.vercel.app/privacy). Fiche : `PLAY_STORE.md`. iOS build réel = compte Apple Developer (`IOS_BUILD.md`).

---

## Commandes
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/nelson/Documents/Projets/habashop-mobile

lsof -ti tcp:8081 | xargs kill 2>/dev/null   # libère le port
npx expo start --clear        # Expo Go SDK 54
npx expo start --dev-client   # dev build
npx tsc --noEmit              # 0 erreur (0 `any` dans app/+src/) — rituel avant commit
npm test                      # jest-expo (131 tests) doivent passer
npx expo-doctor               # objectif 18/18

# EAS (profils eas.json : development=APK dev-client, preview=APK test, production=AAB Play)
eas build --platform android --profile preview      # APK
eas build --platform android --profile production    # AAB
eas update --branch preview --message "…"            # OTA (même runtime)
eas build:list --limit 3

git add . && git commit -m "feat/fix: …" && git push origin main   # commit direct sur main
```
**Nommer l'APK** (aucun champ eas.json ne renomme l'artefact — EAS sert une URL hashée) → renommer au download :
```bash
URL=$(eas build:list --platform android --limit 1 --json --non-interactive \
  | python3 -c 'import sys,json; a=json.load(sys.stdin)[0]["artifacts"]; print(a.get("applicationArchiveUrl") or a.get("buildUrl") or "")')
curl -fL -o HabaShop-Mobile.apk "$URL"   # *.apk/*.aab gitignorés ; adb install -r pour poser
```

---

## Structure
```
app/                       # Expo Router
  _layout.tsx              # root : fonts, QueryClient, restoreSession, <OfflineSyncBridge/>, widget, ErrorBoundary
  index.tsx                # '/' → Redirect (⚠️ ne pas supprimer, fix écran noir)
  (auth)/login.tsx         # login + biométrie
  (app)/(tabs)/…           # dashboard|stock|customers|settings|pos-tab
  (app)/pos/index.tsx      # caisse (scanner, offline, ticket, mixte, fidélité)
  (app)/reports|sales|search|kiosk/index.tsx
src/
  constants/theme.ts       # Colors (sombre figé) + DarkColors/LightColors/ThemeColors + Spacing/BorderRadius/FontSize/Shadow + withAlpha()
  stores/                  # authStore · appStore (useI18n/useFmt/useTheme + theme/kioskMode + persist) · posStore
  hooks/                   # useNetworkStatus · useOfflineSync · useProfilePhoto · useResponsive (⚠️ PRÊT mais PAS branché, ≠ code mort)
  services/                # api · exchangeRate · notifications · offlineQueue · whatsappTicket · printReceipt · invoicePdf · biometric · widgetNotification · saleSubmit
  lib/                     # logger · barcode · customerQr · refund · idempotency · paymentSplit · loyalty · prefs
  components/ui/ · pos/ · customers/ · sales/
  types/index.ts           # Product, Customer, User, Tenant, Sale*, DashboardStats, PriceTier, LoyaltyCardData…
```
Alias TS : `@/*` → `src/*`.

---

## i18n (fr / en / es / it)
```typescript
const { i, lang } = useI18n()         // depuis @/stores/appStore (PAS useAppStore — il n'expose pas i)
const { fmt, currency } = useFmt()
i('Bonjour','Hello','Hola','Ciao')    // 4 langues, JAMAIS de binaire fr/en, JAMAIS de texte hardcodé en JSX
fmt(1000)                              // XOF→"1 000 FCFA" · EUR→"1,52 €" · USD→"$1.64" (taux open.er-api.com, cache 6h, fallback)
```
**Règles :** montants DB en **XOF**, conversion **à l'affichage seulement** (toujours `fmt()`). XOF/XAF = `FCFA` (sans décimales). **Ne pas traduire** : marques (HabaShop, Wave, Orange Money, MTN), codes devises, enums API, pays.
⚠️ Tout montant **tapé** par l'utilisateur est en devise d'affichage → **`convertToXOF`** avant de comparer aux totaux (en XOF base). Graphiques = **barres CSS** natives (pas Victory) ; libellés de jours **en dur** (Hermes ignore `toLocaleDateString` options — cf. `INTL_OK`).

---

## Endpoints API réels (vérifiés)
| Endpoint | Méthode | Forme |
|----------|---------|-------|
| `/api/auth/login` | POST | `{ token, user, tenant }` (tenant complet) |
| `/api/auth/me` | GET | ⚠️ objet **À PLAT** `{ id, name, email, role, shopName, currency }` — PAS `{user,tenant}`. `restoreSession` reconstruit `user` depuis ces champs + `GET /api/tenant`. |
| `/api/tenant` | GET | tenant complet (currency, **vatRate, posVatIncluded, priceMode**, plan, lang, **enableLoyalty, bronze/silver/goldThreshold+Discount**…) |
| `/api/products` | GET | tableau **plat** `[{ id, name, sellPrice, emoji, stockQty, stockMin, category, isActive, barcode, priceTiers?, hasPromotion?, promotionPrice? }]` (champ `ean` **n'existe pas**) |
| `/api/products/:id` | **PUT** | ⚠️ PUT, pas PATCH |
| `/api/sales` | POST | `{ items:[{ productId, qty, price }], total, paymentMode, discount?, customerId?, cashAmount?/mobileMoneyAmount?/cardAmount? (mixed), idempotencyKey }` — ⚠️ `qty` pas `quantity` ; **idempotent** sur la clé |
| `/api/sales` | GET | `?limit=N` → `[{ id, total, paymentMode, discountAmount, loyaltyDiscount, createdAt, items }]` (filtrage date **côté client**) |
| `/api/sales/:id/refund` | POST | `{ reason, restock }` — 409 si déjà remboursée |
| `/api/sales/:id/invoice` | GET | PDF binaire (arraybuffer, tous rôles) |
| `/api/customers` | GET | `[{ id, name, phone, email, type, loyaltyPoints, totalRevenue }]` |
| `/api/customers/:id/loyalty` | GET | solde + palier **canonique** + historique + remises |
| `/api/customers/:id/loyalty-card` | GET | `LoyaltyCardData` (scope tenant strict) |
| `/api/dashboard/stats` | GET | data **plate** (PAS `/api/analytics/dashboard` → 404 ; pas `data.stats`) |
| `/api/notifications/token` | POST | upsert idempotent |

---

## Design system + thème
```typescript
Colors.primary '#6C47FF' · accent '#FF9500' · accent2 '#00D084' · accent3 '#00B8FF'
Colors.danger '#FF3B5C' · warn '#FFB800' · bg '#07070F' · card '#0F0F1E'
Colors.text '#F0F0FF' · text2 '#A0A0C0' · text3 '#606080'
```
**Règles :** styles via **`const s = useMemo(() => makeStyles(C), [C])`** (C = palette via `useTheme()`), jamais `StyleSheet` inline ni `Colors.` en direct ni hex hardcodé. Fonts `Outfit_700Bold` (titres) / `JetBrainsMono` (chiffres).
- `ThemeColors = { [K in keyof typeof DarkColors]: string }` (**pas** `typeof DarkColors` : les littéraux `as const` cassent la compat LightColors).
- `userInterfaceStyle:"automatic"` (`app.json`) **obligatoire** pour le mode Système ; `StatusBar` dynamique (`isDark?'light':'dark'`).
- `useTheme()`/`useMemo` **avant** tout `return` conditionnel (règle des hooks).
- `Colors` statiques **volontaires** dans `kiosk/index.tsx` (caissier sombre figé) et `widgetNotification.ts` (marque).

---

## Patterns transverses (à respecter)
- **Auth :** `restoreSession` reconstruit `user` depuis `/api/auth/me` plat + `GET /api/tenant` (sinon user/tenant `undefined` + boucle refetch).
- **Logger :** `src/lib/logger.ts` DEV-gated (`__DEV__`) — jamais `console.*` direct. `catch {}` vides comblés en `logger.warn` (les `catch{return false/[]}` à fallback restent).
- **OfflineSyncBridge :** `useOfflineSync()` appelle `useQueryClient()` → encapsulé dans `<OfflineSyncBridge/>` **sous** `QueryClientProvider` (pas dans `RootLayout` direct).
- **expo-file-system v19 :** API legacy partie sous `/legacy`. Nouvelle API → `new File(Paths.cache, name); file.create(); file.write(x)` puis `Sharing.shareAsync(file.uri)`.
- **Error Boundary :** racine (classe au-dessus du router) + **par route** (`export { default as ErrorBoundary } from RouteErrorFallback` sur `(tabs)/_layout`, `pos/index`, `kiosk/index`). Le fallback est une **fonction** (hooks i18n/theme) rendue par la classe.
- **Modales :** alerte/print déclenchés après fermeture d'une Modal doivent être **différés ~350 ms** (`ALERT_AFTER_MODAL_MS`) sinon avalés pendant le teardown.
- **Persistance prefs :** store persisté clé **`habashop-settings`** (`partialize` lang/currency/**currencyManuallySet**/theme…). Tout code appliquant une **valeur par défaut au boot** (ex. devise tenant) doit d'abord **`await whenAppStoreHydrated()`** sinon il lit l'état initial et écrase le choix manuel. Règle pure `shouldApplyTenantCurrency` (tenant appliqué **seulement** si pas de choix manuel). `formatInCurrency` (web) ≠ conversion FX ; côté mobile `fmt()` convertit depuis XOF.

---

## POS / Caisse
- **Prix ligne :** `posStore.resolveLinePrice` = **miroir exact** du backend (`promo > palier minQty≤qty le + haut > base`), recalculé à chaque qty. `item.price` = prix effectif → total écran = ticket = backend.
- **Garde espèces :** mode cash → encaissement bloqué si `convertToXOF(cashGiven) < total` (bouton désactivé + filet dans `confirmSale`).
- **TVA :** `vatBreakdown(total, tenant.vatRate)` = prix **TTC** (`HT=total/(1+t)`, `tva=total−HT`). ⚠️ mode **HT** (`posVatIncluded:false`) **non géré**.
- **Anti sur-vente :** `capToStock` plafonne qty au `stockQty` dans `addItem`/`updateQty` (tous chemins, dont kiosque) ; bouton `+` désactivé au max.
- **Remise %** : champ 0–100 → `discount`.
- **Paiement mixte (`paymentSplit.ts`) :** toggle dans `POSConfirmModal` ; 2 méthodes ≠ ; ligne 1 saisie (devise→XOF), **ligne 2 = reste auto XOF** (somme exacte = total). `paymentMode='mixed'` **jamais écrit dans posStore** → lu depuis le **payload envoyé** (`variables` de la mutation) en `onSuccess`. Historique : split lu depuis `SaleRecord`.
- **Reçu :** `whatsappTicket.ts` (`TicketOptions`, `mixedSplitParts()`) + `printReceipt.ts` (expo-print, HTML échappé) partagés POS/historique. Annulation print = normale → log, pas d'alerte.
- **Ventes résilientes (`saleSubmit.ts`) :** `idempotency.ts` = **1 clé/tentative, jamais régénérée** (retry online + resync offline → même clé, backend dédup). Online → `submitSaleResilient` : timeout/5xx → retry court (`isRetryableApiError`) → échec persistant **bascule file offline**. 4xx propagé. Hors-ligne dur → file directe. `useOfflineSync` reflush **30 s**.
- **Offline :** `offlineQueue.ts` = file `{id,type:'SALE'|'STOCK_MOVE',payload,createdAt,synced}` (AsyncStorage), rejouée au retour réseau.

---

## Fidélité (`lib/loyalty.ts`)
- **Calcul = 100 % SERVEUR** (créditage points + remise auto palier, plafond **50 %**). Mobile = **affichage seul**, ne recalcule jamais la règle.
- Config **par tenant** : `pointsPerAmount` / `bronzeThreshold` (= **entrée Silver**) / `silverThreshold` (= **entrée Gold**) ; défauts v1 `1000/2000/5000`. Remises v2 `bronze/silver/goldDiscount` (0 = non configuré). Source : `/loyalty` (le + frais) → store tenant → défauts.
- **Feedback post-vente :** relit `GET /api/customers/:id/loyalty` et affiche le **DELTA réel** (après−avant), jamais un calcul local.
- `discountForTierDisplay(tier,…)` (affichage), `tierForPoints`, `nextTierFor`, `progressToNext`. POSCart : chip client « Nom · Palier · −X% » + badge « ⭐ Remise fidélité X% » (si client lié + `enableLoyalty` + remise>0).
- **Remboursement (`refund.ts`) :** `RefundSheet` **on-demand**. Rôles **MANAGER/ADMIN/SUPER_ADMIN** (`canRefundRole` normalise la casse), motif **obligatoire**, restock pré-coché, 409 géré. Bouton « Rembourser » **inline par ligne** d'historique (comme le web), pas seulement en détail.
- **Facture PDF (`invoicePdf.ts`) :** `apiClient.get` arraybuffer → cache `File`/`Paths` → `Sharing.shareAsync`. Bouton « 📄 Facture » tous rôles.

---

## Carte fidélité numérique (QR) — `LoyaltyCardDigital.tsx`
- **OTA-safe, AUCUNE dep native.** ⚠️ NE PAS réintroduire `react-native-svg`/`-qrcode-svg`/`-view-shot` (module natif absent → export OTA cassé) sans nouveau build EAS.
- **QR : `QRCode.create()` (pur JS, sans canvas) → matrice → grille de `<View>`.** ⚠️ **NE JAMAIS** `QRCode.toDataURL()`/`<Image>` base64 sous Hermes : `toDataURL` résout (champ `browser` de Metro) vers `CanvasRenderer` → `document.createElement('canvas')` **inexistant** → rejette `'You need to specify a canvas element'` → QR vide. Pour le **PDF**, **SVG inline** construit de la même matrice (rendu par le webview expo-print). Fallback texte monospace si `create()` échoue.
- Design = web : 2 zones par palier (haute sombre `dark/mid/accent` Bronze `#1C1007/#3D2010/#F5A623`, Silver/Gold déclinés ; badge pill + nom + code + points + QR cadre blanc 64×64 ; basse fond thème : progression + stats 2 colonnes + bouton Partager). Montée **on-demand**. ⚠️ ces couleurs viennent du prompt, PAS du web actuel.
- **Scan QR carte au POS (`customerQr.ts`) :** le QR encode **`HABA-<8 1ers car. de l'id, MAJ>`** (préfixe, **pas** l'id complet) → résolution par **`matchCustomerByCode`** contre la liste clients chargée (cache `['customers']` = `GET /api/customers`), pas un `GET /:id`. `BarcodeScanner` prop `mode:'customer'` → `barcodeTypes:['qr']` + trim (≠ `normalizeBarcode`). `CustomerPicker` prop `onScanCard` → bouton « Scanner la carte fidélité ». Carte non reconnue → alerte dédiée.

---

## Scanner code-barres (`BarcodeScanner.tsx` + `lib/barcode.ts`)
- Mode produit : `barcodeTypes:['ean13','ean8','code128']` (qr/code39/upc retirés — parasites). `normalizeBarcode` strip espaces + **zéros de tête** (`^0+`) des **deux côtés** ; ignore un scan vide.
- **Filtre de stabilité** (Android lent erratique) : code accepté seulement **lu 2× d'affilée à l'identique** (`lastCandidate`) + cooldown **1.5 s**. ⚠️ pas de `regionOfInterest` en SDK 54. Si même le bon code ne se répète jamais 2× → **vote majoritaire 2/3**. Cf. `barcode-scanner-android-unreliable`. Caisse = **scan seul** (recherche/saisie manuelle retirées).

---

## Divers (rappels)
- **Biométrie (`biometric.ts`) :** `disableDeviceFallback:true` (pas de bouton PIN natif) ; identifiants chiffrés SecureStore ; `useRef` anti-double-trigger ; login masque le mot de passe si activée ; **`setAuth` différé** pour montrer la modale d'activation avant redirection.
- **Photo profil :** locale (URI AsyncStorage, **pas** uploadée), 200×200 JPEG ; `mediaTypes:['images']`.
- **Widget CA :** **notification persistante** (`sticky:true`+`autoDismiss:false` ; ⚠️ pas de `ongoing`/`content.android` dans l'API) ; canal LOW ; opt-in ; refresh background-task → **dev build** (pas Expo Go).
- **Recherche globale :** produits + clients, debounce **300 ms**, max 20 ; param `.map()` nommé `term` (pas `s`, masquerait le `StyleSheet s`).
- **Kiosque :** PIN sortie **`1234`** (appui **LONG** ⚙️, `delayLongPress=600`) ; `kioskMode` persisté ; route `fullScreenModal` + fade ; réutilise la **logique** posStore + `CustomerPicker` (pas le Modal `POSCart`).
- **WhatsApp iOS :** `LSApplicationQueriesSchemes:["whatsapp"]` dans `ios.infoPlist` (déjà posé) sinon `canOpenURL` false (Android OK sans rien).
- **Sentry (`crashReporter.ts`) :** import **dynamique** (jamais évalué en Expo Go) + garde `executionEnvironment !== StoreClient` + DSN `EXPO_PUBLIC_SENTRY_DSN` → inerte sans DSN. Projet `haba-76/react-native` **EU** (`https://de.sentry.io/`). DSN + `SENTRY_AUTH_TOKEN` en **`.env` (gitignored) + EAS env vars** (preview+production). Source maps : plugin `@sentry/react-native/expo` + metro `getSentryExpoConfig` ; ⚠️ `@expo/config-plugins` doit être **dépendance directe** (`~54.0.4`) sinon prebuild échoue. **Web sans Sentry** (angle mort).
- **iOS/tablette (Sprint 5, infra seule) :** `useResponsive` prêt (non branché) ; `ios.supportsTablet:true` + infoPlist (Camera/Photo/FaceID/WhatsApp). **Reflows tablette DIFFÉRÉS jusqu'à un iPad** (Dashboard/POS/tab bar ; `tabBarPosition:'left'` va dans `screenOptions`). Cf. `tablet-ios-prep-deferred`.
- **Notif push :** icône Android = silhouette blanche sur transparent (`assets/notification-icon.png`).

---

## État courant
- `main`, `tsc` 0, **131 tests verts**. Version **1.4.2** / runtime **1.4.2** ; dernières features diffusées en **OTA `preview`** (pas de nouveau build natif récent).
- **À valider sur device** (cf. `runtime-verification-debt`) : offline+resync, ticket WhatsApp, widget, TalkBack, smoke Maestro (`.maestro/smoke.yaml`, non lancé), scanner durci (Android lent), remboursement/fidélité v2/carte QR (scan + partage PDF), boundaries, timeout→file.
- **Reste / différé :** publier Play Store (AAB prêt, captures à faire) ; layouts tablette (iPad) ; build iOS réel (compte Apple) ; push réelles (token EAS, dev build) ; Wave/Orange prod ; fidélité créditée backend (hors repo).
