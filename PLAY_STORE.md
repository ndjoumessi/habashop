# 📦 Google Play Store — Guide publication HabaShop

> Versionnage actuel : **version `1.2.0` · `versionCode 3` · iOS `buildNumber 3`** (cf. `app.json`).
> Le `versionCode` Android doit **s'incrémenter à chaque upload** sur la Play Console.

## Prérequis
- [ ] Compte Google Play Developer (25 $ une fois) → https://play.google.com/console/signup
- [ ] Build **AAB** production signé (keystore EAS `sH_oz3rpgx` — **ne pas régénérer**)
- [ ] Captures d'écran (min 2, max 8 par type ; téléphone 1080×1920+)
- [ ] Icône 512×512 PNG (déjà : `assets/icon.png`, logo HabaShop)
- [ ] Feature graphic 1024×500 PNG
- [ ] Politique de confidentialité en ligne (renseignée **dans la Play Console**, pas dans `app.json`)

## Étape 1 — Build production AAB
```bash
cd /Users/nelson/Documents/Projets/habashop-mobile
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
eas build --platform android --profile production
```
→ Génère un `.aab` (Android App Bundle) — à télécharger depuis expo.dev → Builds.
⚠️ Auth EAS : la session se fait **dans ton terminal** (elle ne se propage pas aux shells de Claude).

## Étape 2 — Google Play Console
1. https://play.google.com/console → **Créer une application** → HabaShop
2. Langue par défaut : **Français (France)**
3. Type : Application · Gratuite

## Étape 3 — Fiche store
**Titre (≤ 50)** : `HabaShop — Caisse & Gestion Boutique`
**Description courte (≤ 80)** : `Caisse POS, stock et clients pour boutiques africaines`

**Description longue (≤ 4000)** :
```
HabaShop est le logiciel de gestion commerciale conçu pour les boutiques,
superettes et commerces en Afrique francophone.

Fonctionnalités principales :
📱 Point de Vente (POS) — Encaissez en quelques secondes
🖥️ Mode kiosque caissier — Affichage dédié plein écran
📦 Gestion du stock — Alertes de rupture en temps réel
👥 Clients — Historique, fidélité, WhatsApp
📊 Dashboard — KPIs et analytics en temps réel
🌍 Multi-langues — Français, English, Español, Italiano
💱 Multi-devises — XOF, XAF, EUR, USD, GBP, CAD
📴 Mode hors-ligne — Vendez même sans internet
🔐 Biométrie — Connexion Face ID / empreinte
💬 WhatsApp — Envoyez les reçus instantanément
📷 Scanner — Scan EAN13 des codes-barres
🌗 Thème clair / sombre

Parfait pour : boutiques, épiceries, superettes, grossistes, pharmacies,
quincailleries.

Essayez gratuitement sur habashop.vercel.app
```
**Catégorie** : Entreprises · **Tags** : caisse, POS, boutique, Afrique, stock, gestion

## Étape 4 — Captures (téléphone)
1. Login (logo HabaShop) 2. Dashboard (KPIs) 3. POS (produits + panier)
4. Stock (alertes) 5. Clients 6. Rapports 7. Réglages (langue/devise/thème) 8. Recherche

## Étape 5 — Classification du contenu
Audience : Tout public · Aucun contenu sensible · Pas de publicités

## Étape 6 — Soumettre
- Révision Google : 1–7 jours ouvrables
- 1ʳᵉ publication : manuelle ; mises à jour suivantes : automatiques si validées

## Hotfix sans re-soumettre (OTA)
Les corrections **JS-only** passent par `eas update` (expo-updates est configuré,
`runtimeVersion.policy = appVersion`). Tout changement **natif** (nouvelle lib,
permission, version) impose un **nouveau build AAB + upload** avec `versionCode` incrémenté.
