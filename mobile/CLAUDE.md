@AGENTS.md

# CLAUDE.md — HabaShop Mobile

> Guide Claude Code. CDC produit : `../MOBILE_APP_CDC.md` · Guide racine (web + backend + règles transverses) : `../CLAUDE.md`.
> ⚠️ **`mobile/` vit dans le monorepo `habashop`** depuis juillet 2026 (fusion `git subtree` de `habashop-mobile`), mais **hors workspaces npm** : `npm ci` / `npx jest` / EAS se lancent **depuis `mobile/`**.

App mobile React Native (iOS + Android) — caisse POS, stock, dashboard, clients. API Railway, JWT multi-tenant.
- **GitHub :** https://github.com/ndjoumessi/habashop (répertoire `mobile/`) · **Backend :** https://habashop-production.up.railway.app · **Env :** `EXPO_PUBLIC_API_URL` dans `.env`

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
- ⚠️ **Un identifiant EAS n'est PAS un commit.** Builds (`1f6bf56f-…`), updates OTA (`019f6dfe-…`) et update groups (`95673916-…`) sont des **UUID**, consultables par `eas build:view <id>` / `eas update:view <id>` — jamais par `git show`. Écrits tronqués à 8 caractères entre backticks, ils ressemblent à un SHA court et se font prendre pour tel : `git cat-file -e` échoue, on en conclut à tort un historique réécrit. **Écrire l'UUID entier et le préfixer de « build EAS » / « update EAS ».** Les vrais commits mobiles, eux, ont survécu à la fusion `git subtree` : `f95133f` (27/05) et `d949c78` (01/06) résolvent toujours.
- `appVersionSource: remote` → versionCode géré EAS. `runtimeVersion.policy = appVersion` → **bump version = change runtime** (OTA = même runtime seulement ; sinon build natif requis).
- **`app.json` = 1.5.0** (runtime 1.5.0) MAIS **build natif 1.5.0 JAMAIS fait** (quota EAS Free). Le **device tourne encore en runtime 1.4.3**. → OTA vers le device = **swap temporaire `app.json` version→1.4.3**, `eas update --branch preview`, restaure 1.5.0 (non commité). Le build 1.5.0 (à faire quand quota débloqué : reset 1er août / upgrade) embarquera **logo Sac+H + police Geist**.
- ⚠️ **Polices `@expo-google-fonts` non livrables par OTA** (.ttf bundlées au build natif seulement) → mobile reste en **Outfit** ; Geist attend le build 1.5.0 (issue #13). Label Réglages : `Constants.expoConfig?.version`.
- Play Store : AAB v1.2.0 — **build EAS** `1f6bf56f-1f95-45e0-b8f5-cd301e1470ef` (versionCode **3** ; c'est le plus haut publié, cf. § Versions). `assets/feature_graphic.png` (1024×500). Politique : `https://habashop.vercel.app/privacy`. iOS : `IOS_BUILD.md`.

---

## Commandes
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
lsof -ti tcp:8081 | xargs kill 2>/dev/null
npx expo start --clear        # Expo Go SDK 54
npx expo start --dev-client
npx tsc --noEmit              # 0 erreur — rituel avant commit
npm test                      # jest-expo (267 tests / 26 suites — mesuré 2026-07-31)
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
  (app)/delete-account.tsx  # Réglages → Compte (suppression RGPD)
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
**Helpers devise PURS (appStore, hors React)** : `formatAmount(xof, currency, rates)` = SOURCE UNIQUE de la logique symbole/décimales (utilisé par `useFmt` ET les contextes sans hook — widget, libellés) ; `formatAmountParts(...)` → `{prefix, amount, suffix}` (rendu bi-ton tuiles POS). **Jamais de « F »/« FCFA » figé** (bug corrigé : widget `backgroundRefresh`, `settings`). **Accord pluriel** : `plural(n, one, many)` (« 1 article »).

---

## Endpoints API (vérifiés)
| Endpoint | M | Forme / piège |
|----------|---|---------------|
| `/api/auth/login` | POST | `{ token, user, tenant, tenants[], activeTenantId }`. ⚠️ **Multi-boutiques v2** : compte lié à ≠1 boutique → `tenant:null` + `activeTenantId:null` → routes tenant-scopées **400 `NO_ACTIVE_TENANT`**. `authApi.login()` **auto-sélectionne `tenants[0]`** (switch-tenant) ; `restoreSession` idem si token stocké sans boutique active. Sélecteur complet = suivi (#9). |
| `/api/auth/tenants` | GET | `[{id,name,…}]` boutiques accessibles (token courant) |
| `/api/auth/switch-tenant` | POST | `{tenantId}` → `{ token, tenant, activeTenantId, role }` (nouveau JWT) |
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
| `/api/account/me` | DELETE | JWT + bcrypt password + body `"SUPPRIMER"` ; rate-limit 3/h/IP ; scope SUPER_ADMIN/ADMIN-seul→tenant, sinon→user |
| `/api/tenant/users` | GET | liste users actifs (utilisé par `delete-account` pour compter les autres admins actifs) |

`restoreSession` = `/api/auth/me` plat + `GET /api/tenant` → reconstruit user/tenant (sinon boucle refetch).

---

## Design system
```
Colors.primary '#6C47FF' · accent '#FF9500' · accent2 '#00D084' · accent3 '#00B8FF'
Colors.danger '#FF3B5C' · warn '#FFB800' · bg '#07070F' · card '#0F0F1E'
Colors.text '#F0F0FF' · text2 '#A0A0C0' · text3 '#606080'
```
**`const s = useMemo(() => makeStyles(C), [C])`** (C = `useTheme()`). Fonts : `Outfit_700Bold` / `JetBrainsMono`. `ThemeColors = { [K in keyof typeof DarkColors]: string }` (pas `typeof DarkColors`). `userInterfaceStyle:"automatic"`. `useTheme()`/`useMemo` **avant** tout `return` conditionnel. `Colors` statiques : kiosk + widgetNotification seulement.

`ThemeMode = 'dark' | 'light' | 'system'` (3 options, défaut `dark`) : Sombre / Clair / **Système** (`useColorScheme` ; `useTheme()` résout dark/light, sombre par défaut si indéterminé). **Fallback gracieux** : thème persisté obsolète (ancien `soleil`) → `dark` via `onRehydrateStorage` (`VALID_THEMES`). Option Réglages en grille 3 colonnes (une ligne, `flex:1`). Test contraste : `src/__tests__/contrast.test.ts` (Dark + Light, AA ≥4.5:1 text/text2/text3). Kiosk reste `Colors` sombre figé. *(Le « Mode soleil » et son toggle 1-tap Dashboard ont été retirés — parité avec la réduction web 9→3.)*

---

## Patterns transverses
- **Logger :** `src/lib/logger.ts` DEV-gated — jamais `console.*` direct.
- **Offline :** `<OfflineSyncBridge/>` sous `QueryClientProvider`. Cache persistant `['products','customers','dashboard']` (gcTime 24 h). File `offlineQueue.ts` reflush 30 s au retour réseau. ⚠️ **Cache périmé = piège récurrent** (scan « introuvable » sur catalogue en retard, remise fidélité sur palier obsolète refusée backend) → lot logique « stratégie de fraîcheur du cache POS » (revalider avant opération sensible + message distinguant « rejet » de « cache en retard »), cf. `[[mobile-item11-scope]]`.
- **expo-file-system v19 :** `new File(Paths.cache, name); file.create(); file.write(x)` + `Sharing.shareAsync(uri)`.
- **Error Boundary :** racine (classe) + par route (`(tabs)/_layout`, `pos/index`, `kiosk/index`). Fallback = fonction (hooks i18n/theme).
- **Modales :** alertes/print après fermeture → différer **~350 ms** (`ALERT_AFTER_MODAL_MS`).
- **Persistance :** store `habashop-settings`. `await whenAppStoreHydrated()` avant défauts au boot. `shouldApplyTenantCurrency` = appliqué seulement si pas de choix manuel.

---

## POS / Caisse
- **Prix ligne :** `resolveLinePrice` = miroir backend (`promo > palier > base`), recalculé à chaque qty. Pas de `clientType`/tarif Grossiste/Demi-gros sur mobile (= lot logique, cf. `[[mobile-item11-scope]]`).
- **Tuiles produit (item 11, maquette 01) :** prix **bi-ton** = montant en or + suffixe devise atténué SÉPARÉS (`formatAmountParts` d'appStore → `{prefix,amount,suffix}`), jamais `fmt()` entier. Stock bas (`stock ≤ stockMin >0`) = bordure `warn` + point. Barre total en or.
- **Encaissement (item 11, maquette 02) :** modes = **grille unique** avec « Mixte » en **tuile** (plus de toggle séparé). Messages d'erreur affichés **après saisie** (`cashGiven>0` / `amt` non vide). Libellé unifié « **Montant reçu** ». Providers actuels = Espèces/Wave/Orange/Carte (MTN + méthodes du split spécifiques = lot logique).
- **Remise fidélité = NET affiché + split :** `POSCart` calcule `netTotal = total − loyaltyDiscount` via `loyaltyDiscountFor()`/`computeLoyaltyDiscount()` (MIROIR backend, cf. § Fidélité). Total, split mixte, garde espèces (panier ET `confirmSale`) sur le **NET**. ⚠️ L'envoi reste **brut + `customerId`** (backend autoritaire redérive le net → pas de double remise). Avant ce fix : brut affiché/encaissé, net enregistré → écart + mixte rejeté.
- **Anti sur-vente :** `capToStock` dans `addItem`/`updateQty` ; bouton `+` désactivé au max.
- **Paiement mixte :** ligne 1 saisie (devise→XOF), **ligne 2 = reste auto XOF** (basé NET). `paymentMode='mixed'` jamais dans posStore → lu depuis `variables` mutation en `onSuccess`.
- **Ventes résilientes (`saleSubmit.ts`) :** 1 clé idempotente/tentative (jamais régénérée). Online : timeout/5xx → retry → bascule file offline. 4xx propagé. Offline dur → file directe.
- **Reçu :** `whatsappTicket.ts` + `printReceipt.ts` (HTML échappé, `fmt` dynamique). Annulation print = normale.
- **TVA :** `vatBreakdown(netTotal, vatRate)` = TTC (`HT=total/(1+t)`). Mode HT (`posVatIncluded:false`) non géré.
- **Hors-ligne POS :** espèces-only (Wave/Orange/carte/mixte bloqués dans `confirmSale`).
- **Compteurs :** accord singulier/pluriel via `plural(n, one, many)` (appStore) — « 1 article » (barre POS, historique, stock, widget).

---

## Push notifications
- Token : `notifications.ts` → SecureStore (`push_token`) + `POST /api/notifications/token`.
- **Logout :** `DELETE /api/notifications/token` **avant** de vider JWT (fire-and-forget).
- **Backend (`pushService.ts`) :** `sendStockAlert` (MANAGER+ADMIN), `sendPaymentReceived`/`sendLeavePending` (ADMIN), `sendTrialExpiring` (cron J-3). Tous fire-and-forget, fail-silent.
- Icône Android : `assets/notification-icon.png` (silhouette blanche sur transparent).

---

## Fidélité (`lib/loyalty.ts`)
- **Points = calcul 100 % serveur** (plafond 50 %). Mobile = affichage seul pour les points/paliers, ne jamais recalculer un solde.
- **Remise fidélité (XOF) = MIROIR backend** : `computeLoyaltyDiscount(total, pct, manualDiscount)` **identique** à `apps/backend/src/lib/loyalty.ts` (arrondi `Math.round`, plafond 50 %) + `loyaltyDiscountFor(customer, tenant, total, manual)` (source unique côté mobile : POSCart + garde espèces de l'écran POS). ⚠️ **Anti-dérive** : cas partagés `docs/shared-fixtures/loyalty-discount-cases.json` testés des DEUX côtés (`loyaltyDiscountShared.test.ts`) + commentaires croisés. Le mobile calcule le net hors-ligne (affichage/split) MAIS envoie **brut + `customerId`** (backend autoritaire). ⚠️ Le net vient du palier EN CACHE → si le palier change serveur sans resync, remise refusée par le backend (cf. lot logique « fraîcheur cache POS », `[[mobile-item11-scope]]`).
- Config tenant : `pointsPerAmount` / `bronze/silver/goldThreshold+Discount`. Source : `/loyalty` → store → défauts.
- Post-vente : `GET /api/customers/:id/loyalty` → delta réel (après−avant), jamais local.
- POSCart : chip client + **ligne de récap « Remise fidélité − X »** (réduit réellement le total au NET ; l'ancien badge décoratif est retiré).
- **Remboursement (`refund.ts`) :** `RefundSheet` on-demand. Rôles MANAGER+, motif obligatoire, 409 géré. Bouton inline par ligne d'historique.
- **Facture PDF (`invoicePdf.ts`) :** arraybuffer → cache `File`/`Paths` → `Sharing.shareAsync`. Tous rôles.

---

## Carte fidélité QR (`LoyaltyCardDigital.tsx`) — maquette 04
- **Structure (item 11)** : carte **hero** teintée par palier (couleurs FIXES = artefact export PDF, hors thème ; dégradé approximé par aplat teinté — **pas d'`expo-linear-gradient`**) avec pastille palier + points (or) + QR + barre de progression intégrée ; 2 cartes **palier actuel/prochain** (% remise via `discountForTierDisplay`) ; **activité récente** = historique serveur (`GET /api/customers/:id/loyalty`, 2ᵉ query — gains verts / retraits rouges).
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
- `barcodeTypes:['ean13','ean8','code128']`. **Règle canonique `src/lib/barcode.ts`** = MIROIR à l'identique de `apps/backend`/`apps/frontend` (testée contre `docs/shared-fixtures/barcode-cases.json`) : `normalizeBarcode` strip espaces + **UPC-A(12)→EAN-13** (préfixe 0), **JAMAIS de strip des zéros de tête** (casserait le round-trip). `matchesScannedCode` (scan→panier `pos/index.tsx handleProductScan`) = barcode canonique **OU SKU EXACT** (résout les étiquettes CODE128-sur-SKU) ; `barcodeMatches` = recherche (stock + globale, nom/**SKU**/barcode). Complétion d'un code manquant : champ + Scanner dans le modal d'édition stock (`(tabs)/stock.tsx`). ⚠️ `Product.ean` = legacy jamais peuplé (pas de colonne backend) → non comparé au scan.
- **Filtre stabilité (Android) :** code accepté 2× d'affilée (`lastCandidate`) + cooldown 1.5 s. Fallback vote 2/3.

---

## Divers
- **Rapports (`(app)/reports`) ⚠️ UNE SEULE FENÊTRE :** `salesByWeekday` / `bestCalendarDay` / `topProductsInPeriod` (`src/lib/reportsAggregate.ts`, **purs**) agrègent le tableau reçu et **n'ont aucune notion de période** — l'écran les nourrit avec `filtered`. Ne JAMAIS refenêtrer localement : l'ancien `Math.min(periodDays, 7)` faisait répondre le graphe et « Meilleure journée » sur 7 jours pendant que CA/Transactions/Panier moyen portaient sur 90 — **2,90 € à côté d'un panier de 52,83 €**, deux vérités sur le même écran. ⚠️ **La seconde fenêtre peut aussi venir d'une AUTRE REQUÊTE, pas d'un refenêtrage** : le Top produits lisait `dash.topProducts`, calculé backend sur le **mois calendaire** (`monthStart`) — donc immobile en 7 j / 30 j / 90 j, « Huile végétale 25,91 € » à côté d'un CA de 17 010 €. Corrigé en repartant du **même `filtered`** (requête `dashboard` retirée de l'écran), agrégation **par nom** comme le web, tri **par CA**. ⚠️ Ce tri ne se prouve pas sur le cas nominal : il reste **VERT sous un tri par `qty`** (le produit le plus vendu y est aussi le plus gros CA) — seul un cas où les deux ordres divergent (100 bonbons à 2 000 vs 1 sac de riz à 12 000) discrimine. Totaux sommés en **XOF brut**, `fmt` convertit UNE fois à l'affichage. Clé calendaire **locale** (`toISOString()` ferait basculer une vente de 23 h au lendemain) et libellés jours/mois **en dur** (Hermes ignore `toLocaleDateString`). ⚠️ **Le clamp de la bulle (`bubbleLeftPx`) est extrait exprès** : un clamp ne s'observe qu'**un bord à la fois**, donc une vérification à l'œil en laisse toujours un non prouvé (la campagne de captures couvrait Dim, jamais Lun) — le test exerce les 7 positions sur 4 largeurs. Verrou `reportsAggregate.test.ts` (28, sabotages vérifiés).
- **Biométrie :** `disableDeviceFallback:true` ; SecureStore ; `useRef` anti-double-trigger ; `setAuth` différé (modale activation avant redirect).
- **Photo profil :** locale URI AsyncStorage (pas uploadée), 200×200 JPEG.
- **Widget CA :** notification persistante (`sticky:true`+`autoDismiss:false`), canal LOW, refresh background-task → dev build.
- **Kiosque :** PIN `1234` (LONG ⚙️, `delayLongPress=600`), `kioskMode` persisté, route `fullScreenModal`.
- **WhatsApp iOS :** `LSApplicationQueriesSchemes:["whatsapp"]` dans `ios.infoPlist` (déjà posé).
- **Suppression compte (`delete-account.tsx`) :** Réglages → Compte. `accountApi.deleteMe` / `tenantUsers`. Scope : SUPER_ADMIN ou ADMIN seul→cascade tenant ; ADMIN avec autres actifs / autre rôle→user. `accountCleanup.ts` purge biométrie/photo/offline/panier + logout (garde lang/thème/devise). Erreurs : 401, 429, 410 déjà supprimé = succès silencieux. ⚠️ Tester sur tenant dédié, **JAMAIS le compte démo**.
- **Sentry :** import dynamique + garde `executionEnvironment !== StoreClient`. `@expo/config-plugins ~54.0.4` **dépendance directe** (sinon prebuild échoue).
- **iOS/tablette :** `useResponsive` prêt (non branché — ≠ code mort). Reflows Dashboard/POS/tab bar différés jusqu'à un iPad.

---

## État courant
- **Monorepo** : le mobile vit désormais dans `ndjoumessi/habashop` sous `mobile/` (les repos `habashop-mobile`/`-legal` sont archivés). `.env` mobile non commité (gitignored).
- `main`, `tsc` 0, **267 tests verts (26 suites)** *(mesuré 2026-07-31)*. `app.json` **1.5.0** (runtime 1.5.0) mais **device en runtime 1.4.3** (build 1.5.0 pas encore fait, cf. section Versions).
- **Item 11 (portage refonte UX web) — lot UI OTA'd sur canal preview** : fuites devise, POS 01 (tuiles bi-ton + stock bas), safe-area panier, encaissement 02 (Mixte tuile + pluriel), fix argent fidélité (NET), carte fidélité 04. **Hors lot (logique, à cadrer)** : Ticket Z, onboarding, sélecteur tarif, fraîcheur cache POS, provider MTN. Cf. `[[mobile-item11-scope]]`. *(Codes-barres = FAIT, Chantier A : scan/complétion fiche + recherche SKU + règle canonique partagée.)*
- **Livré par OTA (canal preview, runtime 1.4.3)** : fix multi-boutiques (auto-sélection boutique), **mode sombre NKONI** (fond bleu-noir `#0A0C14`, cartes `#121724`, or `#FFB020`, `border3` glow violet ; `src/constants/theme.ts` `Colors`+`DarkColors`), **thèmes réduits à 3** (Sombre/Clair/Système, #19) + grille 3 colonnes (#20) — dernier update group `95673916-5efe-44f7-a521-719616634a1c` (Android `019f6dfe-d23e-7f55…`, iOS `019f6dfe-d23e-7592…`, commit `1c38fae4`). Police = **Outfit** (Geist attend le build natif, #13).
- **En attente du build natif 1.5.0** (quota EAS) : **logo Sac+H** (icône/splash) + **police Geist**.
- **Validé device (2026-05-27, APK — build EAS `382fe2ec-bacf-4e76-906b-33cdc6162c05`) :** scanner EAN13 ✅, thème clair ✅, kiosque+PIN ✅, encaissement→API ✅, biométrie ✅, suppression compte (scénario ADMIN seul→cascade tenant) ✅.
- **À valider device :** offline+resync (cache à froid + abandon 3 retries), push (3 types + tap nav), ticket WhatsApp, widget (dev build), TalkBack, carte QR, OCR MANAGER+.
- **Différé :** Play Store (AAB v1.2.0 prêt — build EAS ci-dessus, captures à faire) ; layouts tablette (iPad) ; build iOS réel ; Wave/Orange prod.
