# Audit performance mobile — HabaShop Mobile (Expo / Hermes)

Agent F — audit lecture seule, 2026-06-10. Mesures sur l'export `dist/` du jour (généré 2026-06-10 21:52, aucun build relancé).

## 1. Métriques

| Métrique | Valeur |
|---|---|
| Bundle Hermes Android (`dist/_expo/static/js/android/entry-*.hbc`) | **4,30 MB** (4 298 372 o) |
| Bundle Hermes iOS (`dist/_expo/static/js/ios/entry-*.hbc`) | **4,30 MB** (4 300 588 o) |
| Assets bundlés (`dist/assets`, 58 fichiers) | **6,4 MB** — dont **6,28 MB de polices** |
| ↳ Polices d'icônes `@expo/vector-icons` (16 familles) | 3 981 KB |
| ↳ JetBrains Mono (16 graisses, dont 8 italiques) | 1 820 KB |
| ↳ Outfit (9 graisses) | 484 KB |
| `assets/` source (icônes app, splash) | 248 KB — RAS |
| Code applicatif | 83 fichiers TS/TSX, 10 387 lignes |

**Constat clé : ~5,3 MB d'assets bundlés sont du poids mort** (polices jamais référencées), soit ~83 % du dossier assets. Le bundle JS de 4,3 MB est dans la norme pour Expo 54 + expo-router + react-query + Sentry.

## 2. Findings priorisés

### P0 — Polices d'icônes : 3,6 MB gaspillés ✅ actionnable sans changement de comportement
Seul **Ionicons** est utilisé (94 usages, 16 fichiers), mais l'import barrel `import { Ionicons } from '@expo/vector-icons'` fait embarquer par Metro les **16 familles** (MaterialCommunityIcons 1,28 MB, FontAwesome6 ×2, Ionicons, MaterialIcons, Fontisto, etc.).

- **Fix** : remplacer dans les 16 fichiers par `import Ionicons from '@expo/vector-icons/Ionicons'` (subpath confirmé existant dans `node_modules/@expo/vector-icons/Ionicons.js`). Rendu strictement identique.
- **Gain : ~3,6 MB** (ne reste que `Ionicons.ttf`, 381 KB).
- Fichiers : `src/components/customers/LoyaltyCardDigital.tsx:7`, `src/components/ui/AccessibleButton.tsx:4`, `ScreenHeader.tsx:4`, `src/components/pos/CustomerPicker.tsx:5`, `RefundSheet.tsx:5`, `POSProductGrid.tsx:3`, `POSCart.tsx:3`, et 9 écrans sous `app/`.

### P0 — JetBrains Mono : 16 graisses bundlées, 2 utilisées ✅ actionnable
`app/_layout.tsx:14-15` importe `JetBrainsMono_400Regular, JetBrainsMono_700Bold` depuis le barrel `@expo-google-fonts/jetbrains-mono` → Metro embarque les 16 ttf (1 820 KB) alors que `useFonts` n'en charge que 2 (~224 KB).

- **Fix** : imports subpath (packages par graisse confirmés) :
  `import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular'` (idem `700Bold`).
- **Gain : ~1,6 MB.**

### P1 — Outfit : 9 graisses bundlées, 5 chargées ✅ actionnable
`app/_layout.tsx:10-12` (barrel `@expo-google-fonts/outfit`) → 9 ttf bundlés (484 KB) pour 5 chargés (400/600/700/800/900).

- **Fix** : mêmes imports subpath par graisse. **Gain : ~215 KB.**
- Bonus optionnel (micro) : `Outfit_900Black` n'est utilisé qu'à `app/(auth)/login.tsx:328` — passer au 800 déjà chargé en retirerait une 5ᵉ graisse (−54 KB). *Changement visuel léger → hors « sans changement de comportement ».*

### P2 — `removeClippedSubviews={false}` sur les 8 FlatList (9 occurrences)
Toutes les listes désactivent explicitement le clipping : `CustomerPicker.tsx:105`, `POSProductGrid.tsx:74`, `stock.tsx:226`, `search/index.tsx:139`, `sales/index.tsx:172`, `customers.tsx:169`, `kiosk/index.tsx:159` et `:210`. Sur un catalogue/une base clients de plusieurs centaines de lignes, cela augmente mémoire et coût de rendu hors-écran (surtout Android).

- Si c'était un contournement d'un glitch visuel ponctuel, le documenter ; sinon retirer la prop sur les listes longues (stock, clients, ventes, grille POS). *À valider visuellement → pas garanti iso-comportement (glitches de clipping Android possibles).*

### P2 — Aucune mémoïsation des lignes de liste ; closures inline dans `renderItem`
- `grep React.memo` → **0 occurrence** dans tout le code. Tous les `renderItem` sont des arrows inline avec closures recréées à chaque rendu : `POSProductGrid.tsx:88-95`, `stock.tsx:241`, `customers.tsx:182`, `sales/index.tsx:184`, `kiosk/index.tsx:166,221`, `search/index.tsx:144`, `CustomerPicker.tsx:113`.
- Cas le plus chaud : **grille POS** — chaque tap d'ajout au panier modifie `cart` → re-render de toutes les cartes produits visibles ; de plus `qtyOf` (`POSProductGrid.tsx:64`) fait un `cart.find` par produit (O(produits × panier)).
- **Fix iso-comportement** : `React.memo(ProductCard)` (+ `CustomerCard`, `ProductRow`), `qtyOf` précalculé en `Map` via `useMemo([cart])`, callbacks stables (`useCallback`). Gain : fluidité tap-to-feedback du POS sur catalogues moyens/gros et bas de gamme Android.

### P2 — Pas de tuning de virtualisation
Aucune liste ne définit `getItemLayout` / `initialNumToRender` / `windowSize` / `maxToRenderPerBatch` (grep = 0). Les lignes de stock/ventes/clients sont de hauteur quasi fixe → `getItemLayout` est applicable et supprime la mesure asynchrone (scroll-to et scroll rapide plus fluides). ✅ actionnable, iso-comportement.

### P3 — Divers (faible impact)
- **ScrollView** : tous les usages sont bornés (settings, modales, login, dashboard) — correct. Seul `POSCart.tsx:164` rend les lignes du panier dans une ScrollView : OK pour des paniers <50 lignes, à surveiller si paniers très longs.
- **Images** : usage quasi nul (`Avatar.tsx:35` — dimensions + `resizeMode="cover"` posés ✅). Produits affichés par emoji texte = très léger. RAS.
- **axios** (1 seul point d'entrée `src/services/api.ts`) : remplaçable par `fetch` (−~100 KB de JS bundlé) mais la gestion d'erreurs typée axios est répandue → coût/bénéfice défavorable. Non recommandé maintenant.
- **Sentry** : `tracesSampleRate: 0.2` + init paresseuse hors Expo Go (`crashReporter.ts`) — raisonnable.
- **PNG racine `assets/`** (248 KB) : icônes app/splash, non compressibles utilement (formats imposés par les stores) ; `feature_graphic.png` (33 KB) est un asset Play Store non bundlé. RAS.

## 3. package.json — dépendances non utilisées

| Dépendance | Usage trouvé | Verdict |
|---|---|---|
| `expo-clipboard` | **0 import** dans src/app | ✅ Supprimable (module natif autolinké : poids natif + init au démarrage pour rien) |
| `@expo/config-plugins` | 0 usage direct, aucun plugin local (`*.plugin.js` absent) | ✅ Supprimable des `dependencies` (fourni transitivement par `expo`) |
| `react-native-reanimated` / `react-native-worklets` | 0 import direct, **mais dépendance de `expo-router@6`** (`npm ls` confirmé) | ❌ Garder |
| `expo-linking`, `react-native-screens`, `expo-font`, `expo-splash-screen` | Requis par expo-router / plugins app.json | ❌ Garder |
| `expo-dev-client` | Dev builds uniquement (exclu des builds release) | OK |
| Tout le reste (camera, print, notifications, secure-store, netinfo, qrcode, etc.) | ≥1 import réel vérifié | OK |

## 4. Récapitulatif des gains

| Action | Gain | Risque |
|---|---|---|
| Imports subpath `@expo/vector-icons/Ionicons` (16 fichiers) | **−3,6 MB** assets | Nul |
| Imports subpath JetBrains Mono (2 graisses) | **−1,6 MB** assets | Nul |
| Imports subpath Outfit (5 graisses) | **−215 KB** assets | Nul |
| Retrait `expo-clipboard` + `@expo/config-plugins` | binaire natif + démarrage | Très faible |
| `React.memo` + Map qty + callbacks stables (POS grid en premier) | fluidité POS | Faible |
| `getItemLayout` + retrait `removeClippedSubviews={false}` sur listes longues | scroll | Faible (clipping à re-tester) |

**Total assets : 6,4 MB → ~1,0 MB (−84 %)** uniquement avec les 3 premières actions, sans aucun changement de comportement, ni de rendu.
