@AGENTS.md

# CLAUDE.md — HabaShop Mobile

> Guide Claude Code. Lis-moi **en premier**. CDC produit : `../habashop/MOBILE_APP_CDC.md` · Repo web (backend partagé) : `../habashop/CLAUDE.md`.

App mobile React Native (iOS + Android), caisse POS + stock + dashboard + clients. **Consomme l'API Railway** (même backend que le web, JWT multi-tenant).
- **GitHub :** https://github.com/ndjoumessi/habashop-mobile · **Backend :** https://habashop-production.up.railway.app · **Env :** `EXPO_PUBLIC_API_URL` dans `.env`

---

## Stack technique
| Outil | Version | Notes |
|-------|---------|-------|
| Expo SDK | **~54.0.0** | ⚠️ PAS 56 — compat Expo Go Android |
| React Native | 0.81.5 | New Arch / Fabric **ON** (reanimated 4 l'exige) |
| Expo Router | ~6.0.23 | File-based (`app/`, typed routes) |
| Zustand | ^5.0.13 | `src/stores/` + persist AsyncStorage |
| TanStack Query | ^5.100.14 | Data fetching / cache |
| axios | ^1.16.1 | `src/services/api.ts` |
| expo-secure-store | ~15.0.8 | JWT + token push |
| expo-camera | ~17.0.10 | Scan EAN13 + QR (`CameraView`) |
| expo-updates | ~29.0.17 | OTA |
| expo-notifications | ~0.29.14 | Push (dev build / production uniquement) |
| expo-background-task | ~1.0.10 | Refresh widget (`minimumInterval` en **minutes**) |
| expo-file-system | ~19.0.22 | CSV/PDF — **nouvelle API `File`/`Paths`** |
| @sentry/react-native | ~7.2.0 | Crash reporter (import dynamique) |

> Lire les **docs versionnées** https://docs.expo.dev/versions/v54.0.0/ avant de coder.

---

## ⚠️ Pièges critiques build/env
1. **Node 20 OBLIGATOIRE** — `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` dans chaque commande.
2. **SDK 54 — NE PAS upgrader vers 56.** Si fait par erreur : `npm install expo@~54.0.0 && npx expo install --fix`.
3. **Chemins à parenthèses en zsh** : toujours quoter → `cat "app/(app)/(tabs)/dashboard.tsx"`.
4. **EAS auth = partagée via disque** (`~/.expo/state.json`). `eas whoami` → `ndjoumessi`. `eas env/build/update` lançables par Claude.
5. **⚠️ Ne pas supprimer `app/index.tsx`** (`<Redirect>` selon auth — fix écran noir build, `f95133f`).
6. **`expo-barcode-scanner` supprimé SDK 52** → utiliser **`expo-camera`**.
7. **Push distant = dev build ou production build seulement** (pas Expo Go depuis SDK 53).
8. **Crash Fabric `addViewAt`** (release, devices entrée de gamme) : plusieurs `<Modal>` montés → plante. **Parade = modales on-demand** (`{open && <Modal/>}`). Corrigé `d949c78`.

---

## Règle backend
**Ne PAS réécrire le backend.** API Railway consommée telle quelle (3 ajouts mobile : table `PushToken` + `POST/DELETE /api/notifications/token`). **Toute migration DB = PROD Railway → confirmer avant.** Toujours vérifier la forme réelle de l'API (la doc peut diverger).

---

## Compte Expo / EAS / versions
- **Compte :** `ndjoumessi` · **Project ID :** `e7399d7a-e5ba-4e30-a333-8cff7ad10eb4` · **Keystore Android :** `sH_oz3rpgx` (auto EAS).
- **Versioning :** `appVersionSource: remote` → `versionCode` géré par EAS. `runtimeVersion.policy = appVersion` → **bump version = change runtime** (OTA ne touche que le même runtime ; sinon build natif).
- **Version courante : 1.4.3** / runtime **1.4.3**. Label Réglages lit `Constants.expoConfig?.version`.
- **Play Store :** AAB v1.2.0 (`1f6bf56f`), feature graphic `assets/feature_graphic.png` (1024×500). Politique confidentialité : `https://habashop.vercel.app/privacy`. iOS : `IOS_BUILD.md`.

---

## Commandes
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd /Users/nelson/Documents/Projets/habashop-mobile

lsof -ti tcp:8081 | xargs kill 2>/dev/null
npx expo start --clear        # Expo Go SDK 54
npx expo start --dev-client   # dev build
npx tsc --noEmit              # 0 erreur — rituel avant commit
npm test                      # jest-expo (141 tests)
npx expo-doctor               # objectif 18/18

# EAS (eas.json : development=APK dev-client, preview=APK test, production=AAB Play)
eas build --platform android --profile preview
eas build --platform android --profile production
eas update --branch preview --message "…"
eas update --branch production --message "…"
```
**Nommer l'APK** :
```bash
URL=$(eas build:list --platform android --limit 1 --json --non-interactive \
  | python3 -c 'import sys,json; a=json.load(sys.stdin)[0]["artifacts"]; print(a.get("applicationArchiveUrl") or a.get("buildUrl") or "")')
curl -fL -o HabaShop-Mobile.apk "$URL"
```

---

## Structure
```
app/
  _layout.tsx          # fonts, QueryClient, restoreSession, <OfflineSyncBridge/>, widget, ErrorBoundary
                       # tap notifs : low_stock→Stock, trial_expiring→Settings, payment/leave→Dashboard
  index.tsx            # '/' → Redirect (⚠️ ne pas supprimer)
  (auth)/login.tsx
  (app)/(tabs)/…       # dashboard|stock|customers|settings|pos-tab
  (app)/pos/index.tsx  # caisse (scanner, offline, ticket, mixte, fidélité)
  (app)/reports|sales|search|kiosk/index.tsx
src/
  constants/theme.ts   # Colors + DarkColors/LightColors/ThemeColors + Spacing/BorderRadius/FontSize/Shadow
  stores/              # authStore · appStore (useI18n/useFmt/useTheme + persist) · posStore
  hooks/               # useNetworkStatus · useOfflineSync · useProfilePhoto · useSupplierOcr
                       # useResponsive (⚠️ PRÊT mais PAS branché — ≠ code mort)
  services/            # api · notifications · offlineQueue · saleSubmit · whatsappTicket
                       # printReceipt · invoicePdf · biometric · widgetNotification · exchangeRate
  lib/                 # logger · barcode · customerQr · refund · idempotency · paymentSplit · loyalty · prefs
  components/ui/ · pos/ · customers/ · suppliers/ · sales/
  types/index.ts
```
Alias TS : `@/*` → `src/*`.

---

## i18n (fr / en / es / it)
```typescript
const { i, lang } = useI18n()    // depuis @/stores/appStore (PAS useAppStore)
const { fmt, currency } = useFmt()
i('Bonjour','Hello','Hola','Ciao')   // 4 langues, JAMAIS binaire fr/en, JAMAIS texte JSX hardcodé
fmt(1000)                             // XOF→"1 000 FCFA" · EUR→"1,52 €" (taux open.er-api.com, cache 6h)
```
Montants DB en **XOF**, `fmt()` à l'affichage. Montant saisi en devise affichage → **`convertToXOF`** avant comparaison. Graphiques = barres CSS natives (pas Victory) ; jours **en dur** (Hermes ignore `toLocaleDateString`).

---

## Endpoints API (vérifiés)
| Endpoint | Méthode | Forme |
|----------|---------|-------|
| `/api/auth/login` | POST | `{ token, user, tenant }` |
| `/api/auth/me` | GET | ⚠️ objet **À PLAT** `{ id, name, email, role, shopName, currency }` — PAS `{user,tenant}` |
| `/api/tenant` | GET | tenant complet (currency, vatRate, posVatIncluded, priceMode, plan, lang, enableLoyalty…) |
| `/api/products` | GET | tableau plat `[{ id, name, sellPrice, emoji, stockQty, stockMin, category, barcode, priceTiers?, hasPromotion?, promotionPrice? }]` — champ `ean` n'existe PAS |
| `/api/products/:id` | **PUT** | ⚠️ PUT pas PATCH |
| `/api/sales` | POST | `{ items:[{productId,qty,price}], total, paymentMode, discount?, customerId?, cashAmount?/mobileMoneyAmount?/cardAmount?, idempotencyKey }` — `qty` pas `quantity` |
| `/api/sales` | GET | `?limit=N` → `[{id,total,paymentMode,discountAmount,loyaltyDiscount,createdAt,items}]` |
| `/api/sales/:id/refund` | POST | `{ reason, restock }` — 409 si déjà remboursée |
| `/api/sales/:id/invoice` | GET | PDF binaire (arraybuffer) |
| `/api/customers` | GET | `[{ id, name, phone, email, type, loyaltyPoints, totalRevenue }]` |
| `/api/customers/:id/loyalty` | GET | solde + palier + historique + remises |
| `/api/customers/:id/loyalty-card` | GET | `LoyaltyCardData` |
| `/api/suppliers/scan-invoice` | POST | ⚠️ multipart champ **`invoice`**, rôle MANAGER+, 503 si ANTHROPIC_API_KEY absente, 413 > 10 Mo |
| `/api/dashboard/stats` | GET | data plate (PAS `/api/analytics/dashboard` → 404) |
| `/api/notifications/token` | POST | upsert push token (idempotent) |
| `/api/notifications/token` | DELETE | désenregistre `{ token }` — appelé au logout |

---

## Design system + thème
```typescript
Colors.primary '#6C47FF' · accent '#FF9500' · accent2 '#00D084' · accent3 '#00B8FF'
Colors.danger '#FF3B5C' · warn '#FFB800' · bg '#07070F' · card '#0F0F1E'
Colors.text '#F0F0FF' · text2 '#A0A0C0' · text3 '#606080'
```
Styles via **`const s = useMemo(() => makeStyles(C), [C])`** (C = `useTheme()`). Fonts `Outfit_700Bold` / `JetBrainsMono`. `ThemeColors = { [K in keyof typeof DarkColors]: string }` (pas `typeof DarkColors` — les `as const` cassent LightColors). `userInterfaceStyle:"automatic"` obligatoire. `useTheme()`/`useMemo` **avant** tout `return` conditionnel. `Colors` statiques : kiosk + widgetNotification seulement.

---

## Patterns transverses
- **Auth :** `restoreSession` = `/api/auth/me` plat + `GET /api/tenant` → reconstruit `user`/`tenant` (sinon boucle refetch).
- **Logger :** `src/lib/logger.ts` DEV-gated — jamais `console.*` direct.
- **Offline :** `<OfflineSyncBridge/>` sous `QueryClientProvider`. File `offlineQueue.ts` (AsyncStorage, `SALE|STOCK_MOVE`) → reflush 30 s au retour réseau.
- **expo-file-system v19 :** `new File(Paths.cache, name); file.create(); file.write(x)` + `Sharing.shareAsync(uri)`.
- **Error Boundary :** racine (classe) + par route (`(tabs)/_layout`, `pos/index`, `kiosk/index`). Fallback = fonction (hooks i18n/theme).
- **Modales :** alertes/print après fermeture → différer **~350 ms** (`ALERT_AFTER_MODAL_MS`).
- **Persistance :** store `habashop-settings` (`partialize` lang/currency/currencyManuallySet/theme). `await whenAppStoreHydrated()` avant appliquer défauts au boot. `shouldApplyTenantCurrency` = tenant appliqué seulement si pas de choix manuel.

---

## POS / Caisse
- **Prix ligne :** `posStore.resolveLinePrice` = miroir backend (`promo > palier > base`), recalculé à chaque qty.
- **Anti sur-vente :** `capToStock` plafonne qty au `stockQty` dans `addItem`/`updateQty` ; bouton `+` désactivé au max.
- **Paiement mixte (`paymentSplit.ts`) :** 2 méthodes ≠ ; ligne 1 saisie, **ligne 2 = reste auto XOF**. `paymentMode='mixed'` jamais dans posStore — lu depuis `variables` mutation en `onSuccess`.
- **Ventes résilientes (`saleSubmit.ts`) :** 1 clé idempotente/tentative jamais régénérée. Online : timeout/5xx → retry → bascule file offline. 4xx propagé. Offline dur → file directe. Reflush 30 s.
- **Reçu :** `whatsappTicket.ts` + `printReceipt.ts` (HTML échappé). Annulation print = normale.
- **TVA :** `vatBreakdown(total, vatRate)` = prix TTC. Mode HT (`posVatIncluded:false`) non géré.

---

## Push notifications
- **Token :** `registerForPushNotifications()` (`src/services/notifications.ts`) → Expo token stocké dans `SecureStore` (`push_token`) + `POST /api/notifications/token`.
- **Logout :** `authStore.logout` → `DELETE /api/notifications/token` **avant** de vider le JWT (fire-and-forget).
- **Tap handlers (`_layout.tsx`) :** `low_stock` → Stock ; `trial_expiring` → Settings ; `payment_received`/`leave_pending` → Dashboard.
- **Push serveur (`pushService.ts`) :** `sendStockAlert` (MANAGER+ADMIN), `sendPaymentReceived`/`sendLeavePending` (ADMIN), `sendTrialExpiring` (ADMIN, cron J-3), `sendStockAlertBatch` (cron 7h). Tous fire-and-forget, fail-silent.
- **Icône Android :** silhouette blanche sur transparent (`assets/notification-icon.png`).

---

## Fidélité (`lib/loyalty.ts`)
- **Calcul = 100 % serveur** (créditage + remise palier, plafond 50 %). Mobile = affichage seul.
- Config par tenant : `pointsPerAmount` / `bronze/silver/goldThreshold+Discount`. Source : `/loyalty` → store tenant → défauts.
- Feedback post-vente : `GET /api/customers/:id/loyalty` → DELTA réel (après−avant), jamais calcul local.
- POSCart : chip « Nom · Palier · −X% » + badge remise fidélité.
- **Remboursement (`refund.ts`) :** `RefundSheet` on-demand. Rôles MANAGER/ADMIN/SUPER_ADMIN, motif obligatoire, 409 géré. Bouton inline par ligne d'historique.
- **Facture PDF (`invoicePdf.ts`) :** arraybuffer → cache `File`/`Paths` → `Sharing.shareAsync`. Tous rôles.

---

## Carte fidélité QR (`LoyaltyCardDigital.tsx`)
- **OTA-safe, zéro dep native.** ⚠️ NE PAS réintroduire `react-native-svg`/`-qrcode-svg`/`-view-shot` (natif absent → OTA cassé).
- **QR :** `QRCode.create()` pur JS → matrice → grille `<View>`. ⚠️ JAMAIS `QRCode.toDataURL()` sous Hermes (`CanvasRenderer` → `document.createElement('canvas')` inexistant → rejet). PDF : SVG inline depuis la même matrice (expo-print webview).
- **Format :** `HABA-CUST:<customerId>`. Ancien format `HABA-<id8 MAJ>` abandonné.
- **Scan POS (`customerQr.ts`) :** nouveau format → `GET /api/customers/:id` direct ; ancien → fallback `matchCustomerByCode`. `BarcodeScanner` mode `'customer'` → `barcodeTypes:['qr']`.

---

## OCR factures (`useSupplierOcr.ts` + `OcrInvoiceSheet.tsx`)
- Entrée : Réglages → **Outils** (MANAGER+ seulement). Aucun écran Fournisseurs/Commandes sur mobile.
- **Flux :** picker caméra/galerie → compression JPEG (`ImageManipulator`, qualité 0.7, ≤1920px) → POST multipart `/api/suppliers/scan-invoice` champ **`invoice`** (override `Content-Type`, timeout 60 s). Annulation picker = ni erreur ni loading.
- **`OcrInvoiceResult` :** `{ supplierName, invoiceDate, items[{name,qty,unitPrice}], total, notes, error? }`. PAS de HT/TVA/référence. `error:'parse_error'` → bannière partielle.
- **`OcrInvoiceSheet` :** on-demand (anti-Fabric), 4 états. Action = `Share.share` natif + Recommencer. Montants bruts → JAMAIS `fmt()`.

---

## Scanner code-barres (`BarcodeScanner.tsx`)
- Mode produit : `barcodeTypes:['ean13','ean8','code128']`. `normalizeBarcode` strip espaces + zéros de tête.
- **Filtre stabilité (Android) :** code accepté 2× d'affilée + cooldown 1.5 s. Fallback vote majoritaire 2/3. Cf. `barcode-scanner-android-unreliable`.

---

## Divers
- **Biométrie :** `disableDeviceFallback:true` ; identifiants SecureStore ; `useRef` anti-double-trigger ; `setAuth` différé (activation avant redirect).
- **Photo profil :** locale URI AsyncStorage (pas uploadée), 200×200 JPEG.
- **Widget CA :** notification persistante (`sticky:true`+`autoDismiss:false`), canal LOW, refresh background-task → dev build.
- **Recherche globale :** produits+clients, debounce 300 ms, max 20. Param `.map()` nommé `term`.
- **Kiosque :** PIN `1234` (appui LONG ⚙️, `delayLongPress=600`), `kioskMode` persisté, route `fullScreenModal`.
- **WhatsApp iOS :** `LSApplicationQueriesSchemes:["whatsapp"]` dans `ios.infoPlist` (déjà posé).
- **Sentry (`crashReporter.ts`) :** import dynamique + garde `executionEnvironment !== StoreClient`. `@expo/config-plugins` **dépendance directe** (`~54.0.4`) obligatoire sinon prebuild échoue.
- **iOS/tablette :** `useResponsive` prêt (non branché). Reflows différés jusqu'à un iPad. Cf. `tablet-ios-prep-deferred`.

---

## État courant
- `main`, `tsc` 0, **141 tests verts**. Version **1.4.3** / runtime **1.4.3** — push ÉTAPE 1+2 en OTA `preview`+`production`.
- **À valider sur device :** offline+resync, ticket WhatsApp, widget (dev build), TalkBack, Maestro smoke (`.maestro/smoke.yaml`), scanner Android, fidélité v2/carte QR, OCR facture MANAGER+.
- **Reste / différé :** publier Play Store (AAB prêt, captures à faire) ; layouts tablette (iPad) ; build iOS réel (compte Apple) ; Wave/Orange prod.
