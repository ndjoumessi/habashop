# 🍎 iOS Build — Guide HabaShop

> ⚠️ Aucun build iOS n'a encore été fait (pas de compte Apple Developer). Ce guide = prep.
> Config iOS déjà en place dans `app.json` : `bundleIdentifier`, `buildNumber`, `supportsTablet:true`,
> permissions (caméra, photos, Face ID, WhatsApp). Profil `preview` iOS = **simulateur** (`eas.json`).

## Prérequis
- [ ] Compte **Apple Developer** (99 $/an) → https://developer.apple.com/enroll/
  (Individual / Sole Proprietor — pas de numéro D-U-N-S requis pour un individu)
- [ ] Mac avec Xcode 15+ (pour lancer le simulateur / Transporter)
- [ ] Un iPhone réel pour le test final (crash au lancement = motif de rejet fréquent)

## Étape 1 — Enregistrer l'app dans App Store Connect
1. https://appstoreconnect.apple.com → Mes Apps → ＋ → Nouvelle app
2. Plateforme : iOS · Nom : `HabaShop — Caisse & Stock`
3. Bundle ID : `com.habashop.app` (identique à Android) · SKU : `habashop-mobile-001`

## Étape 2 — Build simulateur (gratuit, sans compte Apple)
```bash
cd /Users/nelson/Documents/Projets/habashop-mobile
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
eas build --platform ios --profile preview   # → .app pour simulateur Xcode (ios.simulator:true)
```

## Étape 3 — Build production (App Store) — nécessite le compte Apple actif
```bash
eas build --platform ios --profile production   # → .ipa signé
```

## Étape 4 — Soumettre
```bash
eas submit --platform ios   # ou via Xcode / Transporter
```

## Étape 5 — Fiche App Store
- **Titre** (≤30) : `HabaShop — Caisse & Stock`
- **Sous-titre** (≤30) : `Gestion boutique Afrique`
- **Description** : identique à Google Play → voir `PLAY_STORE.md` (FR/EN/ES/IT)
- **Mots-clés** (≤100) : `caisse,POS,stock,boutique,Afrique,gestion,commerce`
- **Catégorie** : Affaires (Business)
- **Captures requises** :
  - iPhone 6.7" (15 Pro Max) : 1290×2796
  - iPhone 6.5" (14 Plus) : 1284×2778
  - iPad Pro 12.9" : 2048×2732 (car `supportsTablet:true`)
- **Politique de confidentialité** : https://habashop.vercel.app/privacy ✅ (live)
- **Compte démo pour la review** : `admin@habashop.com` / `demo1234` (Apple exige un accès sans inscription)

## Config déjà prête (`app.json`)
| Clé | Valeur | Pourquoi |
|-----|--------|----------|
| `bundleIdentifier` | `com.habashop.app` | cohérence avec Android |
| `supportsTablet` | `true` | iPhone + iPad |
| `NSCameraUsageDescription` | ✅ | scan EAN13 |
| `NSPhotoLibraryUsageDescription` | ✅ | photo de profil |
| `NSFaceIDUsageDescription` | ✅ | biométrie |
| `LSApplicationQueriesSchemes: ["whatsapp"]` | ✅ | `Linking.canOpenURL('whatsapp://')` (sinon `false` sur iOS) |

## ⚠️ À finaliser avant un vrai build iOS
- **Orientation iPad paysage** : `app.json` est encore `orientation: "portrait"` (global). Pour exploiter
  le paysage iPad (layouts tablette), il faudra passer en `orientation: "default"` + tableaux
  `UISupportedInterfaceOrientations~ipad` — **lié au chantier layout tablette** (non fait, cf. Sprint 5).
- **`resourceClass` production** : laissé au défaut EAS (les valeurs type `m1-medium` sont obsolètes).
- Tester sur un **iPhone réel** : Face ID, scanner, WhatsApp (`whatsapp://`), pas de contenu sous la Dynamic Island.

## Délais
- 1ʳᵉ soumission : 1–3 jours · mises à jour : quelques heures.
- Rejets fréquents : politique confidentialité manquante (✅ ok), crash au lancement, login sans compte démo (✅ fourni).
