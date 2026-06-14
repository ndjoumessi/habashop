@AGENTS.md

# CLAUDE.md — HabaShop Mobile

> Guide Claude Code. CDC produit : `../habashop/MOBILE_APP_CDC.md` · Backend : `../habashop/CLAUDE.md`.

App mobile React Native (iOS + Android) — caisse POS, stock, dashboard, clients. API Railway, JWT multi-tenant.
- **GitHub :** https://github.com/ndjoumessi/habashop-mobile · **Backend :** https://habashop-production.up.railway.app · **Env :** `EXPO_PUBLIC_API_URL` dans `.env`

---

## Stack technique
| Outil | Version | Notes |
|-------|---------|-------|
| Expo SDK | **~54.0.0** | ⚠️ PAS 56 — compat Expo Go Android |
| React Native | 0.81.5 | New Arch / Fabric **ON** (reanimated 4 l'exige) |
| Expo Router | ~6.0.23 | `app/`, typed routes |
| Zustand | ^5.0.13 | `src/stores/` + persist AsyncStorage |
| TanStack Query | ^5.100.14 | + `react-query-persist-client` (cache offline) |
| axios | ^1.16.1 | `src/services/api.ts` |
| expo-secure-store | ~15.0.8 | JWT + token push |
| expo-camera | ~17.0.10 | Scan EAN13 + QR (`CameraView`) |
| expo-updates | ~29.0.17 | OTA |
| expo-notifications | ~0.29.14 | Push (dev/prod build seulement) |
| expo-file-system | ~19.0.22 | **nouvelle API `File`/`Paths`** |
| @sentry/react-native | ~7.2.0 | import dynamique |

> Lire les **docs versionnées** https://docs.expo.dev/versions/v54.0.0/ avant de coder.

---

## ⚠️ Pièges critiques
1. **Node 20 OBLIGATOIRE** — `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` dans chaque commande.
2. **SDK 54 — NE PAS upgrader vers 56.** Fix : `npm install expo@~54.0.0 && npx expo install --fix`.
3. **Chemins à parenthèses en zsh** : toujours quoter → `cat "app/(app)/(tabs)/dashboard.tsx"`.
4. **EAS auth via disque** (`~/.expo/state.json`). `eas whoami` → `ndjoumessi`. `eas env/build/update` lançables par Claude.
5. **⚠️ Ne pas supprimer `app/index.tsx`** (`<Redirect>` selon auth — fix écran noir build, `f95133f`).
6. **`expo-barcode-scanner` supprimé SDK 52** → utiliser **`expo-camera`**.
7. **Push = dev build ou production seulement** (pas Expo Go depuis SDK 53).
8. **Crash Fabric `addViewAt`** (release, Android entrée de gamme) : modales empilées → crash natif. **Parade = on-demand** (`{open && <Modal/>}`). Corrigé `d949c78`.

---

## Règle backend
**Ne PAS réécrire le backend.** API Railway telle quelle. **Toute migration DB = confirmer avant (→ PROD auto Railway).** Vérifier la forme réelle de l'API avant de coder (la doc peut diverger).

---

## Compte EAS / versions
- `ndjoumessi` · Project ID : `e7399d7a-e5ba-4e30-a333-8cff7ad10eb4` · Keystore Android : `sH_oz3rpgx`.
- `appVersionSource: remote` → versionCode géré EAS. `runtimeVersion.policy = appVersion` → **bump version = change runtime** (OTA = même runtime seulement ; sinon build natif requis).
- **Version courante : 1.4.3** / runtime **1.4.3**. Label Réglages : `Constants.expoConfig?.version`.
- Play Store : AAB v1.2.0 (`1f6bf56f`). `assets/feature_graphic.png` (1024×500). Politique : `https://habashop.vercel.app/privacy`. iOS : `IOS_BUILD.md`.

---

## Commandes
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
lsof -ti tcp:8081 | xargs kill 2>/dev/null
npx expo start --clear        # Expo Go SDK 54
npx expo start --dev-client
npx tsc --noEmit              # 0 erreur — rituel avant commit
npm test                      # jest-expo (141 tests)
npx expo-doctor               # objectif 18/18

eas build --platform android --profile preview      # APK
eas build --platform android --profile production    # AAB
eas update --branch preview --message "…"
eas update --branch production --message "…"
```
**Télécharger l'APK :**
```bash
URL=$(eas build:list --platform android --limit 1 --json --non-interactive \
  | python3 -c 'import sys,json; a=json.load(sys.stdin)[0]["artifacts"]; print(a.get("applicationArchiveUrl") or a.get("buildUrl") or "")')
curl -fL -o HabaShop-Mobile.apk "$URL"
```

---

## Structure
```
app/
  _layout.tsx         # fonts, QueryClient, restoreSession, <OfflineSyncBridge/>, widget, ErrorBoundary
                      # tap notifs : low_stock→Stock, trial_expiring→Settings, payment/leave→Dashboard
  index.tsx           # '/' → Redirect (⚠️ ne pas supprimer)
  (auth)/login.tsx
  (app)/(tabs)/…      # dashboard|stock|customers|settings|pos-tab
  (app)/pos/index.tsx # caisse (scanner, offline, ticket, mixte, fidélité)
  (app)/reports|sales|search|kiosk/index.tsx
src/
  constants/theme.ts
  stores/             # authStore · appStore (useI18n/useFmt/useTheme + persist) · posStore
  hooks/              # useNetworkStatus · useOfflineSync · useSupplierOcr
                      # useResponsive (PRÊT, pas branché — ≠ code mort)
  services/           # api · notifications · offlineQueue · saleSubmit · whatsappTicket
                      # printReceipt · invoicePdf · biometric · widgetNotification
  lib/                # logger · barcode · customerQr · refund · idempotency · paymentSplit · loyalty · prefs
  components/ui/ · pos/ · customers/ · suppliers/ · sales/
  types/index.ts
```
Alias TS : `@/*` → `src/*`.

---

## i18n (fr / en / es / it)
```typescript
const { i } = useI18n()            // depuis appStore (PAS useAppStore)
const { fmt } = useFmt()
i('Bonjour','Hello','Hola','Ciao') // 4 langues — JAMAIS binaire fr/en, JAMAIS texte JSX hardcodé
fmt(1000)                           // XOF→"1 000 FCFA" · EUR→"1,52 €" (taux cache 6h, fallback)
```
Montants DB en **XOF**, `fmt()` à l'affichage. Montant saisi → **`convertToXOF`** avant comparaison. Jours graphiques **en dur** (Hermes ignore `toLocaleDateString`).

---

## Endpoints API (vérifiés)
| Endpoint | M | Forme / piège |
|----------|---|---------------|
| `/api/auth/login` | POST | `{ token, user, tenant }` |
| `/api/auth/me` | GET | ⚠️ À PLAT `{ id, name, email, role, shopName, currency }` — PAS `{user,tenant}` |
| `/api/tenant` | GET | `{ currency, vatRate, posVatIncluded, priceMode, plan, lang, enableLoyalty… }` |
| `/api/products` | GET | `[{ id, name, sellPrice, emoji, stockQty, stockMin, barcode, priceTiers?, promotionPrice? }]` — `ean` n'existe PAS |
| `/api/products/:id` | **PUT** | ⚠️ PUT pas PATCH |
| `/api/sales` | POST | `{ items:[{productId,qty,price}], total, paymentMode, discount?, customerId?, idempotencyKey }` — `qty` pas `quantity` |
| `/api/sales` | GET | `?limit=N` → `[{id,total,paymentMode,discountAmount,createdAt,items}]` |
| `/api/sales/:id/refund` | POST | `{ reason, restock }` — 409 déjà remboursée |
| `/api/sales/:id/invoice` | GET | PDF arraybuffer (tous rôles) |
| `/api/customers` | GET | `[{ id, name, phone, loyaltyPoints, totalRevenue }]` |
| `/api/customers/:id/loyalty` | GET | solde + palier + historique + remises |
| `/api/customers/:id/loyalty-card` | GET | `LoyaltyCardData` |
| `/api/suppliers/scan-invoice` | POST | ⚠️ multipart champ **`invoice`**, MANAGER+, 503 si `ANTHROPIC_API_KEY` absente |
| `/api/dashboard/stats` | GET | ⚠️ PAS `/api/analytics/dashboard` → 404 |
| `/api/notifications/token` | POST | upsert push token |
| `/api/notifications/token` | DELETE | désenregistre `{ token }` au logout |

`restoreSession` = `/api/auth/me` plat + `GET /api/tenant` → reconstruit user/tenant (sinon boucle refetch).

---

## Design system
```
Colors.primary '#6C47FF' · accent '#FF9500' · accent2 '#00D084' · accent3 '#00B8FF'
Colors.danger '#FF3B5C' · warn '#FFB800' · bg '#07070F' · card '#0F0F1E'
Colors.text '#F0F0FF' · text2 '#A0A0C0' · text3 '#606080'
```
**`const s = useMemo(() => makeStyles(C), [C])`** (C = `useTheme()`). Fonts : `Outfit_700Bold` / `JetBrainsMono`. `ThemeColors = { [K in keyof typeof DarkColors]: string }` (pas `typeof DarkColors`). `userInterfaceStyle:"automatic"`. `useTheme()`/`useMemo` **avant** tout `return` conditionnel. `Colors` statiques : kiosk + widgetNotification seulement.

---

## Patterns transverses
- **Logger :** `src/lib/logger.ts` DEV-gated — jamais `console.*` direct.
- **Offline :** `<OfflineSyncBridge/>` sous `QueryClientProvider`. Cache persistant `['products','customers','dashboard']` (gcTime 24 h). File `offlineQueue.ts` reflush 30 s au retour réseau.
- **expo-file-system v19 :** `new File(Paths.cache, name); file.create(); file.write(x)` + `Sharing.shareAsync(uri)`.
- **Error Boundary :** racine (classe) + par route (`(tabs)/_layout`, `pos/index`, `kiosk/index`). Fallback = fonction (hooks i18n/theme).
- **Modales :** alertes/print après fermeture → différer **~350 ms** (`ALERT_AFTER_MODAL_MS`).
- **Persistance :** store `habashop-settings`. `await whenAppStoreHydrated()` avant défauts au boot. `shouldApplyTenantCurrency` = appliqué seulement si pas de choix manuel.

---

## POS / Caisse
- **Prix ligne :** `resolveLinePrice` = miroir backend (`promo > palier > base`), recalculé à chaque qty.
- **Anti sur-vente :** `capToStock` dans `addItem`/`updateQty` ; bouton `+` désactivé au max.
- **Paiement mixte :** ligne 1 saisie (devise→XOF), **ligne 2 = reste auto XOF**. `paymentMode='mixed'` jamais dans posStore → lu depuis `variables` mutation en `onSuccess`.
- **Ventes résilientes (`saleSubmit.ts`) :** 1 clé idempotente/tentative (jamais régénérée). Online : timeout/5xx → retry → bascule file offline. 4xx propagé. Offline dur → file directe.
- **Reçu :** `whatsappTicket.ts` + `printReceipt.ts` (HTML échappé). Annulation print = normale.
- **TVA :** `vatBreakdown(total, vatRate)` = TTC (`HT=total/(1+t)`). Mode HT (`posVatIncluded:false`) non géré.
- **Hors-ligne POS :** espèces-only (Wave/Orange/carte/mixte bloqués dans `confirmSale`).

---

## Push notifications
- Token : `notifications.ts` → SecureStore (`push_token`) + `POST /api/notifications/token`.
- **Logout :** `DELETE /api/notifications/token` **avant** de vider JWT (fire-and-forget).
- **Backend (`pushService.ts`) :** `sendStockAlert` (MANAGER+ADMIN), `sendPaymentReceived`/`sendLeavePending` (ADMIN), `sendTrialExpiring` (cron J-3). Tous fire-and-forget, fail-silent.
- Icône Android : `assets/notification-icon.png` (silhouette blanche sur transparent).

---

## Fidélité (`lib/loyalty.ts`)
- **Calcul 100 % serveur** (plafond 50 %). Mobile = affichage seul, ne jamais recalculer.
- Config tenant : `pointsPerAmount` / `bronze/silver/goldThreshold+Discount`. Source : `/loyalty` → store → défauts.
- Post-vente : `GET /api/customers/:id/loyalty` → delta réel (après−avant), jamais local.
- POSCart : chip « Nom · Palier · −X% » + badge remise fidélité.
- **Remboursement (`refund.ts`) :** `RefundSheet` on-demand. Rôles MANAGER+, motif obligatoire, 409 géré. Bouton inline par ligne d'historique.
- **Facture PDF (`invoicePdf.ts`) :** arraybuffer → cache `File`/`Paths` → `Sharing.shareAsync`. Tous rôles.

---

## Carte fidélité QR (`LoyaltyCardDigital.tsx`)
- ⚠️ NE PAS réintroduire `react-native-svg`/`-qrcode-svg`/`-view-shot` (natif absent → OTA cassé).
- **QR :** `QRCode.create()` pur JS → matrice → grille `<View>`. ⚠️ JAMAIS `QRCode.toDataURL()` sous Hermes → `CanvasRenderer` → `document.createElement('canvas')` inexistant → crash.
- Format : `HABA-CUST:<customerId>`. PDF : SVG inline depuis même matrice (expo-print webview).
- **Scan POS (`customerQr.ts`) :** nouveau format → `GET /api/customers/:id` direct ; ancien `HABA-<id8 MAJ>` → fallback `matchCustomerByCode` sur liste.

---

## OCR factures (`useSupplierOcr.ts` + `OcrInvoiceSheet.tsx`)
- Réglages → **Outils** (MANAGER+ seulement). Aucun écran Fournisseurs/Commandes sur mobile.
- Flux : picker caméra/galerie → compression JPEG (`ImageManipulator`, qualité 0.7, ≤1920px) → POST multipart champ **`invoice`** (override `Content-Type: multipart/form-data`, timeout 60 s). Annulation picker = ni erreur ni loading.
- Réponse : `{ supplierName, invoiceDate, items[{name,qty,unitPrice}], total, error? }`. PAS de HT/TVA/référence. Montants bruts → JAMAIS `fmt()`.
- `OcrInvoiceSheet` on-demand (anti-Fabric), 4 états. Action = `Share.share` natif + Recommencer.

---

## Scanner code-barres
- `barcodeTypes:['ean13','ean8','code128']`. `normalizeBarcode` strip espaces + zéros de tête.
- **Filtre stabilité (Android) :** code accepté 2× d'affilée (`lastCandidate`) + cooldown 1.5 s. Fallback vote 2/3.

---

## Divers
- **Biométrie :** `disableDeviceFallback:true` ; SecureStore ; `useRef` anti-double-trigger ; `setAuth` différé (modale activation avant redirect).
- **Photo profil :** locale URI AsyncStorage (pas uploadée), 200×200 JPEG.
- **Widget CA :** notification persistante (`sticky:true`+`autoDismiss:false`), canal LOW, refresh background-task → dev build.
- **Kiosque :** PIN `1234` (LONG ⚙️, `delayLongPress=600`), `kioskMode` persisté, route `fullScreenModal`.
- **WhatsApp iOS :** `LSApplicationQueriesSchemes:["whatsapp"]` dans `ios.infoPlist` (déjà posé).
- **Sentry :** import dynamique + garde `executionEnvironment !== StoreClient`. `@expo/config-plugins ~54.0.4` **dépendance directe** (sinon prebuild échoue).
- **iOS/tablette :** `useResponsive` prêt (non branché — ≠ code mort). Reflows Dashboard/POS/tab bar différés jusqu'à un iPad.

---

## État courant
- `main`, `tsc` 0, **141 tests verts**. Version **1.4.3** / runtime **1.4.3**.
- **À valider device :** offline+resync (cache à froid + abandon 3 retries), push (3 types + tap nav), ticket WhatsApp, widget (dev build), TalkBack, scanner Android, fidélité v2/carte QR, OCR MANAGER+.
- **Différé :** Play Store (AAB `1f6bf56f` prêt, captures à faire) ; layouts tablette (iPad) ; build iOS réel ; Wave/Orange prod.
