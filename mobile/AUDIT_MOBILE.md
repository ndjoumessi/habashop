# 🔍 Audit Mobile — UI/UX & Sécurité (Agent E)

**Date :** 2026-06-10 · **Périmètre :** `app/**` + `src/**` (hors `__tests__`), lecture seule.
**Référence :** ne duplique PAS `UIUX_AUDIT.md` (2026-05-27) — le Sprint A accessibilité y est listé et a été **livré depuis** : 211 attributs `accessibility*`, **98/98 Pressable/TouchableOpacity étiquetés**, 16/17 TextInput, tous les Switch. Les findings ci-dessous sont les **restes** mesurés sur le code actuel.

**Tests existants : 135 tests jest (15 suites), tous verts.** Lancer :
```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" && cd /Users/nelson/Documents/Projets/habashop-mobile && npm test
```

**Synthèse : 0 × P0 · 1 × P1 · 4 × P2 · 10 × P3.**

---

## 1. UI/UX

### 1.1 Touch targets < 44 px

Baseline saine : `headerBtn` = 44×44 partout (stock:335, pos:527, customers:311, reports:293, search `backBtn`:179), `hitSlop={8}` posé sur ~25 petits contrôles, `POSCart.qtyBtn` 28 px + hitSlop 8 = 44 effectifs ✓. Restes :

| Sév. | Fichier:ligne | Problème | Fix |
|------|---------------|----------|-----|
| **P2** | `app/(app)/kiosk/index.tsx:229-244` (style `qtyBtn` :533) | Boutons −/+ panier kiosque **32×32, AUCUN hitSlop** — écran caissier tactile = le pire endroit pour rater un tap (gap 4 entre les 2 boutons : hitSlop 6 max sans chevauchement) | `hitSlop={6}` ou passer `qtyBtn` à 40×40 (la colonne panier a la place) |
| P3 | `src/components/pos/BarcodeScanner.tsx:97` (style `closeBtn` :165) | Fermer le scanner : 40×40 sans hitSlop | `hitSlop={4}` |
| P3 | `app/(app)/search/index.tsx:107-113` (style `clearIcon` :191) | « ✕ » effacer recherche : texte `FontSize.md` + padding 4 ≈ **24 px**, pas de hitSlop | `hitSlop={12}` |
| P3 | `src/components/pos/POSCart.tsx:59` (style `delBtn` :447) | Poubelle ligne panier : icône 16 + padding 4 + hitSlop 8 ≈ **40 px** effectifs | `hitSlop={12}` ou padding 6 |
| P3 | `app/(app)/kiosk/index.tsx:262-266` (style `custRemove` :550) | « ✕ » retirer client : texte 14 px + hitSlop 8 ≈ **30 px** | `hitSlop={14}` |
| P3 | `app/(app)/kiosk/index.tsx:561` (`discountInputWrap`) | Champ remise hauteur **36 px** (POSCart :508 = 38 px, idem) | height 44 |

Non-findings (vérifiés) : `cartBadge`/`promoBadge`/`stockBadge` 16-20 px = badges décoratifs non interactifs ; checkboxes 20-22 px de `POSCart.tsx:290` et `RefundSheet.tsx:93` sont **dans** une rangée Pressable plus large ✓.

### 1.2 accessibilityLabel manquants (boutons icon-only)

Quasi clos depuis l'audit de mai (scan AST-like : **0 Pressable/TouchableOpacity sans prop accessibility**, 0 Switch nu). Reste :

| Sév. | Fichier:ligne | Problème |
|------|---------------|----------|
| P3 | `app/(app)/kiosk/index.tsx:132-139` | Le **seul TextInput de l'app sans `accessibilityLabel`** (recherche produits kiosque ; placeholder seul) |

### 1.3 Skeletons absents (écrans qui fetchent)

Un seul écran a un vrai skeleton : `settings.tsx` (`skelBar` :580). Tous les autres = `ActivityIndicator` centré (acceptable, mais layout-shift au premier paint) :

| Sév. | Écran | Loading actuel |
|------|-------|----------------|
| P3 | `app/(app)/(tabs)/dashboard.tsx:210-216` | Spinner plein écran — KPIs/top produits = formes prévisibles, skeleton facile |
| P3 | `app/(app)/(tabs)/stock.tsx:220-221` · `customers.tsx:163-164` · `sales/index.tsx:166-167` · `reports/index.tsx:179-180` | Spinner centré (listes → skeleton rows) |
| P3 | `src/components/pos/POSProductGrid.tsx` · `CustomerPicker.tsx` | Spinner dans la grille/liste |
| **P2** | `app/(app)/kiosk/index.tsx:45-49` | Query produits **sans AUCUN état loading NI error** : pendant le fetch ou en cas d'échec → grille vide silencieuse, le caissier croit le catalogue vide | Reprendre le pattern POS : `isLoading` → spinner, `isError` → `<ErrorState onRetry/>` |

Suggestion : extraire le `skelBar` de settings en `src/components/ui/Skeleton.tsx` et l'appliquer à dashboard + stock en priorité (écrans d'atterrissage).

### 1.4 Messages d'erreur réseau

Baseline **bonne** : `ErrorState` (i18n 4 langues + retry + a11y) branché sur 7 surfaces (dashboard:218, stock:223, customers:166, sales:169, reports:182, CustomerPicker:102, POSProductGrid:70) ; toutes les `Alert.alert` d'erreur passent par `i(fr,en,es,it)` avec `apiErrorMessage(err) ?? fallback i18n`. Restes :

| Sév. | Fichier:ligne | Problème | Fix |
|------|---------------|----------|-----|
| **P1** | `src/stores/authStore.ts:74-77` | `restoreSession` : le `catch` attrape **toute** erreur — y compris timeout axios 10 s / cold-start Railway / avion — et **supprime le token SecureStore** → utilisateur déconnecté de force au lancement hors-ligne ou sur réseau lent (cas nominal Afrique de l'Ouest, et exact pattern du P0 web `.catch(logout)`). NB : `/api/tenant` a déjà son `.catch(() => null)` ; c'est `/api/auth/me` qui fait tomber le tout. | Ne purger le token que si `apiErrorStatus(e) === 401 \|\| 403` ; sinon garder le token et démarrer en mode dégradé (la file offline existe déjà) |
| **P2** | `app/(app)/search/index.tsx:35-44` | Les 2 useQuery (produits/clients) **ignorent isError** → en cas d'échec réseau, la recherche affiche « Aucun résultat » : faux message, pas de retry | Lire `isError` des 2 queries → `<ErrorState onRetry/>` au lieu de l'état vide |
| P3 | `app/(app)/pos/index.tsx:315` | Scan carte fidélité : `catch { customers = [] }` → une panne réseau est annoncée « Carte non reconnue » (alerte trompeuse) | Différencier erreur réseau (alerte « réseau ») de carte inconnue |
| P3 | `app/(app)/sales/index.tsx:88-89` | `apiErrorMessage(err) ?? ''` → corps d'alerte **vide** si l'erreur n'a pas de message (timeout) | Fallback i18n comme stock.tsx:118 |
| P3 | transversal (`stock.tsx:118`, `pos/index.tsx:240`, `kiosk:83`, `login.tsx:117`…) | `apiErrorMessage` affiche le message **brut du backend** (monolangue) en priorité sur le fallback i18n — acceptable (messages serveur utiles), à savoir | Optionnel : mapper les codes d'erreur connus (`MIXED_SUM_MISMATCH`…) vers i18n |

Non-findings : les `.catch(() => {})` recensés sont quasi tous des **Haptics** (fire-and-forget légitime), du widget/FX avec fallback, ou `dashboard.tsx:113` (refresh widget opt-in) — pas des erreurs utilisateur avalées.

---

## 2. Sécurité

### 2.1 console.* non gardés par `__DEV__`

Discipline bonne : **0 `console.*` direct** hors `src/lib/logger.ts` ; `logger.log` est DEV-gated. MAIS `logger.warn`/`logger.error` sont **volontairement actifs en release** (`logger.ts:7-8`) → tout objet passé y atterrit dans les logs device (logcat/os_log).

**Sensible :**

| Sév. | Fichier:ligne | Donnée loggée |
|------|---------------|---------------|
| **P2** | `src/services/saleSubmit.ts:41,47` · `src/services/notifications.ts:76` · `app/(app)/delete-account.tsx:52` · `src/components/sales/InvoiceButton.tsx:27` · `src/services/offlineQueue.ts:31` · `src/services/widgetNotification.ts:70` | `logger.warn/error(..., err)` avec un **AxiosError complet** : `err.config.headers.Authorization` contient le **JWT Bearer**, `err.config.data` le payload (ventes, montants, customerId) → exfiltrables via `adb logcat` sur device de boutique partagé. Fix : helper `sanitizeErr(e) => ({ status: apiErrorStatus(e), msg: apiErrorMessage(e) })` dans logger.ts, ou gater warn/error derrière `__DEV__` + `captureException` Sentry (qui scrubbe les headers par défaut). |

**Anodin (pas d'action) :** `exchangeRate.ts:54,64` (API FX publique), `api.ts:24` (erreur SecureStore, pas le token), `crashReporter.ts`, `ErrorBoundary.tsx:72` / `RouteErrorFallback.tsx:22` (stack JS), `useProfilePhoto.ts:33`, `printReceipt.ts:100`, `backgroundRefresh.ts`, `LoyaltyCardDigital.tsx:59,114`, `biometric` (rien de loggé). Le push token (`notifications.ts:48,69`) et la notif reçue (`_layout.tsx:68`) passent par `logger.log` → **DEV only** ✓.

### 2.2 npm audit

```
high: 0 · critical: 0  (19 moderate, total 19)
```
**Aucune vulnérabilité high/critical.** Les 19 modérées = chaîne `expo`/`@expo/cli`/`@expo/config*`/`xcode` (tooling build, pas runtime) ; le seul fix proposé = `expo@56` **semver-major, interdit** (CLAUDE.md : rester SDK 54). → Accepté/documenté, pas d'action.

### 2.3 Stockage des secrets

| Sév. | Constat |
|------|---------|
| ✅ | **JWT dans `expo-secure-store`** (Keychain/Keystore) : écriture `authStore.ts:37`, lecture `api.ts:21` + `authStore.ts:50`, purge au logout :43. **Jamais dans AsyncStorage** (qui ne porte que prefs lang/devise/thème, cache FX, photo URI, file offline). |
| ✅ | **Aucune clé API en dur** : `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SENTRY_DSN` via env ; `.env` **gitignored** (`.gitignore:38`), seul `.env.example` (placeholders) est tracké ; `SENTRY_AUTH_TOKEN` build-only documenté non committé. Le fallback URL prod en dur (`api.ts:12`) n'est pas un secret. |
| P3 | `src/services/biometric.ts:51` : la biométrie mémorise **email + mot de passe en clair (JSON)** dans SecureStore. Chiffré au repos par l'OS, mais (1) un mot de passe réutilisé ailleurs est exposé si le Keystore est compromis (root), (2) l'item n'utilise pas `requireAuthentication: true` / `keychainAccessible` — il est lisible sans présentation biométrique au niveau OS (le gate est purement applicatif via `LocalAuthentication`). Mieux : stocker un refresh-token révocable côté backend, ou a minima poser `requireAuthentication: true` sur `CREDENTIALS_KEY`. |
| P3 | File offline `offlineQueue.ts` en **AsyncStorage non chiffré** : payloads de ventes (montants, customerId, items) lisibles sur device rooté. Données peu sensibles (pas de PII forte), à documenter plutôt qu'à corriger. |

---

## Récapitulatif

| Sév. | # | Findings |
|------|---|----------|
| P0 | 0 | — |
| P1 | 1 | `restoreSession` purge le token sur erreur réseau → logout forcé hors-ligne (`authStore.ts:74-77`) |
| P2 | 4 | JWT/payloads dans les logs release via AxiosError (6 fichiers) · kiosque sans état loading/error sur la query produits · recherche globale avale les erreurs réseau (« Aucun résultat » trompeur) · boutons −/+ kiosque 32 px sans hitSlop |
| P3 | 10 | 5 touch targets limites (scanner, ✕ recherche, poubelle panier, ✕ client kiosque, champ remise) · 1 TextInput sans label (kiosque) · skeletons absents (spinner partout sauf settings) · alerte scan carte trompeuse sur panne réseau · fallback alerte vide (sales:89) · credentials biométrie en clair SecureStore sans `requireAuthentication` |
